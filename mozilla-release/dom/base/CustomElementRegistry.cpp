/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/CustomElementRegistry.h"

#include "mozilla/CycleCollectedJSContext.h"
#include "mozilla/dom/CustomElementRegistryBinding.h"
#include "mozilla/dom/HTMLElementBinding.h"
#include "mozilla/dom/Promise.h"
#include "mozilla/dom/WebComponentsBinding.h"
#include "mozilla/dom/DocGroup.h"
#include "nsHTMLTags.h"
#include "jsapi.h"

namespace mozilla {
namespace dom {

//-----------------------------------------------------
// CustomElementUpgradeReaction

class CustomElementUpgradeReaction final : public CustomElementReaction
{
public:
  explicit CustomElementUpgradeReaction(CustomElementDefinition* aDefinition)
    : mDefinition(aDefinition)
  {
#if DEBUG
    mIsUpgradeReaction = true;
#endif
  }

private:
  virtual void Invoke(Element* aElement, ErrorResult& aRv) override
  {
    CustomElementRegistry::Upgrade(aElement, mDefinition, aRv);
  }

  CustomElementDefinition* mDefinition;
};

//-----------------------------------------------------
// CustomElementCallbackReaction

class CustomElementCallbackReaction final : public CustomElementReaction
{
  public:
    explicit CustomElementCallbackReaction(UniquePtr<CustomElementCallback> aCustomElementCallback)
      : mCustomElementCallback(Move(aCustomElementCallback))
    {
    }

    virtual void Traverse(nsCycleCollectionTraversalCallback& aCb) const override
    {
      mCustomElementCallback->Traverse(aCb);
    }

  private:
    virtual void Invoke(Element* aElement, ErrorResult& aRv) override
    {
      mCustomElementCallback->Call();
    }

    UniquePtr<CustomElementCallback> mCustomElementCallback;
};

//-----------------------------------------------------
// CustomElementCallback

void
CustomElementCallback::Call()
{
  IgnoredErrorResult rv;
  switch (mType) {
    case nsIDocument::eConnected:
      static_cast<LifecycleConnectedCallback *>(mCallback.get())->Call(mThisObject, rv);
      break;
    case nsIDocument::eDisconnected:
      static_cast<LifecycleDisconnectedCallback *>(mCallback.get())->Call(mThisObject, rv);
      break;
    case nsIDocument::eAdopted:
      static_cast<LifecycleAdoptedCallback *>(mCallback.get())->Call(mThisObject,
        mAdoptedCallbackArgs.mOldDocument, mAdoptedCallbackArgs.mNewDocument, rv);
      break;
    case nsIDocument::eAttributeChanged:
      static_cast<LifecycleAttributeChangedCallback *>(mCallback.get())->Call(mThisObject,
        mArgs.name, mArgs.oldValue, mArgs.newValue, mArgs.namespaceURI, rv);
      break;
  }
}

void
CustomElementCallback::Traverse(nsCycleCollectionTraversalCallback& aCb) const
{
  NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(aCb, "mThisObject");
  aCb.NoteXPCOMChild(mThisObject);

  NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(aCb, "mCallback");
  aCb.NoteXPCOMChild(mCallback);
}

CustomElementCallback::CustomElementCallback(Element* aThisObject,
                                             nsIDocument::ElementCallbackType aCallbackType,
                                             mozilla::dom::CallbackFunction* aCallback)
  : mThisObject(aThisObject),
    mCallback(aCallback),
    mType(aCallbackType)
{
}
//-----------------------------------------------------
// CustomElementConstructor

already_AddRefed<Element>
CustomElementConstructor::Construct(const char* aExecutionReason,
                                    ErrorResult& aRv)
{
  CallSetup s(this, aRv, aExecutionReason,
              CallbackFunction::eRethrowExceptions);

  JSContext* cx = s.GetContext();
  if (!cx) {
    MOZ_ASSERT(aRv.Failed());
    return nullptr;
  }

  JS::Rooted<JSObject*> result(cx);
  JS::Rooted<JS::Value> constructor(cx, JS::ObjectValue(*mCallback));
  if (!JS::Construct(cx, constructor, JS::HandleValueArray::empty(), &result)) {
    aRv.NoteJSContextException(cx);
    return nullptr;
  }

  RefPtr<Element> element;
  if (NS_FAILED(UNWRAP_OBJECT(Element, &result, element))) {
    return nullptr;
  }

  return element.forget();
}

//-----------------------------------------------------
// CustomElementData

CustomElementData::CustomElementData(nsAtom* aType)
  : CustomElementData(aType, CustomElementData::State::eUndefined)
{
}

CustomElementData::CustomElementData(nsAtom* aType, State aState)
  : mState(aState)
  , mType(aType)
{
}

void
CustomElementData::SetCustomElementDefinition(CustomElementDefinition* aDefinition)
{
  MOZ_ASSERT(mState == State::eCustom);
  MOZ_ASSERT(!mCustomElementDefinition);
  MOZ_ASSERT(aDefinition->mType == mType);

  mCustomElementDefinition = aDefinition;
}

CustomElementDefinition*
CustomElementData::GetCustomElementDefinition()
{
  MOZ_ASSERT(mCustomElementDefinition ? mState == State::eCustom
                                      : mState != State::eCustom);

  return mCustomElementDefinition;
}

nsAtom*
CustomElementData::GetCustomElementType()
{
  return mType;
}

void
CustomElementData::Traverse(nsCycleCollectionTraversalCallback& aCb) const
{
  for (uint32_t i = 0; i < mReactionQueue.Length(); i++) {
    if (mReactionQueue[i]) {
      mReactionQueue[i]->Traverse(aCb);
    }
  }

  if (mCustomElementDefinition) {
    NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(aCb, "mCustomElementDefinition");
    aCb.NoteNativeChild(mCustomElementDefinition,
      NS_CYCLE_COLLECTION_PARTICIPANT(CustomElementDefinition));
  }
}

void
CustomElementData::Unlink()
{
  mReactionQueue.Clear();
  mCustomElementDefinition = nullptr;
}

//-----------------------------------------------------
// CustomElementRegistry

namespace {

class MOZ_RAII AutoConstructionStackEntry final
{
public:
  AutoConstructionStackEntry(nsTArray<RefPtr<Element>>& aStack,
                             Element* aElement)
    : mStack(aStack)
  {
    MOZ_ASSERT(aElement->IsHTMLElement() || aElement->IsXULElement());

    mIndex = mStack.Length();
    mStack.AppendElement(aElement);
  }

