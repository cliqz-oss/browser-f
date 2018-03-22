/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Preferences.h"
#include "mozilla/dom/ShadowRoot.h"
#include "mozilla/dom/ShadowRootBinding.h"
#include "mozilla/dom/DocumentFragment.h"
#include "ChildIterator.h"
#include "nsContentUtils.h"
#include "nsDOMClassInfoID.h"
#include "nsIDOMHTMLElement.h"
#include "nsIStyleSheetLinkingElement.h"
#include "mozilla/dom/Element.h"
#include "mozilla/dom/HTMLSlotElement.h"
#include "nsXBLPrototypeBinding.h"
#include "mozilla/EventDispatcher.h"
#include "mozilla/StyleSheet.h"
#include "mozilla/StyleSheetInlines.h"

using namespace mozilla;
using namespace mozilla::dom;

NS_IMPL_CYCLE_COLLECTION_CLASS(ShadowRoot)

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN_INHERITED(ShadowRoot,
                                                  DocumentFragment)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mDOMStyleSheets)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mAssociatedBinding)
  for (auto iter = tmp->mIdentifierMap.ConstIter(); !iter.Done();
       iter.Next()) {
    iter.Get()->Traverse(&cb);
  }
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN(ShadowRoot)
  if (tmp->GetHost()) {
    tmp->GetHost()->RemoveMutationObserver(tmp);
  }
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mDOMStyleSheets)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mAssociatedBinding)
  tmp->mIdentifierMap.Clear();
NS_IMPL_CYCLE_COLLECTION_UNLINK_END_INHERITED(DocumentFragment)

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION(ShadowRoot)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIContent)
  NS_INTERFACE_MAP_ENTRY(nsIMutationObserver)
NS_INTERFACE_MAP_END_INHERITING(DocumentFragment)

NS_IMPL_ADDREF_INHERITED(ShadowRoot, DocumentFragment)
NS_IMPL_RELEASE_INHERITED(ShadowRoot, DocumentFragment)

ShadowRoot::ShadowRoot(Element* aElement, bool aClosed,
                       already_AddRefed<mozilla::dom::NodeInfo>&& aNodeInfo,
                       nsXBLPrototypeBinding* aProtoBinding)
  : DocumentFragment(aNodeInfo)
  , DocumentOrShadowRoot(*this)
  , mProtoBinding(aProtoBinding)
  , mInsertionPointChanged(false)
  , mIsComposedDocParticipant(false)
{
  SetHost(aElement);
  mMode = aClosed ? ShadowRootMode::Closed : ShadowRootMode::Open;

  // Nodes in a shadow tree should never store a value
  // in the subtree root pointer, nodes in the shadow tree
  // track the subtree root using GetContainingShadow().
  ClearSubtreeRootPointer();

  SetFlags(NODE_IS_IN_SHADOW_TREE);

  ExtendedDOMSlots()->mBindingParent = aElement;
  ExtendedDOMSlots()->mContainingShadow = this;

  // Add the ShadowRoot as a mutation observer on the host to watch
  // for mutations because the insertion points in this ShadowRoot
  // may need to be updated when the host children are modified.
  GetHost()->AddMutationObserver(this);
}

ShadowRoot::~ShadowRoot()
{
  if (auto* host = GetHost()) {
    // mHost may have been unlinked or a new ShadowRoot may have been
    // created, making this one obsolete.
    host->RemoveMutationObserver(this);
  }

  UnsetFlags(NODE_IS_IN_SHADOW_TREE);

  // nsINode destructor expects mSubtreeRoot == this.
  SetSubtreeRootPointer(this);
}

JSObject*
ShadowRoot::WrapObject(JSContext* aCx, JS::Handle<JSObject*> aGivenProto)
{
  return mozilla::dom::ShadowRootBinding::Wrap(aCx, this, aGivenProto);
}

