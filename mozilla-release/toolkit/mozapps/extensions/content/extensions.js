/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* import-globals-from ../../../content/customElements.js */
/* import-globals-from ../../../content/contentAreaUtils.js */
/* import-globals-from aboutaddonsCommon.js */
/* globals ProcessingInstruction */
/* exported loadView */

const { DeferredTask } = ChromeUtils.import(
  "resource://gre/modules/DeferredTask.jsm"
);
const { AddonManager } = ChromeUtils.import(
  "resource://gre/modules/AddonManager.jsm"
);
const { AddonRepository } = ChromeUtils.import(
  "resource://gre/modules/addons/AddonRepository.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "AMTelemetry",
  "resource://gre/modules/AddonManager.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "ClientID",
  "resource://gre/modules/ClientID.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm"
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "XPINSTALL_ENABLED",
  "xpinstall.enabled",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "useHtmlDiscover",
  "extensions.htmlaboutaddons.discover.enabled"
);

const PREF_DISCOVERURL = "extensions.webservice.discoverURL";
const PREF_DISCOVER_ENABLED = "extensions.getAddons.showPane";
const PREF_GETADDONS_CACHE_ENABLED = "extensions.getAddons.cache.enabled";
const PREF_GETADDONS_CACHE_ID_ENABLED =
  "extensions.%ID%.getAddons.cache.enabled";
const PREF_UI_TYPE_HIDDEN = "extensions.ui.%TYPE%.hidden";
const PREF_UI_LASTCATEGORY = "extensions.ui.lastCategory";

const RECOMMENDED_ADDONS = {
  "firefox@ghostery.com": {
    "id": "firefox@ghostery.com",
    "icons": {
      "64": "https://s3.amazonaws.com/cdn.cliqz.com/browser-f/features/firefox%40ghostery.com/64x64.png",
    },
    "name": "Ghostery",
    "homepageURL": "https://www.ghostery.com",
  },
  "support@lastpass.com": {
    "id": "support@lastpass.com",
    "icons": {
      "64": "https://s3.amazonaws.com/cdn.cliqz.com/browser-f/features/support%40lastpass.com/64x64.png",
    },
    "name": "LastPass",
    "homepageURL": "https://lastpass.com",
  },
  "{446900e4-71c2-419f-a6a7-df9c091e268b}": {
    "id": "{446900e4-71c2-419f-a6a7-df9c091e268b}",
    "icons": {
      "64": "https://s3.amazonaws.com/cdn.cliqz.com/browser-f/features/%7B446900e4-71c2-419f-a6a7-df9c091e268b%7D/64x64.png",
    },
    "name": "Bitwarden",
    "homepageURL": "https://bitwarden.com",
  }
};

var gViewDefault = "addons://list/extension";

var gStrings = {};
XPCOMUtils.defineLazyServiceGetter(
  gStrings,
  "bundleSvc",
  "@mozilla.org/intl/stringbundle;1",
  "nsIStringBundleService"
);

XPCOMUtils.defineLazyGetter(gStrings, "brand", function() {
  return this.bundleSvc.createBundle(
    "chrome://branding/locale/brand.properties"
  );
});
XPCOMUtils.defineLazyGetter(gStrings, "ext", function() {
  return this.bundleSvc.createBundle(
    "chrome://mozapps/locale/extensions/extensions.properties"
  );
});
XPCOMUtils.defineLazyGetter(gStrings, "browser", function() {
  return this.bundleSvc.createBundle("chrome://browser/locale/browser.properties");
});
XPCOMUtils.defineLazyGetter(gStrings, "dl", function() {
  return this.bundleSvc.createBundle(
    "chrome://mozapps/locale/downloads/downloads.properties"
  );
});

XPCOMUtils.defineLazyGetter(gStrings, "brandShortName", function() {
  return this.brand.GetStringFromName("brandShortName");
});
XPCOMUtils.defineLazyGetter(gStrings, "appVersion", function() {
  return Services.appinfo.version;
});

document.addEventListener("load", initialize, true);
window.addEventListener("unload", shutdown);

var gPendingInitializations = 1;
Object.defineProperty(this, "gIsInitializing", {
  get: () => gPendingInitializations > 0,
});