  ~AutoConstructionStackEntry()
  {
    MOZ_ASSERT(mIndex == mStack.Length() - 1,
               "Removed element should be the last element");
    mStack.RemoveElementAt(mIndex);
  }

private:
  nsTArray<RefPtr<Element>>& mStack;
  uint32_t mIndex;
};

} // namespace anonymous

// Only needed for refcounted objects.
NS_IMPL_CYCLE_COLLECTION_CLASS(CustomElementRegistry)

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN(CustomElementRegistry)
  tmp->mConstructors.clear();
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mCustomDefinitions)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mWhenDefinedPromiseMap)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mWindow)
  NS_IMPL_CYCLE_COLLECTION_UNLINK_PRESERVED_WRAPPER
NS_IMPL_CYCLE_COLLECTION_UNLINK_END

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN(CustomElementRegistry)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mCustomDefinitions)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mWhenDefinedPromiseMap)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mWindow)
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTION_TRACE_BEGIN(CustomElementRegistry)
  for (ConstructorMap::Enum iter(tmp->mConstructors); !iter.empty(); iter.popFront()) {
    aCallbacks.Trace(&iter.front().mutableKey(),
                     "mConstructors key",
                     aClosure);
  }
  NS_IMPL_CYCLE_COLLECTION_TRACE_PRESERVED_WRAPPER
NS_IMPL_CYCLE_COLLECTION_TRACE_END

NS_IMPL_CYCLE_COLLECTING_ADDREF(CustomElementRegistry)
NS_IMPL_CYCLE_COLLECTING_RELEASE(CustomElementRegistry)

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION(CustomElementRegistry)
  NS_WRAPPERCACHE_INTERFACE_MAP_ENTRY
  NS_INTERFACE_MAP_ENTRY(nsISupports)
NS_INTERFACE_MAP_END

CustomElementRegistry::CustomElementRegistry(nsPIDOMWindowInner* aWindow)
 : mWindow(aWindow)
 , mIsCustomDefinitionRunning(false)
{
  MOZ_ASSERT(aWindow);
  MOZ_ALWAYS_TRUE(mConstructors.init());

  mozilla::HoldJSObjects(this);
}

CustomElementRegistry::~CustomElementRegistry()
{
  mozilla::DropJSObjects(this);
}

CustomElementDefinition*
CustomElementRegistry::LookupCustomElementDefinition(const nsAString& aLocalName,
                                                     nsAtom* aTypeAtom) const
{
  RefPtr<nsAtom> localNameAtom = NS_Atomize(aLocalName);
  CustomElementDefinition* data = mCustomDefinitions.GetWeak(aTypeAtom);
  if (data && data->mLocalName == localNameAtom) {
    return data;
  }

  return nullptr;
}

CustomElementDefinition*
CustomElementRegistry::LookupCustomElementDefinition(JSContext* aCx,
                                                     JSObject* aConstructor) const
{
  JS::Rooted<JSObject*> constructor(aCx, js::CheckedUnwrap(aConstructor));

  const auto& ptr = mConstructors.lookup(constructor);
  if (!ptr) {
    return nullptr;
  }

  CustomElementDefinition* definition = mCustomDefinitions.GetWeak(ptr->value());
  MOZ_ASSERT(definition, "Definition must be found in mCustomDefinitions");

  return definition;
}

void
CustomElementRegistry::RegisterUnresolvedElement(Element* aElement, nsAtom* aTypeName)
{
  mozilla::dom::NodeInfo* info = aElement->NodeInfo();

  // Candidate may be a custom element through extension,
  // in which case the custom element type name will not
  // match the element tag name. e.g. <button is="x-button">.
  RefPtr<nsAtom> typeName = aTypeName;
  if (!typeName) {
    typeName = info->NameAtom();
  }

  if (mCustomDefinitions.GetWeak(typeName)) {
    return;
  }

  nsTArray<nsWeakPtr>* unresolved = mCandidatesMap.LookupOrAdd(typeName);
  nsWeakPtr* elem = unresolved->AppendElement();
  *elem = do_GetWeakReference(aElement);
}

