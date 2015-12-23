/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Tests that CSS property names and values are autocompleted and cycled
// correctly when editing existing properties in the rule view.

// format :
//  [
//    what key to press,
//    modifers,
//    expected input box value after keypress,
//    selectedIndex of the popup,
//    total items in the popup
//  ]
var testData = [
  ["b", {}, "beige", 0, 8],
  ["l", {}, "black", 0, 4],
  ["VK_DOWN", {}, "blanchedalmond", 1, 4],
  ["VK_DOWN", {}, "blue", 2, 4],
  ["VK_RIGHT", {}, "blue", -1, 0],
  [" ", {}, "blue !important", 0, 10],
  ["!", {}, "blue !important", 0, 0],
  ["VK_BACK_SPACE", {}, "blue !", -1, 0],
  ["VK_BACK_SPACE", {}, "blue ", -1, 0],
  ["VK_BACK_SPACE", {}, "blue", -1, 0],
  ["VK_TAB", {shiftKey: true}, "color", -1, 0],
  ["VK_BACK_SPACE", {}, "", -1, 0],
  ["d", {}, "direction", 0, 3],
  ["i", {}, "direction", 0, 2],
  ["s", {}, "display", -1, 0],
  ["VK_TAB", {}, "blue", -1, 0],
  ["n", {}, "none", -1, 0],
  ["VK_RETURN", {}, null, -1, 0]
];

const TEST_URI = "<h1 style='color: red'>Header</h1>";

add_task(function*() {
  yield addTab("data:text/html;charset=utf-8," + encodeURIComponent(TEST_URI));
  let {toolbox, inspector, view} = yield openRuleView();

  info("Test autocompletion after 1st page load");
  yield runAutocompletionTest(toolbox, inspector, view);

  info("Test autocompletion after page navigation");
  yield reloadPage(inspector);
  yield runAutocompletionTest(toolbox, inspector, view);
});

function* runAutocompletionTest(toolbox, inspector, view) {
  info("Selecting the test node");
  yield selectNode("h1", inspector);

  info("Focusing the css property editable value");
  let value = view.styleDocument.querySelectorAll(".ruleview-propertyvalue")[0];
  let editor = yield focusEditableField(view, value);

  info("Starting to test for css property completion");
  for (let i = 0; i < testData.length; i++) {
    // Re-define the editor at each iteration, because the focus may have moved
    // from property to value and back
    editor = inplaceEditor(view.styleDocument.activeElement);
    yield testCompletion(testData[i], editor, view);
  }
}

function* testCompletion([key, modifiers, completion, index, total], editor,
    view) {
  info("Pressing key " + key);
  info("Expecting " + completion + ", " + index + ", " + total);

  let onKeyPress;

  if (/tab/ig.test(key)) {
    info("Waiting for the new property or value editor to get focused");
    let brace = view.styleDocument.querySelector(".ruleview-ruleclose");
    onKeyPress = once(brace.parentNode, "focus", true);
  } else if (/(right|return|back_space)/ig.test(key)) {
    info("Adding event listener for right|return|back_space keys");
    onKeyPress = once(editor.input, "keypress");
  } else {
    info("Waiting for after-suggest event on the editor");
    onKeyPress = editor.once("after-suggest");
  }

  info("Synthesizing key " + key + ", modifiers: " + Object.keys(modifiers));
  EventUtils.synthesizeKey(key, modifiers, view.styleWindow);

  yield onKeyPress;
  yield wait(1); // Equivalent of executeSoon

  // The key might have been a TAB or shift-TAB, in which case the editor will
  // be a new one
  editor = inplaceEditor(view.styleDocument.activeElement);

  info("Checking the state");
  if (completion != null) {
    is(editor.input.value, completion, "Correct value is autocompleted");
  }
  if (total == 0) {
    ok(!(editor.popup && editor.popup.isOpen), "Popup is closed");
  } else {
    ok(editor.popup._panel.state == "open" ||
       editor.popup._panel.state == "showing", "Popup is open");
    is(editor.popup.getItems().length, total, "Number of suggestions match");
    is(editor.popup.selectedIndex, index, "Correct item is selected");
  }
}
