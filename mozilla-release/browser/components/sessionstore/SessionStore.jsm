
/*LS-102522*/var { CliqzLogger } = ChromeUtils.import('resource://gre/modules/CliqzLogger.jsm');
var __L_V__5 = CliqzLogger.init('mozilla-release/browser/components/sessionstore/SessionStore.jsm','SessionStore');/*LE-102522*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["SessionStore"];

// Current version of the format used by Session Restore.
const FORMAT_VERSION = 1;

const TAB_CUSTOM_VALUES = new WeakMap();
const TAB_LAZY_STATES = new WeakMap();
const TAB_STATE_NEEDS_RESTORE = 1;
const TAB_STATE_RESTORING = 2;
const TAB_STATE_WILL_RESTORE = 3;
const TAB_STATE_FOR_BROWSER = new WeakMap();
const WINDOW_RESTORE_IDS = new WeakMap();
const WINDOW_RESTORE_ZINDICES = new WeakMap();
const WINDOW_SHOWING_PROMISES = new Map();

// A new window has just been restored. At this stage, tabs are generally
// not restored.
const NOTIFY_SINGLE_WINDOW_RESTORED = "sessionstore-single-window-restored";
const NOTIFY_WINDOWS_RESTORED = "sessionstore-windows-restored";
const NOTIFY_BROWSER_STATE_RESTORED = "sessionstore-browser-state-restored";
const NOTIFY_LAST_SESSION_CLEARED = "sessionstore-last-session-cleared";
const NOTIFY_RESTORING_ON_STARTUP = "sessionstore-restoring-on-startup";
const NOTIFY_INITIATING_MANUAL_RESTORE =
  "sessionstore-initiating-manual-restore";
const NOTIFY_CLOSED_OBJECTS_CHANGED = "sessionstore-closed-objects-changed";

const NOTIFY_TAB_RESTORED = "sessionstore-debug-tab-restored"; // WARNING: debug-only
const NOTIFY_DOMWINDOWCLOSED_HANDLED =
  "sessionstore-debug-domwindowclosed-handled"; // WARNING: debug-only

// Maximum number of tabs to restore simultaneously. Previously controlled by
// the browser.sessionstore.max_concurrent_tabs pref.
const MAX_CONCURRENT_TAB_RESTORES = 3;

// Amount (in CSS px) by which we allow window edges to be off-screen
// when restoring a window, before we override the saved position to
// pull the window back within the available screen area.
const SCREEN_EDGE_SLOP = 8;

// global notifications observed
const OBSERVING = [
  "browser-window-before-show",
  "domwindowclosed",
  "quit-application-granted",
  "browser-lastwindow-close-granted",
  "quit-application",
  "browser:purge-session-history",
  "browser:purge-session-history-for-domain",
  "idle-daily",
  "clear-origin-attributes-data",
  "channel-on-may-change-process",
];

// XUL Window properties to (re)store
// Restored in restoreDimensions()
const WINDOW_ATTRIBUTES = ["width", "height", "screenX", "screenY", "sizemode"];

// Hideable window features to (re)store
// Restored in restoreWindowFeatures()
const WINDOW_HIDEABLE_FEATURES = [
  "menubar",
  "toolbar",
  "locationbar",
  "personalbar",
  "statusbar",
  "scrollbars",
];

// Messages that will be received via the Frame Message Manager.
const MESSAGES = [
  // The content script sends us data that has been invalidated and needs to
  // be saved to disk.
  "SessionStore:update",

  // The restoreHistory code has run. This is a good time to run SSTabRestoring.
  "SessionStore:restoreHistoryComplete",

  // The load for the restoring tab has begun. We update the URL bar at this
  // time; if we did it before, the load would overwrite it.
  "SessionStore:restoreTabContentStarted",

  // All network loads for a restoring tab are done, so we should
  // consider restoring another tab in the queue. The document has
  // been restored, and forms have been filled. We trigger
  // SSTabRestored at this time.
  "SessionStore:restoreTabContentComplete",

  // A crashed tab was revived by navigating to a different page. Remove its
  // browser from the list of crashed browsers to stop ignoring its messages.
  "SessionStore:crashedTabRevived",

  // The content script encountered an error.
  "SessionStore:error",
];

// The list of messages we accept from <xul:browser>s that have no tab
// assigned, or whose windows have gone away. Those are for example the
// ones that preload about:newtab pages, or from browsers where the window
// has just been closed.
const NOTAB_MESSAGES = new Set([
  // For a description see above.
  "SessionStore:crashedTabRevived",

  // For a description see above.
  "SessionStore:update",

  // For a description see above.
  "SessionStore:error",
]);

// The list of messages we accept without an "epoch" parameter.
// See getCurrentEpoch() and friends to find out what an "epoch" is.
const NOEPOCH_MESSAGES = new Set([
  // For a description see above.
  "SessionStore:crashedTabRevived",

  // For a description see above.
  "SessionStore:error",
]);

// The list of messages we want to receive even during the short period after a
// frame has been removed from the DOM and before its frame script has finished
// unloading.
const CLOSED_MESSAGES = new Set([
  // For a description see above.
  "SessionStore:crashedTabRevived",

  // For a description see above.
  "SessionStore:update",

  // For a description see above.
  "SessionStore:error",
]);

// These are tab events that we listen to.
const TAB_EVENTS = [
  "TabOpen",
  "TabBrowserInserted",
  "TabClose",
  "TabSelect",
  "TabShow",
  "TabHide",
  "TabPinned",
  "TabUnpinned",
];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

/**
 * When calling restoreTabContent, we can supply a reason why
 * the content is being restored. These are those reasons.
 */
const RESTORE_TAB_CONTENT_REASON = {
  /**
   * SET_STATE:
   * We're restoring this tab's content because we're setting
   * state inside this browser tab, probably because the user
   * has asked us to restore a tab (or window, or entire session).
   */
  SET_STATE: 0,
  /**
   * NAVIGATE_AND_RESTORE:
   * We're restoring this tab's content because a navigation caused
   * us to do a remoteness-flip.
   */
  NAVIGATE_AND_RESTORE: 1,
};

#if 0
// CLIQZ-SPECIAL: we use browser.startup.restoreTabs;
// 'browser.startup.page' preference value to resume the previous session.
const BROWSER_STARTUP_RESUME_SESSION = 3;
#endif

ChromeUtils.import("resource://gre/modules/PrivateBrowsingUtils.jsm", this);
ChromeUtils.import("resource://gre/modules/Services.jsm", this);
ChromeUtils.import("resource://gre/modules/TelemetryTimestamps.jsm", this);
ChromeUtils.import("resource://gre/modules/Timer.jsm", this);
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm", this);
ChromeUtils.import("resource://gre/modules/osfile.jsm", this);
ChromeUtils.import("resource:///modules/CliqzResources.jsm", this);

XPCOMUtils.defineLazyServiceGetters(this, {
  gScreenManager: ["@mozilla.org/gfx/screenmanager;1", "nsIScreenManager"],
  Telemetry: ["@mozilla.org/base/telemetry;1", "nsITelemetry"],
});

XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: "resource://gre/modules/AppConstants.jsm",
  AsyncShutdown: "resource://gre/modules/AsyncShutdown.jsm",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.jsm",
  E10SUtils: "resource://gre/modules/E10SUtils.jsm",
  GlobalState: "resource:///modules/sessionstore/GlobalState.jsm",
  HomePage: "resource:///modules/HomePage.jsm",
  PrivacyFilter: "resource://gre/modules/sessionstore/PrivacyFilter.jsm",
  PromiseUtils: "resource://gre/modules/PromiseUtils.jsm",
  RunState: "resource:///modules/sessionstore/RunState.jsm",
  SessionCookies: "resource:///modules/sessionstore/SessionCookies.jsm",
  SessionFile: "resource:///modules/sessionstore/SessionFile.jsm",
  SessionSaver: "resource:///modules/sessionstore/SessionSaver.jsm",
  SessionStartup: "resource:///modules/sessionstore/SessionStartup.jsm",
  TabAttributes: "resource:///modules/sessionstore/TabAttributes.jsm",
  TabCrashHandler: "resource:///modules/ContentCrashHandlers.jsm",
  TabState: "resource:///modules/sessionstore/TabState.jsm",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.jsm",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.jsm",
  Utils: "resource://gre/modules/sessionstore/Utils.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
});

/**
 * |true| if we are in debug mode, |false| otherwise.
 * Debug mode is controlled by preference browser.sessionstore.debug
 */
var gDebuggingEnabled = false;
function debug(aMsg) {
__L_V__5({
    lN: 226,tT:'func',pr:'',eT:{'aMsg':aMsg},fN:'debug'
  });'__L_V__5';
  if (gDebuggingEnabled) {
__L_V__5({
    lN: 227,tT:'if',pr:'gDebuggingEnabled',eT:{},fN:''
  });'__L_V__5';
    aMsg = ("SessionStore: " + aMsg).replace(/\S{80}/g, "$&\n");
    Services.console.logStringMessage(aMsg);
  }
}

/**
 * A global value to tell that fingerprinting resistance is enabled or not.
 * If it's enabled, the session restore won't restore the window's size and
 * size mode.
 * This value is controlled by preference privacy.resistFingerprinting.
 */
var gResistFingerprintingEnabled = false;

var SessionStore = {
  get promiseInitialized() {
__L_V__5({
    lN: 242,tT:'func',pr:'',eT:{},fN:'promiseInitialized'
  });'__L_V__5';
    return SessionStoreInternal.promiseInitialized;
  },

  get promiseAllWindowsRestored() {
__L_V__5({
    lN: 246,tT:'func',pr:'',eT:{},fN:'promiseAllWindowsRestored'
  });'__L_V__5';
    return SessionStoreInternal.promiseAllWindowsRestored;
  },

  get canRestoreLastSession() {
__L_V__5({
    lN: 250,tT:'func',pr:'',eT:{},fN:'canRestoreLastSession'
  });'__L_V__5';
    return SessionStoreInternal.canRestoreLastSession;
  },

  set canRestoreLastSession(val) {
__L_V__5({
    lN: 254,tT:'func',pr:'',eT:{'val':val},fN:'canRestoreLastSession'
  });'__L_V__5';
    SessionStoreInternal.canRestoreLastSession = val;
  },

  get lastClosedObjectType() {
__L_V__5({
    lN: 258,tT:'func',pr:'',eT:{},fN:'lastClosedObjectType'
  });'__L_V__5';
    return SessionStoreInternal.lastClosedObjectType;
  },

  get willAutoRestore() {
__L_V__5({
    lN: 262,tT:'func',pr:'',eT:{},fN:'willAutoRestore'
  });'__L_V__5';
    return SessionStoreInternal.willAutoRestore;
  },

  init: function ss_init() {
__L_V__5({
    lN: 266,tT:'func',pr:'',eT:{},fN:'ss_init'
  });'__L_V__5';
    SessionStoreInternal.init();
  },

  getBrowserState: function ss_getBrowserState() {
__L_V__5({
    lN: 270,tT:'func',pr:'',eT:{},fN:'ss_getBrowserState'
  });'__L_V__5';
    return SessionStoreInternal.getBrowserState();
  },

  setBrowserState: function ss_setBrowserState(aState) {
__L_V__5({
    lN: 274,tT:'func',pr:'',eT:{'aState':aState},fN:'ss_setBrowserState'
  });'__L_V__5';
    SessionStoreInternal.setBrowserState(aState);
  },

  getWindowState: function ss_getWindowState(aWindow) {
__L_V__5({
    lN: 278,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ss_getWindowState'
  });'__L_V__5';
    return SessionStoreInternal.getWindowState(aWindow);
  },

  setWindowState: function ss_setWindowState(aWindow, aState, aOverwrite) {
__L_V__5({
    lN: 282,tT:'func',pr:'',eT:{'aWindow':aWindow,'aState':aState,'aOverwrite':aOverwrite},fN:'ss_setWindowState'
  });'__L_V__5';
    SessionStoreInternal.setWindowState(aWindow, aState, aOverwrite);
  },

  getTabState: function ss_getTabState(aTab) {
__L_V__5({
    lN: 286,tT:'func',pr:'',eT:{'aTab':aTab},fN:'ss_getTabState'
  });'__L_V__5';
    return SessionStoreInternal.getTabState(aTab);
  },

  setTabState: function ss_setTabState(aTab, aState) {
__L_V__5({
    lN: 290,tT:'func',pr:'',eT:{'aTab':aTab,'aState':aState},fN:'ss_setTabState'
  });'__L_V__5';
    SessionStoreInternal.setTabState(aTab, aState);
  },

  getInternalObjectState(obj) {
__L_V__5({
    lN: 294,tT:'func',pr:'',eT:{'obj':obj},fN:'getInternalObjectState'
  });'__L_V__5';
    return SessionStoreInternal.getInternalObjectState(obj);
  },

  duplicateTab: function ss_duplicateTab(
    aWindow,
    aTab,
    aDelta = 0,
    aRestoreImmediately = true
  ) {
__L_V__5({
    lN: 303,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab,'aDelta':aDelta,'aRestoreImmediately':aRestoreImmediately},fN:'ss_duplicateTab'
  });'__L_V__5';
    return SessionStoreInternal.duplicateTab(
      aWindow,
      aTab,
      aDelta,
      aRestoreImmediately
    );
  },

  getClosedTabCount: function ss_getClosedTabCount(aWindow) {
__L_V__5({
    lN: 312,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ss_getClosedTabCount'
  });'__L_V__5';
    return SessionStoreInternal.getClosedTabCount(aWindow);
  },

  getClosedTabData: function ss_getClosedTabData(aWindow, aAsString = true) {
__L_V__5({
    lN: 316,tT:'func',pr:'',eT:{'aWindow':aWindow,'aAsString':aAsString},fN:'ss_getClosedTabData'
  });'__L_V__5';
    return SessionStoreInternal.getClosedTabData(aWindow, aAsString);
  },

  undoCloseTab: function ss_undoCloseTab(aWindow, aIndex) {
__L_V__5({
    lN: 320,tT:'func',pr:'',eT:{'aWindow':aWindow,'aIndex':aIndex},fN:'ss_undoCloseTab'
  });'__L_V__5';
    return SessionStoreInternal.undoCloseTab(aWindow, aIndex);
  },

  forgetClosedTab: function ss_forgetClosedTab(aWindow, aIndex) {
__L_V__5({
    lN: 324,tT:'func',pr:'',eT:{'aWindow':aWindow,'aIndex':aIndex},fN:'ss_forgetClosedTab'
  });'__L_V__5';
    return SessionStoreInternal.forgetClosedTab(aWindow, aIndex);
  },

  getClosedWindowCount: function ss_getClosedWindowCount() {
__L_V__5({
    lN: 328,tT:'func',pr:'',eT:{},fN:'ss_getClosedWindowCount'
  });'__L_V__5';
    return SessionStoreInternal.getClosedWindowCount();
  },

  getClosedWindowData: function ss_getClosedWindowData(aAsString = true) {
__L_V__5({
    lN: 332,tT:'func',pr:'',eT:{'aAsString':aAsString},fN:'ss_getClosedWindowData'
  });'__L_V__5';
    return SessionStoreInternal.getClosedWindowData(aAsString);
  },

  undoCloseWindow: function ss_undoCloseWindow(aIndex) {
__L_V__5({
    lN: 336,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'ss_undoCloseWindow'
  });'__L_V__5';
    return SessionStoreInternal.undoCloseWindow(aIndex);
  },

  forgetClosedWindow: function ss_forgetClosedWindow(aIndex) {
__L_V__5({
    lN: 340,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'ss_forgetClosedWindow'
  });'__L_V__5';
    return SessionStoreInternal.forgetClosedWindow(aIndex);
  },

  getCustomWindowValue(aWindow, aKey) {
__L_V__5({
    lN: 344,tT:'func',pr:'',eT:{'aWindow':aWindow,'aKey':aKey},fN:'getCustomWindowValue'
  });'__L_V__5';
    return SessionStoreInternal.getCustomWindowValue(aWindow, aKey);
  },

  setCustomWindowValue(aWindow, aKey, aStringValue) {
__L_V__5({
    lN: 348,tT:'func',pr:'',eT:{'aWindow':aWindow,'aKey':aKey,'aStringValue':aStringValue},fN:'setCustomWindowValue'
  });'__L_V__5';
    SessionStoreInternal.setCustomWindowValue(aWindow, aKey, aStringValue);
  },

  deleteCustomWindowValue(aWindow, aKey) {
__L_V__5({
    lN: 352,tT:'func',pr:'',eT:{'aWindow':aWindow,'aKey':aKey},fN:'deleteCustomWindowValue'
  });'__L_V__5';
    SessionStoreInternal.deleteCustomWindowValue(aWindow, aKey);
  },

  getCustomTabValue(aTab, aKey) {
__L_V__5({
    lN: 356,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey},fN:'getCustomTabValue'
  });'__L_V__5';
    return SessionStoreInternal.getCustomTabValue(aTab, aKey);
  },

  setCustomTabValue(aTab, aKey, aStringValue) {
__L_V__5({
    lN: 360,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey,'aStringValue':aStringValue},fN:'setCustomTabValue'
  });'__L_V__5';
    SessionStoreInternal.setCustomTabValue(aTab, aKey, aStringValue);
  },

  deleteCustomTabValue(aTab, aKey) {
__L_V__5({
    lN: 364,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey},fN:'deleteCustomTabValue'
  });'__L_V__5';
    SessionStoreInternal.deleteCustomTabValue(aTab, aKey);
  },

  getLazyTabValue(aTab, aKey) {
__L_V__5({
    lN: 368,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey},fN:'getLazyTabValue'
  });'__L_V__5';
    return SessionStoreInternal.getLazyTabValue(aTab, aKey);
  },

  getCustomGlobalValue(aKey) {
__L_V__5({
    lN: 372,tT:'func',pr:'',eT:{'aKey':aKey},fN:'getCustomGlobalValue'
  });'__L_V__5';
    return SessionStoreInternal.getCustomGlobalValue(aKey);
  },

  setCustomGlobalValue(aKey, aStringValue) {
__L_V__5({
    lN: 376,tT:'func',pr:'',eT:{'aKey':aKey,'aStringValue':aStringValue},fN:'setCustomGlobalValue'
  });'__L_V__5';
    SessionStoreInternal.setCustomGlobalValue(aKey, aStringValue);
  },

  deleteCustomGlobalValue(aKey) {
__L_V__5({
    lN: 380,tT:'func',pr:'',eT:{'aKey':aKey},fN:'deleteCustomGlobalValue'
  });'__L_V__5';
    SessionStoreInternal.deleteCustomGlobalValue(aKey);
  },

  persistTabAttribute: function ss_persistTabAttribute(aName) {
__L_V__5({
    lN: 384,tT:'func',pr:'',eT:{'aName':aName},fN:'ss_persistTabAttribute'
  });'__L_V__5';
    SessionStoreInternal.persistTabAttribute(aName);
  },

  restoreLastSession: function ss_restoreLastSession() {
__L_V__5({
    lN: 388,tT:'func',pr:'',eT:{},fN:'ss_restoreLastSession'
  });'__L_V__5';
    SessionStoreInternal.restoreLastSession();
  },

  speculativeConnectOnTabHover(tab) {
__L_V__5({
    lN: 392,tT:'func',pr:'',eT:{'tab':tab},fN:'speculativeConnectOnTabHover'
  });'__L_V__5';
    SessionStoreInternal.speculativeConnectOnTabHover(tab);
  },

  getCurrentState(aUpdateAll) {
__L_V__5({
    lN: 396,tT:'func',pr:'',eT:{'aUpdateAll':aUpdateAll},fN:'getCurrentState'
  });'__L_V__5';
    return SessionStoreInternal.getCurrentState(aUpdateAll);
  },

  reviveCrashedTab(aTab) {
__L_V__5({
    lN: 400,tT:'func',pr:'',eT:{'aTab':aTab},fN:'reviveCrashedTab'
  });'__L_V__5';
    return SessionStoreInternal.reviveCrashedTab(aTab);
  },

  reviveAllCrashedTabs() {
__L_V__5({
    lN: 404,tT:'func',pr:'',eT:{},fN:'reviveAllCrashedTabs'
  });'__L_V__5';
    return SessionStoreInternal.reviveAllCrashedTabs();
  },

  navigateAndRestore(tab, loadArguments, historyIndex) {
__L_V__5({
    lN: 408,tT:'func',pr:'',eT:{'tab':tab,'loadArguments':loadArguments,'historyIndex':historyIndex},fN:'navigateAndRestore'
  });'__L_V__5';
    return SessionStoreInternal.navigateAndRestore(
      tab,
      loadArguments,
      historyIndex
    );
  },

  updateSessionStoreFromTablistener(aBrowser, aData) {
__L_V__5({
    lN: 416,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aData':aData},fN:'updateSessionStoreFromTablistener'
  });'__L_V__5';
    return SessionStoreInternal.updateSessionStoreFromTablistener(
      aBrowser,
      aData
    );
  },

  getSessionHistory(tab, updatedCallback) {
__L_V__5({
    lN: 423,tT:'func',pr:'',eT:{'tab':tab,'updatedCallback':updatedCallback},fN:'getSessionHistory'
  });'__L_V__5';
    return SessionStoreInternal.getSessionHistory(tab, updatedCallback);
  },

  undoCloseById(aClosedId, aIncludePrivate) {
__L_V__5({
    lN: 427,tT:'func',pr:'',eT:{'aClosedId':aClosedId,'aIncludePrivate':aIncludePrivate},fN:'undoCloseById'
  });'__L_V__5';
    return SessionStoreInternal.undoCloseById(aClosedId, aIncludePrivate);
  },

  resetBrowserToLazyState(tab) {
__L_V__5({
    lN: 431,tT:'func',pr:'',eT:{'tab':tab},fN:'resetBrowserToLazyState'
  });'__L_V__5';
    return SessionStoreInternal.resetBrowserToLazyState(tab);
  },

  /**
   * Determines whether the passed version number is compatible with
   * the current version number of the SessionStore.
   *
   * @param version The format and version of the file, as an array, e.g.
   * ["sessionrestore", 1]
   */
  isFormatVersionCompatible(version) {
__L_V__5({
    lN: 442,tT:'func',pr:'',eT:{'version':version},fN:'isFormatVersionCompatible'
  });'__L_V__5';
    if (!version) {
__L_V__5({
    lN: 443,tT:'if',pr:'!version',eT:{},fN:''
  });'__L_V__5';
      return false;
    }
    if (!Array.isArray(version)) {
__L_V__5({
    lN: 446,tT:'if',pr:'!Array.isArray(version)',eT:{},fN:''
  });'__L_V__5';
      // Improper format.
      return false;
    }
    if (version[0] != "sessionrestore") {
__L_V__5({
    lN: 450,tT:'if',pr:'version[0] != sessionrestore',eT:{},fN:''
  });'__L_V__5';
      // Not a Session Restore file.
      return false;
    }
    let number = Number.parseFloat(version[1]);
    if (Number.isNaN(number)) {
__L_V__5({
    lN: 455,tT:'if',pr:'Number.isNaN(number)',eT:{},fN:''
  });'__L_V__5';
      return false;
    }
    return number <= FORMAT_VERSION;
  },

  /**
   * Filters out not worth-saving tabs from a given browser state object.
   *
   * @param aState (object)
   *        The browser state for which we remove worth-saving tabs.
   *        The given object will be modified.
   */
  keepOnlyWorthSavingTabs(aState) {
__L_V__5({
    lN: 468,tT:'func',pr:'',eT:{'aState':aState},fN:'keepOnlyWorthSavingTabs'
  });'__L_V__5';
    for (let i = aState.windows.length - 1; i >= 0; i--) {
      let win = aState.windows[i];
      for (let j = win.tabs.length - 1; j >= 0; j--) {
        let tab = win.tabs[j];
        if (!SessionStoreInternal._shouldSaveTab(tab)) {
__L_V__5({
    lN: 473,tT:'if',pr:'!SessionStoreInternal._shouldSaveTab(tab)',eT:{},fN:''
  });'__L_V__5';
          win.tabs.splice(j, 1);
          if (win.selected > j) {
__L_V__5({
    lN: 475,tT:'if',pr:'win.selected > j',eT:{},fN:''
  });'__L_V__5';
            win.selected--;
          }
        }
      }
      if (!win.tabs.length) {
__L_V__5({
    lN: 480,tT:'if',pr:'!win.tabs.length',eT:{},fN:''
  });'__L_V__5';
        aState.windows.splice(i, 1);
        if (aState.selectedWindow > i) {
__L_V__5({
    lN: 482,tT:'if',pr:'aState.selectedWindow > i',eT:{},fN:''
  });'__L_V__5';
          aState.selectedWindow--;
        }
      }
    }
  },
};

// Freeze the SessionStore object. We don't want anyone to modify it.
Object.freeze(SessionStore);