function initialize(event) {
  // XXXbz this listener gets _all_ load events for all nodes in the
  // document... but relies on not being called "too early".
  if (event.target instanceof ProcessingInstruction) {
    return;
  }
  document.removeEventListener("load", initialize, true);

  let contentAreaContextMenu = document.getElementById(
    "contentAreaContextMenu"
  );
  contentAreaContextMenu.addEventListener("popupshowing", function(event) {
    Cu.reportError("This dummy menupopup is not supposed to be shown");
    return false;
  });

  let globalCommandSet = document.getElementById("globalCommandSet");
  globalCommandSet.addEventListener("command", function(event) {
    gViewController.doCommand(event.target.id);
  });

  let addonPage = document.getElementById("addons-page");
  addonPage.addEventListener("dragenter", function(event) {
    gDragDrop.onDragOver(event);
  });
  addonPage.addEventListener("dragover", function(event) {
    gDragDrop.onDragOver(event);
  });
  addonPage.addEventListener("drop", function(event) {
    gDragDrop.onDrop(event);
  });
  addonPage.addEventListener("keypress", function(event) {
    gHeader.onKeyPress(event);
  });
  if (!isDiscoverEnabled()) {
    gViewDefault = "addons://list/extension";
  }

  let helpButton = document.getElementById("helpButton");
  let helpUrl =
    Services.urlFormatter.formatURLPref("app.support.baseURL") + "addons-help";
  helpButton.setAttribute("href", helpUrl);
  helpButton.addEventListener("click", () => recordLinkTelemetry("support"));

  document.getElementById("preferencesButton").addEventListener("click", () => {
    let mainWindow = window.windowRoot.ownerGlobal;
    recordLinkTelemetry("about:preferences");
    if ("switchToTabHavingURI" in mainWindow) {
      mainWindow.switchToTabHavingURI("about:preferences", true, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
  });

  let categories = document.getElementById("categories");
  document.addEventListener("keydown", () => {
    categories.setAttribute("keyboard-navigation", "true");
  });
  categories.addEventListener("mousedown", () => {
    categories.removeAttribute("keyboard-navigation");
  });

  gViewController.initialize();
  gCategories.initialize();
  gHeader.initialize();
  gEventManager.initialize();
  Services.obs.addObserver(sendEMPong, "EM-ping");
  Services.obs.notifyObservers(window, "EM-loaded");

  if (!XPINSTALL_ENABLED) {
    document.getElementById("cmd_installFromFile").hidden = true;
  }

  // If the initial view has already been selected (by a call to loadView from
  // the above notifications) then bail out now
  if (gViewController.initialViewSelected) {
    return;
  }

  // If there is a history state to restore then use that
  if (window.history.state) {
    gViewController.updateState(window.history.state);
    return;
  }

  // Default to the last selected category
  var view = gCategories.node.value;

  // Allow passing in a view through the window arguments
  if (
    "arguments" in window &&
    window.arguments.length > 0 &&
    window.arguments[0] !== null &&
    "view" in window.arguments[0]
  ) {
    view = window.arguments[0].view;
  }

  gViewController.loadInitialView(view);
}

function notifyInitialized() {
  if (!gIsInitializing) {
    return;
  }

  gPendingInitializations--;
  if (!gIsInitializing) {
    var event = document.createEvent("Events");
    event.initEvent("Initialized", true, true);
    document.dispatchEvent(event);
  }
}

function shutdown() {
  gCategories.shutdown();
  gEventManager.shutdown();
  gViewController.shutdown();
  Services.obs.removeObserver(sendEMPong, "EM-ping");
}

function sendEMPong(aSubject, aTopic, aData) {
  Services.obs.notifyObservers(window, "EM-pong");
}

function recordLinkTelemetry(target) {
  let extra = { view: getCurrentViewName() };
  if (target == "search") {
    let searchBar = document.getElementById("header-search");
    extra.type = searchBar.getAttribute("data-addon-type");
  }
  AMTelemetry.recordLinkEvent({ object: "aboutAddons", value: target, extra });
}

function recordActionTelemetry({ action, value, view, addon }) {
  view = view || getCurrentViewName();
  AMTelemetry.recordActionEvent({
    // The max-length for an object is 20, which it enough to be unique.
    object: "aboutAddons",
    value,
    view,
    action,
    addon,
  });
}

async function recordViewTelemetry(param) {
  let type;
  let addon;

  if (
    param in AddonManager.addonTypes ||
    ["recent", "available"].includes(param)
  ) {
    type = param;
  } else if (param) {
    let id = param.replace("/preferences", "");
    addon = await AddonManager.getAddonByID(id);
  }

  AMTelemetry.recordViewEvent({ view: getCurrentViewName(), addon, type });
}

function recordSetUpdatePolicyTelemetry() {
  // Record telemetry for changing the update policy.
  let updatePolicy = [];
  if (AddonManager.autoUpdateDefault) {
    updatePolicy.push("default");
  }
  if (AddonManager.updateEnabled) {
    updatePolicy.push("enabled");
  }
  recordActionTelemetry({
    action: "setUpdatePolicy",
    value: updatePolicy.join(","),
  });
}

function getCurrentViewName() {
  let view = gViewController.currentViewObj;
  let entries = Object.entries(gViewController.viewObjects);
  let viewIndex = entries.findIndex(([name, viewObj]) => {
    return viewObj == view;
  });
  if (viewIndex != -1) {
    return entries[viewIndex][0];
  }
  return "other";
}

// Used by external callers to load a specific view into the manager
function loadView(aViewId) {
  if (!gViewController.initialViewSelected) {
    // The caller opened the window and immediately loaded the view so it
    // should be the initial history entry

    gViewController.loadInitialView(aViewId);
  } else {
    gViewController.loadView(aViewId);
  }
}

function isDiscoverEnabled() {
  if (
    Services.prefs.getPrefType(PREF_DISCOVERURL) == Services.prefs.PREF_INVALID
  ) {
    return false;
  }

  try {
    if (!Services.prefs.getBoolPref(PREF_DISCOVER_ENABLED)) {
      return false;
    }
  } catch (e) {}

  if (!XPINSTALL_ENABLED) {
    return false;
  }

  return true;
}

function setSearchLabel(type) {
  let searchLabel = document.getElementById("search-label");
  document
    .getElementById("header-search")
    .setAttribute("data-addon-type", type);
  let keyMap = {
    extension: "extension",
    shortcuts: "extension",
    theme: "theme",
  };
  if (type in keyMap) {
    searchLabel.textContent = gStrings.ext.GetStringFromName(
      `searchLabel.${keyMap[type]}`
    );
    searchLabel.hidden = false;
  } else {
    searchLabel.textContent = "";
    searchLabel.hidden = true;
  }
}

/**
 * A wrapper around the HTML5 session history service that allows the browser
 * back/forward controls to work within the manager
 */
var HTML5History = {
  get index() {
    return window.docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory
      .index;
  },

  get canGoBack() {
    return window.docShell.QueryInterface(Ci.nsIWebNavigation).canGoBack;
  },

  get canGoForward() {
    return window.docShell.QueryInterface(Ci.nsIWebNavigation).canGoForward;
  },

  back() {
    window.history.back();
    gViewController.updateCommand("cmd_back");
    gViewController.updateCommand("cmd_forward");
  },

  forward() {
    window.history.forward();
    gViewController.updateCommand("cmd_back");
    gViewController.updateCommand("cmd_forward");
  },

  pushState(aState) {
    window.history.pushState(aState, document.title);
  },

  replaceState(aState) {
    window.history.replaceState(aState, document.title);
  },

  popState() {
    function onStatePopped(aEvent) {
      window.removeEventListener("popstate", onStatePopped, true);
      // TODO To ensure we can't go forward again we put an additional entry
      // for the current state into the history. Ideally we would just strip
      // the history but there doesn't seem to be a way to do that. Bug 590661
      window.history.pushState(aEvent.state, document.title);
    }
    window.addEventListener("popstate", onStatePopped, true);
    window.history.back();
    gViewController.updateCommand("cmd_back");
    gViewController.updateCommand("cmd_forward");
  },
};

/**
 * A wrapper around a fake history service
 */
var FakeHistory = {
  pos: 0,
  states: [null],

  get index() {
    return this.pos;
  },

  get canGoBack() {
    return this.pos > 0;
  },

  get canGoForward() {
    return this.pos + 1 < this.states.length;
  },

  back() {
    if (this.pos == 0) {
      throw Components.Exception("Cannot go back from this point");
    }

    this.pos--;
    gViewController.updateState(this.states[this.pos]);
    gViewController.updateCommand("cmd_back");
    gViewController.updateCommand("cmd_forward");
  },

  forward() {
    if (this.pos + 1 >= this.states.length) {
      throw Components.Exception("Cannot go forward from this point");
    }

    this.pos++;
    gViewController.updateState(this.states[this.pos]);
    gViewController.updateCommand("cmd_back");
    gViewController.updateCommand("cmd_forward");
  },

  pushState(aState) {
    this.pos++;
    this.states.splice(this.pos, this.states.length);
    this.states.push(aState);
  },

  replaceState(aState) {
    this.states[this.pos] = aState;
  },

  popState() {
    if (this.pos == 0) {
      throw Components.Exception("Cannot popState from this view");
    }

    this.states.splice(this.pos, this.states.length);
    this.pos--;

    gViewController.updateState(this.states[this.pos]);
    gViewController.updateCommand("cmd_back");
    gViewController.updateCommand("cmd_forward");
  },
};

// If the window has a session history then use the HTML5 History wrapper
// otherwise use our fake history implementation
if (window.docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory) {
  var gHistory = HTML5History;
} else {
  gHistory = FakeHistory;
}

var gEventManager = {
  _listeners: {},
  _installListeners: new Set(),

  initialize() {
    const ADDON_EVENTS = [
      "onEnabling",
      "onEnabled",
      "onDisabling",
      "onDisabled",
      "onUninstalling",
      "onUninstalled",
      "onInstalled",
      "onOperationCancelled",
      "onUpdateAvailable",
      "onUpdateFinished",
      "onCompatibilityUpdateAvailable",
      "onPropertyChanged",
    ];
    for (let evt of ADDON_EVENTS) {
      let event = evt;
      this[event] = (...aArgs) => this.delegateAddonEvent(event, aArgs);
    }

    const INSTALL_EVENTS = [
      "onNewInstall",
      "onDownloadStarted",
      "onDownloadEnded",
      "onDownloadFailed",
      "onDownloadProgress",
      "onDownloadCancelled",
      "onInstallStarted",
      "onInstallEnded",
      "onInstallFailed",
      "onInstallCancelled",
      "onExternalInstall",
    ];
    for (let evt of INSTALL_EVENTS) {
      let event = evt;
      this[event] = (...aArgs) => this.delegateInstallEvent(event, aArgs);
    }

    AddonManager.addManagerListener(this);
    AddonManager.addInstallListener(this);
    AddonManager.addAddonListener(this);

    this.refreshGlobalWarning();
    this.refreshAutoUpdateDefault();
  },

  shutdown() {
    AddonManager.removeManagerListener(this);
    AddonManager.removeInstallListener(this);
    AddonManager.removeAddonListener(this);
  },

  registerAddonListener(aListener, aAddonId) {
    if (!(aAddonId in this._listeners)) {
      this._listeners[aAddonId] = new Set();
    }
    this._listeners[aAddonId].add(aListener);
  },

  unregisterAddonListener(aListener, aAddonId) {
    if (!(aAddonId in this._listeners)) {
      return;
    }
    this._listeners[aAddonId].delete(aListener);
  },

  registerInstallListener(aListener) {
    this._installListeners.add(aListener);
  },

  unregisterInstallListener(aListener) {
    this._installListeners.delete(aListener);
  },

  delegateAddonEvent(aEvent, aParams) {
    var addon = aParams.shift();
    if (!(addon.id in this._listeners)) {
      return;
    }

    function tryListener(listener) {
      if (!(aEvent in listener)) {
        return;
      }
      try {
        listener[aEvent].apply(listener, aParams);
      } catch (e) {
        // this shouldn't be fatal
        Cu.reportError(e);
      }
    }

    for (let listener of this._listeners[addon.id]) {
      tryListener(listener);
    }
    // CLIQZ-SPECIAL: prevent error due to legacy addon handlers
    if(!this._listeners["ANY"]) return;

    // eslint-disable-next-line dot-notation
    for (let listener of this._listeners["ANY"]) {
      tryListener(listener);
    }
  },

  delegateInstallEvent(aEvent, aParams) {
    var existingAddon =
      aEvent == "onExternalInstall" ? aParams[1] : aParams[0].existingAddon;
    // If the install is an update then send the event to all listeners
    // registered for the existing add-on
    if (existingAddon) {
      this.delegateAddonEvent(aEvent, [existingAddon].concat(aParams));
    }

    for (let listener of this._installListeners) {
      if (!(aEvent in listener)) {
        continue;
      }
      try {
        listener[aEvent].apply(listener, aParams);
      } catch (e) {
        // this shouldn't be fatal
        Cu.reportError(e);
      }
    }
  },

  refreshGlobalWarning() {
    var page = document.getElementById("addons-page");

    if (Services.appinfo.inSafeMode) {
      page.setAttribute("warning", "safemode");
      return;
    }

    if (
      AddonManager.checkUpdateSecurityDefault &&
      !AddonManager.checkUpdateSecurity
    ) {
      page.setAttribute("warning", "updatesecurity");
      return;
    }

    if (!AddonManager.checkCompatibility) {
      page.setAttribute("warning", "checkcompatibility");
      return;
    }

    page.removeAttribute("warning");
  },

  refreshAutoUpdateDefault() {
    var updateEnabled = AddonManager.updateEnabled;
    var autoUpdateDefault = AddonManager.autoUpdateDefault;

    // The checkbox needs to reflect that both prefs need to be true
    // for updates to be checked for and applied automatically
    document
      .getElementById("utils-autoUpdateDefault")
      .setAttribute("checked", updateEnabled && autoUpdateDefault);

    document.getElementById(
      "utils-resetAddonUpdatesToAutomatic"
    ).hidden = !autoUpdateDefault;
    document.getElementById(
      "utils-resetAddonUpdatesToManual"
    ).hidden = autoUpdateDefault;
  },

  onCompatibilityModeChanged() {
    this.refreshGlobalWarning();
  },

  onCheckUpdateSecurityChanged() {
    this.refreshGlobalWarning();
  },

  onUpdateModeChanged() {
    this.refreshAutoUpdateDefault();
  },
};

var gViewController = {
  viewPort: null,
  currentViewId: "",
  currentViewObj: null,
  currentViewRequest: 0,
  // All historyEntryId values must be unique within one session, because the
  // IDs are used to map history entries to page state. It is not possible to
  // see whether a historyEntryId was used in history entries before this page
  // was loaded, so start counting from a random value to avoid collisions.
  nextHistoryEntryId: Math.floor(Math.random() * 2 ** 32),
  viewObjects: {},
  viewChangeCallback: null,
  initialViewSelected: false,
  lastHistoryIndex: -1,
  backButton: null,

  initialize() {
    this.viewPort = document.getElementById("view-port");
    this.headeredViews = document.getElementById("headered-views");
    this.headeredViewsDeck = document.getElementById("headered-views-content");
    this.backButton = document.getElementById("go-back");

    this.viewObjects.shortcuts = gShortcutsView;

    this.viewObjects.list = htmlView("list");
    this.viewObjects.detail = htmlView("detail");
    this.viewObjects.updates = htmlView("updates");
    // gUpdatesView still handles when the Available Updates category is
    // shown. Include it in viewObjects so it gets initialized and shutdown.
    this.viewObjects._availableUpdatesSidebar = gUpdatesView;

    if (useHtmlDiscover && isDiscoverEnabled()) {
      this.viewObjects.discover = htmlView("discover");
    } else {
      this.viewObjects.discover = gDiscoverView;
    }

    for (let type in this.viewObjects) {
      let view = this.viewObjects[type];
      view.initialize();
    }

    window.controllers.appendController(this);

    window.addEventListener("popstate", function(e) {
      gViewController.updateState(e.state);
    });
  },

  shutdown() {
    if (this.currentViewObj) {
      this.currentViewObj.hide();
    }
    this.currentViewRequest = 0;

    for (let type in this.viewObjects) {
      let view = this.viewObjects[type];
      if ("shutdown" in view) {
        try {
          view.shutdown();
        } catch (e) {
          // this shouldn't be fatal
          Cu.reportError(e);
        }
      }
    }

    window.controllers.removeController(this);
  },

  updateState(state) {
    try {
      this.loadViewInternal(state.view, state.previousView, state);
      this.lastHistoryIndex = gHistory.index;
    } catch (e) {
      // The attempt to load the view failed, try moving further along history
      if (this.lastHistoryIndex > gHistory.index) {
        if (gHistory.canGoBack) {
          gHistory.back();
        } else {
          gViewController.replaceView(gViewDefault);
        }
      } else if (gHistory.canGoForward) {
        gHistory.forward();
      } else {
        gViewController.replaceView(gViewDefault);
      }
    }
  },

  parseViewId(aViewId) {
    var matchRegex = /^addons:\/\/([^\/]+)\/(.*)$/;
    var [, viewType, viewParam] = aViewId.match(matchRegex) || [];
    return { type: viewType, param: decodeURIComponent(viewParam) };
  },

  get isLoading() {
    return (
      !this.currentViewObj || this.currentViewObj.node.hasAttribute("loading")
    );
  },

  loadView(aViewId, sourceEvent) {
    var isRefresh = false;
    if (aViewId == this.currentViewId) {
      if (this.isLoading) {
        return;
      }
      if (!("refresh" in this.currentViewObj)) {
        return;
      }
      if (!this.currentViewObj.canRefresh()) {
        return;
      }
      isRefresh = true;
    }

    let isKeyboardNavigation =
      sourceEvent &&
      sourceEvent.mozInputSource === MouseEvent.MOZ_SOURCE_KEYBOARD;
    var state = {
      view: aViewId,
      previousView: this.currentViewId,
      historyEntryId: ++this.nextHistoryEntryId,
      isKeyboardNavigation,
    };
    if (!isRefresh) {
      gHistory.pushState(state);
      this.lastHistoryIndex = gHistory.index;
    }
    this.loadViewInternal(aViewId, this.currentViewId, state);
  },

  // Replaces the existing view with a new one, rewriting the current history
  // entry to match.
  replaceView(aViewId) {
    if (aViewId == this.currentViewId) {
      return;
    }

    var state = {
      view: aViewId,
      previousView: null,
      historyEntryId: ++this.nextHistoryEntryId,
    };
    gHistory.replaceState(state);
    this.loadViewInternal(aViewId, null, state);
  },

  loadInitialView(aViewId) {
    var state = {
      view: aViewId,
      previousView: null,
      historyEntryId: ++this.nextHistoryEntryId,
    };
    gHistory.replaceState(state);

    this.loadViewInternal(aViewId, null, state);
    notifyInitialized();
  },

  get displayedView() {
    if (this.viewPort.selectedPanel == this.headeredViews) {
      return this.headeredViewsDeck.selectedPanel;
    }
    return this.viewPort.selectedPanel;
  },

  set displayedView(view) {
    let node = view.node;
    if (node.parentNode == this.headeredViewsDeck) {
      this.headeredViewsDeck.selectedPanel = node;
      this.viewPort.selectedPanel = this.headeredViews;
    } else {
      this.viewPort.selectedPanel = node;
    }
  },

  loadViewInternal(aViewId, aPreviousView, aState, aEvent) {
    var view = this.parseViewId(aViewId);

    if (!view.type || !(view.type in this.viewObjects)) {
      throw Components.Exception("Invalid view: " + view.type);
    }

    var viewObj = this.viewObjects[view.type];
    if (!viewObj.node) {
      throw Components.Exception(
        "Root node doesn't exist for '" + view.type + "' view"
      );
    }

    if (this.currentViewObj && aViewId != aPreviousView) {
      try {
        let canHide = this.currentViewObj.hide();
        if (canHide === false) {
          return;
        }
        this.displayedView.removeAttribute("loading");
      } catch (e) {
        // this shouldn't be fatal
        Cu.reportError(e);
      }
    }

    gCategories.select(aViewId, aPreviousView);

    this.currentViewId = aViewId;
    this.currentViewObj = viewObj;

    this.displayedView = this.currentViewObj;
    this.currentViewObj.node.setAttribute("loading", "true");

    recordViewTelemetry(view.param);

    let headingName = document.getElementById("heading-name");
    let headingLabel;
    if (view.type == "discover") {
      headingLabel = gStrings.ext.formatStringFromName("listHeading.discover", [
        gStrings.brandShortName,
      ]);
    } else {
      try {
        headingLabel = gStrings.ext.GetStringFromName(
          `listHeading.${view.param}`
        );
      } catch (e) {
        // Some views don't have a label, like the updates view.
        headingLabel = "";
      }
    }
    headingName.textContent = headingLabel;
    setSearchLabel(view.param);

    if (aViewId == aPreviousView) {
      this.currentViewObj.refresh(
        view.param,
        ++this.currentViewRequest,
        aState
      );
    } else {
      this.currentViewObj.show(view.param, ++this.currentViewRequest, aState);
    }

    this.backButton.hidden = this.currentViewObj.isRoot || !gHistory.canGoBack;

    this.initialViewSelected = true;
  },

  // Moves back in the document history and removes the current history entry
  popState(aCallback) {
    this.viewChangeCallback = aCallback;
    gHistory.popState();
  },

  notifyViewChanged() {
    this.displayedView.removeAttribute("loading");

    if (this.viewChangeCallback) {
      this.viewChangeCallback();
      this.viewChangeCallback = null;
    }

    var event = document.createEvent("Events");
    event.initEvent("ViewChanged", true, true);
    this.currentViewObj.node.dispatchEvent(event);
  },

  commands: {
    cmd_back: {
      isEnabled() {
        return gHistory.canGoBack;
      },
      doCommand() {
        gHistory.back();
      },
    },

    cmd_forward: {
      isEnabled() {
        return gHistory.canGoForward;
      },
      doCommand() {
        gHistory.forward();
      },
    },

    cmd_focusSearch: {
      isEnabled: () => true,
      doCommand() {
        gHeader.focusSearchBox();
      },
    },

    cmd_enableCheckCompatibility: {
      isEnabled() {
        return true;
      },
      doCommand() {
        AddonManager.checkCompatibility = true;
      },
    },

    cmd_enableUpdateSecurity: {
      isEnabled() {
        return true;
      },
      doCommand() {
        AddonManager.checkUpdateSecurity = true;
      },
    },

    cmd_toggleAutoUpdateDefault: {
      isEnabled() {
        return true;
      },
      doCommand() {
        if (!AddonManager.updateEnabled || !AddonManager.autoUpdateDefault) {
          // One or both of the prefs is false, i.e. the checkbox is not checked.
          // Now toggle both to true. If the user wants us to auto-update
          // add-ons, we also need to auto-check for updates.
          AddonManager.updateEnabled = true;
          AddonManager.autoUpdateDefault = true;
        } else {
          // Both prefs are true, i.e. the checkbox is checked.
          // Toggle the auto pref to false, but don't touch the enabled check.
          AddonManager.autoUpdateDefault = false;
        }

        recordSetUpdatePolicyTelemetry();
      },
    },

    cmd_resetAddonAutoUpdate: {
      isEnabled() {
        return true;
      },
      async doCommand() {
        let aAddonList = await AddonManager.getAllAddons();
        for (let addon of aAddonList) {
          if ("applyBackgroundUpdates" in addon) {
            addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DEFAULT;
          }
        }
        recordActionTelemetry({ action: "resetUpdatePolicy" });
      },
    },

    cmd_goToDiscoverPane: {
      isEnabled() {
        return gDiscoverView.enabled;
      },
      doCommand() {
        gViewController.loadView("addons://discover/");
      },
    },

    cmd_goToRecentUpdates: {
      isEnabled() {
        return true;
      },
      doCommand() {
        gViewController.loadView("addons://updates/recent");
      },
    },

    cmd_goToAvailableUpdates: {
      isEnabled() {
        return true;
      },
      doCommand() {
        gViewController.loadView("addons://updates/available");
      },
    },

    cmd_findAllUpdates: {
      inProgress: false,
      isEnabled() {
        return !this.inProgress;
      },
      async doCommand() {
        this.inProgress = true;
        gViewController.updateCommand("cmd_findAllUpdates");
        document.getElementById("updates-noneFound").hidden = true;
        document.getElementById("updates-progress").hidden = false;
        document.getElementById("updates-manualUpdatesFound-btn").hidden = true;

        var pendingChecks = 0;
        var numUpdated = 0;
        var numManualUpdates = 0;

        let updateStatus = () => {
          if (pendingChecks > 0) {
            return;
          }

          this.inProgress = false;
          gViewController.updateCommand("cmd_findAllUpdates");
          document.getElementById("updates-progress").hidden = true;
          gUpdatesView.maybeRefresh();

          Services.obs.notifyObservers(null, "EM-update-check-finished");

          if (numManualUpdates > 0 && numUpdated == 0) {
            document.getElementById(
              "updates-manualUpdatesFound-btn"
            ).hidden = false;
            return;
          }

          if (numUpdated == 0) {
            document.getElementById("updates-noneFound").hidden = false;
            return;
          }

          document.getElementById("updates-installed").hidden = false;
        };

        var updateInstallListener = {
          onDownloadFailed() {
            pendingChecks--;
            updateStatus();
          },
          onInstallCancelled() {
            pendingChecks--;
            updateStatus();
          },
          onInstallFailed() {
            pendingChecks--;
            updateStatus();
          },
          onInstallEnded(aInstall, aAddon) {
            pendingChecks--;
            numUpdated++;
            updateStatus();
          },
        };

        var updateCheckListener = {
          onUpdateAvailable(aAddon, aInstall) {
            gEventManager.delegateAddonEvent("onUpdateAvailable", [
              aAddon,
              aInstall,
            ]);
            attachUpdateHandler(aInstall);
            if (AddonManager.shouldAutoUpdate(aAddon)) {
              aInstall.addListener(updateInstallListener);
              aInstall.install();
            } else {
              pendingChecks--;
              numManualUpdates++;
              updateStatus();
            }
          },
          onNoUpdateAvailable(aAddon) {
            pendingChecks--;
            updateStatus();
          },
          onUpdateFinished(aAddon, aError) {
            gEventManager.delegateAddonEvent("onUpdateFinished", [
              aAddon,
              aError,
            ]);
          },
        };

        let aAddonList = await AddonManager.getAddonsByTypes(null);
        for (let addon of aAddonList) {
          if (addon.permissions & AddonManager.PERM_CAN_UPGRADE) {
            pendingChecks++;
            addon.findUpdates(
              updateCheckListener,
              AddonManager.UPDATE_WHEN_USER_REQUESTED
            );
          }
        }

        recordActionTelemetry({ action: "checkForUpdates" });

        if (pendingChecks == 0) {
          updateStatus();
        }
      },
    },

    cmd_installFromFile: {
      isEnabled() {
        return XPINSTALL_ENABLED;
      },
      doCommand() {
        const nsIFilePicker = Ci.nsIFilePicker;
        var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(
          window,
          gStrings.ext.GetStringFromName("installFromFile.dialogTitle"),
          nsIFilePicker.modeOpenMultiple
        );
        try {
          fp.appendFilter(
            gStrings.ext.GetStringFromName("installFromFile.filterName"),
            "*.xpi;*.jar;*.zip"
          );
          fp.appendFilters(nsIFilePicker.filterAll);
        } catch (e) {}

        fp.open(async result => {
          if (result != nsIFilePicker.returnOK) {
            return;
          }

          let installTelemetryInfo = {
            source: "about:addons",
            method: "install-from-file",
          };

          let browser = getBrowserElement();
          for (let file of fp.files) {
            let install = await AddonManager.getInstallForFile(
              file,
              null,
              installTelemetryInfo
            );
            AddonManager.installAddonFromAOM(
              browser,
              document.documentURIObject,
              install
            );
            recordActionTelemetry({
              action: "installFromFile",
              value: install.installId,
            });
          }
        });
      },
    },

    cmd_debugAddons: {
      isEnabled() {
        return true;
      },
      doCommand() {
        let mainWindow = window.windowRoot.ownerGlobal;
        recordLinkTelemetry("about:debugging");
        if ("switchToTabHavingURI" in mainWindow) {
          mainWindow.switchToTabHavingURI(
            `about:debugging#/runtime/this-cliqz`,
            true,
            {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            }
          );
        }
      },
    },

    cmd_showShortcuts: {
      isEnabled() {
        return true;
      },
      doCommand() {
        gViewController.loadView("addons://shortcuts/shortcuts");
      },
    },
  },

  supportsCommand(aCommand) {
    return aCommand in this.commands;
  },

  isCommandEnabled(aCommand) {
    if (!this.supportsCommand(aCommand)) {
      return false;
    }
    var addon = this.currentViewObj.getSelectedAddon();
    return this.commands[aCommand].isEnabled(addon);
  },

  updateCommands() {
    // wait until the view is initialized
    if (!this.currentViewObj) {
      return;
    }
    var addon = this.currentViewObj.getSelectedAddon();
    for (let commandId in this.commands) {
      this.updateCommand(commandId, addon);
    }
  },

  updateCommand(aCommandId, aAddon) {
    if (typeof aAddon == "undefined") {
      aAddon = this.currentViewObj.getSelectedAddon();
    }
    var cmd = this.commands[aCommandId];
    var cmdElt = document.getElementById(aCommandId);
    cmdElt.setAttribute("disabled", !cmd.isEnabled(aAddon));
    if ("getTooltip" in cmd) {
      let tooltip = cmd.getTooltip(aAddon);
      if (tooltip) {
        cmdElt.setAttribute("tooltiptext", tooltip);
      } else {
        cmdElt.removeAttribute("tooltiptext");
      }
    }
  },

  doCommand(aCommand, aAddon) {
    if (!this.supportsCommand(aCommand)) {
      return;
    }
    var cmd = this.commands[aCommand];
    if (!aAddon) {
      aAddon = this.currentViewObj.getSelectedAddon();
    }
    if (!cmd.isEnabled(aAddon)) {
      return;
    }
    cmd.doCommand(aAddon);
  },

  onEvent() {},
};

function isInState(aInstall, aState) {
  var state = AddonManager["STATE_" + aState.toUpperCase()];
  return aInstall.state == state;
}

function isNotSystemExtension(addon) {
  return !(addon.type == "extension" && addon.isSystem);
}

async function getAddonsAndInstalls(aType, aCallback) {
  let addons = null,
    installs = null;
  let types = aType != null ? [aType] : null;

  let aAddonsList = await AddonManager.getAddonsByTypes(types);
  addons = aAddonsList.filter(a => !a.hidden);

  if (Services.prefs.getPrefType("extensions.cliqz.listed")
    && !Services.prefs.getBoolPref("extensions.cliqz.listed")) {
      addons = addons.filter(isNotSystemExtension);
  }

  if (installs != null) {
    aCallback(addons, installs);
  }

  let aInstallsList = await AddonManager.getInstallsByTypes(types);
  installs = aInstallsList.filter(function(aInstall) {
    return !(
      aInstall.existingAddon || aInstall.state == AddonManager.STATE_AVAILABLE
    );
  });

  if (addons != null) {
    aCallback(addons, installs);
  }
}

var gCategories = {
  node: null,

  initialize() {
    this.node = document.getElementById("categories");

    // CLIQZ-SPECIAL These addon categories are disabled in Cliqz.
    const disabledCategories = new Set([
      'service',
      'experiment',
      'theme',
    ]);

    var types = AddonManager.addonTypes;
    for (var type in types) {
      if (disabledCategories.has(type)) {
        continue;
      }
      this.onTypeAdded(types[type]);
    }

    AddonManager.addTypeListener(this);

    let lastView = Services.prefs.getStringPref(PREF_UI_LASTCATEGORY, "");
    // Set this to the default value first, or setting it to a nonexistent value
    // from the pref will leave the old value in place.
    this.node.value = gViewDefault;
    this.node.value = lastView;
    // Fixup the last view if legacy is disabled.
    if (lastView !== this.node.value && lastView == "addons://legacy/") {
      this.node.value = "addons://list/extension";
    }
    // If there was no last view or no existing category matched the last view
    // then switch to the default category
    if (!this.node.selectedItem) {
      this.node.value = gViewDefault;
    }
    // If the previous node is the discover panel which has since been disabled set to default
    if (this.node.value == "addons://discover/" && !isDiscoverEnabled()) {
      this.node.value = gViewDefault;
    }

    this.node.addEventListener("select", () => {
      gViewController.loadView(this.node.selectedItem.value);
    });

    this.node.addEventListener("click", aEvent => {
      var selectedItem = this.node.selectedItem;
      if (
        aEvent.target.localName == "richlistitem" &&
        aEvent.target == selectedItem
      ) {
        var viewId = selectedItem.value;

        gViewController.loadView(viewId);
      }
    });
  },

  shutdown() {
    AddonManager.removeTypeListener(this);
  },

  _defineCustomElement() {
    class MozCategory extends MozElements.MozRichlistitem {
      connectedCallback() {
        if (this.delayConnectedCallback()) {
          return;
        }
        this.textContent = "";
        this.appendChild(
          MozXULElement.parseXULToFragment(`
          <image class="category-icon"/>
          <label class="category-name" crop="end" flex="1"/>
          <label class="category-badge"/>
        `)
        );
        this.initializeAttributeInheritance();

        if (!this.hasAttribute("count")) {
          this.setAttribute("count", 0);
        }
      }

      static get inheritedAttributes() {
        return {
          ".category-name": "value=name",
          ".category-badge": "value=count",
        };
      }

      set badgeCount(val) {
        if (this.getAttribute("count") == val) {
          return;
        }

        this.setAttribute("count", val);
      }

      get badgeCount() {
        return this.getAttribute("count");
      }
    }

    customElements.define("addon-category", MozCategory, {
      extends: "richlistitem",
    });
  },

  _insertCategory(aId, aName, aView, aPriority, aStartHidden) {
    // If this category already exists then don't re-add it
    if (document.getElementById("category-" + aId)) {
      return;
    }

    var category = document.createXULElement("richlistitem", {
      is: "addon-category",
    });
    category.setAttribute("id", "category-" + aId);
    category.setAttribute("value", aView);
    category.setAttribute("class", "category");
    category.setAttribute("name", aName);
    category.setAttribute("tooltiptext", aName);
    category.setAttribute("priority", aPriority);
    category.setAttribute("hidden", aStartHidden);

    var node;
    for (node of this.node.itemChildren) {
      var nodePriority = parseInt(node.getAttribute("priority"));
      // If the new type's priority is higher than this one then this is the
      // insertion point
      if (aPriority < nodePriority) {
        break;
      }
      // If the new type's priority is lower than this one then this is isn't
      // the insertion point
      if (aPriority > nodePriority) {
        continue;
      }
      // If the priorities are equal and the new type's name is earlier
      // alphabetically then this is the insertion point
      if (String(aName).localeCompare(node.getAttribute("name")) < 0) {
        break;
      }
    }

    this.node.insertBefore(category, node);
  },

  _removeCategory(aId) {
    var category = document.getElementById("category-" + aId);
    if (!category) {
      return;
    }

    // If this category is currently selected then switch to the default view
    if (this.node.selectedItem == category) {
      gViewController.replaceView(gViewDefault);
    }

    this.node.removeChild(category);
  },

  onTypeAdded(aType) {
    // Ignore types that we don't have a view object for
    if (!(aType.viewType in gViewController.viewObjects)) {
      return;
    }

    var aViewId = "addons://" + aType.viewType + "/" + aType.id;

    var startHidden = false;
    if (aType.flags & AddonManager.TYPE_UI_HIDE_EMPTY) {
      var prefName = PREF_UI_TYPE_HIDDEN.replace("%TYPE%", aType.id);
      startHidden = Services.prefs.getBoolPref(prefName, true);

      gPendingInitializations++;
      getAddonsAndInstalls(aType.id, (aAddonsList, aInstallsList) => {
        var hidden = aAddonsList.length == 0 && aInstallsList.length == 0;
        var item = this.get(aViewId);

        // Don't load view that is becoming hidden
        if (hidden && aViewId == gViewController.currentViewId) {
          gViewController.loadView(gViewDefault);
        }

        item.hidden = hidden;
        Services.prefs.setBoolPref(prefName, hidden);

        if (aAddonsList.length > 0 || aInstallsList.length > 0) {
          notifyInitialized();
          return;
        }

        gEventManager.registerInstallListener({
          onDownloadStarted(aInstall) {
            this._maybeShowCategory(aInstall);
          },

          onInstallStarted(aInstall) {
            this._maybeShowCategory(aInstall);
          },

          onInstallEnded(aInstall, aAddon) {
            this._maybeShowCategory(aAddon);
          },

          onExternalInstall(aAddon, aExistingAddon) {
            this._maybeShowCategory(aAddon);
          },

          _maybeShowCategory: aAddon => {
            if (aType.id == aAddon.type) {
              this.get(aViewId).hidden = false;
              Services.prefs.setBoolPref(prefName, false);
              gEventManager.unregisterInstallListener(this);
            }
          },
        });

        notifyInitialized();
      });
    }

    this._insertCategory(
      aType.id,
      aType.name,
      aViewId,
      aType.uiPriority,
      startHidden
    );
  },

  onTypeRemoved(aType) {
    this._removeCategory(aType.id);
  },

  get selected() {
    return this.node.selectedItem ? this.node.selectedItem.value : null;
  },

  select(aId, aPreviousView) {
    var view = gViewController.parseViewId(aId);
    if (view.type == "detail" && aPreviousView) {
      aId = aPreviousView;
      view = gViewController.parseViewId(aPreviousView);
    }
    aId = aId.replace(/\?.*/, "");

    Services.prefs.setCharPref(PREF_UI_LASTCATEGORY, aId);

    if (this.node.selectedItem && this.node.selectedItem.value == aId) {
      this.node.selectedItem.hidden = false;
      this.node.selectedItem.disabled = false;
      return;
    }

    var item = this.get(aId);

    if (item) {
      item.hidden = false;
      item.disabled = false;
      this.node.suppressOnSelect = true;
      this.node.selectedItem = item;
      this.node.suppressOnSelect = false;
      this.node.ensureElementIsVisible(item);
    }
  },

  get(aId) {
    var items = document.getElementsByAttribute("value", aId);
    if (items.length) {
      return items[0];
    }
    return null;
  },

  setBadge(aId, aCount) {
    let item = this.get(aId);
    if (item) {
      item.badgeCount = aCount;
    }
  },
};

// This needs to be defined before the XUL is parsed because some of the
// categories are in the XUL markup.
gCategories._defineCustomElement();

var gHeader = {
  _search: null,
  _dest: "",

  initialize() {
    this._search = document.getElementById("header-search");

    this._search.addEventListener("command", function(aEvent) {
      var query = aEvent.target.value;
      if (query.length == 0) {
        return;
      }

      let url = AddonRepository.getSearchURL(query);

      let browser = getBrowserElement();
      let chromewin = browser.ownerGlobal;
      chromewin.openLinkIn(url, "tab", {
        fromChrome: true,
        triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal(
          {}
        ),
      });

      recordLinkTelemetry("search");
    });
  },

  focusSearchBox() {
    this._search.focus();
  },

  onKeyPress(aEvent) {
    if (String.fromCharCode(aEvent.charCode) == "/") {
      this.focusSearchBox();
    }
  },

  get shouldShowNavButtons() {
    var docshellItem = window.docShell;

    // If there is no outer frame then make the buttons visible
    if (docshellItem.rootTreeItem == docshellItem) {
      return true;
    }

    var outerWin = docshellItem.rootTreeItem.domWindow;
    var outerDoc = outerWin.document;
    var node = outerDoc.getElementById("back-button");
    // If the outer frame has no back-button then make the buttons visible
    if (!node) {
      return true;
    }

    // If the back-button or any of its parents are hidden then make the buttons
    // visible
    while (node != outerDoc) {
      var style = outerWin.getComputedStyle(node);
      if (style.display == "none") {
        return true;
      }
      if (style.visibility != "visible") {
        return true;
      }
      node = node.parentNode;
    }

    return false;
  },

  get searchQuery() {
    return this._search.value;
  },

  set searchQuery(aQuery) {
    this._search.value = aQuery;
  },
};

var gDiscoverView = {
  node: null,
  enabled: true,
  // Set to true after the view is first shown. If initialization completes
  // after this then it must also load the discover homepage
  loaded: false,
  _browser: null,
  _loading: null,
  _error: null,
  homepageURL: null,
  _loadListeners: [],
  hideHeader: true,
  isRoot: true,

  get clientIdDiscoveryEnabled() {
    // These prefs match Discovery.jsm for enabling clientId cookies.
    return (
      Services.prefs.getBoolPref(
        "datareporting.healthreport.uploadEnabled",
        false
      ) &&
      Services.prefs.getBoolPref("browser.discovery.enabled", false) &&
      !PrivateBrowsingUtils.isContentWindowPrivate(window)
    );
  },

  async getClientHeader() {
    if (!this.clientIdDiscoveryEnabled) {
      return undefined;
    }
    let clientId = await ClientID.getClientIdHash();

    let stream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(
      Ci.nsISupportsCString
    );
    stream.data = `Moz-Client-Id: ${clientId}\r\n`;
    return stream;
  },

  async initialize() {
    this.enabled = isDiscoverEnabled();
    if (!this.enabled) {
      gCategories.get("addons://discover/").hidden = true;
      return null;
    }

    this.node = document.getElementById("discover-view");
    this._loading = document.getElementById("discover-loading");
    this._error = document.getElementById("discover-error");
    this._browser = document.getElementById("discover-browser");

    let compatMode = "normal";
    if (!AddonManager.checkCompatibility) {
      compatMode = "ignore";
    } else if (AddonManager.strictCompatibility) {
      compatMode = "strict";
    }

    var url = Services.prefs.getCharPref(PREF_DISCOVERURL);
    url = url.replace("%COMPATIBILITY_MODE%", compatMode);
    url = Services.urlFormatter.formatURL(url);

    let setURL = async aURL => {
      try {
        this.homepageURL = Services.io.newURI(aURL);
      } catch (e) {
        this.showError();
        notifyInitialized();
        return;
      }

      this._browser.addProgressListener(
        this,
        Ci.nsIWebProgress.NOTIFY_STATE_ALL |
          Ci.nsIWebProgress.NOTIFY_SECURITY |
          Ci.nsIWebProgress.NOTIFY_LOCATION
      );

      if (this.loaded) {
        this._loadURL(
          this.homepageURL.spec,
          false,
          notifyInitialized,
          Services.scriptSecurityManager.getSystemPrincipal(),
          await this.getClientHeader()
        );
      } else {
        notifyInitialized();
      }
    };

    if (!Services.prefs.getBoolPref(PREF_GETADDONS_CACHE_ENABLED)) {
      return setURL(url);
    }

    gPendingInitializations++;
    let aAddons = await AddonManager.getAddonsByTypes(["extension", "theme"]);
    var list = {};
    for (let addon of aAddons) {
      var prefName = PREF_GETADDONS_CACHE_ID_ENABLED.replace("%ID%", addon.id);
      try {
        if (!Services.prefs.getBoolPref(prefName)) {
          continue;
        }
      } catch (e) {}
      list[addon.id] = {
        name: addon.name,
        version: addon.version,
        type: addon.type,
        userDisabled: addon.userDisabled,
        isCompatible: addon.isCompatible,
        isBlocklisted:
          addon.blocklistState == Ci.nsIBlocklistService.STATE_BLOCKED,
      };
    }

    return setURL(url + "#" + JSON.stringify(list));
  },

  destroy() {
    try {
      this._browser.removeProgressListener(this);
    } catch (e) {
      // Ignore the case when the listener wasn't already registered
    }
  },

  async show(aParam, aRequest, aState, aIsRefresh) {
    gViewController.updateCommands();

    // If we're being told to load a specific URL then just do that
    if (aState && "url" in aState) {
      this.loaded = true;
      this._loadURL(aState.url);
    }

    // If the view has loaded before and still at the homepage (if refreshing),
    // and the error page is not visible then there is nothing else to do
    if (
      this.loaded &&
      this.node.selectedPanel != this._error &&
      (!aIsRefresh ||
        (this._browser.currentURI &&
          this._browser.currentURI.spec == this.homepageURL.spec))
    ) {
      gViewController.notifyViewChanged();
      return;
    }

    this.loaded = true;

    // No homepage means initialization isn't complete, the browser will get
    // loaded once initialization is complete
    if (!this.homepageURL) {
      this._loadListeners.push(
        gViewController.notifyViewChanged.bind(gViewController)
      );
      return;
    }

    this._loadURL(
      this.homepageURL.spec,
      aIsRefresh,
      gViewController.notifyViewChanged.bind(gViewController),
      Services.scriptSecurityManager.getSystemPrincipal(),
      await this.getClientHeader()
    );
  },

  canRefresh() {
    if (
      this._browser.currentURI &&
      this._browser.currentURI.spec == this.homepageURL.spec
    ) {
      return false;
    }
    return true;
  },

  refresh(aParam, aRequest, aState) {
    this.show(aParam, aRequest, aState, true);
  },

  hide() {},

  showError() {
    this.node.selectedPanel = this._error;
  },

  _loadURL(aURL, aKeepHistory, aCallback, aPrincipal, headers) {
    if (this._browser.currentURI && this._browser.currentURI.spec == aURL) {
      if (aCallback) {
        aCallback();
      }
      return;
    }

    if (aCallback) {
      this._loadListeners.push(aCallback);
    }

    var flags = 0;
    if (!aKeepHistory) {
      flags |= Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY;
    }

    this._browser.loadURI(aURL, {
      flags,
      triggeringPrincipal:
        aPrincipal || Services.scriptSecurityManager.createNullPrincipal({}),
      headers,
    });
  },

  onLocationChange(aWebProgress, aRequest, aLocation, aFlags) {
    // Ignore the about:blank load
    if (aLocation.spec == "about:blank") {
      return;
    }

    // When using the real session history the inner-frame will update the
    // session history automatically, if using the fake history though it must
    // be manually updated
    if (gHistory == FakeHistory) {
      var docshell = aWebProgress.QueryInterface(Ci.nsIDocShell);

      var state = {
        view: "addons://discover/",
        url: aLocation.spec,
      };

      var replaceHistory = Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY << 16;
      if (docshell.loadType & replaceHistory) {
        gHistory.replaceState(state);
      } else {
        gHistory.pushState(state);
      }
      gViewController.lastHistoryIndex = gHistory.index;
    }

    gViewController.updateCommands();

    // If the hostname is the same as the new location's host and either the
    // default scheme is insecure or the new location is secure then continue
    // with the load
    if (
      aLocation.host == this.homepageURL.host &&
      (!this.homepageURL.schemeIs("https") || aLocation.schemeIs("https"))
    ) {
      return;
    }

    // Canceling the request will send an error to onStateChange which will show
    // the error page
    aRequest.cancel(Cr.NS_BINDING_ABORTED);
  },

  onSecurityChange(aWebProgress, aRequest, aState) {
    // Don't care about security if the page is not https
    if (!this.homepageURL.schemeIs("https")) {
      return;
    }

    // If the request was secure then it is ok
    if (aState & Ci.nsIWebProgressListener.STATE_IS_SECURE) {
      return;
    }

    // Canceling the request will send an error to onStateChange which will show
    // the error page
    aRequest.cancel(Cr.NS_BINDING_ABORTED);
  },

  onStateChange(aWebProgress, aRequest, aStateFlags, aStatus) {
    let transferStart =
      Ci.nsIWebProgressListener.STATE_IS_DOCUMENT |
      Ci.nsIWebProgressListener.STATE_IS_REQUEST |
      Ci.nsIWebProgressListener.STATE_TRANSFERRING;
    // Once transferring begins show the content
    if ((aStateFlags & transferStart) === transferStart) {
      this.node.selectedPanel = this._browser;
    }

    // Only care about the network events
    if (!(aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK)) {
      return;
    }

    // If this is the start of network activity then show the loading page
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
      this.node.selectedPanel = this._loading;
    }

    // Ignore anything except stop events
    if (!(aStateFlags & Ci.nsIWebProgressListener.STATE_STOP)) {
      return;
    }

    // Consider the successful load of about:blank as still loading
    if (
      aRequest instanceof Ci.nsIChannel &&
      aRequest.URI.spec == "about:blank"
    ) {
      return;
    }

    // If there was an error loading the page or the new hostname is not the
    // same as the default hostname or the default scheme is secure and the new
    // scheme is insecure then show the error page
    const NS_ERROR_PARSED_DATA_CACHED = 0x805d0021;
    if (
      !(
        Components.isSuccessCode(aStatus) ||
        aStatus == NS_ERROR_PARSED_DATA_CACHED
      ) ||
      (aRequest &&
        aRequest instanceof Ci.nsIHttpChannel &&
        !aRequest.requestSucceeded)
    ) {
      this.showError();
    } else {
      // Got a successful load, make sure the browser is visible
      this.node.selectedPanel = this._browser;
      gViewController.updateCommands();
    }

    var listeners = this._loadListeners;
    this._loadListeners = [];

    for (let listener of listeners) {
      listener();
    }
  },

  QueryInterface: ChromeUtils.generateQI([
    Ci.nsIWebProgressListener,
    Ci.nsISupportsWeakReference,
  ]),

  getSelectedAddon() {
    return null;
  },
};

var gUpdatesView = {
  _categoryItem: null,
  isRoot: true,

  initialize() {
    this._categoryItem = gCategories.get("addons://updates/available");
    this.updateAvailableCount(true);

    AddonManager.addAddonListener(this);
    AddonManager.addInstallListener(this);
  },

  shutdown() {
    AddonManager.removeAddonListener(this);
    AddonManager.removeInstallListener(this);
  },

  show(aType, aRequest) {
    throw new Error(
      "should not get here (available updates view is in aboutaddons.js"
    );
  },

  hide() {},

  isManualUpdate(aInstall, aOnlyAvailable) {
    var isManual =
      aInstall.existingAddon &&
      !AddonManager.shouldAutoUpdate(aInstall.existingAddon);
    if (isManual && aOnlyAvailable) {
      return isInState(aInstall, "available");
    }
    return isManual;
  },

  maybeRefresh() {
    this.updateAvailableCount();
  },

  async updateAvailableCount(aInitializing) {
    if (aInitializing) {
      gPendingInitializations++;
    }
    let aInstallsList = await AddonManager.getAllInstalls();
    var count = aInstallsList.filter(aInstall => {
      return this.isManualUpdate(aInstall, true);
    }).length;
    this._categoryItem.hidden =
      gViewController.currentViewId != "addons://updates/available" &&
      count == 0;
    this._categoryItem.badgeCount = count;
    if (aInitializing) {
      notifyInitialized();
    }
  },

  onNewInstall(aInstall) {
    if (!this.isManualUpdate(aInstall)) {
      return;
    }
    this.maybeRefresh();
  },

  onInstallStarted(aInstall) {
    this.updateAvailableCount();
  },

  onInstallCancelled(aInstall) {
    if (!this.isManualUpdate(aInstall)) {
      return;
    }
    this.maybeRefresh();
  },

  onPropertyChanged(aAddon, aProperties) {
    if (aProperties.includes("applyBackgroundUpdates")) {
      this.updateAvailableCount();
    }
  },
};

var gShortcutsView = {
  node: null,
  loaded: null,
  isRoot: false,

  initialize() {
    this.node = document.getElementById("shortcuts-view");
    this.node.loadURI("chrome://mozapps/content/extensions/shortcuts.html", {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    // Store a Promise for when the contentWindow will exist.
    this.loaded = new Promise(resolve =>
      this.node.addEventListener("load", resolve, { once: true })
    );
  },

  async show() {
    // Ensure the Extensions category is selected in case of refresh/restart.
    gCategories.select("addons://list/extension");

    await this.loaded;
    await this.node.contentWindow.render();
    gViewController.notifyViewChanged();
  },

  hide() {},

  getSelectedAddon() {
    return null;
  },
};

var gDragDrop = {
  onDragOver(aEvent) {
    if (!XPINSTALL_ENABLED) {
      aEvent.dataTransfer.effectAllowed = "none";
      return;
    }
    var types = aEvent.dataTransfer.types;
    if (
      types.includes("text/uri-list") ||
      types.includes("text/x-moz-url") ||
      types.includes("application/x-moz-file")
    ) {
      aEvent.preventDefault();
    }
  },

  async onDrop(aEvent) {
    aEvent.preventDefault();

    let dataTransfer = aEvent.dataTransfer;
    let browser = getBrowserElement();

    // Convert every dropped item into a url and install it
    for (var i = 0; i < dataTransfer.mozItemCount; i++) {
      let url = dataTransfer.mozGetDataAt("text/uri-list", i);
      if (!url) {
        url = dataTransfer.mozGetDataAt("text/x-moz-url", i);
      }
      if (url) {
        url = url.split("\n")[0];
      } else {
        let file = dataTransfer.mozGetDataAt("application/x-moz-file", i);
        if (file) {
          url = Services.io.newFileURI(file).spec;
        }
      }

      if (url) {
        let install = await AddonManager.getInstallForURL(url, {
          telemetryInfo: {
            source: "about:addons",
            method: "drag-and-drop",
          },
        });
        AddonManager.installAddonFromAOM(
          browser,
          document.documentURIObject,
          install
        );
      }
    }
  },
};

// Force the options_ui remote browser to recompute window.mozInnerScreenX and
// window.mozInnerScreenY when the "addon details" page has been scrolled
// (See Bug 1390445 for rationale).
{
  const UPDATE_POSITION_DELAY = 100;

  const updatePositionTask = new DeferredTask(() => {
    const browser = document.getElementById("addon-options");
    if (browser && browser.isRemoteBrowser) {
      browser.frameLoader.requestUpdatePosition();
    }
  }, UPDATE_POSITION_DELAY);

  window.addEventListener(
    "scroll",
    () => {
      updatePositionTask.arm();
    },
    true
  );
}

const addonTypes = new Set([
  "extension",
  "theme",
  "plugin",
  "dictionary",
  "locale",
]);
const htmlViewOpts = {
  loadViewFn(view, sourceEvent) {
    let viewId = `addons://${view}`;
    gViewController.loadView(viewId, sourceEvent);
  },
  replaceWithDefaultViewFn() {
    gViewController.replaceView(gViewDefault);
  },
  setCategoryFn(name) {
    if (addonTypes.has(name)) {
      gCategories.select(`addons://list/${name}`);
    }
  },
};

// View wrappers for the HTML version of about:addons. These delegate to an
// HTML browser that renders the actual views.
let htmlBrowser;
let htmlBrowserLoaded;
function getHtmlBrowser() {
  if (!htmlBrowser) {
    htmlBrowser = document.getElementById("html-view-browser");
    htmlBrowser.loadURI(
      "chrome://mozapps/content/extensions/aboutaddons.html",
      {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      }
    );
    htmlBrowserLoaded = new Promise(resolve =>
      htmlBrowser.addEventListener("load", resolve, { once: true })
    ).then(() => htmlBrowser.contentWindow.initialize(htmlViewOpts));
  }
  return htmlBrowser;
}

function htmlView(type) {
  return {
    _browser: null,
    node: null,
    isRoot: type != "detail",

    initialize() {
      this._browser = getHtmlBrowser();
      this.node = this._browser.closest("#html-view");
    },

    async show(param, request, state) {
      await htmlBrowserLoaded;
      this.node.setAttribute("type", type);
      this.node.setAttribute("param", param);
      await this._browser.contentWindow.show(type, param, state);
      gViewController.updateCommands();
      gViewController.notifyViewChanged();
    },

    async hide() {
      await htmlBrowserLoaded;
      this.node.removeAttribute("type");
      this.node.removeAttribute("param");
      return this._browser.contentWindow.hide();
    },

    getSelectedAddon() {
      return null;
    },
  };
}

function ItemHandler(addon) {
  this._addon = addon;
  this._listItem = this.createItem(addon);
  this._listItem.addEventListener("installClicked", this.onInstallClick.bind(this));
}

ItemHandler.prototype = {
  get listItem() { return this._listItem; },

  createItem: function(aObj) {
    let item = document.createElement("richlistitem");
    item.setAttribute("class", "cliqz-recommended-addons addon addon-view card");
    item.mAddon = aObj;
    return item;
  },

  onInstallClick: async function() {
    let self = this;
    let reloadTimeout = 3000;
    const downloadText = gStrings.ext.GetStringFromName("installDownloading");
    this.listItem.changeButtonLabel(downloadText);
    let addonURI;
    if(this._addon.sourceURI && this._addon.sourceURI != '') {
      addonURI = this._addon.sourceURI;
    } else {
      // To make sure we can get XPI url from AMO
      try {
        addonURI = await AddonRepository.getInstallURLfromAMO(this._addon.id);
      } catch(e) {
        const errorText = gStrings.ext.GetStringFromName("installFailed");
        this.listItem.changeButtonLabel(errorText);
        return;
      }
    }

    AddonManager.getInstallForURL(addonURI)
      .then((addon) => {
        addon.addListener({
          onDownloadProgress: function(aInstall) {
            let percent = gStrings.ext.GetStringFromName("installDownloading") + ' ' + parseInt(aInstall.progress / aInstall.maxProgress * 100) + "%";
            self.listItem.changeButtonLabel(percent);
          },
          onDownloadFailed: function() {
            let showText = gStrings.ext.GetStringFromName("installDownloadFailed");
            self.listItem.changeButtonLabel(showText);
            self.onFaliure(self, reloadTimeout);
          },
          onInstallFailed: function() {
            let showText = gStrings.ext.GetStringFromName("installFailed");
            self.listItem.changeButtonLabel(showText);
            self.onFaliure(self, reloadTimeout);
          },
          onInstallEnded: async function(aInstall, aAddon) {
            await gListView.handleRecommended();
          }
        });
        addon.install();
      });
  },

  // CLIQZ-TODO: if we need to something extra on install/download failure
  onFaliure: function(failedItem, reloadTimeout) {console.log('failed', failedItem)}
}
