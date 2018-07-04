/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_TextEditor_h
#define mozilla_TextEditor_h

#include "mozilla/EditorBase.h"
#include "nsCOMPtr.h"
#include "nsCycleCollectionParticipant.h"
#include "nsIEditor.h"
#include "nsIEditorMailSupport.h"
#include "nsIPlaintextEditor.h"
#include "nsISupportsImpl.h"
#include "nscore.h"

class nsIContent;
class nsIDocumentEncoder;
class nsIOutputStream;
class nsISelectionController;
class nsITransferable;

namespace mozilla {

class AutoEditInitRulesTrigger;
class HTMLEditRules;
enum class EditAction : int32_t;

namespace dom {
class DragEvent;
class Selection;
} // namespace dom

/**
 * The text editor implementation.
 * Use to edit text document represented as a DOM tree.
 */
class TextEditor : public EditorBase
                 , public nsIPlaintextEditor
                 , public nsIEditorMailSupport
{
public:
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_CYCLE_COLLECTION_CLASS_INHERITED(TextEditor, EditorBase)

  TextEditor();

  // nsIPlaintextEditor methods
  NS_DECL_NSIPLAINTEXTEDITOR

  // nsIEditorMailSupport overrides
  NS_DECL_NSIEDITORMAILSUPPORT

  // Overrides of nsIEditor
  NS_IMETHOD GetDocumentIsEmpty(bool* aDocumentIsEmpty) override;

  NS_IMETHOD DeleteSelection(EDirection aAction,
                             EStripWrappers aStripWrappers) override;

  NS_IMETHOD SetDocumentCharacterSet(const nsACString& characterSet) override;

  // If there are some good name to create non-virtual Undo()/Redo() methods,
  // we should create them and those methods should just run them.
  NS_IMETHOD Undo(uint32_t aCount) final;
  NS_IMETHOD Redo(uint32_t aCount) final;

  NS_IMETHOD Cut() override;
  NS_IMETHOD CanCut(bool* aCanCut) override;
  NS_IMETHOD Copy() override;
  NS_IMETHOD CanCopy(bool* aCanCopy) override;
  NS_IMETHOD CanDelete(bool* aCanDelete) override;
  NS_IMETHOD Paste(int32_t aSelectionType) override;
  NS_IMETHOD CanPaste(int32_t aSelectionType, bool* aCanPaste) override;
  NS_IMETHOD PasteTransferable(nsITransferable* aTransferable) override;
  NS_IMETHOD CanPasteTransferable(nsITransferable* aTransferable,
                                  bool* aCanPaste) override;

  NS_IMETHOD OutputToString(const nsAString& aFormatType,
                            uint32_t aFlags,
                            nsAString& aOutputString) override;

  // Overrides of EditorBase
  virtual nsresult RemoveAttributeOrEquivalent(
                     Element* aElement,
                     nsAtom* aAttribute,
                     bool aSuppressTransaction) override;
  virtual nsresult SetAttributeOrEquivalent(Element* aElement,
                                            nsAtom* aAttribute,
                                            const nsAString& aValue,
                                            bool aSuppressTransaction) override;
  using EditorBase::RemoveAttributeOrEquivalent;
  using EditorBase::SetAttributeOrEquivalent;

  virtual nsresult Init(nsIDocument& aDoc, Element* aRoot,
                        nsISelectionController* aSelCon, uint32_t aFlags,
                        const nsAString& aValue) override;

  nsresult DocumentIsEmpty(bool* aIsEmpty);

  /**
   * All editor operations which alter the doc should be prefaced
   * with a call to StartOperation, naming the action and direction.
   */
  virtual nsresult StartOperation(EditAction opID,
                                  nsIEditor::EDirection aDirection) override;

  /**
   * All editor operations which alter the doc should be followed
   * with a call to EndOperation.
   */
  virtual nsresult EndOperation() override;

  /**
   * Make the given selection span the entire document.
   */
  virtual nsresult SelectEntireDocument(Selection* aSelection) override;

  virtual nsresult HandleKeyPressEvent(
                     WidgetKeyboardEvent* aKeyboardEvent) override;

  virtual dom::EventTarget* GetDOMEventTarget() override;

  virtual already_AddRefed<nsIContent> GetInputEventTargetContent() override;

  /**
   * DeleteSelectionAsAction() removes selection content or content around
   * caret with transactions.  This should be used for handling it as an
   * edit action.
   *
   * @param aDirection          How much range should be removed.
   * @param aStripWrappers      Whether the parent blocks should be removed
   *                            when they become empty.
   */
  nsresult DeleteSelectionAsAction(EDirection aDirection,
                                   EStripWrappers aStripWrappers);

  /**
   * DeleteSelectionWithTransaction() removes selected content or content
   * around caret with transactions.
   *
   * @param aDirection          How much range should be removed.
   * @param aStripWrappers      Whether the parent blocks should be removed
   *                            when they become empty.
   */
  virtual nsresult
  DeleteSelectionWithTransaction(EDirection aAction,
                                 EStripWrappers aStripWrappers);

  /**
   * OnInputText() is called when user inputs text with keyboard or something.
   *
   * @param aStringToInsert     The string to insert.
   */
  nsresult OnInputText(const nsAString& aStringToInsert);

  /**
   * OnInputParagraphSeparator() is called when user tries to separate current
   * paragraph with Enter key press or something.
   */
  nsresult OnInputParagraphSeparator();

  /**
   * InsertTextAsAction() inserts aStringToInsert at selection.
   * Although this method is implementation of nsIPlaintextEditor.insertText(),
   * this treats the input is an edit action.
   *
   * @param aStringToInsert     The string to insert.
   */
  nsresult InsertTextAsAction(const nsAString& aStringToInsert);

  /**
   * InsertParagraphSeparatorAsAction() inserts a line break if it's TextEditor
   * or inserts new paragraph if it's HTMLEditor and it's possible.
   * Although, this method is implementation of
   * nsIPlaintextEditor.insertLineBreak(), this treats the input is an edit
   * action.
   */
  nsresult InsertParagraphSeparatorAsAction();

  nsresult InsertTextAt(const nsAString& aStringToInsert,
                        nsINode* aDestinationNode,
                        int32_t aDestOffset,
                        bool aDoDeleteSelection);

  virtual nsresult InsertFromDataTransfer(dom::DataTransfer* aDataTransfer,
                                          int32_t aIndex,
                                          nsIDocument* aSourceDoc,
                                          nsINode* aDestinationNode,
                                          int32_t aDestOffset,
                                          bool aDoDeleteSelection) override;

  virtual nsresult InsertFromDrop(dom::DragEvent* aDropEvent) override;

  /**
   * Extends the selection for given deletion operation
   * If done, also update aAction to what's actually left to do after the
   * extension.
   */
  nsresult ExtendSelectionForDelete(Selection* aSelection,
                                    nsIEditor::EDirection* aAction);

  /**
   * Return true if the data is safe to insert as the source and destination
   * principals match, or we are in a editor context where this doesn't matter.
   * Otherwise, the data must be sanitized first.
   */
  bool IsSafeToInsertData(nsIDocument* aSourceDoc);

  static void GetDefaultEditorPrefs(int32_t& aNewLineHandling,
                                    int32_t& aCaretStyle);

  /**
    * The maximum number of characters allowed.
    *   default: -1 (unlimited).
    */
  int32_t MaxTextLength() const { return mMaxTextLength; }
  void SetMaxTextLength(int32_t aLength) { mMaxTextLength = aLength; }

  /**
   * Replace existed string with a string.
   * This is fast path to replace all string when using single line control.
   *
   * @ param aString   the string to be set
   */
  nsresult SetText(const nsAString& aString);

  /**
   * OnCompositionStart() is called when editor receives eCompositionStart
   * event which should be handled in this editor.
   */
  nsresult OnCompositionStart(WidgetCompositionEvent& aCompositionStartEvent);

  /**
   * OnCompositionChange() is called when editor receives an eCompositioChange
   * event which should be handled in this editor.
   *
   * @param aCompositionChangeEvent     eCompositionChange event which should
   *                                    be handled in this editor.
   */
  nsresult
  OnCompositionChange(WidgetCompositionEvent& aCompositionChangeEvent);

  /**
   * OnCompositionEnd() is called when editor receives an eCompositionChange
   * event and it's followed by eCompositionEnd event and after
   * OnCompositionChange() is called.
   */
  void OnCompositionEnd(WidgetCompositionEvent& aCompositionEndEvent);

protected:
  virtual ~TextEditor();

  NS_IMETHOD InitRules();
  void BeginEditorInit();
  nsresult EndEditorInit();

  already_AddRefed<nsIDocumentEncoder> GetAndInitDocEncoder(
                                         const nsAString& aFormatType,
                                         uint32_t aFlags,
                                         const nsACString& aCharset);

  /**
   * InsertBrElementWithTransaction() creates a <br> element and inserts it
   * before aPointToInsert.  Then, tries to collapse selection at or after the
   * new <br> node if aSelect is not eNone.
   *
   * @param aSelection          The selection of this editor.
   * @param aPointToInsert      The DOM point where should be <br> node inserted
   *                            before.
   * @param aSelect             If eNone, this won't change selection.
   *                            If eNext, selection will be collapsed after
   *                            the <br> element.
   *                            If ePrevious, selection will be collapsed at
   *                            the <br> element.
   * @return                    The new <br> node.  If failed to create new
   *                            <br> node, returns nullptr.
   */
  template<typename PT, typename CT>
  already_AddRefed<Element>
  InsertBrElementWithTransaction(
    Selection& aSelection,
    const EditorDOMPointBase<PT, CT>& aPointToInsert,
    EDirection aSelect = eNone);

  /**
   * Factored methods for handling insertion of data from transferables
   * (drag&drop or clipboard).
   */
  NS_IMETHOD PrepareTransferable(nsITransferable** transferable);
  nsresult InsertTextFromTransferable(nsITransferable* transferable);

  /**
   * DeleteSelectionAndCreateElement() creates a element whose name is aTag.
   * And insert it into the DOM tree after removing the selected content.
   *
   * @param aTag                The element name to be created.
   * @return                    Created new element.
   */
  already_AddRefed<Element> DeleteSelectionAndCreateElement(nsAtom& aTag);

  /**
   * This method first deletes the selection, if it's not collapsed.  Then if
   * the selection lies in a CharacterData node, it splits it.  If the
   * selection is at this point collapsed in a CharacterData node, it's
   * adjusted to be collapsed right before or after the node instead (which is
   * always possible, since the node was split).
   */
  nsresult DeleteSelectionAndPrepareToCreateNode();

  /**
   * Shared outputstring; returns whether selection is collapsed and resulting
   * string.
   */
  nsresult SharedOutputString(uint32_t aFlags, bool* aIsCollapsed,
                              nsAString& aResult);

  enum PasswordFieldAllowed
  {
    ePasswordFieldAllowed,
    ePasswordFieldNotAllowed
  };
  bool CanCutOrCopy(PasswordFieldAllowed aPasswordFieldAllowed);
  bool FireClipboardEvent(EventMessage aEventMessage,
                          int32_t aSelectionType,
                          bool* aActionTaken = nullptr);

  bool UpdateMetaCharset(nsIDocument& aDocument,
                         const nsACString& aCharacterSet);

  /**
   * EnsureComposition() should be called by composition event handlers.  This
   * tries to get the composition for the event and set it to mComposition.
   * However, this may fail because the composition may be committed before
   * the event comes to the editor.
   *
   * @return            true if there is a composition.  Otherwise, for example,
   *                    a composition event handler in web contents moved focus
   *                    for committing the composition, returns false.
   */
  bool EnsureComposition(WidgetCompositionEvent& aCompositionEvent);

protected:
  nsCOMPtr<nsIDocumentEncoder> mCachedDocumentEncoder;
  nsString mCachedDocumentEncoderType;
  int32_t mWrapColumn;
  int32_t mMaxTextLength;
  int32_t mInitTriggerCounter;
  int32_t mNewlineHandling;
  int32_t mCaretStyle;

  friend class AutoEditInitRulesTrigger;
  friend class HTMLEditRules;
  friend class TextEditRules;
};

} // namespace mozilla

mozilla::TextEditor*
nsIEditor::AsTextEditor()
{
  return static_cast<mozilla::TextEditor*>(this);
}

const mozilla::TextEditor*
nsIEditor::AsTextEditor() const
{
  return static_cast<const mozilla::TextEditor*>(this);
}

#endif // #ifndef mozilla_TextEditor_h
