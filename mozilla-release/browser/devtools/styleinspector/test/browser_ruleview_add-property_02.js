/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Tests all sorts of additions and updates of properties in the rule-view.
// FIXME: TO BE SPLIT IN *MANY* SMALLER TESTS

const TEST_URI = `
  <style type="text/css">
    #testid {
      background-color: blue;
    }
    .testclass, .unmatched {
      background-color: green;
    };
  </style>
  <div id='testid' class='testclass'>Styled Node</div>
  <div id='testid2'>Styled Node</div>
`;

add_task(function*() {
  yield addTab("data:text/html;charset=utf-8," + encodeURIComponent(TEST_URI));
  let {inspector, view} = yield openRuleView();
  yield testCreateNew(inspector, view);
});

function* testCreateNew(inspector, ruleView) {
  // Create a new property.
  let elementRuleEditor = getRuleViewRuleEditor(ruleView, 0);
  let editor = yield focusEditableField(ruleView, elementRuleEditor.closeBrace);

  is(inplaceEditor(elementRuleEditor.newPropSpan), editor,
    "Next focused editor should be the new property editor.");

  let input = editor.input;

  ok(input.selectionStart === 0 && input.selectionEnd === input.value.length,
    "Editor contents are selected.");

  // Try clicking on the editor's input again, shouldn't cause trouble
  // (see bug 761665).
  EventUtils.synthesizeMouse(input, 1, 1, {}, ruleView.styleWindow);
  input.select();

  info("Entering the property name");
  input.value = "background-color";

  info("Pressing RETURN and waiting for the value field focus");
  let onFocus = once(elementRuleEditor.element, "focus", true);
  EventUtils.sendKey("return", ruleView.styleWindow);
  yield onFocus;
  yield elementRuleEditor.rule._applyingModifications;

  editor = inplaceEditor(ruleView.styleDocument.activeElement);

  is(elementRuleEditor.rule.textProps.length, 1,
    "Should have created a new text property.");
  is(elementRuleEditor.propertyList.children.length, 1,
    "Should have created a property editor.");
  let textProp = elementRuleEditor.rule.textProps[0];
  is(editor, inplaceEditor(textProp.editor.valueSpan),
    "Should be editing the value span now.");

  let onMutated = inspector.once("markupmutation");
  editor.input.value = "purple";
  let onBlur = once(editor.input, "blur");
  EventUtils.sendKey("return", ruleView.styleWindow);
  yield onBlur;
  yield onMutated;

  is(textProp.value, "purple", "Text prop should have been changed.");
}