void
CustomElementRegistry::UnregisterUnresolvedElement(Element* aElement,
                                                   nsAtom* aTypeName)
{
  nsTArray<nsWeakPtr>* candidates;
  if (mCandidatesMap.Get(aTypeName, &candidates)) {
    MOZ_ASSERT(candidates);
    // We don't need to iterate the candidates array and remove the element from
    // the array for performance reason. It'll be handled by bug 1396620.
    for (size_t i = 0; i < candidates->Length(); ++i) {
      nsCOMPtr<Element> elem = do_QueryReferent(candidates->ElementAt(i));
      if (elem && elem.get() == aElement) {
        candidates->RemoveElementAt(i);
      }
    }
  }
}

/* static */ UniquePtr<CustomElementCallback>
CustomElementRegistry::CreateCustomElementCallback(
  nsIDocument::ElementCallbackType aType, Element* aCustomElement,
  LifecycleCallbackArgs* aArgs,
  LifecycleAdoptedCallbackArgs* aAdoptedCallbackArgs,
  CustomElementDefinition* aDefinition)
{
  MOZ_ASSERT(aDefinition, "CustomElementDefinition should not be null");
  MOZ_ASSERT(aCustomElement->GetCustomElementData(),
             "CustomElementData should exist");

  // Let CALLBACK be the callback associated with the key NAME in CALLBACKS.
  CallbackFunction* func = nullptr;
  switch (aType) {
    case nsIDocument::eConnected:
      if (aDefinition->mCallbacks->mConnectedCallback.WasPassed()) {
        func = aDefinition->mCallbacks->mConnectedCallback.Value();
      }
      break;

    case nsIDocument::eDisconnected:
      if (aDefinition->mCallbacks->mDisconnectedCallback.WasPassed()) {
        func = aDefinition->mCallbacks->mDisconnectedCallback.Value();
      }
      break;

    case nsIDocument::eAdopted:
      if (aDefinition->mCallbacks->mAdoptedCallback.WasPassed()) {
        func = aDefinition->mCallbacks->mAdoptedCallback.Value();
      }
      break;

    case nsIDocument::eAttributeChanged:
      if (aDefinition->mCallbacks->mAttributeChangedCallback.WasPassed()) {
        func = aDefinition->mCallbacks->mAttributeChangedCallback.Value();
      }
      break;
  }

  // If there is no such callback, stop.
  if (!func) {
    return nullptr;
  }

  // Add CALLBACK to ELEMENT's callback queue.
  auto callback =
    MakeUnique<CustomElementCallback>(aCustomElement, aType, func);

  if (aArgs) {
    callback->SetArgs(*aArgs);
  }

  if (aAdoptedCallbackArgs) {
    callback->SetAdoptedCallbackArgs(*aAdoptedCallbackArgs);
  }
  return Move(callback);
}

/* static */ void
CustomElementRegistry::EnqueueLifecycleCallback(nsIDocument::ElementCallbackType aType,
                                                Element* aCustomElement,
                                                LifecycleCallbackArgs* aArgs,
                                                LifecycleAdoptedCallbackArgs* aAdoptedCallbackArgs,
                                                CustomElementDefinition* aDefinition)
{
  CustomElementDefinition* definition = aDefinition;
  if (!definition) {
    definition = aCustomElement->GetCustomElementDefinition();
    if (!definition ||
        definition->mLocalName != aCustomElement->NodeInfo()->NameAtom()) {
      return;
    }
  }

  auto callback =
    CreateCustomElementCallback(aType, aCustomElement, aArgs,
                                aAdoptedCallbackArgs, definition);
  if (!callback) {
    return;
  }

  DocGroup* docGroup = aCustomElement->OwnerDoc()->GetDocGroup();
  if (!docGroup) {
    return;
  }

  if (aType == nsIDocument::eAttributeChanged) {
    RefPtr<nsAtom> attrName = NS_Atomize(aArgs->name);
    if (definition->mObservedAttributes.IsEmpty() ||
        !definition->mObservedAttributes.Contains(attrName)) {
      return;
    }
  }

  CustomElementReactionsStack* reactionsStack =
    docGroup->CustomElementReactionsStack();
  reactionsStack->EnqueueCallbackReaction(aCustomElement, Move(callback));
}

void
CustomElementRegistry::UpgradeCandidates(nsAtom* aKey,
                                         CustomElementDefinition* aDefinition,
                                         ErrorResult& aRv)
{
  DocGroup* docGroup = mWindow->GetDocGroup();
  if (!docGroup) {
    aRv.Throw(NS_ERROR_UNEXPECTED);
    return;
  }

  // TODO: Bug 1326028 - Upgrade custom element in shadow-including tree order
  nsAutoPtr<nsTArray<nsWeakPtr>> candidates;
  if (mCandidatesMap.Remove(aKey, &candidates)) {
    MOZ_ASSERT(candidates);
    CustomElementReactionsStack* reactionsStack =
      docGroup->CustomElementReactionsStack();
    for (size_t i = 0; i < candidates->Length(); ++i) {
      nsCOMPtr<Element> elem = do_QueryReferent(candidates->ElementAt(i));
      if (!elem) {
        continue;
      }

      reactionsStack->EnqueueUpgradeReaction(elem, aDefinition);
    }
  }
}

