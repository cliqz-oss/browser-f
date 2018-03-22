/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that native getters (e.g. document.body) autocompletes in the web console.
// See Bug 651501.

"use strict";

const TEST_URI = "data:text/html;charset=utf-8,Test document.body autocompletion";

add_task(async function () {
  let { jsterm } = await openNewTabAndConsole(TEST_URI);

  const {
    autocompletePopup: popup,
    completeNode,
  } = jsterm;

  ok(!popup.isOpen, "popup is not open");
  let onPopupOpen = popup.once("popup-opened");

  jsterm.setInputValue("document.body");
  EventUtils.synthesizeKey(".", {});

  await onPopupOpen;

  ok(popup.isOpen, "popup is open");
  is(popup.itemCount, jsterm._autocompleteCache.length, "popup.itemCount is correct");
  ok(jsterm._autocompleteCache.includes("addEventListener"),
        "addEventListener is in the list of suggestions");
  ok(jsterm._autocompleteCache.includes("bgColor"),
    "bgColor is in the list of suggestions");
  ok(jsterm._autocompleteCache.includes("ATTRIBUTE_NODE"),
    "ATTRIBUTE_NODE is in the list of suggestions");

  let onPopupClose = popup.once("popup-closed");
  EventUtils.synthesizeKey("VK_ESCAPE", {});

  await onPopupClose;

  ok(!popup.isOpen, "popup is not open");
  let onAutoCompleteUpdated = jsterm.once("autocomplete-updated");
  let inputStr = "document.b";
  jsterm.setInputValue(inputStr);
  EventUtils.synthesizeKey("o", {});

  await onAutoCompleteUpdated;

  // Build the spaces that are placed in the input to place the autocompletion result at
  // the expected spot:
  // > document.bo        <-- input
  // > -----------dy      <-- autocomplete
  const spaces = " ".repeat(inputStr.length + 1);
  is(completeNode.value, spaces + "dy", "autocomplete shows document.body");
});
