/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/HTMLEditor.h"

#include "HTMLEditUtils.h"
#include "mozilla/dom/Element.h"
#include "nsAString.h"
#include "nsCOMPtr.h"
#include "nsDebug.h"
#include "nsError.h"
#include "nsGenericHTMLElement.h"
#include "nsIContent.h"
#include "nsIHTMLObjectResizer.h"
#include "nsIPresShell.h"
#include "nsLiteralString.h"
#include "nsReadableUtils.h"
#include "nsString.h"
#include "nscore.h"

namespace mozilla {

// Uncomment the following line if you want to disable
// table deletion when the only column/row is removed
// #define DISABLE_TABLE_DELETION 1

NS_IMETHODIMP
HTMLEditor::SetInlineTableEditingEnabled(bool aIsEnabled)
{
  mIsInlineTableEditingEnabled = aIsEnabled;
  return NS_OK;
}

NS_IMETHODIMP
HTMLEditor::GetInlineTableEditingEnabled(bool* aIsEnabled)
{
  *aIsEnabled = mIsInlineTableEditingEnabled;
  return NS_OK;
}

nsresult
HTMLEditor::ShowInlineTableEditingUI(Element* aCell)
{
  // do nothing if aCell is not a table cell...
  if (!aCell || !HTMLEditUtils::IsTableCell(aCell)) {
    return NS_OK;
  }

  if (NS_WARN_IF(!IsDescendantOfEditorRoot(aCell))) {
    return NS_ERROR_UNEXPECTED;
  }

  if (mInlineEditedCell) {
    NS_ERROR("call HideInlineTableEditingUI first");
    return NS_ERROR_UNEXPECTED;
  }

  // the resizers and the shadow will be anonymous children of the body
  RefPtr<Element> bodyElement = GetRoot();
  NS_ENSURE_TRUE(bodyElement, NS_ERROR_NULL_POINTER);

  mAddColumnBeforeButton =
    CreateAnonymousElement(nsGkAtoms::a, *bodyElement,
                           NS_LITERAL_STRING("mozTableAddColumnBefore"), false);
  mRemoveColumnButton =
    CreateAnonymousElement(nsGkAtoms::a, *bodyElement,
                           NS_LITERAL_STRING("mozTableRemoveColumn"), false);
  mAddColumnAfterButton =
    CreateAnonymousElement(nsGkAtoms::a, *bodyElement,
                           NS_LITERAL_STRING("mozTableAddColumnAfter"), false);

  mAddRowBeforeButton =
    CreateAnonymousElement(nsGkAtoms::a, *bodyElement,
                           NS_LITERAL_STRING("mozTableAddRowBefore"), false);
  mRemoveRowButton =
    CreateAnonymousElement(nsGkAtoms::a, *bodyElement,
                           NS_LITERAL_STRING("mozTableRemoveRow"), false);
  mAddRowAfterButton =
    CreateAnonymousElement(nsGkAtoms::a, *bodyElement,
                           NS_LITERAL_STRING("mozTableAddRowAfter"), false);

  AddMouseClickListener(mAddColumnBeforeButton);
  AddMouseClickListener(mRemoveColumnButton);
  AddMouseClickListener(mAddColumnAfterButton);
  AddMouseClickListener(mAddRowBeforeButton);
  AddMouseClickListener(mRemoveRowButton);
  AddMouseClickListener(mAddRowAfterButton);

  mInlineEditedCell = aCell;

  mHasShownInlineTableEditor = true;

  return RefreshInlineTableEditingUI();
}

nsresult
HTMLEditor::HideInlineTableEditingUI()
{
  mInlineEditedCell = nullptr;

  RemoveMouseClickListener(mAddColumnBeforeButton);
  RemoveMouseClickListener(mRemoveColumnButton);
  RemoveMouseClickListener(mAddColumnAfterButton);
  RemoveMouseClickListener(mAddRowBeforeButton);
  RemoveMouseClickListener(mRemoveRowButton);
  RemoveMouseClickListener(mAddRowAfterButton);

  // get the presshell's document observer interface.
  nsCOMPtr<nsIPresShell> ps = GetPresShell();
  // We allow the pres shell to be null; when it is, we presume there
  // are no document observers to notify, but we still want to
  // UnbindFromTree.

  DeleteRefToAnonymousNode(std::move(mAddColumnBeforeButton), ps);
  DeleteRefToAnonymousNode(std::move(mRemoveColumnButton), ps);
  DeleteRefToAnonymousNode(std::move(mAddColumnAfterButton), ps);
  DeleteRefToAnonymousNode(std::move(mAddRowBeforeButton), ps);
  DeleteRefToAnonymousNode(std::move(mRemoveRowButton), ps);
  DeleteRefToAnonymousNode(std::move(mAddRowAfterButton), ps);

  return NS_OK;
}

nsresult
HTMLEditor::DoInlineTableEditingAction(const Element& aElement)
{
  nsAutoString anonclass;
  aElement.GetAttr(kNameSpaceID_None, nsGkAtoms::_moz_anonclass, anonclass);

  if (!StringBeginsWith(anonclass, NS_LITERAL_STRING("mozTable"))) {
    return NS_OK;
  }

  RefPtr<Element> tableElement = GetEnclosingTable(mInlineEditedCell);
  int32_t rowCount, colCount;
  nsresult rv = GetTableSize(tableElement, &rowCount, &colCount);
  NS_ENSURE_SUCCESS(rv, rv);

  bool hideUI = false;
  bool hideResizersWithInlineTableUI = (mResizedObject == tableElement);

  if (anonclass.EqualsLiteral("mozTableAddColumnBefore")) {
    InsertTableColumn(1, false);
  } else if (anonclass.EqualsLiteral("mozTableAddColumnAfter")) {
    InsertTableColumn(1, true);
  } else if (anonclass.EqualsLiteral("mozTableAddRowBefore")) {
    InsertTableRow(1, false);
  } else if (anonclass.EqualsLiteral("mozTableAddRowAfter")) {
    InsertTableRow(1, true);
  } else if (anonclass.EqualsLiteral("mozTableRemoveColumn")) {
    DeleteTableColumn(1);
#ifndef DISABLE_TABLE_DELETION
    hideUI = (colCount == 1);
#endif
  } else if (anonclass.EqualsLiteral("mozTableRemoveRow")) {
    DeleteTableRow(1);
#ifndef DISABLE_TABLE_DELETION
    hideUI = (rowCount == 1);
#endif
  } else {
    return NS_OK;
  }

  ++mInlineTableEditorUsedCount;

  // InsertTableRow might causes reframe
  if (Destroyed()) {
    return NS_OK;
  }

  if (hideUI) {
    HideInlineTableEditingUI();
    if (hideResizersWithInlineTableUI) {
      HideResizers();
    }
  }

  return NS_OK;
}

void
HTMLEditor::AddMouseClickListener(Element* aElement)
{
  if (aElement) {
    aElement->AddEventListener(NS_LITERAL_STRING("click"),
			       mEventListener, true);
  }
}

void
HTMLEditor::RemoveMouseClickListener(Element* aElement)
{
  if (aElement) {
    aElement->RemoveEventListener(NS_LITERAL_STRING("click"),
                                  mEventListener, true);
  }
}

NS_IMETHODIMP
HTMLEditor::RefreshInlineTableEditingUI()
{
  if (!mInlineEditedCell) {
   return NS_OK;
  }

  RefPtr<nsGenericHTMLElement> htmlElement =
    nsGenericHTMLElement::FromNode(mInlineEditedCell);
  if (!htmlElement) {
    return NS_ERROR_NULL_POINTER;
  }

  int32_t xCell, yCell, wCell, hCell;
  GetElementOrigin(*mInlineEditedCell, xCell, yCell);

  wCell = htmlElement->OffsetWidth();
  hCell = htmlElement->OffsetHeight();

  int32_t xHoriz = xCell + wCell/2;
  int32_t yVert  = yCell + hCell/2;

  RefPtr<Element> tableElement = GetEnclosingTable(mInlineEditedCell);
  int32_t rowCount, colCount;
  nsresult rv = GetTableSize(tableElement, &rowCount, &colCount);
  NS_ENSURE_SUCCESS(rv, rv);

  SetAnonymousElementPosition(xHoriz-10, yCell-7,  mAddColumnBeforeButton);
#ifdef DISABLE_TABLE_DELETION
  if (colCount== 1) {
    mRemoveColumnButton->SetAttr(kNameSpaceID_None, nsGkAtoms::_class,
                                 NS_LITERAL_STRING("hidden"), true);
  } else {
    if (mRemoveColumnButton->HasAttr(kNameSpaceID_None, nsGkAtoms::_class)) {
      mRemoveColumnButton->UnsetAttr(kNameSpaceID_None, nsGkAtoms::_class);
    }
#endif
    SetAnonymousElementPosition(xHoriz-4, yCell-7,  mRemoveColumnButton);
#ifdef DISABLE_TABLE_DELETION
  }
#endif
  SetAnonymousElementPosition(xHoriz+6, yCell-7,  mAddColumnAfterButton);

  SetAnonymousElementPosition(xCell-7, yVert-10,  mAddRowBeforeButton);
#ifdef DISABLE_TABLE_DELETION
  if (rowCount== 1) {
    mRemoveRowButton->SetAttr(kNameSpaceID_None, nsGkAtoms::_class,
                              NS_LITERAL_STRING("hidden"), true);
  } else {
    if (mRemoveRowButton->HasAttr(kNameSpaceID_None, nsGkAtoms::_class)) {
      mRemoveRowButton->UnsetAttr(kNameSpaceID_None, nsGkAtoms::_class, true);
    }
#endif
    SetAnonymousElementPosition(xCell-7, yVert-4,  mRemoveRowButton);
#ifdef DISABLE_TABLE_DELETION
  }
#endif
  SetAnonymousElementPosition(xCell-7, yVert+6,  mAddRowAfterButton);

  return NS_OK;
}

} // namespace mozilla