void
ShadowRoot::AddSlot(HTMLSlotElement* aSlot)
{
  MOZ_ASSERT(aSlot);

  // Note that if name attribute missing, the slot is a default slot.
 nsAutoString name;
  aSlot->GetName(name);

  nsTArray<HTMLSlotElement*>* currentSlots = mSlotMap.LookupOrAdd(name);
  MOZ_ASSERT(currentSlots);

  HTMLSlotElement* oldSlot = currentSlots->IsEmpty() ?
    nullptr : currentSlots->ElementAt(0);

  TreeOrderComparator comparator;
  currentSlots->InsertElementSorted(aSlot, comparator);

  HTMLSlotElement* currentSlot = currentSlots->ElementAt(0);
  if (currentSlot != aSlot) {
    return;
  }

  bool doEnqueueSlotChange = false;
  if (oldSlot && oldSlot != currentSlot) {
    // Move assigned nodes from old slot to new slot.
    const nsTArray<RefPtr<nsINode>>& assignedNodes = oldSlot->AssignedNodes();
    while (assignedNodes.Length() > 0) {
      nsINode* assignedNode = assignedNodes[0];

      oldSlot->RemoveAssignedNode(assignedNode);
      currentSlot->AppendAssignedNode(assignedNode);
      doEnqueueSlotChange = true;
    }

    if (doEnqueueSlotChange) {
      oldSlot->EnqueueSlotChangeEvent();
      currentSlot->EnqueueSlotChangeEvent();
    }
  } else {
    // Otherwise add appropriate nodes to this slot from the host.
    for (nsIContent* child = GetHost()->GetFirstChild();
         child;
         child = child->GetNextSibling()) {
      nsAutoString slotName;
      if (child->IsElement()) {
        child->AsElement()->GetAttr(kNameSpaceID_None, nsGkAtoms::slot, slotName);
      }
      if (child->IsSlotable() && slotName.Equals(name)) {
        currentSlot->AppendAssignedNode(child);
        doEnqueueSlotChange = true;
      }
    }

    if (doEnqueueSlotChange) {
      currentSlot->EnqueueSlotChangeEvent();
    }
  }
}

void
ShadowRoot::RemoveSlot(HTMLSlotElement* aSlot)
{
  MOZ_ASSERT(aSlot);

  nsAutoString name;
  aSlot->GetName(name);

  nsTArray<HTMLSlotElement*>* currentSlots = mSlotMap.Get(name);

  if (currentSlots) {
    if (currentSlots->Length() == 1) {
      MOZ_ASSERT(currentSlots->ElementAt(0) == aSlot);
      mSlotMap.Remove(name);

      if (aSlot->AssignedNodes().Length() > 0) {
        aSlot->ClearAssignedNodes();
        aSlot->EnqueueSlotChangeEvent();
      }
    } else {
      bool doEnqueueSlotChange = false;
      bool doReplaceSlot = currentSlots->ElementAt(0) == aSlot;
      currentSlots->RemoveElement(aSlot);
      HTMLSlotElement* replacementSlot = currentSlots->ElementAt(0);

      // Move assigned nodes from removed slot to the next slot in
      // tree order with the same name.
      if (doReplaceSlot) {
        const nsTArray<RefPtr<nsINode>>& assignedNodes = aSlot->AssignedNodes();
        while (assignedNodes.Length() > 0) {
          nsINode* assignedNode = assignedNodes[0];

          aSlot->RemoveAssignedNode(assignedNode);
          replacementSlot->AppendAssignedNode(assignedNode);
          doEnqueueSlotChange = true;
        }

        if (doEnqueueSlotChange) {
          aSlot->EnqueueSlotChangeEvent();
          replacementSlot->EnqueueSlotChangeEvent();
        }
      }
    }
  }
}

void
ShadowRoot::StyleSheetChanged()
{
  mProtoBinding->FlushSkinSheets();

  if (nsIPresShell* shell = OwnerDoc()->GetShell()) {
    OwnerDoc()->BeginUpdate(UPDATE_STYLE);
    shell->RecordShadowStyleChange(this);
    OwnerDoc()->EndUpdate(UPDATE_STYLE);
  }
}

