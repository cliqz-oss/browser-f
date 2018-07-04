/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/frame-script */

ChromeUtils.defineModuleGetter(this, "Logger",
  "resource://gre/modules/accessibility/Utils.jsm");
ChromeUtils.defineModuleGetter(this, "Presentation",
  "resource://gre/modules/accessibility/Presentation.jsm");
ChromeUtils.defineModuleGetter(this, "Utils",
  "resource://gre/modules/accessibility/Utils.jsm");
ChromeUtils.defineModuleGetter(this, "EventManager",
  "resource://gre/modules/accessibility/EventManager.jsm");
ChromeUtils.defineModuleGetter(this, "ContentControl",
  "resource://gre/modules/accessibility/ContentControl.jsm");
ChromeUtils.defineModuleGetter(this, "Roles",
  "resource://gre/modules/accessibility/Constants.jsm");
ChromeUtils.defineModuleGetter(this, "States",
  "resource://gre/modules/accessibility/Constants.jsm");

Logger.info("content-script.js", content.document.location);

var eventManager = null;
var contentControl = null;

function forwardToParent(aMessage) {
  // XXX: This is a silly way to make a deep copy
  let newJSON = JSON.parse(JSON.stringify(aMessage.json));
  newJSON.origin = "child";
  sendAsyncMessage(aMessage.name, newJSON);
}

function forwardToChild(aMessage, aListener, aVCPosition) {
  let acc = aVCPosition || Utils.getVirtualCursor(content.document).position;

  if (!Utils.isAliveAndVisible(acc) || acc.role != Roles.INTERNAL_FRAME) {
    return false;
  }

  Logger.debug(() => {
    return ["forwardToChild", Logger.accessibleToString(acc),
            aMessage.name, JSON.stringify(aMessage.json, null, "  ")];
  });

  let mm = Utils.getMessageManager(acc.DOMNode);

  if (aListener) {
    mm.addMessageListener(aMessage.name, aListener);
  }

  // XXX: This is a silly way to make a deep copy
  let newJSON = JSON.parse(JSON.stringify(aMessage.json));
  newJSON.origin = "parent";
  if (Utils.isContentProcess) {
    // XXX: OOP content's screen offset is 0,
    // so we remove the real screen offset here.
    newJSON.x -= content.mozInnerScreenX;
    newJSON.y -= content.mozInnerScreenY;
  }
  mm.sendAsyncMessage(aMessage.name, newJSON);
  return true;
}

function presentCaretChange(aText, aOldOffset, aNewOffset) {
  if (aOldOffset !== aNewOffset) {
    let msg = Presentation.textSelectionChanged(aText, aNewOffset, aNewOffset,
                                                aOldOffset, aOldOffset, true);
    sendAsyncMessage("AccessFu:Present", msg);
  }
}

function scroll(aMessage) {
  let position = Utils.getVirtualCursor(content.document).position;
  if (!forwardToChild(aMessage, scroll, position)) {
    sendAsyncMessage("AccessFu:DoScroll",
                     { bounds: Utils.getBounds(position),
                       page: aMessage.json.page,
                       horizontal: aMessage.json.horizontal });
  }
}

addMessageListener(
  "AccessFu:Start",
  function(m) {
    if (m.json.logLevel) {
      Logger.logLevel = Logger[m.json.logLevel];
    }

    Logger.debug("AccessFu:Start");
    if (m.json.buildApp)
      Utils.MozBuildApp = m.json.buildApp;

    addMessageListener("AccessFu:Scroll", scroll);

    if (!contentControl) {
      contentControl = new ContentControl(this);
    }
    contentControl.start();

    if (!eventManager) {
      eventManager = new EventManager(this, contentControl);
    }
    eventManager.inTest = m.json.inTest;
    eventManager.start();

    function contentStarted() {
      let accDoc = Utils.AccService.getAccessibleFor(content.document);
      if (accDoc && !Utils.getState(accDoc).contains(States.BUSY)) {
        sendAsyncMessage("AccessFu:ContentStarted");
      } else {
        content.setTimeout(contentStarted, 0);
      }
    }

    if (m.json.inTest) {
      // During a test we want to wait for the document to finish loading for
      // consistency.
      contentStarted();
    }
  });

addMessageListener(
  "AccessFu:Stop",
  function(m) {
    Logger.debug("AccessFu:Stop");

    removeMessageListener("AccessFu:Scroll", scroll);

    eventManager.stop();
    contentControl.stop();
  });

sendAsyncMessage("AccessFu:Ready");