JSObject*
CustomElementRegistry::WrapObject(JSContext* aCx, JS::Handle<JSObject*> aGivenProto)
{
  return CustomElementRegistryBinding::Wrap(aCx, this, aGivenProto);
}

nsISupports* CustomElementRegistry::GetParentObject() const
{
  return mWindow;
}

DocGroup*
CustomElementRegistry::GetDocGroup() const
{
  return mWindow ? mWindow->GetDocGroup() : nullptr;
}

static const char* kLifeCycleCallbackNames[] = {
  "connectedCallback",
  "disconnectedCallback",
  "adoptedCallback",
  "attributeChangedCallback"
};

static void
CheckLifeCycleCallbacks(JSContext* aCx,
                        JS::Handle<JSObject*> aConstructor,
                        ErrorResult& aRv)
{
  for (size_t i = 0; i < ArrayLength(kLifeCycleCallbackNames); ++i) {
    const char* callbackName = kLifeCycleCallbackNames[i];
    JS::Rooted<JS::Value> callbackValue(aCx);
    if (!JS_GetProperty(aCx, aConstructor, callbackName, &callbackValue)) {
      aRv.StealExceptionFromJSContext(aCx);
      return;
    }
    if (!callbackValue.isUndefined()) {
      if (!callbackValue.isObject()) {
        aRv.ThrowTypeError<MSG_NOT_OBJECT>(NS_ConvertASCIItoUTF16(callbackName));
        return;
      }
      JS::Rooted<JSObject*> callback(aCx, &callbackValue.toObject());
      if (!JS::IsCallable(callback)) {
        aRv.ThrowTypeError<MSG_NOT_CALLABLE>(NS_ConvertASCIItoUTF16(callbackName));
        return;
      }
    }
  }
}

