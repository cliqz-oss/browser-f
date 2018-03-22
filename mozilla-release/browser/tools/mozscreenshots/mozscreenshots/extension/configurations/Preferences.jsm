/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["Preferences"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://testing-common/TestUtils.jsm");
Cu.import("resource://testing-common/ContentTask.jsm");

this.Preferences = {

  init(libDir) {
    let panes = [
      ["paneGeneral"],
      ["paneGeneral", browsingGroup],
      ["paneGeneral", connectionDialog],
      ["paneSearch"],
      ["panePrivacy"],
      ["panePrivacy", cacheGroup],
      ["panePrivacy", clearRecentHistoryDialog],
      ["panePrivacy", certManager],
      ["panePrivacy", deviceManager],
      ["panePrivacy", DNTDialog],
      ["paneConnect"],
      ["paneSync"],
    ];

    for (let [primary, customFn] of panes) {
      let configName = primary.replace(/^pane/, "prefs");
      if (customFn) {
        configName += "-" + customFn.name;
      }
      this.configurations[configName] = {};
      this.configurations[configName].selectors = ["#browser"];
      if (primary == "panePrivacy" && customFn) {
        this.configurations[configName].applyConfig = async () => {
          return {todo: `${configName} times out on the try server`};
        };
      } else {
        this.configurations[configName].applyConfig = prefHelper.bind(null, primary, customFn);
      }
    }
  },

  configurations: {},
};

let prefHelper = async function(primary, customFn = null) {
  let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
  let selectedBrowser = browserWindow.gBrowser.selectedBrowser;

  // close any dialog that might still be open
  await ContentTask.spawn(selectedBrowser, null, async function() {
    // Check that gSubDialog is defined on the content window
    // and that there is an open dialog to close
    if (!content.window.gSubDialog || !content.window.gSubDialog._topDialog) {
      return;
    }
    content.window.gSubDialog.close();
  });

  let readyPromise = null;
  if (selectedBrowser.currentURI.specIgnoringRef == "about:preferences") {
    if (selectedBrowser.currentURI.spec == "about:preferences#" + primary.replace(/^pane/, "")) {
      // We're already on the correct pane.
      readyPromise = Promise.resolve();
    } else {
      readyPromise = paintPromise(browserWindow);
    }
  } else {
    readyPromise = TestUtils.topicObserved("sync-pane-loaded");
  }

  browserWindow.openPreferences(primary, {origin: "mozscreenshots"});

  await readyPromise;

  if (customFn) {
    let customPaintPromise = paintPromise(browserWindow);
    let result = await customFn(selectedBrowser);
    await customPaintPromise;
    return result;
  }
  return undefined;
};

function paintPromise(browserWindow) {
  return new Promise((resolve) => {
    browserWindow.addEventListener("MozAfterPaint", function() {
      resolve();
    }, {once: true});
  });
}

async function browsingGroup(aBrowser) {
  await ContentTask.spawn(aBrowser, null, async function() {
    content.document.getElementById("browsingGroup").scrollIntoView();
  });
}

async function cacheGroup(aBrowser) {
  await ContentTask.spawn(aBrowser, null, async function() {
    content.document.getElementById("cacheGroup").scrollIntoView();
  });
}

async function DNTDialog(aBrowser) {
  return ContentTask.spawn(aBrowser, null, async function() {
    const button = content.document.getElementById("doNotTrackSettings");
    if (!button) {
      return {todo: "The dialog may have exited before we could click the button"};
    }
    button.click();
    return undefined;
  });
}

async function connectionDialog(aBrowser) {
  await ContentTask.spawn(aBrowser, null, async function() {
    content.document.getElementById("connectionSettings").click();
  });
}

async function clearRecentHistoryDialog(aBrowser) {
  await ContentTask.spawn(aBrowser, null, async function() {
    content.document.getElementById("historyRememberClear").click();
  });
}

async function certManager(aBrowser) {
  await ContentTask.spawn(aBrowser, null, async function() {
    content.document.getElementById("viewCertificatesButton").click();
  });
}

async function deviceManager(aBrowser) {
  await ContentTask.spawn(aBrowser, null, async function() {
    content.document.getElementById("viewSecurityDevicesButton").click();
  });
}