void
ShadowRoot::InsertSheet(StyleSheet* aSheet,
                        nsIContent* aLinkingContent)
{
  nsCOMPtr<nsIStyleSheetLinkingElement>
    linkingElement = do_QueryInterface(aLinkingContent);

  // FIXME(emilio, bug 1410578): <link> should probably also be allowed here.
  MOZ_ASSERT(linkingElement, "The only styles in a ShadowRoot should come "
                             "from <style>.");

  linkingElement->SetStyleSheet(aSheet); // This sets the ownerNode on the sheet

  MOZ_DIAGNOSTIC_ASSERT(mProtoBinding->SheetCount() == DocumentOrShadowRoot::SheetCount());
#ifdef MOZ_DIAGNOSTIC_ASSERT_ENABLED
  // FIXME(emilio, bug 1425759): For now we keep them duplicated, the proto
  // binding will disappear soon (tm).
  {
    size_t i = 0;
    for (RefPtr<StyleSheet>& sheet : mStyleSheets) {
      MOZ_DIAGNOSTIC_ASSERT(sheet.get() == mProtoBinding->StyleSheetAt(i++));
    }
  }
#endif

  // Find the correct position to insert into the style sheet list (must
  // be in tree order).
  for (size_t i = 0; i <= SheetCount(); i++) {
    if (i == SheetCount()) {
      AppendStyleSheet(*aSheet);
      mProtoBinding->AppendStyleSheet(aSheet);
      break;
    }

    nsINode* sheetOwningNode = SheetAt(i)->GetOwnerNode();
    if (nsContentUtils::PositionIsBefore(aLinkingContent, sheetOwningNode)) {
      InsertSheetAt(i, *aSheet);
      mProtoBinding->InsertStyleSheetAt(i, aSheet);
      break;
    }
  }

  if (aSheet->IsApplicable()) {
    StyleSheetChanged();
  }
}

void
ShadowRoot::RemoveSheet(StyleSheet* aSheet)
{
  mProtoBinding->RemoveStyleSheet(aSheet);
  DocumentOrShadowRoot::RemoveSheet(*aSheet);

  if (aSheet->IsApplicable()) {
    StyleSheetChanged();
  }
}

void
ShadowRoot::AddToIdTable(Element* aElement, nsAtom* aId)
{
  nsIdentifierMapEntry* entry = mIdentifierMap.PutEntry(aId);
  if (entry) {
    entry->AddIdElement(aElement);
  }
}

void
ShadowRoot::RemoveFromIdTable(Element* aElement, nsAtom* aId)
{
  nsIdentifierMapEntry* entry = mIdentifierMap.GetEntry(aId);
  if (entry) {
    entry->RemoveIdElement(aElement);
    if (entry->IsEmpty()) {
      mIdentifierMap.RemoveEntry(entry);
    }
  }
}

nsresult
ShadowRoot::GetEventTargetParent(EventChainPreVisitor& aVisitor)
{
  aVisitor.mCanHandle = true;
  aVisitor.mRootOfClosedTree = IsClosed();

  // https://dom.spec.whatwg.org/#ref-for-get-the-parent%E2%91%A6
  if (!aVisitor.mEvent->mFlags.mComposed) {
    nsCOMPtr<nsIContent> originalTarget =
      do_QueryInterface(aVisitor.mEvent->mOriginalTarget);
    if (originalTarget->GetContainingShadow() == this) {
      // If we do stop propagation, we still want to propagate
      // the event to chrome (nsPIDOMWindow::GetParentTarget()).
      // The load event is special in that we don't ever propagate it
      // to chrome.
      nsCOMPtr<nsPIDOMWindowOuter> win = OwnerDoc()->GetWindow();
      EventTarget* parentTarget = win && aVisitor.mEvent->mMessage != eLoad
        ? win->GetParentTarget() : nullptr;

      aVisitor.SetParentTarget(parentTarget, true);
      return NS_OK;
    }
  }

  nsIContent* shadowHost = GetHost();
  aVisitor.SetParentTarget(shadowHost, false);

  if (aVisitor.mOriginalTargetIsInAnon) {
    nsCOMPtr<nsIContent> content(do_QueryInterface(aVisitor.mEvent->mTarget));
    if (content && content->GetBindingParent() == shadowHost) {
      aVisitor.mEventTargetAtParent = shadowHost;
    }
 }

  return NS_OK;
}