// https://html.spec.whatwg.org/multipage/scripting.html#element-definition
void
CustomElementRegistry::Define(const nsAString& aName,
                              Function& aFunctionConstructor,
                              const ElementDefinitionOptions& aOptions,
                              ErrorResult& aRv)
{
  aRv.MightThrowJSException();

  AutoJSAPI jsapi;
  if (NS_WARN_IF(!jsapi.Init(mWindow))) {
    aRv.Throw(NS_ERROR_FAILURE);
    return;
  }

  JSContext *cx = jsapi.cx();
  // Note: No calls that might run JS or trigger CC before this point, or
  // there's a (vanishingly small) chance of our constructor being nulled
  // before we access it.
  JS::Rooted<JSObject*> constructor(cx, aFunctionConstructor.CallableOrNull());

  /**
   * 1. If IsConstructor(constructor) is false, then throw a TypeError and abort
   *    these steps.
   */
  // For now, all wrappers are constructable if they are callable. So we need to
  // unwrap constructor to check it is really constructable.
  JS::Rooted<JSObject*> constructorUnwrapped(cx, js::CheckedUnwrap(constructor));
  if (!constructorUnwrapped) {
    // If the caller's compartment does not have permission to access the
    // unwrapped constructor then throw.
    aRv.Throw(NS_ERROR_DOM_SECURITY_ERR);
    return;
  }

  if (!JS::IsConstructor(constructorUnwrapped)) {
    aRv.ThrowTypeError<MSG_NOT_CONSTRUCTOR>(NS_LITERAL_STRING("Argument 2 of CustomElementRegistry.define"));
    return;
  }

  /**
   * 2. If name is not a valid custom element name, then throw a "SyntaxError"
   *    DOMException and abort these steps.
   */
  RefPtr<nsAtom> nameAtom(NS_Atomize(aName));
  if (!nsContentUtils::IsCustomElementName(nameAtom)) {
    aRv.Throw(NS_ERROR_DOM_SYNTAX_ERR);
    return;
  }

  /**
   * 3. If this CustomElementRegistry contains an entry with name name, then
   *    throw a "NotSupportedError" DOMException and abort these steps.
   */
  if (mCustomDefinitions.GetWeak(nameAtom)) {
    aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
    return;
  }

  /**
   * 4. If this CustomElementRegistry contains an entry with constructor constructor,
   *    then throw a "NotSupportedError" DOMException and abort these steps.
   */
  const auto& ptr = mConstructors.lookup(constructorUnwrapped);
  if (ptr) {
    MOZ_ASSERT(mCustomDefinitions.GetWeak(ptr->value()),
               "Definition must be found in mCustomDefinitions");
    aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
    return;
  }

  /**
   * 5. Let localName be name.
   * 6. Let extends be the value of the extends member of options, or null if
   *    no such member exists.
   * 7. If extends is not null, then:
   *    1. If extends is a valid custom element name, then throw a
   *       "NotSupportedError" DOMException.
   *    2. If the element interface for extends and the HTML namespace is
   *       HTMLUnknownElement (e.g., if extends does not indicate an element
   *       definition in this specification), then throw a "NotSupportedError"
   *       DOMException.
   *    3. Set localName to extends.
   */
  nsAutoString localName(aName);
  if (aOptions.mExtends.WasPassed()) {
    RefPtr<nsAtom> extendsAtom(NS_Atomize(aOptions.mExtends.Value()));
    if (nsContentUtils::IsCustomElementName(extendsAtom)) {
      aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
      return;
    }

    // bgsound and multicol are unknown html element.
    int32_t tag = nsHTMLTags::CaseSensitiveAtomTagToId(extendsAtom);
    if (tag == eHTMLTag_userdefined ||
        tag == eHTMLTag_bgsound ||
        tag == eHTMLTag_multicol) {
      aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
      return;
    }

    localName.Assign(aOptions.mExtends.Value());
  }

  /**
   * 8. If this CustomElementRegistry's element definition is running flag is set,
   *    then throw a "NotSupportedError" DOMException and abort these steps.
   */
  if (mIsCustomDefinitionRunning) {
    aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
    return;
  }

  JS::Rooted<JS::Value> constructorPrototype(cx);
  nsAutoPtr<LifecycleCallbacks> callbacksHolder(new LifecycleCallbacks());
  nsTArray<RefPtr<nsAtom>> observedAttributes;
  { // Set mIsCustomDefinitionRunning.
    /**
     * 9. Set this CustomElementRegistry's element definition is running flag.
     */
    AutoSetRunningFlag as(this);

    { // Enter constructor's compartment.
      /**
       * 10.1. Let prototype be Get(constructor, "prototype"). Rethrow any exceptions.
       */
      JSAutoCompartment ac(cx, constructor);
      // The .prototype on the constructor passed could be an "expando" of a
      // wrapper. So we should get it from wrapper instead of the underlying
      // object.
      if (!JS_GetProperty(cx, constructor, "prototype", &constructorPrototype)) {
        aRv.StealExceptionFromJSContext(cx);
        return;
      }

      /**
       * 10.2. If Type(prototype) is not Object, then throw a TypeError exception.
       */
      if (!constructorPrototype.isObject()) {
        aRv.ThrowTypeError<MSG_NOT_OBJECT>(NS_LITERAL_STRING("constructor.prototype"));
        return;
      }
    } // Leave constructor's compartment.

    JS::Rooted<JSObject*> constructorProtoUnwrapped(
      cx, js::CheckedUnwrap(&constructorPrototype.toObject()));
    if (!constructorProtoUnwrapped) {
      // If the caller's compartment does not have permission to access the
      // unwrapped prototype then throw.
      aRv.Throw(NS_ERROR_DOM_SECURITY_ERR);
      return;
    }

    { // Enter constructorProtoUnwrapped's compartment
      JSAutoCompartment ac(cx, constructorProtoUnwrapped);

      /**
       * 10.3. Let lifecycleCallbacks be a map with the four keys
       *       "connectedCallback", "disconnectedCallback", "adoptedCallback", and
       *       "attributeChangedCallback", each of which belongs to an entry whose
       *       value is null.
       * 10.4. For each of the four keys callbackName in lifecycleCallbacks:
       *       1. Let callbackValue be Get(prototype, callbackName). Rethrow any
       *          exceptions.
       *       2. If callbackValue is not undefined, then set the value of the
       *          entry in lifecycleCallbacks with key callbackName to the result
       *          of converting callbackValue to the Web IDL Function callback type.
       *          Rethrow any exceptions from the conversion.
       */
      // Will do the same checking for the life cycle callbacks from v0 spec.
      CheckLifeCycleCallbacks(cx, constructorProtoUnwrapped, aRv);
      if (aRv.Failed()) {
        return;
      }

      // Note: We call the init from the constructorProtoUnwrapped's compartment
      //       here.
      JS::RootedValue rootedv(cx, JS::ObjectValue(*constructorProtoUnwrapped));
      if (!JS_WrapValue(cx, &rootedv) || !callbacksHolder->Init(cx, rootedv)) {
        aRv.StealExceptionFromJSContext(cx);
        return;
      }

      /**
       * 10.5. Let observedAttributes be an empty sequence<DOMString>.
       * 10.6. If the value of the entry in lifecycleCallbacks with key
       *       "attributeChangedCallback" is not null, then:
       *       1. Let observedAttributesIterable be Get(constructor,
       *          "observedAttributes"). Rethrow any exceptions.
       *       2. If observedAttributesIterable is not undefined, then set
       *          observedAttributes to the result of converting
       *          observedAttributesIterable to a sequence<DOMString>. Rethrow
       *          any exceptions from the conversion.
       */
      if (callbacksHolder->mAttributeChangedCallback.WasPassed()) {
        // Enter constructor's compartment.
        JSAutoCompartment ac(cx, constructor);
        JS::Rooted<JS::Value> observedAttributesIterable(cx);

        if (!JS_GetProperty(cx, constructor, "observedAttributes",
                            &observedAttributesIterable)) {
          aRv.StealExceptionFromJSContext(cx);
          return;
        }

        if (!observedAttributesIterable.isUndefined()) {
          if (!observedAttributesIterable.isObject()) {
            aRv.ThrowTypeError<MSG_NOT_SEQUENCE>(NS_LITERAL_STRING("observedAttributes"));
            return;
          }

          JS::ForOfIterator iter(cx);
          if (!iter.init(observedAttributesIterable, JS::ForOfIterator::AllowNonIterable)) {
            aRv.StealExceptionFromJSContext(cx);
            return;
          }

          if (!iter.valueIsIterable()) {
            aRv.ThrowTypeError<MSG_NOT_SEQUENCE>(NS_LITERAL_STRING("observedAttributes"));
            return;
          }

          JS::Rooted<JS::Value> attribute(cx);
          while (true) {
            bool done;
            if (!iter.next(&attribute, &done)) {
              aRv.StealExceptionFromJSContext(cx);
              return;
            }
            if (done) {
              break;
            }

            nsAutoString attrStr;
            if (!ConvertJSValueToString(cx, attribute, eStringify, eStringify, attrStr)) {
              aRv.StealExceptionFromJSContext(cx);
              return;
            }

            if (!observedAttributes.AppendElement(NS_Atomize(attrStr))) {
              aRv.Throw(NS_ERROR_OUT_OF_MEMORY);
              return;
            }
          }
        }
      } // Leave constructor's compartment.
    } // Leave constructorProtoUnwrapped's compartment.
  } // Unset mIsCustomDefinitionRunning

  /**
   * 11. Let definition be a new custom element definition with name name,
   *     local name localName, constructor constructor, prototype prototype,
   *     observed attributes observedAttributes, and lifecycle callbacks
   *     lifecycleCallbacks.
   */
  // Associate the definition with the custom element.
  RefPtr<nsAtom> localNameAtom(NS_Atomize(localName));
  LifecycleCallbacks* callbacks = callbacksHolder.forget();

  /**
   * 12. Add definition to this CustomElementRegistry.
   */
  if (!mConstructors.put(constructorUnwrapped, nameAtom)) {
    aRv.Throw(NS_ERROR_FAILURE);
    return;
  }

  RefPtr<CustomElementDefinition> definition =
    new CustomElementDefinition(nameAtom,
                                localNameAtom,
                                &aFunctionConstructor,
                                Move(observedAttributes),
                                callbacks);

  CustomElementDefinition* def = definition.get();
  mCustomDefinitions.Put(nameAtom, definition.forget());

  MOZ_ASSERT(mCustomDefinitions.Count() == mConstructors.count(),
             "Number of entries should be the same");

  /**
   * 13. 14. 15. Upgrade candidates
   */
  UpgradeCandidates(nameAtom, def, aRv);

  /**
   * 16. If this CustomElementRegistry's when-defined promise map contains an
   *     entry with key name:
   *     1. Let promise be the value of that entry.
   *     2. Resolve promise with undefined.
   *     3. Delete the entry with key name from this CustomElementRegistry's
   *        when-defined promise map.
   */
  RefPtr<Promise> promise;
  mWhenDefinedPromiseMap.Remove(nameAtom, getter_AddRefs(promise));
  if (promise) {
    promise->MaybeResolveWithUndefined();
  }

}

