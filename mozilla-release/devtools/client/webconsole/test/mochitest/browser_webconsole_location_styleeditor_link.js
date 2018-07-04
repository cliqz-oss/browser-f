/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URI = "http://example.com/browser/devtools/client/webconsole/" +
                 "test/mochitest/" +
                 "test-location-styleeditor-link.html";

add_task(async function() {
  await pushPref("devtools.webconsole.filter.css", true);
  let hud = await openNewTabAndConsole(TEST_URI);
  let target = TargetFactory.forTab(gBrowser.selectedTab);
  let toolbox = gDevTools.getToolbox(target);

  await testViewSource(hud, toolbox, "\u2018font-weight\u2019");

  info("Selecting the console again");
  await toolbox.selectTool("webconsole");
  await testViewSource(hud, toolbox, "\u2018color\u2019");
});

async function testViewSource(hud, toolbox, text) {
  info(`Testing message with text "${text}"`);
  let messageNode = await waitFor(() => findMessage(hud, text));
  let frameLinkNode = messageNode.querySelector(".message-location .frame-link");
  ok(frameLinkNode, "The message does have a location link");

  let onStyleEditorSelected = toolbox.once("styleeditor-selected");

  EventUtils.sendMouseEvent({ type: "click" },
    messageNode.querySelector(".frame-link-filename"));

  let panel = await onStyleEditorSelected;
  ok(true, "The style editor is selected when clicking on the location element");

  await onStyleEditorReady(panel);

  info("style editor window focused");
  let href = frameLinkNode.getAttribute("data-url");
  let line = frameLinkNode.getAttribute("data-line");
  ok(line, "found source line");

  let editor = getEditorForHref(panel.UI, href);
  ok(editor, "found style editor for " + href);
  await performLineCheck(panel.UI, editor, line - 1);
}

async function onStyleEditorReady(panel) {
  let win = panel.panelWindow;
  ok(win, "Style Editor Window is defined");
  ok(panel.UI, "Style Editor UI is defined");

  info("Waiting the style editor to be focused");
  return new Promise(resolve => {
    waitForFocus(function() {
      resolve();
    }, win);
  });
}

function getEditorForHref(styleEditorUI, href) {
  let foundEditor = null;
  for (let editor of styleEditorUI.editors) {
    if (editor.styleSheet.href == href) {
      foundEditor = editor;
      break;
    }
  }
  return foundEditor;
}

async function performLineCheck(styleEditorUI, editor, line) {
  info("wait for source editor to load");
  // Get out of the styleeditor-selected event loop.
  await waitForTick();

  is(editor.sourceEditor.getCursor().line, line,
     "correct line is selected");
  is(styleEditorUI.selectedStyleSheetIndex, editor.styleSheet.styleSheetIndex,
     "correct stylesheet is selected in the editor");
}