const HTMLSlotElement*
ShadowRoot::AssignSlotFor(nsIContent* aContent)
{
  nsAutoString slotName;
  // Note that if slot attribute is missing, assign it to the first default
  // slot, if exists.
  if (aContent->IsElement()) {
    aContent->AsElement()->GetAttr(kNameSpaceID_None, nsGkAtoms::slot, slotName);
  }

  nsTArray<HTMLSlotElement*>* slots = mSlotMap.Get(slotName);
  if (!slots) {
    return nullptr;
  }

  HTMLSlotElement* slot = slots->ElementAt(0);
  MOZ_ASSERT(slot);

  // Find the appropriate position in the assigned node list for the
  // newly assigned content.
  const nsTArray<RefPtr<nsINode>>& assignedNodes = slot->AssignedNodes();
  nsIContent* currentContent = GetHost()->GetFirstChild();
  Maybe<uint32_t> insertionIndex;
  for (uint32_t i = 0; i < assignedNodes.Length(); i++) {
    // Seek through the host's explicit children until the
    // assigned content is found.
    while (currentContent && currentContent != assignedNodes[i]) {
      if (currentContent == aContent) {
        insertionIndex.emplace(i);
        break;
      }

      currentContent = currentContent->GetNextSibling();
    }

    if (insertionIndex) {
      break;
    }
  }

  if (insertionIndex) {
    slot->InsertAssignedNode(*insertionIndex, aContent);
  } else {
    slot->AppendAssignedNode(aContent);
  }

  return slot;
}

const HTMLSlotElement*
ShadowRoot::UnassignSlotFor(nsIContent* aNode, const nsAString& aSlotName)
{
  // Find the insertion point to which the content belongs. Note that if slot
  // attribute is missing, unassign it from the first default slot, if exists.
  nsTArray<HTMLSlotElement*>* slots = mSlotMap.Get(aSlotName);
  if (!slots) {
    return nullptr;
  }

  HTMLSlotElement* slot = slots->ElementAt(0);
  MOZ_ASSERT(slot);

  if (!slot->AssignedNodes().Contains(aNode)) {
    return nullptr;
  }

  slot->RemoveAssignedNode(aNode);
  return slot;
}

bool
ShadowRoot::MaybeReassignElement(Element* aElement,
                                 const nsAttrValue* aOldValue)
{
  nsIContent* parent = aElement->GetParent();
  if (parent && parent == GetHost()) {
    const HTMLSlotElement* oldSlot = UnassignSlotFor(aElement,
      aOldValue ? aOldValue->GetStringValue() : EmptyString());
    const HTMLSlotElement* newSlot = AssignSlotFor(aElement);

    if (oldSlot != newSlot) {
      if (oldSlot) {
        oldSlot->EnqueueSlotChangeEvent();
      }
      if (newSlot) {
        newSlot->EnqueueSlotChangeEvent();
      }
      return true;
    }
  }

  return false;
}

void
ShadowRoot::DistributionChanged()
{
  // FIXME(emilio): We could be more granular in a bunch of cases.
  auto* host = GetHost();
  if (!host || !host->IsInComposedDoc()) {
    return;
  }

  auto* shell = OwnerDoc()->GetShell();
  if (!shell) {
    return;
  }

  shell->DestroyFramesForAndRestyle(host);
}

void
ShadowRoot::DistributeAllNodes()
{

  //XXX Handle <slot>.

  DistributionChanged();
}

Element*
ShadowRoot::GetActiveElement()
{
  return GetRetargetedFocusedElement();
}

void
ShadowRoot::GetInnerHTML(nsAString& aInnerHTML)
{
  GetMarkup(false, aInnerHTML);
}

void
ShadowRoot::SetInnerHTML(const nsAString& aInnerHTML, ErrorResult& aError)
{
  SetInnerHTMLInternal(aInnerHTML, aError);
}

Element*
ShadowRoot::Host()
{
  nsIContent* host = GetHost();
  MOZ_ASSERT(host && host->IsElement(),
             "ShadowRoot host should always be an element, "
             "how else did we create this ShadowRoot?");
  return host->AsElement();
}

bool
ShadowRoot::ApplyAuthorStyles()
{
  return mProtoBinding->InheritsStyle();
}