void
CustomElementRegistry::Get(JSContext* aCx, const nsAString& aName,
                           JS::MutableHandle<JS::Value> aRetVal)
{
  RefPtr<nsAtom> nameAtom(NS_Atomize(aName));
  CustomElementDefinition* data = mCustomDefinitions.GetWeak(nameAtom);

  if (!data) {
    aRetVal.setUndefined();
    return;
  }

  aRetVal.setObject(*data->mConstructor->Callback(aCx));
}

already_AddRefed<Promise>
CustomElementRegistry::WhenDefined(const nsAString& aName, ErrorResult& aRv)
{
  nsCOMPtr<nsIGlobalObject> global = do_QueryInterface(mWindow);
  RefPtr<Promise> promise = Promise::Create(global, aRv);

  if (aRv.Failed()) {
    return nullptr;
  }

  RefPtr<nsAtom> nameAtom(NS_Atomize(aName));
  if (!nsContentUtils::IsCustomElementName(nameAtom)) {
    promise->MaybeReject(NS_ERROR_DOM_SYNTAX_ERR);
    return promise.forget();
  }

  if (mCustomDefinitions.GetWeak(nameAtom)) {
    promise->MaybeResolve(JS::UndefinedHandleValue);
    return promise.forget();
  }

  auto entry = mWhenDefinedPromiseMap.LookupForAdd(nameAtom);
  if (entry) {
    promise = entry.Data();
  } else {
    entry.OrInsert([&promise](){ return promise; });
  }

  return promise.forget();
}

namespace {

static void
DoUpgrade(Element* aElement,
          CustomElementConstructor* aConstructor,
          ErrorResult& aRv)
{
  // Rethrow the exception since it might actually throw the exception from the
  // upgrade steps back out to the caller of document.createElement.
  RefPtr<Element> constructResult =
    aConstructor->Construct("Custom Element Upgrade", aRv);
  if (aRv.Failed()) {
    return;
  }

  if (!constructResult || constructResult.get() != aElement) {
    aRv.Throw(NS_ERROR_DOM_INVALID_STATE_ERR);
    return;
  }
}

} // anonymous namespace

