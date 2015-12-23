/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test that the rule-view behaves correctly when entering mutliple and/or
// unfinished properties/values in inplace-editors

const TEST_URI = "<div>Test Element</div>";

add_task(function*() {
  yield addTab("data:text/html;charset=utf-8," + encodeURIComponent(TEST_URI));
  let {inspector, view} = yield openRuleView();
  yield selectNode("div", inspector);
  yield testCreateNewMultiPartialUnfinished(inspector, view);
});

function* testCreateNewMultiPartialUnfinished(inspector, view) {
  let ruleEditor = getRuleViewRuleEditor(view, 0);
  let onMutation = inspector.once("markupmutation");
  yield createNewRuleViewProperty(ruleEditor, "width: 100px; heig");
  yield onMutation;

  is(ruleEditor.rule.textProps.length, 2,
    "Should have created a new text property.");
  is(ruleEditor.propertyList.children.length, 2,
    "Should have created a property editor.");

  // Value is focused, lets add multiple rules here and make sure they get added
  onMutation = inspector.once("markupmutation");
  let valueEditor = ruleEditor.propertyList.children[1].querySelector("input");
  valueEditor.value = "10px;background:orangered;color: black;";
  EventUtils.synthesizeKey("VK_RETURN", {}, view.styleWindow);
  yield onMutation;

  is(ruleEditor.rule.textProps.length, 4,
    "Should have added the changed value.");
  is(ruleEditor.propertyList.children.length, 5,
    "Should have added the changed value editor.");

  is(ruleEditor.rule.textProps[0].name, "width",
    "Should have correct property name");
  is(ruleEditor.rule.textProps[0].value, "100px",
    "Should have correct property value");

  is(ruleEditor.rule.textProps[1].name, "heig",
    "Should have correct property name");
  is(ruleEditor.rule.textProps[1].value, "10px",
    "Should have correct property value");

  is(ruleEditor.rule.textProps[2].name, "background",
    "Should have correct property name");
  is(ruleEditor.rule.textProps[2].value, "orangered",
    "Should have correct property value");

  is(ruleEditor.rule.textProps[3].name, "color",
    "Should have correct property name");
  is(ruleEditor.rule.textProps[3].value, "black",
    "Should have correct property value");
}