var SessionStoreInternal = {
  QueryInterface: ChromeUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference,
  ]),

  _globalState: new GlobalState(),

  // A counter to be used to generate a unique ID for each closed tab or window.
  _nextClosedId: 0,

  // A monotonic value used to generate a unique ID for each process switch.
  _switchIdMonotonic: 0,

  // During the initial restore and setBrowserState calls tracks the number of
  // windows yet to be restored
  _restoreCount: -1,

  // For each <browser> element, records the current epoch.
  _browserEpochs: new WeakMap(),

  // Any browsers that fires the oop-browser-crashed event gets stored in
  // here - that way we know which browsers to ignore messages from (until
  // they get restored).
  _crashedBrowsers: new WeakSet(),

  // A map (xul:browser -> FrameLoader) that maps a browser to the last
  // associated frameLoader we heard about.
  _lastKnownFrameLoader: new WeakMap(),

  // A map (xul:browser -> object) that maps a browser associated with a
  // recently closed tab to all its necessary state information we need to
  // properly handle final update message.
  _closedTabs: new WeakMap(),

  // A map (xul:browser -> object) that maps a browser associated with a
  // recently closed tab due to a window closure to the tab state information
  // that is being stored in _closedWindows for that tab.
  _closedWindowTabs: new WeakMap(),

  // A set of window data that has the potential to be saved in the _closedWindows
  // array for the session. We will remove window data from this set whenever
  // forgetClosedWindow is called for the window, or when session history is
  // purged, so that we don't accidentally save that data after the flush has
  // completed. Closed tabs use a more complicated mechanism for this particular
  // problem. When forgetClosedTab is called, the browser is removed from the
  // _closedTabs map, so its data is not recorded. In the purge history case,
  // the closedTabs array per window is overwritten so that once the flush is
  // complete, the tab would only ever add itself to an array that SessionStore
  // no longer cares about. Bug 1230636 has been filed to make the tab case
  // work more like the window case, which is more explicit, and easier to
  // reason about.
  _saveableClosedWindowData: new WeakSet(),

  // A map (xul:browser -> object) that maps a browser that is switching
  // remoteness via navigateAndRestore, to the loadArguments that were
  // most recently passed when calling navigateAndRestore.
  _remotenessChangingBrowsers: new WeakMap(),

  // whether a setBrowserState call is in progress
  _browserSetState: false,

  // time in milliseconds when the session was started (saved across sessions),
  // defaults to now if no session was restored or timestamp doesn't exist
  _sessionStartTime: Date.now(),

  // states for all currently opened windows
  _windows: {},

  // counter for creating unique window IDs
  _nextWindowID: 0,

  // states for all recently closed windows
  _closedWindows: [],

  // collection of session states yet to be restored
  _statesToRestore: {},

  // counts the number of crashes since the last clean start
  _recentCrashes: 0,

  // whether the last window was closed and should be restored
  _restoreLastWindow: false,

  // number of tabs currently restoring
  _tabsRestoringCount: 0,

  // When starting Firefox with a single private window, this is the place
  // where we keep the session we actually wanted to restore in case the user
  // decides to later open a non-private window as well.
  _deferredInitialState: null,

  // Keeps track of whether a notification needs to be sent that closed objects have changed.
  _closedObjectsChanged: false,

  // A promise resolved once initialization is complete
  _deferredInitialized: (function() {
    let deferred = {};

    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    return deferred;
  })(),

  // Whether session has been initialized
  _sessionInitialized: false,

  // A promise resolved once all windows are restored.
  _deferredAllWindowsRestored: (function() {
    let deferred = {};

    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    return deferred;
  })(),

  get promiseAllWindowsRestored() {
__L_V__5({
    lN: 615,tT:'func',pr:'',eT:{},fN:'promiseAllWindowsRestored'
  });'__L_V__5';
    return this._deferredAllWindowsRestored.promise;
  },

  // Promise that is resolved when we're ready to initialize
  // and restore the session.
  _promiseReadyForInitialization: null,

  // Keep busy state counters per window.
  _windowBusyStates: new WeakMap(),

  /**
   * A promise fulfilled once initialization is complete.
   */
  get promiseInitialized() {
__L_V__5({
    lN: 629,tT:'func',pr:'',eT:{},fN:'promiseInitialized'
  });'__L_V__5';
    return this._deferredInitialized.promise;
  },

  get canRestoreLastSession() {
__L_V__5({
    lN: 633,tT:'func',pr:'',eT:{},fN:'canRestoreLastSession'
  });'__L_V__5';
    return LastSession.canRestore;
  },

  set canRestoreLastSession(val) {
__L_V__5({
    lN: 637,tT:'func',pr:'',eT:{'val':val},fN:'canRestoreLastSession'
  });'__L_V__5';
    // Cheat a bit; only allow false.
    if (!val) {
__L_V__5({
    lN: 639,tT:'if',pr:'!val',eT:{},fN:''
  });'__L_V__5';
      LastSession.clear();
    }
  },

  /**
   * Returns a string describing the last closed object, either "tab" or "window".
   *
   * This was added to support the sessions.restore WebExtensions API.
   */
  get lastClosedObjectType() {
__L_V__5({
    lN: 649,tT:'func',pr:'',eT:{},fN:'lastClosedObjectType'
  });'__L_V__5';
    if (this._closedWindows.length) {
__L_V__5({
    lN: 650,tT:'if',pr:'this._closedWindows.length',eT:{},fN:''
  });'__L_V__5';
      // Since there are closed windows, we need to check if there's a closed tab
      // in one of the currently open windows that was closed after the
      // last-closed window.
      let tabTimestamps = [];
      for (let window of Services.wm.getEnumerator("navigator:browser")) {
        let windowState = this._windows[window.__SSi];
        if (windowState && windowState._closedTabs[0]) {
__L_V__5({
    lN: 657,tT:'if',pr:'windowState && windowState._closedTabs[0]',eT:{},fN:''
  });'__L_V__5';
          tabTimestamps.push(windowState._closedTabs[0].closedAt);
        }
      }
      if (
        !tabTimestamps.length ||
        tabTimestamps.sort((a, b) => b - a)[0] < this._closedWindows[0].closedAt
      ) {
__L_V__5({
    lN: 664,tT:'if',pr:' !tabTimestamps.length || tabTimestamps.sort((a, b) => b - a)[0] < this._closedWindows[0].closedAt ',eT:{},fN:''
  });'__L_V__5';
        return "window";
      }
    }
    return "tab";
  },

  /**
   * Returns a boolean that determines whether the session will be automatically
   * restored upon the _next_ startup or a restart.
   */
  get willAutoRestore() {
__L_V__5({
    lN: 675,tT:'func',pr:'',eT:{},fN:'willAutoRestore'
  });'__L_V__5';
    return (
      !PrivateBrowsingUtils.permanentPrivateBrowsing &&
      (Services.prefs.getBoolPref("browser.sessionstore.resume_session_once") ||
        Services.prefs.getBoolPref("browser.startup.restoreTabs"))
    );
  },

  /**
   * Initialize the sessionstore service.
   */
  init() {
__L_V__5({
    lN: 686,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__5';
    if (this._initialized) {
__L_V__5({
    lN: 687,tT:'if',pr:'this._initialized',eT:{},fN:''
  });'__L_V__5';
      throw new Error("SessionStore.init() must only be called once!");
    }

    TelemetryTimestamps.add("sessionRestoreInitialized");
    OBSERVING.forEach(function(aTopic) {
      Services.obs.addObserver(this, aTopic, true);
    }, this);

    this._initPrefs();
    this._initialized = true;

    Telemetry.getHistogramById("FX_SESSION_RESTORE_PRIVACY_LEVEL").add(
      Services.prefs.getIntPref("browser.sessionstore.privacy_level")
    );
  },

  /**
   * Initialize the session using the state provided by SessionStartup
   */
  initSession() {
__L_V__5({
    lN: 707,tT:'func',pr:'',eT:{},fN:'initSession'
  });'__L_V__5';
    TelemetryStopwatch.start("FX_SESSION_RESTORE_STARTUP_INIT_SESSION_MS");
    let state;
    let ss = SessionStartup;

    if (ss.willRestore() || ss.sessionType == ss.DEFER_SESSION) {
__L_V__5({
    lN: 712,tT:'if',pr:'ss.willRestore() || ss.sessionType == ss.DEFER_SESSION',eT:{},fN:''
  });'__L_V__5';
      state = ss.state;
    }

    if (state) {
__L_V__5({
    lN: 716,tT:'if',pr:'state',eT:{},fN:''
  });'__L_V__5';
      try {
        // If we're doing a DEFERRED session, then we want to pull pinned tabs
        // out so they can be restored.
        if (ss.sessionType == ss.DEFER_SESSION) {
__L_V__5({
    lN: 720,tT:'if',pr:'ss.sessionType == ss.DEFER_SESSION',eT:{},fN:''
  });'__L_V__5';
          let [iniState, remainingState] = this._prepDataForDeferredRestore(
            state
          );
          // If we have a iniState with windows, that means that we have windows
          // with app tabs to restore.
          if (iniState.windows.length) {
__L_V__5({
    lN: 726,tT:'if',pr:'iniState.windows.length',eT:{},fN:''
  });'__L_V__5';
            // Move cookies over from the remaining state so that they're
            // restored right away, and pinned tabs will load correctly.
            iniState.cookies = remainingState.cookies;
            delete remainingState.cookies;
            state = iniState;
          } else {
            state = null;
          }

          if (remainingState.windows.length) {
__L_V__5({
    lN: 736,tT:'if',pr:'remainingState.windows.length',eT:{},fN:''
  });'__L_V__5';
            LastSession.setState(remainingState);
          }
        } else {
          // Get the last deferred session in case the user still wants to
          // restore it
          LastSession.setState(state.lastSessionState);

          if (ss.willRestoreAsCrashed()) {
__L_V__5({
    lN: 744,tT:'if',pr:'ss.willRestoreAsCrashed()',eT:{},fN:''
  });'__L_V__5';
            this._recentCrashes =
              ((state.session && state.session.recentCrashes) || 0) + 1;

            if (this._needsRestorePage(state, this._recentCrashes)) {
__L_V__5({
    lN: 748,tT:'if',pr:'this._needsRestorePage(state, this._recentCrashes)',eT:{},fN:''
  });'__L_V__5';
              // replace the crashed session with a restore-page-only session
              let url = "about:sessionrestore";
              let formdata = { id: { sessionData: state }, url };
              let entry = {
                url,
                triggeringPrincipal_base64:
                  E10SUtils.SERIALIZED_SYSTEMPRINCIPAL,
              };
              state = { windows: [{ tabs: [{ entries: [entry], formdata }] }] };
            } else if (
              this._hasSingleTabWithURL(state.windows, "about:welcomeback")
            ) {
__L_V__5({
    lN: 760,tT:'if',pr:' this._hasSingleTabWithURL(state.windows, about:welcomeback) ',eT:{},fN:''
  });'__L_V__5';
              // On a single about:welcomeback URL that crashed, replace about:welcomeback
              // with about:sessionrestore, to make clear to the user that we crashed.
              state.windows[0].tabs[0].entries[0].url = "about:sessionrestore";
              state.windows[0].tabs[0].entries[0].triggeringPrincipal_base64 =
                E10SUtils.SERIALIZED_SYSTEMPRINCIPAL;
            }
          }

          // Update the session start time using the restored session state.
          this._updateSessionStartTime(state);

          // Make sure that at least the first window doesn't have anything hidden.
          delete state.windows[0].hidden;
          // Since nothing is hidden in the first window, it cannot be a popup.
          delete state.windows[0].isPopup;
          // We don't want to minimize and then open a window at startup.
          if (state.windows[0].sizemode == "minimized") {
__L_V__5({
    lN: 777,tT:'if',pr:'state.windows[0].sizemode == minimized',eT:{},fN:''
  });'__L_V__5';
            state.windows[0].sizemode = "normal";
          }

          // clear any lastSessionWindowID attributes since those don't matter
          // during normal restore
          state.windows.forEach(function(aWindow) {
            delete aWindow.__lastSessionWindowID;
          });
        }
      } catch (ex) {
        debug("The session file is invalid: " + ex);
      }
    }

    // at this point, we've as good as resumed the session, so we can
    // clear the resume_session_once flag, if it's set
    if (
      !RunState.isQuitting &&
      this._prefBranch.getBoolPref("sessionstore.resume_session_once")
    ) {
__L_V__5({
    lN: 797,tT:'if',pr:' !RunState.isQuitting && this._prefBranch.getBoolPref(sessionstore.resume_session_once) ',eT:{},fN:''
  });'__L_V__5';
      this._prefBranch.setBoolPref("sessionstore.resume_session_once", false);
    }

    TelemetryStopwatch.finish("FX_SESSION_RESTORE_STARTUP_INIT_SESSION_MS");
    return state;
  },

  _initPrefs() {
__L_V__5({
    lN: 805,tT:'func',pr:'',eT:{},fN:'_initPrefs'
  });'__L_V__5';
    this._prefBranch = Services.prefs.getBranch("browser.");

    gDebuggingEnabled = this._prefBranch.getBoolPref("sessionstore.debug");

    Services.prefs.addObserver("browser.sessionstore.debug", () => {
      gDebuggingEnabled = this._prefBranch.getBoolPref("sessionstore.debug");
    });

    this._max_tabs_undo = this._prefBranch.getIntPref(
      "sessionstore.max_tabs_undo"
    );
    this._prefBranch.addObserver("sessionstore.max_tabs_undo", this, true);

    this._max_windows_undo = this._prefBranch.getIntPref(
      "sessionstore.max_windows_undo"
    );
    this._prefBranch.addObserver("sessionstore.max_windows_undo", this, true);

    this._restore_on_demand = this._prefBranch.getBoolPref(
      "sessionstore.restore_on_demand"
    );
    this._prefBranch.addObserver("sessionstore.restore_on_demand", this, true);

    gResistFingerprintingEnabled = Services.prefs.getBoolPref(
      "privacy.resistFingerprinting"
    );
    Services.prefs.addObserver("privacy.resistFingerprinting", this);
  },

  /**
   * Called on application shutdown, after notifications:
   * quit-application-granted, quit-application
   */
  _uninit: function ssi_uninit() {
__L_V__5({
    lN: 839,tT:'func',pr:'',eT:{},fN:'ssi_uninit'
  });'__L_V__5';
    if (!this._initialized) {
__L_V__5({
    lN: 840,tT:'if',pr:'!this._initialized',eT:{},fN:''
  });'__L_V__5';
      throw new Error("SessionStore is not initialized.");
    }

    // Prepare to close the session file and write the last state.
    RunState.setClosing();

    // save all data for session resuming
    if (this._sessionInitialized) {
__L_V__5({
    lN: 848,tT:'if',pr:'this._sessionInitialized',eT:{},fN:''
  });'__L_V__5';
      SessionSaver.run();
    }

    // clear out priority queue in case it's still holding refs
    TabRestoreQueue.reset();

    // Make sure to cancel pending saves.
    SessionSaver.cancel();
  },

  /**
   * Handle notifications
   */
  observe: function ssi_observe(aSubject, aTopic, aData) {
__L_V__5({
    lN: 862,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'ssi_observe'
  });'__L_V__5';
__L_V__5({
    lN: 863,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';
    switch (aTopic) {
      case "browser-window-before-show": // catch new windows
        this.onBeforeBrowserWindowShown(aSubject);
        break;
      case "domwindowclosed": // catch closed windows
        this.onClose(aSubject).then(() => {
          this._notifyOfClosedObjectsChange();
        });
        if (gDebuggingEnabled) {
__L_V__5({
    lN: 871,tT:'if',pr:'gDebuggingEnabled',eT:{},fN:''
  });'__L_V__5';
          Services.obs.notifyObservers(null, NOTIFY_DOMWINDOWCLOSED_HANDLED);
        }
        break;
      case "quit-application-granted":
        let syncShutdown = aData == "syncShutdown";
        this.onQuitApplicationGranted(syncShutdown);
        break;
      case "browser-lastwindow-close-granted":
        this.onLastWindowCloseGranted();
        break;
      case "quit-application":
        this.onQuitApplication(aData);
        break;
      case "browser:purge-session-history": // catch sanitization
        this.onPurgeSessionHistory();
        this._notifyOfClosedObjectsChange();
        break;
      case "browser:purge-session-history-for-domain":
        this.onPurgeDomainData(aData);
        this._notifyOfClosedObjectsChange();
        break;
      case "nsPref:changed": // catch pref changes
        this.onPrefChange(aData);
        this._notifyOfClosedObjectsChange();
        break;
      case "idle-daily":
        this.onIdleDaily();
        this._notifyOfClosedObjectsChange();
        break;
      case "clear-origin-attributes-data":
        let userContextId = 0;
        try {
          userContextId = JSON.parse(aData).userContextId;
        } catch (e) {}
        if (userContextId) {
__L_V__5({
    lN: 906,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__5';
          this._forgetTabsWithUserContextId(userContextId);
        }
        break;
      case "channel-on-may-change-process":
        this.onMayChangeProcess(aSubject);
        break;
    }
  },

  updateSessionStoreFromTablistener(aBrowser, aData) {
__L_V__5({
    lN: 916,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aData':aData},fN:'updateSessionStoreFromTablistener'
  });'__L_V__5';
    if (aBrowser.permanentKey == undefined) {
__L_V__5({
    lN: 917,tT:'if',pr:'aBrowser.permanentKey == undefined',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // Ignore sessionStore update from previous epochs
    if (!this.isCurrentEpoch(aBrowser, aData.epoch)) {
__L_V__5({
    lN: 922,tT:'if',pr:'!this.isCurrentEpoch(aBrowser, aData.epoch)',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    TabState.update(aBrowser, aData);
    let win = aBrowser.ownerGlobal;
    this.saveStateDelayed(win);

    if (aData.flushID) {
__L_V__5({
    lN: 930,tT:'if',pr:'aData.flushID',eT:{},fN:''
  });'__L_V__5';
      // This is an update kicked off by an async flush request. Notify the
      // TabStateFlusher so that it can finish the request and notify its
      // consumer that's waiting for the flush to be done.
      TabStateFlusher.resolve(aBrowser, aData.flushID);
    }
  },

  /**
   * This method handles incoming messages sent by the session store content
   * script via the Frame Message Manager or Parent Process Message Manager,
   * and thus enables communication with OOP tabs.
   */
  receiveMessage(aMessage) {
__L_V__5({
    lN: 943,tT:'func',pr:'',eT:{'aMessage':aMessage},fN:'receiveMessage'
  });'__L_V__5';
    // If we got here, that means we're dealing with a frame message
    // manager message, so the target will be a <xul:browser>.
    var browser = aMessage.target;
    let win = browser.ownerGlobal;
    let tab = win ? win.gBrowser.getTabForBrowser(browser) : null;

    // Ensure we receive only specific messages from <xul:browser>s that
    // have no tab or window assigned, e.g. the ones that preload
    // about:newtab pages, or windows that have closed.
    if (!tab && !NOTAB_MESSAGES.has(aMessage.name)) {
__L_V__5({
    lN: 953,tT:'if',pr:'!tab && !NOTAB_MESSAGES.has(aMessage.name)',eT:{},fN:''
  });'__L_V__5';
      throw new Error(
        `received unexpected message '${aMessage.name}' ` +
          `from a browser that has no tab or window`
      );
    }

    let data = aMessage.data || {};
    let hasEpoch = data.hasOwnProperty("epoch");

    // Most messages sent by frame scripts require to pass an epoch.
    if (!hasEpoch && !NOEPOCH_MESSAGES.has(aMessage.name)) {
__L_V__5({
    lN: 964,tT:'if',pr:'!hasEpoch && !NOEPOCH_MESSAGES.has(aMessage.name)',eT:{},fN:''
  });'__L_V__5';
      throw new Error(`received message '${aMessage.name}' without an epoch`);
    }

    // Ignore messages from previous epochs.
    if (hasEpoch && !this.isCurrentEpoch(browser, data.epoch)) {
__L_V__5({
    lN: 969,tT:'if',pr:'hasEpoch && !this.isCurrentEpoch(browser, data.epoch)',eT:{},fN:''
  });'__L_V__5';
      return;
    }
__L_V__5({
    lN: 972,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';

    switch (aMessage.name) {
      case "SessionStore:update":
        // |browser.frameLoader| might be empty if the browser was already
        // destroyed and its tab removed. In that case we still have the last
        // frameLoader we know about to compare.
        let frameLoader =
          browser.frameLoader ||
          this._lastKnownFrameLoader.get(browser.permanentKey);

        // If the message isn't targeting the latest frameLoader discard it.
        if (frameLoader != aMessage.targetFrameLoader) {
__L_V__5({
    lN: 983,tT:'if',pr:'frameLoader != aMessage.targetFrameLoader',eT:{},fN:''
  });'__L_V__5';
          return;
        }

        if (aMessage.data.isFinal) {
__L_V__5({
    lN: 987,tT:'if',pr:'aMessage.data.isFinal',eT:{},fN:''
  });'__L_V__5';
          // If this the final message we need to resolve all pending flush
          // requests for the given browser as they might have been sent too
          // late and will never respond. If they have been sent shortly after
          // switching a browser's remoteness there isn't too much data to skip.
          TabStateFlusher.resolveAll(browser);
        } else if (aMessage.data.flushID) {
__L_V__5({
    lN: 993,tT:'if',pr:'aMessage.data.flushID',eT:{},fN:''
  });'__L_V__5';
          // This is an update kicked off by an async flush request. Notify the
          // TabStateFlusher so that it can finish the request and notify its
          // consumer that's waiting for the flush to be done.
          TabStateFlusher.resolve(browser, aMessage.data.flushID);
        }

        // Ignore messages from <browser> elements that have crashed
        // and not yet been revived.
        if (this._crashedBrowsers.has(browser.permanentKey)) {
__L_V__5({
    lN: 1002,tT:'if',pr:'this._crashedBrowsers.has(browser.permanentKey)',eT:{},fN:''
  });'__L_V__5';
          return;
        }

        // Update the tab's cached state.
        // Mark the window as dirty and trigger a delayed write.
        TabState.update(browser, aMessage.data);
        this.saveStateDelayed(win);

        // Handle any updates sent by the child after the tab was closed. This
        // might be the final update as sent by the "unload" handler but also
        // any async update message that was sent before the child unloaded.
        if (this._closedTabs.has(browser.permanentKey)) {
__L_V__5({
    lN: 1014,tT:'if',pr:'this._closedTabs.has(browser.permanentKey)',eT:{},fN:''
  });'__L_V__5';
          let { closedTabs, tabData } = this._closedTabs.get(
            browser.permanentKey
          );

          // Update the closed tab's state. This will be reflected in its
          // window's list of closed tabs as that refers to the same object.
          TabState.copyFromCache(browser, tabData.state);

          // Is this the tab's final message?
          if (aMessage.data.isFinal) {
__L_V__5({
    lN: 1024,tT:'if',pr:'aMessage.data.isFinal',eT:{},fN:''
  });'__L_V__5';
            // We expect no further updates.
            this._closedTabs.delete(browser.permanentKey);
            // The tab state no longer needs this reference.
            delete tabData.permanentKey;

            // Determine whether the tab state is worth saving.
            let shouldSave = this._shouldSaveTabState(tabData.state);
            let index = closedTabs.indexOf(tabData);

            if (shouldSave && index == -1) {
__L_V__5({
    lN: 1034,tT:'if',pr:'shouldSave && index == -1',eT:{},fN:''
  });'__L_V__5';
              // If the tab state is worth saving and we didn't push it onto
              // the list of closed tabs when it was closed (because we deemed
              // the state not worth saving) then add it to the window's list
              // of closed tabs now.
              this.saveClosedTabData(closedTabs, tabData);
            } else if (!shouldSave && index > -1) {
__L_V__5({
    lN: 1040,tT:'if',pr:'!shouldSave && index > -1',eT:{},fN:''
  });'__L_V__5';
              // Remove from the list of closed tabs. The update messages sent
              // after the tab was closed changed enough state so that we no
              // longer consider its data interesting enough to keep around.
              this.removeClosedTabData(closedTabs, index);
            }
          }
        }
        break;
      case "SessionStore:restoreHistoryComplete": {
        // Notify the tabbrowser that the tab chrome has been restored.
        let tabData = TabState.collect(tab, TAB_CUSTOM_VALUES.get(tab));

        // wall-paper fix for bug 439675: make sure that the URL to be loaded
        // is always visible in the address bar if no other value is present
        let activePageData = tabData.entries[tabData.index - 1] || null;
        let uri = activePageData ? activePageData.url || null : null;
        // NB: we won't set initial URIs (about:home, about:newtab, etc.) here
        // because their load will not normally trigger a location bar clearing
        // when they finish loading (to avoid race conditions where we then
        // clear user input instead), so we shouldn't set them here either.
        // They also don't fall under the issues in bug 439675 where user input
        // needs to be preserved if the load doesn't succeed.
        // We also don't do this for remoteness updates, where it should not
        // be necessary.
        if (
          !browser.userTypedValue &&
          uri &&
          !data.isRemotenessUpdate &&
          !win.gInitialPages.includes(uri)
        ) {
__L_V__5({
    lN: 1070,tT:'if',pr:' !browser.userTypedValue && uri && !data.isRemotenessUpdate && !win.gInitialPages.includes(uri) ',eT:{},fN:''
  });'__L_V__5';
          browser.userTypedValue = uri;
        }

        // Update tab label and icon again after the tab history was updated.
        this.updateTabLabelAndIcon(tab, tabData);

        let event = win.document.createEvent("Events");
        event.initEvent("SSTabRestoring", true, false);
        tab.dispatchEvent(event);
        break;
      }
      case "SessionStore:restoreTabContentStarted":
        if (TAB_STATE_FOR_BROWSER.get(browser) == TAB_STATE_NEEDS_RESTORE) {
__L_V__5({
    lN: 1083,tT:'if',pr:'TAB_STATE_FOR_BROWSER.get(browser) == TAB_STATE_NEEDS_RESTORE',eT:{},fN:''
  });'__L_V__5';
          // If a load not initiated by sessionstore was started in a
          // previously pending tab. Mark the tab as no longer pending.
          this.markTabAsRestoring(tab);
        } else if (
          data.reason != RESTORE_TAB_CONTENT_REASON.NAVIGATE_AND_RESTORE
        ) {
__L_V__5({
    lN: 1089,tT:'if',pr:' data.reason != RESTORE_TAB_CONTENT_REASON.NAVIGATE_AND_RESTORE ',eT:{},fN:''
  });'__L_V__5';
          // If the user was typing into the URL bar when we crashed, but hadn't hit
          // enter yet, then we just need to write that value to the URL bar without
          // loading anything. This must happen after the load, as the load will clear
          // userTypedValue.
          //
          // Note that we only want to do that if we're restoring state for reasons
          // _other_ than a navigateAndRestore remoteness-flip, as such a flip
          // implies that the user was navigating.
          let tabData = TabState.collect(tab, TAB_CUSTOM_VALUES.get(tab));
          if (
            tabData.userTypedValue &&
            !tabData.userTypedClear &&
            !browser.userTypedValue
          ) {
__L_V__5({
    lN: 1103,tT:'if',pr:' tabData.userTypedValue && !tabData.userTypedClear && !browser.userTypedValue ',eT:{},fN:''
  });'__L_V__5';
            browser.userTypedValue = tabData.userTypedValue;
            if (tab.selected) {
__L_V__5({
    lN: 1105,tT:'if',pr:'tab.selected',eT:{},fN:''
  });'__L_V__5';
              win.gURLBar.setURI();
            }
          }

          // Remove state we don't need any longer.
          TabStateCache.update(browser, {
            userTypedValue: null,
            userTypedClear: null,
          });
        }
        break;
      case "SessionStore:restoreTabContentComplete":
        // This callback is used exclusively by tests that want to
        // monitor the progress of network loads.
        if (gDebuggingEnabled) {
__L_V__5({
    lN: 1120,tT:'if',pr:'gDebuggingEnabled',eT:{},fN:''
  });'__L_V__5';
          Services.obs.notifyObservers(browser, NOTIFY_TAB_RESTORED);
        }

        SessionStoreInternal._resetLocalTabRestoringState(tab);
        SessionStoreInternal.restoreNextTab();

        this._sendTabRestoredNotification(tab, data.isRemotenessUpdate);

        Services.obs.notifyObservers(
          null,
          "sessionstore-one-or-no-tab-restored"
        );
        break;
      case "SessionStore:crashedTabRevived":
        // The browser was revived by navigating to a different page
        // manually, so we remove it from the ignored browser set.
        this._crashedBrowsers.delete(browser.permanentKey);
        break;
      case "SessionStore:error":
        TabStateFlusher.resolveAll(
          browser,
          false,
          "Received error from the content process"
        );
        break;
      default:
        throw new Error(`received unknown message '${aMessage.name}'`);
    }
  },

  /* ........ Window Event Handlers .............. */

  /**
   * Implement EventListener for handling various window and tab events
   */
  handleEvent: function ssi_handleEvent(aEvent) {
__L_V__5({
    lN: 1156,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'ssi_handleEvent'
  });'__L_V__5';
    let win = aEvent.currentTarget.ownerGlobal;
    let target = aEvent.originalTarget;
__L_V__5({
    lN: 1159,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';
    switch (aEvent.type) {
      case "TabOpen":
        this.onTabAdd(win);
        break;
      case "TabBrowserInserted":
        this.onTabBrowserInserted(win, target);
        break;
      case "TabClose":
        // `adoptedBy` will be set if the tab was closed because it is being
        // moved to a new window.
        if (!aEvent.detail.adoptedBy) {
__L_V__5({
    lN: 1169,tT:'if',pr:'!aEvent.detail.adoptedBy',eT:{},fN:''
  });'__L_V__5';
          this.onTabClose(win, target);
        }
        this.onTabRemove(win, target);
        this._notifyOfClosedObjectsChange();
        break;
      case "TabSelect":
        this.onTabSelect(win);
        break;
      case "TabShow":
        this.onTabShow(win, target);
        break;
      case "TabHide":
        this.onTabHide(win, target);
        break;
      case "TabPinned":
      case "TabUnpinned":
      case "SwapDocShells":
        this.saveStateDelayed(win);
        break;
      case "oop-browser-crashed":
      case "oop-browser-buildid-mismatch":
        if (aEvent.isTopFrame) {
__L_V__5({
    lN: 1191,tT:'if',pr:'aEvent.isTopFrame',eT:{},fN:''
  });'__L_V__5';
          this.onBrowserCrashed(target);
        }
        break;
      case "XULFrameLoaderCreated":
        if (
          target.namespaceURI == NS_XUL &&
          target.localName == "browser" &&
          target.frameLoader &&
          target.permanentKey
        ) {
__L_V__5({
    lN: 1201,tT:'if',pr:' target.namespaceURI == NS_XUL && target.localName == browser && target.frameLoader && target.permanentKey ',eT:{},fN:''
  });'__L_V__5';
          this._lastKnownFrameLoader.set(
            target.permanentKey,
            target.frameLoader
          );
          this.resetEpoch(target);
        }
        break;
      case "BrowserChangedProcess":
        let newEpoch =
          1 +
          Math.max(
            this.getCurrentEpoch(target),
            this.getCurrentEpoch(aEvent.otherBrowser)
          );
        this.setCurrentEpoch(target, newEpoch);
        target.messageManager.sendAsyncMessage(
          "SessionStore:becomeActiveProcess",
          {
            epoch: newEpoch,
          }
        );
        break;
      default:
        throw new Error(`unhandled event ${aEvent.type}?`);
    }
    this._clearRestoringWindows();
  },

  /**
   * Generate a unique window identifier
   * @return string
   *         A unique string to identify a window
   */
  _generateWindowID: function ssi_generateWindowID() {
__L_V__5({
    lN: 1235,tT:'func',pr:'',eT:{},fN:'ssi_generateWindowID'
  });'__L_V__5';
    return "window" + this._nextWindowID++;
  },

  /**
   * Registers and tracks a given window.
   *
   * @param aWindow
   *        Window reference
   */
  onLoad(aWindow) {
__L_V__5({
    lN: 1245,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'onLoad'
  });'__L_V__5';
    // return if window has already been initialized
    if (aWindow && aWindow.__SSi && this._windows[aWindow.__SSi]) {
__L_V__5({
    lN: 1247,tT:'if',pr:'aWindow && aWindow.__SSi && this._windows[aWindow.__SSi]',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // ignore windows opened while shutting down
    if (RunState.isQuitting) {
__L_V__5({
    lN: 1252,tT:'if',pr:'RunState.isQuitting',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // Assign the window a unique identifier we can use to reference
    // internal data about the window.
    aWindow.__SSi = this._generateWindowID();

    let mm = aWindow.getGroupMessageManager("browsers");
    MESSAGES.forEach(msg => {
      let listenWhenClosed = CLOSED_MESSAGES.has(msg);
      mm.addMessageListener(msg, this, listenWhenClosed);
    });

    // Load the frame script after registering listeners.
    mm.loadFrameScript(
      "chrome://browser/content/content-sessionStore.js",
      true,
      true
    );

    // and create its data object
    this._windows[aWindow.__SSi] = {
      tabs: [],
      selected: 0,
      _closedTabs: [],
      busy: false,
    };

    if (PrivateBrowsingUtils.isWindowPrivate(aWindow)) {
__L_V__5({
    lN: 1281,tT:'if',pr:'PrivateBrowsingUtils.isWindowPrivate(aWindow)',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi].isPrivate = true;
    }
    if (!this._isWindowLoaded(aWindow)) {
__L_V__5({
    lN: 1284,tT:'if',pr:'!this._isWindowLoaded(aWindow)',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi]._restoring = true;
    }
    if (!aWindow.toolbar.visible) {
__L_V__5({
    lN: 1287,tT:'if',pr:'!aWindow.toolbar.visible',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi].isPopup = true;
    }

    let tabbrowser = aWindow.gBrowser;

    // add tab change listeners to all already existing tabs
    for (let i = 0; i < tabbrowser.tabs.length; i++) {
      this.onTabBrowserInserted(aWindow, tabbrowser.tabs[i]);
    }
    // notification of tab add/remove/selection/show/hide
    TAB_EVENTS.forEach(function(aEvent) {
      tabbrowser.tabContainer.addEventListener(aEvent, this, true);
    }, this);

    // Keep track of a browser's latest frameLoader.
    aWindow.gBrowser.addEventListener("XULFrameLoaderCreated", this);
    aWindow.gBrowser.addEventListener("BrowserChangedProcess", this);
  },

  /**
   * Initializes a given window.
   *
   * Windows are registered as soon as they are created but we need to wait for
   * the session file to load, and the initial window's delayed startup to
   * finish before initializing a window, i.e. restoring data into it.
   *
   * @param aWindow
   *        Window reference
   * @param aInitialState
   *        The initial state to be loaded after startup (optional)
   */
  initializeWindow(aWindow, aInitialState = null) {
__L_V__5({
    lN: 1319,tT:'func',pr:'',eT:{'aWindow':aWindow,'aInitialState':aInitialState},fN:'initializeWindow'
  });'__L_V__5';
    let isPrivateWindow = PrivateBrowsingUtils.isWindowPrivate(aWindow);

    // perform additional initialization when the first window is loading
    if (RunState.isStopped) {
__L_V__5({
    lN: 1323,tT:'if',pr:'RunState.isStopped',eT:{},fN:''
  });'__L_V__5';
      RunState.setRunning();

      // restore a crashed session resp. resume the last session if requested
      if (aInitialState) {
__L_V__5({
    lN: 1327,tT:'if',pr:'aInitialState',eT:{},fN:''
  });'__L_V__5';
        // Don't write to disk right after startup. Set the last time we wrote
        // to disk to NOW() to enforce a full interval before the next write.
        SessionSaver.updateLastSaveTime();

        if (isPrivateWindow) {
__L_V__5({
    lN: 1332,tT:'if',pr:'isPrivateWindow',eT:{},fN:''
  });'__L_V__5';
          // We're starting with a single private window. Save the state we
          // actually wanted to restore so that we can do it later in case
          // the user opens another, non-private window.
          this._deferredInitialState = SessionStartup.state;

          // Nothing to restore now, notify observers things are complete.
          Services.obs.notifyObservers(null, NOTIFY_WINDOWS_RESTORED);
          Services.obs.notifyObservers(
            null,
            "sessionstore-one-or-no-tab-restored"
          );
          this._deferredAllWindowsRestored.resolve();
        } else {
          TelemetryTimestamps.add("sessionRestoreRestoring");
          this._restoreCount = aInitialState.windows
            ? aInitialState.windows.length
            : 0;

          // global data must be restored before restoreWindow is called so that
          // it happens before observers are notified
          this._globalState.setFromState(aInitialState);

          // Restore session cookies before loading any tabs.
          SessionCookies.restore(aInitialState.cookies || []);

          // SessionStartup.willOverrideHomepage returns a boolean or a promise that resolves
          // to a boolean. Converting to a general promise for simplicity.
          let willOverrideHomepagePromise = Promise.all([SessionStartup.willOverrideHomepage]);
          willOverrideHomepagePromise.then(([willOverrideHomepage]) => {
            let overwrite = this._isCmdLineEmpty(aWindow, aInitialState) && willOverrideHomepage;
            let options = {firstWindow: true, overwriteTabs: overwrite};
            this.restoreWindows(aWindow, aInitialState, options);
          });

        }
      } else {
        // Nothing to restore, notify observers things are complete.
        Services.obs.notifyObservers(null, NOTIFY_WINDOWS_RESTORED);
        Services.obs.notifyObservers(
          null,
          "sessionstore-one-or-no-tab-restored"
        );
        this._deferredAllWindowsRestored.resolve();
      }
      // this window was opened by _openWindowWithState
    } else if (!this._isWindowLoaded(aWindow)) {
__L_V__5({
    lN: 1378,tT:'if',pr:'!this._isWindowLoaded(aWindow)',eT:{},fN:''
  });'__L_V__5';
      // We want to restore windows after all windows have opened (since bug
      // 1034036), so bail out here.
      return;
      // The user opened another, non-private window after starting up with
      // a single private one. Let's restore the session we actually wanted to
      // restore at startup.
    } else if (
      this._deferredInitialState &&
      !isPrivateWindow &&
      aWindow.toolbar.visible
    ) {
__L_V__5({
    lN: 1389,tT:'if',pr:' this._deferredInitialState && !isPrivateWindow && aWindow.toolbar.visible ',eT:{},fN:''
  });'__L_V__5';
      // global data must be restored before restoreWindow is called so that
      // it happens before observers are notified
      this._globalState.setFromState(this._deferredInitialState);

      this._restoreCount = this._deferredInitialState.windows
        ? this._deferredInitialState.windows.length
        : 0;
      this.restoreWindows(aWindow, this._deferredInitialState, {
        firstWindow: true,
      });
      this._deferredInitialState = null;
    } else if (
      this._restoreLastWindow &&
      aWindow.toolbar.visible &&
      this._closedWindows.length &&
      !isPrivateWindow
    ) {
__L_V__5({
    lN: 1406,tT:'if',pr:' this._restoreLastWindow && aWindow.toolbar.visible && this._closedWindows.length && !isPrivateWindow ',eT:{},fN:''
  });'__L_V__5';
      // default to the most-recently closed window
      // don't use popup windows
      let closedWindowState = null;
      let closedWindowIndex;
      for (let i = 0; i < this._closedWindows.length; i++) {
        // Take the first non-popup, point our object at it, and break out.
        if (!this._closedWindows[i].isPopup) {
__L_V__5({
    lN: 1413,tT:'if',pr:'!this._closedWindows[i].isPopup',eT:{},fN:''
  });'__L_V__5';
          closedWindowState = this._closedWindows[i];
          closedWindowIndex = i;
          break;
        }
      }

      if (closedWindowState) {
__L_V__5({
    lN: 1420,tT:'if',pr:'closedWindowState',eT:{},fN:''
  });'__L_V__5';
        let newWindowState;
        if (
          AppConstants.platform == "macosx" ||
          !SessionStartup.willRestoreCliqz()
        ) {
__L_V__5({
    lN: 1425,tT:'if',pr:' AppConstants.platform == macosx || !SessionStartup.willRestoreCliqz() ',eT:{},fN:''
  });'__L_V__5';
          // We want to split the window up into pinned tabs and unpinned tabs.
          // Pinned tabs should be restored. If there are any remaining tabs,
          // they should be added back to _closedWindows.
          // We'll cheat a little bit and reuse _prepDataForDeferredRestore
          // even though it wasn't built exactly for this.
          let [
            appTabsState,
            normalTabsState,
          ] = this._prepDataForDeferredRestore({
            windows: [closedWindowState],
          });

          // These are our pinned tabs, which we should restore
          if (appTabsState.windows.length) {
__L_V__5({
    lN: 1439,tT:'if',pr:'appTabsState.windows.length',eT:{},fN:''
  });'__L_V__5';
            newWindowState = appTabsState.windows[0];
            delete newWindowState.__lastSessionWindowID;
          }

          // In case there were no unpinned tabs, remove the window from _closedWindows
          if (!normalTabsState.windows.length) {
__L_V__5({
    lN: 1445,tT:'if',pr:'!normalTabsState.windows.length',eT:{},fN:''
  });'__L_V__5';
            this._removeClosedWindow(closedWindowIndex);
            // Or update _closedWindows with the modified state
          } else {
            delete normalTabsState.windows[0].__lastSessionWindowID;
            this._closedWindows[closedWindowIndex] = normalTabsState.windows[0];
          }
        } else {
          // If we're just restoring the window, make sure it gets removed from
          // _closedWindows.
          this._removeClosedWindow(closedWindowIndex);
          newWindowState = closedWindowState;
          delete newWindowState.hidden;
        }

        if (newWindowState) {
__L_V__5({
    lN: 1460,tT:'if',pr:'newWindowState',eT:{},fN:''
  });'__L_V__5';
          // Ensure that the window state isn't hidden
          this._restoreCount = 1;
          let state = { windows: [newWindowState] };
          let options = { overwriteTabs: this._isCmdLineEmpty(aWindow, state) };
          this.restoreWindow(aWindow, newWindowState, options);
        }
      }
      // we actually restored the session just now.
      this._prefBranch.setBoolPref("sessionstore.resume_session_once", false);
    }
    if (this._restoreLastWindow && aWindow.toolbar.visible) {
__L_V__5({
    lN: 1471,tT:'if',pr:'this._restoreLastWindow && aWindow.toolbar.visible',eT:{},fN:''
  });'__L_V__5';
      // always reset (if not a popup window)
      // we don't want to restore a window directly after, for example,
      // undoCloseWindow was executed.
      this._restoreLastWindow = false;
    }
  },

  /**
   * Called right before a new browser window is shown.
   * @param aWindow
   *        Window reference
   */
  onBeforeBrowserWindowShown(aWindow) {
__L_V__5({
    lN: 1484,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'onBeforeBrowserWindowShown'
  });'__L_V__5';
    // Register the window.
    this.onLoad(aWindow);

    // Some are waiting for this window to be shown, which is now, so let's resolve
    // the deferred operation.
    let deferred = WINDOW_SHOWING_PROMISES.get(aWindow);
    if (deferred) {
__L_V__5({
    lN: 1491,tT:'if',pr:'deferred',eT:{},fN:''
  });'__L_V__5';
      deferred.resolve(aWindow);
      WINDOW_SHOWING_PROMISES.delete(aWindow);
    }

    // Just call initializeWindow() directly if we're initialized already.
    if (this._sessionInitialized) {
__L_V__5({
    lN: 1497,tT:'if',pr:'this._sessionInitialized',eT:{},fN:''
  });'__L_V__5';
      this.initializeWindow(aWindow);
      return;
    }

    // The very first window that is opened creates a promise that is then
    // re-used by all subsequent windows. The promise will be used to tell
    // when we're ready for initialization.
    if (!this._promiseReadyForInitialization) {
__L_V__5({
    lN: 1505,tT:'if',pr:'!this._promiseReadyForInitialization',eT:{},fN:''
  });'__L_V__5';
      // Wait for the given window's delayed startup to be finished.
      let promise = new Promise(resolve => {
        Services.obs.addObserver(function obs(subject, topic) {
__L_V__5({
    lN: 1508,tT:'func',pr:'',eT:{'subject':subject,'topic':topic},fN:'obs'
  });'__L_V__5';
          if (aWindow == subject) {
__L_V__5({
    lN: 1509,tT:'if',pr:'aWindow == subject',eT:{},fN:''
  });'__L_V__5';
            Services.obs.removeObserver(obs, topic);
            resolve();
          }
        }, "browser-delayed-startup-finished");
      });

      // We are ready for initialization as soon as the session file has been
      // read from disk and the initial window's delayed startup has finished.
      this._promiseReadyForInitialization = Promise.all([
        promise,
        SessionStartup.onceInitialized,
      ]);
    }

    // We can't call this.onLoad since initialization
    // hasn't completed, so we'll wait until it is done.
    // Even if additional windows are opened and wait
    // for initialization as well, the first opened
    // window should execute first, and this.onLoad
    // will be called with the initialState.
    this._promiseReadyForInitialization
      .then(() => {
        if (aWindow.closed) {
__L_V__5({
    lN: 1532,tT:'if',pr:'aWindow.closed',eT:{},fN:''
  });'__L_V__5';
          return;
        }

        if (this._sessionInitialized) {
__L_V__5({
    lN: 1536,tT:'if',pr:'this._sessionInitialized',eT:{},fN:''
  });'__L_V__5';
          this.initializeWindow(aWindow);
        } else {
          let initialState = this.initSession();
          this._sessionInitialized = true;

          if (initialState) {
__L_V__5({
    lN: 1542,tT:'if',pr:'initialState',eT:{},fN:''
  });'__L_V__5';
            Services.obs.notifyObservers(null, NOTIFY_RESTORING_ON_STARTUP);
          }
          TelemetryStopwatch.start(
            "FX_SESSION_RESTORE_STARTUP_ONLOAD_INITIAL_WINDOW_MS"
          );
          this.initializeWindow(aWindow, initialState);
          TelemetryStopwatch.finish(
            "FX_SESSION_RESTORE_STARTUP_ONLOAD_INITIAL_WINDOW_MS"
          );

          // Let everyone know we're done.
          this._deferredInitialized.resolve();
        }
      })
      .catch(console.error);
  },

  /**
   * On window close...
   * - remove event listeners from tabs
   * - save all window data
   * @param aWindow
   *        Window reference
   *
   * @returns a Promise
   */
  onClose: function ssi_onClose(aWindow) {
__L_V__5({
    lN: 1569,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_onClose'
  });'__L_V__5';
    let completionPromise = Promise.resolve();
    // this window was about to be restored - conserve its original data, if any
    let isFullyLoaded = this._isWindowLoaded(aWindow);
    if (!isFullyLoaded) {
__L_V__5({
    lN: 1573,tT:'if',pr:'!isFullyLoaded',eT:{},fN:''
  });'__L_V__5';
      if (!aWindow.__SSi) {
__L_V__5({
    lN: 1574,tT:'if',pr:'!aWindow.__SSi',eT:{},fN:''
  });'__L_V__5';
        aWindow.__SSi = this._generateWindowID();
      }

      let restoreID = WINDOW_RESTORE_IDS.get(aWindow);
      this._windows[aWindow.__SSi] = this._statesToRestore[
        restoreID
      ].windows[0];
      delete this._statesToRestore[restoreID];
      WINDOW_RESTORE_IDS.delete(aWindow);
    }

    // ignore windows not tracked by SessionStore
    if (!aWindow.__SSi || !this._windows[aWindow.__SSi]) {
__L_V__5({
    lN: 1587,tT:'if',pr:'!aWindow.__SSi || !this._windows[aWindow.__SSi]',eT:{},fN:''
  });'__L_V__5';
      return completionPromise;
    }

    // notify that the session store will stop tracking this window so that
    // extensions can store any data about this window in session store before
    // that's not possible anymore
    let event = aWindow.document.createEvent("Events");
    event.initEvent("SSWindowClosing", true, false);
    aWindow.dispatchEvent(event);

    if (this.windowToFocus && this.windowToFocus == aWindow) {
__L_V__5({
    lN: 1598,tT:'if',pr:'this.windowToFocus && this.windowToFocus == aWindow',eT:{},fN:''
  });'__L_V__5';
      delete this.windowToFocus;
    }

    var tabbrowser = aWindow.gBrowser;

    let browsers = Array.from(tabbrowser.browsers);

    TAB_EVENTS.forEach(function(aEvent) {
      tabbrowser.tabContainer.removeEventListener(aEvent, this, true);
    }, this);

    aWindow.gBrowser.removeEventListener("XULFrameLoaderCreated", this);
    aWindow.gBrowser.removeEventListener("BrowserChangedProcess", this);

    let winData = this._windows[aWindow.__SSi];

    // Collect window data only when *not* closed during shutdown.
    if (RunState.isRunning) {
__L_V__5({
    lN: 1616,tT:'if',pr:'RunState.isRunning',eT:{},fN:''
  });'__L_V__5';
      // Grab the most recent window data. The tab data will be updated
      // once we finish flushing all of the messages from the tabs.
      let tabMap = this._collectWindowData(aWindow);

      for (let [tab, tabData] of tabMap) {
        let permanentKey = tab.linkedBrowser.permanentKey;
        this._closedWindowTabs.set(permanentKey, tabData);
      }

      if (isFullyLoaded) {
__L_V__5({
    lN: 1626,tT:'if',pr:'isFullyLoaded',eT:{},fN:''
  });'__L_V__5';
        winData.title =
          tabbrowser.selectedBrowser.contentTitle ||
          tabbrowser.selectedTab.label;
      }

      if (AppConstants.platform != "macosx") {
__L_V__5({
    lN: 1632,tT:'if',pr:'AppConstants.platform != macosx',eT:{},fN:''
  });'__L_V__5';
        // Until we decide otherwise elsewhere, this window is part of a series
        // of closing windows to quit.
        winData._shouldRestore = true;
      }

      // Store the window's close date to figure out when each individual tab
      // was closed. This timestamp should allow re-arranging data based on how
      // recently something was closed.
      winData.closedAt = Date.now();

      // we don't want to save the busy state
      delete winData.busy;

      // When closing windows one after the other until Firefox quits, we
      // will move those closed in series back to the "open windows" bucket
      // before writing to disk. If however there is only a single window
      // with tabs we deem not worth saving then we might end up with a
      // random closed or even a pop-up window re-opened. To prevent that
      // we explicitly allow saving an "empty" window state.
      let isLastWindow =
        Object.keys(this._windows).length == 1 &&
        !this._closedWindows.some(win => win._shouldRestore || false);

      // clear this window from the list, since it has definitely been closed.
      delete this._windows[aWindow.__SSi];

      // This window has the potential to be saved in the _closedWindows
      // array (maybeSaveClosedWindows gets the final call on that).
      this._saveableClosedWindowData.add(winData);

      // Now we have to figure out if this window is worth saving in the _closedWindows
      // Object.
      //
      // We're about to flush the tabs from this window, but it's possible that we
      // might never hear back from the content process(es) in time before the user
      // chooses to restore the closed window. So we do the following:
      //
      // 1) Use the tab state cache to determine synchronously if the window is
      //    worth stashing in _closedWindows.
      // 2) Flush the window.
      // 3) When the flush is complete, revisit our decision to store the window
      //    in _closedWindows, and add/remove as necessary.
      if (!winData.isPrivate) {
__L_V__5({
    lN: 1675,tT:'if',pr:'!winData.isPrivate',eT:{},fN:''
  });'__L_V__5';
        // Remove any open private tabs the window may contain.
        PrivacyFilter.filterPrivateTabs(winData);
        this.maybeSaveClosedWindow(winData, isLastWindow);
      }

      completionPromise = TabStateFlusher.flushWindow(aWindow).then(() => {
        // At this point, aWindow is closed! You should probably not try to
        // access any DOM elements from aWindow within this callback unless
        // you're holding on to them in the closure.

        for (let browser of browsers) {
          if (this._closedWindowTabs.has(browser.permanentKey)) {
__L_V__5({
    lN: 1687,tT:'if',pr:'this._closedWindowTabs.has(browser.permanentKey)',eT:{},fN:''
  });'__L_V__5';
            let tabData = this._closedWindowTabs.get(browser.permanentKey);
            TabState.copyFromCache(browser, tabData);
            this._closedWindowTabs.delete(browser.permanentKey);
          }
        }

        // Save non-private windows if they have at
        // least one saveable tab or are the last window.
        if (!winData.isPrivate) {
__L_V__5({
    lN: 1696,tT:'if',pr:'!winData.isPrivate',eT:{},fN:''
  });'__L_V__5';
          // It's possible that a tab switched its privacy state at some point
          // before our flush, so we need to filter again.
          PrivacyFilter.filterPrivateTabs(winData);
          this.maybeSaveClosedWindow(winData, isLastWindow);
        }

        // Update the tabs data now that we've got the most
        // recent information.
        this.cleanUpWindow(aWindow, winData, browsers);

        // save the state without this window to disk
        this.saveStateDelayed();
      });
    } else {
      this.cleanUpWindow(aWindow, winData, browsers);
    }

    for (let i = 0; i < tabbrowser.tabs.length; i++) {
      this.onTabRemove(aWindow, tabbrowser.tabs[i], true);
    }

    return completionPromise;
  },

  /**
   * Clean up the message listeners on a window that has finally
   * gone away. Call this once you're sure you don't want to hear
   * from any of this windows tabs from here forward.
   *
   * @param aWindow
   *        The browser window we're cleaning up.
   * @param winData
   *        The data for the window that we should hold in the
   *        DyingWindowCache in case anybody is still holding a
   *        reference to it.
   */
  cleanUpWindow(aWindow, winData, browsers) {
__L_V__5({
    lN: 1733,tT:'func',pr:'',eT:{'aWindow':aWindow,'winData':winData,'browsers':browsers},fN:'cleanUpWindow'
  });'__L_V__5';
    // Any leftover TabStateFlusher Promises need to be resolved now,
    // since we're about to remove the message listeners.
    for (let browser of browsers) {
      TabStateFlusher.resolveAll(browser);
    }

    // Cache the window state until it is completely gone.
    DyingWindowCache.set(aWindow, winData);

    let mm = aWindow.getGroupMessageManager("browsers");
    MESSAGES.forEach(msg => mm.removeMessageListener(msg, this));

    this._saveableClosedWindowData.delete(winData);
    delete aWindow.__SSi;
  },

  /**
   * Decides whether or not a closed window should be put into the
   * _closedWindows Object. This might be called multiple times per
   * window, and will do the right thing of moving the window data
   * in or out of _closedWindows if the winData indicates that our
   * need for saving it has changed.
   *
   * @param winData
   *        The data for the closed window that we might save.
   * @param isLastWindow
   *        Whether or not the window being closed is the last
   *        browser window. Callers of this function should pass
   *        in the value of SessionStoreInternal.atLastWindow for
   *        this argument, and pass in the same value if they happen
   *        to call this method again asynchronously (for example, after
   *        a window flush).
   */
  maybeSaveClosedWindow(winData, isLastWindow) {
__L_V__5({
    lN: 1767,tT:'func',pr:'',eT:{'winData':winData,'isLastWindow':isLastWindow},fN:'maybeSaveClosedWindow'
  });'__L_V__5';
    // Make sure SessionStore is still running, and make sure that we
    // haven't chosen to forget this window.
    if (RunState.isRunning && this._saveableClosedWindowData.has(winData)) {
__L_V__5({
    lN: 1770,tT:'if',pr:'RunState.isRunning && this._saveableClosedWindowData.has(winData)',eT:{},fN:''
  });'__L_V__5';
      // Determine whether the window has any tabs worth saving.
      let hasSaveableTabs = winData.tabs.some(this._shouldSaveTabState);

      // Note that we might already have this window stored in
      // _closedWindows from a previous call to this function.
      let winIndex = this._closedWindows.indexOf(winData);
      let alreadyStored = winIndex != -1;
      let shouldStore = hasSaveableTabs || isLastWindow;

      if (shouldStore && !alreadyStored) {
__L_V__5({
    lN: 1780,tT:'if',pr:'shouldStore && !alreadyStored',eT:{},fN:''
  });'__L_V__5';
        let index = this._closedWindows.findIndex(win => {
          return win.closedAt < winData.closedAt;
        });

        // If we found no tab closed before our
        // tab then just append it to the list.
        if (index == -1) {
__L_V__5({
    lN: 1787,tT:'if',pr:'index == -1',eT:{},fN:''
  });'__L_V__5';
          index = this._closedWindows.length;
        }

        // About to save the closed window, add a unique ID.
        winData.closedId = this._nextClosedId++;

        // Insert tabData at the right position.
        this._closedWindows.splice(index, 0, winData);
        this._capClosedWindows();
        this._closedObjectsChanged = true;
      } else if (!shouldStore && alreadyStored) {
__L_V__5({
    lN: 1798,tT:'if',pr:'!shouldStore && alreadyStored',eT:{},fN:''
  });'__L_V__5';
        this._removeClosedWindow(winIndex);
      }
    }
  },

  /**
   * On quit application granted
   */
  onQuitApplicationGranted: function ssi_onQuitApplicationGranted(
    syncShutdown = false
  ) {
__L_V__5({
    lN: 1809,tT:'func',pr:'',eT:{'syncShutdown':syncShutdown},fN:'ssi_onQuitApplicationGranted'
  });'__L_V__5';
    // Collect an initial snapshot of window data before we do the flush.
    let index = 0;
    for (let window of this._orderedBrowserWindows) {
      this._collectWindowData(window);
      this._windows[window.__SSi].zIndex = ++index;
    }

    // Now add an AsyncShutdown blocker that'll spin the event loop
    // until the windows have all been flushed.

    // This progress object will track the state of async window flushing
    // and will help us debug things that go wrong with our AsyncShutdown
    // blocker.
    let progress = { total: -1, current: -1 };

    // We're going down! Switch state so that we treat closing windows and
    // tabs correctly.
    RunState.setQuitting();

    if (!syncShutdown) {
__L_V__5({
    lN: 1829,tT:'if',pr:'!syncShutdown',eT:{},fN:''
  });'__L_V__5';
      // We've got some time to shut down, so let's do this properly that there
      // will be a complete session available upon next startup.
      // To prevent a blocker from taking longer than the DELAY_CRASH_MS limit
      // (which will cause a crash) of AsyncShutdown whilst flushing all windows,
      // we resolve the Promise blocker once:
      // 1. the flush duration exceeds 10 seconds before DELAY_CRASH_MS, or
      // 2. 'oop-frameloader-crashed', or
      // 3. 'ipc:content-shutdown' is observed.
      AsyncShutdown.quitApplicationGranted.addBlocker(
        "SessionStore: flushing all windows",
        () => {
          // Set up the list of promises that will signal a complete sessionstore
          // shutdown: either all data is saved, or we crashed or the message IPC
          // channel went away in the meantime.
          let promises = [this.flushAllWindowsAsync(progress)];

          const observeTopic = topic => {
            let deferred = PromiseUtils.defer();
            const cleanup = () => {
              try {
                Services.obs.removeObserver(deferred.resolve, topic);
              } catch (ex) {
                Cu.reportError(
                  "SessionStore: exception whilst flushing all windows: " + ex
                );
              }
            };
            Services.obs.addObserver(subject => {
              // Skip abort on ipc:content-shutdown if not abnormal/crashed
              subject.QueryInterface(Ci.nsIPropertyBag2);
              if (
                !(topic == "ipc:content-shutdown" && !subject.get("abnormal"))
              ) {
__L_V__5({
    lN: 1862,tT:'if',pr:' !(topic == ipc:content-shutdown && !subject.get(abnormal)) ',eT:{},fN:''
  });'__L_V__5';
                deferred.resolve();
              }
            }, topic);
            deferred.promise.then(cleanup, cleanup);
            return deferred;
          };

          // Build a list of deferred executions that require cleanup once the
          // Promise race is won.
          // Ensure that the timer fires earlier than the AsyncShutdown crash timer.
          let waitTimeMaxMs = Math.max(0, AsyncShutdown.DELAY_CRASH_MS - 10000);
          let defers = [
            this.looseTimer(waitTimeMaxMs),
            observeTopic("oop-frameloader-crashed"),
            observeTopic("ipc:content-shutdown"),
          ];
          // Add these monitors to the list of Promises to start the race.
          promises.push(...defers.map(deferred => deferred.promise));

          return Promise.race(promises).then(() => {
            // When a Promise won the race, make sure we clean up the running
            // monitors.
            defers.forEach(deferred => deferred.reject());
          });
        },
        () => progress
      );
    } else {
      // We have to shut down NOW, which means we only get to save whatever
      // we already had cached.
    }
  },

  /**
   * An async Task that iterates all open browser windows and flushes
   * any outstanding messages from their tabs. This will also close
   * all of the currently open windows while we wait for the flushes
   * to complete.
   *
   * @param progress (Object)
   *        Optional progress object that will be updated as async
   *        window flushing progresses. flushAllWindowsSync will
   *        write to the following properties:
   *
   *        total (int):
   *          The total number of windows to be flushed.
   *        current (int):
   *          The current window that we're waiting for a flush on.
   *
   * @return Promise
   */
  async flushAllWindowsAsync(progress = {}) {
__L_V__5({
    lN: 1914,tT:'func',pr:'',eT:{'progress':progress},fN:'flushAllWindowsAsync'
  });'__L_V__5';
    let windowPromises = new Map();
    // We collect flush promises and close each window immediately so that
    // the user can't start changing any window state while we're waiting
    // for the flushes to finish.
    for (let window of this._browserWindows) {
      windowPromises.set(window, TabStateFlusher.flushWindow(window));

      // We have to wait for these messages to come up from
      // each window and each browser. In the meantime, hide
      // the windows to improve perceived shutdown speed.
      let baseWin = window.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
      baseWin.visibility = false;
    }

    progress.total = windowPromises.size;
    progress.current = 0;

    // We'll iterate through the Promise array, yielding each one, so as to
    // provide useful progress information to AsyncShutdown.
    for (let [win, promise] of windowPromises) {
      await promise;
      this._collectWindowData(win);
      progress.current++;
    }

    // We must cache this because _getTopWindow will always
    // return null by the time quit-application occurs.
    var activeWindow = this._getTopWindow();
    if (activeWindow) {
__L_V__5({
    lN: 1943,tT:'if',pr:'activeWindow',eT:{},fN:''
  });'__L_V__5';
      this.activeWindowSSiCache = activeWindow.__SSi || "";
    }
    DirtyWindows.clear();
  },

  /**
   * On last browser window close
   */
  onLastWindowCloseGranted: function ssi_onLastWindowCloseGranted() {
__L_V__5({
    lN: 1952,tT:'func',pr:'',eT:{},fN:'ssi_onLastWindowCloseGranted'
  });'__L_V__5';
    // last browser window is quitting.
    // remember to restore the last window when another browser window is opened
    // do not account for pref(resume_session_once) at this point, as it might be
    // set by another observer getting this notice after us
    this._restoreLastWindow = true;
  },

  /**
   * On quitting application
   * @param aData
   *        String type of quitting
   */
  onQuitApplication: function ssi_onQuitApplication(aData) {
__L_V__5({
    lN: 1965,tT:'func',pr:'',eT:{'aData':aData},fN:'ssi_onQuitApplication'
  });'__L_V__5';
    if (aData == "restart" || aData == "os-restart") {
__L_V__5({
    lN: 1966,tT:'if',pr:'aData == restart || aData == os-restart',eT:{},fN:''
  });'__L_V__5';
      if (!PrivateBrowsingUtils.permanentPrivateBrowsing) {
__L_V__5({
    lN: 1967,tT:'if',pr:'!PrivateBrowsingUtils.permanentPrivateBrowsing',eT:{},fN:''
  });'__L_V__5';
        if (
          aData == "os-restart" &&
          !this._prefBranch.getBoolPref("sessionstore.resume_session_once")
        ) {
__L_V__5({
    lN: 1971,tT:'if',pr:' aData == os-restart && !this._prefBranch.getBoolPref(sessionstore.resume_session_once) ',eT:{},fN:''
  });'__L_V__5';
          this._prefBranch.setBoolPref(
            "sessionstore.resuming_after_os_restart",
            true
          );
        }
        this._prefBranch.setBoolPref("sessionstore.resume_session_once", true);
      }

      // The browser:purge-session-history notification fires after the
      // quit-application notification so unregister the
      // browser:purge-session-history notification to prevent clearing
      // session data on disk on a restart.  It is also unnecessary to
      // perform any other sanitization processing on a restart as the
      // browser is about to exit anyway.
      Services.obs.removeObserver(this, "browser:purge-session-history");
    }

    if (aData != "restart") {
__L_V__5({
    lN: 1989,tT:'if',pr:'aData != restart',eT:{},fN:''
  });'__L_V__5';
      // Throw away the previous session on shutdown without notification
      LastSession.clear(true);
    }

    this._uninit();
  },

  /**
   * On purge of session history
   */
  onPurgeSessionHistory: function ssi_onPurgeSessionHistory() {
__L_V__5({
    lN: 2000,tT:'func',pr:'',eT:{},fN:'ssi_onPurgeSessionHistory'
  });'__L_V__5';
    SessionFile.wipe();
    // If the browser is shutting down, simply return after clearing the
    // session data on disk as this notification fires after the
    // quit-application notification so the browser is about to exit.
    if (RunState.isQuitting) {
__L_V__5({
    lN: 2005,tT:'if',pr:'RunState.isQuitting',eT:{},fN:''
  });'__L_V__5';
      return;
    }
    LastSession.clear();

    let openWindows = {};
    // Collect open windows.
    for (let window of this._browserWindows) {
      openWindows[window.__SSi] = true;
    }

    // also clear all data about closed tabs and windows
    for (let ix in this._windows) {
      if (ix in openWindows) {
__L_V__5({
    lN: 2018,tT:'if',pr:'ix in openWindows',eT:{},fN:''
  });'__L_V__5';
        if (this._windows[ix]._closedTabs.length) {
__L_V__5({
    lN: 2019,tT:'if',pr:'this._windows[ix]._closedTabs.length',eT:{},fN:''
  });'__L_V__5';
          this._windows[ix]._closedTabs = [];
          this._closedObjectsChanged = true;
        }
      } else {
        delete this._windows[ix];
      }
    }
    // also clear all data about closed windows
    if (this._closedWindows.length) {
__L_V__5({
    lN: 2028,tT:'if',pr:'this._closedWindows.length',eT:{},fN:''
  });'__L_V__5';
      this._closedWindows = [];
      this._closedObjectsChanged = true;
    }
    // give the tabbrowsers a chance to clear their histories first
    var win = this._getTopWindow();
    if (win) {
__L_V__5({
    lN: 2034,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__5';
      win.setTimeout(() => SessionSaver.run(), 0);
    } else if (RunState.isRunning) {
__L_V__5({
    lN: 2036,tT:'if',pr:'RunState.isRunning',eT:{},fN:''
  });'__L_V__5';
      SessionSaver.run();
    }

    this._clearRestoringWindows();
    this._saveableClosedWindowData = new WeakSet();
  },

  /**
   * On purge of domain data
   * @param aData
   *        String domain data
   */
  onPurgeDomainData: function ssi_onPurgeDomainData(aData) {
__L_V__5({
    lN: 2049,tT:'func',pr:'',eT:{'aData':aData},fN:'ssi_onPurgeDomainData'
  });'__L_V__5';
    // does a session history entry contain a url for the given domain?
    function containsDomain(aEntry) {
__L_V__5({
    lN: 2051,tT:'func',pr:'',eT:{'aEntry':aEntry},fN:'containsDomain'
  });'__L_V__5';
      if (Utils.hasRootDomain(aEntry.url, aData)) {
__L_V__5({
    lN: 2052,tT:'if',pr:'Utils.hasRootDomain(aEntry.url, aData)',eT:{},fN:''
  });'__L_V__5';
        return true;
      }
      return aEntry.children && aEntry.children.some(containsDomain, this);
    }
    // remove all closed tabs containing a reference to the given domain
    for (let ix in this._windows) {
      let closedTabs = this._windows[ix]._closedTabs;
      for (let i = closedTabs.length - 1; i >= 0; i--) {
        if (closedTabs[i].state.entries.some(containsDomain, this)) {
__L_V__5({
    lN: 2061,tT:'if',pr:'closedTabs[i].state.entries.some(containsDomain, this)',eT:{},fN:''
  });'__L_V__5';
          closedTabs.splice(i, 1);
          this._closedObjectsChanged = true;
        }
      }
    }
    // remove all open & closed tabs containing a reference to the given
    // domain in closed windows
    for (let ix = this._closedWindows.length - 1; ix >= 0; ix--) {
      let closedTabs = this._closedWindows[ix]._closedTabs;
      let openTabs = this._closedWindows[ix].tabs;
      let openTabCount = openTabs.length;
      for (let i = closedTabs.length - 1; i >= 0; i--) {
        if (closedTabs[i].state.entries.some(containsDomain, this)) {
__L_V__5({
    lN: 2074,tT:'if',pr:'closedTabs[i].state.entries.some(containsDomain, this)',eT:{},fN:''
  });'__L_V__5';
          closedTabs.splice(i, 1);
        }
      }
      for (let j = openTabs.length - 1; j >= 0; j--) {
        if (openTabs[j].entries.some(containsDomain, this)) {
__L_V__5({
    lN: 2079,tT:'if',pr:'openTabs[j].entries.some(containsDomain, this)',eT:{},fN:''
  });'__L_V__5';
          openTabs.splice(j, 1);
          if (this._closedWindows[ix].selected > j) {
__L_V__5({
    lN: 2081,tT:'if',pr:'this._closedWindows[ix].selected > j',eT:{},fN:''
  });'__L_V__5';
            this._closedWindows[ix].selected--;
          }
        }
      }
      if (!openTabs.length) {
__L_V__5({
    lN: 2086,tT:'if',pr:'!openTabs.length',eT:{},fN:''
  });'__L_V__5';
        this._closedWindows.splice(ix, 1);
      } else if (openTabs.length != openTabCount) {
__L_V__5({
    lN: 2088,tT:'if',pr:'openTabs.length != openTabCount',eT:{},fN:''
  });'__L_V__5';
        // Adjust the window's title if we removed an open tab
        let selectedTab = openTabs[this._closedWindows[ix].selected - 1];
        // some duplication from restoreHistory - make sure we get the correct title
        let activeIndex = (selectedTab.index || selectedTab.entries.length) - 1;
        if (activeIndex >= selectedTab.entries.length) {
__L_V__5({
    lN: 2093,tT:'if',pr:'activeIndex >= selectedTab.entries.length',eT:{},fN:''
  });'__L_V__5';
          activeIndex = selectedTab.entries.length - 1;
        }
        this._closedWindows[ix].title = selectedTab.entries[activeIndex].title;
      }
    }

    if (RunState.isRunning) {
__L_V__5({
    lN: 2100,tT:'if',pr:'RunState.isRunning',eT:{},fN:''
  });'__L_V__5';
      SessionSaver.run();
    }

    this._clearRestoringWindows();
  },

  /**
   * On preference change
   * @param aData
   *        String preference changed
   */
  onPrefChange: function ssi_onPrefChange(aData) {
__L_V__5({
    lN: 2112,tT:'func',pr:'',eT:{'aData':aData},fN:'ssi_onPrefChange'
  });'__L_V__5';
__L_V__5({
    lN: 2113,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';
    switch (aData) {
      // if the user decreases the max number of closed tabs they want
      // preserved update our internal states to match that max
      case "sessionstore.max_tabs_undo":
        this._max_tabs_undo = this._prefBranch.getIntPref(
          "sessionstore.max_tabs_undo"
        );
        for (let ix in this._windows) {
          if (this._windows[ix]._closedTabs.length > this._max_tabs_undo) {
__L_V__5({
    lN: 2121,tT:'if',pr:'this._windows[ix]._closedTabs.length > this._max_tabs_undo',eT:{},fN:''
  });'__L_V__5';
            this._windows[ix]._closedTabs.splice(
              this._max_tabs_undo,
              this._windows[ix]._closedTabs.length
            );
            this._closedObjectsChanged = true;
          }
        }
        break;
      case "sessionstore.max_windows_undo":
        this._max_windows_undo = this._prefBranch.getIntPref(
          "sessionstore.max_windows_undo"
        );
        this._capClosedWindows();
        break;
      case "privacy.resistFingerprinting":
        gResistFingerprintingEnabled = Services.prefs.getBoolPref(
          "privacy.resistFingerprinting"
        );
        break;
      case "sessionstore.restore_on_demand":
        this._restore_on_demand = this._prefBranch.getBoolPref(
          "sessionstore.restore_on_demand"
        );
        break;
    }
  },

  /**
   * save state when new tab is added
   * @param aWindow
   *        Window reference
   */
  onTabAdd: function ssi_onTabAdd(aWindow) {
__L_V__5({
    lN: 2154,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_onTabAdd'
  });'__L_V__5';
    this.saveStateDelayed(aWindow);
  },

  /**
   * set up listeners for a new tab
   * @param aWindow
   *        Window reference
   * @param aTab
   *        Tab reference
   */
  onTabBrowserInserted: function ssi_onTabBrowserInserted(aWindow, aTab) {
__L_V__5({
    lN: 2165,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab},fN:'ssi_onTabBrowserInserted'
  });'__L_V__5';
    let browser = aTab.linkedBrowser;
    browser.addEventListener("SwapDocShells", this);
    browser.addEventListener("oop-browser-crashed", this);
    browser.addEventListener("oop-browser-buildid-mismatch", this);

    if (browser.frameLoader) {
__L_V__5({
    lN: 2171,tT:'if',pr:'browser.frameLoader',eT:{},fN:''
  });'__L_V__5';
      this._lastKnownFrameLoader.set(browser.permanentKey, browser.frameLoader);
    }

    // Only restore if browser has been lazy.
    if (
      TAB_LAZY_STATES.has(aTab) &&
      !TAB_STATE_FOR_BROWSER.has(browser) &&
      TabStateCache.get(browser)
    ) {
__L_V__5({
    lN: 2180,tT:'if',pr:' TAB_LAZY_STATES.has(aTab) && !TAB_STATE_FOR_BROWSER.has(browser) && TabStateCache.get(browser) ',eT:{},fN:''
  });'__L_V__5';
      let tabState = TabState.clone(aTab, TAB_CUSTOM_VALUES.get(aTab));
      this.restoreTab(aTab, tabState);
    }

    // The browser has been inserted now, so lazy data is no longer relevant.
    TAB_LAZY_STATES.delete(aTab);
  },

  /**
   * remove listeners for a tab
   * @param aWindow
   *        Window reference
   * @param aTab
   *        Tab reference
   * @param aNoNotification
   *        bool Do not save state if we're updating an existing tab
   */
  onTabRemove: function ssi_onTabRemove(aWindow, aTab, aNoNotification) {
__L_V__5({
    lN: 2198,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab,'aNoNotification':aNoNotification},fN:'ssi_onTabRemove'
  });'__L_V__5';
    this.cleanUpRemovedBrowser(aTab);

    if (!aNoNotification) {
__L_V__5({
    lN: 2201,tT:'if',pr:'!aNoNotification',eT:{},fN:''
  });'__L_V__5';
      this.saveStateDelayed(aWindow);
    }
  },

  /**
   * When a tab closes, collect its properties
   * @param aWindow
   *        Window reference
   * @param aTab
   *        Tab reference
   */
  onTabClose: function ssi_onTabClose(aWindow, aTab) {
__L_V__5({
    lN: 2213,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab},fN:'ssi_onTabClose'
  });'__L_V__5';
    // notify the tabbrowser that the tab state will be retrieved for the last time
    // (so that extension authors can easily set data on soon-to-be-closed tabs)
    var event = aWindow.document.createEvent("Events");
    event.initEvent("SSTabClosing", true, false);
    aTab.dispatchEvent(event);

    // don't update our internal state if we don't have to
    if (this._max_tabs_undo == 0) {
__L_V__5({
    lN: 2221,tT:'if',pr:'this._max_tabs_undo == 0',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // Get the latest data for this tab (generally, from the cache)
    let tabState = TabState.collect(aTab, TAB_CUSTOM_VALUES.get(aTab));

    // Don't save private tabs
    let isPrivateWindow = PrivateBrowsingUtils.isWindowPrivate(aWindow);
    if (!isPrivateWindow && tabState.isPrivate) {
__L_V__5({
    lN: 2230,tT:'if',pr:'!isPrivateWindow && tabState.isPrivate',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // Store closed-tab data for undo.
    let tabbrowser = aWindow.gBrowser;
    let tabTitle = aTab.label;
    let { permanentKey } = aTab.linkedBrowser;

    let tabData = {
      permanentKey,
      state: tabState,
      title: tabTitle,
      image: tabbrowser.getIcon(aTab),
      pos: aTab._tPos,
      closedAt: Date.now(),
    };

    let closedTabs = this._windows[aWindow.__SSi]._closedTabs;

    // Determine whether the tab contains any information worth saving. Note
    // that there might be pending state changes queued in the child that
    // didn't reach the parent yet. If a tab is emptied before closing then we
    // might still remove it from the list of closed tabs later.
    if (this._shouldSaveTabState(tabState)) {
__L_V__5({
    lN: 2254,tT:'if',pr:'this._shouldSaveTabState(tabState)',eT:{},fN:''
  });'__L_V__5';
      // Save the tab state, for now. We might push a valid tab out
      // of the list but those cases should be extremely rare and
      // do probably never occur when using the browser normally.
      // (Tests or add-ons might do weird things though.)
      this.saveClosedTabData(closedTabs, tabData);
    }

    // Remember the closed tab to properly handle any last updates included in
    // the final "update" message sent by the frame script's unload handler.
    this._closedTabs.set(permanentKey, { closedTabs, tabData });
  },

  /**
   * Remove listeners which were added when browser was inserted and reset restoring state.
   * Also re-instate lazy data and basically revert tab to its lazy browser state.
   * @param aTab
   *        Tab reference
   */
  resetBrowserToLazyState(aTab) {
__L_V__5({
    lN: 2273,tT:'func',pr:'',eT:{'aTab':aTab},fN:'resetBrowserToLazyState'
  });'__L_V__5';
    let browser = aTab.linkedBrowser;
    // Browser is already lazy so don't do anything.
    if (!browser.isConnected) {
__L_V__5({
    lN: 2276,tT:'if',pr:'!browser.isConnected',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    this.cleanUpRemovedBrowser(aTab);

    aTab.setAttribute("pending", "true");

    this._lastKnownFrameLoader.delete(browser.permanentKey);
    this._crashedBrowsers.delete(browser.permanentKey);
    aTab.removeAttribute("crashed");

    let { userTypedValue = "", userTypedClear = 0 } = browser;

    let cacheState = TabStateCache.get(browser);
    if (cacheState === undefined && userTypedValue) {
__L_V__5({
    lN: 2291,tT:'if',pr:'cacheState === undefined && userTypedValue',eT:{},fN:''
  });'__L_V__5';
      // Discard was likely called before state can be cached.  Update
      // the persistent tab state cache with browser information so a
      // restore will be successful.  This information is necessary for
      // restoreTabContent in ContentRestore.jsm to work properly.
      TabStateCache.update(browser, {
        userTypedValue,
        userTypedClear: 1,
      });
    }

    TAB_LAZY_STATES.set(aTab, {
      url: browser.currentURI.spec,
      title: aTab.label,
      userTypedValue,
      userTypedClear,
    });
  },

  /**
   * When a tab is removed or suspended, remove listeners and reset restoring state.
   * @param aBrowser
   *        Browser reference
   */
  cleanUpRemovedBrowser(aTab) {
__L_V__5({
    lN: 2315,tT:'func',pr:'',eT:{'aTab':aTab},fN:'cleanUpRemovedBrowser'
  });'__L_V__5';
    let browser = aTab.linkedBrowser;

    browser.removeEventListener("SwapDocShells", this);
    browser.removeEventListener("oop-browser-crashed", this);
    browser.removeEventListener("oop-browser-buildid-mismatch", this);

    // If this tab was in the middle of restoring or still needs to be restored,
    // we need to reset that state. If the tab was restoring, we will attempt to
    // restore the next tab.
    let previousState = TAB_STATE_FOR_BROWSER.get(browser);
    if (previousState) {
__L_V__5({
    lN: 2326,tT:'if',pr:'previousState',eT:{},fN:''
  });'__L_V__5';
      this._resetTabRestoringState(aTab);
      if (previousState == TAB_STATE_RESTORING) {
__L_V__5({
    lN: 2328,tT:'if',pr:'previousState == TAB_STATE_RESTORING',eT:{},fN:''
  });'__L_V__5';
        this.restoreNextTab();
      }
    }
  },

  /**
   * Insert a given |tabData| object into the list of |closedTabs|. We will
   * determine the right insertion point based on the .closedAt properties of
   * all tabs already in the list. The list will be truncated to contain a
   * maximum of |this._max_tabs_undo| entries.
   *
   * @param closedTabs (array)
   *        The list of closed tabs for a window.
   * @param tabData (object)
   *        The tabData to be inserted.
   */
  saveClosedTabData(closedTabs, tabData) {
__L_V__5({
    lN: 2345,tT:'func',pr:'',eT:{'closedTabs':closedTabs,'tabData':tabData},fN:'saveClosedTabData'
  });'__L_V__5';
    // Find the index of the first tab in the list
    // of closed tabs that was closed before our tab.
    let index = closedTabs.findIndex(tab => {
      return tab.closedAt < tabData.closedAt;
    });

    // If we found no tab closed before our
    // tab then just append it to the list.
    if (index == -1) {
__L_V__5({
    lN: 2354,tT:'if',pr:'index == -1',eT:{},fN:''
  });'__L_V__5';
      index = closedTabs.length;
    }

    // About to save the closed tab, add a unique ID.
    tabData.closedId = this._nextClosedId++;

    // Insert tabData at the right position.
    closedTabs.splice(index, 0, tabData);
    this._closedObjectsChanged = true;

    // Truncate the list of closed tabs, if needed.
    if (closedTabs.length > this._max_tabs_undo) {
__L_V__5({
    lN: 2366,tT:'if',pr:'closedTabs.length > this._max_tabs_undo',eT:{},fN:''
  });'__L_V__5';
      closedTabs.splice(this._max_tabs_undo, closedTabs.length);
    }
  },

  /**
   * Remove the closed tab data at |index| from the list of |closedTabs|. If
   * the tab's final message is still pending we will simply discard it when
   * it arrives so that the tab doesn't reappear in the list.
   *
   * @param closedTabs (array)
   *        The list of closed tabs for a window.
   * @param index (uint)
   *        The index of the tab to remove.
   */
  removeClosedTabData(closedTabs, index) {
__L_V__5({
    lN: 2381,tT:'func',pr:'',eT:{'closedTabs':closedTabs,'index':index},fN:'removeClosedTabData'
  });'__L_V__5';
    // Remove the given index from the list.
    let [closedTab] = closedTabs.splice(index, 1);
    this._closedObjectsChanged = true;

    // If the closed tab's state still has a .permanentKey property then we
    // haven't seen its final update message yet. Remove it from the map of
    // closed tabs so that we will simply discard its last messages and will
    // not add it back to the list of closed tabs again.
    if (closedTab.permanentKey) {
__L_V__5({
    lN: 2390,tT:'if',pr:'closedTab.permanentKey',eT:{},fN:''
  });'__L_V__5';
      this._closedTabs.delete(closedTab.permanentKey);
      this._closedWindowTabs.delete(closedTab.permanentKey);
      delete closedTab.permanentKey;
    }

    return closedTab;
  },

  /**
   * When a tab is selected, save session data
   * @param aWindow
   *        Window reference
   */
  onTabSelect: function ssi_onTabSelect(aWindow) {
__L_V__5({
    lN: 2404,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_onTabSelect'
  });'__L_V__5';
    if (RunState.isRunning) {
__L_V__5({
    lN: 2405,tT:'if',pr:'RunState.isRunning',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi].selected =
        aWindow.gBrowser.tabContainer.selectedIndex;

      let tab = aWindow.gBrowser.selectedTab;
      let browser = tab.linkedBrowser;

      if (TAB_STATE_FOR_BROWSER.get(browser) == TAB_STATE_NEEDS_RESTORE) {
__L_V__5({
    lN: 2412,tT:'if',pr:'TAB_STATE_FOR_BROWSER.get(browser) == TAB_STATE_NEEDS_RESTORE',eT:{},fN:''
  });'__L_V__5';
        // If BROWSER_STATE is still available for the browser and it is
        // If __SS_restoreState is still on the browser and it is
        // TAB_STATE_NEEDS_RESTORE, then then we haven't restored
        // this tab yet.
        //
        // It's possible that this tab was recently revived, and that
        // we've deferred showing the tab crashed page for it (if the
        // tab crashed in the background). If so, we need to re-enter
        // the crashed state, since we'll be showing the tab crashed
        // page.
        if (TabCrashHandler.willShowCrashedTab(browser)) {
__L_V__5({
    lN: 2423,tT:'if',pr:'TabCrashHandler.willShowCrashedTab(browser)',eT:{},fN:''
  });'__L_V__5';
          this.enterCrashedState(browser);
        } else {
          this.restoreTabContent(tab);
        }
      }
    }
  },

  onTabShow: function ssi_onTabShow(aWindow, aTab) {
__L_V__5({
    lN: 2432,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab},fN:'ssi_onTabShow'
  });'__L_V__5';
    // If the tab hasn't been restored yet, move it into the right bucket
    if (
      TAB_STATE_FOR_BROWSER.get(aTab.linkedBrowser) == TAB_STATE_NEEDS_RESTORE
    ) {
__L_V__5({
    lN: 2436,tT:'if',pr:' TAB_STATE_FOR_BROWSER.get(aTab.linkedBrowser) == TAB_STATE_NEEDS_RESTORE ',eT:{},fN:''
  });'__L_V__5';
      TabRestoreQueue.hiddenToVisible(aTab);

      // let's kick off tab restoration again to ensure this tab gets restored
      // with "restore_hidden_tabs" == false (now that it has become visible)
      this.restoreNextTab();
    }

    // Default delay of 2 seconds gives enough time to catch multiple TabShow
    // events. This used to be due to changing groups in 'tab groups'. We
    // might be able to get rid of this now?
    this.saveStateDelayed(aWindow);
  },

  onTabHide: function ssi_onTabHide(aWindow, aTab) {
__L_V__5({
    lN: 2450,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab},fN:'ssi_onTabHide'
  });'__L_V__5';
    // If the tab hasn't been restored yet, move it into the right bucket
    if (
      TAB_STATE_FOR_BROWSER.get(aTab.linkedBrowser) == TAB_STATE_NEEDS_RESTORE
    ) {
__L_V__5({
    lN: 2454,tT:'if',pr:' TAB_STATE_FOR_BROWSER.get(aTab.linkedBrowser) == TAB_STATE_NEEDS_RESTORE ',eT:{},fN:''
  });'__L_V__5';
      TabRestoreQueue.visibleToHidden(aTab);
    }

    // Default delay of 2 seconds gives enough time to catch multiple TabHide
    // events. This used to be due to changing groups in 'tab groups'. We
    // might be able to get rid of this now?
    this.saveStateDelayed(aWindow);
  },

  /**
   * Handler for the event that is fired when a <xul:browser> crashes.
   *
   * @param aWindow
   *        The window that the crashed browser belongs to.
   * @param aBrowser
   *        The <xul:browser> that is now in the crashed state.
   */
  onBrowserCrashed(aBrowser) {
__L_V__5({
    lN: 2472,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'onBrowserCrashed'
  });'__L_V__5';
    this.enterCrashedState(aBrowser);
    // The browser crashed so we might never receive flush responses.
    // Resolve all pending flush requests for the crashed browser.
    TabStateFlusher.resolveAll(aBrowser);
  },

  /**
   * Called when a browser is showing or is about to show the tab
   * crashed page. This method causes SessionStore to ignore the
   * tab until it's restored.
   *
   * @param browser
   *        The <xul:browser> that is about to show the crashed page.
   */
  enterCrashedState(browser) {
__L_V__5({
    lN: 2487,tT:'func',pr:'',eT:{'browser':browser},fN:'enterCrashedState'
  });'__L_V__5';
    this._crashedBrowsers.add(browser.permanentKey);

    let win = browser.ownerGlobal;

    // If we hadn't yet restored, or were still in the midst of
    // restoring this browser at the time of the crash, we need
    // to reset its state so that we can try to restore it again
    // when the user revives the tab from the crash.
    if (TAB_STATE_FOR_BROWSER.has(browser)) {
__L_V__5({
    lN: 2496,tT:'if',pr:'TAB_STATE_FOR_BROWSER.has(browser)',eT:{},fN:''
  });'__L_V__5';
      let tab = win.gBrowser.getTabForBrowser(browser);
      this._resetLocalTabRestoringState(tab);
    }
  },

  // Clean up data that has been closed a long time ago.
  // Do not reschedule a save. This will wait for the next regular
  // save.
  onIdleDaily() {
__L_V__5({
    lN: 2505,tT:'func',pr:'',eT:{},fN:'onIdleDaily'
  });'__L_V__5';
    // Remove old closed windows
    this._cleanupOldData([this._closedWindows]);

    // Remove closed tabs of closed windows
    this._cleanupOldData(
      this._closedWindows.map(winData => winData._closedTabs)
    );

    // Remove closed tabs of open windows
    this._cleanupOldData(
      Object.keys(this._windows).map(key => this._windows[key]._closedTabs)
    );

    this._notifyOfClosedObjectsChange();
  },

  // Remove "old" data from an array
  _cleanupOldData(targets) {
__L_V__5({
    lN: 2523,tT:'func',pr:'',eT:{'targets':targets},fN:'_cleanupOldData'
  });'__L_V__5';
    const TIME_TO_LIVE = this._prefBranch.getIntPref(
      "sessionstore.cleanup.forget_closed_after"
    );
    const now = Date.now();

    for (let array of targets) {
      for (let i = array.length - 1; i >= 0; --i) {
        let data = array[i];
        // Make sure that we have a timestamp to tell us when the target
        // has been closed. If we don't have a timestamp, default to a
        // safe timestamp: just now.
        data.closedAt = data.closedAt || now;
        if (now - data.closedAt > TIME_TO_LIVE) {
__L_V__5({
    lN: 2536,tT:'if',pr:'now - data.closedAt > TIME_TO_LIVE',eT:{},fN:''
  });'__L_V__5';
          array.splice(i, 1);
          this._closedObjectsChanged = true;
        }
      }
    }
  },

  async _doTabProcessSwitch(
    aBrowser,
    aRemoteType,
    aChannel,
    aSwitchId,
    aReplaceBrowsingContext
  ) {
__L_V__5({
    lN: 2550,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aRemoteType':aRemoteType,'aChannel':aChannel,'aSwitchId':aSwitchId,'aReplaceBrowsingContext':aReplaceBrowsingContext},fN:'_doTabProcessSwitch'
  });'__L_V__5';
    debug(
      `[process-switch]: performing switch from ${aBrowser.remoteType} to ${aRemoteType}`
    );

    // Don't try to switch tabs before delayed startup is completed.
    await aBrowser.ownerGlobal.delayedStartupPromise;

    // Perform a navigateAndRestore to trigger the process switch.
    let tab = aBrowser.ownerGlobal.gBrowser.getTabForBrowser(aBrowser);
    let loadArguments = {
      newFrameloader: true, // Switch even if remoteType hasn't changed.
      remoteType: aRemoteType, // Don't derive remoteType to switch to.

      // Information about which channel should be performing the load.
      redirectLoadSwitchId: aSwitchId,

      // True if this is a process switch due to a policy mismatch, means we
      // shouldn't preserve our browsing context.
      replaceBrowsingContext: aReplaceBrowsingContext,
    };

    await SessionStore.navigateAndRestore(tab, loadArguments, -1);

    // If the process switch seems to have failed, send an error over to our
    // caller, to give it a chance to kill our channel.
    if (
      aBrowser.remoteType != aRemoteType ||
      !aBrowser.frameLoader ||
      !aBrowser.frameLoader.remoteTab
    ) {
__L_V__5({
    lN: 2580,tT:'if',pr:' aBrowser.remoteType != aRemoteType || !aBrowser.frameLoader || !aBrowser.frameLoader.remoteTab ',eT:{},fN:''
  });'__L_V__5';
      throw Cr.NS_ERROR_FAILURE;
    }

    // Tell our caller to redirect the load into this newly created process.
    let remoteTab = aBrowser.frameLoader.remoteTab;
    debug(`[process-switch]: new tabID: ${remoteTab.tabId}`);
    return remoteTab.contentProcessId;
  },

  /**
   * Perform a destructive process switch into a distinct process.
   * This method is asynchronous, as it requires multiple calls into content
   * processes.
   */
  async _doProcessSwitch(
    aBrowsingContext,
    aRemoteType,
    aChannel,
    aSwitchId,
    aReplaceBrowsingContext
  ) {
__L_V__5({
    lN: 2601,tT:'func',pr:'',eT:{'aBrowsingContext':aBrowsingContext,'aRemoteType':aRemoteType,'aChannel':aChannel,'aSwitchId':aSwitchId,'aReplaceBrowsingContext':aReplaceBrowsingContext},fN:'_doProcessSwitch'
  });'__L_V__5';
    // There are two relevant cases when performing a process switch for a
    // browsing context: in-process and out-of-process embedders.

    // If our embedder is in-process (e.g. we're a xul:browser element embedded
    // within <tabbrowser>), then we can perform a process switch using the
    // traditional mechanism.
    if (aBrowsingContext.embedderElement) {
__L_V__5({
    lN: 2608,tT:'if',pr:'aBrowsingContext.embedderElement',eT:{},fN:''
  });'__L_V__5';
      return this._doTabProcessSwitch(
        aBrowsingContext.embedderElement,
        aRemoteType,
        aChannel,
        aSwitchId,
        aReplaceBrowsingContext
      );
    }

    return aBrowsingContext.changeFrameRemoteness(aRemoteType, aSwitchId);
  },

  // Examine the channel response to see if we should change the process
  // performing the given load.
  // CLIQZ-TODO
  // DB-2143: we need to remember about this function since
  // we let a prefuseHTTPResponseProcessSelection stay false by default (as in 1.26.x),
  // whilst FF 67.x set it to true intentionally.
  // performing the given load. aRequestor implements nsIProcessSwitchRequestor
  onMayChangeProcess(aRequestor) {
__L_V__5({
    lN: 2628,tT:'func',pr:'',eT:{'aRequestor':aRequestor},fN:'onMayChangeProcess'
  });'__L_V__5';
    if (!E10SUtils.documentChannel()) {
__L_V__5({
    lN: 2629,tT:'if',pr:'!E10SUtils.documentChannel()',eT:{},fN:''
  });'__L_V__5';
      throw new Error("This code is only used by document channel");
    }

    let switchRequestor;
    try {
      switchRequestor = aRequestor.QueryInterface(Ci.nsIProcessSwitchRequestor);
    } catch (e) {
      debug(`[process-switch]: object not compatible with process switching `);
      return;
    }

    const channel = switchRequestor.channel;
    if (!channel.isDocument || !channel.loadInfo) {
__L_V__5({
    lN: 2642,tT:'if',pr:'!channel.isDocument || !channel.loadInfo',eT:{},fN:''
  });'__L_V__5';
      return; // Not a document load.
    }

    // Check that the document has a corresponding BrowsingContext.
    let browsingContext = channel.loadInfo.targetBrowsingContext;
    let isSubframe =
      channel.loadInfo.externalContentPolicyType !=
      Ci.nsIContentPolicy.TYPE_DOCUMENT;

    if (!browsingContext) {
__L_V__5({
    lN: 2652,tT:'if',pr:'!browsingContext',eT:{},fN:''
  });'__L_V__5';
      debug(`[process-switch]: no BrowsingContext - ignoring`);
      return;
    }

    // Determine if remote subframes should be used for this load.
    let topBC = browsingContext.top;
    if (!topBC.embedderElement) {
__L_V__5({
    lN: 2659,tT:'if',pr:'!topBC.embedderElement',eT:{},fN:''
  });'__L_V__5';
      debug(`[process-switch]: no embedder for top - ignoring`);
      return;
    }

    let topDocShell = topBC.embedderElement.ownerGlobal.docShell;
    let { useRemoteSubframes } = topDocShell.QueryInterface(Ci.nsILoadContext);
    if (!useRemoteSubframes && isSubframe) {
__L_V__5({
    lN: 2666,tT:'if',pr:'!useRemoteSubframes && isSubframe',eT:{},fN:''
  });'__L_V__5';
      debug(`[process-switch]: remote subframes disabled - ignoring`);
      return;
    }

    // Get principal for a document already loaded in the BrowsingContext.
    let currentPrincipal = null;
    if (browsingContext.currentWindowGlobal) {
__L_V__5({
    lN: 2673,tT:'if',pr:'browsingContext.currentWindowGlobal',eT:{},fN:''
  });'__L_V__5';
      currentPrincipal = browsingContext.currentWindowGlobal.documentPrincipal;
    }

    // We can only perform a process switch on in-process frames if they are
    // embedded within a normal tab. We can't do one of these swaps for a
    // cross-origin frame.
    if (browsingContext.embedderElement) {
__L_V__5({
    lN: 2680,tT:'if',pr:'browsingContext.embedderElement',eT:{},fN:''
  });'__L_V__5';
      let tabbrowser = browsingContext.embedderElement.getTabBrowser();
      if (!tabbrowser) {
__L_V__5({
    lN: 2682,tT:'if',pr:'!tabbrowser',eT:{},fN:''
  });'__L_V__5';
        debug(
          `[process-switch]: cannot find tabbrowser for loading tab - ignoring`
        );
        return;
      }

      let tab = tabbrowser.getTabForBrowser(browsingContext.embedderElement);
      if (!tab) {
__L_V__5({
    lN: 2690,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__5';
        debug(
          `[process-switch]: not a normal tab, so cannot swap processes - ignoring`
        );
        return;
      }
    } else if (!browsingContext.parent) {
__L_V__5({
    lN: 2696,tT:'if',pr:'!browsingContext.parent',eT:{},fN:''
  });'__L_V__5';
      debug(
        `[process-switch] no parent or in-process embedder element - ignoring`
      );
      return;
    }

    // Get the current remote type for the BrowsingContext.
    let currentRemoteType = browsingContext.currentRemoteType;
    if (currentRemoteType == E10SUtils.NOT_REMOTE) {
__L_V__5({
    lN: 2705,tT:'if',pr:'currentRemoteType == E10SUtils.NOT_REMOTE',eT:{},fN:''
  });'__L_V__5';
      debug(`[process-switch]: currently not remote - ignoring`);
      return;
    }

    // Determine the process type the load should be performed in.
    let resultPrincipal = Services.scriptSecurityManager.getChannelResultPrincipal(
      channel
    );

    const isCOOPSwitch =
      E10SUtils.useCrossOriginOpenerPolicy() &&
      switchRequestor.hasCrossOriginOpenerPolicyMismatch();

    let preferredRemoteType = currentRemoteType;
    if (
      E10SUtils.useCrossOriginOpenerPolicy() &&
      switchRequestor.crossOriginOpenerPolicy ==
        Ci.nsILoadInfo.OPENER_POLICY_SAME_ORIGIN_EMBEDDER_POLICY_REQUIRE_CORP
    ) {
__L_V__5({
    lN: 2724,tT:'if',pr:' E10SUtils.useCrossOriginOpenerPolicy() && switchRequestor.crossOriginOpenerPolicy == Ci.nsILoadInfo.OPENER_POLICY_SAME_ORIGIN_EMBEDDER_POLICY_REQUIRE_CORP ',eT:{},fN:''
  });'__L_V__5';
      // We want documents with a SAME_ORIGIN_EMBEDDER_POLICY_REQUIRE_CORP
      // COOP policy to be loaded in a separate process for which we can enable
      // high resolution timers.
      preferredRemoteType =
        E10SUtils.WEB_REMOTE_COOP_COEP_TYPE_PREFIX + resultPrincipal.siteOrigin;
    } else if (isCOOPSwitch) {
__L_V__5({
    lN: 2730,tT:'if',pr:'isCOOPSwitch',eT:{},fN:''
  });'__L_V__5';
      // If it is a coop switch, but doesn't have this flag, we want to switch
      // to a default remoteType
      preferredRemoteType = E10SUtils.DEFAULT_REMOTE_TYPE;
    }
    debug(
      `[process-switch]: currentRemoteType (${currentRemoteType}) preferredRemoteType: ${preferredRemoteType}`
    );

    let remoteType = E10SUtils.getRemoteTypeForPrincipal(
      resultPrincipal,
      true,
      useRemoteSubframes,
      preferredRemoteType,
      currentPrincipal,
      isSubframe
    );

    debug(
      `[process-switch]: ${currentRemoteType}, ${remoteType}, ${isCOOPSwitch}`
    );

    if (currentRemoteType == remoteType && !isCOOPSwitch) {
__L_V__5({
    lN: 2752,tT:'if',pr:'currentRemoteType == remoteType && !isCOOPSwitch',eT:{},fN:''
  });'__L_V__5';
      debug(`[process-switch]: type (${remoteType}) is compatible - ignoring`);
      return;
    }

    if (
      remoteType == E10SUtils.NOT_REMOTE ||
      currentRemoteType == E10SUtils.NOT_REMOTE
    ) {
__L_V__5({
    lN: 2760,tT:'if',pr:' remoteType == E10SUtils.NOT_REMOTE || currentRemoteType == E10SUtils.NOT_REMOTE ',eT:{},fN:''
  });'__L_V__5';
      debug(`[process-switch]: non-remote source/target - ignoring`);
      return;
    }

    // ------------------------------------------------------------------------
    // DANGER ZONE: Perform a process switch into the new process. This is
    // destructive.
    // ------------------------------------------------------------------------
    let identifier = ++this._switchIdMonotonic;
    let tabPromise = this._doProcessSwitch(
      browsingContext,
      remoteType,
      channel,
      identifier,
      isCOOPSwitch
    );
    switchRequestor.switchProcessTo(tabPromise, identifier);
  },

  /* ........ nsISessionStore API .............. */

  getBrowserState: function ssi_getBrowserState() {
__L_V__5({
    lN: 2782,tT:'func',pr:'',eT:{},fN:'ssi_getBrowserState'
  });'__L_V__5';
    let state = this.getCurrentState();

    // Don't include the last session state in getBrowserState().
    delete state.lastSessionState;

    // Don't include any deferred initial state.
    delete state.deferredInitialState;

    return JSON.stringify(state);
  },

  setBrowserState: function ssi_setBrowserState(aState) {
__L_V__5({
    lN: 2794,tT:'func',pr:'',eT:{'aState':aState},fN:'ssi_setBrowserState'
  });'__L_V__5';
    this._handleClosedWindows();

    try {
      var state = JSON.parse(aState);
    } catch (ex) {
      /* invalid state object - don't restore anything */
    }
    if (!state) {
__L_V__5({
    lN: 2802,tT:'if',pr:'!state',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid state string: not JSON",
        Cr.NS_ERROR_INVALID_ARG
      );
    }
    if (!state.windows) {
__L_V__5({
    lN: 2808,tT:'if',pr:'!state.windows',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception("No windows", Cr.NS_ERROR_INVALID_ARG);
    }

    this._browserSetState = true;

    // Make sure the priority queue is emptied out
    this._resetRestoringState();

    var window = this._getTopWindow();
    if (!window) {
__L_V__5({
    lN: 2818,tT:'if',pr:'!window',eT:{},fN:''
  });'__L_V__5';
      this._restoreCount = 1;
      this._openWindowWithState(state);
      return;
    }

    // close all other browser windows
    for (let otherWin of this._browserWindows) {
      if (otherWin != window) {
__L_V__5({
    lN: 2826,tT:'if',pr:'otherWin != window',eT:{},fN:''
  });'__L_V__5';
        otherWin.close();
        this.onClose(otherWin);
      }
    }

    // make sure closed window data isn't kept
    if (this._closedWindows.length) {
__L_V__5({
    lN: 2833,tT:'if',pr:'this._closedWindows.length',eT:{},fN:''
  });'__L_V__5';
      this._closedWindows = [];
      this._closedObjectsChanged = true;
    }

    // determine how many windows are meant to be restored
    this._restoreCount = state.windows ? state.windows.length : 0;

    // global data must be restored before restoreWindow is called so that
    // it happens before observers are notified
    this._globalState.setFromState(state);

    // Restore session cookies.
    SessionCookies.restore(state.cookies || []);

    // restore to the given state
    this.restoreWindows(window, state, { overwriteTabs: true });

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  getWindowState: function ssi_getWindowState(aWindow) {
__L_V__5({
    lN: 2855,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_getWindowState'
  });'__L_V__5';
    if ("__SSi" in aWindow) {
__L_V__5({
    lN: 2856,tT:'if',pr:'__SSi in aWindow',eT:{},fN:''
  });'__L_V__5';
      return JSON.stringify(this._getWindowState(aWindow));
    }

    if (DyingWindowCache.has(aWindow)) {
__L_V__5({
    lN: 2860,tT:'if',pr:'DyingWindowCache.has(aWindow)',eT:{},fN:''
  });'__L_V__5';
      let data = DyingWindowCache.get(aWindow);
      return JSON.stringify({ windows: [data] });
    }

    throw Components.Exception(
      "Window is not tracked",
      Cr.NS_ERROR_INVALID_ARG
    );
  },

  setWindowState: function ssi_setWindowState(aWindow, aState, aOverwrite) {
__L_V__5({
    lN: 2871,tT:'func',pr:'',eT:{'aWindow':aWindow,'aState':aState,'aOverwrite':aOverwrite},fN:'ssi_setWindowState'
  });'__L_V__5';
    if (!aWindow.__SSi) {
__L_V__5({
    lN: 2872,tT:'if',pr:'!aWindow.__SSi',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    this.restoreWindows(aWindow, aState, { overwriteTabs: aOverwrite });

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  getTabState: function ssi_getTabState(aTab) {
__L_V__5({
    lN: 2885,tT:'func',pr:'',eT:{'aTab':aTab},fN:'ssi_getTabState'
  });'__L_V__5';
    if (!aTab || !aTab.ownerGlobal) {
__L_V__5({
    lN: 2886,tT:'if',pr:'!aTab || !aTab.ownerGlobal',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception("Need a valid tab", Cr.NS_ERROR_INVALID_ARG);
    }
    if (!aTab.ownerGlobal.__SSi) {
__L_V__5({
    lN: 2889,tT:'if',pr:'!aTab.ownerGlobal.__SSi',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Default view is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    let tabState = TabState.collect(aTab, TAB_CUSTOM_VALUES.get(aTab));

    return JSON.stringify(tabState);
  },

  setTabState(aTab, aState) {
__L_V__5({
    lN: 2901,tT:'func',pr:'',eT:{'aTab':aTab,'aState':aState},fN:'setTabState'
  });'__L_V__5';
    // Remove the tab state from the cache.
    // Note that we cannot simply replace the contents of the cache
    // as |aState| can be an incomplete state that will be completed
    // by |restoreTabs|.
    let tabState = aState;
    if (typeof tabState == "string") {
__L_V__5({
    lN: 2907,tT:'if',pr:'typeof tabState == string',eT:{},fN:''
  });'__L_V__5';
      tabState = JSON.parse(aState);
    }
    if (!tabState) {
__L_V__5({
    lN: 2910,tT:'if',pr:'!tabState',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid state string: not JSON",
        Cr.NS_ERROR_INVALID_ARG
      );
    }
    if (typeof tabState != "object") {
__L_V__5({
    lN: 2916,tT:'if',pr:'typeof tabState != object',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception("Not an object", Cr.NS_ERROR_INVALID_ARG);
    }
    if (!("entries" in tabState)) {
__L_V__5({
    lN: 2919,tT:'if',pr:'!(entries in tabState)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid state object: no entries",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    let window = aTab.ownerGlobal;
    if (!window || !("__SSi" in window)) {
__L_V__5({
    lN: 2927,tT:'if',pr:'!window || !(__SSi in window)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    if (TAB_STATE_FOR_BROWSER.has(aTab.linkedBrowser)) {
__L_V__5({
    lN: 2934,tT:'if',pr:'TAB_STATE_FOR_BROWSER.has(aTab.linkedBrowser)',eT:{},fN:''
  });'__L_V__5';
      this._resetTabRestoringState(aTab);
    }

    this.restoreTab(aTab, tabState);

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  getInternalObjectState(obj) {
__L_V__5({
    lN: 2944,tT:'func',pr:'',eT:{'obj':obj},fN:'getInternalObjectState'
  });'__L_V__5';
    if (obj.__SSi) {
__L_V__5({
    lN: 2945,tT:'if',pr:'obj.__SSi',eT:{},fN:''
  });'__L_V__5';
      return this._windows[obj.__SSi];
    }
    return obj.loadURI
      ? TAB_STATE_FOR_BROWSER.get(obj)
      : TAB_CUSTOM_VALUES.get(obj);
  },

  duplicateTab: function ssi_duplicateTab(
    aWindow,
    aTab,
    aDelta = 0,
    aRestoreImmediately = true
  ) {
__L_V__5({
    lN: 2958,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTab':aTab,'aDelta':aDelta,'aRestoreImmediately':aRestoreImmediately},fN:'ssi_duplicateTab'
  });'__L_V__5';
    if (!aTab || !aTab.ownerGlobal) {
__L_V__5({
    lN: 2959,tT:'if',pr:'!aTab || !aTab.ownerGlobal',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception("Need a valid tab", Cr.NS_ERROR_INVALID_ARG);
    }
    if (!aTab.ownerGlobal.__SSi) {
__L_V__5({
    lN: 2962,tT:'if',pr:'!aTab.ownerGlobal.__SSi',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Default view is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }
    if (!aWindow.gBrowser) {
__L_V__5({
    lN: 2968,tT:'if',pr:'!aWindow.gBrowser',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid window object: no gBrowser",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    // Create a new tab.
    let userContextId = aTab.getAttribute("usercontextid");

    let tabOptions = {
      userContextId,
      ...(aTab == aWindow.gBrowser.selectedTab
        ? { relatedToCurrent: true, ownerTab: aTab }
        : {}),
    };
    let newTab = aWindow.gBrowser.addTrustedTab(null, tabOptions);

    // Start the throbber to pretend we're doing something while actually
    // waiting for data from the frame script. This throbber is disabled
    // if the URI is a local about: URI.
    let uriObj = aTab.linkedBrowser.currentURI;
    if (!uriObj || (uriObj && !uriObj.schemeIs("about"))) {
__L_V__5({
    lN: 2990,tT:'if',pr:'!uriObj || (uriObj && !uriObj.schemeIs(about))',eT:{},fN:''
  });'__L_V__5';
      newTab.setAttribute("busy", "true");
    }

    // Hack to ensure that the about:home, about:newtab, and about:welcome
    // favicon is loaded instantaneously, to avoid flickering and improve
    // perceived performance.
    aWindow.gBrowser.setDefaultIcon(newTab, uriObj);

    // Collect state before flushing.
    let tabState = TabState.collect(aTab, TAB_CUSTOM_VALUES.get(aTab));

    // Flush to get the latest tab state to duplicate.
    let browser = aTab.linkedBrowser;
    TabStateFlusher.flush(browser).then(() => {
      // The new tab might have been closed in the meantime.
      if (newTab.closing || !newTab.linkedBrowser) {
__L_V__5({
    lN: 3006,tT:'if',pr:'newTab.closing || !newTab.linkedBrowser',eT:{},fN:''
  });'__L_V__5';
        return;
      }

      let window = newTab.ownerGlobal;

      // The tab or its window might be gone.
      if (!window || !window.__SSi) {
__L_V__5({
    lN: 3013,tT:'if',pr:'!window || !window.__SSi',eT:{},fN:''
  });'__L_V__5';
        return;
      }

      // Update state with flushed data. We can't use TabState.clone() here as
      // the tab to duplicate may have already been closed. In that case we
      // only have access to the <xul:browser>.
      let options = { includePrivateData: true };
      TabState.copyFromCache(browser, tabState, options);

      tabState.index += aDelta;
      tabState.index = Math.max(
        1,
        Math.min(tabState.index, tabState.entries.length)
      );
      tabState.pinned = false;

      // Restore the state into the new tab.
      this.restoreTab(newTab, tabState, {
        restoreImmediately: aRestoreImmediately,
      });
    });

    return newTab;
  },

  getClosedTabCount: function ssi_getClosedTabCount(aWindow) {
__L_V__5({
    lN: 3039,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_getClosedTabCount'
  });'__L_V__5';
    if ("__SSi" in aWindow) {
__L_V__5({
    lN: 3040,tT:'if',pr:'__SSi in aWindow',eT:{},fN:''
  });'__L_V__5';
      return this._windows[aWindow.__SSi]._closedTabs.length;
    }

    if (!DyingWindowCache.has(aWindow)) {
__L_V__5({
    lN: 3044,tT:'if',pr:'!DyingWindowCache.has(aWindow)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    return DyingWindowCache.get(aWindow)._closedTabs.length;
  },

  getClosedTabData: function ssi_getClosedTabData(aWindow, aAsString = true) {
__L_V__5({
    lN: 3054,tT:'func',pr:'',eT:{'aWindow':aWindow,'aAsString':aAsString},fN:'ssi_getClosedTabData'
  });'__L_V__5';
    if ("__SSi" in aWindow) {
__L_V__5({
    lN: 3055,tT:'if',pr:'__SSi in aWindow',eT:{},fN:''
  });'__L_V__5';
      return aAsString
        ? JSON.stringify(this._windows[aWindow.__SSi]._closedTabs)
        : Cu.cloneInto(this._windows[aWindow.__SSi]._closedTabs, {});
    }

    if (!DyingWindowCache.has(aWindow)) {
__L_V__5({
    lN: 3061,tT:'if',pr:'!DyingWindowCache.has(aWindow)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    let data = DyingWindowCache.get(aWindow);
    return aAsString
      ? JSON.stringify(data._closedTabs)
      : Cu.cloneInto(data._closedTabs, {});
  },

  undoCloseTab: function ssi_undoCloseTab(aWindow, aIndex) {
__L_V__5({
    lN: 3074,tT:'func',pr:'',eT:{'aWindow':aWindow,'aIndex':aIndex},fN:'ssi_undoCloseTab'
  });'__L_V__5';
    if (!aWindow.__SSi) {
__L_V__5({
    lN: 3075,tT:'if',pr:'!aWindow.__SSi',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    var closedTabs = this._windows[aWindow.__SSi]._closedTabs;

    // default to the most-recently closed tab
    aIndex = aIndex || 0;
    if (!(aIndex in closedTabs)) {
__L_V__5({
    lN: 3086,tT:'if',pr:'!(aIndex in closedTabs)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid index: not in the closed tabs",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    // fetch the data of closed tab, while removing it from the array
    let { state, pos } = this.removeClosedTabData(closedTabs, aIndex);

    // create a new tab
    let tabbrowser = aWindow.gBrowser;
    let tab = (tabbrowser.selectedTab = tabbrowser.addTrustedTab(null, {
      index: pos,
      pinned: state.pinned,
      userContextId: state.userContextId,
    }));

    // restore tab content
    this.restoreTab(tab, state);

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();

    return tab;
  },

  forgetClosedTab: function ssi_forgetClosedTab(aWindow, aIndex) {
__L_V__5({
    lN: 3113,tT:'func',pr:'',eT:{'aWindow':aWindow,'aIndex':aIndex},fN:'ssi_forgetClosedTab'
  });'__L_V__5';
    if (!aWindow.__SSi) {
__L_V__5({
    lN: 3114,tT:'if',pr:'!aWindow.__SSi',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    var closedTabs = this._windows[aWindow.__SSi]._closedTabs;

    // default to the most-recently closed tab
    aIndex = aIndex || 0;
    if (!(aIndex in closedTabs)) {
__L_V__5({
    lN: 3125,tT:'if',pr:'!(aIndex in closedTabs)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid index: not in the closed tabs",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    // remove closed tab from the array
    this.removeClosedTabData(closedTabs, aIndex);

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  getClosedWindowCount: function ssi_getClosedWindowCount() {
__L_V__5({
    lN: 3139,tT:'func',pr:'',eT:{},fN:'ssi_getClosedWindowCount'
  });'__L_V__5';
    return this._closedWindows.length;
  },

  getClosedWindowData: function ssi_getClosedWindowData(aAsString = true) {
__L_V__5({
    lN: 3143,tT:'func',pr:'',eT:{'aAsString':aAsString},fN:'ssi_getClosedWindowData'
  });'__L_V__5';
    return aAsString
      ? JSON.stringify(this._closedWindows)
      : Cu.cloneInto(this._closedWindows, {});
  },

  undoCloseWindow: function ssi_undoCloseWindow(aIndex) {
__L_V__5({
    lN: 3149,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'ssi_undoCloseWindow'
  });'__L_V__5';
    if (!(aIndex in this._closedWindows)) {
__L_V__5({
    lN: 3150,tT:'if',pr:'!(aIndex in this._closedWindows)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid index: not in the closed windows",
        Cr.NS_ERROR_INVALID_ARG
      );
    }
    // reopen the window
    let state = { windows: this._removeClosedWindow(aIndex) };
    delete state.windows[0].closedAt; // Window is now open.

    let window = this._openWindowWithState(state);
    this.windowToFocus = window;
    WINDOW_SHOWING_PROMISES.get(window).promise.then(win =>
      this.restoreWindows(win, state, { overwriteTabs: true })
    );

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();

    return window;
  },

  forgetClosedWindow: function ssi_forgetClosedWindow(aIndex) {
__L_V__5({
    lN: 3172,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'ssi_forgetClosedWindow'
  });'__L_V__5';
    // default to the most-recently closed window
    aIndex = aIndex || 0;
    if (!(aIndex in this._closedWindows)) {
__L_V__5({
    lN: 3175,tT:'if',pr:'!(aIndex in this._closedWindows)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Invalid index: not in the closed windows",
        Cr.NS_ERROR_INVALID_ARG
      );
    }

    // remove closed window from the array
    let winData = this._closedWindows[aIndex];
    this._removeClosedWindow(aIndex);
    this._saveableClosedWindowData.delete(winData);

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  getCustomWindowValue(aWindow, aKey) {
__L_V__5({
    lN: 3191,tT:'func',pr:'',eT:{'aWindow':aWindow,'aKey':aKey},fN:'getCustomWindowValue'
  });'__L_V__5';
    if ("__SSi" in aWindow) {
__L_V__5({
    lN: 3192,tT:'if',pr:'__SSi in aWindow',eT:{},fN:''
  });'__L_V__5';
      let data = this._windows[aWindow.__SSi].extData || {};
      return data[aKey] || "";
    }

    if (DyingWindowCache.has(aWindow)) {
__L_V__5({
    lN: 3197,tT:'if',pr:'DyingWindowCache.has(aWindow)',eT:{},fN:''
  });'__L_V__5';
      let data = DyingWindowCache.get(aWindow).extData || {};
      return data[aKey] || "";
    }

    throw Components.Exception(
      "Window is not tracked",
      Cr.NS_ERROR_INVALID_ARG
    );
  },

  setCustomWindowValue(aWindow, aKey, aStringValue) {
__L_V__5({
    lN: 3208,tT:'func',pr:'',eT:{'aWindow':aWindow,'aKey':aKey,'aStringValue':aStringValue},fN:'setCustomWindowValue'
  });'__L_V__5';
    if (typeof aStringValue != "string") {
__L_V__5({
    lN: 3209,tT:'if',pr:'typeof aStringValue != string',eT:{},fN:''
  });'__L_V__5';
      throw new TypeError("setCustomWindowValue only accepts string values");
    }

    if (!("__SSi" in aWindow)) {
__L_V__5({
    lN: 3213,tT:'if',pr:'!(__SSi in aWindow)',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "Window is not tracked",
        Cr.NS_ERROR_INVALID_ARG
      );
    }
    if (!this._windows[aWindow.__SSi].extData) {
__L_V__5({
    lN: 3219,tT:'if',pr:'!this._windows[aWindow.__SSi].extData',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi].extData = {};
    }
    this._windows[aWindow.__SSi].extData[aKey] = aStringValue;
    this.saveStateDelayed(aWindow);
  },

  deleteCustomWindowValue(aWindow, aKey) {
__L_V__5({
    lN: 3226,tT:'func',pr:'',eT:{'aWindow':aWindow,'aKey':aKey},fN:'deleteCustomWindowValue'
  });'__L_V__5';
    if (
      aWindow.__SSi &&
      this._windows[aWindow.__SSi].extData &&
      this._windows[aWindow.__SSi].extData[aKey]
    ) {
__L_V__5({
    lN: 3231,tT:'if',pr:' aWindow.__SSi && this._windows[aWindow.__SSi].extData && this._windows[aWindow.__SSi].extData[aKey] ',eT:{},fN:''
  });'__L_V__5';
      delete this._windows[aWindow.__SSi].extData[aKey];
    }
    this.saveStateDelayed(aWindow);
  },

  getCustomTabValue(aTab, aKey) {
__L_V__5({
    lN: 3237,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey},fN:'getCustomTabValue'
  });'__L_V__5';
    return (TAB_CUSTOM_VALUES.get(aTab) || {})[aKey] || "";
  },

  setCustomTabValue(aTab, aKey, aStringValue) {
__L_V__5({
    lN: 3241,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey,'aStringValue':aStringValue},fN:'setCustomTabValue'
  });'__L_V__5';
    if (typeof aStringValue != "string") {
__L_V__5({
    lN: 3242,tT:'if',pr:'typeof aStringValue != string',eT:{},fN:''
  });'__L_V__5';
      throw new TypeError("setCustomTabValue only accepts string values");
    }

    // If the tab hasn't been restored, then set the data there, otherwise we
    // could lose newly added data.
    if (!TAB_CUSTOM_VALUES.has(aTab)) {
__L_V__5({
    lN: 3248,tT:'if',pr:'!TAB_CUSTOM_VALUES.has(aTab)',eT:{},fN:''
  });'__L_V__5';
      TAB_CUSTOM_VALUES.set(aTab, {});
    }

    TAB_CUSTOM_VALUES.get(aTab)[aKey] = aStringValue;
    this.saveStateDelayed(aTab.ownerGlobal);
  },

  deleteCustomTabValue(aTab, aKey) {
__L_V__5({
    lN: 3256,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey},fN:'deleteCustomTabValue'
  });'__L_V__5';
    let state = TAB_CUSTOM_VALUES.get(aTab);
    if (state && aKey in state) {
__L_V__5({
    lN: 3258,tT:'if',pr:'state && aKey in state',eT:{},fN:''
  });'__L_V__5';
      delete state[aKey];
      this.saveStateDelayed(aTab.ownerGlobal);
    }
  },

  /**
   * Retrieves data specific to lazy-browser tabs.  If tab is not lazy,
   * will return undefined.
   *
   * @param aTab (xul:tab)
   *        The tabbrowser-tab the data is for.
   * @param aKey (string)
   *        The key which maps to the desired data.
   */
  getLazyTabValue(aTab, aKey) {
__L_V__5({
    lN: 3273,tT:'func',pr:'',eT:{'aTab':aTab,'aKey':aKey},fN:'getLazyTabValue'
  });'__L_V__5';
    return (TAB_LAZY_STATES.get(aTab) || {})[aKey];
  },

  getCustomGlobalValue(aKey) {
__L_V__5({
    lN: 3277,tT:'func',pr:'',eT:{'aKey':aKey},fN:'getCustomGlobalValue'
  });'__L_V__5';
    return this._globalState.get(aKey);
  },

  setCustomGlobalValue(aKey, aStringValue) {
__L_V__5({
    lN: 3281,tT:'func',pr:'',eT:{'aKey':aKey,'aStringValue':aStringValue},fN:'setCustomGlobalValue'
  });'__L_V__5';
    if (typeof aStringValue != "string") {
__L_V__5({
    lN: 3282,tT:'if',pr:'typeof aStringValue != string',eT:{},fN:''
  });'__L_V__5';
      throw new TypeError("setCustomGlobalValue only accepts string values");
    }

    this._globalState.set(aKey, aStringValue);
    this.saveStateDelayed();
  },

  deleteCustomGlobalValue(aKey) {
__L_V__5({
    lN: 3290,tT:'func',pr:'',eT:{'aKey':aKey},fN:'deleteCustomGlobalValue'
  });'__L_V__5';
    this._globalState.delete(aKey);
    this.saveStateDelayed();
  },

  persistTabAttribute: function ssi_persistTabAttribute(aName) {
__L_V__5({
    lN: 3295,tT:'func',pr:'',eT:{'aName':aName},fN:'ssi_persistTabAttribute'
  });'__L_V__5';
    if (TabAttributes.persist(aName)) {
__L_V__5({
    lN: 3296,tT:'if',pr:'TabAttributes.persist(aName)',eT:{},fN:''
  });'__L_V__5';
      this.saveStateDelayed();
    }
  },

  /**
   * Undoes the closing of a tab or window which corresponds
   * to the closedId passed in.
   *
   * @param aClosedId
   *        The closedId of the tab or window
   * @param aIncludePrivate
   *        Whether to restore private tabs or windows
   *
   * @returns a tab or window object
   */
  undoCloseById(aClosedId, aIncludePrivate = true) {
__L_V__5({
    lN: 3312,tT:'func',pr:'',eT:{'aClosedId':aClosedId,'aIncludePrivate':aIncludePrivate},fN:'undoCloseById'
  });'__L_V__5';
    // Check for a window first.
    for (let i = 0, l = this._closedWindows.length; i < l; i++) {
      if (this._closedWindows[i].closedId == aClosedId) {
__L_V__5({
    lN: 3315,tT:'if',pr:'this._closedWindows[i].closedId == aClosedId',eT:{},fN:''
  });'__L_V__5';
        return this.undoCloseWindow(i);
      }
    }

    // Check for a tab.
    for (let window of Services.wm.getEnumerator("navigator:browser")) {
      if (!aIncludePrivate && PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__5({
    lN: 3322,tT:'if',pr:'!aIncludePrivate && PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__5';
        continue;
      }
      let windowState = this._windows[window.__SSi];
      if (windowState) {
__L_V__5({
    lN: 3326,tT:'if',pr:'windowState',eT:{},fN:''
  });'__L_V__5';
        for (let j = 0, l = windowState._closedTabs.length; j < l; j++) {
          if (windowState._closedTabs[j].closedId == aClosedId) {
__L_V__5({
    lN: 3328,tT:'if',pr:'windowState._closedTabs[j].closedId == aClosedId',eT:{},fN:''
  });'__L_V__5';
            return this.undoCloseTab(window, j);
          }
        }
      }
    }

    // Neither a tab nor a window was found, return undefined and let the caller decide what to do about it.
    return undefined;
  },

  /**
   * Updates the label and icon for a <xul:tab> using the data from
   * tabData.
   *
   * @param tab
   *        The <xul:tab> to update.
   * @param tabData (optional)
   *        The tabData to use to update the tab. If the argument is
   *        not supplied, the data will be retrieved from the cache.
   */
  updateTabLabelAndIcon(tab, tabData = null) {
__L_V__5({
    lN: 3349,tT:'func',pr:'',eT:{'tab':tab,'tabData':tabData},fN:'updateTabLabelAndIcon'
  });'__L_V__5';
    if (tab.hasAttribute("customizemode")) {
__L_V__5({
    lN: 3350,tT:'if',pr:'tab.hasAttribute(customizemode)',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    let browser = tab.linkedBrowser;
    let win = browser.ownerGlobal;

    if (!tabData) {
__L_V__5({
    lN: 3357,tT:'if',pr:'!tabData',eT:{},fN:''
  });'__L_V__5';
      tabData = TabState.collect(tab, TAB_CUSTOM_VALUES.get(tab));
      if (!tabData) {
__L_V__5({
    lN: 3359,tT:'if',pr:'!tabData',eT:{},fN:''
  });'__L_V__5';
        throw new Error("tabData not found for given tab");
      }
    }

    let activePageData = tabData.entries[tabData.index - 1] || null;

    // If the page has a title, set it.
    if (activePageData) {
__L_V__5({
    lN: 3367,tT:'if',pr:'activePageData',eT:{},fN:''
  });'__L_V__5';
      if (activePageData.title && activePageData.title != activePageData.url) {
__L_V__5({
    lN: 3368,tT:'if',pr:'activePageData.title && activePageData.title != activePageData.url',eT:{},fN:''
  });'__L_V__5';
        win.gBrowser.setInitialTabTitle(tab, activePageData.title, {
          isContentTitle: true,
        });
      } else {
        win.gBrowser.setInitialTabTitle(tab, activePageData.url);
      }
    }

    // Restore the tab icon.
    if ("image" in tabData) {
__L_V__5({
    lN: 3378,tT:'if',pr:'image in tabData',eT:{},fN:''
  });'__L_V__5';
      // We know that about:blank is safe to load in any remote type. Since
      // SessionStore is triggered with about:blank, there must be a process
      // flip. We will ignore the first about:blank load to prevent resetting the
      // favicon that we have set earlier to avoid flickering and improve
      // perceived performance.
      if (
        !activePageData ||
        (activePageData && activePageData.url != "about:blank")
      ) {
__L_V__5({
    lN: 3387,tT:'if',pr:' !activePageData || (activePageData && activePageData.url != about:blank) ',eT:{},fN:''
  });'__L_V__5';
        win.gBrowser.setIcon(
          tab,
          tabData.image,
          undefined,
          tabData.iconLoadingPrincipal
        );
      }
      TabStateCache.update(browser, {
        image: null,
        iconLoadingPrincipal: null,
      });
    }
  },

  // This method deletes all the closedTabs matching userContextId.
  _forgetTabsWithUserContextId(userContextId) {
__L_V__5({
    lN: 3403,tT:'func',pr:'',eT:{'userContextId':userContextId},fN:'_forgetTabsWithUserContextId'
  });'__L_V__5';
    for (let window of Services.wm.getEnumerator("navigator:browser")) {
      let windowState = this._windows[window.__SSi];
      if (windowState) {
__L_V__5({
    lN: 3406,tT:'if',pr:'windowState',eT:{},fN:''
  });'__L_V__5';
        // In order to remove the tabs in the correct order, we store the
        // indexes, into an array, then we revert the array and remove closed
        // data from the last one going backward.
        let indexes = [];
        windowState._closedTabs.forEach((closedTab, index) => {
          if (closedTab.state.userContextId == userContextId) {
__L_V__5({
    lN: 3412,tT:'if',pr:'closedTab.state.userContextId == userContextId',eT:{},fN:''
  });'__L_V__5';
            indexes.push(index);
          }
        });

        for (let index of indexes.reverse()) {
          this.removeClosedTabData(windowState._closedTabs, index);
        }
      }
    }

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  /**
   * Restores the session state stored in LastSession. This will attempt
   * to merge data into the current session. If a window was opened at startup
   * with pinned tab(s), then the remaining data from the previous session for
   * that window will be opened into that window. Otherwise new windows will
   * be opened.
   */
  restoreLastSession: function ssi_restoreLastSession() {
__L_V__5({
    lN: 3434,tT:'func',pr:'',eT:{},fN:'ssi_restoreLastSession'
  });'__L_V__5';
    // Use the public getter since it also checks PB mode
    if (!this.canRestoreLastSession) {
__L_V__5({
    lN: 3436,tT:'if',pr:'!this.canRestoreLastSession',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception("Last session can not be restored");
    }

    Services.obs.notifyObservers(null, NOTIFY_INITIATING_MANUAL_RESTORE);

    // First collect each window with its id...
    let windows = {};
    for (let window of this._browserWindows) {
      if (window.__SS_lastSessionWindowID) {
__L_V__5({
    lN: 3445,tT:'if',pr:'window.__SS_lastSessionWindowID',eT:{},fN:''
  });'__L_V__5';
        windows[window.__SS_lastSessionWindowID] = window;
      }
    }

    let lastSessionState = LastSession.getState();

    // This shouldn't ever be the case...
    if (!lastSessionState.windows.length) {
__L_V__5({
    lN: 3453,tT:'if',pr:'!lastSessionState.windows.length',eT:{},fN:''
  });'__L_V__5';
      throw Components.Exception(
        "lastSessionState has no windows",
        Cr.NS_ERROR_UNEXPECTED
      );
    }

    // We're technically doing a restore, so set things up so we send the
    // notification when we're done. We want to send "sessionstore-browser-state-restored".
    this._restoreCount = lastSessionState.windows.length;
    this._browserSetState = true;

    // We want to re-use the last opened window instead of opening a new one in
    // the case where it's "empty" and not associated with a window in the session.
    // We will do more processing via _prepWindowToRestoreInto if we need to use
    // the lastWindow.
    let lastWindow = this._getTopWindow();
    let canUseLastWindow = lastWindow && !lastWindow.__SS_lastSessionWindowID;

    // global data must be restored before restoreWindow is called so that
    // it happens before observers are notified
    this._globalState.setFromState(lastSessionState);

    let openWindows = [];
    let windowsToOpen = [];

    // Restore session cookies.
    SessionCookies.restore(lastSessionState.cookies || []);

    // Restore into windows or open new ones as needed.
    for (let i = 0; i < lastSessionState.windows.length; i++) {
      let winState = lastSessionState.windows[i];
      let lastSessionWindowID = winState.__lastSessionWindowID;
      // delete lastSessionWindowID so we don't add that to the window again
      delete winState.__lastSessionWindowID;

      // See if we can use an open window. First try one that is associated with
      // the state we're trying to restore and then fallback to the last selected
      // window.
      let windowToUse = windows[lastSessionWindowID];
      if (!windowToUse && canUseLastWindow) {
__L_V__5({
    lN: 3493,tT:'if',pr:'!windowToUse && canUseLastWindow',eT:{},fN:''
  });'__L_V__5';
        windowToUse = lastWindow;
        canUseLastWindow = false;
      }

      let [canUseWindow, canOverwriteTabs] = this._prepWindowToRestoreInto(
        windowToUse
      );

      // If there's a window already open that we can restore into, use that
      if (canUseWindow) {
__L_V__5({
    lN: 3503,tT:'if',pr:'canUseWindow',eT:{},fN:''
  });'__L_V__5';
        // Since we're not overwriting existing tabs, we want to merge _closedTabs,
        // putting existing ones first. Then make sure we're respecting the max pref.
        if (winState._closedTabs && winState._closedTabs.length) {
__L_V__5({
    lN: 3506,tT:'if',pr:'winState._closedTabs && winState._closedTabs.length',eT:{},fN:''
  });'__L_V__5';
          let curWinState = this._windows[windowToUse.__SSi];
          curWinState._closedTabs = curWinState._closedTabs.concat(
            winState._closedTabs
          );
          curWinState._closedTabs.splice(
            this._max_tabs_undo,
            curWinState._closedTabs.length
          );
        }

        // XXXzpao This is going to merge extData together (taking what was in
        //        winState over what is in the window already.
        // We don't restore window right away, just store its data.
        // Later, these windows will be restored with newly opened windows.
        this._updateWindowRestoreState(windowToUse, {
          windows: [winState],
          options: { overwriteTabs: canOverwriteTabs },
        });
        openWindows.push(windowToUse);
      } else {
        windowsToOpen.push(winState);
      }
    }

    // Actually restore windows in reversed z-order.
    this._openWindows({ windows: windowsToOpen }).then(openedWindows =>
      this._restoreWindowsInReversedZOrder(openWindows.concat(openedWindows))
    );

    // Merge closed windows from this session with ones from last session
    if (lastSessionState._closedWindows) {
__L_V__5({
    lN: 3537,tT:'if',pr:'lastSessionState._closedWindows',eT:{},fN:''
  });'__L_V__5';
      this._closedWindows = this._closedWindows.concat(
        lastSessionState._closedWindows
      );
      this._capClosedWindows();
      this._closedObjectsChanged = true;
    }

    DevToolsShim.restoreDevToolsSession(lastSessionState);

    // Set data that persists between sessions
    this._recentCrashes =
      (lastSessionState.session && lastSessionState.session.recentCrashes) || 0;

    // Update the session start time using the restored session state.
    this._updateSessionStartTime(lastSessionState);

    LastSession.clear();

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();
  },

  /**
   * Revive a crashed tab and restore its state from before it crashed.
   *
   * @param aTab
   *        A <xul:tab> linked to a crashed browser. This is a no-op if the
   *        browser hasn't actually crashed, or is not associated with a tab.
   *        This function will also throw if the browser happens to be remote.
   */
  reviveCrashedTab(aTab) {
__L_V__5({
    lN: 3568,tT:'func',pr:'',eT:{'aTab':aTab},fN:'reviveCrashedTab'
  });'__L_V__5';
    if (!aTab) {
__L_V__5({
    lN: 3569,tT:'if',pr:'!aTab',eT:{},fN:''
  });'__L_V__5';
      throw new Error(
        "SessionStore.reviveCrashedTab expected a tab, but got null."
      );
    }

    let browser = aTab.linkedBrowser;
    if (!this._crashedBrowsers.has(browser.permanentKey)) {
__L_V__5({
    lN: 3576,tT:'if',pr:'!this._crashedBrowsers.has(browser.permanentKey)',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // Sanity check - the browser to be revived should not be remote
    // at this point.
    if (browser.isRemoteBrowser) {
__L_V__5({
    lN: 3582,tT:'if',pr:'browser.isRemoteBrowser',eT:{},fN:''
  });'__L_V__5';
      throw new Error(
        "SessionStore.reviveCrashedTab: " +
          "Somehow a crashed browser is still remote."
      );
    }

    // We put the browser at about:blank in case the user is
    // restoring tabs on demand. This way, the user won't see
    // a flash of the about:tabcrashed page after selecting
    // the revived tab.
    aTab.removeAttribute("crashed");
    browser.loadURI("about:blank", {
      triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({
        userContextId: aTab.userContextId,
      }),
    });

    let data = TabState.collect(aTab, TAB_CUSTOM_VALUES.get(aTab));
    this.restoreTab(aTab, data, {
      forceOnDemand: true,
    });
  },

  /**
   * Revive all crashed tabs and reset the crashed tabs count to 0.
   */
  reviveAllCrashedTabs() {
__L_V__5({
    lN: 3609,tT:'func',pr:'',eT:{},fN:'reviveAllCrashedTabs'
  });'__L_V__5';
    for (let window of Services.wm.getEnumerator("navigator:browser")) {
      for (let tab of window.gBrowser.tabs) {
        this.reviveCrashedTab(tab);
      }
    }
  },

  /**
   * Navigate the given |tab| by first collecting its current state and then
   * either changing only the index of the currently shown history entry,
   * or restoring the exact same state again and passing the new URL to load
   * in |loadArguments|. Use this method to seamlessly switch between pages
   * loaded in the parent and pages loaded in the child process.
   *
   * This method might be called multiple times before it has finished
   * flushing the browser tab. If that occurs, the loadArguments from
   * the most recent call to navigateAndRestore will be used once the
   * flush has finished.
   *
   * This method returns a promise which will be resolved when the browser
   * element's process has been swapped. The load is not guaranteed to have
   * been completed at this point.
   */
  navigateAndRestore(tab, loadArguments, historyIndex) {
__L_V__5({
    lN: 3633,tT:'func',pr:'',eT:{'tab':tab,'loadArguments':loadArguments,'historyIndex':historyIndex},fN:'navigateAndRestore'
  });'__L_V__5';
    let window = tab.ownerGlobal;

    if (!window.__SSi) {
__L_V__5({
    lN: 3636,tT:'if',pr:'!window.__SSi',eT:{},fN:''
  });'__L_V__5';
      Cu.reportError("Tab's window must be tracked.");
      return Promise.reject();
    }

    let browser = tab.linkedBrowser;

    // If we were alerady waiting for a flush from a previous call to
    // navigateAndRestore on this tab, update the loadArguments stored, and
    // asynchronously wait on the flush's promise.
    if (this._remotenessChangingBrowsers.has(browser.permanentKey)) {
__L_V__5({
    lN: 3646,tT:'if',pr:'this._remotenessChangingBrowsers.has(browser.permanentKey)',eT:{},fN:''
  });'__L_V__5';
      let opts = this._remotenessChangingBrowsers.get(browser.permanentKey);
      // XXX(nika): In the existing logic, we always use the initial
      // historyIndex value, and don't update it if multiple navigateAndRestore
      // calls are made. Should we update it here?
      opts.loadArguments = loadArguments;
      return opts.promise;
    }

    // Begin the asynchronous NavigateAndRestore process, and store the current
    // load arguments and promise in our _remotenessChangingBrowsers weakmap.
    let promise = this._asyncNavigateAndRestore(tab);
    this._remotenessChangingBrowsers.set(browser.permanentKey, {
      loadArguments,
      historyIndex,
      promise,
    });

    // Set up the browser UI to look like we're doing something while waiting
    // for a TabStateFlush from our frame scripts.
    let uriObj;
    try {
      uriObj = Services.io.newURI(loadArguments.uri);
    } catch (e) {}

    // Start the throbber to pretend we're doing something while actually
    // waiting for data from the frame script. This throbber is disabled
    // if the URI is a local about: URI.
    if (!uriObj || (uriObj && !uriObj.schemeIs("about"))) {
__L_V__5({
    lN: 3674,tT:'if',pr:'!uriObj || (uriObj && !uriObj.schemeIs(about))',eT:{},fN:''
  });'__L_V__5';
      tab.setAttribute("busy", "true");
    }

    // Hack to ensure that the about:home, about:newtab, and about:welcome
    // favicon is loaded instantaneously, to avoid flickering and improve
    // perceived performance.
    window.gBrowser.setDefaultIcon(tab, uriObj);

    TAB_STATE_FOR_BROWSER.set(tab.linkedBrowser, TAB_STATE_WILL_RESTORE);

    // Notify of changes to closed objects.
    this._notifyOfClosedObjectsChange();

    return promise;
  },

  /**
   * Internal logic called by navigateAndRestore to flush tab state, and
   * trigger a remoteness changing load with the most recent load arguments.
   *
   * This method's promise will resolve when the process for the given
   * xul:browser element has successfully been swapped.
   *
   * @param tab to navigate and restore.
   */
  async _asyncNavigateAndRestore(tab) {
__L_V__5({
    lN: 3700,tT:'func',pr:'',eT:{'tab':tab},fN:'_asyncNavigateAndRestore'
  });'__L_V__5';
    let permanentKey = tab.linkedBrowser.permanentKey;

    // NOTE: This is currently the only async operation used, but this is likely
    // to change in the future.
    await TabStateFlusher.flush(tab.linkedBrowser);

    // Now that we have flushed state, our loadArguments, etc. may have been
    // overwritten by multiple calls to navigateAndRestore. Load the most
    // recently stored one.
    let { loadArguments, historyIndex } = this._remotenessChangingBrowsers.get(
      permanentKey
    );
    this._remotenessChangingBrowsers.delete(permanentKey);

    // The tab might have been closed/gone in the meantime.
    if (tab.closing || !tab.linkedBrowser) {
__L_V__5({
    lN: 3716,tT:'if',pr:'tab.closing || !tab.linkedBrowser',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // The tab or its window might be gone.
    let window = tab.ownerGlobal;
    if (!window || !window.__SSi || window.closed) {
__L_V__5({
    lN: 3722,tT:'if',pr:'!window || !window.__SSi || window.closed',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    let tabState = TabState.clone(tab, TAB_CUSTOM_VALUES.get(tab));
    let options = {
      restoreImmediately: true,
      // We want to make sure that this information is passed to restoreTab
      // whether or not a historyIndex is passed in. Thus, we extract it from
      // the loadArguments.
      newFrameloader: loadArguments.newFrameloader,
      remoteType: loadArguments.remoteType,
      replaceBrowsingContext: loadArguments.replaceBrowsingContext,
      // Make sure that SessionStore knows that this restoration is due
      // to a navigation, as opposed to us restoring a closed window or tab.
      restoreContentReason: RESTORE_TAB_CONTENT_REASON.NAVIGATE_AND_RESTORE,
      redirectLoadSwitchId: loadArguments.redirectLoadSwitchId,
    };

    if (historyIndex >= 0) {
__L_V__5({
    lN: 3741,tT:'if',pr:'historyIndex >= 0',eT:{},fN:''
  });'__L_V__5';
      tabState.index = historyIndex + 1;
      tabState.index = Math.max(
        1,
        Math.min(tabState.index, tabState.entries.length)
      );
    } else {
      options.loadArguments = loadArguments;

      // If we're resuming a load which has been redirected from another
      // process, record the history index which is currently being requested.
      // It has to be offset by 1 to get back to native history indices from
      // SessionStore history indicies.
      if (loadArguments.redirectLoadSwitchId) {
__L_V__5({
    lN: 3754,tT:'if',pr:'loadArguments.redirectLoadSwitchId',eT:{},fN:''
  });'__L_V__5';
        loadArguments.redirectHistoryIndex = tabState.requestedIndex - 1;
      }
    }

    // Need to reset restoring tabs.
    if (TAB_STATE_FOR_BROWSER.has(tab.linkedBrowser)) {
__L_V__5({
    lN: 3760,tT:'if',pr:'TAB_STATE_FOR_BROWSER.has(tab.linkedBrowser)',eT:{},fN:''
  });'__L_V__5';
      this._resetLocalTabRestoringState(tab);
    }

    // Restore the state into the tab.
    this.restoreTab(tab, tabState, options);
  },

  /**
   * Retrieves the latest session history information for a tab. The cached data
   * is returned immediately, but a callback may be provided that supplies
   * up-to-date data when or if it is available. The callback is passed a single
   * argument with data in the same format as the return value.
   *
   * @param tab tab to retrieve the session history for
   * @param updatedCallback function to call with updated data as the single argument
   * @returns a object containing 'index' specifying the current index, and an
   * array 'entries' containing an object for each history item.
   */
  getSessionHistory(tab, updatedCallback) {
__L_V__5({
    lN: 3779,tT:'func',pr:'',eT:{'tab':tab,'updatedCallback':updatedCallback},fN:'getSessionHistory'
  });'__L_V__5';
    if (updatedCallback) {
__L_V__5({
    lN: 3780,tT:'if',pr:'updatedCallback',eT:{},fN:''
  });'__L_V__5';
      TabStateFlusher.flush(tab.linkedBrowser).then(() => {
        let sessionHistory = this.getSessionHistory(tab);
        if (sessionHistory) {
__L_V__5({
    lN: 3783,tT:'if',pr:'sessionHistory',eT:{},fN:''
  });'__L_V__5';
          updatedCallback(sessionHistory);
        }
      });
    }

    // Don't continue if the tab was closed before TabStateFlusher.flush resolves.
    if (tab.linkedBrowser) {
__L_V__5({
    lN: 3790,tT:'if',pr:'tab.linkedBrowser',eT:{},fN:''
  });'__L_V__5';
      let tabState = TabState.collect(tab, TAB_CUSTOM_VALUES.get(tab));
      return { index: tabState.index - 1, entries: tabState.entries };
    }
    return null;
  },

  /**
   * See if aWindow is usable for use when restoring a previous session via
   * restoreLastSession. If usable, prepare it for use.
   *
   * @param aWindow
   *        the window to inspect & prepare
   * @returns [canUseWindow, canOverwriteTabs]
   *          canUseWindow: can the window be used to restore into
   *          canOverwriteTabs: all of the current tabs are home pages and we
   *                            can overwrite them
   */
  _prepWindowToRestoreInto: function ssi_prepWindowToRestoreInto(aWindow) {
__L_V__5({
    lN: 3808,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_prepWindowToRestoreInto'
  });'__L_V__5';
    if (!aWindow) {
__L_V__5({
    lN: 3809,tT:'if',pr:'!aWindow',eT:{},fN:''
  });'__L_V__5';
      return [false, false];
    }

    // We might be able to overwrite the existing tabs instead of just adding
    // the previous session's tabs to the end. This will be set if possible.
    let canOverwriteTabs = false;

    // Look at the open tabs in comparison to home pages. If all the tabs are
    // home pages then we'll end up overwriting all of them. Otherwise we'll
    // just close the tabs that match home pages. Tabs with the about:blank
    // URI will always be overwritten.
    let homePages = ["about:blank"];
    let removableTabs = [];
    let tabbrowser = aWindow.gBrowser;
    let addFreshTab = this._prefBranch.getBoolPref("startup.addFreshTab");
    if (addFreshTab) {
__L_V__5({
    lN: 3825,tT:'if',pr:'addFreshTab',eT:{},fN:''
  });'__L_V__5';
      homePages = homePages.concat(HomePage.get(aWindow).split("|"));
    }

    for (let i = tabbrowser._numPinnedTabs; i < tabbrowser.tabs.length; i++) {
      let tab = tabbrowser.tabs[i];
      if (homePages.includes(tab.linkedBrowser.currentURI.spec)) {
__L_V__5({
    lN: 3831,tT:'if',pr:'homePages.includes(tab.linkedBrowser.currentURI.spec)',eT:{},fN:''
  });'__L_V__5';
        removableTabs.push(tab);
      }
    }

    if (tabbrowser.tabs.length == removableTabs.length) {
__L_V__5({
    lN: 3836,tT:'if',pr:'tabbrowser.tabs.length == removableTabs.length',eT:{},fN:''
  });'__L_V__5';
      canOverwriteTabs = true;
    } else {
      // If we're not overwriting all of the tabs, then close the home tabs.
      for (let i = removableTabs.length - 1; i >= 0; i--) {
        tabbrowser.removeTab(removableTabs.pop(), { animate: false });
      }
    }

    return [true, canOverwriteTabs];
  },

  /* ........ Saving Functionality .............. */

  /**
   * Store window dimensions, visibility, sidebar
   * @param aWindow
   *        Window reference
   */
  _updateWindowFeatures: function ssi_updateWindowFeatures(aWindow) {
__L_V__5({
    lN: 3855,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_updateWindowFeatures'
  });'__L_V__5';
    var winData = this._windows[aWindow.__SSi];

    WINDOW_ATTRIBUTES.forEach(function(aAttr) {
      winData[aAttr] = this._getWindowDimension(aWindow, aAttr);
    }, this);

    if (winData.sizemode != "minimized") {
__L_V__5({
    lN: 3862,tT:'if',pr:'winData.sizemode != minimized',eT:{},fN:''
  });'__L_V__5';
      winData.sizemodeBeforeMinimized = winData.sizemode;
    }

    var hidden = WINDOW_HIDEABLE_FEATURES.filter(function(aItem) {
      return aWindow[aItem] && !aWindow[aItem].visible;
    });
    if (hidden.length) {
__L_V__5({
    lN: 3869,tT:'if',pr:'hidden.length',eT:{},fN:''
  });'__L_V__5';
      winData.hidden = hidden.join(",");
    } else if (winData.hidden) {
__L_V__5({
    lN: 3871,tT:'if',pr:'winData.hidden',eT:{},fN:''
  });'__L_V__5';
      delete winData.hidden;
    }

    let sidebarBox = aWindow.document.getElementById("sidebar-box");
    let sidebar = sidebarBox.getAttribute("sidebarcommand");
    if (sidebar && sidebarBox.getAttribute("checked") == "true") {
__L_V__5({
    lN: 3877,tT:'if',pr:'sidebar && sidebarBox.getAttribute(checked) == true',eT:{},fN:''
  });'__L_V__5';
      winData.sidebar = sidebar;
    } else if (winData.sidebar) {
__L_V__5({
    lN: 3879,tT:'if',pr:'winData.sidebar',eT:{},fN:''
  });'__L_V__5';
      delete winData.sidebar;
    }
    let workspaceID = aWindow.getWorkspaceID();
    if (workspaceID) {
__L_V__5({
    lN: 3883,tT:'if',pr:'workspaceID',eT:{},fN:''
  });'__L_V__5';
      winData.workspaceID = workspaceID;
    }
  },

  /**
   * gather session data as object
   * @param aUpdateAll
   *        Bool update all windows
   * @returns object
   */
  getCurrentState(aUpdateAll) {
__L_V__5({
    lN: 3894,tT:'func',pr:'',eT:{'aUpdateAll':aUpdateAll},fN:'getCurrentState'
  });'__L_V__5';
    this._handleClosedWindows().then(() => {
      this._notifyOfClosedObjectsChange();
    });

    var activeWindow = this._getTopWindow();

    TelemetryStopwatch.start("FX_SESSION_RESTORE_COLLECT_ALL_WINDOWS_DATA_MS");
    if (RunState.isRunning) {
__L_V__5({
    lN: 3902,tT:'if',pr:'RunState.isRunning',eT:{},fN:''
  });'__L_V__5';
      // update the data for all windows with activities since the last save operation.
      let index = 0;
      for (let window of this._orderedBrowserWindows) {
        if (!this._isWindowLoaded(window)) {
__L_V__5({
    lN: 3906,tT:'if',pr:'!this._isWindowLoaded(window)',eT:{},fN:''
  });'__L_V__5';
          // window data is still in _statesToRestore
          continue;
        }
        if (aUpdateAll || DirtyWindows.has(window) || window == activeWindow) {
__L_V__5({
    lN: 3910,tT:'if',pr:'aUpdateAll || DirtyWindows.has(window) || window == activeWindow',eT:{},fN:''
  });'__L_V__5';
          this._collectWindowData(window);
        } else {
          // always update the window features (whose change alone never triggers a save operation)
          this._updateWindowFeatures(window);
        }
        this._windows[window.__SSi].zIndex = ++index;
      }
      DirtyWindows.clear();
    }
    TelemetryStopwatch.finish("FX_SESSION_RESTORE_COLLECT_ALL_WINDOWS_DATA_MS");

    // An array that at the end will hold all current window data.
    var total = [];
    // The ids of all windows contained in 'total' in the same order.
    var ids = [];
    // The number of window that are _not_ popups.
    var nonPopupCount = 0;
    var ix;

    // collect the data for all windows
    for (ix in this._windows) {
      if (this._windows[ix]._restoring) {
__L_V__5({
    lN: 3932,tT:'if',pr:'this._windows[ix]._restoring',eT:{},fN:''
  });'__L_V__5';
        // window data is still in _statesToRestore
        continue;
      }
      total.push(this._windows[ix]);
      ids.push(ix);
      if (!this._windows[ix].isPopup) {
__L_V__5({
    lN: 3938,tT:'if',pr:'!this._windows[ix].isPopup',eT:{},fN:''
  });'__L_V__5';
        nonPopupCount++;
      }
    }

    // collect the data for all windows yet to be restored
    for (ix in this._statesToRestore) {
      for (let winData of this._statesToRestore[ix].windows) {
        total.push(winData);
        if (!winData.isPopup) {
__L_V__5({
    lN: 3947,tT:'if',pr:'!winData.isPopup',eT:{},fN:''
  });'__L_V__5';
          nonPopupCount++;
        }
      }
    }

    // shallow copy this._closedWindows to preserve current state
    let lastClosedWindowsCopy = this._closedWindows.slice();

    if (AppConstants.platform != "macosx") {
__L_V__5({
    lN: 3956,tT:'if',pr:'AppConstants.platform != macosx',eT:{},fN:''
  });'__L_V__5';
      // If no non-popup browser window remains open, return the state of the last
      // closed window(s). We only want to do this when we're actually "ending"
      // the session.
      // XXXzpao We should do this for _restoreLastWindow == true, but that has
      //        its own check for popups. c.f. bug 597619
      if (
        nonPopupCount == 0 &&
        !!lastClosedWindowsCopy.length &&
        RunState.isQuitting
      ) {
__L_V__5({
    lN: 3966,tT:'if',pr:' nonPopupCount == 0 && !!lastClosedWindowsCopy.length && RunState.isQuitting ',eT:{},fN:''
  });'__L_V__5';
        // prepend the last non-popup browser window, so that if the user loads more tabs
        // at startup we don't accidentally add them to a popup window
        do {
          total.unshift(lastClosedWindowsCopy.shift());
        } while (total[0].isPopup && lastClosedWindowsCopy.length);
      }
    }

    if (activeWindow) {
__L_V__5({
    lN: 3975,tT:'if',pr:'activeWindow',eT:{},fN:''
  });'__L_V__5';
      this.activeWindowSSiCache = activeWindow.__SSi || "";
    }
    ix = ids.indexOf(this.activeWindowSSiCache);
    // We don't want to restore focus to a minimized window or a window which had all its
    // tabs stripped out (doesn't exist).
    if (ix != -1 && total[ix] && total[ix].sizemode == "minimized") {
__L_V__5({
    lN: 3981,tT:'if',pr:'ix != -1 && total[ix] && total[ix].sizemode == minimized',eT:{},fN:''
  });'__L_V__5';
      ix = -1;
    }

    let session = {
      lastUpdate: Date.now(),
      startTime: this._sessionStartTime,
      recentCrashes: this._recentCrashes,
    };

    // CLIQZ-SPECIAL:
    // DB-2057
    // We need to find every single tab's entries to determine whether those contain url
    // which could be related to moz-extension.
    // If we find any of those we mark them as isCliqzPage.
    // If a user gets refreshed after all then those moz-extension urls are invalid anymore.
    // isCliqzPage will help us to restore (to swap for valid ones) them in that case.
    let totalTabs = [];
    let totalEntries = [];
    for (let winData of total) {
      totalTabs.push.apply(totalTabs, winData.tabs);
    }
    for (let tabData of totalTabs) {
      totalEntries.push.apply(totalEntries, tabData.entries);
    }
    for (let entryData of totalEntries) {
      if (CliqzResources.isCliqzPage(entryData.url)) {
__L_V__5({
    lN: 4007,tT:'if',pr:'CliqzResources.isCliqzPage(entryData.url)',eT:{},fN:''
  });'__L_V__5';
        entryData.isCliqzPage = 1;
      }
    }

    let state = {
      version: ["sessionrestore", FORMAT_VERSION],
      windows: total,
      selectedWindow: ix + 1,
      _closedWindows: lastClosedWindowsCopy,
      session,
      global: this._globalState.getState(),
    };

    // Collect and store session cookies.
    state.cookies = SessionCookies.collect();

    DevToolsShim.saveDevToolsSession(state);

    // Persist the last session if we deferred restoring it
    if (LastSession.canRestore) {
__L_V__5({
    lN: 4027,tT:'if',pr:'LastSession.canRestore',eT:{},fN:''
  });'__L_V__5';
      state.lastSessionState = LastSession.getState();
    }

    // If we were called by the SessionSaver and started with only a private
    // window we want to pass the deferred initial state to not lose the
    // previous session.
    if (this._deferredInitialState) {
__L_V__5({
    lN: 4034,tT:'if',pr:'this._deferredInitialState',eT:{},fN:''
  });'__L_V__5';
      state.deferredInitialState = this._deferredInitialState;
    }

    return state;
  },

  /**
   * serialize session data for a window
   * @param aWindow
   *        Window reference
   * @returns string
   */
  _getWindowState: function ssi_getWindowState(aWindow) {
__L_V__5({
    lN: 4047,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_getWindowState'
  });'__L_V__5';
    if (!this._isWindowLoaded(aWindow)) {
__L_V__5({
    lN: 4048,tT:'if',pr:'!this._isWindowLoaded(aWindow)',eT:{},fN:''
  });'__L_V__5';
      return this._statesToRestore[WINDOW_RESTORE_IDS.get(aWindow)];
    }

    if (RunState.isRunning) {
__L_V__5({
    lN: 4052,tT:'if',pr:'RunState.isRunning',eT:{},fN:''
  });'__L_V__5';
      this._collectWindowData(aWindow);
    }

    return { windows: [this._windows[aWindow.__SSi]] };
  },

  /**
   * Gathers data about a window and its tabs, and updates its
   * entry in this._windows.
   *
   * @param aWindow
   *        Window references.
   * @returns a Map mapping the browser tabs from aWindow to the tab
   *          entry that was put into the window data in this._windows.
   */
  _collectWindowData: function ssi_collectWindowData(aWindow) {
__L_V__5({
    lN: 4068,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_collectWindowData'
  });'__L_V__5';
    let tabMap = new Map();

    if (!this._isWindowLoaded(aWindow)) {
__L_V__5({
    lN: 4071,tT:'if',pr:'!this._isWindowLoaded(aWindow)',eT:{},fN:''
  });'__L_V__5';
      return tabMap;
    }

    let tabbrowser = aWindow.gBrowser;
    let tabs = tabbrowser.tabs;
    let winData = this._windows[aWindow.__SSi];
    let tabsData = (winData.tabs = []);

    // update the internal state data for this window
    for (let tab of tabs) {
      let tabData = TabState.collect(tab, TAB_CUSTOM_VALUES.get(tab));
      tabMap.set(tab, tabData);
      tabsData.push(tabData);
    }
    winData.selected = tabbrowser.tabbox.selectedIndex + 1;

    this._updateWindowFeatures(aWindow);

    // Make sure we keep __SS_lastSessionWindowID around for cases like entering
    // or leaving PB mode.
    if (aWindow.__SS_lastSessionWindowID) {
__L_V__5({
    lN: 4092,tT:'if',pr:'aWindow.__SS_lastSessionWindowID',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi].__lastSessionWindowID =
        aWindow.__SS_lastSessionWindowID;
    }

    DirtyWindows.remove(aWindow);
    return tabMap;
  },

  /* ........ Restoring Functionality .............. */

  /**
   * Open windows with data
   *
   * @param root
   *        Windows data
   * @returns a promise resolved when all windows have been opened
   */
  _openWindows(root) {
__L_V__5({
    lN: 4110,tT:'func',pr:'',eT:{'root':root},fN:'_openWindows'
  });'__L_V__5';
    for (let winData of root.windows) {
      if (!winData || !winData.tabs || !winData.tabs[0]) {
__L_V__5({
    lN: 4112,tT:'if',pr:'!winData || !winData.tabs || !winData.tabs[0]',eT:{},fN:''
  });'__L_V__5';
        continue;
      }
      this._openWindowWithState({ windows: [winData] });
    }
    return Promise.all(
      [...WINDOW_SHOWING_PROMISES.values()].map(deferred => deferred.promise)
    );
  },

  /**
   * restore features to a single window
   * @param aWindow
   *        Window reference to the window to use for restoration
   * @param winData
   *        JS object
   * @param aOptions
   *        {overwriteTabs: true} to overwrite existing tabs w/ new ones
   *        {firstWindow: true} if this is the first non-private window we're
   *                            restoring in this session, that might open an
   *                            external link as well
   */
  restoreWindow: function ssi_restoreWindow(aWindow, winData, aOptions = {}) {
__L_V__5({
    lN: 4134,tT:'func',pr:'',eT:{'aWindow':aWindow,'winData':winData,'aOptions':aOptions},fN:'ssi_restoreWindow'
  });'__L_V__5';
    let overwriteTabs = aOptions && aOptions.overwriteTabs;
    let firstWindow = aOptions && aOptions.firstWindow;

    // initialize window if necessary
    if (aWindow && (!aWindow.__SSi || !this._windows[aWindow.__SSi])) {
__L_V__5({
    lN: 4139,tT:'if',pr:'aWindow && (!aWindow.__SSi || !this._windows[aWindow.__SSi])',eT:{},fN:''
  });'__L_V__5';
      this.onLoad(aWindow);
    }

    TelemetryStopwatch.start("FX_SESSION_RESTORE_RESTORE_WINDOW_MS");

    // We're not returning from this before we end up calling restoreTabs
    // for this window, so make sure we send the SSWindowStateBusy event.
    this._setWindowStateBusy(aWindow);

    if (winData.workspaceID) {
__L_V__5({
    lN: 4149,tT:'if',pr:'winData.workspaceID',eT:{},fN:''
  });'__L_V__5';
      aWindow.moveToWorkspace(winData.workspaceID);
    }

    if (!winData.tabs) {
__L_V__5({
    lN: 4153,tT:'if',pr:'!winData.tabs',eT:{},fN:''
  });'__L_V__5';
      winData.tabs = [];
      // don't restore a single blank tab when we've had an external
      // URL passed in for loading at startup (cf. bug 357419)
    } else if (
      firstWindow &&
      !overwriteTabs &&
      winData.tabs.length == 1 &&
      (!winData.tabs[0].entries || !winData.tabs[0].entries.length)
    ) {
__L_V__5({
    lN: 4162,tT:'if',pr:' firstWindow && !overwriteTabs && winData.tabs.length == 1 && (!winData.tabs[0].entries || !winData.tabs[0].entries.length) ',eT:{},fN:''
  });'__L_V__5';
      winData.tabs = [];
    }

    // CLIQZ-SPECIAL: this piece of code remove all the
    // homepage entries from the session restore object
    // except one, we need atleast one tab for restore.
    if (!overwriteTabs) {
__L_V__5({
    lN: 4169,tT:'if',pr:'!overwriteTabs',eT:{},fN:''
  });'__L_V__5';
      let homePages = HomePage.get().split("|");
      let hasHome = false;
      winData.tabs = winData.tabs.filter(function ({ entries = [] }) {
        // Entries is array of history address URL, which allows back navigation
        // even after restore.
        // 0: moz-extension:asdasdasdasdassd
        // 1: https://google.com
        // 2: https://cliqz.com
        // we are only interested in last entry
        const lastEntry = entries[entries.length - 1] || {};
        if (!lastEntry.url) {
__L_V__5({
    lN: 4180,tT:'if',pr:'!lastEntry.url',eT:{},fN:''
  });'__L_V__5';
          return true;
        }
        const isHome = homePages.includes(lastEntry.url);
        if (isHome && hasHome) {
__L_V__5({
    lN: 4184,tT:'if',pr:'isHome && hasHome',eT:{},fN:''
  });'__L_V__5';
          return false;
        }
        hasHome = true;
        return true;
      });
    }

    // See SessionStoreInternal.restoreTabs for a description of what
    // selectTab represents.
    let selectTab = 0;
    if (overwriteTabs) {
__L_V__5({
    lN: 4195,tT:'if',pr:'overwriteTabs',eT:{},fN:''
  });'__L_V__5';
      selectTab = parseInt(winData.selected || 1, 10);
      selectTab = Math.max(selectTab, 1);
      selectTab = Math.min(selectTab, winData.tabs.length);
    }

    let tabbrowser = aWindow.gBrowser;

    // disable smooth scrolling while adding, moving, removing and selecting tabs
    let arrowScrollbox = tabbrowser.tabContainer.arrowScrollbox;
    let smoothScroll = arrowScrollbox.smoothScroll;
    arrowScrollbox.smoothScroll = false;

    // We need to keep track of the initially open tabs so that they
    // can be moved to the end of the restored tabs.
    let initialTabs;
    if (!overwriteTabs && firstWindow) {
__L_V__5({
    lN: 4211,tT:'if',pr:'!overwriteTabs && firstWindow',eT:{},fN:''
  });'__L_V__5';
      initialTabs = Array.from(tabbrowser.tabs);
    }

    // Get rid of tabs that aren't needed anymore.
    if (overwriteTabs) {
__L_V__5({
    lN: 4216,tT:'if',pr:'overwriteTabs',eT:{},fN:''
  });'__L_V__5';
      for (let i = tabbrowser.browsers.length - 1; i >= 0; i--) {
        if (!tabbrowser.tabs[i].selected) {
__L_V__5({
    lN: 4218,tT:'if',pr:'!tabbrowser.tabs[i].selected',eT:{},fN:''
  });'__L_V__5';
          tabbrowser.removeTab(tabbrowser.tabs[i]);
        }
      }
    }

    let restoreTabsLazily =
      this._prefBranch.getBoolPref("sessionstore.restore_tabs_lazily") &&
      this._restore_on_demand;

    var tabs = tabbrowser.addMultipleTabs(
      restoreTabsLazily,
      selectTab,
      winData.tabs
    );

    // Move the originally open tabs to the end.
    if (initialTabs) {
__L_V__5({
    lN: 4235,tT:'if',pr:'initialTabs',eT:{},fN:''
  });'__L_V__5';
      let endPosition = tabbrowser.tabs.length - 1;
      for (let i = 0; i < initialTabs.length; i++) {
        tabbrowser.unpinTab(initialTabs[i]);
        tabbrowser.moveTabTo(initialTabs[i], endPosition);
      }
    }

    // We want to correlate the window with data from the last session, so
    // assign another id if we have one. Otherwise clear so we don't do
    // anything with it.
    delete aWindow.__SS_lastSessionWindowID;
    if (winData.__lastSessionWindowID) {
__L_V__5({
    lN: 4247,tT:'if',pr:'winData.__lastSessionWindowID',eT:{},fN:''
  });'__L_V__5';
      aWindow.__SS_lastSessionWindowID = winData.__lastSessionWindowID;
    }

    if (overwriteTabs) {
__L_V__5({
    lN: 4251,tT:'if',pr:'overwriteTabs',eT:{},fN:''
  });'__L_V__5';
      delete this._windows[aWindow.__SSi].extData;
    }

    // Restore cookies from legacy sessions, i.e. before bug 912717.
    SessionCookies.restore(winData.cookies || []);

    if (winData.extData) {
__L_V__5({
    lN: 4258,tT:'if',pr:'winData.extData',eT:{},fN:''
  });'__L_V__5';
      if (!this._windows[aWindow.__SSi].extData) {
__L_V__5({
    lN: 4259,tT:'if',pr:'!this._windows[aWindow.__SSi].extData',eT:{},fN:''
  });'__L_V__5';
        this._windows[aWindow.__SSi].extData = {};
      }
      for (var key in winData.extData) {
        this._windows[aWindow.__SSi].extData[key] = winData.extData[key];
      }
    }

    let newClosedTabsData = winData._closedTabs || [];

    if (overwriteTabs || firstWindow) {
__L_V__5({
    lN: 4269,tT:'if',pr:'overwriteTabs || firstWindow',eT:{},fN:''
  });'__L_V__5';
      // Overwrite existing closed tabs data when overwriteTabs=true
      // or we're the first window to be restored.
      this._windows[aWindow.__SSi]._closedTabs = newClosedTabsData;
    } else if (this._max_tabs_undo > 0) {
__L_V__5({
    lN: 4273,tT:'if',pr:'this._max_tabs_undo > 0',eT:{},fN:''
  });'__L_V__5';
      // If we merge tabs, we also want to merge closed tabs data. We'll assume
      // the restored tabs were closed more recently and append the current list
      // of closed tabs to the new one...
      newClosedTabsData = newClosedTabsData.concat(
        this._windows[aWindow.__SSi]._closedTabs
      );

      // ... and make sure that we don't exceed the max number of closed tabs
      // we can restore.
      this._windows[aWindow.__SSi]._closedTabs = newClosedTabsData.slice(
        0,
        this._max_tabs_undo
      );
    }

    // Restore tabs, if any.
    if (winData.tabs.length) {
__L_V__5({
    lN: 4290,tT:'if',pr:'winData.tabs.length',eT:{},fN:''
  });'__L_V__5';
      this.restoreTabs(aWindow, tabs, winData.tabs, selectTab);
    }

    // set smoothScroll back to the original value
    arrowScrollbox.smoothScroll = smoothScroll;

    TelemetryStopwatch.finish("FX_SESSION_RESTORE_RESTORE_WINDOW_MS");

    this._setWindowStateReady(aWindow);

    this._sendWindowRestoredNotification(aWindow);

    Services.obs.notifyObservers(aWindow, NOTIFY_SINGLE_WINDOW_RESTORED);

    this._sendRestoreCompletedNotifications();
  },

  /**
   * Prepare connection to host beforehand.
   *
   * @param tab
   *        Tab we are loading from.
   * @param url
   *        URL of a host.
   * @returns a flag indicates whether a connection has been made
   */
  prepareConnectionToHost(tab, url) {
__L_V__5({
    lN: 4317,tT:'func',pr:'',eT:{'tab':tab,'url':url},fN:'prepareConnectionToHost'
  });'__L_V__5';
    if (!url.startsWith("about:")) {
__L_V__5({
    lN: 4318,tT:'if',pr:'!url.startsWith(about:)',eT:{},fN:''
  });'__L_V__5';
      let principal = Services.scriptSecurityManager.createNullPrincipal({
        userContextId: tab.userContextId,
      });
      let sc = Services.io.QueryInterface(Ci.nsISpeculativeConnect);
      let uri = Services.io.newURI(url);
      try {
        sc.speculativeConnect(uri, principal, null);
        return true;
      } catch (error) {
        // Can't setup speculative connection for this url.
        Cu.reportError(error);
        return false;
      }
    }
    return false;
  },

  /**
   * Make a connection to a host when users hover mouse on a tab.
   * This will also set a flag in the tab to prevent us from speculatively
   * connecting a second time.
   *
   * @param tab
   *        a tab to speculatively connect on mouse hover.
   */
  speculativeConnectOnTabHover(tab) {
__L_V__5({
    lN: 4344,tT:'func',pr:'',eT:{'tab':tab},fN:'speculativeConnectOnTabHover'
  });'__L_V__5';
    let tabState = TAB_LAZY_STATES.get(tab);
    if (tabState && !tabState.connectionPrepared) {
__L_V__5({
    lN: 4346,tT:'if',pr:'tabState && !tabState.connectionPrepared',eT:{},fN:''
  });'__L_V__5';
      let url = this.getLazyTabValue(tab, "url");
      let prepared = this.prepareConnectionToHost(tab, url);
      // This is used to test if a connection has been made beforehand.
      if (gDebuggingEnabled) {
__L_V__5({
    lN: 4350,tT:'if',pr:'gDebuggingEnabled',eT:{},fN:''
  });'__L_V__5';
        tab.__test_connection_prepared = prepared;
        tab.__test_connection_url = url;
      }
      // A flag indicate that we've prepared a connection for this tab and
      // if is called again, we shouldn't prepare another connection.
      tabState.connectionPrepared = true;
    }
  },

  /**
   * This function will restore window features and then retore window data.
   *
   * @param windows
   *        ordered array of windows to restore
   */
  _restoreWindowsFeaturesAndTabs(windows) {
__L_V__5({
    lN: 4366,tT:'func',pr:'',eT:{'windows':windows},fN:'_restoreWindowsFeaturesAndTabs'
  });'__L_V__5';
    // First, we restore window features, so that when users start interacting
    // with a window, we don't steal the window focus.
    for (let window of windows) {
      let state = this._statesToRestore[WINDOW_RESTORE_IDS.get(window)];
      this.restoreWindowFeatures(window, state.windows[0]);
    }

    // Then we restore data into windows.
    for (let window of windows) {
      let state = this._statesToRestore[WINDOW_RESTORE_IDS.get(window)];
      this.restoreWindow(
        window,
        state.windows[0],
        state.options || { overwriteTabs: true }
      );
      WINDOW_RESTORE_ZINDICES.delete(window);
    }
  },

  /**
   * This function will restore window in reversed z-index, so that users will
   * be presented with most recently used window first.
   *
   * @param windows
   *        unordered array of windows to restore
   */
  _restoreWindowsInReversedZOrder(windows) {
__L_V__5({
    lN: 4393,tT:'func',pr:'',eT:{'windows':windows},fN:'_restoreWindowsInReversedZOrder'
  });'__L_V__5';
    windows.sort(
      (a, b) =>
        (WINDOW_RESTORE_ZINDICES.get(a) || 0) -
        (WINDOW_RESTORE_ZINDICES.get(b) || 0)
    );

    this.windowToFocus = windows[0];
    this._restoreWindowsFeaturesAndTabs(windows);
  },

  /**
   * Restore multiple windows using the provided state.
   * @param aWindow
   *        Window reference to the first window to use for restoration.
   *        Additionally required windows will be opened.
   * @param aState
   *        JS object or JSON string
   * @param aOptions
   *        {overwriteTabs: true} to overwrite existing tabs w/ new ones
   *        {firstWindow: true} if this is the first non-private window we're
   *                            restoring in this session, that might open an
   *                            external link as well
   */
  restoreWindows: function ssi_restoreWindows(aWindow, aState, aOptions = {}) {
__L_V__5({
    lN: 4417,tT:'func',pr:'',eT:{'aWindow':aWindow,'aState':aState,'aOptions':aOptions},fN:'ssi_restoreWindows'
  });'__L_V__5';
    // initialize window if necessary
    if (aWindow && (!aWindow.__SSi || !this._windows[aWindow.__SSi])) {
__L_V__5({
    lN: 4419,tT:'if',pr:'aWindow && (!aWindow.__SSi || !this._windows[aWindow.__SSi])',eT:{},fN:''
  });'__L_V__5';
      this.onLoad(aWindow);
    }

    let root;
    try {
      root = typeof aState == "string" ? JSON.parse(aState) : aState;
    } catch (ex) {
      // invalid state object - don't restore anything
      debug(ex);
      this._sendRestoreCompletedNotifications();
      return;
    }

    // Restore closed windows if any.
    if (root._closedWindows) {
__L_V__5({
    lN: 4434,tT:'if',pr:'root._closedWindows',eT:{},fN:''
  });'__L_V__5';
      this._closedWindows = root._closedWindows;
      this._closedObjectsChanged = true;
    }

    // We're done here if there are no windows.
    if (!root.windows || !root.windows.length) {
__L_V__5({
    lN: 4440,tT:'if',pr:'!root.windows || !root.windows.length',eT:{},fN:''
  });'__L_V__5';
      this._sendRestoreCompletedNotifications();
      return;
    }

    // CLIQZ-SPECIAL:
    // aWindow contains data which does not correspond to any session state yet.
    // Also it contains a "page" information that is to be displayed in a loading tab,
    // user could click on a link in some of his/her applications.
    // root.windows is an Array of windows data retrieved from a user's session.
    // Here we need to find a window with zIndex equaled to 1.
    // That means this window will be on top of the others after restore process is done.
    // Putting a new aWindow data into that window with zIndex = 1 will let us display
    // a new tabbrowser (a new tab) always on top (explicitly visible) for a user.
    let firstWindowData = null;
    for (let i = 0, l = root.windows.length; i < l; i++) {

      if (root.windows[i].zIndex === 1) {
__L_V__5({
    lN: 4457,tT:'if',pr:'root.windows[i].zIndex === 1',eT:{},fN:''
  });'__L_V__5';
        firstWindowData = root.windows.splice(i, 1);
        break;
      }
    }
    // Fallback.
    // If by any case (only FF guys know the details of who it works;))
    // a window with zIndex equaled to 1 has not been found we take the first one from a session.
    if (firstWindowData == null) {
__L_V__5({
    lN: 4465,tT:'if',pr:'firstWindowData == null',eT:{},fN:''
  });'__L_V__5';
      firstWindowData = root.windows.splice(0, 1);
    }

    // Store the restore state and restore option of the current window,
    // so that the window can be restored in reversed z-order.
    this._updateWindowRestoreState(aWindow, {
      windows: firstWindowData,
      options: aOptions,
    });

    // Begin the restoration: First open all windows in creation order. After all
    // windows have opened, we restore states to windows in reversed z-order.
    this._openWindows(root).then(windows => {
      // We want to add current window to opened window, so that this window will be
      // restored in reversed z-order. (We add the window to first position, in case
      // no z-indices are found, that window will be restored first.)
      windows.unshift(aWindow);

      this._restoreWindowsInReversedZOrder(windows);
    });

    DevToolsShim.restoreDevToolsSession(aState);
  },

  /**
   * Manage history restoration for a window
   * @param aWindow
   *        Window to restore the tabs into
   * @param aTabs
   *        Array of tab references
   * @param aTabData
   *        Array of tab data
   * @param aSelectTab
   *        Index of the tab to select. This is a 1-based index where "1"
   *        indicates the first tab should be selected, and "0" indicates that
   *        the currently selected tab will not be changed.
   */
  restoreTabs(aWindow, aTabs, aTabData, aSelectTab) {
__L_V__5({
    lN: 4503,tT:'func',pr:'',eT:{'aWindow':aWindow,'aTabs':aTabs,'aTabData':aTabData,'aSelectTab':aSelectTab},fN:'restoreTabs'
  });'__L_V__5';
    var tabbrowser = aWindow.gBrowser;

    if (!this._isWindowLoaded(aWindow)) {
__L_V__5({
    lN: 4506,tT:'if',pr:'!this._isWindowLoaded(aWindow)',eT:{},fN:''
  });'__L_V__5';
      // from now on, the data will come from the actual window
      delete this._statesToRestore[WINDOW_RESTORE_IDS.get(aWindow)];
      WINDOW_RESTORE_IDS.delete(aWindow);
      delete this._windows[aWindow.__SSi]._restoring;
    }

    let numTabsToRestore = aTabs.length;
    let numTabsInWindow = tabbrowser.tabs.length;
    let tabsDataArray = this._windows[aWindow.__SSi].tabs;

    // Update the window state in case we shut down without being notified.
    // Individual tab states will be taken care of by restoreTab() below.
    if (numTabsInWindow == numTabsToRestore) {
__L_V__5({
    lN: 4519,tT:'if',pr:'numTabsInWindow == numTabsToRestore',eT:{},fN:''
  });'__L_V__5';
      // Remove all previous tab data.
      tabsDataArray.length = 0;
    } else {
      // Remove all previous tab data except tabs that should not be overriden.
      tabsDataArray.splice(numTabsInWindow - numTabsToRestore);
    }

    // Let the tab data array have the right number of slots.
    tabsDataArray.length = numTabsInWindow;

    if (aSelectTab > 0 && aSelectTab <= aTabs.length) {
__L_V__5({
    lN: 4530,tT:'if',pr:'aSelectTab > 0 && aSelectTab <= aTabs.length',eT:{},fN:''
  });'__L_V__5';
      // Update the window state in case we shut down without being notified.
      this._windows[aWindow.__SSi].selected = aSelectTab;
    }

    // If we restore the selected tab, make sure it goes first.
    let selectedIndex = aTabs.indexOf(tabbrowser.selectedTab);
    if (selectedIndex > -1) {
__L_V__5({
    lN: 4537,tT:'if',pr:'selectedIndex > -1',eT:{},fN:''
  });'__L_V__5';
      this.restoreTab(tabbrowser.selectedTab, aTabData[selectedIndex]);
    }

    // Restore all tabs.
    for (let t = 0; t < aTabs.length; t++) {
      if (t != selectedIndex) {
__L_V__5({
    lN: 4543,tT:'if',pr:'t != selectedIndex',eT:{},fN:''
  });'__L_V__5';
        this.restoreTab(aTabs[t], aTabData[t]);
      }
    }
  },

  // Restores the given tab state for a given tab.
  restoreTab(tab, tabData, options = {}) {
__L_V__5({
    lN: 4550,tT:'func',pr:'',eT:{'tab':tab,'tabData':tabData,'options':options},fN:'restoreTab'
  });'__L_V__5';
    let browser = tab.linkedBrowser;

    if (TAB_STATE_FOR_BROWSER.has(browser)) {
__L_V__5({
    lN: 4553,tT:'if',pr:'TAB_STATE_FOR_BROWSER.has(browser)',eT:{},fN:''
  });'__L_V__5';
      Cu.reportError("Must reset tab before calling restoreTab.");
      return;
    }

    let loadArguments = options.loadArguments;
    let window = tab.ownerGlobal;
    let tabbrowser = window.gBrowser;
    let forceOnDemand = options.forceOnDemand;

    let willRestoreImmediately =
      options.restoreImmediately || tabbrowser.selectedBrowser == browser;

    let isBrowserInserted = browser.isConnected;

    // Increase the busy state counter before modifying the tab.
    this._setWindowStateBusy(window);

    // It's important to set the window state to dirty so that
    // we collect their data for the first time when saving state.
    DirtyWindows.add(window);

    // In case we didn't collect/receive data for any tabs yet we'll have to
    // fill the array with at least empty tabData objects until |_tPos| or
    // we'll end up with |null| entries.
    for (let otherTab of Array.prototype.slice.call(
      tabbrowser.tabs,
      0,
      tab._tPos
    )) {
      let emptyState = { entries: [], lastAccessed: otherTab.lastAccessed };
      this._windows[window.__SSi].tabs.push(emptyState);
    }

    // Update the tab state in case we shut down without being notified.
    this._windows[window.__SSi].tabs[tab._tPos] = tabData;

    // Prepare the tab so that it can be properly restored. We'll pin/unpin
    // and show/hide tabs as necessary. We'll also attach a copy of the tab's
    // data in case we close it before it's been restored.
    if (tabData.pinned) {
__L_V__5({
    lN: 4593,tT:'if',pr:'tabData.pinned',eT:{},fN:''
  });'__L_V__5';
      tabbrowser.pinTab(tab);
    } else {
      tabbrowser.unpinTab(tab);
    }

    if (tabData.hidden) {
__L_V__5({
    lN: 4599,tT:'if',pr:'tabData.hidden',eT:{},fN:''
  });'__L_V__5';
      tabbrowser.hideTab(tab);
    } else {
      tabbrowser.showTab(tab);
    }

    if (!!tabData.muted != browser.audioMuted) {
__L_V__5({
    lN: 4605,tT:'if',pr:'!!tabData.muted != browser.audioMuted',eT:{},fN:''
  });'__L_V__5';
      tab.toggleMuteAudio(tabData.muteReason);
    }

    if (tabData.lastAccessed) {
__L_V__5({
    lN: 4609,tT:'if',pr:'tabData.lastAccessed',eT:{},fN:''
  });'__L_V__5';
      tab.updateLastAccessed(tabData.lastAccessed);
    }

    if ("attributes" in tabData) {
__L_V__5({
    lN: 4613,tT:'if',pr:'attributes in tabData',eT:{},fN:''
  });'__L_V__5';
      // Ensure that we persist tab attributes restored from previous sessions.
      Object.keys(tabData.attributes).forEach(a => TabAttributes.persist(a));
    }

    if (!tabData.entries) {
__L_V__5({
    lN: 4618,tT:'if',pr:'!tabData.entries',eT:{},fN:''
  });'__L_V__5';
      tabData.entries = [];
    }
    if (tabData.extData) {
__L_V__5({
    lN: 4621,tT:'if',pr:'tabData.extData',eT:{},fN:''
  });'__L_V__5';
      TAB_CUSTOM_VALUES.set(tab, Cu.cloneInto(tabData.extData, {}));
    } else {
      TAB_CUSTOM_VALUES.delete(tab);
    }

    // Tab is now open.
    delete tabData.closedAt;

    // Ensure the index is in bounds.
    let activeIndex = (tabData.index || tabData.entries.length) - 1;
    activeIndex = Math.min(activeIndex, tabData.entries.length - 1);
    activeIndex = Math.max(activeIndex, 0);

    // Save the index in case we updated it above.
    tabData.index = activeIndex + 1;

    tab.setAttribute("pending", "true");

    // If we're restoring this tab, it certainly shouldn't be in
    // the ignored set anymore.
    this._crashedBrowsers.delete(browser.permanentKey);

    // Update the persistent tab state cache with |tabData| information.
    TabStateCache.update(browser, {
      // NOTE: Copy the entries array shallowly, so as to not screw with the
      // original tabData's history when getting history updates.
      history: { entries: [...tabData.entries], index: tabData.index },
      scroll: tabData.scroll || null,
      storage: tabData.storage || null,
      formdata: tabData.formdata || null,
      disallow: tabData.disallow || null,
      userContextId: tabData.userContextId || 0,

      // This information is only needed until the tab has finished restoring.
      // When that's done it will be removed from the cache and we always
      // collect it in TabState._collectBaseTabData().
      image: tabData.image || "",
      iconLoadingPrincipal: tabData.iconLoadingPrincipal || null,
      userTypedValue: tabData.userTypedValue || "",
      userTypedClear: tabData.userTypedClear || 0,
    });

    // Restore tab attributes.
    if ("attributes" in tabData) {
__L_V__5({
    lN: 4665,tT:'if',pr:'attributes in tabData',eT:{},fN:''
  });'__L_V__5';
      TabAttributes.set(tab, tabData.attributes);
    }

    if (isBrowserInserted) {
__L_V__5({
    lN: 4669,tT:'if',pr:'isBrowserInserted',eT:{},fN:''
  });'__L_V__5';
      // Start a new epoch to discard all frame script messages relating to a
      // previous epoch. All async messages that are still on their way to chrome
      // will be ignored and don't override any tab data set when restoring.
      let epoch = this.startNextEpoch(browser);

      // Ensure that the tab will get properly restored in the event the tab
      // crashes while restoring.  But don't set this on lazy browsers as
      // restoreTab will get called again when the browser is instantiated.
      TAB_STATE_FOR_BROWSER.set(browser, TAB_STATE_NEEDS_RESTORE);

      this._sendRestoreHistory(browser, { tabData, epoch, loadArguments });

      // This could cause us to ignore MAX_CONCURRENT_TAB_RESTORES a bit, but
      // it ensures each window will have its selected tab loaded.
      if (willRestoreImmediately) {
__L_V__5({
    lN: 4684,tT:'if',pr:'willRestoreImmediately',eT:{},fN:''
  });'__L_V__5';
        this.restoreTabContent(tab, options);
      } else if (!forceOnDemand) {
__L_V__5({
    lN: 4686,tT:'if',pr:'!forceOnDemand',eT:{},fN:''
  });'__L_V__5';
        TabRestoreQueue.add(tab);
        // Check if a tab is in queue and will be restored
        // after the currently loading tabs. If so, prepare
        // a connection to host to speed up page loading.
        if (TabRestoreQueue.willRestoreSoon(tab)) {
__L_V__5({
    lN: 4691,tT:'if',pr:'TabRestoreQueue.willRestoreSoon(tab)',eT:{},fN:''
  });'__L_V__5';
          if (activeIndex in tabData.entries) {
__L_V__5({
    lN: 4692,tT:'if',pr:'activeIndex in tabData.entries',eT:{},fN:''
  });'__L_V__5';
            let url = tabData.entries[activeIndex].url;
            let prepared = this.prepareConnectionToHost(tab, url);
            if (gDebuggingEnabled) {
__L_V__5({
    lN: 4695,tT:'if',pr:'gDebuggingEnabled',eT:{},fN:''
  });'__L_V__5';
              tab.__test_connection_prepared = prepared;
              tab.__test_connection_url = url;
            }
          }
        }
        this.restoreNextTab();
      }
    } else {
      // TAB_LAZY_STATES holds data for lazy-browser tabs to proxy for
      // data unobtainable from the unbound browser.  This only applies to lazy
      // browsers and will be removed once the browser is inserted in the document.
      // This must preceed `updateTabLabelAndIcon` call for required data to be present.
      let url = "about:blank";
      let title = "";

      if (activeIndex in tabData.entries) {
__L_V__5({
    lN: 4711,tT:'if',pr:'activeIndex in tabData.entries',eT:{},fN:''
  });'__L_V__5';
        url = tabData.entries[activeIndex].url;
        title = tabData.entries[activeIndex].title || url;
      }
      TAB_LAZY_STATES.set(tab, {
        url,
        title,
        userTypedValue: tabData.userTypedValue || "",
        userTypedClear: tabData.userTypedClear || 0,
      });
    }

    if (tab.hasAttribute("customizemode")) {
__L_V__5({
    lN: 4723,tT:'if',pr:'tab.hasAttribute(customizemode)',eT:{},fN:''
  });'__L_V__5';
      window.gCustomizeMode.setTab(tab);
    }

    // Update tab label and icon to show something
    // while we wait for the messages to be processed.
    this.updateTabLabelAndIcon(tab, tabData);

    // Decrease the busy state counter after we're done.
    this._setWindowStateReady(window);
  },

  /**
   * Kicks off restoring the given tab.
   *
   * @param aTab
   *        the tab to restore
   * @param aOptions
   *        optional arguments used when performing process switch during load
   */
  restoreTabContent(aTab, aOptions = {}) {
__L_V__5({
    lN: 4743,tT:'func',pr:'',eT:{'aTab':aTab,'aOptions':aOptions},fN:'restoreTabContent'
  });'__L_V__5';
    let loadArguments = aOptions.loadArguments;
    if (aTab.hasAttribute("customizemode") && !loadArguments) {
__L_V__5({
    lN: 4745,tT:'if',pr:'aTab.hasAttribute(customizemode) && !loadArguments',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    let browser = aTab.linkedBrowser;
    let window = aTab.ownerGlobal;
    let tabbrowser = window.gBrowser;
    let tabData = TabState.clone(aTab, TAB_CUSTOM_VALUES.get(aTab));
    let activeIndex = tabData.index - 1;
    let activePageData = tabData.entries[activeIndex] || null;
    let uri = activePageData ? activePageData.url || null : null;
    if (loadArguments) {
__L_V__5({
    lN: 4756,tT:'if',pr:'loadArguments',eT:{},fN:''
  });'__L_V__5';
      uri = loadArguments.uri;
      if (loadArguments.userContextId) {
__L_V__5({
    lN: 4758,tT:'if',pr:'loadArguments.userContextId',eT:{},fN:''
  });'__L_V__5';
        browser.setAttribute("usercontextid", loadArguments.userContextId);
      }
    }

    this.markTabAsRestoring(aTab);

    let newFrameloader = aOptions.newFrameloader;
    let replaceBrowsingContext = aOptions.replaceBrowsingContext;
    let redirectLoadSwitchId = aOptions.redirectLoadSwitchId;
    let isRemotenessUpdate;
    if (aOptions.remoteType !== undefined) {
__L_V__5({
    lN: 4769,tT:'if',pr:'aOptions.remoteType !== undefined',eT:{},fN:''
  });'__L_V__5';
      // We already have a selected remote type so we update to that.
      isRemotenessUpdate = tabbrowser.updateBrowserRemoteness(browser, {
        remoteType: aOptions.remoteType,
        newFrameloader,
        replaceBrowsingContext,
        redirectLoadSwitchId,
      });
    } else {
      isRemotenessUpdate = tabbrowser.updateBrowserRemotenessByURL(
        browser,
        uri,
        {
          newFrameloader,
          replaceBrowsingContext,
          redirectLoadSwitchId,
        }
      );
    }

    if (isRemotenessUpdate) {
__L_V__5({
    lN: 4789,tT:'if',pr:'isRemotenessUpdate',eT:{},fN:''
  });'__L_V__5';
      // We updated the remoteness, so we need to send the history down again.
      //
      // Start a new epoch to discard all frame script messages relating to a
      // previous epoch. All async messages that are still on their way to chrome
      // will be ignored and don't override any tab data set when restoring.
      let epoch = this.startNextEpoch(browser);

      this._sendRestoreHistory(browser, {
        tabData,
        epoch,
        loadArguments,
        isRemotenessUpdate,
      });
    }

    browser.messageManager.sendAsyncMessage("SessionStore:restoreTabContent", {
      loadArguments,
      isRemotenessUpdate,
      reason:
        aOptions.restoreContentReason || RESTORE_TAB_CONTENT_REASON.SET_STATE,
    });

    // Focus the tab's content area.
    if (aTab.selected && !window.isBlankPageURL(uri) && !String(uri).startsWith("moz-extension")) {
__L_V__5({
    lN: 4813,tT:'if',pr:'aTab.selected && !window.isBlankPageURL(uri) && !String(uri).startsWith(moz-extension)',eT:{},fN:''
  });'__L_V__5';
      browser.focus();
    }
  },

  /**
   * Marks a given pending tab as restoring.
   *
   * @param aTab
   *        the pending tab to mark as restoring
   */
  markTabAsRestoring(aTab) {
__L_V__5({
    lN: 4824,tT:'func',pr:'',eT:{'aTab':aTab},fN:'markTabAsRestoring'
  });'__L_V__5';
    let browser = aTab.linkedBrowser;
    if (TAB_STATE_FOR_BROWSER.get(browser) != TAB_STATE_NEEDS_RESTORE) {
__L_V__5({
    lN: 4826,tT:'if',pr:'TAB_STATE_FOR_BROWSER.get(browser) != TAB_STATE_NEEDS_RESTORE',eT:{},fN:''
  });'__L_V__5';
      throw new Error("Given tab is not pending.");
    }

    // Make sure that this tab is removed from the priority queue.
    TabRestoreQueue.remove(aTab);

    // Increase our internal count.
    this._tabsRestoringCount++;

    // Set this tab's state to restoring
    TAB_STATE_FOR_BROWSER.set(browser, TAB_STATE_RESTORING);
    aTab.removeAttribute("pending");
  },

  /**
   * This _attempts_ to restore the next available tab. If the restore fails,
   * then we will attempt the next one.
   * There are conditions where this won't do anything:
   *   if we're in the process of quitting
   *   if there are no tabs to restore
   *   if we have already reached the limit for number of tabs to restore
   */
  restoreNextTab: function ssi_restoreNextTab() {
__L_V__5({
    lN: 4849,tT:'func',pr:'',eT:{},fN:'ssi_restoreNextTab'
  });'__L_V__5';
    // If we call in here while quitting, we don't actually want to do anything
    if (RunState.isQuitting) {
__L_V__5({
    lN: 4851,tT:'if',pr:'RunState.isQuitting',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // Don't exceed the maximum number of concurrent tab restores.
    if (this._tabsRestoringCount >= MAX_CONCURRENT_TAB_RESTORES) {
__L_V__5({
    lN: 4856,tT:'if',pr:'this._tabsRestoringCount >= MAX_CONCURRENT_TAB_RESTORES',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    let tab = TabRestoreQueue.shift();
    if (tab) {
__L_V__5({
    lN: 4861,tT:'if',pr:'tab',eT:{},fN:''
  });'__L_V__5';
      this.restoreTabContent(tab);
    }
  },

  /**
   * Restore visibility and dimension features to a window
   * @param aWindow
   *        Window reference
   * @param aWinData
   *        Object containing session data for the window
   */
  restoreWindowFeatures: function ssi_restoreWindowFeatures(aWindow, aWinData) {
__L_V__5({
    lN: 4873,tT:'func',pr:'',eT:{'aWindow':aWindow,'aWinData':aWinData},fN:'ssi_restoreWindowFeatures'
  });'__L_V__5';
    var hidden = aWinData.hidden ? aWinData.hidden.split(",") : [];
    WINDOW_HIDEABLE_FEATURES.forEach(function(aItem) {
      aWindow[aItem].visible = !hidden.includes(aItem);
    });

    if (aWinData.isPopup) {
__L_V__5({
    lN: 4879,tT:'if',pr:'aWinData.isPopup',eT:{},fN:''
  });'__L_V__5';
      this._windows[aWindow.__SSi].isPopup = true;
      if (aWindow.gURLBar) {
__L_V__5({
    lN: 4881,tT:'if',pr:'aWindow.gURLBar',eT:{},fN:''
  });'__L_V__5';
        aWindow.gURLBar.readOnly = true;
      }
    } else {
      delete this._windows[aWindow.__SSi].isPopup;
      if (aWindow.gURLBar) {
__L_V__5({
    lN: 4886,tT:'if',pr:'aWindow.gURLBar',eT:{},fN:''
  });'__L_V__5';
        aWindow.gURLBar.readOnly = false;
      }
    }

    aWindow.setTimeout(() => {
      this.restoreDimensions(
        aWindow,
        +(aWinData.width || 0),
        +(aWinData.height || 0),
        "screenX" in aWinData ? +aWinData.screenX : NaN,
        "screenY" in aWinData ? +aWinData.screenY : NaN,
        aWinData.sizemode || "",
        aWinData.sizemodeBeforeMinimized || "",
        aWinData.sidebar || ""
      );
    }, 0);
  },

  /**
   * Restore a window's dimensions
   * @param aWidth
   *        Window width
   * @param aHeight
   *        Window height
   * @param aLeft
   *        Window left
   * @param aTop
   *        Window top
   * @param aSizeMode
   *        Window size mode (eg: maximized)
   * @param aSizeModeBeforeMinimized
   *        Window size mode before window got minimized (eg: maximized)
   * @param aSidebar
   *        Sidebar command
   */
  restoreDimensions: function ssi_restoreDimensions(
    aWindow,
    aWidth,
    aHeight,
    aLeft,
    aTop,
    aSizeMode,
    aSizeModeBeforeMinimized,
    aSidebar
  ) {
__L_V__5({
    lN: 4931,tT:'func',pr:'',eT:{'aWindow':aWindow,'aWidth':aWidth,'aHeight':aHeight,'aLeft':aLeft,'aTop':aTop,'aSizeMode':aSizeMode,'aSizeModeBeforeMinimized':aSizeModeBeforeMinimized,'aSidebar':aSidebar},fN:'ssi_restoreDimensions'
  });'__L_V__5';
    var win = aWindow;
    var _this = this;
    function win_(aName) {
__L_V__5({
    lN: 4934,tT:'func',pr:'',eT:{'aName':aName},fN:'win_'
  });'__L_V__5';
      return _this._getWindowDimension(win, aName);
    }

    const dwu = win.windowUtils;
    // find available space on the screen where this window is being placed
    let screen = gScreenManager.screenForRect(aLeft, aTop, aWidth, aHeight);
    if (screen) {
__L_V__5({
    lN: 4941,tT:'if',pr:'screen',eT:{},fN:''
  });'__L_V__5';
      let screenLeft = {},
        screenTop = {},
        screenWidth = {},
        screenHeight = {};
      screen.GetAvailRectDisplayPix(
        screenLeft,
        screenTop,
        screenWidth,
        screenHeight
      );
      // screenX/Y are based on the origin of the screen's desktop-pixel coordinate space
      let screenLeftCss = screenLeft.value;
      let screenTopCss = screenTop.value;
      // convert screen's device pixel dimensions to CSS px dimensions
      screen.GetAvailRect(screenLeft, screenTop, screenWidth, screenHeight);
      let cssToDevScale = screen.defaultCSSScaleFactor;
      let screenRightCss = screenLeftCss + screenWidth.value / cssToDevScale;
      let screenBottomCss = screenTopCss + screenHeight.value / cssToDevScale;

      // Pull the window within the screen's bounds (allowing a little slop
      // for windows that may be deliberately placed with their border off-screen
      // as when Win10 "snaps" a window to the left/right edge -- bug 1276516).
      // First, ensure the left edge is large enough...
      if (aLeft < screenLeftCss - SCREEN_EDGE_SLOP) {
__L_V__5({
    lN: 4965,tT:'if',pr:'aLeft < screenLeftCss - SCREEN_EDGE_SLOP',eT:{},fN:''
  });'__L_V__5';
        aLeft = screenLeftCss;
      }
      // Then check the resulting right edge, and reduce it if necessary.
      let right = aLeft + aWidth;
      if (right > screenRightCss + SCREEN_EDGE_SLOP) {
__L_V__5({
    lN: 4970,tT:'if',pr:'right > screenRightCss + SCREEN_EDGE_SLOP',eT:{},fN:''
  });'__L_V__5';
        right = screenRightCss;
        // See if we can move the left edge leftwards to maintain width.
        if (aLeft > screenLeftCss) {
__L_V__5({
    lN: 4973,tT:'if',pr:'aLeft > screenLeftCss',eT:{},fN:''
  });'__L_V__5';
          aLeft = Math.max(right - aWidth, screenLeftCss);
        }
      }
      // Finally, update aWidth to account for the adjusted left and right edges.
      aWidth = right - aLeft;

      // And do the same in the vertical dimension.
      if (aTop < screenTopCss - SCREEN_EDGE_SLOP) {
__L_V__5({
    lN: 4981,tT:'if',pr:'aTop < screenTopCss - SCREEN_EDGE_SLOP',eT:{},fN:''
  });'__L_V__5';
        aTop = screenTopCss;
      }
      let bottom = aTop + aHeight;
      if (bottom > screenBottomCss + SCREEN_EDGE_SLOP) {
__L_V__5({
    lN: 4985,tT:'if',pr:'bottom > screenBottomCss + SCREEN_EDGE_SLOP',eT:{},fN:''
  });'__L_V__5';
        bottom = screenBottomCss;
        if (aTop > screenTopCss) {
__L_V__5({
    lN: 4987,tT:'if',pr:'aTop > screenTopCss',eT:{},fN:''
  });'__L_V__5';
          aTop = Math.max(bottom - aHeight, screenTopCss);
        }
      }
      aHeight = bottom - aTop;
    }

    // Suppress animations.
    dwu.suppressAnimation(true);

    // We want to make sure users will get their animations back in case an exception is thrown.
    try {
      // only modify those aspects which aren't correct yet
      if (
        !isNaN(aLeft) &&
        !isNaN(aTop) &&
        (aLeft != win_("screenX") || aTop != win_("screenY"))
      ) {
__L_V__5({
    lN: 5004,tT:'if',pr:' !isNaN(aLeft) && !isNaN(aTop) && (aLeft != win_(screenX) || aTop != win_(screenY)) ',eT:{},fN:''
  });'__L_V__5';
        aWindow.moveTo(aLeft, aTop);
      }
      if (
        aWidth &&
        aHeight &&
        (aWidth != win_("width") || aHeight != win_("height")) &&
        !gResistFingerprintingEnabled
      ) {
__L_V__5({
    lN: 5012,tT:'if',pr:' aWidth && aHeight && (aWidth != win_(width) || aHeight != win_(height)) && !gResistFingerprintingEnabled ',eT:{},fN:''
  });'__L_V__5';
        // Don't resize the window if it's currently maximized and we would
        // maximize it again shortly after.
        if (aSizeMode != "maximized" || win_("sizemode") != "maximized") {
__L_V__5({
    lN: 5015,tT:'if',pr:'aSizeMode != maximized || win_(sizemode) != maximized',eT:{},fN:''
  });'__L_V__5';
          aWindow.resizeTo(aWidth, aHeight);
        }
      }
      this._windows[
        aWindow.__SSi
      ].sizemodeBeforeMinimized = aSizeModeBeforeMinimized;
      if (
        aSizeMode &&
        win_("sizemode") != aSizeMode &&
        !gResistFingerprintingEnabled
      ) {
__L_V__5({
    lN: 5026,tT:'if',pr:' aSizeMode && win_(sizemode) != aSizeMode && !gResistFingerprintingEnabled ',eT:{},fN:''
  });'__L_V__5';
__L_V__5({
    lN: 5027,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';
        switch (aSizeMode) {
          case "maximized":
            aWindow.maximize();
            break;
          case "minimized":
            if (aSizeModeBeforeMinimized == "maximized") {
__L_V__5({
    lN: 5032,tT:'if',pr:'aSizeModeBeforeMinimized == maximized',eT:{},fN:''
  });'__L_V__5';
              aWindow.maximize();
            }
            aWindow.minimize();
            break;
          case "normal":
            aWindow.restore();
            break;
        }
      }
      let sidebarBox = aWindow.document.getElementById("sidebar-box");
      if (
        aSidebar &&
        (sidebarBox.getAttribute("sidebarcommand") != aSidebar ||
          !sidebarBox.getAttribute("checked"))
      ) {
__L_V__5({
    lN: 5047,tT:'if',pr:' aSidebar && (sidebarBox.getAttribute(sidebarcommand) != aSidebar || !sidebarBox.getAttribute(checked)) ',eT:{},fN:''
  });'__L_V__5';
        aWindow.SidebarUI.showInitially(aSidebar);
      }
      // since resizing/moving a window brings it to the foreground,
      // we might want to re-focus the last focused window
      if (this.windowToFocus) {
__L_V__5({
    lN: 5052,tT:'if',pr:'this.windowToFocus',eT:{},fN:''
  });'__L_V__5';
        this.windowToFocus.focus();
      }
    } finally {
      // Enable animations.
      dwu.suppressAnimation(false);
    }
  },

  /* ........ Disk Access .............. */

  /**
   * Save the current session state to disk, after a delay.
   *
   * @param aWindow (optional)
   *        Will mark the given window as dirty so that we will recollect its
   *        data before we start writing.
   */
  saveStateDelayed(aWindow = null) {
__L_V__5({
    lN: 5070,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'saveStateDelayed'
  });'__L_V__5';
    if (aWindow) {
__L_V__5({
    lN: 5071,tT:'if',pr:'aWindow',eT:{},fN:''
  });'__L_V__5';
      DirtyWindows.add(aWindow);
    }

    SessionSaver.runDelayed();
  },

  /* ........ Auxiliary Functions .............. */

  /**
   * Remove a closed window from the list of closed windows and indicate that
   * the change should be notified.
   *
   * @param index
   *        The index of the window in this._closedWindows.
   *
   * @returns Array of closed windows.
   */
  _removeClosedWindow(index) {
__L_V__5({
    lN: 5089,tT:'func',pr:'',eT:{'index':index},fN:'_removeClosedWindow'
  });'__L_V__5';
    let windows = this._closedWindows.splice(index, 1);
    this._closedObjectsChanged = true;
    return windows;
  },

  /**
   * Notifies observers that the list of closed tabs and/or windows has changed.
   * Waits a tick to allow SessionStorage a chance to register the change.
   */
  _notifyOfClosedObjectsChange() {
__L_V__5({
    lN: 5099,tT:'func',pr:'',eT:{},fN:'_notifyOfClosedObjectsChange'
  });'__L_V__5';
    if (!this._closedObjectsChanged) {
__L_V__5({
    lN: 5100,tT:'if',pr:'!this._closedObjectsChanged',eT:{},fN:''
  });'__L_V__5';
      return;
    }
    this._closedObjectsChanged = false;
    setTimeout(() => {
      Services.obs.notifyObservers(null, NOTIFY_CLOSED_OBJECTS_CHANGED);
    }, 0);
  },

  /**
   * Update the session start time and send a telemetry measurement
   * for the number of days elapsed since the session was started.
   *
   * @param state
   *        The session state.
   */
  _updateSessionStartTime: function ssi_updateSessionStartTime(state) {
__L_V__5({
    lN: 5116,tT:'func',pr:'',eT:{'state':state},fN:'ssi_updateSessionStartTime'
  });'__L_V__5';
    // Attempt to load the session start time from the session state
    if (state.session && state.session.startTime) {
__L_V__5({
    lN: 5118,tT:'if',pr:'state.session && state.session.startTime',eT:{},fN:''
  });'__L_V__5';
      this._sessionStartTime = state.session.startTime;
    }
  },

  /**
   * Iterator that yields all currently opened browser windows.
   * (Might miss the most recent one.)
   * This list is in focus order, but may include minimized windows
   * before non-minimized windows.
   */
  _browserWindows: {
    *[Symbol.iterator]() {
      for (let window of BrowserWindowTracker.orderedWindows) {
        if (window.__SSi && !window.closed) {
__L_V__5({
    lN: 5132,tT:'if',pr:'window.__SSi && !window.closed',eT:{},fN:''
  });'__L_V__5';
          yield window;
        }
      }
    },
  },

  /**
   * Iterator that yields all currently opened browser windows,
   * with minimized windows last.
   * (Might miss the most recent window.)
   */
  _orderedBrowserWindows: {
    *[Symbol.iterator]() {
      let windows = BrowserWindowTracker.orderedWindows;
      windows.sort((a, b) => {
        if (
          a.windowState == a.STATE_MINIMIZED &&
          b.windowState != b.STATE_MINIMIZED
        ) {
__L_V__5({
    lN: 5151,tT:'if',pr:' a.windowState == a.STATE_MINIMIZED && b.windowState != b.STATE_MINIMIZED ',eT:{},fN:''
  });'__L_V__5';
          return 1;
        }
        if (
          a.windowState != a.STATE_MINIMIZED &&
          b.windowState == b.STATE_MINIMIZED
        ) {
__L_V__5({
    lN: 5157,tT:'if',pr:' a.windowState != a.STATE_MINIMIZED && b.windowState == b.STATE_MINIMIZED ',eT:{},fN:''
  });'__L_V__5';
          return -1;
        }
        return 0;
      });
      for (let window of windows) {
        if (window.__SSi && !window.closed) {
__L_V__5({
    lN: 5163,tT:'if',pr:'window.__SSi && !window.closed',eT:{},fN:''
  });'__L_V__5';
          yield window;
        }
      }
    },
  },

  /**
   * Returns most recent window
   * @returns Window reference
   */
  _getTopWindow: function ssi_getTopWindow() {
__L_V__5({
    lN: 5174,tT:'func',pr:'',eT:{},fN:'ssi_getTopWindow'
  });'__L_V__5';
    return BrowserWindowTracker.getTopWindow({ allowPopups: true });
  },

  /**
   * Calls onClose for windows that are determined to be closed but aren't
   * destroyed yet, which would otherwise cause getBrowserState and
   * setBrowserState to treat them as open windows.
   */
  _handleClosedWindows: function ssi_handleClosedWindows() {
__L_V__5({
    lN: 5183,tT:'func',pr:'',eT:{},fN:'ssi_handleClosedWindows'
  });'__L_V__5';
    let promises = [];
    for (let window of Services.wm.getEnumerator("navigator:browser")) {
      if (window.closed) {
__L_V__5({
    lN: 5186,tT:'if',pr:'window.closed',eT:{},fN:''
  });'__L_V__5';
        promises.push(this.onClose(window));
      }
    }
    return Promise.all(promises);
  },

  /**
   * Store a restore state of a window to this._statesToRestore. The window
   * will be given an id that can be used to get the restore state from
   * this._statesToRestore.
   *
   * @param window
   *        a reference to a window that has a state to restore
   * @param state
   *        an object containing session data
   */
  _updateWindowRestoreState(window, state) {
__L_V__5({
    lN: 5203,tT:'func',pr:'',eT:{'window':window,'state':state},fN:'_updateWindowRestoreState'
  });'__L_V__5';
    // Store z-index, so that windows can be restored in reversed z-order.
    if ("zIndex" in state.windows[0]) {
__L_V__5({
    lN: 5205,tT:'if',pr:'zIndex in state.windows[0]',eT:{},fN:''
  });'__L_V__5';
      WINDOW_RESTORE_ZINDICES.set(window, state.windows[0].zIndex);
    }
    do {
      var ID = "window" + Math.random();
    } while (ID in this._statesToRestore);
    WINDOW_RESTORE_IDS.set(window, ID);
    // CLIQZ-SPECIAL:
    // DB-2057
    // At this step we need to figure out whether there are any moz-extension
    // urls which can not be restored for a reason that extension got refreshed itself,
    // meaning a new EXTENSION_ID was generated.
    //
    // After we find those urls we need to replace every extension-id within them for
    // new generated extension-id.
    // 1 Step. Let's collect all the tabs within all the windows.
    let tabList = [];
    for (let windowItem of state.windows) {
      tabList.push.apply(tabList, windowItem.tabs);
    }
    // 2 Step. Every tab could have formdata object. Let's collect those.
    let formDataList = [];
    for (let tabItem of tabList) {
      // Surprise: formdata object might not be there (just in case).
      if (tabItem.formdata == null) {
__L_V__5({
    lN: 5229,tT:'if',pr:'tabItem.formdata == null',eT:{},fN:''
  });'__L_V__5';
        continue;
      }

      formDataList.push(tabItem.formdata);
    }
    // 3 Step. Every formdata object has an "id"->"sessionData"->"windows"->"tabs".
    // Let's collect those tabs.
    // We can reuse tabList variable here since we do not need previously found tabs anymore;
    tabList = [];
    for (let formDataItem of formDataList) {
      if (formDataItem.id == null ||
          formDataItem.id.sessionData == null ||
          formDataItem.id.sessionData.windows == null) {
__L_V__5({
    lN: 5242,tT:'if',pr:'formDataItem.id == null || formDataItem.id.sessionData == null || formDataItem.id.sessionData.windows == null',eT:{},fN:''
  });'__L_V__5';
        continue;
      }

      for (let windowItem of formDataItem.id.sessionData.windows) {
        tabList.push.apply(tabList, windowItem.tabs);
      }
    }
    // 4 Step. Every newly found tab could have entries with urls we might need to replace.
    let entryList = [];
    for (let tabItem of tabList) {
      entryList.push.apply(entryList, tabItem.entries);
    }
    // 5 Step. Loop through the entries found at previous step and modify url property of each entry
    // that contains isCliqzPage = 1;
    for (let entryItem of entryList) {
      if (entryItem.isCliqzPage !== 1) {
__L_V__5({
    lN: 5258,tT:'if',pr:'entryItem.isCliqzPage !== 1',eT:{},fN:''
  });'__L_V__5';
        continue;
      }

      entryItem.url = CliqzResources.getUrlWithProperExtentionId(entryItem.url);
    }

    this._statesToRestore[ID] = state;
  },

  /**
   * open a new browser window for a given session state
   * called when restoring a multi-window session
   * @param aState
   *        Object containing session data
   */
  _openWindowWithState: function ssi_openWindowWithState(aState) {
__L_V__5({
    lN: 5274,tT:'func',pr:'',eT:{'aState':aState},fN:'ssi_openWindowWithState'
  });'__L_V__5';
    var argString = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString
    );
    argString.data = "";

    // Build feature string
    let features = "chrome,dialog=no,suppressanimation,all";
    let winState = aState.windows[0];
    WINDOW_ATTRIBUTES.forEach(function(aFeature) {
      // Use !isNaN as an easy way to ignore sizemode and check for numbers
      if (aFeature in winState && !isNaN(winState[aFeature])) {
__L_V__5({
    lN: 5285,tT:'if',pr:'aFeature in winState && !isNaN(winState[aFeature])',eT:{},fN:''
  });'__L_V__5';
        features += "," + aFeature + "=" + winState[aFeature];
      }
    });

    if (winState.isPrivate) {
__L_V__5({
    lN: 5290,tT:'if',pr:'winState.isPrivate',eT:{},fN:''
  });'__L_V__5';
      features += ",private";
    }

    var window = Services.ww.openWindow(
      null,
      AppConstants.BROWSER_CHROME_URL,
      "_blank",
      features,
      argString
    );

    this._updateWindowRestoreState(window, aState);
    WINDOW_SHOWING_PROMISES.set(window, PromiseUtils.defer());

    return window;
  },

  /**
   * whether the user wants to load any other page at startup
   * (except the homepage) - needed for determining whether to overwrite the current tabs
   * C.f.: nsBrowserContentHandler's defaultArgs implementation.
   * @returns bool
   */
  _isCmdLineEmpty: function ssi_isCmdLineEmpty(aWindow, aState) {
__L_V__5({
    lN: 5314,tT:'func',pr:'',eT:{'aWindow':aWindow,'aState':aState},fN:'ssi_isCmdLineEmpty'
  });'__L_V__5';
    var pinnedOnly =
      aState.windows &&
      aState.windows.every(win => win.tabs.every(tab => tab.pinned));

    let hasFirstArgument = aWindow.arguments && aWindow.arguments[0];
    if (!pinnedOnly) {
__L_V__5({
    lN: 5320,tT:'if',pr:'!pinnedOnly',eT:{},fN:''
  });'__L_V__5';
      let defaultArgs = Cc["@mozilla.org/browser/clh;1"].getService(
        Ci.nsIBrowserHandler
      ).defaultArgs;
      if (
        aWindow.arguments &&
        aWindow.arguments[0] &&
        aWindow.arguments[0] == defaultArgs
      ) {
__L_V__5({
    lN: 5328,tT:'if',pr:' aWindow.arguments && aWindow.arguments[0] && aWindow.arguments[0] == defaultArgs ',eT:{},fN:''
  });'__L_V__5';
        hasFirstArgument = false;
      }
    }

    return !hasFirstArgument;
  },

  /**
   * on popup windows, the AppWindow's attributes seem not to be set correctly
   * we use thus JSDOMWindow attributes for sizemode and normal window attributes
   * (and hope for reasonable values when maximized/minimized - since then
   * outerWidth/outerHeight aren't the dimensions of the restored window)
   * @param aWindow
   *        Window reference
   * @param aAttribute
   *        String sizemode | width | height | other window attribute
   * @returns string
   */
  _getWindowDimension: function ssi_getWindowDimension(aWindow, aAttribute) {
__L_V__5({
    lN: 5347,tT:'func',pr:'',eT:{'aWindow':aWindow,'aAttribute':aAttribute},fN:'ssi_getWindowDimension'
  });'__L_V__5';
    if (aAttribute == "sizemode") {
__L_V__5({
    lN: 5348,tT:'if',pr:'aAttribute == sizemode',eT:{},fN:''
  });'__L_V__5';
__L_V__5({
    lN: 5349,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';
      switch (aWindow.windowState) {
        case aWindow.STATE_FULLSCREEN:
        case aWindow.STATE_MAXIMIZED:
          return "maximized";
        case aWindow.STATE_MINIMIZED:
          return "minimized";
        default:
          return "normal";
      }
    }

    // We want to persist the size / position in normal state, so that
    // we can restore to them even if the window is currently maximized
    // or minimized. However, attributes on window object only reflect
    // the current state of the window, so when it isn't in the normal
    // sizemode, their values aren't what we want the window to restore
    // to. In that case, try to read from the attributes of the root
    // element first instead.
    if (aWindow.windowState != aWindow.STATE_NORMAL) {
__L_V__5({
    lN: 5367,tT:'if',pr:'aWindow.windowState != aWindow.STATE_NORMAL',eT:{},fN:''
  });'__L_V__5';
      let docElem = aWindow.document.documentElement;
      let attr = parseInt(docElem.getAttribute(aAttribute), 10);
      if (attr) {
__L_V__5({
    lN: 5370,tT:'if',pr:'attr',eT:{},fN:''
  });'__L_V__5';
        if (aAttribute != "width" && aAttribute != "height") {
__L_V__5({
    lN: 5371,tT:'if',pr:'aAttribute != width && aAttribute != height',eT:{},fN:''
  });'__L_V__5';
          return attr;
        }
        // Width and height attribute report the inner size, but we want
        // to store the outer size, so add the difference.
        let appWin = aWindow.docShell.treeOwner
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIAppWindow);
        let diff =
          aAttribute == "width"
            ? appWin.outerToInnerWidthDifferenceInCSSPixels
            : appWin.outerToInnerHeightDifferenceInCSSPixels;
        return attr + diff;
      }
    }
__L_V__5({
    lN: 5386,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__5';

    switch (aAttribute) {
      case "width":
        return aWindow.outerWidth;
      case "height":
        return aWindow.outerHeight;
      default:
        return aAttribute in aWindow ? aWindow[aAttribute] : "";
    }
  },

  /**
   * @param aState is a session state
   * @param aRecentCrashes is the number of consecutive crashes
   * @returns whether a restore page will be needed for the session state
   */
  _needsRestorePage: function ssi_needsRestorePage(aState, aRecentCrashes) {
__L_V__5({
    lN: 5402,tT:'func',pr:'',eT:{'aState':aState,'aRecentCrashes':aRecentCrashes},fN:'ssi_needsRestorePage'
  });'__L_V__5';
    const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;

    // don't display the page when there's nothing to restore
    let winData = aState.windows || null;
    if (!winData || !winData.length) {
__L_V__5({
    lN: 5407,tT:'if',pr:'!winData || !winData.length',eT:{},fN:''
  });'__L_V__5';
      return false;
    }

    // don't wrap a single about:sessionrestore page
    if (
      this._hasSingleTabWithURL(winData, "about:sessionrestore") ||
      this._hasSingleTabWithURL(winData, "about:welcomeback")
    ) {
__L_V__5({
    lN: 5415,tT:'if',pr:' this._hasSingleTabWithURL(winData, about:sessionrestore) || this._hasSingleTabWithURL(winData, about:welcomeback) ',eT:{},fN:''
  });'__L_V__5';
      return false;
    }

    // don't automatically restore in Safe Mode
    if (Services.appinfo.inSafeMode) {
__L_V__5({
    lN: 5420,tT:'if',pr:'Services.appinfo.inSafeMode',eT:{},fN:''
  });'__L_V__5';
      return true;
    }

    let max_resumed_crashes = this._prefBranch.getIntPref(
      "sessionstore.max_resumed_crashes"
    );
    let sessionAge =
      aState.session &&
      aState.session.lastUpdate &&
      Date.now() - aState.session.lastUpdate;

    return (
      max_resumed_crashes != -1 &&
      (aRecentCrashes > max_resumed_crashes ||
        (sessionAge && sessionAge >= SIX_HOURS_IN_MS))
    );
  },

  /**
   * @param aWinData is the set of windows in session state
   * @param aURL is the single URL we're looking for
   * @returns whether the window data contains only the single URL passed
   */
  _hasSingleTabWithURL(aWinData, aURL) {
__L_V__5({
    lN: 5444,tT:'func',pr:'',eT:{'aWinData':aWinData,'aURL':aURL},fN:'_hasSingleTabWithURL'
  });'__L_V__5';
    if (
      aWinData &&
      aWinData.length == 1 &&
      aWinData[0].tabs &&
      aWinData[0].tabs.length == 1 &&
      aWinData[0].tabs[0].entries &&
      aWinData[0].tabs[0].entries.length == 1
    ) {
__L_V__5({
    lN: 5452,tT:'if',pr:' aWinData && aWinData.length == 1 && aWinData[0].tabs && aWinData[0].tabs.length == 1 && aWinData[0].tabs[0].entries && aWinData[0].tabs[0].entries.length == 1 ',eT:{},fN:''
  });'__L_V__5';
      return aURL == aWinData[0].tabs[0].entries[0].url;
    }
    return false;
  },

  /**
   * Determine if the tab state we're passed is something we should save. This
   * is used when closing a tab or closing a window with a single tab
   *
   * @param aTabState
   *        The current tab state
   * @returns boolean
   */
  _shouldSaveTabState: function ssi_shouldSaveTabState(aTabState) {
__L_V__5({
    lN: 5466,tT:'func',pr:'',eT:{'aTabState':aTabState},fN:'ssi_shouldSaveTabState'
  });'__L_V__5';
    // If the tab has only a transient about: history entry, no other
    // session history, and no userTypedValue, then we don't actually want to
    // store this tab's data.
    return (
      aTabState.entries.length &&
      !(
        aTabState.entries.length == 1 &&
        (aTabState.entries[0].url == "about:blank" ||
          aTabState.entries[0].url == "about:newtab" ||
          aTabState.entries[0].url == "about:printpreview" ||
          aTabState.entries[0].url == "about:privatebrowsing") &&
        !aTabState.userTypedValue
      )
    );
  },

  /**
   * Determine if the tab state we're passed is something we should keep to be
   * reopened at session restore. This is used when we are saving the current
   * session state to disk. This method is very similar to _shouldSaveTabState,
   * however, "about:blank" and "about:newtab" tabs will still be saved to disk.
   *
   * @param aTabState
   *        The current tab state
   * @returns boolean
   */
  _shouldSaveTab: function ssi_shouldSaveTab(aTabState) {
__L_V__5({
    lN: 5493,tT:'func',pr:'',eT:{'aTabState':aTabState},fN:'ssi_shouldSaveTab'
  });'__L_V__5';
    // If the tab has one of the following transient about: history entry, no
    // userTypedValue, and no customizemode attribute, then we don't actually
    // want to write this tab's data to disk.
    return (
      aTabState.userTypedValue ||
      (aTabState.attributes && aTabState.attributes.customizemode == "true") ||
      (aTabState.entries.length &&
        !(
          aTabState.entries[0].url == "about:printpreview" ||
          aTabState.entries[0].url == "about:privatebrowsing"
        ))
    );
  },

  /**
   * This is going to take a state as provided at startup (via
   * SessionStartup.state) and split it into 2 parts. The first part
   * (defaultState) will be a state that should still be restored at startup,
   * while the second part (state) is a state that should be saved for later.
   * defaultState will be comprised of windows with only pinned tabs, extracted
   * from state. It will also contain window position information.
   *
   * defaultState will be restored at startup. state will be passed into
   * LastSession and will be kept in case the user explicitly wants
   * to restore the previous session (publicly exposed as restoreLastSession).
   *
   * @param state
   *        The state, presumably from SessionStartup.state
   * @returns [defaultState, state]
   */
  _prepDataForDeferredRestore: function ssi_prepDataForDeferredRestore(state) {
__L_V__5({
    lN: 5524,tT:'func',pr:'',eT:{'state':state},fN:'ssi_prepDataForDeferredRestore'
  });'__L_V__5';
    // Make sure that we don't modify the global state as provided by
    // SessionStartup.state.
    state = Cu.cloneInto(state, {});

    let defaultState = { windows: [], selectedWindow: 1 };

    state.selectedWindow = state.selectedWindow || 1;

    // Look at each window, remove pinned tabs, adjust selectedindex,
    // remove window if necessary.
    for (let wIndex = 0; wIndex < state.windows.length; ) {
      let window = state.windows[wIndex];
      window.selected = window.selected || 1;
      // We're going to put the state of the window into this object
      let pinnedWindowState = { tabs: [] };
      for (let tIndex = 0; tIndex < window.tabs.length; ) {
        if (window.tabs[tIndex].pinned) {
__L_V__5({
    lN: 5541,tT:'if',pr:'window.tabs[tIndex].pinned',eT:{},fN:''
  });'__L_V__5';
          // Adjust window.selected
          if (tIndex + 1 < window.selected) {
__L_V__5({
    lN: 5543,tT:'if',pr:'tIndex + 1 < window.selected',eT:{},fN:''
  });'__L_V__5';
            window.selected -= 1;
          } else if (tIndex + 1 == window.selected) {
__L_V__5({
    lN: 5545,tT:'if',pr:'tIndex + 1 == window.selected',eT:{},fN:''
  });'__L_V__5';
            pinnedWindowState.selected = pinnedWindowState.tabs.length + 1;
          }
          // + 1 because the tab isn't actually in the array yet

          // Now add the pinned tab to our window
          pinnedWindowState.tabs = pinnedWindowState.tabs.concat(
            window.tabs.splice(tIndex, 1)
          );
          // We don't want to increment tIndex here.
          continue;
        }
        tIndex++;
      }

      // At this point the window in the state object has been modified (or not)
      // We want to build the rest of this new window object if we have pinnedTabs.
      if (pinnedWindowState.tabs.length) {
__L_V__5({
    lN: 5562,tT:'if',pr:'pinnedWindowState.tabs.length',eT:{},fN:''
  });'__L_V__5';
        // First get the other attributes off the window
        WINDOW_ATTRIBUTES.forEach(function(attr) {
          if (attr in window) {
__L_V__5({
    lN: 5565,tT:'if',pr:'attr in window',eT:{},fN:''
  });'__L_V__5';
            pinnedWindowState[attr] = window[attr];
            delete window[attr];
          }
        });
        // We're just copying position data into the pinned window.
        // Not copying over:
        // - _closedTabs
        // - extData
        // - isPopup
        // - hidden

        // Assign a unique ID to correlate the window to be opened with the
        // remaining data
        window.__lastSessionWindowID = pinnedWindowState.__lastSessionWindowID =
          "" + Date.now() + Math.random();

        // Actually add this window to our defaultState
        defaultState.windows.push(pinnedWindowState);
        // Remove the window from the state if it doesn't have any tabs
        if (!window.tabs.length) {
__L_V__5({
    lN: 5585,tT:'if',pr:'!window.tabs.length',eT:{},fN:''
  });'__L_V__5';
          if (wIndex + 1 <= state.selectedWindow) {
__L_V__5({
    lN: 5586,tT:'if',pr:'wIndex + 1 <= state.selectedWindow',eT:{},fN:''
  });'__L_V__5';
            state.selectedWindow -= 1;
          } else if (wIndex + 1 == state.selectedWindow) {
__L_V__5({
    lN: 5588,tT:'if',pr:'wIndex + 1 == state.selectedWindow',eT:{},fN:''
  });'__L_V__5';
            defaultState.selectedIndex = defaultState.windows.length + 1;
          }

          state.windows.splice(wIndex, 1);
          // We don't want to increment wIndex here.
          continue;
        }
      }
      wIndex++;
    }

    return [defaultState, state];
  },

  _sendRestoreCompletedNotifications: function ssi_sendRestoreCompletedNotifications() {
__L_V__5({
    lN: 5603,tT:'func',pr:'',eT:{},fN:'ssi_sendRestoreCompletedNotifications'
  });'__L_V__5';
    // not all windows restored, yet
    if (this._restoreCount > 1) {
__L_V__5({
    lN: 5605,tT:'if',pr:'this._restoreCount > 1',eT:{},fN:''
  });'__L_V__5';
      this._restoreCount--;
      return;
    }

    // observers were already notified
    if (this._restoreCount == -1) {
__L_V__5({
    lN: 5611,tT:'if',pr:'this._restoreCount == -1',eT:{},fN:''
  });'__L_V__5';
      return;
    }

    // This was the last window restored at startup, notify observers.
    if (!this._browserSetState) {
__L_V__5({
    lN: 5616,tT:'if',pr:'!this._browserSetState',eT:{},fN:''
  });'__L_V__5';
      Services.obs.notifyObservers(null, NOTIFY_WINDOWS_RESTORED);
      this._deferredAllWindowsRestored.resolve();
    } else {
      // _browserSetState is used only by tests, and it uses an alternate
      // notification in order not to retrigger startup observers that
      // are listening for NOTIFY_WINDOWS_RESTORED.
      Services.obs.notifyObservers(null, NOTIFY_BROWSER_STATE_RESTORED);
    }

    this._browserSetState = false;
    this._restoreCount = -1;
  },

  /**
   * Set the given window's busy state
   * @param aWindow the window
   * @param aValue the window's busy state
   */
  _setWindowStateBusyValue: function ssi_changeWindowStateBusyValue(
    aWindow,
    aValue
  ) {
__L_V__5({
    lN: 5638,tT:'func',pr:'',eT:{'aWindow':aWindow,'aValue':aValue},fN:'ssi_changeWindowStateBusyValue'
  });'__L_V__5';
    this._windows[aWindow.__SSi].busy = aValue;

    // Keep the to-be-restored state in sync because that is returned by
    // getWindowState() as long as the window isn't loaded, yet.
    if (!this._isWindowLoaded(aWindow)) {
__L_V__5({
    lN: 5643,tT:'if',pr:'!this._isWindowLoaded(aWindow)',eT:{},fN:''
  });'__L_V__5';
      let stateToRestore = this._statesToRestore[
        WINDOW_RESTORE_IDS.get(aWindow)
      ].windows[0];
      stateToRestore.busy = aValue;
    }
  },

  /**
   * Set the given window's state to 'not busy'.
   * @param aWindow the window
   */
  _setWindowStateReady: function ssi_setWindowStateReady(aWindow) {
__L_V__5({
    lN: 5655,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_setWindowStateReady'
  });'__L_V__5';
    let newCount = (this._windowBusyStates.get(aWindow) || 0) - 1;
    if (newCount < 0) {
__L_V__5({
    lN: 5657,tT:'if',pr:'newCount < 0',eT:{},fN:''
  });'__L_V__5';
      throw new Error("Invalid window busy state (less than zero).");
    }
    this._windowBusyStates.set(aWindow, newCount);

    if (newCount == 0) {
__L_V__5({
    lN: 5662,tT:'if',pr:'newCount == 0',eT:{},fN:''
  });'__L_V__5';
      this._setWindowStateBusyValue(aWindow, false);
      this._sendWindowStateEvent(aWindow, "Ready");
    }
  },

  /**
   * Set the given window's state to 'busy'.
   * @param aWindow the window
   */
  _setWindowStateBusy: function ssi_setWindowStateBusy(aWindow) {
__L_V__5({
    lN: 5672,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_setWindowStateBusy'
  });'__L_V__5';
    let newCount = (this._windowBusyStates.get(aWindow) || 0) + 1;
    this._windowBusyStates.set(aWindow, newCount);

    if (newCount == 1) {
__L_V__5({
    lN: 5676,tT:'if',pr:'newCount == 1',eT:{},fN:''
  });'__L_V__5';
      this._setWindowStateBusyValue(aWindow, true);
      this._sendWindowStateEvent(aWindow, "Busy");
    }
  },

  /**
   * Dispatch an SSWindowState_____ event for the given window.
   * @param aWindow the window
   * @param aType the type of event, SSWindowState will be prepended to this string
   */
  _sendWindowStateEvent: function ssi_sendWindowStateEvent(aWindow, aType) {
__L_V__5({
    lN: 5687,tT:'func',pr:'',eT:{'aWindow':aWindow,'aType':aType},fN:'ssi_sendWindowStateEvent'
  });'__L_V__5';
    let event = aWindow.document.createEvent("Events");
    event.initEvent("SSWindowState" + aType, true, false);
    aWindow.dispatchEvent(event);
  },

  /**
   * Dispatch the SSWindowRestored event for the given window.
   * @param aWindow
   *        The window which has been restored
   */
  _sendWindowRestoredNotification(aWindow) {
__L_V__5({
    lN: 5698,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'_sendWindowRestoredNotification'
  });'__L_V__5';
    let event = aWindow.document.createEvent("Events");
    event.initEvent("SSWindowRestored", true, false);
    aWindow.dispatchEvent(event);
  },

  /**
   * Dispatch the SSTabRestored event for the given tab.
   * @param aTab
   *        The tab which has been restored
   * @param aIsRemotenessUpdate
   *        True if this tab was restored due to flip from running from
   *        out-of-main-process to in-main-process or vice-versa.
   */
  _sendTabRestoredNotification(aTab, aIsRemotenessUpdate) {
__L_V__5({
    lN: 5712,tT:'func',pr:'',eT:{'aTab':aTab,'aIsRemotenessUpdate':aIsRemotenessUpdate},fN:'_sendTabRestoredNotification'
  });'__L_V__5';
    let event = aTab.ownerDocument.createEvent("CustomEvent");
    event.initCustomEvent("SSTabRestored", true, false, {
      isRemotenessUpdate: aIsRemotenessUpdate,
    });
    aTab.dispatchEvent(event);
  },

  /**
   * @param aWindow
   *        Window reference
   * @returns whether this window's data is still cached in _statesToRestore
   *          because it's not fully loaded yet
   */
  _isWindowLoaded: function ssi_isWindowLoaded(aWindow) {
__L_V__5({
    lN: 5726,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'ssi_isWindowLoaded'
  });'__L_V__5';
    return !WINDOW_RESTORE_IDS.has(aWindow);
  },

  /**
   * Resize this._closedWindows to the value of the pref, except in the case
   * where we don't have any non-popup windows on Windows and Linux. Then we must
   * resize such that we have at least one non-popup window.
   */
  _capClosedWindows: function ssi_capClosedWindows() {
__L_V__5({
    lN: 5735,tT:'func',pr:'',eT:{},fN:'ssi_capClosedWindows'
  });'__L_V__5';
    if (this._closedWindows.length <= this._max_windows_undo) {
__L_V__5({
    lN: 5736,tT:'if',pr:'this._closedWindows.length <= this._max_windows_undo',eT:{},fN:''
  });'__L_V__5';
      return;
    }
    let spliceTo = this._max_windows_undo;
    if (AppConstants.platform != "macosx") {
__L_V__5({
    lN: 5740,tT:'if',pr:'AppConstants.platform != macosx',eT:{},fN:''
  });'__L_V__5';
      let normalWindowIndex = 0;
      // try to find a non-popup window in this._closedWindows
      while (
        normalWindowIndex < this._closedWindows.length &&
        !!this._closedWindows[normalWindowIndex].isPopup
      ) {
        normalWindowIndex++;
      }
      if (normalWindowIndex >= this._max_windows_undo) {
__L_V__5({
    lN: 5749,tT:'if',pr:'normalWindowIndex >= this._max_windows_undo',eT:{},fN:''
  });'__L_V__5';
        spliceTo = normalWindowIndex + 1;
      }
    }
    if (spliceTo < this._closedWindows.length) {
__L_V__5({
    lN: 5753,tT:'if',pr:'spliceTo < this._closedWindows.length',eT:{},fN:''
  });'__L_V__5';
      this._closedWindows.splice(spliceTo, this._closedWindows.length);
      this._closedObjectsChanged = true;
    }
  },

  /**
   * Clears the set of windows that are "resurrected" before writing to disk to
   * make closing windows one after the other until shutdown work as expected.
   *
   * This function should only be called when we are sure that there has been
   * a user action that indicates the browser is actively being used and all
   * windows that have been closed before are not part of a series of closing
   * windows.
   */
  _clearRestoringWindows: function ssi_clearRestoringWindows() {
__L_V__5({
    lN: 5768,tT:'func',pr:'',eT:{},fN:'ssi_clearRestoringWindows'
  });'__L_V__5';
    for (let i = 0; i < this._closedWindows.length; i++) {
      delete this._closedWindows[i]._shouldRestore;
    }
  },

  /**
   * Reset state to prepare for a new session state to be restored.
   */
  _resetRestoringState: function ssi_initRestoringState() {
__L_V__5({
    lN: 5777,tT:'func',pr:'',eT:{},fN:'ssi_initRestoringState'
  });'__L_V__5';
    TabRestoreQueue.reset();
    this._tabsRestoringCount = 0;
  },

  /**
   * Reset the restoring state for a particular tab. This will be called when
   * removing a tab or when a tab needs to be reset (it's being overwritten).
   *
   * @param aTab
   *        The tab that will be "reset"
   */
  _resetLocalTabRestoringState(aTab) {
__L_V__5({
    lN: 5789,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_resetLocalTabRestoringState'
  });'__L_V__5';
    let browser = aTab.linkedBrowser;

    // Keep the tab's previous state for later in this method
    let previousState = TAB_STATE_FOR_BROWSER.get(browser);

    if (!previousState) {
__L_V__5({
    lN: 5795,tT:'if',pr:'!previousState',eT:{},fN:''
  });'__L_V__5';
      Cu.reportError("Given tab is not restoring.");
      return;
    }

    // The browser is no longer in any sort of restoring state.
    TAB_STATE_FOR_BROWSER.delete(browser);

    aTab.removeAttribute("pending");

    if (previousState == TAB_STATE_RESTORING) {
__L_V__5({
    lN: 5805,tT:'if',pr:'previousState == TAB_STATE_RESTORING',eT:{},fN:''
  });'__L_V__5';
      if (this._tabsRestoringCount) {
__L_V__5({
    lN: 5806,tT:'if',pr:'this._tabsRestoringCount',eT:{},fN:''
  });'__L_V__5';
        this._tabsRestoringCount--;
      }
    } else if (previousState == TAB_STATE_NEEDS_RESTORE) {
__L_V__5({
    lN: 5809,tT:'if',pr:'previousState == TAB_STATE_NEEDS_RESTORE',eT:{},fN:''
  });'__L_V__5';
      // Make sure that the tab is removed from the list of tabs to restore.
      // Again, this is normally done in restoreTabContent, but that isn't being called
      // for this tab.
      TabRestoreQueue.remove(aTab);
    }
  },

  _resetTabRestoringState(tab) {
__L_V__5({
    lN: 5817,tT:'func',pr:'',eT:{'tab':tab},fN:'_resetTabRestoringState'
  });'__L_V__5';
    let browser = tab.linkedBrowser;

    if (!TAB_STATE_FOR_BROWSER.has(browser)) {
__L_V__5({
    lN: 5820,tT:'if',pr:'!TAB_STATE_FOR_BROWSER.has(browser)',eT:{},fN:''
  });'__L_V__5';
      Cu.reportError("Given tab is not restoring.");
      return;
    }

    browser.messageManager.sendAsyncMessage("SessionStore:resetRestore", {});
    this._resetLocalTabRestoringState(tab);
  },

  /**
   * Each fresh tab starts out with epoch=0. This function can be used to
   * start a next epoch by incrementing the current value. It will enables us
   * to ignore stale messages sent from previous epochs. The function returns
   * the new epoch ID for the given |browser|.
   */
  startNextEpoch(browser) {
__L_V__5({
    lN: 5835,tT:'func',pr:'',eT:{'browser':browser},fN:'startNextEpoch'
  });'__L_V__5';
    let next = this.getCurrentEpoch(browser) + 1;
    this._browserEpochs.set(browser.permanentKey, next);
    return next;
  },

  /**
   * Manually set the epoch to a given value.
   */
  setCurrentEpoch(aBrowser, aEpoch) {
__L_V__5({
    lN: 5844,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aEpoch':aEpoch},fN:'setCurrentEpoch'
  });'__L_V__5';
    this._browserEpochs.set(aBrowser.permanentKey, aEpoch);
    return aEpoch;
  },

  /**
   * Returns the current epoch for the given <browser>. If we haven't assigned
   * a new epoch this will default to zero for new tabs.
   */
  getCurrentEpoch(browser) {
__L_V__5({
    lN: 5853,tT:'func',pr:'',eT:{'browser':browser},fN:'getCurrentEpoch'
  });'__L_V__5';
    return this._browserEpochs.get(browser.permanentKey) || 0;
  },

  /**
   * Each time a <browser> element is restored, we increment its "epoch". To
   * check if a message from content-sessionStore.js is out of date, we can
   * compare the epoch received with the message to the <browser> element's
   * epoch. This function does that, and returns true if |epoch| is up-to-date
   * with respect to |browser|.
   */
  isCurrentEpoch(browser, epoch) {
__L_V__5({
    lN: 5864,tT:'func',pr:'',eT:{'browser':browser,'epoch':epoch},fN:'isCurrentEpoch'
  });'__L_V__5';
    return this.getCurrentEpoch(browser) == epoch;
  },

  /**
   * Resets the epoch for a given <browser>. We need to this every time we
   * receive a hint that a new docShell has been loaded into the browser as
   * the frame script starts out with epoch=0.
   */
  resetEpoch(browser) {
__L_V__5({
    lN: 5873,tT:'func',pr:'',eT:{'browser':browser},fN:'resetEpoch'
  });'__L_V__5';
    this._browserEpochs.delete(browser.permanentKey);
  },

  /**
   * Countdown for a given duration, skipping beats if the computer is too busy,
   * sleeping or otherwise unavailable.
   *
   * @param {number} delay An approximate delay to wait in milliseconds (rounded
   * up to the closest second).
   *
   * @return Promise
   */
  looseTimer(delay) {
__L_V__5({
    lN: 5886,tT:'func',pr:'',eT:{'delay':delay},fN:'looseTimer'
  });'__L_V__5';
    let DELAY_BEAT = 1000;
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    let beats = Math.ceil(delay / DELAY_BEAT);
    let deferred = PromiseUtils.defer();
    timer.initWithCallback(
      function() {
__L_V__5({
    lN: 5892,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__5';
        if (beats <= 0) {
__L_V__5({
    lN: 5893,tT:'if',pr:'beats <= 0',eT:{},fN:''
  });'__L_V__5';
          deferred.resolve();
        }
        --beats;
      },
      DELAY_BEAT,
      Ci.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP
    );
    // Ensure that the timer is both canceled once we are done with it
    // and not garbage-collected until then.
    deferred.promise.then(() => timer.cancel(), () => timer.cancel());
    return deferred;
  },

  /**
   * Send the "SessionStore:restoreHistory" message to content, triggering a
   * content restore. This method is intended to be used internally by
   * SessionStore, as it also ensures that permissions are avaliable in the
   * content process before triggering the history restore in the content
   * process.
   *
   * @param browser The browser to transmit the permissions for
   * @param options The options data to send to content.
   */
  _sendRestoreHistory(browser, options) {
__L_V__5({
    lN: 5917,tT:'func',pr:'',eT:{'browser':browser,'options':options},fN:'_sendRestoreHistory'
  });'__L_V__5';
    // If the tabData which we're sending down has any sessionStorage associated
    // with it, we need to send down permissions for the domains, as this
    // information will be needed to correctly restore the session.
    if (options.tabData.storage) {
__L_V__5({
    lN: 5921,tT:'if',pr:'options.tabData.storage',eT:{},fN:''
  });'__L_V__5';
      for (let origin of Object.getOwnPropertyNames(options.tabData.storage)) {
        try {
          let { frameLoader } = browser;
          if (frameLoader.remoteTab) {
__L_V__5({
    lN: 5925,tT:'if',pr:'frameLoader.remoteTab',eT:{},fN:''
  });'__L_V__5';
            let attrs = browser.contentPrincipal.originAttributes;
            let dataPrincipal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(
              origin
            );
            let principal = Services.scriptSecurityManager.createContentPrincipal(
              dataPrincipal.URI,
              attrs
            );
            frameLoader.remoteTab.transmitPermissionsForPrincipal(principal);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    browser.messageManager.sendAsyncMessage(
      "SessionStore:restoreHistory",
      options
    );

    if (browser && browser.frameLoader) {
__L_V__5({
    lN: 5947,tT:'if',pr:'browser && browser.frameLoader',eT:{},fN:''
  });'__L_V__5';
      browser.frameLoader.requestEpochUpdate(options.epoch);
    }
  },
};

/**
 * Priority queue that keeps track of a list of tabs to restore and returns
 * the tab we should restore next, based on priority rules. We decide between
 * pinned, visible and hidden tabs in that and FIFO order. Hidden tabs are only
 * restored with restore_hidden_tabs=true.
 */
var TabRestoreQueue = {
  // The separate buckets used to store tabs.
  tabs: { priority: [], visible: [], hidden: [] },

  // Preferences used by the TabRestoreQueue to determine which tabs
  // are restored automatically and which tabs will be on-demand.
  prefs: {
    // Lazy getter that returns whether tabs are restored on demand.
    get restoreOnDemand() {
__L_V__5({
    lN: 5967,tT:'func',pr:'',eT:{},fN:'restoreOnDemand'
  });'__L_V__5';
      let updateValue = () => {
        let value = Services.prefs.getBoolPref(PREF);
        let definition = { value, configurable: true };
        Object.defineProperty(this, "restoreOnDemand", definition);
        return value;
      };

      const PREF = "browser.sessionstore.restore_on_demand";
      Services.prefs.addObserver(PREF, updateValue);
      return updateValue();
    },

    // Lazy getter that returns whether pinned tabs are restored on demand.
    get restorePinnedTabsOnDemand() {
__L_V__5({
    lN: 5981,tT:'func',pr:'',eT:{},fN:'restorePinnedTabsOnDemand'
  });'__L_V__5';
      let updateValue = () => {
        let value = Services.prefs.getBoolPref(PREF);
        let definition = { value, configurable: true };
        Object.defineProperty(this, "restorePinnedTabsOnDemand", definition);
        return value;
      };

      const PREF = "browser.sessionstore.restore_pinned_tabs_on_demand";
      Services.prefs.addObserver(PREF, updateValue);
      return updateValue();
    },

    // Lazy getter that returns whether we should restore hidden tabs.
    get restoreHiddenTabs() {
__L_V__5({
    lN: 5995,tT:'func',pr:'',eT:{},fN:'restoreHiddenTabs'
  });'__L_V__5';
      let updateValue = () => {
        let value = Services.prefs.getBoolPref(PREF);
        let definition = { value, configurable: true };
        Object.defineProperty(this, "restoreHiddenTabs", definition);
        return value;
      };

      const PREF = "browser.sessionstore.restore_hidden_tabs";
      Services.prefs.addObserver(PREF, updateValue);
      return updateValue();
    },
  },

  // Resets the queue and removes all tabs.
  reset() {
__L_V__5({
    lN: 6010,tT:'func',pr:'',eT:{},fN:'reset'
  });'__L_V__5';
    this.tabs = { priority: [], visible: [], hidden: [] };
  },

  // Adds a tab to the queue and determines its priority bucket.
  add(tab) {
__L_V__5({
    lN: 6015,tT:'func',pr:'',eT:{'tab':tab},fN:'add'
  });'__L_V__5';
    let { priority, hidden, visible } = this.tabs;

    if (tab.pinned) {
__L_V__5({
    lN: 6018,tT:'if',pr:'tab.pinned',eT:{},fN:''
  });'__L_V__5';
      priority.push(tab);
    } else if (tab.hidden) {
__L_V__5({
    lN: 6020,tT:'if',pr:'tab.hidden',eT:{},fN:''
  });'__L_V__5';
      hidden.push(tab);
    } else {
      visible.push(tab);
    }
  },

  // Removes a given tab from the queue, if it's in there.
  remove(tab) {
__L_V__5({
    lN: 6028,tT:'func',pr:'',eT:{'tab':tab},fN:'remove'
  });'__L_V__5';
    let { priority, hidden, visible } = this.tabs;

    // We'll always check priority first since we don't
    // have an indicator if a tab will be there or not.
    let set = priority;
    let index = set.indexOf(tab);

    if (index == -1) {
__L_V__5({
    lN: 6036,tT:'if',pr:'index == -1',eT:{},fN:''
  });'__L_V__5';
      set = tab.hidden ? hidden : visible;
      index = set.indexOf(tab);
    }

    if (index > -1) {
__L_V__5({
    lN: 6041,tT:'if',pr:'index > -1',eT:{},fN:''
  });'__L_V__5';
      set.splice(index, 1);
    }
  },

  // Returns and removes the tab with the highest priority.
  shift() {
__L_V__5({
    lN: 6047,tT:'func',pr:'',eT:{},fN:'shift'
  });'__L_V__5';
    let set;
    let { priority, hidden, visible } = this.tabs;

    let { restoreOnDemand, restorePinnedTabsOnDemand } = this.prefs;
    let restorePinned = !(restoreOnDemand && restorePinnedTabsOnDemand);
    if (restorePinned && priority.length) {
__L_V__5({
    lN: 6053,tT:'if',pr:'restorePinned && priority.length',eT:{},fN:''
  });'__L_V__5';
      set = priority;
    } else if (!restoreOnDemand) {
__L_V__5({
    lN: 6055,tT:'if',pr:'!restoreOnDemand',eT:{},fN:''
  });'__L_V__5';
      if (visible.length) {
__L_V__5({
    lN: 6056,tT:'if',pr:'visible.length',eT:{},fN:''
  });'__L_V__5';
        set = visible;
      } else if (this.prefs.restoreHiddenTabs && hidden.length) {
__L_V__5({
    lN: 6058,tT:'if',pr:'this.prefs.restoreHiddenTabs && hidden.length',eT:{},fN:''
  });'__L_V__5';
        set = hidden;
      }
    }

    return set && set.shift();
  },

  // Moves a given tab from the 'hidden' to the 'visible' bucket.
  hiddenToVisible(tab) {
__L_V__5({
    lN: 6067,tT:'func',pr:'',eT:{'tab':tab},fN:'hiddenToVisible'
  });'__L_V__5';
    let { hidden, visible } = this.tabs;
    let index = hidden.indexOf(tab);

    if (index > -1) {
__L_V__5({
    lN: 6071,tT:'if',pr:'index > -1',eT:{},fN:''
  });'__L_V__5';
      hidden.splice(index, 1);
      visible.push(tab);
    }
  },

  // Moves a given tab from the 'visible' to the 'hidden' bucket.
  visibleToHidden(tab) {
__L_V__5({
    lN: 6078,tT:'func',pr:'',eT:{'tab':tab},fN:'visibleToHidden'
  });'__L_V__5';
    let { visible, hidden } = this.tabs;
    let index = visible.indexOf(tab);

    if (index > -1) {
__L_V__5({
    lN: 6082,tT:'if',pr:'index > -1',eT:{},fN:''
  });'__L_V__5';
      visible.splice(index, 1);
      hidden.push(tab);
    }
  },

  /**
   * Returns true if the passed tab is in one of the sets that we're
   * restoring content in automatically.
   *
   * @param tab (<xul:tab>)
   *        The tab to check
   * @returns bool
   */
  willRestoreSoon(tab) {
__L_V__5({
    lN: 6096,tT:'func',pr:'',eT:{'tab':tab},fN:'willRestoreSoon'
  });'__L_V__5';
    let { priority, hidden, visible } = this.tabs;
    let {
      restoreOnDemand,
      restorePinnedTabsOnDemand,
      restoreHiddenTabs,
    } = this.prefs;
    let restorePinned = !(restoreOnDemand && restorePinnedTabsOnDemand);
    let candidateSet = [];

    if (restorePinned && priority.length) {
__L_V__5({
    lN: 6106,tT:'if',pr:'restorePinned && priority.length',eT:{},fN:''
  });'__L_V__5';
      candidateSet.push(...priority);
    }

    if (!restoreOnDemand) {
__L_V__5({
    lN: 6110,tT:'if',pr:'!restoreOnDemand',eT:{},fN:''
  });'__L_V__5';
      if (visible.length) {
__L_V__5({
    lN: 6111,tT:'if',pr:'visible.length',eT:{},fN:''
  });'__L_V__5';
        candidateSet.push(...visible);
      }

      if (restoreHiddenTabs && hidden.length) {
__L_V__5({
    lN: 6115,tT:'if',pr:'restoreHiddenTabs && hidden.length',eT:{},fN:''
  });'__L_V__5';
        candidateSet.push(...hidden);
      }
    }

    return candidateSet.indexOf(tab) > -1;
  },
};

// A map storing a closed window's state data until it goes aways (is GC'ed).
// This ensures that API clients can still read (but not write) states of
// windows they still hold a reference to but we don't.
var DyingWindowCache = {
  _data: new WeakMap(),

  has(window) {
__L_V__5({
    lN: 6130,tT:'func',pr:'',eT:{'window':window},fN:'has'
  });'__L_V__5';
    return this._data.has(window);
  },

  get(window) {
__L_V__5({
    lN: 6134,tT:'func',pr:'',eT:{'window':window},fN:'get'
  });'__L_V__5';
    return this._data.get(window);
  },

  set(window, data) {
__L_V__5({
    lN: 6138,tT:'func',pr:'',eT:{'window':window,'data':data},fN:'set'
  });'__L_V__5';
    this._data.set(window, data);
  },

  remove(window) {
__L_V__5({
    lN: 6142,tT:'func',pr:'',eT:{'window':window},fN:'remove'
  });'__L_V__5';
    this._data.delete(window);
  },
};

// A weak set of dirty windows. We use it to determine which windows we need to
// recollect data for when getCurrentState() is called.
var DirtyWindows = {
  _data: new WeakMap(),

  has(window) {
__L_V__5({
    lN: 6152,tT:'func',pr:'',eT:{'window':window},fN:'has'
  });'__L_V__5';
    return this._data.has(window);
  },

  add(window) {
__L_V__5({
    lN: 6156,tT:'func',pr:'',eT:{'window':window},fN:'add'
  });'__L_V__5';
    return this._data.set(window, true);
  },

  remove(window) {
__L_V__5({
    lN: 6160,tT:'func',pr:'',eT:{'window':window},fN:'remove'
  });'__L_V__5';
    this._data.delete(window);
  },

  clear(window) {
__L_V__5({
    lN: 6164,tT:'func',pr:'',eT:{'window':window},fN:'clear'
  });'__L_V__5';
    this._data = new WeakMap();
  },
};

// The state from the previous session (after restoring pinned tabs). This
// state is persisted and passed through to the next session during an app
// restart to make the third party add-on warning not trash the deferred
// session
var LastSession = {
  _state: null,

  get canRestore() {
__L_V__5({
    lN: 6176,tT:'func',pr:'',eT:{},fN:'canRestore'
  });'__L_V__5';
    return !!this._state;
  },

  getState() {
__L_V__5({
    lN: 6180,tT:'func',pr:'',eT:{},fN:'getState'
  });'__L_V__5';
    return this._state;
  },

  setState(state) {
__L_V__5({
    lN: 6184,tT:'func',pr:'',eT:{'state':state},fN:'setState'
  });'__L_V__5';
    this._state = state;
  },

  clear(silent = false) {
__L_V__5({
    lN: 6188,tT:'func',pr:'',eT:{'silent':silent},fN:'clear'
  });'__L_V__5';
    if (this._state) {
__L_V__5({
    lN: 6189,tT:'if',pr:'this._state',eT:{},fN:''
  });'__L_V__5';
      this._state = null;
      if (!silent) {
__L_V__5({
    lN: 6191,tT:'if',pr:'!silent',eT:{},fN:''
  });'__L_V__5';
        Services.obs.notifyObservers(null, NOTIFY_LAST_SESSION_CLEARED);
      }
    }
  },
};