// https://html.spec.whatwg.org/multipage/scripting.html#upgrades
/* static */ void
CustomElementRegistry::Upgrade(Element* aElement,
                               CustomElementDefinition* aDefinition,
                               ErrorResult& aRv)
{
  RefPtr<CustomElementData> data = aElement->GetCustomElementData();
  MOZ_ASSERT(data, "CustomElementData should exist");

  // Step 1 and step 2.
  if (data->mState == CustomElementData::State::eCustom ||
      data->mState == CustomElementData::State::eFailed) {
    return;
  }

  // Step 3.
  if (!aDefinition->mObservedAttributes.IsEmpty()) {
    uint32_t count = aElement->GetAttrCount();
    for (uint32_t i = 0; i < count; i++) {
      mozilla::dom::BorrowedAttrInfo info = aElement->GetAttrInfoAt(i);

      const nsAttrName* name = info.mName;
      nsAtom* attrName = name->LocalName();

      if (aDefinition->IsInObservedAttributeList(attrName)) {
        int32_t namespaceID = name->NamespaceID();
        nsAutoString attrValue, namespaceURI;
        info.mValue->ToString(attrValue);
        nsContentUtils::NameSpaceManager()->GetNameSpaceURI(namespaceID,
                                                            namespaceURI);

        LifecycleCallbackArgs args = {
          nsDependentAtomString(attrName),
          VoidString(),
          attrValue,
          (namespaceURI.IsEmpty() ? VoidString() : namespaceURI)
        };
        nsContentUtils::EnqueueLifecycleCallback(nsIDocument::eAttributeChanged,
                                                 aElement,
                                                 &args, nullptr, aDefinition);
      }
    }
  }

  // Step 4.
  if (aElement->IsInComposedDoc()) {
    nsContentUtils::EnqueueLifecycleCallback(nsIDocument::eConnected, aElement,
      nullptr, nullptr, aDefinition);
  }

  // Step 5.
  AutoConstructionStackEntry acs(aDefinition->mConstructionStack, aElement);

  // Step 6 and step 7.
  DoUpgrade(aElement, aDefinition->mConstructor, aRv);
  if (aRv.Failed()) {
    data->mState = CustomElementData::State::eFailed;
    // Empty element's custom element reaction queue.
    data->mReactionQueue.Clear();
    return;
  }

  // Step 8.
  data->mState = CustomElementData::State::eCustom;

  // Step 9.
  aElement->SetCustomElementDefinition(aDefinition);
}

//-----------------------------------------------------
// CustomElementReactionsStack

void
CustomElementReactionsStack::CreateAndPushElementQueue()
{
  MOZ_ASSERT(mRecursionDepth);
  MOZ_ASSERT(!mIsElementQueuePushedForCurrentRecursionDepth);

  // Push a new element queue onto the custom element reactions stack.
  mReactionsStack.AppendElement(MakeUnique<ElementQueue>());
  mIsElementQueuePushedForCurrentRecursionDepth = true;
}

void
CustomElementReactionsStack::PopAndInvokeElementQueue()
{
  MOZ_ASSERT(mRecursionDepth);
  MOZ_ASSERT(mIsElementQueuePushedForCurrentRecursionDepth);
  MOZ_ASSERT(!mReactionsStack.IsEmpty(),
             "Reaction stack shouldn't be empty");

  // Pop the element queue from the custom element reactions stack,
  // and invoke custom element reactions in that queue.
  const uint32_t lastIndex = mReactionsStack.Length() - 1;
  ElementQueue* elementQueue = mReactionsStack.ElementAt(lastIndex).get();
  // Check element queue size in order to reduce function call overhead.
  if (!elementQueue->IsEmpty()) {
    // It is still not clear what error reporting will look like in custom
    // element, see https://github.com/w3c/webcomponents/issues/635.
    // We usually report the error to entry global in gecko, so just follow the
    // same behavior here.
    // This may be null if it's called from parser, see the case of
    // attributeChangedCallback in
    // https://html.spec.whatwg.org/multipage/parsing.html#create-an-element-for-the-token
    // In that case, the exception of callback reactions will be automatically
    // reported in CallSetup.
    nsIGlobalObject* global = GetEntryGlobal();
    InvokeReactions(elementQueue, global);
  }

  // InvokeReactions() might create other custom element reactions, but those
  // new reactions should be already consumed and removed at this point.
  MOZ_ASSERT(lastIndex == mReactionsStack.Length() - 1,
             "reactions created by InvokeReactions() should be consumed and removed");

  mReactionsStack.RemoveElementAt(lastIndex);
  mIsElementQueuePushedForCurrentRecursionDepth = false;
}

void
CustomElementReactionsStack::EnqueueUpgradeReaction(Element* aElement,
                                                    CustomElementDefinition* aDefinition)
{
  Enqueue(aElement, new CustomElementUpgradeReaction(aDefinition));
}

void
CustomElementReactionsStack::EnqueueCallbackReaction(Element* aElement,
                                                     UniquePtr<CustomElementCallback> aCustomElementCallback)
{
  Enqueue(aElement, new CustomElementCallbackReaction(Move(aCustomElementCallback)));
}

void
CustomElementReactionsStack::Enqueue(Element* aElement,
                                     CustomElementReaction* aReaction)
{
  RefPtr<CustomElementData> elementData = aElement->GetCustomElementData();
  MOZ_ASSERT(elementData, "CustomElementData should exist");

  if (mRecursionDepth) {
    // If the element queue is not created for current recursion depth, create
    // and push an element queue to reactions stack first.
    if (!mIsElementQueuePushedForCurrentRecursionDepth) {
      CreateAndPushElementQueue();
    }

    MOZ_ASSERT(!mReactionsStack.IsEmpty());
    // Add element to the current element queue.
    mReactionsStack.LastElement()->AppendElement(aElement);
    elementData->mReactionQueue.AppendElement(aReaction);
    return;
  }

  // If the custom element reactions stack is empty, then:
  // Add element to the backup element queue.
  MOZ_ASSERT(mReactionsStack.IsEmpty(),
             "custom element reactions stack should be empty");
  MOZ_ASSERT(!aReaction->IsUpgradeReaction(),
             "Upgrade reaction should not be scheduled to backup queue");
  mBackupQueue.AppendElement(aElement);
  elementData->mReactionQueue.AppendElement(aReaction);

  if (mIsBackupQueueProcessing) {
    return;
  }

  CycleCollectedJSContext* context = CycleCollectedJSContext::Get();
  RefPtr<BackupQueueMicroTask> bqmt = new BackupQueueMicroTask(this);
  context->DispatchMicroTaskRunnable(bqmt.forget());
}

