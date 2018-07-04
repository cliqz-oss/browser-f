/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
ChromeUtils.import("resource://gre/modules/NetUtil.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

function loadChromeScripts(win) {
  Services.scriptloader.loadSubScript("chrome://mochikit/content/chrome-harness.js", win);
  Services.scriptloader.loadSubScript("chrome://mochikit/content/mochitest-e10s-utils.js", win);
  Services.scriptloader.loadSubScript("chrome://mochikit/content/browser-test.js", win);
}

// ///// Android ///////

Cu.importGlobalProperties(["TextDecoder"]);

const windowTracker = {
  init() {
    Services.obs.addObserver(this, "chrome-document-global-created");
  },

  async observe(window, topic, data) {
    if (topic === "chrome-document-global-created") {
      await new Promise(resolve =>
        window.addEventListener("DOMContentLoaded", resolve, {once: true}));

      let {document} = window;
      let {documentURI} = document;

      if (documentURI !== "chrome://browser/content/browser.xul") {
        return;
      }
      loadChromeScripts(window);
    }
  },
};

function androidStartup(data, reason) {
  // Only browser chrome tests need help starting.
  let testRoot = Services.prefs.getStringPref("mochitest.testRoot", "");
  if (testRoot.endsWith("/chrome")) {
    windowTracker.init();
  }
}

// ///// Desktop ///////

var WindowListener = {
  // browser-test.js is only loaded into the first window. Setup that
  // needs to happen in all navigator:browser windows should go here.
  setupWindow(win) {
    win.nativeConsole = win.console;
    ChromeUtils.defineModuleGetter(win, "console",
      "resource://gre/modules/Console.jsm");
  },

  tearDownWindow(win) {
    if (win.nativeConsole) {
      win.console = win.nativeConsole;
      win.nativeConsole = undefined;
    }
  },

  onOpenWindow(win) {
    win = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);

    win.addEventListener("load", function() {
      if (win.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
        WindowListener.setupWindow(win);
      }
    }, {once: true});
  }
};

function loadMochitest(e) {
  let flavor = e.detail[0];
  let url = e.detail[1];

  let win = Services.wm.getMostRecentWindow("navigator:browser");
  win.removeEventListener("mochitest-load", loadMochitest);

  // for mochitest-plain, navigating to the url is all we need
  win.loadURI(url);
  if (flavor == "mochitest") {
    return;
  }

  WindowListener.setupWindow(win);
  Services.wm.addListener(WindowListener);

  loadChromeScripts(win);
}

function startup(data, reason) {
  if (AppConstants.platform == "android") {
    androidStartup(data, reason);
  } else {
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    // wait for event fired from start_desktop.js containing the
    // suite and url to load
    win.addEventListener("mochitest-load", loadMochitest);
  }
}

function shutdown(data, reason) {
  if (AppConstants.platform != "android") {
    let windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
      WindowListener.tearDownWindow(win);
    }

    Services.wm.removeListener(WindowListener);
  }
}

function install(data, reason) {}
function uninstall(data, reason) {}

