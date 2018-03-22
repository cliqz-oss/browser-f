/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/KeyboardEvent.h"
#include "mozilla/TextEvents.h"
#include "nsContentUtils.h"
#include "prtime.h"

namespace mozilla {
namespace dom {

KeyboardEvent::KeyboardEvent(EventTarget* aOwner,
                             nsPresContext* aPresContext,
                             WidgetKeyboardEvent* aEvent)
  : UIEvent(aOwner, aPresContext,
            aEvent ? aEvent :
                     new WidgetKeyboardEvent(false, eVoidEvent, nullptr))
  , mInitializedByCtor(false)
  , mInitializedWhichValue(0)
{
  if (aEvent) {
    mEventIsInternal = false;
  }
  else {
    mEventIsInternal = true;
    mEvent->mTime = PR_Now();
    mEvent->AsKeyboardEvent()->mKeyNameIndex = KEY_NAME_INDEX_USE_STRING;
  }
}

NS_IMPL_ADDREF_INHERITED(KeyboardEvent, UIEvent)
NS_IMPL_RELEASE_INHERITED(KeyboardEvent, UIEvent)

NS_INTERFACE_MAP_BEGIN(KeyboardEvent)
  NS_INTERFACE_MAP_ENTRY(nsIDOMKeyEvent)
NS_INTERFACE_MAP_END_INHERITING(UIEvent)

bool
KeyboardEvent::AltKey(CallerType aCallerType)
{
  bool altState = mEvent->AsKeyboardEvent()->IsAlt();

  if (!ShouldResistFingerprinting(aCallerType)) {
    return altState;
  }

  // We need to give a spoofed state for Alt key since it could be used as a
  // modifier key in certain keyboard layout. For example, the '@' key for
  // German keyboard for MAC is Alt+L.
  return GetSpoofedModifierStates(Modifier::MODIFIER_ALT, altState);
}

NS_IMETHODIMP
KeyboardEvent::GetAltKey(bool* aIsDown)
{
  NS_ENSURE_ARG_POINTER(aIsDown);
  *aIsDown = AltKey();
  return NS_OK;
}

bool
KeyboardEvent::CtrlKey(CallerType aCallerType)
{
  bool ctrlState = mEvent->AsKeyboardEvent()->IsControl();

  if (!ShouldResistFingerprinting(aCallerType)) {
    return ctrlState;
  }

  // We need to give a spoofed state for Control key since it could be used as a
  // modifier key in certain asian keyboard layouts.
  return GetSpoofedModifierStates(Modifier::MODIFIER_CONTROL, ctrlState);
}

NS_IMETHODIMP
KeyboardEvent::GetCtrlKey(bool* aIsDown)
{
  NS_ENSURE_ARG_POINTER(aIsDown);
  *aIsDown = CtrlKey();
  return NS_OK;
}

bool
KeyboardEvent::ShiftKey(CallerType aCallerType)
{
  bool shiftState = mEvent->AsKeyboardEvent()->IsShift();

  if (!ShouldResistFingerprinting(aCallerType)) {
    return shiftState;
  }

  return GetSpoofedModifierStates(Modifier::MODIFIER_SHIFT, shiftState);
}

NS_IMETHODIMP
KeyboardEvent::GetShiftKey(bool* aIsDown)
{
  NS_ENSURE_ARG_POINTER(aIsDown);
  *aIsDown = ShiftKey();
  return NS_OK;
}

bool
KeyboardEvent::MetaKey()
{
  return mEvent->AsKeyboardEvent()->IsMeta();
}

NS_IMETHODIMP
KeyboardEvent::GetMetaKey(bool* aIsDown)
{
  NS_ENSURE_ARG_POINTER(aIsDown);
  *aIsDown = MetaKey();
  return NS_OK;
}

bool
KeyboardEvent::Repeat()
{
  return mEvent->AsKeyboardEvent()->mIsRepeat;
}

NS_IMETHODIMP
KeyboardEvent::GetRepeat(bool* aIsRepeat)
{
  NS_ENSURE_ARG_POINTER(aIsRepeat);
  *aIsRepeat = Repeat();
  return NS_OK;
}

bool
KeyboardEvent::IsComposing()
{
  return mEvent->AsKeyboardEvent()->mIsComposing;
}

NS_IMETHODIMP
KeyboardEvent::GetModifierState(const nsAString& aKey,
                                bool* aState)
{
  NS_ENSURE_ARG_POINTER(aState);

  *aState = GetModifierState(aKey);
  return NS_OK;
}

NS_IMETHODIMP
KeyboardEvent::GetKey(nsAString& aKeyName)
{
  mEvent->AsKeyboardEvent()->GetDOMKeyName(aKeyName);
  return NS_OK;
}

void
KeyboardEvent::GetCode(nsAString& aCodeName, CallerType aCallerType)
{
  if (!ShouldResistFingerprinting(aCallerType)) {
    mEvent->AsKeyboardEvent()->GetDOMCodeName(aCodeName);
    return;
  }

  // When fingerprinting resistance is enabled, we will give a spoofed code
  // according to the content-language of the document.
  nsCOMPtr<nsIDocument> doc = GetDocument();

  nsRFPService::GetSpoofedCode(doc, mEvent->AsKeyboardEvent(),
                               aCodeName);
}

void KeyboardEvent::GetInitDict(KeyboardEventInit& aParam)
{
  GetKey(aParam.mKey);
  GetCode(aParam.mCode);
  aParam.mLocation = Location();
  aParam.mRepeat = Repeat();
  aParam.mIsComposing = IsComposing();

  // legacy attributes
  aParam.mKeyCode = KeyCode();
  aParam.mCharCode = CharCode();
  aParam.mWhich = Which();

  // modifiers from EventModifierInit
  aParam.mCtrlKey = CtrlKey();
  aParam.mShiftKey = ShiftKey();
  aParam.mAltKey = AltKey();
  aParam.mMetaKey = MetaKey();

  WidgetKeyboardEvent* internalEvent = mEvent->AsKeyboardEvent();
  aParam.mModifierAltGraph = internalEvent->IsAltGraph();
  aParam.mModifierCapsLock = internalEvent->IsCapsLocked();
  aParam.mModifierFn = internalEvent->IsFn();
  aParam.mModifierFnLock = internalEvent->IsFnLocked();
  aParam.mModifierNumLock = internalEvent->IsNumLocked();
  aParam.mModifierOS = internalEvent->IsOS();
  aParam.mModifierScrollLock = internalEvent->IsScrollLocked();
  aParam.mModifierSymbol = internalEvent->IsSymbol();
  aParam.mModifierSymbolLock = internalEvent->IsSymbolLocked();

  // EventInit
  aParam.mBubbles =  internalEvent->mFlags.mBubbles;
  aParam.mCancelable = internalEvent->mFlags.mCancelable;
}

NS_IMETHODIMP
KeyboardEvent::GetCharCode(uint32_t* aCharCode)
{
  NS_ENSURE_ARG_POINTER(aCharCode);
  *aCharCode = CharCode();
  return NS_OK;
}

uint32_t
KeyboardEvent::CharCode()
{
  // If this event is initialized with ctor, we shouldn't check event type.
  if (mInitializedByCtor) {
    return mEvent->AsKeyboardEvent()->mCharCode;
  }

  switch (mEvent->mMessage) {
  case eKeyDown:
  case eKeyDownOnPlugin:
  case eKeyUp:
  case eKeyUpOnPlugin:
    return 0;
  case eKeyPress:
  case eAccessKeyNotFound:
    return mEvent->AsKeyboardEvent()->mCharCode;
  default:
    break;
  }
  return 0;
}

NS_IMETHODIMP
KeyboardEvent::GetKeyCode(uint32_t* aKeyCode)
{
  NS_ENSURE_ARG_POINTER(aKeyCode);
  *aKeyCode = KeyCode();
  return NS_OK;
}

uint32_t
KeyboardEvent::KeyCode(CallerType aCallerType)
{
  // If this event is initialized with ctor, we shouldn't check event type.
  if (mInitializedByCtor) {
    return mEvent->AsKeyboardEvent()->mKeyCode;
  }

  if (!mEvent->HasKeyEventMessage()) {
    return 0;
  }

  if (!ShouldResistFingerprinting(aCallerType)) {
    return mEvent->AsKeyboardEvent()->mKeyCode;
  }

  // The keyCode should be zero if the char code is given.
  if (CharCode()) {
    return 0;
  }

  // When fingerprinting resistance is enabled, we will give a spoofed keyCode
  // according to the content-language of the document.
  nsCOMPtr<nsIDocument> doc = GetDocument();
  uint32_t spoofedKeyCode;

  if (nsRFPService::GetSpoofedKeyCode(doc, mEvent->AsKeyboardEvent(),
                                      spoofedKeyCode)) {
    return spoofedKeyCode;
  }

  return 0;
}

uint32_t
KeyboardEvent::Which()
{
  // If this event is initialized with ctor, which can have independent value.
  if (mInitializedByCtor) {
    return mInitializedWhichValue;
  }

  switch (mEvent->mMessage) {
    case eKeyDown:
    case eKeyDownOnPlugin:
    case eKeyUp:
    case eKeyUpOnPlugin:
      return KeyCode();
    case eKeyPress:
      //Special case for 4xp bug 62878.  Try to make value of which
      //more closely mirror the values that 4.x gave for RETURN and BACKSPACE
      {
        uint32_t keyCode = mEvent->AsKeyboardEvent()->mKeyCode;
        if (keyCode == NS_VK_RETURN || keyCode == NS_VK_BACK) {
          return keyCode;
        }
        return CharCode();
      }
    default:
      break;
  }

  return 0;
}

NS_IMETHODIMP
KeyboardEvent::GetLocation(uint32_t* aLocation)
{
  NS_ENSURE_ARG_POINTER(aLocation);

  *aLocation = Location();
  return NS_OK;
}

uint32_t
KeyboardEvent::Location()
{
  return mEvent->AsKeyboardEvent()->mLocation;
}

// static
already_AddRefed<KeyboardEvent>
KeyboardEvent::Constructor(const GlobalObject& aGlobal,
                           const nsAString& aType,
                           const KeyboardEventInit& aParam,
                           ErrorResult& aRv)
{
  nsCOMPtr<EventTarget> target = do_QueryInterface(aGlobal.GetAsSupports());
  RefPtr<KeyboardEvent> newEvent =
    new KeyboardEvent(target, nullptr, nullptr);
  newEvent->InitWithKeyboardEventInit(target, aType, aParam, aRv);

  return newEvent.forget();
}

void
KeyboardEvent::InitWithKeyboardEventInit(EventTarget* aOwner,
                                         const nsAString& aType,
                                         const KeyboardEventInit& aParam,
                                         ErrorResult& aRv)
{
  bool trusted = Init(aOwner);
  InitKeyEvent(aType, aParam.mBubbles, aParam.mCancelable,
               aParam.mView, false, false, false, false,
               aParam.mKeyCode, aParam.mCharCode);
  InitModifiers(aParam);
  SetTrusted(trusted);
  mDetail = aParam.mDetail;
  mInitializedByCtor = true;
  mInitializedWhichValue = aParam.mWhich;

  WidgetKeyboardEvent* internalEvent = mEvent->AsKeyboardEvent();
  internalEvent->mLocation = aParam.mLocation;
  internalEvent->mIsRepeat = aParam.mRepeat;
  internalEvent->mIsComposing = aParam.mIsComposing;
  internalEvent->mKeyNameIndex =
    WidgetKeyboardEvent::GetKeyNameIndex(aParam.mKey);
  if (internalEvent->mKeyNameIndex == KEY_NAME_INDEX_USE_STRING) {
    internalEvent->mKeyValue = aParam.mKey;
  }
  internalEvent->mCodeNameIndex =
    WidgetKeyboardEvent::GetCodeNameIndex(aParam.mCode);
  if (internalEvent->mCodeNameIndex == CODE_NAME_INDEX_USE_STRING) {
    internalEvent->mCodeValue = aParam.mCode;
  }
}

NS_IMETHODIMP
KeyboardEvent::InitKeyEvent(const nsAString& aType,
                            bool aCanBubble,
                            bool aCancelable,
                            mozIDOMWindow* aView,
                            bool aCtrlKey,
                            bool aAltKey,
                            bool aShiftKey,
                            bool aMetaKey,
                            uint32_t aKeyCode,
                            uint32_t aCharCode)
{
  NS_ENSURE_TRUE(!mEvent->mFlags.mIsBeingDispatched, NS_OK);

  UIEvent::InitUIEvent(aType, aCanBubble, aCancelable, aView, 0);

  WidgetKeyboardEvent* keyEvent = mEvent->AsKeyboardEvent();
  keyEvent->InitBasicModifiers(aCtrlKey, aAltKey, aShiftKey, aMetaKey);
  keyEvent->mKeyCode = aKeyCode;
  keyEvent->mCharCode = aCharCode;

  return NS_OK;
}

void
KeyboardEvent::InitKeyboardEvent(const nsAString& aType,
                                 bool aCanBubble,
                                 bool aCancelable,
                                 nsGlobalWindowInner* aView,
                                 const nsAString& aKey,
                                 uint32_t aLocation,
                                 bool aCtrlKey,
                                 bool aAltKey,
                                 bool aShiftKey,
                                 bool aMetaKey,
                                 ErrorResult& aRv)
{
  NS_ENSURE_TRUE_VOID(!mEvent->mFlags.mIsBeingDispatched);

  UIEvent::InitUIEvent(aType, aCanBubble, aCancelable, aView, 0);

  WidgetKeyboardEvent* keyEvent = mEvent->AsKeyboardEvent();
  keyEvent->InitBasicModifiers(aCtrlKey, aAltKey, aShiftKey, aMetaKey);
  keyEvent->mLocation = aLocation;
  keyEvent->mKeyNameIndex = KEY_NAME_INDEX_USE_STRING;
  keyEvent->mKeyValue = aKey;
}

already_AddRefed<nsIDocument>
KeyboardEvent::GetDocument()
{
  nsCOMPtr<nsIDocument> doc;
  nsCOMPtr<EventTarget> eventTarget = InternalDOMEvent()->GetTarget();

  if (eventTarget) {
    nsCOMPtr<nsPIDOMWindowInner> win =
      do_QueryInterface(eventTarget->GetOwnerGlobal());

    if (win) {
      doc = win->GetExtantDoc();
    }
  }

  return doc.forget();
}

bool
KeyboardEvent::ShouldResistFingerprinting(CallerType aCallerType)
{
  // There are five situations we don't need to spoof this keyboard event.
  //   1. This event is generated by scripts.
  //   2. This event is from Numpad.
  //   3. This event is in the system group.
  //   4. The caller type is system.
  //   5. The pref privcy.resistFingerprinting' is false, we fast return here since
  //      we don't need to do any QI of following codes.
  if (mInitializedByCtor ||
      aCallerType == CallerType::System ||
      mEvent->mFlags.mInSystemGroup ||
      !nsContentUtils::ShouldResistFingerprinting() ||
      mEvent->AsKeyboardEvent()->mLocation ==
        nsIDOMKeyEvent::DOM_KEY_LOCATION_NUMPAD) {
    return false;
  }

  nsCOMPtr<nsIDocument> doc = GetDocument();

  return doc && !nsContentUtils::IsChromeDoc(doc);
}

bool
KeyboardEvent::GetSpoofedModifierStates(const Modifiers aModifierKey,
                                        const bool aRawModifierState)
{
  bool spoofedState;
  nsCOMPtr<nsIDocument> doc = GetDocument();

  if(nsRFPService::GetSpoofedModifierStates(doc,
                                            mEvent->AsKeyboardEvent(),
                                            aModifierKey,
                                            spoofedState)) {
    return spoofedState;
  }

  return aRawModifierState;
}

} // namespace dom
} // namespace mozilla

using namespace mozilla;
using namespace mozilla::dom;

already_AddRefed<KeyboardEvent>
NS_NewDOMKeyboardEvent(EventTarget* aOwner,
                       nsPresContext* aPresContext,
                       WidgetKeyboardEvent* aEvent)
{
  RefPtr<KeyboardEvent> it = new KeyboardEvent(aOwner, aPresContext, aEvent);
  return it.forget();
}