void
CustomElementReactionsStack::InvokeBackupQueue()
{
  // Check backup queue size in order to reduce function call overhead.
  if (!mBackupQueue.IsEmpty()) {
    // Upgrade reactions won't be scheduled in backup queue and the exception of
    // callback reactions will be automatically reported in CallSetup.
    // If the reactions are invoked from backup queue (in microtask check point),
    // we don't need to pass global object for error reporting.
    InvokeReactions(&mBackupQueue, nullptr);
  }
  MOZ_ASSERT(mBackupQueue.IsEmpty(),
             "There are still some reactions in BackupQueue not being consumed!?!");
}

void
CustomElementReactionsStack::InvokeReactions(ElementQueue* aElementQueue,
                                             nsIGlobalObject* aGlobal)
{
  // This is used for error reporting.
  Maybe<AutoEntryScript> aes;
  if (aGlobal) {
    aes.emplace(aGlobal, "custom elements reaction invocation");
  }

  // Note: It's possible to re-enter this method.
  for (uint32_t i = 0; i < aElementQueue->Length(); ++i) {
    Element* element = aElementQueue->ElementAt(i);
    // ElementQueue hold a element's strong reference, it should not be a nullptr.
    MOZ_ASSERT(element);

    RefPtr<CustomElementData> elementData = element->GetCustomElementData();
    if (!elementData) {
      // This happens when the document is destroyed and the element is already
      // unlinked, no need to fire the callbacks in this case.
      continue;
    }

    auto& reactions = elementData->mReactionQueue;
    for (uint32_t j = 0; j < reactions.Length(); ++j) {
      // Transfer the ownership of the entry due to reentrant invocation of
      // this funciton. The entry will be removed when bug 1379573 is landed.
      auto reaction(Move(reactions.ElementAt(j)));
      if (reaction) {
        ErrorResult rv;
        reaction->Invoke(element, rv);
        if (aes) {
          JSContext* cx = aes->cx();
          if (rv.MaybeSetPendingException(cx)) {
            aes->ReportException();
          }
          MOZ_ASSERT(!JS_IsExceptionPending(cx));
        }
        MOZ_ASSERT(!rv.Failed());
      }
    }
    reactions.Clear();
  }
  aElementQueue->Clear();
}

//-----------------------------------------------------
// CustomElementDefinition

NS_IMPL_CYCLE_COLLECTION_CLASS(CustomElementDefinition)

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN(CustomElementDefinition)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mConstructor)
  tmp->mCallbacks = nullptr;
NS_IMPL_CYCLE_COLLECTION_UNLINK_END

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN(CustomElementDefinition)
  mozilla::dom::LifecycleCallbacks* callbacks = tmp->mCallbacks.get();

  if (callbacks->mAttributeChangedCallback.WasPassed()) {
    NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(cb,
      "mCallbacks->mAttributeChangedCallback");
    cb.NoteXPCOMChild(callbacks->mAttributeChangedCallback.Value());
  }

  if (callbacks->mConnectedCallback.WasPassed()) {
    NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(cb, "mCallbacks->mConnectedCallback");
    cb.NoteXPCOMChild(callbacks->mConnectedCallback.Value());
  }

  if (callbacks->mDisconnectedCallback.WasPassed()) {
    NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(cb, "mCallbacks->mDisconnectedCallback");
    cb.NoteXPCOMChild(callbacks->mDisconnectedCallback.Value());
  }

  if (callbacks->mAdoptedCallback.WasPassed()) {
    NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(cb, "mCallbacks->mAdoptedCallback");
    cb.NoteXPCOMChild(callbacks->mAdoptedCallback.Value());
  }

  NS_CYCLE_COLLECTION_NOTE_EDGE_NAME(cb, "mConstructor");
  cb.NoteXPCOMChild(tmp->mConstructor);
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTION_TRACE_BEGIN(CustomElementDefinition)
NS_IMPL_CYCLE_COLLECTION_TRACE_END

NS_IMPL_CYCLE_COLLECTION_ROOT_NATIVE(CustomElementDefinition, AddRef)
NS_IMPL_CYCLE_COLLECTION_UNROOT_NATIVE(CustomElementDefinition, Release)


CustomElementDefinition::CustomElementDefinition(nsAtom* aType,
                                                 nsAtom* aLocalName,
                                                 Function* aConstructor,
                                                 nsTArray<RefPtr<nsAtom>>&& aObservedAttributes,
                                                 LifecycleCallbacks* aCallbacks)
  : mType(aType),
    mLocalName(aLocalName),
    mConstructor(new CustomElementConstructor(aConstructor)),
    mObservedAttributes(Move(aObservedAttributes)),
    mCallbacks(aCallbacks)
{
}

} // namespace dom
} // namespace mozilla
