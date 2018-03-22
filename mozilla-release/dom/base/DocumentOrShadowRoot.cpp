/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "DocumentOrShadowRoot.h"
#include "mozilla/dom/StyleSheetList.h"
#include "nsDocument.h"
#include "nsFocusManager.h"

namespace mozilla {
namespace dom {

DocumentOrShadowRoot::DocumentOrShadowRoot(mozilla::dom::ShadowRoot& aShadowRoot)
  : mAsNode(aShadowRoot)
  , mKind(Kind::ShadowRoot)
{}

DocumentOrShadowRoot::DocumentOrShadowRoot(nsIDocument& aDoc)
  : mAsNode(aDoc)
  , mKind(Kind::Document)
{}

StyleSheetList&
DocumentOrShadowRoot::EnsureDOMStyleSheets()
{
  if (!mDOMStyleSheets) {
    mDOMStyleSheets = new StyleSheetList(*this);
  }
  return *mDOMStyleSheets;
}

Element*
DocumentOrShadowRoot::GetElementById(const nsAString& aElementId)
{
  if (MOZ_UNLIKELY(aElementId.IsEmpty())) {
    nsContentUtils::ReportEmptyGetElementByIdArg(AsNode().OwnerDoc());
    return nullptr;
  }

  if (nsIdentifierMapEntry* entry = mIdentifierMap.GetEntry(aElementId)) {
    if (Element* el = entry->GetIdElement()) {
      return el;
    }
  }

  return nullptr;
}

already_AddRefed<nsContentList>
DocumentOrShadowRoot::GetElementsByTagNameNS(const nsAString& aNamespaceURI,
                                   const nsAString& aLocalName)
{
  ErrorResult rv;
  RefPtr<nsContentList> list =
    GetElementsByTagNameNS(aNamespaceURI, aLocalName, rv);
  if (rv.Failed()) {
    return nullptr;
  }
  return list.forget();
}

already_AddRefed<nsContentList>
DocumentOrShadowRoot::GetElementsByTagNameNS(const nsAString& aNamespaceURI,
                                   const nsAString& aLocalName,
                                   mozilla::ErrorResult& aResult)
{
  int32_t nameSpaceId = kNameSpaceID_Wildcard;

  if (!aNamespaceURI.EqualsLiteral("*")) {
    aResult =
      nsContentUtils::NameSpaceManager()->RegisterNameSpace(aNamespaceURI,
                                                            nameSpaceId);
    if (aResult.Failed()) {
      return nullptr;
    }
  }

  NS_ASSERTION(nameSpaceId != kNameSpaceID_Unknown, "Unexpected namespace ID!");
  return NS_GetContentList(&AsNode(), nameSpaceId, aLocalName);
}

already_AddRefed<nsContentList>
DocumentOrShadowRoot::GetElementsByClassName(const nsAString& aClasses)
{
  return nsContentUtils::GetElementsByClassName(&AsNode(), aClasses);
}

nsIContent*
DocumentOrShadowRoot::Retarget(nsIContent* aContent) const
{
  for (nsIContent* cur = aContent;
       cur;
       cur = cur->GetContainingShadowHost()) {
    if (cur->SubtreeRoot() == &AsNode()) {
      return cur;
    }
  }
  return nullptr;
}

Element*
DocumentOrShadowRoot::GetRetargetedFocusedElement()
{
  if (nsCOMPtr<nsPIDOMWindowOuter> window = AsNode().OwnerDoc()->GetWindow()) {
    nsCOMPtr<nsPIDOMWindowOuter> focusedWindow;
    nsIContent* focusedContent =
      nsFocusManager::GetFocusedDescendant(window,
                                           nsFocusManager::eOnlyCurrentWindow,
                                           getter_AddRefs(focusedWindow));
    // be safe and make sure the element is from this document
    if (focusedContent && focusedContent->OwnerDoc() == AsNode().OwnerDoc()) {
      if (focusedContent->ChromeOnlyAccess()) {
        focusedContent = focusedContent->FindFirstNonChromeOnlyAccessContent();
      }

      if (focusedContent) {
        if (!nsDocument::IsShadowDOMEnabled(focusedContent)) {
          return focusedContent->AsElement();
        }

        if (nsIContent* retarget = Retarget(focusedContent)) {
          return retarget->AsElement();
        }
      }
    }
  }

  return nullptr;
}

}
}