void
ShadowRoot::SetApplyAuthorStyles(bool aApplyAuthorStyles)
{
  mProtoBinding->SetInheritsStyle(aApplyAuthorStyles);

  nsIPresShell* shell = OwnerDoc()->GetShell();
  if (shell) {
    OwnerDoc()->BeginUpdate(UPDATE_STYLE);
    shell->RecordShadowStyleChange(this);
    OwnerDoc()->EndUpdate(UPDATE_STYLE);
  }
}

void
ShadowRoot::AttributeChanged(nsIDocument* aDocument,
                             Element* aElement,
                             int32_t aNameSpaceID,
                             nsAtom* aAttribute,
                             int32_t aModType,
                             const nsAttrValue* aOldValue)
{
  if (aNameSpaceID != kNameSpaceID_None || aAttribute != nsGkAtoms::slot) {
    return;
  }

  // Attributes may change insertion point matching, find its new distribution.
  if (!MaybeReassignElement(aElement, aOldValue)) {
    return;
  }

  if (!aElement->IsInComposedDoc()) {
    return;
  }

  auto* shell = OwnerDoc()->GetShell();
  if (!shell) {
    return;
  }

  //XXX optimize this!
  shell->DestroyFramesForAndRestyle(aElement);
}

void
ShadowRoot::ContentAppended(nsIDocument* aDocument,
                            nsIContent* aContainer,
                            nsIContent* aFirstNewContent)
{
  for (nsIContent* content = aFirstNewContent;
       content;
       content = content->GetNextSibling()) {
    ContentInserted(aDocument, aContainer, content);
  }
}

void
ShadowRoot::ContentInserted(nsIDocument* aDocument,
                            nsIContent* aContainer,
                            nsIContent* aChild)
{
  // Check to ensure that the content is in the same anonymous tree
  // as the container because anonymous content may report its container
  // as the host but it may not be in the host's child list.
  if (!nsContentUtils::IsInSameAnonymousTree(aContainer, aChild)) {
    return;
  }

  if (!aChild->IsSlotable()) {
    return;
  }

  if (aContainer && aContainer == GetHost()) {
    if (const HTMLSlotElement* slot = AssignSlotFor(aChild)) {
      slot->EnqueueSlotChangeEvent();
    }
    return;
  }

  // If parent's root is a shadow root, and parent is a slot whose assigned
  // nodes is the empty list, then run signal a slot change for parent.
  HTMLSlotElement* slot = HTMLSlotElement::FromContentOrNull(aContainer);
  if (slot && slot->GetContainingShadow() == this &&
      slot->AssignedNodes().IsEmpty()) {
    slot->EnqueueSlotChangeEvent();
  }
}

void
ShadowRoot::ContentRemoved(nsIDocument* aDocument,
                           nsIContent* aContainer,
                           nsIContent* aChild,
                           nsIContent* aPreviousSibling)
{
  // Check to ensure that the content is in the same anonymous tree
  // as the container because anonymous content may report its container
  // as the host but it may not be in the host's child list.
 if (!nsContentUtils::IsInSameAnonymousTree(aContainer, aChild)) {
    return;
  }

  if (!aChild->IsSlotable()) {
    return;
  }

  if (aContainer && aContainer == GetHost()) {
    nsAutoString slotName;
    if (aChild->IsElement()) {
      aChild->AsElement()->GetAttr(kNameSpaceID_None, nsGkAtoms::slot, slotName);
    }
    if (const HTMLSlotElement* slot = UnassignSlotFor(aChild, slotName)) {
      slot->EnqueueSlotChangeEvent();
    }
    return;
  }

  // If parent's root is a shadow root, and parent is a slot whose assigned
  // nodes is the empty list, then run signal a slot change for parent.
  HTMLSlotElement* slot = HTMLSlotElement::FromContentOrNull(aContainer);
  if (slot && slot->GetContainingShadow() == this &&
      slot->AssignedNodes().IsEmpty()) {
    slot->EnqueueSlotChangeEvent();
  }
}

nsresult
ShadowRoot::Clone(mozilla::dom::NodeInfo *aNodeInfo, nsINode **aResult,
                  bool aPreallocateChildren) const
{
  *aResult = nullptr;
  return NS_ERROR_DOM_NOT_SUPPORTED_ERR;
}
