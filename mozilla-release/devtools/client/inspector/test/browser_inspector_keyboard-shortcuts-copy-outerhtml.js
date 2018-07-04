/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

// Test copy outer HTML from the keyboard/copy event

const TEST_URL = URL_ROOT + "doc_inspector_outerhtml.html";

add_task(async function() {
  let { inspector } = await openInspectorForURL(TEST_URL);
  let root = inspector.markup._elt;

  info("Test copy outerHTML for COMMENT node");
  let comment = getElementByType(inspector, Ci.nsIDOMNode.COMMENT_NODE);
  await setSelectionNodeFront(comment, inspector);
  await checkClipboard("<!-- Comment -->", root);

  info("Test copy outerHTML for DOCTYPE node");
  let doctype = getElementByType(inspector, Ci.nsIDOMNode.DOCUMENT_TYPE_NODE);
  await setSelectionNodeFront(doctype, inspector);
  await checkClipboard("<!DOCTYPE html>", root);

  info("Test copy outerHTML for ELEMENT node");
  await selectAndHighlightNode("div", inspector);
  await checkClipboard("<div><p>Test copy OuterHTML</p></div>", root);
});

async function setSelectionNodeFront(node, inspector) {
  let updated = inspector.once("inspector-updated");
  inspector.selection.setNodeFront(node);
  await updated;
}

async function checkClipboard(expectedText, node) {
  try {
    await waitForClipboardPromise(() => fireCopyEvent(node), expectedText);
    ok(true, "Clipboard successfully filled with : " + expectedText);
  } catch (e) {
    ok(false, "Clipboard could not be filled with the expected text : " +
              expectedText);
  }
}

function getElementByType(inspector, type) {
  for (let [node] of inspector.markup._containers) {
    if (node.nodeType === type) {
      return node;
    }
  }
  return null;
}
