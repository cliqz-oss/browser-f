/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{

ChromeUtils.import("resource://gre/modules/Services.jsm");

const gXULDOMParser = new DOMParser();
gXULDOMParser.forceEnableXULXBL();

class MozXULElement extends XULElement {
  /**
   * Allows eager deterministic construction of XUL elements with XBL attached, by
   * parsing an element tree and returning a DOM fragment to be inserted in the
   * document before any of the inner elements is referenced by JavaScript.
   *
   * This process is required instead of calling the createElement method directly
   * because bindings get attached when:
   *
   * 1) the node gets a layout frame constructed, or
   * 2) the node gets its JavaScript reflector created, if it's in the document,
   *
   * whichever happens first. The createElement method would return a JavaScript
   * reflector, but the element wouldn't be in the document, so the node wouldn't
   * get XBL attached. After that point, even if the node is inserted into a
   * document, it won't get XBL attached until either the frame is constructed or
   * the reflector is garbage collected and the element is touched again.
   *
   * @param str
   *        String with the XML representation of XUL elements.
   *
   * @return DocumentFragment containing the corresponding element tree, including
   *         element nodes but excluding any text node.
   */
  static parseXULToFragment(str) {
    let doc = gXULDOMParser.parseFromString(`
      <box xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
        ${str}
      </box>
    `, "application/xml");
    // The XUL/XBL parser is set to ignore all-whitespace nodes, whereas (X)HTML
    // does not do this. Most XUL code assumes that the whitespace has been
    // stripped out, so we simply remove all text nodes after using the parser.
    let nodeIterator = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT);
    let currentNode = nodeIterator.nextNode();
    while (currentNode) {
      currentNode.remove();
      currentNode = nodeIterator.nextNode();
    }
    // We use a range here so that we don't access the inner DOM elements from
    // JavaScript before they are imported and inserted into a document.
    let range = doc.createRange();
    range.selectNodeContents(doc.firstChild);
    return range.extractContents();
  }
}

// Attach the base class to the window so other scripts can use it:
window.MozXULElement = MozXULElement;

for (let script of [
  "chrome://global/content/elements/stringbundle.js",
  "chrome://global/content/elements/general.js",
]) {
  Services.scriptloader.loadSubScript(script, window);
}

}
