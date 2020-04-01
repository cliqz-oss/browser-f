
/*LS-189843*/var { CliqzLogger } = ChromeUtils.import('resource://gre/modules/CliqzLogger.jsm');
var __L_V__2 = CliqzLogger.init('mozilla-release/browser/base/content/browser.js','browser');/*LE-189843*/
/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);
ChromeUtils.import("resource://gre/modules/NotificationDB.jsm");

var { CliqzResources } = ChromeUtils.import(
  "resource:///modules/CliqzResources.jsm"
);

// lazy module getters

XPCOMUtils.defineLazyModuleGetters(this, {
  AboutNewTabStartupRecorder: "resource:///modules/AboutNewTabService.jsm",
  AddonManager: "resource://gre/modules/AddonManager.jsm",
  AMTelemetry: "resource://gre/modules/AddonManager.jsm",
  NewTabPagePreloading: "resource:///modules/NewTabPagePreloading.jsm",
  BrowserUsageTelemetry: "resource:///modules/BrowserUsageTelemetry.jsm",
  BrowserUtils: "resource://gre/modules/BrowserUtils.jsm",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
#ifdef MOZ_ACTIVITY_STREAM
  CFRPageActions: "resource://activity-stream/lib/CFRPageActions.jsm",
#endif
  CharsetMenu: "resource://gre/modules/CharsetMenu.jsm",
  Color: "resource://gre/modules/Color.jsm",
  ContentSearch: "resource:///modules/ContentSearch.jsm",
  ContextualIdentityService:
    "resource://gre/modules/ContextualIdentityService.jsm",
  CustomizableUI: "resource:///modules/CustomizableUI.jsm",
  Deprecated: "resource://gre/modules/Deprecated.jsm",
  DownloadsCommon: "resource:///modules/DownloadsCommon.jsm",
  DownloadUtils: "resource://gre/modules/DownloadUtils.jsm",
  E10SUtils: "resource://gre/modules/E10SUtils.jsm",
  ExtensionsUI: "resource:///modules/ExtensionsUI.jsm",
  HomePage: "resource:///modules/HomePage.jsm",
  LightweightThemeConsumer:
    "resource://gre/modules/LightweightThemeConsumer.jsm",
  Log: "resource://gre/modules/Log.jsm",
  LoginHelper: "resource://gre/modules/LoginHelper.jsm",
  LoginManagerParent: "resource://gre/modules/LoginManagerParent.jsm",
  MigrationUtils: "resource:///modules/MigrationUtils.jsm",
  NetUtil: "resource://gre/modules/NetUtil.jsm",
  NewTabUtils: "resource://gre/modules/NewTabUtils.jsm",
  OpenInTabsUtils: "resource:///modules/OpenInTabsUtils.jsm",
  PageActions: "resource:///modules/PageActions.jsm",
  PageThumbs: "resource://gre/modules/PageThumbs.jsm",
  PanelMultiView: "resource:///modules/PanelMultiView.jsm",
  PanelView: "resource:///modules/PanelMultiView.jsm",
  PermitUnloader: "resource://gre/actors/BrowserElementParent.jsm",
  PictureInPicture: "resource://gre/modules/PictureInPicture.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  PlacesUIUtils: "resource:///modules/PlacesUIUtils.jsm",
  PlacesTransactions: "resource://gre/modules/PlacesTransactions.jsm",
  PluralForm: "resource://gre/modules/PluralForm.jsm",
  Pocket: "chrome://pocket/content/Pocket.jsm",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  ProcessHangMonitor: "resource:///modules/ProcessHangMonitor.jsm",
  PromiseUtils: "resource://gre/modules/PromiseUtils.jsm",
  // TODO (Bug 1529552): Remove once old urlbar code goes away.
  ReaderMode: "resource://gre/modules/ReaderMode.jsm",
  ReaderParent: "resource:///modules/ReaderParent.jsm",
  RFPHelper: "resource://gre/modules/RFPHelper.jsm",
  SafeBrowsing: "resource://gre/modules/SafeBrowsing.jsm",
  Sanitizer: "resource:///modules/Sanitizer.jsm",
  SessionStartup: "resource:///modules/sessionstore/SessionStartup.jsm",
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
  ShortcutUtils: "resource://gre/modules/ShortcutUtils.jsm",
  SimpleServiceDiscovery: "resource://gre/modules/SimpleServiceDiscovery.jsm",
  SiteDataManager: "resource:///modules/SiteDataManager.jsm",
  SitePermissions: "resource:///modules/SitePermissions.jsm",
  SiteSpecificBrowser: "resource:///modules/SiteSpecificBrowserService.jsm",
  SiteSpecificBrowserService:
    "resource:///modules/SiteSpecificBrowserService.jsm",
  TabModalPrompt: "chrome://global/content/tabprompts.jsm",
  TabCrashHandler: "resource:///modules/ContentCrashHandlers.jsm",
  TelemetryEnvironment: "resource://gre/modules/TelemetryEnvironment.jsm",
  Translation: "resource:///modules/translation/Translation.jsm",
  UITour: "resource:///modules/UITour.jsm",
  UpdateUtils: "resource://gre/modules/UpdateUtils.jsm",
  UrlbarInput: "resource:///modules/UrlbarInput.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProviderSearchTips: "resource:///modules/UrlbarProviderSearchTips.jsm",
  UrlbarTokenizer: "resource:///modules/UrlbarTokenizer.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  UrlbarValueFormatter: "resource:///modules/UrlbarValueFormatter.jsm",
#ifdef MOZ_SERVICES_SYNC
  Weave: "resource://services-sync/main.js",
#endif
  WebNavigationFrames: "resource://gre/modules/WebNavigationFrames.jsm",
  fxAccounts: "resource://gre/modules/FxAccounts.jsm",
  webrtcUI: "resource:///modules/webrtcUI.jsm",
  ZoomUI: "resource:///modules/ZoomUI.jsm",
});

if (AppConstants.MOZ_CRASHREPORTER) {
__L_V__2({
    lN: 106,tT:'if',pr:'AppConstants.MOZ_CRASHREPORTER',eT:{},fN:''
  });'__L_V__2';
  ChromeUtils.defineModuleGetter(
    this,
    "PluginCrashReporter",
    "resource:///modules/ContentCrashHandlers.jsm"
  );
}

XPCOMUtils.defineLazyScriptGetter(
  this,
  ["isBlankPageURL"],
  "chrome://browser/content/utilityOverlay.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "PlacesTreeView",
  "chrome://browser/content/places/treeView.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  ["PlacesInsertionPoint", "PlacesController", "PlacesControllerDragHelper"],
  "chrome://browser/content/places/controller.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "PrintUtils",
  "chrome://global/content/printUtils.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "ZoomManager",
  "chrome://global/content/viewZoomOverlay.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "FullZoom",
  "chrome://browser/content/browser-fullZoom.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "PanelUI",
  "chrome://browser/content/customizableui/panelUI.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gViewSourceUtils",
  "chrome://global/content/viewSourceUtils.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gTabsPanel",
  "chrome://browser/content/browser-allTabsMenu.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  ["gExtensionsNotifications", "gXPInstallObserver"],
  "chrome://browser/content/browser-addons.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "ctrlTab",
  "chrome://browser/content/browser-ctrlTab.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  ["CustomizationHandler", "AutoHideMenubar"],
  "chrome://browser/content/browser-customization.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  ["PointerLock", "FullScreen"],
  "chrome://browser/content/browser-fullScreenAndPointerLock.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gIdentityHandler",
  "chrome://browser/content/browser-siteIdentity.js"
);

#if 0
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gProtectionsHandler",
  "chrome://browser/content/browser-siteProtections.js"
);
#endif

XPCOMUtils.defineLazyScriptGetter(
  this,
  ["gGestureSupport", "gHistorySwipeAnimation"],
  "chrome://browser/content/browser-gestureSupport.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gSafeBrowsing",
  "chrome://browser/content/browser-safebrowsing.js"
);
#ifdef MOZ_SERVICES_SYNC
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gSync",
  "chrome://browser/content/browser-sync.js"
);
#endif
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gBrowserThumbnails",
  "chrome://browser/content/browser-thumbnails.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  ["openContextMenu", "nsContextMenu"],
  "chrome://browser/content/nsContextMenu.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  [
    "DownloadsPanel",
    "DownloadsOverlayLoader",
    "DownloadsSubview",
    "DownloadsView",
    "DownloadsViewUI",
    "DownloadsViewController",
    "DownloadsSummary",
    "DownloadsFooter",
    "DownloadsBlockedSubview",
  ],
  "chrome://browser/content/downloads/downloads.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  ["DownloadsButton", "DownloadsIndicatorView"],
  "chrome://browser/content/downloads/indicator.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gEditItemOverlay",
  "chrome://browser/content/places/editBookmark.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "SearchOneOffs",
  "chrome://browser/content/search/search-one-offs.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "gGfxUtils",
  "chrome://browser/content/browser-graphics-utils.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "pktUI",
  "chrome://pocket/content/main.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "ToolbarKeyboardNavigator",
  "chrome://browser/content/browser-toolbarKeyNav.js"
);
XPCOMUtils.defineLazyScriptGetter(
  this,
  "A11yUtils",
  "chrome://browser/content/browser-a11yUtils.js"
);

// lazy service getters

XPCOMUtils.defineLazyServiceGetters(this, {
  ContentPrefService2: [
    "@mozilla.org/content-pref/service;1",
    "nsIContentPrefService2",
  ],
  classifierService: [
    "@mozilla.org/url-classifier/dbservice;1",
    "nsIURIClassifier",
  ],
  Favicons: ["@mozilla.org/browser/favicon-service;1", "nsIFaviconService"],
  gAboutNewTabService: [
    "@mozilla.org/browser/aboutnewtab-service;1",
    "nsIAboutNewTabService",
  ],
  gDNSService: ["@mozilla.org/network/dns-service;1", "nsIDNSService"],
  gSerializationHelper: [
    "@mozilla.org/network/serialization-helper;1",
    "nsISerializationHelper",
  ],
  Marionette: ["@mozilla.org/remote/marionette;1", "nsIMarionette"],
  WindowsUIUtils: ["@mozilla.org/windows-ui-utils;1", "nsIWindowsUIUtils"],
  BrowserHandler: ["@mozilla.org/browser/clh;1", "nsIBrowserHandler"],
});

if (AppConstants.MOZ_CRASHREPORTER) {
__L_V__2({
    lN: 297,tT:'if',pr:'AppConstants.MOZ_CRASHREPORTER',eT:{},fN:''
  });'__L_V__2';
  XPCOMUtils.defineLazyServiceGetter(
    this,
    "gCrashReporter",
    "@mozilla.org/xre/app-info;1",
    "nsICrashReporter"
  );
}

if (AppConstants.ENABLE_REMOTE_AGENT) {
__L_V__2({
    lN: 306,tT:'if',pr:'AppConstants.ENABLE_REMOTE_AGENT',eT:{},fN:''
  });'__L_V__2';
  XPCOMUtils.defineLazyServiceGetter(
    this,
    "RemoteAgent",
    "@mozilla.org/remote/agent;1",
    "nsIRemoteAgent"
  );
} else {
  this.RemoteAgent = { listening: false };
}

XPCOMUtils.defineLazyGetter(this, "RTL_UI", () => {
  return Services.locale.isAppLocaleRTL;
});

XPCOMUtils.defineLazyGetter(this, "gBrandBundle", () => {
  return Services.strings.createBundle(
    "chrome://branding/locale/brand.properties"
  );
});

XPCOMUtils.defineLazyGetter(this, "gBrowserBundle", () => {
  return Services.strings.createBundle(
    "chrome://browser/locale/browser.properties"
  );
});

XPCOMUtils.defineLazyGetter(this, "gTabBrowserBundle", () => {
  return Services.strings.createBundle(
    "chrome://browser/locale/tabbrowser.properties"
  );
});

XPCOMUtils.defineLazyGetter(this, "gCustomizeMode", () => {
  let { CustomizeMode } = ChromeUtils.import(
    "resource:///modules/CustomizeMode.jsm"
  );
  return new CustomizeMode(window);
});

XPCOMUtils.defineLazyGetter(this, "gNavToolbox", () => {
  return document.getElementById("navigator-toolbox");
});

XPCOMUtils.defineLazyGetter(this, "gURLBar", () => {
  return new UrlbarInput({
    textbox: document.getElementById("urlbar"),
    eventTelemetryCategory: "urlbar",
  });
});

// CLIQZ-SPECIAL: used in tab-browser context menu popup
const autoForgetTabs = Cc["@cliqz.com/browser/auto_forget_tabs_service;1"].
  getService(Ci.nsISupports).wrappedJSObject;

XPCOMUtils.defineLazyGetter(this, "ReferrerInfo", () =>
  Components.Constructor(
    "@mozilla.org/referrer-info;1",
    "nsIReferrerInfo",
    "init"
  )
);

// High priority notification bars shown at the top of the window.
XPCOMUtils.defineLazyGetter(this, "gHighPriorityNotificationBox", () => {
  return new MozElements.NotificationBox(element => {
    element.classList.add("global-notificationbox");
    element.setAttribute("notificationside", "top");
    document.getElementById("appcontent").prepend(element);
  });
});

// Regular notification bars shown at the bottom of the window.
XPCOMUtils.defineLazyGetter(this, "gNotificationBox", () => {
  return new MozElements.NotificationBox(element => {
    element.classList.add("global-notificationbox");
    element.setAttribute("notificationside", "bottom");
    document.getElementById("browser-bottombox").appendChild(element);
  });
});

XPCOMUtils.defineLazyGetter(this, "InlineSpellCheckerUI", () => {
  let { InlineSpellChecker } = ChromeUtils.import(
    "resource://gre/modules/InlineSpellChecker.jsm"
  );
  return new InlineSpellChecker();
});

XPCOMUtils.defineLazyGetter(this, "PageMenuParent", () => {
  // eslint-disable-next-line no-shadow
  let { PageMenuParent } = ChromeUtils.import(
    "resource://gre/modules/PageMenu.jsm"
  );
  return new PageMenuParent();
});

XPCOMUtils.defineLazyGetter(this, "PopupNotifications", () => {
  // eslint-disable-next-line no-shadow
  let { PopupNotifications } = ChromeUtils.import(
    "resource://gre/modules/PopupNotifications.jsm"
  );
  try {
    // Hide all notifications while the URL is being edited and the address bar
    // has focus, including the virtual focus in the results popup.
    // We also have to hide notifications explicitly when the window is
    // minimized because of the effects of the "noautohide" attribute on Linux.
    // This can be removed once bug 545265 and bug 1320361 are fixed.
    let shouldSuppress = () => {
      return (
        window.windowState == window.STATE_MINIMIZED ||
        (gURLBar.getAttribute("pageproxystate") != "valid" && gURLBar.focused)
      );
    };
    return new PopupNotifications(
      gBrowser,
      document.getElementById("notification-popup"),
      document.getElementById("notification-popup-box"),
      { shouldSuppress }
    );
  } catch (ex) {
    Cu.reportError(ex);
    return null;
  }
});

XPCOMUtils.defineLazyGetter(this, "Win7Features", () => {
  if (AppConstants.platform != "win") {
__L_V__2({
    lN: 432,tT:'if',pr:'AppConstants.platform != win',eT:{},fN:''
  });'__L_V__2';
    return null;
  }

  const WINTASKBAR_CONTRACTID = "@mozilla.org/windows-taskbar;1";
  if (
    WINTASKBAR_CONTRACTID in Cc &&
    Cc[WINTASKBAR_CONTRACTID].getService(Ci.nsIWinTaskbar).available
  ) {
__L_V__2({
    lN: 440,tT:'if',pr:' WINTASKBAR_CONTRACTID in Cc && Cc[WINTASKBAR_CONTRACTID].getService(Ci.nsIWinTaskbar).available ',eT:{},fN:''
  });'__L_V__2';
    let { AeroPeek } = ChromeUtils.import(
      "resource:///modules/WindowsPreviewPerTab.jsm"
    );
    return {
      onOpenWindow() {
__L_V__2({
    lN: 445,tT:'func',pr:'',eT:{},fN:'onOpenWindow'
  });'__L_V__2';
        AeroPeek.onOpenWindow(window);
        this.handledOpening = true;
      },
      onCloseWindow() {
__L_V__2({
    lN: 449,tT:'func',pr:'',eT:{},fN:'onCloseWindow'
  });'__L_V__2';
        if (this.handledOpening) {
__L_V__2({
    lN: 450,tT:'if',pr:'this.handledOpening',eT:{},fN:''
  });'__L_V__2';
          AeroPeek.onCloseWindow(window);
        }
      },
      handledOpening: false,
    };
  }
  return null;
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gToolbarKeyNavEnabled",
  "browser.toolbars.keyboard_navigation",
  false,
  (aPref, aOldVal, aNewVal) => {
    if (aNewVal) {
__L_V__2({
    lN: 466,tT:'if',pr:'aNewVal',eT:{},fN:''
  });'__L_V__2';
      ToolbarKeyboardNavigator.init();
    } else {
      ToolbarKeyboardNavigator.uninit();
    }
  }
);

#ifdef MOZ_SERVICES_SYNC
XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gFxaToolbarEnabled",
  "identity.fxaccounts.toolbar.enabled",
  false,
  (aPref, aOldVal, aNewVal) => {
    updateFxaToolbarMenu(aNewVal);
  }
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gFxaToolbarAccessed",
  "identity.fxaccounts.toolbar.accessed",
  false,
  (aPref, aOldVal, aNewVal) => {
    updateFxaToolbarMenu(gFxaToolbarEnabled);
  }
);
#endif

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gFxaSendLoginUrl",
  "identity.fxaccounts.service.sendLoginUrl",
  false,
  (aPref, aOldVal, aNewVal) => {
    updateFxaToolbarMenu(gFxaToolbarEnabled);
  }
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gFxaMonitorLoginUrl",
  "identity.fxaccounts.service.monitorLoginUrl",
  false,
  (aPref, aOldVal, aNewVal) => {
    updateFxaToolbarMenu(gFxaToolbarEnabled);
  }
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gFxaDeviceName",
  "identity.fxaccounts.account.device.name",
  false,
  (aPref, aOldVal, aNewVal) => {
    updateFxaToolbarMenu(gFxaToolbarEnabled);
  }
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gAddonAbuseReportEnabled",
  "extensions.abuseReport.enabled",
  false
);

customElements.setElementCreationCallback("translation-notification", () => {
  Services.scriptloader.loadSubScript(
    "chrome://browser/content/translation-notification.js",
    window
  );
});

var gBrowser;
var gLastValidURLStr = "";
var gInPrintPreviewMode = false;
var gContextMenu = null; // nsContextMenu instance
var gMultiProcessBrowser = window.docShell.QueryInterface(Ci.nsILoadContext)
  .useRemoteTabs;
var gFissionBrowser = window.docShell.QueryInterface(Ci.nsILoadContext)
  .useRemoteSubframes;

var gBrowserAllowScriptsToCloseInitialTabs = false;

if (AppConstants.platform != "macosx") {
__L_V__2({
    lN: 551,tT:'if',pr:'AppConstants.platform != macosx',eT:{},fN:''
  });'__L_V__2';
  var gEditUIVisible = true;
}

// Smart getter for the findbar.  If you don't wish to force the creation of
// the findbar, check gFindBarInitialized first.

Object.defineProperty(this, "gFindBar", {
  enumerable: true,
  get() {
__L_V__2({
    lN: 560,tT:'func',pr:'',eT:{},fN:'get'
  });'__L_V__2';
    return gBrowser.getCachedFindBar();
  },
});

Object.defineProperty(this, "gFindBarInitialized", {
  enumerable: true,
  get() {
__L_V__2({
    lN: 567,tT:'func',pr:'',eT:{},fN:'get'
  });'__L_V__2';
    return gBrowser.isFindBarInitialized();
  },
});

Object.defineProperty(this, "gFindBarPromise", {
  enumerable: true,
  get() {
__L_V__2({
    lN: 574,tT:'func',pr:'',eT:{},fN:'get'
  });'__L_V__2';
    return gBrowser.getFindBar();
  },
});

async function gLazyFindCommand(cmd, ...args) {
__L_V__2({
    lN: 579,tT:'func',pr:'',eT:{'cmd':cmd,'args':args},fN:'gLazyFindCommand'
  });'__L_V__2';
  let fb = await gFindBarPromise;
  // We could be closed by now, or the tab with XBL binding could have gone away:
  if (fb && fb[cmd]) {
__L_V__2({
    lN: 582,tT:'if',pr:'fb && fb[cmd]',eT:{},fN:''
  });'__L_V__2';
    fb[cmd].apply(fb, args);
  }
}

// CLIQZ Blue Theme
// TODO - move this out into a separate file!
try {
  var THEME_PREF = "extensions.cliqz.freshtab.blueTheme.enabled",
      THEME_CLASS = "cliqz-blue",
      FRESHTAB_CONFIG = "extensions.cliqz.freshtabConfig",
      branch = Services.prefs.getBranch('');

  function observe(subject, topic, data) {
__L_V__2({
    lN: 595,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    setThemeState(getThemeState());
  }

  function getThemeState() {
__L_V__2({
    lN: 599,tT:'func',pr:'',eT:{},fN:'getThemeState'
  });'__L_V__2';
    return !branch.prefHasUserValue(THEME_PREF) || branch.getBoolPref(THEME_PREF);
  }

  function getThemeInitialState() {
__L_V__2({
    lN: 603,tT:'func',pr:'',eT:{},fN:'getThemeInitialState'
  });'__L_V__2';
    // set the current state of the Blue theme
    var freshtabConfig = branch.prefHasUserValue(FRESHTAB_CONFIG) ? branch.getStringPref(FRESHTAB_CONFIG) : '{}';
    var freshtabBackground = JSON.parse(freshtabConfig).background || {};
    var themeEnabled = false;

    if (branch.prefHasUserValue(THEME_PREF)) {
__L_V__2({
    lN: 609,tT:'if',pr:'branch.prefHasUserValue(THEME_PREF)',eT:{},fN:''
  });'__L_V__2';
      themeEnabled = branch.getBoolPref(THEME_PREF);
    } else if (Object.keys(freshtabBackground).length === 0) {
__L_V__2({
    lN: 611,tT:'if',pr:'Object.keys(freshtabBackground).length === 0',eT:{},fN:''
  });'__L_V__2';
      // we also set the blue theme if the user did not set any freshtab background
      themeEnabled = true;
      // once we decided should user see the theme or not, save the result in prefs
      branch.setBoolPref(THEME_PREF, true);
    }

    return themeEnabled;
  }

  function setThemeState(enabled) {
__L_V__2({
    lN: 621,tT:'func',pr:'',eT:{'enabled':enabled},fN:'setThemeState'
  });'__L_V__2';
    var win = window.document.getElementById('main-window');
    if (!win) {
__L_V__2({
    lN: 623,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__2';
      // In case of sidebar, window dont have main-window element
      return;
    }
    if (enabled) {
__L_V__2({
    lN: 627,tT:'if',pr:'enabled',eT:{},fN:''
  });'__L_V__2';
      win.classList.add(THEME_CLASS);
    } else {
      win.classList.remove(THEME_CLASS);
    }
  }
  // handles changes
  branch.addObserver(THEME_PREF, { observe:observe }, false);
} catch (e) {
  Cu.reportError(e);
}
// CLIQZ Blue Theme end

var gPageIcons = {
  "about:home": "chrome://branding/content/icon32.png",
  "about:newtab": "chrome://branding/content/icon32.png",
  "about:welcome": "chrome://branding/content/icon32.png",
  "about:newinstall": "chrome://branding/content/icon32.png",
  "about:privatebrowsing": "chrome://browser/skin/privatebrowsing/favicon.svg",
};

// CLIQZ-SPECIAL:
// This variable is a pretty magical thing.
// Not only it is used as a REAL global Array (is used in SessionStore.jsm, tabbrowser.js, etc.)
// but also it provides a feature for any url stored in it not to be displayed in a URL bar
// after it has been loaded.
// Other words if a user goes to about:newtab and that page exists and is loaded then
// literally the url will not be visible in a URL bar itself (it will not contain anything).
var gInitialPages = [
#if 0
  "about:blank",
  "about:newtab",
  "about:home",
  "about:privatebrowsing",
  "about:welcomeback",
  "about:sessionrestore",
  "about:cliqz",
  "about:welcome",
  "about:newinstall",
];

function isInitialPage(url) {
__L_V__2({
    lN: 668,tT:'func',pr:'',eT:{'url':url},fN:'isInitialPage'
  });'__L_V__2';
  if (!(url instanceof Ci.nsIURI)) {
__L_V__2({
    lN: 669,tT:'if',pr:'!(url instanceof Ci.nsIURI)',eT:{},fN:''
  });'__L_V__2';
    try {
      url = Services.io.newURI(url);
    } catch (ex) {
      return false;
    }
  }

  let nonQuery = url.prePath + url.filePath;
  return gInitialPages.includes(nonQuery) || nonQuery == BROWSER_NEW_TAB_URL;
}
#endif
].concat(CliqzResources.INITIAL_PAGES);

function browserWindows() {
__L_V__2({
    lN: 683,tT:'func',pr:'',eT:{},fN:'browserWindows'
  });'__L_V__2';
  return Services.wm.getEnumerator("navigator:browser");
}

// This is a stringbundle-like interface to gBrowserBundle, formerly a getter for
// the "bundle_browser" element.
var gNavigatorBundle = {
  getString(key) {
__L_V__2({
    lN: 690,tT:'func',pr:'',eT:{'key':key},fN:'getString'
  });'__L_V__2';
    return gBrowserBundle.GetStringFromName(key);
  },
  getFormattedString(key, array) {
__L_V__2({
    lN: 693,tT:'func',pr:'',eT:{'key':key,'array':array},fN:'getFormattedString'
  });'__L_V__2';
    return gBrowserBundle.formatStringFromName(key, array);
  },
};

#ifdef MOZ_SERVICES_SYNC
function updateFxaToolbarMenu(enable, isInitialUpdate = false) {
__L_V__2({
    lN: 699,tT:'func',pr:'',eT:{'enable':enable,'isInitialUpdate':isInitialUpdate},fN:'updateFxaToolbarMenu'
  });'__L_V__2';
  // We only show the Firefox Account toolbar menu if the feature is enabled and
  // if sync is enabled.
  const syncEnabled = Services.prefs.getBoolPref(
    "identity.fxaccounts.enabled",
    false
  );
  const mainWindowEl = document.documentElement;
  const fxaPanelEl = document.getElementById("PanelUI-fxa");

  mainWindowEl.setAttribute("fxastatus", "not_configured");
  fxaPanelEl.addEventListener("ViewShowing", gSync.updateSendToDeviceTitle);

  Services.telemetry.setEventRecordingEnabled("fxa_app_menu", true);

  if (enable && syncEnabled) {
__L_V__2({
    lN: 714,tT:'if',pr:'enable && syncEnabled',eT:{},fN:''
  });'__L_V__2';
    mainWindowEl.setAttribute("fxatoolbarmenu", "visible");

    // We have to manually update the sync state UI when toggling the FxA toolbar
    // because it could show an invalid icon if the user is logged in and no sync
    // event was performed yet.
    if (!isInitialUpdate) {
__L_V__2({
    lN: 720,tT:'if',pr:'!isInitialUpdate',eT:{},fN:''
  });'__L_V__2';
      gSync.maybeUpdateUIState();
    }

    Services.telemetry.setEventRecordingEnabled("fxa_avatar_menu", true);

    // When the pref for a FxA service is removed, we remove it from
    // the FxA toolbar menu as well. This is useful when the service
    // might not be available that browser.
    document.getElementById(
      "PanelUI-fxa-menu-send-button"
    ).hidden = !gFxaSendLoginUrl;
    document.getElementById(
      "PanelUI-fxa-menu-monitor-button"
    ).hidden = !gFxaMonitorLoginUrl;
    // If there are no services left, remove the label and sep.
    let hideSvcs = !gFxaSendLoginUrl && !gFxaMonitorLoginUrl;
    document.getElementById("fxa-menu-service-separator").hidden = hideSvcs;
    document.getElementById("fxa-menu-service-label").hidden = hideSvcs;
  } else {
    mainWindowEl.removeAttribute("fxatoolbarmenu");
  }
}
#endif

function UpdateBackForwardCommands(aWebNavigation) {
__L_V__2({
    lN: 745,tT:'func',pr:'',eT:{'aWebNavigation':aWebNavigation},fN:'UpdateBackForwardCommands'
  });'__L_V__2';
  var backCommand = document.getElementById("Browser:Back");
  var forwardCommand = document.getElementById("Browser:Forward");

  // Avoid setting attributes on commands if the value hasn't changed!
  // Remember, guys, setting attributes on elements is expensive!  They
  // get inherited into anonymous content, broadcast to other widgets, etc.!
  // Don't do it if the value hasn't changed! - dwh

  var backDisabled = backCommand.hasAttribute("disabled");
  var forwardDisabled = forwardCommand.hasAttribute("disabled");
  if (backDisabled == aWebNavigation.canGoBack) {
__L_V__2({
    lN: 756,tT:'if',pr:'backDisabled == aWebNavigation.canGoBack',eT:{},fN:''
  });'__L_V__2';
    if (backDisabled) {
__L_V__2({
    lN: 757,tT:'if',pr:'backDisabled',eT:{},fN:''
  });'__L_V__2';
      backCommand.removeAttribute("disabled");
    } else {
      backCommand.setAttribute("disabled", true);
    }
  }

  if (forwardDisabled == aWebNavigation.canGoForward) {
__L_V__2({
    lN: 764,tT:'if',pr:'forwardDisabled == aWebNavigation.canGoForward',eT:{},fN:''
  });'__L_V__2';
    if (forwardDisabled) {
__L_V__2({
    lN: 765,tT:'if',pr:'forwardDisabled',eT:{},fN:''
  });'__L_V__2';
      forwardCommand.removeAttribute("disabled");
    } else {
      forwardCommand.setAttribute("disabled", true);
    }
  }
}

/**
 * Click-and-Hold implementation for the Back and Forward buttons
 * XXXmano: should this live in toolbarbutton.js?
 */
function SetClickAndHoldHandlers() {
__L_V__2({
    lN: 777,tT:'func',pr:'',eT:{},fN:'SetClickAndHoldHandlers'
  });'__L_V__2';
  // Bug 414797: Clone the back/forward buttons' context menu into both buttons.
  let popup = document.getElementById("backForwardMenu").cloneNode(true);
  popup.removeAttribute("id");
  // Prevent the back/forward buttons' context attributes from being inherited.
  popup.setAttribute("context", "");

  let backButton = document.getElementById("back-button");
  backButton.setAttribute("type", "menu");
  backButton.prepend(popup);
  gClickAndHoldListenersOnElement.add(backButton);

  let forwardButton = document.getElementById("forward-button");
  popup = popup.cloneNode(true);
  forwardButton.setAttribute("type", "menu");
  forwardButton.prepend(popup);
  gClickAndHoldListenersOnElement.add(forwardButton);
}

const gClickAndHoldListenersOnElement = {
  _timers: new Map(),

  _mousedownHandler(aEvent) {
__L_V__2({
    lN: 799,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_mousedownHandler'
  });'__L_V__2';
    if (
      aEvent.button != 0 ||
      aEvent.currentTarget.open ||
      aEvent.currentTarget.disabled
    ) {
__L_V__2({
    lN: 804,tT:'if',pr:' aEvent.button != 0 || aEvent.currentTarget.open || aEvent.currentTarget.disabled ',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // Prevent the menupopup from opening immediately
    aEvent.currentTarget.menupopup.hidden = true;

    aEvent.currentTarget.addEventListener("mouseout", this);
    aEvent.currentTarget.addEventListener("mouseup", this);
    this._timers.set(
      aEvent.currentTarget,
      setTimeout(b => this._openMenu(b), 500, aEvent.currentTarget)
    );
  },

  _clickHandler(aEvent) {
__L_V__2({
    lN: 819,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_clickHandler'
  });'__L_V__2';
    if (
      aEvent.button == 0 &&
      aEvent.target == aEvent.currentTarget &&
      !aEvent.currentTarget.open &&
      !aEvent.currentTarget.disabled
    ) {
__L_V__2({
    lN: 825,tT:'if',pr:' aEvent.button == 0 && aEvent.target == aEvent.currentTarget && !aEvent.currentTarget.open && !aEvent.currentTarget.disabled ',eT:{},fN:''
  });'__L_V__2';
      let cmdEvent = document.createEvent("xulcommandevent");
      cmdEvent.initCommandEvent(
        "command",
        true,
        true,
        window,
        0,
        aEvent.ctrlKey,
        aEvent.altKey,
        aEvent.shiftKey,
        aEvent.metaKey,
        null,
        aEvent.mozInputSource
      );
      aEvent.currentTarget.dispatchEvent(cmdEvent);

      // This is here to cancel the XUL default event
      // dom.click() triggers a command even if there is a click handler
      // however this can now be prevented with preventDefault().
      aEvent.preventDefault();
    }
  },

  _openMenu(aButton) {
__L_V__2({
    lN: 849,tT:'func',pr:'',eT:{'aButton':aButton},fN:'_openMenu'
  });'__L_V__2';
    this._cancelHold(aButton);
    aButton.firstElementChild.hidden = false;
    aButton.open = true;
  },

  _mouseoutHandler(aEvent) {
__L_V__2({
    lN: 855,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_mouseoutHandler'
  });'__L_V__2';
    let buttonRect = aEvent.currentTarget.getBoundingClientRect();
    if (
      aEvent.clientX >= buttonRect.left &&
      aEvent.clientX <= buttonRect.right &&
      aEvent.clientY >= buttonRect.bottom
    ) {
__L_V__2({
    lN: 861,tT:'if',pr:' aEvent.clientX >= buttonRect.left && aEvent.clientX <= buttonRect.right && aEvent.clientY >= buttonRect.bottom ',eT:{},fN:''
  });'__L_V__2';
      this._openMenu(aEvent.currentTarget);
    } else {
      this._cancelHold(aEvent.currentTarget);
    }
  },

  _mouseupHandler(aEvent) {
__L_V__2({
    lN: 868,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_mouseupHandler'
  });'__L_V__2';
    this._cancelHold(aEvent.currentTarget);
  },

  _cancelHold(aButton) {
__L_V__2({
    lN: 872,tT:'func',pr:'',eT:{'aButton':aButton},fN:'_cancelHold'
  });'__L_V__2';
    clearTimeout(this._timers.get(aButton));
    aButton.removeEventListener("mouseout", this);
    aButton.removeEventListener("mouseup", this);
  },

  _keypressHandler(aEvent) {
__L_V__2({
    lN: 878,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_keypressHandler'
  });'__L_V__2';
    if (aEvent.key == " " || aEvent.key == "Enter") {
__L_V__2({
    lN: 879,tT:'if',pr:'aEvent.key == || aEvent.key == Enter',eT:{},fN:''
  });'__L_V__2';
      // Normally, command events get fired for keyboard activation. However,
      // we've set type="menu", so that doesn't happen. Handle this the same
      // way we handle clicks.
      aEvent.target.click();
    }
  },

  handleEvent(e) {
__L_V__2({
    lN: 887,tT:'func',pr:'',eT:{'e':e},fN:'handleEvent'
  });'__L_V__2';
__L_V__2({
    lN: 888,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
    switch (e.type) {
      case "mouseout":
        this._mouseoutHandler(e);
        break;
      case "mousedown":
        this._mousedownHandler(e);
        break;
      case "click":
        this._clickHandler(e);
        break;
      case "mouseup":
        this._mouseupHandler(e);
        break;
      case "keypress":
        this._keypressHandler(e);
        break;
    }
  },

  remove(aButton) {
__L_V__2({
    lN: 907,tT:'func',pr:'',eT:{'aButton':aButton},fN:'remove'
  });'__L_V__2';
    aButton.removeEventListener("mousedown", this, true);
    aButton.removeEventListener("click", this, true);
    aButton.removeEventListener("keypress", this, true);
  },

  add(aElm) {
__L_V__2({
    lN: 913,tT:'func',pr:'',eT:{'aElm':aElm},fN:'add'
  });'__L_V__2';
    this._timers.delete(aElm);

    aElm.addEventListener("mousedown", this, true);
    aElm.addEventListener("click", this, true);
    aElm.addEventListener("keypress", this, true);
  },
};

const gSessionHistoryObserver = {
  observe(subject, topic, data) {
__L_V__2({
    lN: 923,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    if (topic != "browser:purge-session-history") {
__L_V__2({
    lN: 924,tT:'if',pr:'topic != browser:purge-session-history',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    var backCommand = document.getElementById("Browser:Back");
    backCommand.setAttribute("disabled", "true");
    var fwdCommand = document.getElementById("Browser:Forward");
    fwdCommand.setAttribute("disabled", "true");

    // Clear undo history of the URL bar
    gURLBar.editor.transactionManager.clear();
  },
};

const gStoragePressureObserver = {
  _lastNotificationTime: -1,

  async observe(subject, topic, data) {
__L_V__2({
    lN: 941,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    if (topic != "QuotaManager::StoragePressure") {
__L_V__2({
    lN: 942,tT:'if',pr:'topic != QuotaManager::StoragePressure',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    const NOTIFICATION_VALUE = "storage-pressure-notification";
    if (
      gHighPriorityNotificationBox.getNotificationWithValue(NOTIFICATION_VALUE)
    ) {
__L_V__2({
    lN: 949,tT:'if',pr:' gHighPriorityNotificationBox.getNotificationWithValue(NOTIFICATION_VALUE) ',eT:{},fN:''
  });'__L_V__2';
      // Do not display the 2nd notification when there is already one
      return;
    }

    // Don't display notification twice within the given interval.
    // This is because
    //   - not to annoy user
    //   - give user some time to clean space.
    //     Even user sees notification and starts acting, it still takes some time.
    const MIN_NOTIFICATION_INTERVAL_MS = Services.prefs.getIntPref(
      "browser.storageManager.pressureNotification.minIntervalMS"
    );
    let duration = Date.now() - this._lastNotificationTime;
    if (duration <= MIN_NOTIFICATION_INTERVAL_MS) {
__L_V__2({
    lN: 963,tT:'if',pr:'duration <= MIN_NOTIFICATION_INTERVAL_MS',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    this._lastNotificationTime = Date.now();

    MozXULElement.insertFTLIfNeeded("branding/brand.ftl");
    MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");

    const BYTES_IN_GIGABYTE = 1073741824;
    const USAGE_THRESHOLD_BYTES =
      BYTES_IN_GIGABYTE *
      Services.prefs.getIntPref(
        "browser.storageManager.pressureNotification.usageThresholdGB"
      );
    let msg = "";
    let buttons = [];
    let usage = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
    buttons.push({
      "l10n-id": "space-alert-learn-more-button",
      callback(notificationBar, button) {
__L_V__2({
    lN: 982,tT:'func',pr:'',eT:{'notificationBar':notificationBar,'button':button},fN:'callback'
  });'__L_V__2';
        let learnMoreURL =
          Services.urlFormatter.formatURLPref("app.support.baseURL") +
          "storage-permissions";
        // This is a content URL, loaded from trusted UX.
        openTrustedLinkIn(learnMoreURL, "tab");
      },
    });
    if (usage < USAGE_THRESHOLD_BYTES) {
__L_V__2({
    lN: 990,tT:'if',pr:'usage < USAGE_THRESHOLD_BYTES',eT:{},fN:''
  });'__L_V__2';
      // The firefox-used space < 5GB, then warn user to free some disk space.
      // This is because this usage is small and not the main cause for space issue.
      // In order to avoid the bad and wrong impression among users that
      // firefox eats disk space a lot, indicate users to clean up other disk space.
      [msg] = await document.l10n.formatValues([
        { id: "space-alert-under-5gb-message" },
      ]);
      buttons.push({
        "l10n-id": "space-alert-under-5gb-ok-button",
        callback() {
__L_V__2({
    lN: 1000,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';},
      });
    } else {
      // The firefox-used space >= 5GB, then guide users to about:preferences
      // to clear some data stored on firefox by websites.
      [msg] = await document.l10n.formatValues([
        { id: "space-alert-over-5gb-message" },
      ]);
      buttons.push({
        "l10n-id": "space-alert-over-5gb-pref-button",
        callback(notificationBar, button) {
__L_V__2({
    lN: 1010,tT:'func',pr:'',eT:{'notificationBar':notificationBar,'button':button},fN:'callback'
  });'__L_V__2';
          // The advanced subpanes are only supported in the old organization, which will
          // be removed by bug 1349689.
          openPreferences("privacy-sitedata");
        },
      });
    }

    gHighPriorityNotificationBox.appendNotification(
      msg,
      NOTIFICATION_VALUE,
      null,
      gHighPriorityNotificationBox.PRIORITY_WARNING_HIGH,
      buttons,
      null
    );

    // This seems to be necessary to get the buttons to display correctly
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1504216
    document.l10n.translateFragment(
      gHighPriorityNotificationBox.currentNotification
    );
  },
};

var gPopupBlockerObserver = {
  handleEvent(aEvent) {
__L_V__2({
    lN: 1036,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'handleEvent'
  });'__L_V__2';
    if (aEvent.originalTarget != gBrowser.selectedBrowser) {
__L_V__2({
    lN: 1037,tT:'if',pr:'aEvent.originalTarget != gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    gIdentityHandler.refreshIdentityBlock();

    let popupCount = gBrowser.selectedBrowser.popupBlocker.getBlockedPopupCount();

    if (!popupCount) {
__L_V__2({
    lN: 1045,tT:'if',pr:'!popupCount',eT:{},fN:''
  });'__L_V__2';
      // Hide the notification box (if it's visible).
      let notificationBox = gBrowser.getNotificationBox();
      let notification = notificationBox.getNotificationWithValue(
        "popup-blocked"
      );
      if (notification) {
__L_V__2({
    lN: 1051,tT:'if',pr:'notification',eT:{},fN:''
  });'__L_V__2';
        notificationBox.removeNotification(notification, false);
      }
      return;
    }

    // Only show the notification again if we've not already shown it. Since
    // notifications are per-browser, we don't need to worry about re-adding
    // it.
    if (gBrowser.selectedBrowser.popupBlocker.shouldShowNotification) {
__L_V__2({
    lN: 1060,tT:'if',pr:'gBrowser.selectedBrowser.popupBlocker.shouldShowNotification',eT:{},fN:''
  });'__L_V__2';
      if (Services.prefs.getBoolPref("privacy.popups.showBrowserMessage")) {
__L_V__2({
    lN: 1061,tT:'if',pr:'Services.prefs.getBoolPref(privacy.popups.showBrowserMessage)',eT:{},fN:''
  });'__L_V__2';
        var brandBundle = document.getElementById("bundle_brand");
        var brandShortName = brandBundle.getString("brandShortName");

        var stringKey =
          AppConstants.platform == "win"
            ? "popupWarningButton"
            : "popupWarningButtonUnix";

        var popupButtonText = gNavigatorBundle.getString(stringKey);
        var popupButtonAccesskey = gNavigatorBundle.getString(
          stringKey + ".accesskey"
        );

        let messageBase;
        if (popupCount < this.maxReportedPopups) {
__L_V__2({
    lN: 1076,tT:'if',pr:'popupCount < this.maxReportedPopups',eT:{},fN:''
  });'__L_V__2';
          messageBase = gNavigatorBundle.getString("popupWarning.message");
        } else {
          messageBase = gNavigatorBundle.getString(
            "popupWarning.exceeded.message"
          );
        }

        var message = PluralForm.get(popupCount, messageBase)
          .replace("#1", brandShortName)
          .replace("#2", popupCount);

        let notificationBox = gBrowser.getNotificationBox();
        let notification = notificationBox.getNotificationWithValue(
          "popup-blocked"
        );
        if (notification) {
__L_V__2({
    lN: 1092,tT:'if',pr:'notification',eT:{},fN:''
  });'__L_V__2';
          notification.label = message;
        } else {
          var buttons = [
            {
              label: popupButtonText,
              accessKey: popupButtonAccesskey,
              popup: "blockedPopupOptions",
              callback: null,
            },
          ];

          const priority = notificationBox.PRIORITY_WARNING_MEDIUM;
          notificationBox.appendNotification(
            message,
            "popup-blocked",
            "chrome://browser/skin/notification-icons/popup.svg",
            priority,
            buttons
          );
        }
      }

      // Record the fact that we've reported this blocked popup, so we don't
      // show it again.
      gBrowser.selectedBrowser.popupBlocker.didShowNotification();
    }
  },

  toggleAllowPopupsForSite(aEvent) {
__L_V__2({
    lN: 1121,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'toggleAllowPopupsForSite'
  });'__L_V__2';
    var pm = Services.perms;
    var shouldBlock = aEvent.target.getAttribute("block") == "true";
    var perm = shouldBlock ? pm.DENY_ACTION : pm.ALLOW_ACTION;
    pm.addFromPrincipal(gBrowser.contentPrincipal, "popup", perm);

    if (!shouldBlock) {
__L_V__2({
    lN: 1127,tT:'if',pr:'!shouldBlock',eT:{},fN:''
  });'__L_V__2';
      gBrowser.selectedBrowser.popupBlocker.unblockAllPopups();
    }

    gBrowser.getNotificationBox().removeCurrentNotification();
  },

  fillPopupList(aEvent) {
__L_V__2({
    lN: 1134,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'fillPopupList'
  });'__L_V__2';
    // XXXben - rather than using |currentURI| here, which breaks down on multi-framed sites
    //          we should really walk the blockedPopups and create a list of "allow for <host>"
    //          menuitems for the common subset of hosts present in the report, this will
    //          make us frame-safe.
    //
    // XXXjst - Note that when this is fixed to work with multi-framed sites,
    //          also back out the fix for bug 343772 where
    //          nsGlobalWindow::CheckOpenAllow() was changed to also
    //          check if the top window's location is whitelisted.
    let browser = gBrowser.selectedBrowser;
    var uri = browser.contentPrincipal.URI || browser.currentURI;
    var blockedPopupAllowSite = document.getElementById(
      "blockedPopupAllowSite"
    );
    try {
      blockedPopupAllowSite.removeAttribute("hidden");
      let uriHost = uri.asciiHost ? uri.host : uri.spec;
      var pm = Services.perms;
      if (
        pm.testPermissionFromPrincipal(browser.contentPrincipal, "popup") ==
        pm.ALLOW_ACTION
      ) {
__L_V__2({
    lN: 1156,tT:'if',pr:' pm.testPermissionFromPrincipal(browser.contentPrincipal, popup) == pm.ALLOW_ACTION ',eT:{},fN:''
  });'__L_V__2';
        // Offer an item to block popups for this site, if a whitelist entry exists
        // already for it.
        let blockString = gNavigatorBundle.getFormattedString("popupBlock", [
          uriHost,
        ]);
        blockedPopupAllowSite.setAttribute("label", blockString);
        blockedPopupAllowSite.setAttribute("block", "true");
      } else {
        // Offer an item to allow popups for this site
        let allowString = gNavigatorBundle.getFormattedString("popupAllow", [
          uriHost,
        ]);
        blockedPopupAllowSite.setAttribute("label", allowString);
        blockedPopupAllowSite.removeAttribute("block");
      }
    } catch (e) {
      blockedPopupAllowSite.setAttribute("hidden", "true");
    }

    if (PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 1176,tT:'if',pr:'PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
      blockedPopupAllowSite.setAttribute("disabled", "true");
    } else {
      blockedPopupAllowSite.removeAttribute("disabled");
    }

    let blockedPopupDontShowMessage = document.getElementById(
      "blockedPopupDontShowMessage"
    );
    let showMessage = Services.prefs.getBoolPref(
      "privacy.popups.showBrowserMessage"
    );
    blockedPopupDontShowMessage.setAttribute("checked", !showMessage);
    blockedPopupDontShowMessage.setAttribute(
      "label",
      gNavigatorBundle.getString("popupWarningDontShowFromMessage")
    );

    let blockedPopupsSeparator = document.getElementById(
      "blockedPopupsSeparator"
    );
    blockedPopupsSeparator.setAttribute("hidden", true);

    browser.popupBlocker.getBlockedPopups().then(blockedPopups => {
      let foundUsablePopupURI = false;
      if (blockedPopups) {
__L_V__2({
    lN: 1201,tT:'if',pr:'blockedPopups',eT:{},fN:''
  });'__L_V__2';
        for (let i = 0; i < blockedPopups.length; i++) {
          let blockedPopup = blockedPopups[i];

          // popupWindowURI will be null if the file picker popup is blocked.
          // xxxdz this should make the option say "Show file picker" and do it (Bug 590306)
          if (!blockedPopup.popupWindowURISpec) {
__L_V__2({
    lN: 1207,tT:'if',pr:'!blockedPopup.popupWindowURISpec',eT:{},fN:''
  });'__L_V__2';
            continue;
          }

          var popupURIspec = blockedPopup.popupWindowURISpec;

          // Sometimes the popup URI that we get back from the blockedPopup
          // isn't useful (for instance, netscape.com's popup URI ends up
          // being "http://www.netscape.com", which isn't really the URI of
          // the popup they're trying to show).  This isn't going to be
          // useful to the user, so we won't create a menu item for it.
          if (
            popupURIspec == "" ||
            popupURIspec == "about:blank" ||
            popupURIspec == "<self>" ||
            popupURIspec == uri.spec
          ) {
__L_V__2({
    lN: 1223,tT:'if',pr:' popupURIspec == || popupURIspec == about:blank || popupURIspec == <self> || popupURIspec == uri.spec ',eT:{},fN:''
  });'__L_V__2';
            continue;
          }

          // Because of the short-circuit above, we may end up in a situation
          // in which we don't have any usable popup addresses to show in
          // the menu, and therefore we shouldn't show the separator.  However,
          // since we got past the short-circuit, we must've found at least
          // one usable popup URI and thus we'll turn on the separator later.
          foundUsablePopupURI = true;

          var menuitem = document.createXULElement("menuitem");
          var label = gNavigatorBundle.getFormattedString(
            "popupShowPopupPrefix",
            [popupURIspec]
          );
          menuitem.setAttribute("label", label);
          menuitem.setAttribute(
            "oncommand",
            "gPopupBlockerObserver.showBlockedPopup(event);"
          );
          menuitem.setAttribute("popupReportIndex", i);
          menuitem.setAttribute(
            "popupInnerWindowId",
            blockedPopup.innerWindowId
          );
          menuitem.browsingContext = blockedPopup.browsingContext;
          menuitem.popupReportBrowser = browser;
          aEvent.target.appendChild(menuitem);
        }
      }

      // Show the separator if we added any
      // showable popup addresses to the menu.
      if (foundUsablePopupURI) {
__L_V__2({
    lN: 1257,tT:'if',pr:'foundUsablePopupURI',eT:{},fN:''
  });'__L_V__2';
        blockedPopupsSeparator.removeAttribute("hidden");
      }
    }, null);
  },

  onPopupHiding(aEvent) {
__L_V__2({
    lN: 1263,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onPopupHiding'
  });'__L_V__2';
    let item = aEvent.target.lastElementChild;
    while (item && item.id != "blockedPopupsSeparator") {
      let next = item.previousElementSibling;
      item.remove();
      item = next;
    }
  },

  showBlockedPopup(aEvent) {
__L_V__2({
    lN: 1272,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'showBlockedPopup'
  });'__L_V__2';
    let target = aEvent.target;
    let browsingContext = target.browsingContext;
    let innerWindowId = target.getAttribute("popupInnerWindowId");
    let popupReportIndex = target.getAttribute("popupReportIndex");
    let browser = target.popupReportBrowser;
    browser.popupBlocker.unblockPopup(
      browsingContext,
      innerWindowId,
      popupReportIndex
    );
  },

  editPopupSettings() {
__L_V__2({
    lN: 1285,tT:'func',pr:'',eT:{},fN:'editPopupSettings'
  });'__L_V__2';
    openPreferences("privacy-permissions-block-popups");
  },

  dontShowMessage() {
__L_V__2({
    lN: 1289,tT:'func',pr:'',eT:{},fN:'dontShowMessage'
  });'__L_V__2';
    var showMessage = Services.prefs.getBoolPref(
      "privacy.popups.showBrowserMessage"
    );
    Services.prefs.setBoolPref(
      "privacy.popups.showBrowserMessage",
      !showMessage
    );
    gBrowser.getNotificationBox().removeCurrentNotification();
  },
};

XPCOMUtils.defineLazyPreferenceGetter(
  gPopupBlockerObserver,
  "maxReportedPopups",
  "privacy.popups.maxReported"
);

function doURIFixup(browser, fixupInfo) {
__L_V__2({
    lN: 1307,tT:'func',pr:'',eT:{'browser':browser,'fixupInfo':fixupInfo},fN:'doURIFixup'
  });'__L_V__2';
  // We get called irrespective of whether we did a keyword search, or
  // whether the original input would be vaguely interpretable as a URL,
  // so figure that out first.
  let alternativeURI = fixupInfo.fixedURI;
  if (
    !fixupInfo.keywordProviderName ||
    !alternativeURI ||
    !alternativeURI.host
  ) {
__L_V__2({
    lN: 1316,tT:'if',pr:' !fixupInfo.keywordProviderName || !alternativeURI || !alternativeURI.host ',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  let contentPrincipal = browser.contentPrincipal;

  // At this point we're still only just about to load this URI.
  // When the async DNS lookup comes back, we may be in any of these states:
  // 1) still on the previous URI, waiting for the preferredURI (keyword
  //    search) to respond;
  // 2) at the keyword search URI (preferredURI)
  // 3) at some other page because the user stopped navigation.
  // We keep track of the currentURI to detect case (1) in the DNS lookup
  // callback.
  let previousURI = browser.currentURI;
  let preferredURI = fixupInfo.preferredURI;

  // now swap for a weak ref so we don't hang on to browser needlessly
  // even if the DNS query takes forever
  let weakBrowser = Cu.getWeakReference(browser);
  browser = null;

  // Additionally, we need the host of the parsed url
  let hostName = alternativeURI.displayHost;
  // and the ascii-only host for the pref:
  let asciiHost = alternativeURI.asciiHost;
  // Normalize out a single trailing dot - NB: not using endsWith/lastIndexOf
  // because we need to be sure this last dot is the *only* dot, too.
  // More generally, this is used for the pref and should stay in sync with
  // the code in nsDefaultURIFixup::KeywordURIFixup .
  if (asciiHost.indexOf(".") == asciiHost.length - 1) {
__L_V__2({
    lN: 1346,tT:'if',pr:'asciiHost.indexOf(.) == asciiHost.length - 1',eT:{},fN:''
  });'__L_V__2';
    asciiHost = asciiHost.slice(0, -1);
  }

  let isIPv4Address = host => {
    let parts = host.split(".");
    if (parts.length != 4) {
__L_V__2({
    lN: 1352,tT:'if',pr:'parts.length != 4',eT:{},fN:''
  });'__L_V__2';
      return false;
    }
    return parts.every(part => {
      let n = parseInt(part, 10);
      return n >= 0 && n <= 255;
    });
  };
  // Avoid showing fixup information if we're suggesting an IP. Note that
  // decimal representations of IPs are normalized to a 'regular'
  // dot-separated IP address by network code, but that only happens for
  // numbers that don't overflow. Longer numbers do not get normalized,
  // but still work to access IP addresses. So for instance,
  // 1097347366913 (ff7f000001) gets resolved by using the final bytes,
  // making it the same as 7f000001, which is 127.0.0.1 aka localhost.
  // While 2130706433 would get normalized by network, 1097347366913
  // does not, and we have to deal with both cases here:
  if (isIPv4Address(asciiHost) || /^(?:\d+|0x[a-f0-9]+)$/i.test(asciiHost)) {
__L_V__2({
    lN: 1369,tT:'if',pr:'isIPv4Address(asciiHost) || /^(?:\d+|0x[a-f0-9]+)$/i.test(asciiHost)',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  let onLookupCompleteListener = {
    onLookupComplete(request, record, status) {
__L_V__2({
    lN: 1374,tT:'func',pr:'',eT:{'request':request,'record':record,'status':status},fN:'onLookupComplete'
  });'__L_V__2';
      let browserRef = weakBrowser.get();
      if (!Components.isSuccessCode(status) || !browserRef) {
__L_V__2({
    lN: 1376,tT:'if',pr:'!Components.isSuccessCode(status) || !browserRef',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      let currentURI = browserRef.currentURI;
      // If we're in case (3) (see above), don't show an info bar.
      if (!currentURI.equals(previousURI) && !currentURI.equals(preferredURI)) {
__L_V__2({
    lN: 1382,tT:'if',pr:'!currentURI.equals(previousURI) && !currentURI.equals(preferredURI)',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      // show infobar offering to visit the host
      let notificationBox = gBrowser.getNotificationBox(browserRef);
      if (notificationBox.getNotificationWithValue("keyword-uri-fixup")) {
__L_V__2({
    lN: 1388,tT:'if',pr:'notificationBox.getNotificationWithValue(keyword-uri-fixup)',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      let message = gNavigatorBundle.getFormattedString(
        "keywordURIFixup.message",
        [hostName]
      );
      let yesMessage = gNavigatorBundle.getFormattedString(
        "keywordURIFixup.goTo",
        [hostName]
      );

      let buttons = [
        {
          label: yesMessage,
          accessKey: gNavigatorBundle.getString(
            "keywordURIFixup.goTo.accesskey"
          ),
          callback() {
__L_V__2({
    lN: 1407,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
            // Do not set this preference while in private browsing.
            if (!PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 1409,tT:'if',pr:'!PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
              let pref = "browser.fixup.domainwhitelist." + asciiHost;
              Services.prefs.setBoolPref(pref, true);
            }
            openTrustedLinkIn(alternativeURI.spec, "current");
          },
        },
        {
          label: gNavigatorBundle.getString("keywordURIFixup.dismiss"),
          accessKey: gNavigatorBundle.getString(
            "keywordURIFixup.dismiss.accesskey"
          ),
          callback() {
__L_V__2({
    lN: 1421,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
            let notification = notificationBox.getNotificationWithValue(
              "keyword-uri-fixup"
            );
            notificationBox.removeNotification(notification, true);
          },
        },
      ];
      let notification = notificationBox.appendNotification(
        message,
        "keyword-uri-fixup",
        null,
        notificationBox.PRIORITY_INFO_HIGH,
        buttons
      );
      notification.persistence = 1;
    },
  };

  try {
    gDNSService.asyncResolve(
      hostName,
      0,
      onLookupCompleteListener,
      Services.tm.mainThread,
      contentPrincipal.originAttributes
    );
  } catch (ex) {
    // Do nothing if the URL is invalid (we don't want to show a notification in that case).
    if (ex.result != Cr.NS_ERROR_UNKNOWN_HOST) {
__L_V__2({
    lN: 1450,tT:'if',pr:'ex.result != Cr.NS_ERROR_UNKNOWN_HOST',eT:{},fN:''
  });'__L_V__2';
      // ... otherwise, report:
      Cu.reportError(ex);
    }
  }
}

function gKeywordURIFixupObs(fixupInfo, topic, data) {
__L_V__2({
    lN: 1457,tT:'func',pr:'',eT:{'fixupInfo':fixupInfo,'topic':topic,'data':data},fN:'gKeywordURIFixupObs'
  });'__L_V__2';
  fixupInfo.QueryInterface(Ci.nsIURIFixupInfo);

  if (!fixupInfo.consumer || fixupInfo.consumer.ownerGlobal != window) {
__L_V__2({
    lN: 1460,tT:'if',pr:'!fixupInfo.consumer || fixupInfo.consumer.ownerGlobal != window',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  doURIFixup(fixupInfo.consumer, {
    fixedURI: fixupInfo.fixedURI,
    keywordProviderName: fixupInfo.keywordProviderName,
    preferredURI: fixupInfo.preferredURI,
  });
}

function gKeywordURIFixup({ target: browser, data: fixupInfo }) {
__L_V__2({
    lN: 1471,tT:'func',pr:'',eT:{'browser':browser,'fixupInfo':fixupInfo},fN:'gKeywordURIFixup'
  });'__L_V__2';
  let deserializeURI = url => {
    if (url instanceof Ci.nsIURI) {
__L_V__2({
    lN: 1473,tT:'if',pr:'url instanceof Ci.nsIURI',eT:{},fN:''
  });'__L_V__2';
      return url;
    }
    return url ? makeURI(url) : null;
  };

  doURIFixup(browser, {
    fixedURI: deserializeURI(fixupInfo.fixedURI),
    keywordProviderName: fixupInfo.keywordProviderName,
    preferredURI: deserializeURI(fixupInfo.preferredURI),
  });
}

function serializeInputStream(aStream) {
__L_V__2({
    lN: 1486,tT:'func',pr:'',eT:{'aStream':aStream},fN:'serializeInputStream'
  });'__L_V__2';
  let data = {
    content: NetUtil.readInputStreamToString(aStream, aStream.available()),
  };

  if (aStream instanceof Ci.nsIMIMEInputStream) {
__L_V__2({
    lN: 1491,tT:'if',pr:'aStream instanceof Ci.nsIMIMEInputStream',eT:{},fN:''
  });'__L_V__2';
    data.headers = new Map();
    aStream.visitHeaders((name, value) => {
      data.headers.set(name, value);
    });
  }

  return data;
}

/**
 * Handles URIs when we want to deal with them in chrome code rather than pass
 * them down to a content browser. This can avoid unnecessary process switching
 * for the browser.
 * @param aBrowser the browser that is attempting to load the URI
 * @param aUri the nsIURI that is being loaded
 * @returns true if the URI is handled, otherwise false
 */
function handleUriInChrome(aBrowser, aUri) {
__L_V__2({
    lN: 1509,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aUri':aUri},fN:'handleUriInChrome'
  });'__L_V__2';
  if (aUri.scheme == "file") {
__L_V__2({
    lN: 1510,tT:'if',pr:'aUri.scheme == file',eT:{},fN:''
  });'__L_V__2';
    try {
      let mimeType = Cc["@mozilla.org/mime;1"]
        .getService(Ci.nsIMIMEService)
        .getTypeFromURI(aUri);
      if (mimeType == "application/x-xpinstall") {
__L_V__2({
    lN: 1515,tT:'if',pr:'mimeType == application/x-xpinstall',eT:{},fN:''
  });'__L_V__2';
        let systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
        AddonManager.getInstallForURL(aUri.spec, {
          telemetryInfo: { source: "file-url" },
        }).then(install => {
          AddonManager.installAddonFromWebpage(
            mimeType,
            aBrowser,
            systemPrincipal,
            install
          );
        });
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  return false;
}

/* Creates a null principal using the userContextId
   from the current selected tab or a passed in tab argument */
function _createNullPrincipalFromTabUserContextId(tab = gBrowser.selectedTab) {
__L_V__2({
    lN: 1539,tT:'func',pr:'',eT:{'tab':tab},fN:'_createNullPrincipalFromTabUserContextId'
  });'__L_V__2';
  let userContextId;
  if (tab.hasAttribute("usercontextid")) {
__L_V__2({
    lN: 1541,tT:'if',pr:'tab.hasAttribute(usercontextid)',eT:{},fN:''
  });'__L_V__2';
    userContextId = tab.getAttribute("usercontextid");
  }
  return Services.scriptSecurityManager.createNullPrincipal({
    userContextId,
  });
}

// A shared function used by both remote and non-remote browser XBL bindings to
// load a URI or redirect it to the correct process.
function _loadURI(browser, uri, params = {}) {
__L_V__2({
    lN: 1551,tT:'func',pr:'',eT:{'browser':browser,'uri':uri,'params':params},fN:'_loadURI'
  });'__L_V__2';
  if (!uri) {
__L_V__2({
    lN: 1552,tT:'if',pr:'!uri',eT:{},fN:''
  });'__L_V__2';
    uri = "about:blank";
  }

  let { triggeringPrincipal, referrerInfo, postData, userContextId, csp } =
    params || {};
  let loadFlags =
    params.loadFlags || params.flags || Ci.nsIWebNavigation.LOAD_FLAGS_NONE;

  uri = CliqzResources.matchUrlByString(uri);
  if (CliqzResources.isCliqzPage(uri)) {
__L_V__2({
    lN: 1562,tT:'if',pr:'CliqzResources.isCliqzPage(uri)',eT:{},fN:''
  });'__L_V__2';
    loadFlags = loadFlags | Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY;
  }

  if (!triggeringPrincipal) {
__L_V__2({
    lN: 1566,tT:'if',pr:'!triggeringPrincipal',eT:{},fN:''
  });'__L_V__2';
    throw new Error("Must load with a triggering Principal");
  }

  let {
    uriObject,
    requiredRemoteType,
    mustChangeProcess,
    newFrameloader,
  } = E10SUtils.shouldLoadURIInBrowser(
    browser,
    uri,
    gMultiProcessBrowser,
    gFissionBrowser,
    loadFlags
  );

  if (uriObject && handleUriInChrome(browser, uriObject)) {
__L_V__2({
    lN: 1583,tT:'if',pr:'uriObject && handleUriInChrome(browser, uriObject)',eT:{},fN:''
  });'__L_V__2';
    // If we've handled the URI in Chrome then just return here.
    return;
  }
  if (newFrameloader) {
__L_V__2({
    lN: 1587,tT:'if',pr:'newFrameloader',eT:{},fN:''
  });'__L_V__2';
    // If a new frameloader is needed for process reselection because this used
    // to be a preloaded browser, clear the preloaded state now.
    browser.removeAttribute("preloadedState");
  }

  // !requiredRemoteType means we're loading in the parent/this process.
  if (!requiredRemoteType) {
__L_V__2({
    lN: 1594,tT:'if',pr:'!requiredRemoteType',eT:{},fN:''
  });'__L_V__2';
    browser.isNavigating = true;
  }
  let loadURIOptions = {
    triggeringPrincipal,
    csp,
    loadFlags,
    referrerInfo,
    postData,
  };
  try {
    if (!mustChangeProcess) {
__L_V__2({
    lN: 1605,tT:'if',pr:'!mustChangeProcess',eT:{},fN:''
  });'__L_V__2';
      if (userContextId) {
__L_V__2({
    lN: 1606,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__2';
        browser.webNavigation.setOriginAttributesBeforeLoading({
          userContextId,
          privateBrowsingId: PrivateBrowsingUtils.isBrowserPrivate(browser)
            ? 1
            : 0,
        });
      }
      browser.webNavigation.loadURI(uri, loadURIOptions);
    } else {
      // Check if the current browser is allowed to unload.
      let { permitUnload, timedOut } = browser.permitUnload();
      if (!timedOut && !permitUnload) {
__L_V__2({
    lN: 1618,tT:'if',pr:'!timedOut && !permitUnload',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      if (postData) {
__L_V__2({
    lN: 1622,tT:'if',pr:'postData',eT:{},fN:''
  });'__L_V__2';
        postData = serializeInputStream(postData);
      }

      let loadParams = {
        uri,
        triggeringPrincipal: triggeringPrincipal
          ? E10SUtils.serializePrincipal(triggeringPrincipal)
          : null,
        flags: loadFlags,
        referrerInfo: E10SUtils.serializeReferrerInfo(referrerInfo),
        remoteType: requiredRemoteType,
        postData,
        newFrameloader,
        csp: csp ? gSerializationHelper.serializeToString(csp) : null,
      };

      if (userContextId) {
__L_V__2({
    lN: 1639,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__2';
        loadParams.userContextId = userContextId;
      }

      if (browser.webNavigation.maybeCancelContentJSExecution) {
__L_V__2({
    lN: 1643,tT:'if',pr:'browser.webNavigation.maybeCancelContentJSExecution',eT:{},fN:''
  });'__L_V__2';
        let cancelContentJSEpoch = browser.webNavigation.maybeCancelContentJSExecution(
          Ci.nsIRemoteTab.NAVIGATE_URL,
          { uri: uriObject }
        );
        loadParams.cancelContentJSEpoch = cancelContentJSEpoch;
      }
      LoadInOtherProcess(browser, loadParams);
    }
  } catch (e) {
    // If anything goes wrong when switching remoteness, just switch remoteness
    // manually and load the URI.
    // We might lose history that way but at least the browser loaded a page.
    // This might be necessary if SessionStore wasn't initialized yet i.e.
    // when the homepage is a non-remote page.
    if (mustChangeProcess) {
__L_V__2({
    lN: 1658,tT:'if',pr:'mustChangeProcess',eT:{},fN:''
  });'__L_V__2';
      Cu.reportError(e);
      gBrowser.updateBrowserRemotenessByURL(browser, uri);

      if (userContextId) {
__L_V__2({
    lN: 1662,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__2';
        browser.webNavigation.setOriginAttributesBeforeLoading({
          userContextId,
          privateBrowsingId: PrivateBrowsingUtils.isBrowserPrivate(browser)
            ? 1
            : 0,
        });
      }
      browser.webNavigation.loadURI(uri, loadURIOptions);
    } else {
      throw e;
    }
  } finally {
    if (!requiredRemoteType) {
__L_V__2({
    lN: 1675,tT:'if',pr:'!requiredRemoteType',eT:{},fN:''
  });'__L_V__2';
      browser.isNavigating = false;
    }
  }
}

// Starts a new load in the browser first switching the browser to the correct
// process
function LoadInOtherProcess(browser, loadOptions, historyIndex = -1) {
__L_V__2({
    lN: 1683,tT:'func',pr:'',eT:{'browser':browser,'loadOptions':loadOptions,'historyIndex':historyIndex},fN:'LoadInOtherProcess'
  });'__L_V__2';
  let tab = gBrowser.getTabForBrowser(browser);
  SessionStore.navigateAndRestore(tab, loadOptions, historyIndex);
}

// Called when a docshell has attempted to load a page in an incorrect process.
// This function is responsible for loading the page in the correct process.
function RedirectLoad(browser, data) {
__L_V__2({
    lN: 1690,tT:'func',pr:'',eT:{'browser':browser,'data':data},fN:'RedirectLoad'
  });'__L_V__2';
  if (browser.getAttribute("preloadedState") === "consumed") {
__L_V__2({
    lN: 1691,tT:'if',pr:'browser.getAttribute(preloadedState) === consumed',eT:{},fN:''
  });'__L_V__2';
    browser.removeAttribute("preloadedState");
    data.loadOptions.newFrameloader = true;
  }

  if (data.loadOptions.reloadInFreshProcess) {
__L_V__2({
    lN: 1696,tT:'if',pr:'data.loadOptions.reloadInFreshProcess',eT:{},fN:''
  });'__L_V__2';
    // Convert the fresh process load option into a large allocation remote type
    // to use common processing from this point.
    data.loadOptions.remoteType = E10SUtils.LARGE_ALLOCATION_REMOTE_TYPE;
    data.loadOptions.newFrameloader = true;
  } else if (browser.remoteType == E10SUtils.LARGE_ALLOCATION_REMOTE_TYPE) {
__L_V__2({
    lN: 1701,tT:'if',pr:'browser.remoteType == E10SUtils.LARGE_ALLOCATION_REMOTE_TYPE',eT:{},fN:''
  });'__L_V__2';
    // If we're in a Large-Allocation process, we prefer switching back into a
    // normal content process, as that way we can clean up the L-A process.
    data.loadOptions.remoteType = E10SUtils.getRemoteTypeForURI(
      data.loadOptions.uri,
      gMultiProcessBrowser,
      gFissionBrowser
    );
  }

  // We should only start the redirection if the browser window has finished
  // starting up. Otherwise, we should wait until the startup is done.
  if (gBrowserInit.delayedStartupFinished) {
__L_V__2({
    lN: 1713,tT:'if',pr:'gBrowserInit.delayedStartupFinished',eT:{},fN:''
  });'__L_V__2';
    LoadInOtherProcess(browser, data.loadOptions, data.historyIndex);
  } else {
    let delayedStartupFinished = (subject, topic) => {
      if (topic == "browser-delayed-startup-finished" && subject == window) {
__L_V__2({
    lN: 1717,tT:'if',pr:'topic == browser-delayed-startup-finished && subject == window',eT:{},fN:''
  });'__L_V__2';
        Services.obs.removeObserver(delayedStartupFinished, topic);
        LoadInOtherProcess(browser, data.loadOptions, data.historyIndex);
      }
    };
    Services.obs.addObserver(
      delayedStartupFinished,
      "browser-delayed-startup-finished"
    );
  }
}

let _resolveDelayedStartup;
var delayedStartupPromise = new Promise(resolve => {
  _resolveDelayedStartup = resolve;
});

var gBrowserInit = {
  delayedStartupFinished: false,
  idleTasksFinishedPromise: null,
  idleTaskPromiseResolve: null,

  _tabToAdopt: undefined,

  getTabToAdopt() {
__L_V__2({
    lN: 1741,tT:'func',pr:'',eT:{},fN:'getTabToAdopt'
  });'__L_V__2';
    if (this._tabToAdopt !== undefined) {
__L_V__2({
    lN: 1742,tT:'if',pr:'this._tabToAdopt !== undefined',eT:{},fN:''
  });'__L_V__2';
      return this._tabToAdopt;
    }

    if (window.arguments && window.arguments[0] instanceof window.XULElement) {
__L_V__2({
    lN: 1746,tT:'if',pr:'window.arguments && window.arguments[0] instanceof window.XULElement',eT:{},fN:''
  });'__L_V__2';
      this._tabToAdopt = window.arguments[0];

      // Clear the reference of the tab being adopted from the arguments.
      window.arguments[0] = null;
    } else {
      // There was no tab to adopt in the arguments, set _tabToAdopt to null
      // to avoid checking it again.
      this._tabToAdopt = null;
    }

    return this._tabToAdopt;
  },

  _clearTabToAdopt() {
__L_V__2({
    lN: 1760,tT:'func',pr:'',eT:{},fN:'_clearTabToAdopt'
  });'__L_V__2';
    this._tabToAdopt = null;
  },

  // Used to check if the new window is still adopting an existing tab as its first tab
  // (e.g. from the WebExtensions internals).
  isAdoptingTab() {
__L_V__2({
    lN: 1766,tT:'func',pr:'',eT:{},fN:'isAdoptingTab'
  });'__L_V__2';
    return !!this.getTabToAdopt();
  },

  onBeforeInitialXULLayout() {
__L_V__2({
    lN: 1770,tT:'func',pr:'',eT:{},fN:'onBeforeInitialXULLayout'
  });'__L_V__2';
    // Set a sane starting width/height for all resolutions on new profiles.
    if (Services.prefs.getBoolPref("privacy.resistFingerprinting")) {
__L_V__2({
    lN: 1772,tT:'if',pr:'Services.prefs.getBoolPref(privacy.resistFingerprinting)',eT:{},fN:''
  });'__L_V__2';
      // When the fingerprinting resistance is enabled, making sure that we don't
      // have a maximum window to interfere with generating rounded window dimensions.
      document.documentElement.setAttribute("sizemode", "normal");
    } else if (!document.documentElement.hasAttribute("width")) {
__L_V__2({
    lN: 1776,tT:'if',pr:'!document.documentElement.hasAttribute(width)',eT:{},fN:''
  });'__L_V__2';
      const TARGET_WIDTH = 1280;
      const TARGET_HEIGHT = 1040;
      let width = Math.min(screen.availWidth * 0.9, TARGET_WIDTH);
      let height = Math.min(screen.availHeight * 0.9, TARGET_HEIGHT);

      document.documentElement.setAttribute("width", width);
      document.documentElement.setAttribute("height", height);

      if (width < TARGET_WIDTH && height < TARGET_HEIGHT) {
__L_V__2({
    lN: 1785,tT:'if',pr:'width < TARGET_WIDTH && height < TARGET_HEIGHT',eT:{},fN:''
  });'__L_V__2';
        document.documentElement.setAttribute("sizemode", "maximized");
      }
    }

    // Run menubar initialization first, to avoid TabsInTitlebar code picking
    // up mutations from it and causing a reflow.
    AutoHideMenubar.init();
    // Update the chromemargin attribute so the window can be sized correctly.
    window.TabBarVisibility.update();
    TabsInTitlebar.init();

    new LightweightThemeConsumer(document);

    if (AppConstants.platform == "win") {
__L_V__2({
    lN: 1799,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__2';
      if (
        window.matchMedia("(-moz-os-version: windows-win8)").matches &&
        window.matchMedia("(-moz-windows-default-theme)").matches
      ) {
__L_V__2({
    lN: 1803,tT:'if',pr:' window.matchMedia((-moz-os-version: windows-win8)).matches && window.matchMedia((-moz-windows-default-theme)).matches ',eT:{},fN:''
  });'__L_V__2';
        let windowFrameColor = new Color(
          ...ChromeUtils.import(
            "resource:///modules/Windows8WindowFrameColor.jsm",
            {}
          ).Windows8WindowFrameColor.get()
        );
        // Default to black for foreground text.
        if (!windowFrameColor.isContrastRatioAcceptable(new Color(0, 0, 0))) {
__L_V__2({
    lN: 1811,tT:'if',pr:'!windowFrameColor.isContrastRatioAcceptable(new Color(0, 0, 0))',eT:{},fN:''
  });'__L_V__2';
          document.documentElement.setAttribute("darkwindowframe", "true");
        }
      } else if (AppConstants.isPlatformAndVersionAtLeast("win", "10")) {
__L_V__2({
    lN: 1814,tT:'if',pr:'AppConstants.isPlatformAndVersionAtLeast(win, 10)',eT:{},fN:''
  });'__L_V__2';
        TelemetryEnvironment.onInitialized().then(() => {
          // 17763 is the build number of Windows 10 version 1809
          if (
            TelemetryEnvironment.currentEnvironment.system.os
              .windowsBuildNumber < 17763
          ) {
__L_V__2({
    lN: 1820,tT:'if',pr:' TelemetryEnvironment.currentEnvironment.system.os .windowsBuildNumber < 17763 ',eT:{},fN:''
  });'__L_V__2';
            document.documentElement.setAttribute(
              "always-use-accent-color-for-window-border",
              ""
            );
          }
        });
      }
    }

    if (
      Services.prefs.getBoolPref(
        "toolkit.legacyUserProfileCustomizations.windowIcon",
        false
      )
    ) {
__L_V__2({
    lN: 1835,tT:'if',pr:' Services.prefs.getBoolPref( toolkit.legacyUserProfileCustomizations.windowIcon, false ) ',eT:{},fN:''
  });'__L_V__2';
      document.documentElement.setAttribute("icon", "main-window");
    }

    // Call this after we set attributes that might change toolbars' computed
    // text color.
    ToolbarIconColor.init();
  },

  onDOMContentLoaded() {
__L_V__2({
    lN: 1844,tT:'func',pr:'',eT:{},fN:'onDOMContentLoaded'
  });'__L_V__2';
    // This needs setting up before we create the first remote browser.
    window.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow).XULBrowserWindow = window.XULBrowserWindow;
    window.browserDOMWindow = new nsBrowserAccess();

    gBrowser = window._gBrowser;
    delete window._gBrowser;
    gBrowser.init();

    BrowserWindowTracker.track(window);

    // CLIQZ-SPECIAL:
    // DB-1913: set blue theme initial state.
    // Since the method is trying to get access to DOM element
    // we need to make sure it actually exists.
    // onDOMContentLoaded event trigger is a good place to do that.
    setThemeState(getThemeInitialState());

    gNavToolbox.palette = document.getElementById("BrowserToolbarPalette");
    gNavToolbox.palette.remove();
    let areas = CustomizableUI.areas;
    areas.splice(areas.indexOf(CustomizableUI.AREA_FIXED_OVERFLOW_PANEL), 1);
    for (let area of areas) {
      let node = document.getElementById(area);
      CustomizableUI.registerToolbarNode(node);
    }
    BrowserSearch.initPlaceHolder();

    // Hack to ensure that the various initial pages favicon is loaded
    // instantaneously, to avoid flickering and improve perceived performance.
    this._callWithURIToLoad(uriToLoad => {
      let url;
      try {
        url = Services.io.newURI(uriToLoad);
      } catch (e) {
        return;
      }
      let nonQuery = url.prePath + url.filePath;
      if (nonQuery in gPageIcons) {
__L_V__2({
    lN: 1884,tT:'if',pr:'nonQuery in gPageIcons',eT:{},fN:''
  });'__L_V__2';
        gBrowser.setIcon(gBrowser.selectedTab, gPageIcons[nonQuery]);
      }
    });

    this._setInitialFocus();

#ifdef MOZ_SERVICES_SYNC
    updateFxaToolbarMenu(gFxaToolbarEnabled, true);
#endif
  },

  onLoad() {
__L_V__2({
    lN: 1896,tT:'func',pr:'',eT:{},fN:'onLoad'
  });'__L_V__2';
    gBrowser.addEventListener("DOMUpdateBlockedPopups", gPopupBlockerObserver);

    window.addEventListener("AppCommand", HandleAppCommandEvent, true);

    // These routines add message listeners. They must run before
    // loading the frame script to ensure that we don't miss any
    // message sent between when the frame script is loaded and when
    // the listener is registered.
    LanguageDetectionListener.init();
    CaptivePortalWatcher.init();
    ZoomUI.init(window);

    let mm = window.getGroupMessageManager("browsers");
    mm.loadFrameScript("chrome://browser/content/tab-content.js", true, true);

    if (!gMultiProcessBrowser) {
__L_V__2({
    lN: 1912,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__2';
      // There is a Content:Click message manually sent from content.
      Services.els.addSystemEventListener(
        gBrowser.tabpanels,
        "click",
        contentAreaClick,
        true
      );
    }

    // hook up UI through progress listener
    gBrowser.addProgressListener(window.XULBrowserWindow);
    gBrowser.addTabsProgressListener(window.TabsProgressListener);

    SidebarUI.init();

    // We do this in onload because we want to ensure the button's state
    // doesn't flicker as the window is being shown.
    DownloadsButton.init();

    // Certain kinds of automigration rely on this notification to complete
    // their tasks BEFORE the browser window is shown. SessionStore uses it to
    // restore tabs into windows AFTER important parts like gMultiProcessBrowser
    // have been initialized.
    Services.obs.notifyObservers(window, "browser-window-before-show");

    if (!window.toolbar.visible) {
__L_V__2({
    lN: 1938,tT:'if',pr:'!window.toolbar.visible',eT:{},fN:''
  });'__L_V__2';
      // adjust browser UI for popups
      gURLBar.readOnly = true;
    }

    // Misc. inits.
    gUIDensity.init();
    TabletModeUpdater.init();
    CombinedStopReload.ensureInitialized();
    gPrivateBrowsingUI.init();
    BrowserSearch.init();
    BrowserPageActions.init();
    gAccessibilityServiceIndicator.init();
    AccessibilityRefreshBlocker.init();
    if (gToolbarKeyNavEnabled) {
__L_V__2({
    lN: 1952,tT:'if',pr:'gToolbarKeyNavEnabled',eT:{},fN:''
  });'__L_V__2';
      ToolbarKeyboardNavigator.init();
    }

    gRemoteControl.updateVisualCue(Marionette.running || RemoteAgent.listening);

    // If we are given a tab to swap in, take care of it before first paint to
    // avoid an about:blank flash.
    let tabToAdopt = this.getTabToAdopt();
    if (tabToAdopt) {
__L_V__2({
    lN: 1961,tT:'if',pr:'tabToAdopt',eT:{},fN:''
  });'__L_V__2';
      let evt = new CustomEvent("before-initial-tab-adopted", {
        bubbles: true,
      });
      gBrowser.tabpanels.dispatchEvent(evt);

      // Stop the about:blank load
      gBrowser.stop();
      // make sure it has a docshell
      gBrowser.docShell;

      // Remove the speculative focus from the urlbar to let the url be formatted.
      gURLBar.removeAttribute("focused");

      try {
        gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, tabToAdopt);
      } catch (e) {
        Cu.reportError(e);
      }

      // Clear the reference to the tab once its adoption has been completed.
      this._clearTabToAdopt();
    }

    // Wait until chrome is painted before executing code not critical to making the window visible
    this._boundDelayedStartup = this._delayedStartup.bind(this);
    window.addEventListener("MozAfterPaint", this._boundDelayedStartup);

    if (!PrivateBrowsingUtils.enabled) {
__L_V__2({
    lN: 1989,tT:'if',pr:'!PrivateBrowsingUtils.enabled',eT:{},fN:''
  });'__L_V__2';
      document.getElementById("Tools:PrivateBrowsing").hidden = true;
      // Setting disabled doesn't disable the shortcut, so we just remove
      // the keybinding.
      document.getElementById("key_privatebrowsing").remove();
    }

    this._loadHandled = true;
  },

  _cancelDelayedStartup() {
__L_V__2({
    lN: 1999,tT:'func',pr:'',eT:{},fN:'_cancelDelayedStartup'
  });'__L_V__2';
    window.removeEventListener("MozAfterPaint", this._boundDelayedStartup);
    this._boundDelayedStartup = null;
  },

  _delayedStartup() {
__L_V__2({
    lN: 2004,tT:'func',pr:'',eT:{},fN:'_delayedStartup'
  });'__L_V__2';
    let { TelemetryTimestamps } = ChromeUtils.import(
      "resource://gre/modules/TelemetryTimestamps.jsm"
    );
    TelemetryTimestamps.add("delayedStartupStarted");

    this._cancelDelayedStartup();

    // Bug 1531854 - The hidden window is force-created here
    // until all of its dependencies are handled.
    Services.appShell.hiddenDOMWindow;

    gBrowser.addEventListener(
      "InsecureLoginFormsStateChange",
      function() {
__L_V__2({
    lN: 2018,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__2';
        gIdentityHandler.refreshForInsecureLoginForms();
      },
      true
    );

    gBrowser.addEventListener(
      "PermissionStateChange",
      function() {
__L_V__2({
    lN: 2026,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__2';
        gIdentityHandler.refreshIdentityBlock();
      },
      true
    );

    // Get the service so that it initializes and registers listeners for new
    // tab pages in order to be ready for any early-loading about:newtab pages,
    // e.g., start/home page, command line / startup uris to load, sessionstore
    gAboutNewTabService.QueryInterface(Ci.nsISupports);

    this._handleURIToLoad();

    Services.obs.addObserver(gIdentityHandler, "perm-changed");
    Services.obs.addObserver(gRemoteControl, "remote-listening");
    Services.obs.addObserver(
      gSessionHistoryObserver,
      "browser:purge-session-history"
    );
    Services.obs.addObserver(
      gStoragePressureObserver,
      "QuotaManager::StoragePressure"
    );
    Services.obs.addObserver(gXPInstallObserver, "addon-install-disabled");
    Services.obs.addObserver(gXPInstallObserver, "addon-install-started");
    Services.obs.addObserver(gXPInstallObserver, "addon-install-blocked");
    Services.obs.addObserver(
      gXPInstallObserver,
      "addon-install-fullscreen-blocked"
    );
    Services.obs.addObserver(
      gXPInstallObserver,
      "addon-install-origin-blocked"
    );
    Services.obs.addObserver(gXPInstallObserver, "addon-install-failed");
    Services.obs.addObserver(gXPInstallObserver, "addon-install-confirmation");
    Services.obs.addObserver(gXPInstallObserver, "addon-install-complete");
    window.messageManager.addMessageListener(
      "Browser:URIFixup",
      gKeywordURIFixup
    );
    Services.obs.addObserver(gKeywordURIFixupObs, "keyword-uri-fixup");

    BrowserOffline.init();
    IndexedDBPromptHelper.init();
    CanvasPermissionPromptHelper.init();
    WebAuthnPromptHelper.init();

    // Initialize the full zoom setting.
    // We do this before the session restore service gets initialized so we can
    // apply full zoom settings to tabs restored by the session restore service.
    FullZoom.init();
    PanelUI.init();

    SiteSpecificBrowserUI.init();

    UpdateUrlbarSearchSplitterState();

    BookmarkingUI.init();
    BrowserSearch.delayedStartupInit();
    AutoShowBookmarksToolbar.init();
#if 0
    gProtectionsHandler.init();
#endif
    HomePage.delayedStartup().catch(Cu.reportError);

    let safeMode = document.getElementById("helpSafeMode");
    if (Services.appinfo.inSafeMode) {
__L_V__2({
    lN: 2093,tT:'if',pr:'Services.appinfo.inSafeMode',eT:{},fN:''
  });'__L_V__2';
      document.l10n.setAttributes(safeMode, "menu-help-safe-mode-with-addons");
    }

    // BiDi UI
    gBidiUI = isBidiEnabled();
    if (gBidiUI) {
__L_V__2({
    lN: 2099,tT:'if',pr:'gBidiUI',eT:{},fN:''
  });'__L_V__2';
      document.getElementById("documentDirection-separator").hidden = false;
      document.getElementById("documentDirection-swap").hidden = false;
      document.getElementById("textfieldDirection-separator").hidden = false;
      document.getElementById("textfieldDirection-swap").hidden = false;
    }

    // Setup click-and-hold gestures access to the session history
    // menus if global click-and-hold isn't turned on
    if (!Services.prefs.getBoolPref("ui.click_hold_context_menus", false)) {
__L_V__2({
    lN: 2108,tT:'if',pr:'!Services.prefs.getBoolPref(ui.click_hold_context_menus, false)',eT:{},fN:''
  });'__L_V__2';
      SetClickAndHoldHandlers();
    }

    PlacesToolbarHelper.init();

    ctrlTab.readPref();
    Services.prefs.addObserver(ctrlTab.prefName, ctrlTab);

    // The object handling the downloads indicator is initialized here in the
    // delayed startup function, but the actual indicator element is not loaded
    // unless there are downloads to be displayed.
    DownloadsButton.initializeIndicator();

    if (AppConstants.platform != "macosx") {
__L_V__2({
    lN: 2122,tT:'if',pr:'AppConstants.platform != macosx',eT:{},fN:''
  });'__L_V__2';
      updateEditUIVisibility();
      let placesContext = document.getElementById("placesContext");
      placesContext.addEventListener("popupshowing", updateEditUIVisibility);
      placesContext.addEventListener("popuphiding", updateEditUIVisibility);
    }

    FullScreen.init();

    if (AppConstants.isPlatformAndVersionAtLeast("win", "10")) {
__L_V__2({
    lN: 2131,tT:'if',pr:'AppConstants.isPlatformAndVersionAtLeast(win, 10)',eT:{},fN:''
  });'__L_V__2';
      MenuTouchModeObserver.init();
    }

#if 0
    // Cliqz. DB-2056. The part of cliqz extension now.
    if (AppConstants.MOZ_DATA_REPORTING) {
__L_V__2({
    lN: 2137,tT:'if',pr:'AppConstants.MOZ_DATA_REPORTING',eT:{},fN:''
  });'__L_V__2';
      gDataNotificationInfoBar.init();
    }
    if (!AppConstants.MOZILLA_RELEASE) {
__L_V__2({
    lN: 2140,tT:'if',pr:'!AppConstants.MOZILLA_RELEASE',eT:{},fN:''
  });'__L_V__2';
      DevelopmentHelpers.init();
    }
#endif
    gExtensionsNotifications.init();

    let wasMinimized = window.windowState == window.STATE_MINIMIZED;
    window.addEventListener("sizemodechange", () => {
      let isMinimized = window.windowState == window.STATE_MINIMIZED;
      if (wasMinimized != isMinimized) {
__L_V__2({
    lN: 2149,tT:'if',pr:'wasMinimized != isMinimized',eT:{},fN:''
  });'__L_V__2';
        wasMinimized = isMinimized;
        UpdatePopupNotificationsVisibility();
      }
    });

    window.addEventListener("mousemove", MousePosTracker);
    window.addEventListener("dragover", MousePosTracker);

    gNavToolbox.addEventListener("customizationstarting", CustomizationHandler);
    gNavToolbox.addEventListener("aftercustomization", CustomizationHandler);

    SessionStore.promiseInitialized.then(() => {
      // Bail out if the window has been closed in the meantime.
      if (window.closed) {
__L_V__2({
    lN: 2163,tT:'if',pr:'window.closed',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      // Enable the Restore Last Session command if needed
      RestoreLastSessionObserver.init();

      SidebarUI.startDelayedLoad();

      PanicButtonNotifier.init();
    });

    gBrowser.tabContainer.addEventListener("TabSelect", function() {
__L_V__2({
    lN: 2175,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__2';
      for (let panel of document.querySelectorAll(
        "panel[tabspecific='true']"
      )) {
        if (panel.state == "open") {
__L_V__2({
    lN: 2179,tT:'if',pr:'panel.state == open',eT:{},fN:''
  });'__L_V__2';
          panel.hidePopup();
        }
      }
    });

    if (BrowserHandler.kiosk) {
__L_V__2({
    lN: 2185,tT:'if',pr:'BrowserHandler.kiosk',eT:{},fN:''
  });'__L_V__2';
      // We don't modify popup windows for kiosk mode
      if (!gURLBar.readOnly) {
__L_V__2({
    lN: 2187,tT:'if',pr:'!gURLBar.readOnly',eT:{},fN:''
  });'__L_V__2';
        window.fullScreen = true;
      }
    }

    if (!Services.policies.isAllowed("hideShowMenuBar")) {
__L_V__2({
    lN: 2192,tT:'if',pr:'!Services.policies.isAllowed(hideShowMenuBar)',eT:{},fN:''
  });'__L_V__2';
      document.getElementById("toolbar-menubar").removeAttribute("toolbarname");
    }

    CaptivePortalWatcher.delayedStartup();

    SessionStore.promiseAllWindowsRestored.then(() => {
      this._schedulePerWindowIdleTasks();
      document.documentElement.setAttribute("sessionrestored", "true");
    });

    this.delayedStartupFinished = true;
    _resolveDelayedStartup();
    Services.obs.notifyObservers(window, "browser-delayed-startup-finished");
    TelemetryTimestamps.add("delayedStartupFinished");
    // We've announced that delayed startup has finished. Do not add code past this point.
  },

  _setInitialFocus() {
__L_V__2({
    lN: 2210,tT:'func',pr:'',eT:{},fN:'_setInitialFocus'
  });'__L_V__2';
    let initiallyFocusedElement = document.commandDispatcher.focusedElement;

    this._firstBrowserPaintDeferred = {};
    this._firstBrowserPaintDeferred.promise = new Promise(resolve => {
      this._firstBrowserPaintDeferred.resolve = resolve;
    });

    // To prevent flickering of the urlbar-history-dropmarker in the general
    // case, the urlbar has the 'focused' attribute set by default.
    // If we are not fully sure the urlbar will be focused in this window,
    // we should remove the attribute before first paint.
    let shouldRemoveFocusedAttribute = true;
    this._callWithURIToLoad(uriToLoad => {
      if (isBlankPageURL(uriToLoad) || uriToLoad == "about:privatebrowsing") {
__L_V__2({
    lN: 2224,tT:'if',pr:'isBlankPageURL(uriToLoad) || uriToLoad == about:privatebrowsing',eT:{},fN:''
  });'__L_V__2';
        focusAndSelectUrlBar();
        shouldRemoveFocusedAttribute = false;
        return;
      }

      if (gBrowser.selectedBrowser.isRemoteBrowser) {
__L_V__2({
    lN: 2230,tT:'if',pr:'gBrowser.selectedBrowser.isRemoteBrowser',eT:{},fN:''
  });'__L_V__2';
        // If the initial browser is remote, in order to optimize for first paint,
        // we'll defer switching focus to that browser until it has painted.
        this._firstBrowserPaintDeferred.promise.then(() => {
          // If focus didn't move while we were waiting for first paint, we're okay
          // to move to the browser.
          if (
            document.commandDispatcher.focusedElement == initiallyFocusedElement
          ) {
__L_V__2({
    lN: 2238,tT:'if',pr:' document.commandDispatcher.focusedElement == initiallyFocusedElement ',eT:{},fN:''
  });'__L_V__2';
            gBrowser.selectedBrowser.focus();
          }
        });
      } else {
        // If the initial browser is not remote, we can focus the browser
        // immediately with no paint performance impact.
        gBrowser.selectedBrowser.focus();
      }
    });
    // Delay removing the attribute using requestAnimationFrame to avoid
    // invalidating styles multiple times in a row if uriToLoadPromise
    // resolves before first paint.
    if (shouldRemoveFocusedAttribute) {
__L_V__2({
    lN: 2251,tT:'if',pr:'shouldRemoveFocusedAttribute',eT:{},fN:''
  });'__L_V__2';
      window.requestAnimationFrame(() => {
        if (shouldRemoveFocusedAttribute) {
__L_V__2({
    lN: 2253,tT:'if',pr:'shouldRemoveFocusedAttribute',eT:{},fN:''
  });'__L_V__2';
          gURLBar.removeAttribute("focused");
        }
      });
    }
  },

  _handleURIToLoad() {
__L_V__2({
    lN: 2260,tT:'func',pr:'',eT:{},fN:'_handleURIToLoad'
  });'__L_V__2';
    this._callWithURIToLoad(uriToLoad => {
      if (!uriToLoad) {
__L_V__2({
    lN: 2262,tT:'if',pr:'!uriToLoad',eT:{},fN:''
  });'__L_V__2';
        // We don't check whether window.arguments[5] (userContextId) is set
        // because tabbrowser.js takes care of that for the initial tab.
        return;
      }

      let aboutNewTabURL = gAboutNewTabService.defaultURL;
      if (aboutNewTabURL === "about:newtab") {
__L_V__2({
    lN: 2269,tT:'if',pr:'aboutNewTabURL === about:newtab',eT:{},fN:''
  });'__L_V__2';
        // CLIQZ-SPECIAL: DB-2411, we assign moz-extension url to newTabURL in AboutNewTabService;
        // Sometimes it gets reset to default value "about:newtab" resetting
        // the value having come from the extension.
        // We need this hack for that kind of problem.
        // TODO: find cases when newTabURL is reset.
        // See AboutNewTabService#setter newTabURL;
        aboutNewTabURL = CliqzResources.whatIstheURL('freshtab/home.html');
      }

      // We don't check if uriToLoad is a XULElement because this case has
      // already been handled before first paint, and the argument cleared.
      if (Array.isArray(uriToLoad)) {
__L_V__2({
    lN: 2281,tT:'if',pr:'Array.isArray(uriToLoad)',eT:{},fN:''
  });'__L_V__2';
        // This function throws for certain malformed URIs, so use exception handling
        // so that we don't disrupt startup

        // CLIQZ-SPECIAL: DB-2411, we should not load a freshtab url directly here.
        // Instead we delegate it to AboutRedirector.cpp.
        // That is any uri which is explicitly set as a freshtab moz-extension we
        // assign a default home page value as a string (in most cases about:home);
        // gAboutNewTabService.defaultURL has an explicit freshtab url.
        // Same rule is applicable for other two cases below.
        uriToLoad = uriToLoad.map((uri) => {
          return uri === aboutNewTabURL ? HomePage.getAsString(true) : uri;
        });

        try {
          gBrowser.loadTabs(uriToLoad, {
            inBackground: false,
            replace: true,
            // See below for the semantics of window.arguments. Only the minimum is supported.
            userContextId: window.arguments[5],
            triggeringPrincipal:
              window.arguments[8] ||
              Services.scriptSecurityManager.getSystemPrincipal(),
            allowInheritPrincipal: window.arguments[9],
            csp: window.arguments[10],
            fromExternal: true,
          });
        } catch (e) {}
      } else if (window.arguments.length >= 3) {
__L_V__2({
    lN: 2309,tT:'if',pr:'window.arguments.length >= 3',eT:{},fN:''
  });'__L_V__2';
        // CLIQZ-SPECIAL: DB-2411
        uriToLoad = uriToLoad === aboutNewTabURL ? HomePage.getAsString(true) : uriToLoad;
        // window.arguments[1]: unused (bug 871161)
        //                 [2]: referrerInfo (nsIReferrerInfo)
        //                 [3]: postData (nsIInputStream)
        //                 [4]: allowThirdPartyFixup (bool)
        //                 [5]: userContextId (int)
        //                 [6]: originPrincipal (nsIPrincipal)
        //                 [7]: originStoragePrincipal (nsIPrincipal)
        //                 [8]: triggeringPrincipal (nsIPrincipal)
        //                 [9]: allowInheritPrincipal (bool)
        //                 [10]: csp (nsIContentSecurityPolicy)
        let userContextId =
          window.arguments[5] != undefined
            ? window.arguments[5]
            : Ci.nsIScriptSecurityManager.DEFAULT_USER_CONTEXT_ID;
        loadURI(
          uriToLoad,
          window.arguments[2] || null,
          window.arguments[3] || null,
          window.arguments[4] || false,
          userContextId,
          // pass the origin principal (if any) and force its use to create
          // an initial about:blank viewer if present:
          window.arguments[6],
          window.arguments[7],
          !!window.arguments[6],
          window.arguments[8],
          // TODO fix allowInheritPrincipal to default to false.
          // Default to true unless explicitly set to false because of bug 1475201.
          window.arguments[9] !== false,
          window.arguments[10]
        );
        window.focus();
      } else {
        // CLIQZ-SPECIAL: DB-2411
        uriToLoad = uriToLoad === aboutNewTabURL ? HomePage.getAsString(true) : uriToLoad;
        // Note: loadOneOrMoreURIs *must not* be called if window.arguments.length >= 3.
        // Such callers expect that window.arguments[0] is handled as a single URI.
        loadOneOrMoreURIs(
          uriToLoad,
          Services.scriptSecurityManager.getSystemPrincipal(),
          null
        );
      }
    });
  },

  /**
   * Use this function as an entry point to schedule tasks that
   * need to run once per window after startup, and can be scheduled
   * by using an idle callback.
   *
   * The functions scheduled here will fire from idle callbacks
   * once every window has finished being restored by session
   * restore, and after the equivalent only-once tasks
   * have run (from _scheduleStartupIdleTasks in BrowserGlue.jsm).
   */
  _schedulePerWindowIdleTasks() {
__L_V__2({
    lN: 2368,tT:'func',pr:'',eT:{},fN:'_schedulePerWindowIdleTasks'
  });'__L_V__2';
    // Bail out if the window has been closed in the meantime.
    if (window.closed) {
__L_V__2({
    lN: 2370,tT:'if',pr:'window.closed',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    function scheduleIdleTask(func, options) {
__L_V__2({
    lN: 2374,tT:'func',pr:'',eT:{'func':func,'options':options},fN:'scheduleIdleTask'
  });'__L_V__2';
      requestIdleCallback(function idleTaskRunner() {
__L_V__2({
    lN: 2375,tT:'func',pr:'',eT:{},fN:'idleTaskRunner'
  });'__L_V__2';
        if (!window.closed) {
__L_V__2({
    lN: 2376,tT:'if',pr:'!window.closed',eT:{},fN:''
  });'__L_V__2';
          func();
        }
      }, options);
    }

    scheduleIdleTask(() => {
#ifdef MOZ_SERVICES_SYNC
      // Initialize the Sync UI
      gSync.init();
#endif
    });

    scheduleIdleTask(() => {
      // Initialize the all tabs menu
      gTabsPanel.init();
    });

    scheduleIdleTask(() => {
      CombinedStopReload.startAnimationPrefMonitoring();
    });

    scheduleIdleTask(() => {
      // setup simple gestures support
      gGestureSupport.init(true);

      // setup history swipe animation
      gHistorySwipeAnimation.init();
    });

    scheduleIdleTask(() => {
      gBrowserThumbnails.init();
    });

    scheduleIdleTask(
      () => {
        // Initialize the download manager some time after the app starts so that
        // auto-resume downloads begin (such as after crashing or quitting with
        // active downloads) and speeds up the first-load of the download manager UI.
        // If the user manually opens the download manager before the timeout, the
        // downloads will start right away, and initializing again won't hurt.
        try {
          DownloadsCommon.initializeAllDataLinks();
          ChromeUtils.import(
            "resource:///modules/DownloadsTaskbar.jsm",
            {}
          ).DownloadsTaskbar.registerIndicator(window);
          if (AppConstants.platform == "macosx") {
__L_V__2({
    lN: 2423,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__2';
            ChromeUtils.import(
              "resource:///modules/DownloadsMacFinderProgress.jsm"
            ).DownloadsMacFinderProgress.register();
          }
        } catch (ex) {
          Cu.reportError(ex);
        }
      },
      { timeout: 10000 }
    );

    if (Win7Features) {
__L_V__2({
    lN: 2435,tT:'if',pr:'Win7Features',eT:{},fN:''
  });'__L_V__2';
      scheduleIdleTask(() => Win7Features.onOpenWindow());
    }

    scheduleIdleTask(async () => {
      NewTabPagePreloading.maybeCreatePreloadedBrowser(window);
    });

    scheduleIdleTask(reportRemoteSubframesEnabledTelemetry);

    if (AppConstants.NIGHTLY_BUILD) {
__L_V__2({
    lN: 2445,tT:'if',pr:'AppConstants.NIGHTLY_BUILD',eT:{},fN:''
  });'__L_V__2';
      scheduleIdleTask(() => {
        FissionTestingUI.init();
      });
    }

    scheduleIdleTask(() => {
      gGfxUtils.init();
    });

    // This should always go last, since the idle tasks (except for the ones with
    // timeouts) should execute in order. Note that this observer notification is
    // not guaranteed to fire, since the window could close before we get here.
    scheduleIdleTask(() => {
      this.idleTaskPromiseResolve();
      Services.obs.notifyObservers(
        window,
        "browser-idle-startup-tasks-finished"
      );
    });
  },

  // Returns the URI(s) to load at startup if it is immediately known, or a
  // promise resolving to the URI to load.
  get uriToLoadPromise() {
__L_V__2({
    lN: 2469,tT:'func',pr:'',eT:{},fN:'uriToLoadPromise'
  });'__L_V__2';
    delete this.uriToLoadPromise;
    return (this.uriToLoadPromise = (function() {
      // window.arguments[0]: URI to load (string), or an nsIArray of
      //                      nsISupportsStrings to load, or a xul:tab of
      //                      a tabbrowser, which will be replaced by this
      //                      window (for this case, all other arguments are
      //                      ignored).
      if (!window.arguments || !window.arguments[0]) {
__L_V__2({
    lN: 2477,tT:'if',pr:'!window.arguments || !window.arguments[0]',eT:{},fN:''
  });'__L_V__2';
        return null;
      }

      let uri = window.arguments[0];
      let defaultArgs = Cc["@mozilla.org/browser/clh;1"].getService(
        Ci.nsIBrowserHandler
      ).defaultArgs;

      // CLIQZ-SPECIAL: DB-2345, this is how it works now.
      // If show homepage at the browser start up is selected
      // then defaultArgs will have a value of whatever is set to homepage.
      // Otherwise defaultArgs equals "about:blank".
      //
      // In case of uri equals "about:blank" (a user opens the browser just by clicking on its'
      // icon or in case of Windows OS click on "Open new tab" in the context menu, etc.)
      // but at the same time defaultArgs does not (has other value than "about:blank") then
      // it makes sense to load defaultArgs rather then showing empty page.
      if (uri == "about:blank" && uri != defaultArgs) {
__L_V__2({
    lN: 2495,tT:'if',pr:'uri == about:blank && uri != defaultArgs',eT:{},fN:''
  });'__L_V__2';
        return defaultArgs;
      }

      // If the given URI is different from the homepage, we want to load it.
      if (uri != defaultArgs) {
__L_V__2({
    lN: 2500,tT:'if',pr:'uri != defaultArgs',eT:{},fN:''
  });'__L_V__2';
        AboutNewTabStartupRecorder.noteNonDefaultStartup();

        if (uri instanceof Ci.nsIArray) {
__L_V__2({
    lN: 2503,tT:'if',pr:'uri instanceof Ci.nsIArray',eT:{},fN:''
  });'__L_V__2';
          // Transform the nsIArray of nsISupportsString's into a JS Array of
          // JS strings.
          return Array.from(
            uri.enumerate(Ci.nsISupportsString),
            supportStr => supportStr.data
          );
        } else if (uri instanceof Ci.nsISupportsString) {
__L_V__2({
    lN: 2510,tT:'if',pr:'uri instanceof Ci.nsISupportsString',eT:{},fN:''
  });'__L_V__2';
          return uri.data;
        }
        return uri;
      }

      // The URI appears to be the the homepage. We want to load it only if
      // session restore isn't about to override the homepage.
      let willOverride = SessionStartup.willOverrideHomepage;
      if (typeof willOverride == "boolean") {
__L_V__2({
    lN: 2519,tT:'if',pr:'typeof willOverride == boolean',eT:{},fN:''
  });'__L_V__2';
        return willOverride ? null : uri;
      }
      return willOverride.then(willOverrideHomepage =>
        willOverrideHomepage ? null : uri
      );
    })());
  },

  // Calls the given callback with the URI to load at startup.
  // Synchronously if possible, or after uriToLoadPromise resolves otherwise.
  _callWithURIToLoad(callback) {
__L_V__2({
    lN: 2530,tT:'func',pr:'',eT:{'callback':callback},fN:'_callWithURIToLoad'
  });'__L_V__2';
    let uriToLoad = this.uriToLoadPromise;
    if (uriToLoad && uriToLoad.then) {
__L_V__2({
    lN: 2532,tT:'if',pr:'uriToLoad && uriToLoad.then',eT:{},fN:''
  });'__L_V__2';
      uriToLoad.then(callback);
    } else {
      callback(uriToLoad);
    }
  },

  onUnload() {
__L_V__2({
    lN: 2539,tT:'func',pr:'',eT:{},fN:'onUnload'
  });'__L_V__2';
    gUIDensity.uninit();

    TabsInTitlebar.uninit();

    ToolbarIconColor.uninit();

    // In certain scenarios it's possible for unload to be fired before onload,
    // (e.g. if the window is being closed after browser.js loads but before the
    // load completes). In that case, there's nothing to do here.
    if (!this._loadHandled) {
__L_V__2({
    lN: 2549,tT:'if',pr:'!this._loadHandled',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // First clean up services initialized in gBrowserInit.onLoad (or those whose
    // uninit methods don't depend on the services having been initialized).

    CombinedStopReload.uninit();

    gGestureSupport.init(false);

    gHistorySwipeAnimation.uninit();

    FullScreen.uninit();

#ifdef MOZ_SERVICES_SYNC
    gSync.uninit();
#endif

    gExtensionsNotifications.uninit();

    try {
      gBrowser.removeProgressListener(window.XULBrowserWindow);
      gBrowser.removeTabsProgressListener(window.TabsProgressListener);
    } catch (ex) {}

    PlacesToolbarHelper.uninit();

    BookmarkingUI.uninit();

    TabletModeUpdater.uninit();

    gTabletModePageCounter.finish();

    CaptivePortalWatcher.uninit();

    SidebarUI.uninit();

    DownloadsButton.uninit();

    gAccessibilityServiceIndicator.uninit();

    AccessibilityRefreshBlocker.uninit();

    if (gToolbarKeyNavEnabled) {
__L_V__2({
    lN: 2593,tT:'if',pr:'gToolbarKeyNavEnabled',eT:{},fN:''
  });'__L_V__2';
      ToolbarKeyboardNavigator.uninit();
    }

    BrowserSearch.uninit();

    NewTabPagePreloading.removePreloadedBrowser(window);

    // Now either cancel delayedStartup, or clean up the services initialized from
    // it.
    if (this._boundDelayedStartup) {
__L_V__2({
    lN: 2603,tT:'if',pr:'this._boundDelayedStartup',eT:{},fN:''
  });'__L_V__2';
      this._cancelDelayedStartup();
    } else {
      if (Win7Features) {
__L_V__2({
    lN: 2606,tT:'if',pr:'Win7Features',eT:{},fN:''
  });'__L_V__2';
        Win7Features.onCloseWindow();
      }
      Services.prefs.removeObserver(ctrlTab.prefName, ctrlTab);
      ctrlTab.uninit();
      gBrowserThumbnails.uninit();
#if 0
      gProtectionsHandler.uninit();
#endif
      FullZoom.destroy();

      Services.obs.removeObserver(gIdentityHandler, "perm-changed");
      Services.obs.removeObserver(gRemoteControl, "remote-listening");
      Services.obs.removeObserver(
        gSessionHistoryObserver,
        "browser:purge-session-history"
      );
      Services.obs.removeObserver(
        gStoragePressureObserver,
        "QuotaManager::StoragePressure"
      );
      Services.obs.removeObserver(gXPInstallObserver, "addon-install-disabled");
      Services.obs.removeObserver(gXPInstallObserver, "addon-install-started");
      Services.obs.removeObserver(gXPInstallObserver, "addon-install-blocked");
      Services.obs.removeObserver(
        gXPInstallObserver,
        "addon-install-fullscreen-blocked"
      );
      Services.obs.removeObserver(
        gXPInstallObserver,
        "addon-install-origin-blocked"
      );
      Services.obs.removeObserver(gXPInstallObserver, "addon-install-failed");
      Services.obs.removeObserver(
        gXPInstallObserver,
        "addon-install-confirmation"
      );
      Services.obs.removeObserver(gXPInstallObserver, "addon-install-complete");
      window.messageManager.removeMessageListener(
        "Browser:URIFixup",
        gKeywordURIFixup
      );
      Services.obs.removeObserver(gKeywordURIFixupObs, "keyword-uri-fixup");

      if (AppConstants.isPlatformAndVersionAtLeast("win", "10")) {
__L_V__2({
    lN: 2650,tT:'if',pr:'AppConstants.isPlatformAndVersionAtLeast(win, 10)',eT:{},fN:''
  });'__L_V__2';
        MenuTouchModeObserver.uninit();
      }
      BrowserOffline.uninit();
      IndexedDBPromptHelper.uninit();
      CanvasPermissionPromptHelper.uninit();
      WebAuthnPromptHelper.uninit();
      PanelUI.uninit();
      AutoShowBookmarksToolbar.uninit();
    }

    // Final window teardown, do this last.
    gBrowser.destroy();
    window.XULBrowserWindow = null;
    window.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow).XULBrowserWindow = null;
    window.browserDOMWindow = null;
  },
};

gBrowserInit.idleTasksFinishedPromise = new Promise(resolve => {
  gBrowserInit.idleTaskPromiseResolve = resolve;
});

const SiteSpecificBrowserUI = {
  menuInitialized: false,

  init() {
__L_V__2({
    lN: 2678,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    if (!SiteSpecificBrowserService.isEnabled) {
__L_V__2({
    lN: 2679,tT:'if',pr:'!SiteSpecificBrowserService.isEnabled',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    XPCOMUtils.defineLazyGetter(this, "panelBody", () => {
      return document.querySelector("#appMenu-SSBView .panel-subview-body");
    });

    let initializeMenu = async () => {
      let list = await SiteSpecificBrowserService.list();

      for (let ssb of list) {
        this.addSSBToMenu(ssb);
      }

      if (!list.length) {
__L_V__2({
    lN: 2694,tT:'if',pr:'!list.length',eT:{},fN:''
  });'__L_V__2';
        document.getElementById("appMenu-ssb-button").hidden = true;
      }

      this.menuInitialized = true;
      Services.obs.addObserver(this, "site-specific-browser-install", true);
      Services.obs.addObserver(this, "site-specific-browser-uninstall", true);
    };

    document.getElementById("appMenu-popup").addEventListener(
      "popupshowing",
      () => {
        let blocker = initializeMenu();
        document.getElementById("appMenu-SSBView").addEventListener(
          "ViewShowing",
          event => {
            event.detail.addBlocker(blocker);
          },
          { once: true }
        );
      },
      { once: true }
    );
  },

  observe(subject, topic, id) {
__L_V__2({
    lN: 2719,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'id':id},fN:'observe'
  });'__L_V__2';
    let ssb = SiteSpecificBrowser.get(id);
__L_V__2({
    lN: 2721,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
    switch (topic) {
      case "site-specific-browser-install":
        this.addSSBToMenu(ssb);
        break;
      case "site-specific-browser-uninstall":
        this.removeSSBFromMenu(ssb);
        break;
    }
  },

  removeSSBFromMenu(ssb) {
__L_V__2({
    lN: 2731,tT:'func',pr:'',eT:{'ssb':ssb},fN:'removeSSBFromMenu'
  });'__L_V__2';
    let container = document.getElementById("ssb-button-" + ssb.id);
    if (!container) {
__L_V__2({
    lN: 2733,tT:'if',pr:'!container',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    if (!container.nextElementSibling && !container.previousElementSibling) {
__L_V__2({
    lN: 2737,tT:'if',pr:'!container.nextElementSibling && !container.previousElementSibling',eT:{},fN:''
  });'__L_V__2';
      document.getElementById("appMenu-ssb-button").hidden = true;
    }

    let button = container.querySelector(".ssb-launch");
    let uri = button.getAttribute("image");
    if (uri) {
__L_V__2({
    lN: 2743,tT:'if',pr:'uri',eT:{},fN:''
  });'__L_V__2';
      URL.revokeObjectURL(uri);
    }

    container.remove();
  },

  addSSBToMenu(ssb) {
__L_V__2({
    lN: 2750,tT:'func',pr:'',eT:{'ssb':ssb},fN:'addSSBToMenu'
  });'__L_V__2';
    let container = document.createXULElement("toolbaritem");
    container.id = `ssb-button-${ssb.id}`;
    container.className = "toolbaritem-menu-buttons";

    let menu = document.createXULElement("toolbarbutton");
    menu.className = "ssb-launch subviewbutton subviewbutton-iconic";
    menu.setAttribute("label", ssb.name);
    menu.setAttribute("flex", "1");

    ssb.getScaledIcon(16 * devicePixelRatio).then(
      icon => {
        if (icon) {
__L_V__2({
    lN: 2762,tT:'if',pr:'icon',eT:{},fN:''
  });'__L_V__2';
          menu.setAttribute("image", URL.createObjectURL(icon));
        }
      },
      error => {
        console.error(error);
      }
    );

    menu.addEventListener("command", () => {
      ssb.launch();
    });

    let uninstall = document.createXULElement("toolbarbutton");
    uninstall.className = "ssb-uninstall subviewbutton subviewbutton-iconic";
    // Hardcoded for now. Localization tracked in bug 1602528.
    uninstall.setAttribute("tooltiptext", "Uninstall");

    uninstall.addEventListener("command", () => {
      ssb.uninstall();
    });

    container.append(menu);
    container.append(uninstall);
    this.panelBody.append(container);
    document.getElementById("appMenu-ssb-button").hidden = false;
  },

  QueryInterface: ChromeUtils.generateQI([Ci.nsISupportsWeakReference]),
};

function HandleAppCommandEvent(evt) {
__L_V__2({
    lN: 2793,tT:'func',pr:'',eT:{'evt':evt},fN:'HandleAppCommandEvent'
  });'__L_V__2';
__L_V__2({
    lN: 2794,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
  switch (evt.command) {
    case "Back":
      BrowserBack();
      break;
    case "Forward":
      BrowserForward();
      break;
    case "Reload":
      BrowserReloadSkipCache();
      break;
    case "Stop":
      if (XULBrowserWindow.stopCommand.getAttribute("disabled") != "true") {
__L_V__2({
    lN: 2805,tT:'if',pr:'XULBrowserWindow.stopCommand.getAttribute(disabled) != true',eT:{},fN:''
  });'__L_V__2';
        BrowserStop();
      }
      break;
    case "Search":
      BrowserSearch.webSearch();
      break;
    case "Bookmarks":
      SidebarUI.toggle("viewBookmarksSidebar");
      break;
    case "Home":
      BrowserHome();
      break;
    case "New":
      BrowserOpenTab();
      break;
    case "Close":
      BrowserCloseTabOrWindow();
      break;
    case "Find":
      gLazyFindCommand("onFindCommand");
      break;
    case "Help":
      openHelpLink("firefox-help");
      break;
    case "Open":
      BrowserOpenFileWindow();
      break;
    case "Print":
      PrintUtils.printWindow(gBrowser.selectedBrowser.browsingContext);
      break;
    case "Save":
      saveBrowser(gBrowser.selectedBrowser);
      break;
    case "SendMail":
      MailIntegration.sendLinkForBrowser(gBrowser.selectedBrowser);
      break;
    default:
      return;
  }
  evt.stopPropagation();
  evt.preventDefault();
}

function gotoHistoryIndex(aEvent) {
__L_V__2({
    lN: 2849,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'gotoHistoryIndex'
  });'__L_V__2';
  aEvent = getRootEvent(aEvent);

  let index = aEvent.target.getAttribute("index");
  if (!index) {
__L_V__2({
    lN: 2853,tT:'if',pr:'!index',eT:{},fN:''
  });'__L_V__2';
    return false;
  }

  let where = whereToOpenLink(aEvent);

  if (where == "current") {
__L_V__2({
    lN: 2859,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__2';
    // Normal click. Go there in the current tab and update session history.

    try {
      gBrowser.gotoIndex(index);
    } catch (ex) {
      return false;
    }
    return true;
  }
  // Modified click. Go there in a new tab/window.

  let historyindex = aEvent.target.getAttribute("historyindex");
  duplicateTabIn(gBrowser.selectedTab, where, Number(historyindex));
  return true;
}

function BrowserForward(aEvent) {
__L_V__2({
    lN: 2876,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'BrowserForward'
  });'__L_V__2';
  let where = whereToOpenLink(aEvent, false, true);

  if (where == "current") {
__L_V__2({
    lN: 2879,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__2';
    try {
      gBrowser.goForward();
    } catch (ex) {}
  } else {
    duplicateTabIn(gBrowser.selectedTab, where, 1);
  }
}

function BrowserBack(aEvent) {
__L_V__2({
    lN: 2888,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'BrowserBack'
  });'__L_V__2';
  let where = whereToOpenLink(aEvent, false, true);

  if (where == "current") {
__L_V__2({
    lN: 2891,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__2';
    try {
      gBrowser.goBack();
    } catch (ex) {}
  } else {
    duplicateTabIn(gBrowser.selectedTab, where, -1);
  }
}

function BrowserHandleBackspace() {
__L_V__2({
    lN: 2900,tT:'func',pr:'',eT:{},fN:'BrowserHandleBackspace'
  });'__L_V__2';
__L_V__2({
    lN: 2901,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
  switch (Services.prefs.getIntPref("browser.backspace_action")) {
    case 0:
      BrowserBack();
      break;
    case 1:
      goDoCommand("cmd_scrollPageUp");
      break;
  }
}

function BrowserHandleShiftBackspace() {
__L_V__2({
    lN: 2911,tT:'func',pr:'',eT:{},fN:'BrowserHandleShiftBackspace'
  });'__L_V__2';
__L_V__2({
    lN: 2912,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
  switch (Services.prefs.getIntPref("browser.backspace_action")) {
    case 0:
      BrowserForward();
      break;
    case 1:
      goDoCommand("cmd_scrollPageDown");
      break;
  }
}

function BrowserStop() {
__L_V__2({
    lN: 2922,tT:'func',pr:'',eT:{},fN:'BrowserStop'
  });'__L_V__2';
  gBrowser.webNavigation.stop(Ci.nsIWebNavigation.STOP_ALL);
}

function BrowserReloadOrDuplicate(aEvent) {
__L_V__2({
    lN: 2926,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'BrowserReloadOrDuplicate'
  });'__L_V__2';
  aEvent = getRootEvent(aEvent);
  let accelKeyPressed =
    AppConstants.platform == "macosx" ? aEvent.metaKey : aEvent.ctrlKey;
  var backgroundTabModifier = aEvent.button == 1 || accelKeyPressed;

  if (aEvent.shiftKey && !backgroundTabModifier) {
__L_V__2({
    lN: 2932,tT:'if',pr:'aEvent.shiftKey && !backgroundTabModifier',eT:{},fN:''
  });'__L_V__2';
    BrowserReloadSkipCache();
    return;
  }

  let where = whereToOpenLink(aEvent, false, true);
  if (where == "current") {
__L_V__2({
    lN: 2938,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__2';
    BrowserReload();
  } else {
    duplicateTabIn(gBrowser.selectedTab, where);
  }
}

function BrowserReload() {
__L_V__2({
    lN: 2945,tT:'func',pr:'',eT:{},fN:'BrowserReload'
  });'__L_V__2';
  if (gBrowser.currentURI.schemeIs("view-source")) {
__L_V__2({
    lN: 2946,tT:'if',pr:'gBrowser.currentURI.schemeIs(view-source)',eT:{},fN:''
  });'__L_V__2';
    // Bug 1167797: For view source, we always skip the cache
    return BrowserReloadSkipCache();
  }
  const reloadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
  BrowserReloadWithFlags(reloadFlags);
}

const kSkipCacheFlags =
  Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY |
  Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
function BrowserReloadSkipCache() {
__L_V__2({
    lN: 2957,tT:'func',pr:'',eT:{},fN:'BrowserReloadSkipCache'
  });'__L_V__2';
  // Bypass proxy and cache.
  BrowserReloadWithFlags(kSkipCacheFlags);
}

function BrowserHome(aEvent) {
__L_V__2({
    lN: 2962,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'BrowserHome'
  });'__L_V__2';
  if (aEvent && "button" in aEvent && aEvent.button == 2) {
__L_V__2({
    lN: 2963,tT:'if',pr:'aEvent && button in aEvent && aEvent.button == 2',eT:{},fN:''
  });'__L_V__2';
    // right-click: do nothing
    return;
  }

  var homePage = HomePage.get(window);
  var where = whereToOpenLink(aEvent, false, true);
  var urls;
  var notifyObservers;

  // Home page should open in a new tab when current tab is an app tab
  if (where == "current" && gBrowser && gBrowser.selectedTab.pinned) {
__L_V__2({
    lN: 2974,tT:'if',pr:'where == current && gBrowser && gBrowser.selectedTab.pinned',eT:{},fN:''
  });'__L_V__2';
    where = "tab";
  }

  // openTrustedLinkIn in utilityOverlay.js doesn't handle loading multiple pages
__L_V__2({
    lN: 2979,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
  switch (where) {
    case "current":
      // If we're going to load an initial page in the current tab as the
      // home page, we set initialPageLoadedFromURLBar so that the URL
      // bar is cleared properly (even during a remoteness flip).
      if (CliqzResources.isInitialPage(homePage)) {
__L_V__2({
    lN: 2984,tT:'if',pr:'CliqzResources.isInitialPage(homePage)',eT:{},fN:''
  });'__L_V__2';
        gBrowser.selectedBrowser.initialPageLoadedFromUserAction = homePage;
      }
      loadOneOrMoreURIs(
        homePage,
        Services.scriptSecurityManager.getSystemPrincipal(),
        null
      );
      if (isBlankPageURL(homePage)) {
__L_V__2({
    lN: 2992,tT:'if',pr:'isBlankPageURL(homePage)',eT:{},fN:''
  });'__L_V__2';
        focusAndSelectUrlBar();
      } else {
        gBrowser.selectedBrowser.focus();
      }
      notifyObservers = true;
      break;
    case "tabshifted":
    case "tab":
      urls = homePage.split("|");
      var loadInBackground = Services.prefs.getBoolPref(
        "browser.tabs.loadBookmarksInBackground",
        false
      );
      // The homepage observer event should only be triggered when the homepage opens
      // in the foreground. This is mostly to support the homepage changed by extension
      // doorhanger which doesn't currently support background pages. This may change in
      // bug 1438396.
      notifyObservers = !loadInBackground;
      gBrowser.loadTabs(urls, {
        inBackground: loadInBackground,
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        csp: null,
      });
      break;
    case "window":
      // OpenBrowserWindow will trigger the observer event, so no need to do so here.
      notifyObservers = false;
      OpenBrowserWindow();
      break;
  }
  if (notifyObservers) {
__L_V__2({
    lN: 3023,tT:'if',pr:'notifyObservers',eT:{},fN:''
  });'__L_V__2';
    // A notification for when a user has triggered their homepage. This is used
    // to display a doorhanger explaining that an extension has modified the
    // homepage, if necessary. Observers are only notified if the homepage
    // becomes the active page.
    Services.obs.notifyObservers(null, "browser-open-homepage-start");
  }
}

function loadOneOrMoreURIs(aURIString, aTriggeringPrincipal, aCsp) {
__L_V__2({
    lN: 3032,tT:'func',pr:'',eT:{'aURIString':aURIString,'aTriggeringPrincipal':aTriggeringPrincipal,'aCsp':aCsp},fN:'loadOneOrMoreURIs'
  });'__L_V__2';
  // we're not a browser window, pass the URI string to a new browser window
  if (window.location.href != AppConstants.BROWSER_CHROME_URL) {
__L_V__2({
    lN: 3034,tT:'if',pr:'window.location.href != AppConstants.BROWSER_CHROME_URL',eT:{},fN:''
  });'__L_V__2';
    window.openDialog(
      AppConstants.BROWSER_CHROME_URL,
      "_blank",
      "all,dialog=no",
      aURIString
    );
    return;
  }

  // This function throws for certain malformed URIs, so use exception handling
  // so that we don't disrupt startup
  try {
    gBrowser.loadTabs(aURIString.split("|"), {
      inBackground: false,
      replace: true,
      triggeringPrincipal: aTriggeringPrincipal,
      csp: aCsp,
    });
  } catch (e) {}
}

/**
 * Focuses and expands the location bar input field and selects its contents.
 */
function focusAndSelectUrlBar() {
__L_V__2({
    lN: 3059,tT:'func',pr:'',eT:{},fN:'focusAndSelectUrlBar'
  });'__L_V__2';
  // In customize mode, the url bar is disabled. If a new tab is opened or the
  // user switches to a different tab, this function gets called before we've
  // finished leaving customize mode, and the url bar will still be disabled.
  // We can't focus it when it's disabled, so we need to re-run ourselves when
  // we've finished leaving customize mode.
  if (
    CustomizationHandler.isCustomizing() ||
    CustomizationHandler.isExitingCustomizeMode
  ) {
__L_V__2({
    lN: 3068,tT:'if',pr:' CustomizationHandler.isCustomizing() || CustomizationHandler.isExitingCustomizeMode ',eT:{},fN:''
  });'__L_V__2';
    gNavToolbox.addEventListener("aftercustomization", focusAndSelectUrlBar, {
      once: true,
    });
    return;
  }

  if (window.fullScreen) {
__L_V__2({
    lN: 3075,tT:'if',pr:'window.fullScreen',eT:{},fN:''
  });'__L_V__2';
    FullScreen.showNavToolbox();
  }

  gURLBar.select();
}

function openLocation(event) {
__L_V__2({
    lN: 3082,tT:'func',pr:'',eT:{'event':event},fN:'openLocation'
  });'__L_V__2';
  if (window.location.href == AppConstants.BROWSER_CHROME_URL) {
__L_V__2({
    lN: 3083,tT:'if',pr:'window.location.href == AppConstants.BROWSER_CHROME_URL',eT:{},fN:''
  });'__L_V__2';
    focusAndSelectUrlBar();
    gURLBar.view.autoOpen({ event });
    return;
  }

  // If there's an open browser window, redirect the command there.
  let win = getTopWin();
  if (win) {
__L_V__2({
    lN: 3091,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__2';
    win.focus();
    win.openLocation();
    return;
  }

  // There are no open browser windows; open a new one.
  window.openDialog(
    AppConstants.BROWSER_CHROME_URL,
    "_blank",
    "chrome,all,dialog=no",
    BROWSER_NEW_TAB_URL
  );
}

function BrowserOpenTab(event) {
__L_V__2({
    lN: 3106,tT:'func',pr:'',eT:{'event':event},fN:'BrowserOpenTab'
  });'__L_V__2';
  let where = "tab";
  let relatedToCurrent = false;

  if (event) {
__L_V__2({
    lN: 3110,tT:'if',pr:'event',eT:{},fN:''
  });'__L_V__2';
    where = whereToOpenLink(event, false, true);
__L_V__2({
    lN: 3112,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';

    switch (where) {
      case "tab":
      case "tabshifted":
        // When accel-click or middle-click are used, open the new tab as
        // related to the current tab.
        relatedToCurrent = true;
        break;
      case "current":
        where = "tab";
        break;
    }
  }

  // A notification intended to be useful for modular peformance tracking
  // starting as close as is reasonably possible to the time when the user
  // expressed the intent to open a new tab.  Since there are a lot of
  // entry points, this won't catch every single tab created, but most
  // initiated by the user should go through here.
  //
  // Note 1: This notification gets notified with a promise that resolves
  //         with the linked browser when the tab gets created
  // Note 2: This is also used to notify a user that an extension has changed
  //         the New Tab page.
  Services.obs.notifyObservers(
    {
      wrappedJSObject: new Promise(resolve => {
        openTrustedLinkIn(BROWSER_NEW_TAB_URL, where, {
          relatedToCurrent,
          resolveOnNewTabCreated: resolve,
        });
      }),
    },
    "browser-open-newtab-start"
  );
}

var gLastOpenDirectory = {
  _lastDir: null,
  get path() {
__L_V__2({
    lN: 3151,tT:'func',pr:'',eT:{},fN:'path'
  });'__L_V__2';
    if (!this._lastDir || !this._lastDir.exists()) {
__L_V__2({
    lN: 3152,tT:'if',pr:'!this._lastDir || !this._lastDir.exists()',eT:{},fN:''
  });'__L_V__2';
      try {
        this._lastDir = Services.prefs.getComplexValue(
          "browser.open.lastDir",
          Ci.nsIFile
        );
        if (!this._lastDir.exists()) {
__L_V__2({
    lN: 3158,tT:'if',pr:'!this._lastDir.exists()',eT:{},fN:''
  });'__L_V__2';
          this._lastDir = null;
        }
      } catch (e) {}
    }
    return this._lastDir;
  },
  set path(val) {
__L_V__2({
    lN: 3165,tT:'func',pr:'',eT:{'val':val},fN:'path'
  });'__L_V__2';
    try {
      if (!val || !val.isDirectory()) {
__L_V__2({
    lN: 3167,tT:'if',pr:'!val || !val.isDirectory()',eT:{},fN:''
  });'__L_V__2';
        return;
      }
    } catch (e) {
      return;
    }
    this._lastDir = val.clone();

    // Don't save the last open directory pref inside the Private Browsing mode
    if (!PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 3176,tT:'if',pr:'!PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
      Services.prefs.setComplexValue(
        "browser.open.lastDir",
        Ci.nsIFile,
        this._lastDir
      );
    }
  },
  reset() {
__L_V__2({
    lN: 3184,tT:'func',pr:'',eT:{},fN:'reset'
  });'__L_V__2';
    this._lastDir = null;
  },
};

function BrowserOpenFileWindow() {
__L_V__2({
    lN: 3189,tT:'func',pr:'',eT:{},fN:'BrowserOpenFileWindow'
  });'__L_V__2';
  // Get filepicker component.
  try {
    const nsIFilePicker = Ci.nsIFilePicker;
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    let fpCallback = function fpCallback_done(aResult) {
__L_V__2({
    lN: 3194,tT:'func',pr:'',eT:{'aResult':aResult},fN:'fpCallback_done'
  });'__L_V__2';
      if (aResult == nsIFilePicker.returnOK) {
__L_V__2({
    lN: 3195,tT:'if',pr:'aResult == nsIFilePicker.returnOK',eT:{},fN:''
  });'__L_V__2';
        try {
          if (fp.file) {
__L_V__2({
    lN: 3197,tT:'if',pr:'fp.file',eT:{},fN:''
  });'__L_V__2';
            gLastOpenDirectory.path = fp.file.parent.QueryInterface(Ci.nsIFile);
          }
        } catch (ex) {}
        openTrustedLinkIn(fp.fileURL.spec, "current");
      }
    };

    fp.init(
      window,
      gNavigatorBundle.getString("openFile"),
      nsIFilePicker.modeOpen
    );
    fp.appendFilters(
      nsIFilePicker.filterAll |
        nsIFilePicker.filterText |
        nsIFilePicker.filterImages |
        nsIFilePicker.filterXML |
        nsIFilePicker.filterHTML
    );
    fp.displayDirectory = gLastOpenDirectory.path;
    fp.open(fpCallback);
  } catch (ex) {}
}

function BrowserCloseTabOrWindow(event) {
__L_V__2({
    lN: 3222,tT:'func',pr:'',eT:{'event':event},fN:'BrowserCloseTabOrWindow'
  });'__L_V__2';
  // If we're not a browser window, just close the window.
  if (window.location.href != AppConstants.BROWSER_CHROME_URL) {
__L_V__2({
    lN: 3224,tT:'if',pr:'window.location.href != AppConstants.BROWSER_CHROME_URL',eT:{},fN:''
  });'__L_V__2';
    closeWindow(true);
    return;
  }

  // In a multi-select context, close all selected tabs
  if (gBrowser.multiSelectedTabsCount) {
__L_V__2({
    lN: 3230,tT:'if',pr:'gBrowser.multiSelectedTabsCount',eT:{},fN:''
  });'__L_V__2';
    gBrowser.removeMultiSelectedTabs();
    return;
  }

  // Keyboard shortcuts that would close a tab that is pinned select the first
  // unpinned tab instead.
  if (
    event &&
    (event.ctrlKey || event.metaKey || event.altKey) &&
    gBrowser.selectedTab.pinned
  ) {
__L_V__2({
    lN: 3241,tT:'if',pr:' event && (event.ctrlKey || event.metaKey || event.altKey) && gBrowser.selectedTab.pinned ',eT:{},fN:''
  });'__L_V__2';
    if (gBrowser.visibleTabs.length > gBrowser._numPinnedTabs) {
__L_V__2({
    lN: 3242,tT:'if',pr:'gBrowser.visibleTabs.length > gBrowser._numPinnedTabs',eT:{},fN:''
  });'__L_V__2';
      gBrowser.tabContainer.selectedIndex = gBrowser._numPinnedTabs;
    }
    return;
  }

  // If the current tab is the last one, this will close the window.
  gBrowser.removeCurrentTab({ animate: true });
}

function BrowserTryToCloseWindow() {
__L_V__2({
    lN: 3252,tT:'func',pr:'',eT:{},fN:'BrowserTryToCloseWindow'
  });'__L_V__2';
  if (WindowIsClosing()) {
__L_V__2({
    lN: 3253,tT:'if',pr:'WindowIsClosing()',eT:{},fN:''
  });'__L_V__2';
    window.close();
  } // WindowIsClosing does all the necessary checks
}

function loadURI(
  uri,
  referrerInfo,
  postData,
  allowThirdPartyFixup,
  userContextId,
  originPrincipal,
  originStoragePrincipal,
  forceAboutBlankViewerInCurrent,
  triggeringPrincipal,
  allowInheritPrincipal = false,
  csp = null
) {
__L_V__2({
    lN: 3270,tT:'func',pr:'',eT:{'uri':uri,'referrerInfo':referrerInfo,'postData':postData,'allowThirdPartyFixup':allowThirdPartyFixup,'userContextId':userContextId,'originPrincipal':originPrincipal,'originStoragePrincipal':originStoragePrincipal,'forceAboutBlankViewerInCurrent':forceAboutBlankViewerInCurrent,'triggeringPrincipal':triggeringPrincipal,'allowInheritPrincipal':allowInheritPrincipal,'csp':csp},fN:'loadURI'
  });'__L_V__2';
  if (!triggeringPrincipal) {
__L_V__2({
    lN: 3271,tT:'if',pr:'!triggeringPrincipal',eT:{},fN:''
  });'__L_V__2';
    throw new Error("Must load with a triggering Principal");
  }

  try {
    openLinkIn(uri, "current", {
      referrerInfo,
      postData,
      allowThirdPartyFixup,
      userContextId,
      originPrincipal,
      originStoragePrincipal,
      triggeringPrincipal,
      csp,
      forceAboutBlankViewerInCurrent,
      allowInheritPrincipal,
    });
  } catch (e) {
    Cu.reportError(e);
  }
}

function getLoadContext() {
__L_V__2({
    lN: 3293,tT:'func',pr:'',eT:{},fN:'getLoadContext'
  });'__L_V__2';
  return window.docShell.QueryInterface(Ci.nsILoadContext);
}

function readFromClipboard() {
__L_V__2({
    lN: 3297,tT:'func',pr:'',eT:{},fN:'readFromClipboard'
  });'__L_V__2';
  var url;

  try {
    // Create transferable that will transfer the text.
    var trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
      Ci.nsITransferable
    );
    trans.init(getLoadContext());

    trans.addDataFlavor("text/unicode");

    // If available, use selection clipboard, otherwise global one
    if (Services.clipboard.supportsSelectionClipboard()) {
__L_V__2({
    lN: 3310,tT:'if',pr:'Services.clipboard.supportsSelectionClipboard()',eT:{},fN:''
  });'__L_V__2';
      Services.clipboard.getData(trans, Services.clipboard.kSelectionClipboard);
    } else {
      Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
    }

    var data = {};
    trans.getTransferData("text/unicode", data);

    if (data) {
__L_V__2({
    lN: 3319,tT:'if',pr:'data',eT:{},fN:''
  });'__L_V__2';
      data = data.value.QueryInterface(Ci.nsISupportsString);
      url = data.data;
    }
  } catch (ex) {}

  return url;
}

/**
 * Open the View Source dialog.
 *
 * @param aArgsOrDocument
 *        Either an object or a Document. Passing a Document is deprecated,
 *        and is not supported with e10s. This function will throw if
 *        aArgsOrDocument is a CPOW.
 *
 *        If aArgsOrDocument is an object, that object can take the
 *        following properties:
 *
 *        URL (required):
 *          A string URL for the page we'd like to view the source of.
 *        browser (optional):
 *          The browser containing the document that we would like to view the
 *          source of. This is required if outerWindowID is passed.
 *        outerWindowID (optional):
 *          The outerWindowID of the content window containing the document that
 *          we want to view the source of. You only need to provide this if you
 *          want to attempt to retrieve the document source from the network
 *          cache.
 *        lineNumber (optional):
 *          The line number to focus on once the source is loaded.
 */
async function BrowserViewSourceOfDocument(aArgsOrDocument) {
__L_V__2({
    lN: 3352,tT:'func',pr:'',eT:{'aArgsOrDocument':aArgsOrDocument},fN:'BrowserViewSourceOfDocument'
  });'__L_V__2';
  let args;

  if (aArgsOrDocument instanceof Document) {
__L_V__2({
    lN: 3355,tT:'if',pr:'aArgsOrDocument instanceof Document',eT:{},fN:''
  });'__L_V__2';
    let doc = aArgsOrDocument;
    // Deprecated API - callers should pass args object instead.
    if (Cu.isCrossProcessWrapper(doc)) {
__L_V__2({
    lN: 3358,tT:'if',pr:'Cu.isCrossProcessWrapper(doc)',eT:{},fN:''
  });'__L_V__2';
      throw new Error(
        "BrowserViewSourceOfDocument cannot accept a CPOW as a document."
      );
    }

    let win = doc.defaultView;
    let browser = win.docShell.chromeEventHandler;
    let outerWindowID = win.windowUtils.outerWindowID;
    let URL = browser.currentURI.spec;
    args = { browser, outerWindowID, URL };
  } else {
    args = aArgsOrDocument;
  }

  // Check if external view source is enabled.  If so, try it.  If it fails,
  // fallback to internal view source.
  if (Services.prefs.getBoolPref("view_source.editor.external")) {
__L_V__2({
    lN: 3375,tT:'if',pr:'Services.prefs.getBoolPref(view_source.editor.external)',eT:{},fN:''
  });'__L_V__2';
    try {
      await top.gViewSourceUtils.openInExternalEditor(args);
      return;
    } catch (data) {}
  }

  let tabBrowser = gBrowser;
  let preferredRemoteType;
  if (args.browser) {
__L_V__2({
    lN: 3384,tT:'if',pr:'args.browser',eT:{},fN:''
  });'__L_V__2';
    preferredRemoteType = args.browser.remoteType;
  } else {
    if (!tabBrowser) {
__L_V__2({
    lN: 3387,tT:'if',pr:'!tabBrowser',eT:{},fN:''
  });'__L_V__2';
      throw new Error(
        "BrowserViewSourceOfDocument should be passed the " +
          "subject browser if called from a window without " +
          "gBrowser defined."
      );
    }
    // Some internal URLs (such as specific chrome: and about: URLs that are
    // not yet remote ready) cannot be loaded in a remote browser.  View
    // source in tab expects the new view source browser's remoteness to match
    // that of the original URL, so disable remoteness if necessary for this
    // URL.
    preferredRemoteType = E10SUtils.getRemoteTypeForURI(
      args.URL,
      gMultiProcessBrowser,
      gFissionBrowser
    );
  }

  // In the case of popups, we need to find a non-popup browser window.
  if (!tabBrowser || !window.toolbar.visible) {
__L_V__2({
    lN: 3407,tT:'if',pr:'!tabBrowser || !window.toolbar.visible',eT:{},fN:''
  });'__L_V__2';
    // This returns only non-popup browser windows by default.
    let browserWindow = BrowserWindowTracker.getTopWindow();
    tabBrowser = browserWindow.gBrowser;
  }

  const inNewWindow = !Services.prefs.getBoolPref("view_source.tab");

  // `viewSourceInBrowser` will load the source content from the page
  // descriptor for the tab (when possible) or fallback to the network if
  // that fails.  Either way, the view source module will manage the tab's
  // location, so use "about:blank" here to avoid unnecessary redundant
  // requests.
  let tab = tabBrowser.loadOneTab("about:blank", {
    relatedToCurrent: true,
    inBackground: inNewWindow,
    skipAnimation: inNewWindow,
    preferredRemoteType,
    sameProcessAsFrameLoader: args.browser ? args.browser.frameLoader : null,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  args.viewSourceBrowser = tabBrowser.getBrowserForTab(tab);
  top.gViewSourceUtils.viewSourceInBrowser(args);

  if (inNewWindow) {
__L_V__2({
    lN: 3431,tT:'if',pr:'inNewWindow',eT:{},fN:''
  });'__L_V__2';
    tabBrowser.hideTab(tab);
    tabBrowser.replaceTabWithWindow(tab);
  }
}

/**
 * Opens the View Source dialog for the source loaded in the root
 * top-level document of the browser. This is really just a
 * convenience wrapper around BrowserViewSourceOfDocument.
 *
 * @param browser
 *        The browser that we want to load the source of.
 */
function BrowserViewSource(browser) {
__L_V__2({
    lN: 3445,tT:'func',pr:'',eT:{'browser':browser},fN:'BrowserViewSource'
  });'__L_V__2';
  BrowserViewSourceOfDocument({
    browser,
    outerWindowID: browser.outerWindowID,
    URL: browser.currentURI.spec,
  });
}

// documentURL - URL of the document to view, or null for this window's document
// initialTab - name of the initial tab to display, or null for the first tab
// imageElement - image to load in the Media Tab of the Page Info window; can be null/omitted
// browsingContext - the browsingContext of the frame that we want to view information about; can be null/omitted
// browser - the browser containing the document we're interested in inspecting; can be null/omitted
function BrowserPageInfo(
  documentURL,
  initialTab,
  imageElement,
  browsingContext,
  browser
) {
__L_V__2({
    lN: 3464,tT:'func',pr:'',eT:{'documentURL':documentURL,'initialTab':initialTab,'imageElement':imageElement,'browsingContext':browsingContext,'browser':browser},fN:'BrowserPageInfo'
  });'__L_V__2';
  if (documentURL instanceof HTMLDocument) {
__L_V__2({
    lN: 3465,tT:'if',pr:'documentURL instanceof HTMLDocument',eT:{},fN:''
  });'__L_V__2';
    Deprecated.warning(
      "Please pass the location URL instead of the document " +
        "to BrowserPageInfo() as the first argument.",
      "https://bugzilla.mozilla.org/show_bug.cgi?id=1238180"
    );
    documentURL = documentURL.location;
  }

  let args = { initialTab, imageElement, browsingContext, browser };

  documentURL = documentURL || window.gBrowser.selectedBrowser.currentURI.spec;

  // Check for windows matching the url
  for (let currentWindow of Services.wm.getEnumerator("Browser:page-info")) {
    if (currentWindow.closed) {
__L_V__2({
    lN: 3480,tT:'if',pr:'currentWindow.closed',eT:{},fN:''
  });'__L_V__2';
      continue;
    }
    if (
      currentWindow.document.documentElement.getAttribute("relatedUrl") ==
      documentURL
    ) {
__L_V__2({
    lN: 3486,tT:'if',pr:' currentWindow.document.documentElement.getAttribute(relatedUrl) == documentURL ',eT:{},fN:''
  });'__L_V__2';
      currentWindow.focus();
      currentWindow.resetPageInfo(args);
      return currentWindow;
    }
  }

  // We didn't find a matching window, so open a new one.
  return openDialog(
    "chrome://browser/content/pageinfo/pageInfo.xhtml",
    "",
    "chrome,toolbar,dialog=no,resizable",
    args
  );
}

function UpdateUrlbarSearchSplitterState() {
__L_V__2({
    lN: 3502,tT:'func',pr:'',eT:{},fN:'UpdateUrlbarSearchSplitterState'
  });'__L_V__2';
  var splitter = document.getElementById("urlbar-search-splitter");
  var urlbar = document.getElementById("urlbar-container");
  var searchbar = document.getElementById("search-container");

  if (document.documentElement.getAttribute("customizing") == "true") {
__L_V__2({
    lN: 3507,tT:'if',pr:'document.documentElement.getAttribute(customizing) == true',eT:{},fN:''
  });'__L_V__2';
    if (splitter) {
__L_V__2({
    lN: 3508,tT:'if',pr:'splitter',eT:{},fN:''
  });'__L_V__2';
      splitter.remove();
    }
    return;
  }

  // If the splitter is already in the right place, we don't need to do anything:
  if (
    splitter &&
    ((splitter.nextElementSibling == searchbar &&
      splitter.previousElementSibling == urlbar) ||
      (splitter.nextElementSibling == urlbar &&
        splitter.previousElementSibling == searchbar))
  ) {
__L_V__2({
    lN: 3521,tT:'if',pr:' splitter && ((splitter.nextElementSibling == searchbar && splitter.previousElementSibling == urlbar) || (splitter.nextElementSibling == urlbar && splitter.previousElementSibling == searchbar)) ',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  var ibefore = null;
  if (urlbar && searchbar) {
__L_V__2({
    lN: 3526,tT:'if',pr:'urlbar && searchbar',eT:{},fN:''
  });'__L_V__2';
    if (urlbar.nextElementSibling == searchbar) {
__L_V__2({
    lN: 3527,tT:'if',pr:'urlbar.nextElementSibling == searchbar',eT:{},fN:''
  });'__L_V__2';
      ibefore = searchbar;
    } else if (searchbar.nextElementSibling == urlbar) {
__L_V__2({
    lN: 3529,tT:'if',pr:'searchbar.nextElementSibling == urlbar',eT:{},fN:''
  });'__L_V__2';
      ibefore = urlbar;
    }
  }

  if (ibefore) {
__L_V__2({
    lN: 3534,tT:'if',pr:'ibefore',eT:{},fN:''
  });'__L_V__2';
    if (!splitter) {
__L_V__2({
    lN: 3535,tT:'if',pr:'!splitter',eT:{},fN:''
  });'__L_V__2';
      splitter = document.createXULElement("splitter");
      splitter.id = "urlbar-search-splitter";
      splitter.setAttribute("resizebefore", "flex");
      splitter.setAttribute("resizeafter", "flex");
      splitter.setAttribute("skipintoolbarset", "true");
      splitter.setAttribute("overflows", "false");
      splitter.className = "chromeclass-toolbar-additional";
    }
    urlbar.parentNode.insertBefore(splitter, ibefore);
  } else if (splitter) {
__L_V__2({
    lN: 3545,tT:'if',pr:'splitter',eT:{},fN:''
  });'__L_V__2';
    splitter.remove();
  }
}

function UpdatePageProxyState() {
__L_V__2({
    lN: 3550,tT:'func',pr:'',eT:{},fN:'UpdatePageProxyState'
  });'__L_V__2';
  if (gURLBar && gURLBar.value != gLastValidURLStr) {
__L_V__2({
    lN: 3551,tT:'if',pr:'gURLBar && gURLBar.value != gLastValidURLStr',eT:{},fN:''
  });'__L_V__2';
    SetPageProxyState("invalid", true);
  }
}

/**
 * Updates the user interface to indicate whether the URI in the location bar is
 * different than the loaded page, because it's being edited or because a search
 * result is currently selected and is displayed in the location bar.
 *
 * @param aState
 *        The string "valid" indicates that the security indicators and other
 *        related user interface elments should be shown because the URI in the
 *        location bar matches the loaded page. The string "invalid" indicates
 *        that the URI in the location bar is different than the loaded page.
 * @param updatePopupNotifications
 *        Boolean that indicates whether we should update the PopupNotifications
 *        visibility due to this change, otherwise avoid doing so as it is being
 *        handled somewhere else.
 */
function SetPageProxyState(aState, updatePopupNotifications) {
__L_V__2({
    lN: 3571,tT:'func',pr:'',eT:{'aState':aState,'updatePopupNotifications':updatePopupNotifications},fN:'SetPageProxyState'
  });'__L_V__2';
  if (!gURLBar) {
__L_V__2({
    lN: 3572,tT:'if',pr:'!gURLBar',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  let oldPageProxyState = gURLBar.getAttribute("pageproxystate");
  gURLBar.setPageProxyState(aState);

  // the page proxy state is set to valid via OnLocationChange, which
  // gets called when we switch tabs.
  if (aState == "valid") {
__L_V__2({
    lN: 3581,tT:'if',pr:'aState == valid',eT:{},fN:''
  });'__L_V__2';
    gLastValidURLStr = gURLBar.value;
    gURLBar.addEventListener("input", UpdatePageProxyState);
  } else if (aState == "invalid") {
__L_V__2({
    lN: 3584,tT:'if',pr:'aState == invalid',eT:{},fN:''
  });'__L_V__2';
    gURLBar.removeEventListener("input", UpdatePageProxyState);
  }

  // After we've ensured that we've applied the listeners and updated the value
  // of gLastValidURLStr, return early if the actual state hasn't changed.
  if (oldPageProxyState == aState || !updatePopupNotifications) {
__L_V__2({
    lN: 3590,tT:'if',pr:'oldPageProxyState == aState || !updatePopupNotifications',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  UpdatePopupNotificationsVisibility();
}

function UpdatePopupNotificationsVisibility() {
__L_V__2({
    lN: 3597,tT:'func',pr:'',eT:{},fN:'UpdatePopupNotificationsVisibility'
  });'__L_V__2';
  // Only need to do something if the PopupNotifications object for this window
  // has already been initialized (i.e. its getter no longer exists).
  if (Object.getOwnPropertyDescriptor(window, "PopupNotifications").get) {
__L_V__2({
    lN: 3600,tT:'if',pr:'Object.getOwnPropertyDescriptor(window, PopupNotifications).get',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  // Notify PopupNotifications that the visible anchors may have changed. This
  // also checks the suppression state according to the "shouldSuppress"
  // function defined earlier in this file.
  PopupNotifications.anchorVisibilityChange();
}

function PageProxyClickHandler(aEvent) {
__L_V__2({
    lN: 3610,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'PageProxyClickHandler'
  });'__L_V__2';
  if (aEvent.button == 1 && Services.prefs.getBoolPref("middlemouse.paste")) {
__L_V__2({
    lN: 3611,tT:'if',pr:'aEvent.button == 1 && Services.prefs.getBoolPref(middlemouse.paste)',eT:{},fN:''
  });'__L_V__2';
    middleMousePaste(aEvent);
  }
}

/**
 * Handle command events bubbling up from error page content
 * or from about:newtab or from remote error pages that invoke
 * us via async messaging.
 */
var BrowserOnClick = {
  ignoreWarningLink(reason, blockedInfo, browsingContext) {
__L_V__2({
    lN: 3622,tT:'func',pr:'',eT:{'reason':reason,'blockedInfo':blockedInfo,'browsingContext':browsingContext},fN:'ignoreWarningLink'
  });'__L_V__2';
    let triggeringPrincipal =
      blockedInfo.triggeringPrincipal ||
      _createNullPrincipalFromTabUserContextId();

    // Allow users to override and continue through to the site,
    // but add a notify bar as a reminder, so that they don't lose
    // track after, e.g., tab switching.
    browsingContext.loadURI(blockedInfo.uri, {
      triggeringPrincipal,
      flags: Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CLASSIFIER,
    });

    // We can't use browser.contentPrincipal which is principal of about:blocked
    // Create one from uri with current principal origin attributes
    let principal = Services.scriptSecurityManager.createContentPrincipal(
      Services.io.newURI(blockedInfo.uri),
      browsingContext.currentWindowGlobal.documentPrincipal.originAttributes
    );
    Services.perms.addFromPrincipal(
      principal,
      "safe-browsing",
      Ci.nsIPermissionManager.ALLOW_ACTION,
      Ci.nsIPermissionManager.EXPIRE_SESSION
    );

    let buttons = [
      {
        label: gNavigatorBundle.getString(
          "safebrowsing.getMeOutOfHereButton.label"
        ),
        accessKey: gNavigatorBundle.getString(
          "safebrowsing.getMeOutOfHereButton.accessKey"
        ),
        callback() {
__L_V__2({
    lN: 3656,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
          getMeOutOfHere(browsingContext);
        },
      },
    ];

    let title;
    if (reason === "malware") {
__L_V__2({
    lN: 3663,tT:'if',pr:'reason === malware',eT:{},fN:''
  });'__L_V__2';
      let reportUrl = gSafeBrowsing.getReportURL("MalwareMistake", blockedInfo);
      title = gNavigatorBundle.getString("safebrowsing.reportedAttackSite");
      // There's no button if we can not get report url, for example if the provider
      // of blockedInfo is not Google
      if (reportUrl) {
__L_V__2({
    lN: 3668,tT:'if',pr:'reportUrl',eT:{},fN:''
  });'__L_V__2';
        buttons[1] = {
          label: gNavigatorBundle.getString(
            "safebrowsing.notAnAttackButton.label"
          ),
          accessKey: gNavigatorBundle.getString(
            "safebrowsing.notAnAttackButton.accessKey"
          ),
          callback() {
__L_V__2({
    lN: 3676,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
            openTrustedLinkIn(reportUrl, "tab");
          },
        };
      }
    } else if (reason === "phishing") {
__L_V__2({
    lN: 3681,tT:'if',pr:'reason === phishing',eT:{},fN:''
  });'__L_V__2';
      let reportUrl = gSafeBrowsing.getReportURL("PhishMistake", blockedInfo);
      title = gNavigatorBundle.getString("safebrowsing.deceptiveSite");
      // There's no button if we can not get report url, for example if the provider
      // of blockedInfo is not Google
      if (reportUrl) {
__L_V__2({
    lN: 3686,tT:'if',pr:'reportUrl',eT:{},fN:''
  });'__L_V__2';
        buttons[1] = {
          label: gNavigatorBundle.getString(
            "safebrowsing.notADeceptiveSiteButton.label"
          ),
          accessKey: gNavigatorBundle.getString(
            "safebrowsing.notADeceptiveSiteButton.accessKey"
          ),
          callback() {
__L_V__2({
    lN: 3694,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
            openTrustedLinkIn(reportUrl, "tab");
          },
        };
      }
    } else if (reason === "unwanted") {
__L_V__2({
    lN: 3699,tT:'if',pr:'reason === unwanted',eT:{},fN:''
  });'__L_V__2';
      title = gNavigatorBundle.getString("safebrowsing.reportedUnwantedSite");
      // There is no button for reporting errors since Google doesn't currently
      // provide a URL endpoint for these reports.
    } else if (reason === "harmful") {
__L_V__2({
    lN: 3703,tT:'if',pr:'reason === harmful',eT:{},fN:''
  });'__L_V__2';
      title = gNavigatorBundle.getString("safebrowsing.reportedHarmfulSite");
      // There is no button for reporting errors since Google doesn't currently
      // provide a URL endpoint for these reports.
    }

    SafeBrowsingNotificationBox.show(title, buttons);
  },
};

/**
 * Re-direct the browser to a known-safe page.  This function is
 * used when, for example, the user browses to a known malware page
 * and is presented with about:blocked.  The "Get me out of here!"
 * button should take the user to the default start page so that even
 * when their own homepage is infected, we can get them somewhere safe.
 */
function getMeOutOfHere(browsingContext) {
__L_V__2({
    lN: 3720,tT:'func',pr:'',eT:{'browsingContext':browsingContext},fN:'getMeOutOfHere'
  });'__L_V__2';
  browsingContext.top.loadURI(getDefaultHomePage(), {
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(), // Also needs to load homepage
  });
}

/**
 * Return the default start page for the cases when the user's own homepage is
 * infected, so we can get them somewhere safe.
 */
function getDefaultHomePage() {
__L_V__2({
    lN: 3730,tT:'func',pr:'',eT:{},fN:'getDefaultHomePage'
  });'__L_V__2';
  let url = BROWSER_NEW_TAB_URL;
  if (PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 3732,tT:'if',pr:'PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
    return url;
  }
  url = HomePage.getDefault();
  // If url is a pipe-delimited set of pages, just take the first one.
  if (url.includes("|")) {
__L_V__2({
    lN: 3737,tT:'if',pr:'url.includes(|)',eT:{},fN:''
  });'__L_V__2';
    url = url.split("|")[0];
  }
  return url;
}

function BrowserFullScreen() {
__L_V__2({
    lN: 3743,tT:'func',pr:'',eT:{},fN:'BrowserFullScreen'
  });'__L_V__2';
  window.fullScreen = !window.fullScreen || BrowserHandler.kiosk;
}

function BrowserReloadWithFlags(reloadFlags) {
__L_V__2({
    lN: 3747,tT:'func',pr:'',eT:{'reloadFlags':reloadFlags},fN:'BrowserReloadWithFlags'
  });'__L_V__2';
  let unchangedRemoteness = [];

  for (let tab of gBrowser.selectedTabs) {
    let browser = tab.linkedBrowser;
    let url = browser.currentURI.spec;
    if (gBrowser.updateBrowserRemotenessByURL(browser, url)) {
__L_V__2({
    lN: 3753,tT:'if',pr:'gBrowser.updateBrowserRemotenessByURL(browser, url)',eT:{},fN:''
  });'__L_V__2';
      // If the remoteness has changed, the new browser doesn't have any
      // information of what was loaded before, so we need to load the previous
      // URL again.
      if (tab.linkedPanel) {
__L_V__2({
    lN: 3757,tT:'if',pr:'tab.linkedPanel',eT:{},fN:''
  });'__L_V__2';
        loadBrowserURI(browser, url);
      } else {
        // Shift to fully loaded browser and make
        // sure load handler is instantiated.
        tab.addEventListener(
          "SSTabRestoring",
          () => loadBrowserURI(browser, url),
          { once: true }
        );
        gBrowser._insertBrowser(tab);
      }
    } else {
      unchangedRemoteness.push(tab);
    }
  }

  if (!unchangedRemoteness.length) {
__L_V__2({
    lN: 3774,tT:'if',pr:'!unchangedRemoteness.length',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  // Reset temporary permissions on the remaining tabs to reload.
  // This is done here because we only want to reset
  // permissions on user reload.
  for (let tab of unchangedRemoteness) {
    SitePermissions.clearTemporaryPermissions(tab.linkedBrowser);
    // Also reset DOS mitigations for the basic auth prompt on reload.
    delete tab.linkedBrowser.authPromptAbuseCounter;
  }
  PanelMultiView.hidePopup(gIdentityHandler._identityPopup);

  let handlingUserInput = window.windowUtils.isHandlingUserInput;

  for (let tab of unchangedRemoteness) {
    if (tab.linkedPanel) {
__L_V__2({
    lN: 3791,tT:'if',pr:'tab.linkedPanel',eT:{},fN:''
  });'__L_V__2';
      sendReloadMessage(tab);
    } else {
      // Shift to fully loaded browser and make
      // sure load handler is instantiated.
      tab.addEventListener("SSTabRestoring", () => sendReloadMessage(tab), {
        once: true,
      });
      gBrowser._insertBrowser(tab);
    }
  }

  function loadBrowserURI(browser, url) {
__L_V__2({
    lN: 3803,tT:'func',pr:'',eT:{'browser':browser,'url':url},fN:'loadBrowserURI'
  });'__L_V__2';
    browser.loadURI(url, {
      flags: reloadFlags,
      triggeringPrincipal: browser.contentPrincipal,
    });
  }

  function sendReloadMessage(tab) {
__L_V__2({
    lN: 3810,tT:'func',pr:'',eT:{'tab':tab},fN:'sendReloadMessage'
  });'__L_V__2';
    tab.linkedBrowser.sendMessageToActor(
      "Browser:Reload",
      { flags: reloadFlags, handlingUserInput },
      "BrowserTab"
    );
  }
}

function getSecurityInfo(securityInfoAsString) {
__L_V__2({
    lN: 3819,tT:'func',pr:'',eT:{'securityInfoAsString':securityInfoAsString},fN:'getSecurityInfo'
  });'__L_V__2';
  if (!securityInfoAsString) {
__L_V__2({
    lN: 3820,tT:'if',pr:'!securityInfoAsString',eT:{},fN:''
  });'__L_V__2';
    return null;
  }

  let securityInfo = gSerializationHelper.deserializeObject(
    securityInfoAsString
  );
  securityInfo.QueryInterface(Ci.nsITransportSecurityInfo);

  return securityInfo;
}

// TODO: can we pull getPEMString in from pippki.js instead of
// duplicating them here?
function getPEMString(cert) {
__L_V__2({
    lN: 3834,tT:'func',pr:'',eT:{'cert':cert},fN:'getPEMString'
  });'__L_V__2';
  var derb64 = cert.getBase64DERString();
  // Wrap the Base64 string into lines of 64 characters,
  // with CRLF line breaks (as specified in RFC 1421).
  var wrapped = derb64.replace(/(\S{64}(?!$))/g, "$1\r\n");
  return (
    "-----BEGIN CERTIFICATE-----\r\n" +
    wrapped +
    "\r\n-----END CERTIFICATE-----\r\n"
  );
}

var PrintPreviewListener = {
  _printPreviewTab: null,
  _simplifiedPrintPreviewTab: null,
  _tabBeforePrintPreview: null,
  _simplifyPageTab: null,
  _lastRequestedPrintPreviewTab: null,

  _createPPBrowser() {
__L_V__2({
    lN: 3853,tT:'func',pr:'',eT:{},fN:'_createPPBrowser'
  });'__L_V__2';
    let browser = this.getSourceBrowser();
    let preferredRemoteType = browser.remoteType;
    return gBrowser.loadOneTab("about:printpreview", {
      inBackground: true,
      preferredRemoteType,
      sameProcessAsFrameLoader: browser.frameLoader,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  },
  getPrintPreviewBrowser() {
__L_V__2({
    lN: 3863,tT:'func',pr:'',eT:{},fN:'getPrintPreviewBrowser'
  });'__L_V__2';
    if (!this._printPreviewTab) {
__L_V__2({
    lN: 3864,tT:'if',pr:'!this._printPreviewTab',eT:{},fN:''
  });'__L_V__2';
      this._printPreviewTab = this._createPPBrowser();
    }
    gBrowser._allowTabChange = true;
    this._lastRequestedPrintPreviewTab = gBrowser.selectedTab = this._printPreviewTab;
    gBrowser._allowTabChange = false;
    return gBrowser.getBrowserForTab(this._printPreviewTab);
  },
  getSimplifiedPrintPreviewBrowser() {
__L_V__2({
    lN: 3872,tT:'func',pr:'',eT:{},fN:'getSimplifiedPrintPreviewBrowser'
  });'__L_V__2';
    if (!this._simplifiedPrintPreviewTab) {
__L_V__2({
    lN: 3873,tT:'if',pr:'!this._simplifiedPrintPreviewTab',eT:{},fN:''
  });'__L_V__2';
      this._simplifiedPrintPreviewTab = this._createPPBrowser();
    }
    gBrowser._allowTabChange = true;
    this._lastRequestedPrintPreviewTab = gBrowser.selectedTab = this._simplifiedPrintPreviewTab;
    gBrowser._allowTabChange = false;
    return gBrowser.getBrowserForTab(this._simplifiedPrintPreviewTab);
  },
  createSimplifiedBrowser() {
__L_V__2({
    lN: 3881,tT:'func',pr:'',eT:{},fN:'createSimplifiedBrowser'
  });'__L_V__2';
    let browser = this.getSourceBrowser();
    this._simplifyPageTab = gBrowser.loadOneTab("about:printpreview", {
      inBackground: true,
      sameProcessAsFrameLoader: browser.frameLoader,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    return this.getSimplifiedSourceBrowser();
  },
  getSourceBrowser() {
__L_V__2({
    lN: 3890,tT:'func',pr:'',eT:{},fN:'getSourceBrowser'
  });'__L_V__2';
    if (!this._tabBeforePrintPreview) {
__L_V__2({
    lN: 3891,tT:'if',pr:'!this._tabBeforePrintPreview',eT:{},fN:''
  });'__L_V__2';
      this._tabBeforePrintPreview = gBrowser.selectedTab;
    }
    return this._tabBeforePrintPreview.linkedBrowser;
  },
  getSimplifiedSourceBrowser() {
__L_V__2({
    lN: 3896,tT:'func',pr:'',eT:{},fN:'getSimplifiedSourceBrowser'
  });'__L_V__2';
    return this._simplifyPageTab
      ? gBrowser.getBrowserForTab(this._simplifyPageTab)
      : null;
  },
  getNavToolbox() {
__L_V__2({
    lN: 3901,tT:'func',pr:'',eT:{},fN:'getNavToolbox'
  });'__L_V__2';
    return gNavToolbox;
  },
  onEnter() {
__L_V__2({
    lN: 3904,tT:'func',pr:'',eT:{},fN:'onEnter'
  });'__L_V__2';
    // We might have accidentally switched tabs since the user invoked print
    // preview
    if (gBrowser.selectedTab != this._lastRequestedPrintPreviewTab) {
__L_V__2({
    lN: 3907,tT:'if',pr:'gBrowser.selectedTab != this._lastRequestedPrintPreviewTab',eT:{},fN:''
  });'__L_V__2';
      gBrowser.selectedTab = this._lastRequestedPrintPreviewTab;
    }
    gInPrintPreviewMode = true;
    this._toggleAffectedChrome();
  },
  onExit() {
__L_V__2({
    lN: 3913,tT:'func',pr:'',eT:{},fN:'onExit'
  });'__L_V__2';
    gBrowser._allowTabChange = true;
    gBrowser.selectedTab = this._tabBeforePrintPreview;
    gBrowser._allowTabChange = false;
    this._tabBeforePrintPreview = null;
    gInPrintPreviewMode = false;
    this._toggleAffectedChrome();
    let tabsToRemove = [
      "_simplifyPageTab",
      "_printPreviewTab",
      "_simplifiedPrintPreviewTab",
    ];
    for (let tabProp of tabsToRemove) {
      if (this[tabProp]) {
__L_V__2({
    lN: 3926,tT:'if',pr:'this[tabProp]',eT:{},fN:''
  });'__L_V__2';
        gBrowser.removeTab(this[tabProp]);
        this[tabProp] = null;
      }
    }
    gBrowser.deactivatePrintPreviewBrowsers();
    this._lastRequestedPrintPreviewTab = null;
  },
  _toggleAffectedChrome() {
__L_V__2({
    lN: 3934,tT:'func',pr:'',eT:{},fN:'_toggleAffectedChrome'
  });'__L_V__2';
    gNavToolbox.collapsed = gInPrintPreviewMode;

    if (gInPrintPreviewMode) {
__L_V__2({
    lN: 3937,tT:'if',pr:'gInPrintPreviewMode',eT:{},fN:''
  });'__L_V__2';
      this._hideChrome();
    } else {
      this._showChrome();
    }

    TabsInTitlebar.allowedBy("print-preview", !gInPrintPreviewMode);
  },
  _hideChrome() {
__L_V__2({
    lN: 3945,tT:'func',pr:'',eT:{},fN:'_hideChrome'
  });'__L_V__2';
    this._chromeState = {};

    this._chromeState.sidebarOpen = SidebarUI.isOpen;
    this._sidebarCommand = SidebarUI.currentID;
    SidebarUI.hide();

    this._chromeState.findOpen = gFindBarInitialized && !gFindBar.hidden;
    if (gFindBarInitialized) {
__L_V__2({
    lN: 3953,tT:'if',pr:'gFindBarInitialized',eT:{},fN:''
  });'__L_V__2';
      gFindBar.close();
    }

    gBrowser.getNotificationBox().stack.hidden = true;
    gNotificationBox.stack.hidden = true;
  },
  _showChrome() {
__L_V__2({
    lN: 3960,tT:'func',pr:'',eT:{},fN:'_showChrome'
  });'__L_V__2';
    gNotificationBox.stack.hidden = false;
    gBrowser.getNotificationBox().stack.hidden = false;

    if (this._chromeState.findOpen) {
__L_V__2({
    lN: 3964,tT:'if',pr:'this._chromeState.findOpen',eT:{},fN:''
  });'__L_V__2';
      gLazyFindCommand("open");
    }

    if (this._chromeState.sidebarOpen) {
__L_V__2({
    lN: 3968,tT:'if',pr:'this._chromeState.sidebarOpen',eT:{},fN:''
  });'__L_V__2';
      SidebarUI.show(this._sidebarCommand);
    }
  },

  activateBrowser(browser) {
__L_V__2({
    lN: 3973,tT:'func',pr:'',eT:{'browser':browser},fN:'activateBrowser'
  });'__L_V__2';
    gBrowser.activateBrowserForPrintPreview(browser);
  },
};

var browserDragAndDrop = {
  canDropLink: aEvent => Services.droppedLinkHandler.canDropLink(aEvent, true),

  dragOver(aEvent) {
__L_V__2({
    lN: 3981,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'dragOver'
  });'__L_V__2';
    if (this.canDropLink(aEvent)) {
__L_V__2({
    lN: 3982,tT:'if',pr:'this.canDropLink(aEvent)',eT:{},fN:''
  });'__L_V__2';
      aEvent.preventDefault();
    }
  },

  getTriggeringPrincipal(aEvent) {
__L_V__2({
    lN: 3987,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'getTriggeringPrincipal'
  });'__L_V__2';
    return Services.droppedLinkHandler.getTriggeringPrincipal(aEvent);
  },

  getCSP(aEvent) {
__L_V__2({
    lN: 3991,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'getCSP'
  });'__L_V__2';
    return Services.droppedLinkHandler.getCSP(aEvent);
  },

  validateURIsForDrop(aEvent, aURIs) {
__L_V__2({
    lN: 3995,tT:'func',pr:'',eT:{'aEvent':aEvent,'aURIs':aURIs},fN:'validateURIsForDrop'
  });'__L_V__2';
    return Services.droppedLinkHandler.validateURIsForDrop(aEvent, aURIs);
  },

  dropLinks(aEvent, aDisallowInherit) {
__L_V__2({
    lN: 3999,tT:'func',pr:'',eT:{'aEvent':aEvent,'aDisallowInherit':aDisallowInherit},fN:'dropLinks'
  });'__L_V__2';
    return Services.droppedLinkHandler.dropLinks(aEvent, aDisallowInherit);
  },
};

var homeButtonObserver = {
  onDrop(aEvent) {
__L_V__2({
    lN: 4005,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDrop'
  });'__L_V__2';
    // disallow setting home pages that inherit the principal
    let links = browserDragAndDrop.dropLinks(aEvent, true);
    if (links.length) {
__L_V__2({
    lN: 4008,tT:'if',pr:'links.length',eT:{},fN:''
  });'__L_V__2';
      let urls = [];
      for (let link of links) {
        if (link.url.includes("|")) {
__L_V__2({
    lN: 4011,tT:'if',pr:'link.url.includes(|)',eT:{},fN:''
  });'__L_V__2';
          urls.push(...link.url.split("|"));
        } else {
          urls.push(link.url);
        }
      }

      try {
        browserDragAndDrop.validateURIsForDrop(aEvent, urls);
      } catch (e) {
        return;
      }

      setTimeout(openHomeDialog, 0, urls.join("|"));
    }
  },

  onDragOver(aEvent) {
__L_V__2({
    lN: 4028,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDragOver'
  });'__L_V__2';
    if (HomePage.locked) {
__L_V__2({
    lN: 4029,tT:'if',pr:'HomePage.locked',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    browserDragAndDrop.dragOver(aEvent);
    aEvent.dropEffect = "link";
  },
  onDragExit(aEvent) {
__L_V__2({
    lN: 4035,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDragExit'
  });'__L_V__2';},
};

function openHomeDialog(aURL) {
__L_V__2({
    lN: 4038,tT:'func',pr:'',eT:{'aURL':aURL},fN:'openHomeDialog'
  });'__L_V__2';
  var promptTitle = gNavigatorBundle.getString("droponhometitle");
  var promptMsg;
  if (aURL.includes("|")) {
__L_V__2({
    lN: 4041,tT:'if',pr:'aURL.includes(|)',eT:{},fN:''
  });'__L_V__2';
    promptMsg = gNavigatorBundle.getString("droponhomemsgMultiple");
  } else {
    promptMsg = gNavigatorBundle.getString("droponhomemsg");
  }

  var pressedVal = Services.prompt.confirmEx(
    window,
    promptTitle,
    promptMsg,
    Services.prompt.STD_YES_NO_BUTTONS,
    null,
    null,
    null,
    null,
    { value: 0 }
  );

  if (pressedVal == 0) {
__L_V__2({
    lN: 4059,tT:'if',pr:'pressedVal == 0',eT:{},fN:''
  });'__L_V__2';
    HomePage.set(aURL).catch(Cu.reportError);
  }
}

var newTabButtonObserver = {
  onDragOver(aEvent) {
__L_V__2({
    lN: 4065,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDragOver'
  });'__L_V__2';
    browserDragAndDrop.dragOver(aEvent);
  },
  onDragExit(aEvent) {
__L_V__2({
    lN: 4068,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDragExit'
  });'__L_V__2';},
  async onDrop(aEvent) {
__L_V__2({
    lN: 4069,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDrop'
  });'__L_V__2';
    let links = browserDragAndDrop.dropLinks(aEvent);
    if (
      links.length >=
      Services.prefs.getIntPref("browser.tabs.maxOpenBeforeWarn")
    ) {
__L_V__2({
    lN: 4074,tT:'if',pr:' links.length >= Services.prefs.getIntPref(browser.tabs.maxOpenBeforeWarn) ',eT:{},fN:''
  });'__L_V__2';
      // Sync dialog cannot be used inside drop event handler.
      let answer = await OpenInTabsUtils.promiseConfirmOpenInTabs(
        links.length,
        window
      );
      if (!answer) {
__L_V__2({
    lN: 4080,tT:'if',pr:'!answer',eT:{},fN:''
  });'__L_V__2';
        return;
      }
    }

    let where = aEvent.shiftKey ? "tabshifted" : "tab";
    let triggeringPrincipal = browserDragAndDrop.getTriggeringPrincipal(aEvent);
    let csp = browserDragAndDrop.getCSP(aEvent);
    for (let link of links) {
      if (link.url) {
__L_V__2({
    lN: 4089,tT:'if',pr:'link.url',eT:{},fN:''
  });'__L_V__2';
        let data = await UrlbarUtils.getShortcutOrURIAndPostData(link.url);
        // Allow third-party services to fixup this URL.
        openLinkIn(data.url, where, {
          postData: data.postData,
          allowThirdPartyFixup: true,
          triggeringPrincipal,
          csp,
        });
      }
    }
  },
};

var newWindowButtonObserver = {
  onDragOver(aEvent) {
__L_V__2({
    lN: 4104,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDragOver'
  });'__L_V__2';
    browserDragAndDrop.dragOver(aEvent);
  },
  onDragExit(aEvent) {
__L_V__2({
    lN: 4107,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDragExit'
  });'__L_V__2';},
  async onDrop(aEvent) {
__L_V__2({
    lN: 4108,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onDrop'
  });'__L_V__2';
    let links = browserDragAndDrop.dropLinks(aEvent);
    if (
      links.length >=
      Services.prefs.getIntPref("browser.tabs.maxOpenBeforeWarn")
    ) {
__L_V__2({
    lN: 4113,tT:'if',pr:' links.length >= Services.prefs.getIntPref(browser.tabs.maxOpenBeforeWarn) ',eT:{},fN:''
  });'__L_V__2';
      // Sync dialog cannot be used inside drop event handler.
      let answer = await OpenInTabsUtils.promiseConfirmOpenInTabs(
        links.length,
        window
      );
      if (!answer) {
__L_V__2({
    lN: 4119,tT:'if',pr:'!answer',eT:{},fN:''
  });'__L_V__2';
        return;
      }
    }

    let triggeringPrincipal = browserDragAndDrop.getTriggeringPrincipal(aEvent);
    let csp = browserDragAndDrop.getCSP(aEvent);
    for (let link of links) {
      if (link.url) {
__L_V__2({
    lN: 4127,tT:'if',pr:'link.url',eT:{},fN:''
  });'__L_V__2';
        let data = await UrlbarUtils.getShortcutOrURIAndPostData(link.url);
        // Allow third-party services to fixup this URL.
        openLinkIn(data.url, "window", {
          // TODO fix allowInheritPrincipal
          // (this is required by javascript: drop to the new window) Bug 1475201
          allowInheritPrincipal: true,
          postData: data.postData,
          allowThirdPartyFixup: true,
          triggeringPrincipal,
          csp,
        });
      }
    }
  },
};

const BrowserSearch = {
  _searchInitComplete: false,

  init() {
__L_V__2({
    lN: 4147,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    Services.obs.addObserver(this, "browser-search-engine-modified");
  },

  delayedStartupInit() {
__L_V__2({
    lN: 4151,tT:'func',pr:'',eT:{},fN:'delayedStartupInit'
  });'__L_V__2';
    // Asynchronously initialize the search service if necessary, to get the
    // current engine for working out the placeholder.
    this._updateURLBarPlaceholderFromDefaultEngine(
      PrivateBrowsingUtils.isWindowPrivate(window),
      // Delay the update for this until so that we don't change it while
      // the user is looking at it / isn't expecting it.
      true
    ).then(() => {
      this._searchInitComplete = true;
    });
  },

  uninit() {
__L_V__2({
    lN: 4164,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    Services.obs.removeObserver(this, "browser-search-engine-modified");
  },

  observe(engine, topic, data) {
__L_V__2({
    lN: 4168,tT:'func',pr:'',eT:{'engine':engine,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    // There are two kinds of search engine objects, nsISearchEngine objects and
    // plain { uri, title, icon } objects.  `engine` in this method is the
    // former.  The browser.engines and browser.hiddenEngines arrays are the
    // latter, and they're the engines offered by the the page in the browser.
    //
    // The two types of engines are currently related by their titles/names,
    // although that may change; see bug 335102.
    let engineName = engine.wrappedJSObject.name;
__L_V__2({
    lN: 4177,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
    switch (data) {
      case "engine-removed":
        // An engine was removed from the search service.  If a page is offering
        // the engine, then the engine needs to be added back to the corresponding
        // browser's offered engines.
        this._addMaybeOfferedEngine(engineName);
        break;
      case "engine-added":
        // An engine was added to the search service.  If a page is offering the
        // engine, then the engine needs to be removed from the corresponding
        // browser's offered engines.
        this._removeMaybeOfferedEngine(engineName);
        break;
      case "engine-default":
        if (
          this._searchInitComplete &&
          !PrivateBrowsingUtils.isWindowPrivate(window)
        ) {
__L_V__2({
    lN: 4194,tT:'if',pr:' this._searchInitComplete && !PrivateBrowsingUtils.isWindowPrivate(window) ',eT:{},fN:''
  });'__L_V__2';
          this._updateURLBarPlaceholder(engineName, false);
        }
        break;
      case "engine-default-private":
        if (
          this._searchInitComplete &&
          PrivateBrowsingUtils.isWindowPrivate(window)
        ) {
__L_V__2({
    lN: 4202,tT:'if',pr:' this._searchInitComplete && PrivateBrowsingUtils.isWindowPrivate(window) ',eT:{},fN:''
  });'__L_V__2';
          this._updateURLBarPlaceholder(engineName, true);
        }
        break;
    }
  },

  _addMaybeOfferedEngine(engineName) {
__L_V__2({
    lN: 4209,tT:'func',pr:'',eT:{'engineName':engineName},fN:'_addMaybeOfferedEngine'
  });'__L_V__2';
    let selectedBrowserOffersEngine = false;
    for (let browser of gBrowser.browsers) {
      for (let i = 0; i < (browser.hiddenEngines || []).length; i++) {
        if (browser.hiddenEngines[i].title == engineName) {
__L_V__2({
    lN: 4213,tT:'if',pr:'browser.hiddenEngines[i].title == engineName',eT:{},fN:''
  });'__L_V__2';
          if (!browser.engines) {
__L_V__2({
    lN: 4214,tT:'if',pr:'!browser.engines',eT:{},fN:''
  });'__L_V__2';
            browser.engines = [];
          }
          browser.engines.push(browser.hiddenEngines[i]);
          browser.hiddenEngines.splice(i, 1);
          if (browser == gBrowser.selectedBrowser) {
__L_V__2({
    lN: 4219,tT:'if',pr:'browser == gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__2';
            selectedBrowserOffersEngine = true;
          }
          break;
        }
      }
    }
    if (selectedBrowserOffersEngine) {
__L_V__2({
    lN: 4226,tT:'if',pr:'selectedBrowserOffersEngine',eT:{},fN:''
  });'__L_V__2';
      this.updateOpenSearchBadge();
    }
  },

  _removeMaybeOfferedEngine(engineName) {
__L_V__2({
    lN: 4231,tT:'func',pr:'',eT:{'engineName':engineName},fN:'_removeMaybeOfferedEngine'
  });'__L_V__2';
    let selectedBrowserOffersEngine = false;
    for (let browser of gBrowser.browsers) {
      for (let i = 0; i < (browser.engines || []).length; i++) {
        if (browser.engines[i].title == engineName) {
__L_V__2({
    lN: 4235,tT:'if',pr:'browser.engines[i].title == engineName',eT:{},fN:''
  });'__L_V__2';
          if (!browser.hiddenEngines) {
__L_V__2({
    lN: 4236,tT:'if',pr:'!browser.hiddenEngines',eT:{},fN:''
  });'__L_V__2';
            browser.hiddenEngines = [];
          }
          browser.hiddenEngines.push(browser.engines[i]);
          browser.engines.splice(i, 1);
          if (browser == gBrowser.selectedBrowser) {
__L_V__2({
    lN: 4241,tT:'if',pr:'browser == gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__2';
            selectedBrowserOffersEngine = true;
          }
          break;
        }
      }
    }
    if (selectedBrowserOffersEngine) {
__L_V__2({
    lN: 4248,tT:'if',pr:'selectedBrowserOffersEngine',eT:{},fN:''
  });'__L_V__2';
      this.updateOpenSearchBadge();
    }
  },

  /**
   * Initializes the urlbar placeholder to the pre-saved engine name. We do this
   * via a preference, to avoid needing to synchronously init the search service.
   *
   * This should be called around the time of DOMContentLoaded, so that it is
   * initialized quickly before the user sees anything.
   *
   * Note: If the preference doesn't exist, we don't do anything as the default
   * placeholder is a string which doesn't have the engine name.
   */
  initPlaceHolder() {
__L_V__2({
    lN: 4263,tT:'func',pr:'',eT:{},fN:'initPlaceHolder'
  });'__L_V__2';
    const prefName =
      "browser.urlbar.placeholderName" +
      (PrivateBrowsingUtils.isWindowPrivate(window) ? ".private" : "");
    let engineName = Services.prefs.getStringPref(prefName, "");
    if (engineName) {
__L_V__2({
    lN: 4268,tT:'if',pr:'engineName',eT:{},fN:''
  });'__L_V__2';
      // We can do this directly, since we know we're at DOMContentLoaded.
      this._setURLBarPlaceholder(engineName);
    }
  },

  /**
   * This is a wrapper around '_updateURLBarPlaceholder' that uses the
   * appropraite default engine to get the engine name.
   *
   * @param {Boolean} isPrivate      Set to true if this is a private window.
   * @param {Boolean} [delayUpdate]  Set to true, to delay update until the
   *                                 placeholder is not displayed.
   */
  async _updateURLBarPlaceholderFromDefaultEngine(
    isPrivate,
    delayUpdate = false
  ) {
__L_V__2({
    lN: 4285,tT:'func',pr:'',eT:{'isPrivate':isPrivate,'delayUpdate':delayUpdate},fN:'_updateURLBarPlaceholderFromDefaultEngine'
  });'__L_V__2';
    const getDefault = isPrivate
      ? Services.search.getDefaultPrivate
      : Services.search.getDefault;
    let defaultEngine = await getDefault();

    this._updateURLBarPlaceholder(defaultEngine.name, isPrivate, delayUpdate);
  },

  /**
   * Updates the URLBar placeholder for the specified engine, delaying the
   * update if required. This also saves the current engine name in preferences
   * for the next restart.
   *
   * Note: The engine name will only be displayed for built-in engines, as we
   * know they should have short names.
   *
   * @param {String}  engineName     The search engine name to use for the update.
   * @param {Boolean} isPrivate      Set to true if this is a private window.
   * @param {Boolean} [delayUpdate]  Set to true, to delay update until the
   *                                 placeholder is not displayed.
   */
  async _updateURLBarPlaceholder(engineName, isPrivate, delayUpdate = false) {
__L_V__2({
    lN: 4307,tT:'func',pr:'',eT:{'engineName':engineName,'isPrivate':isPrivate,'delayUpdate':delayUpdate},fN:'_updateURLBarPlaceholder'
  });'__L_V__2';
    if (!engineName) {
__L_V__2({
    lN: 4308,tT:'if',pr:'!engineName',eT:{},fN:''
  });'__L_V__2';
      throw new Error("Expected an engineName to be specified");
    }

    let defaultEngines = await Services.search.getDefaultEngines();
    const prefName =
      "browser.urlbar.placeholderName" + (isPrivate ? ".private" : "");
    if (
      defaultEngines.some(defaultEngine => defaultEngine.name == engineName)
    ) {
__L_V__2({
    lN: 4317,tT:'if',pr:' defaultEngines.some(defaultEngine => defaultEngine.name == engineName) ',eT:{},fN:''
  });'__L_V__2';
      Services.prefs.setStringPref(prefName, engineName);
    } else {
      Services.prefs.clearUserPref(prefName);
      // Set the engine name to an empty string for non-default engines, which'll
      // make sure we display the default placeholder string.
      engineName = "";
    }

    // Only delay if requested, and we're not displaying text in the URL bar
    // currently.
    if (delayUpdate && !gURLBar.value) {
__L_V__2({
    lN: 4328,tT:'if',pr:'delayUpdate && !gURLBar.value',eT:{},fN:''
  });'__L_V__2';
      // Delays changing the URL Bar placeholder until the user is not going to be
      // seeing it, e.g. when there is a value entered in the bar, or if there is
      // a tab switch to a tab which has a url loaded.
      let placeholderUpdateListener = () => {
        if (gURLBar.value) {
__L_V__2({
    lN: 4333,tT:'if',pr:'gURLBar.value',eT:{},fN:''
  });'__L_V__2';
          // By the time the user has switched, they may have changed the engine
          // again, so we need to call this function again but with the
          // new engine name.
          // No need to await for this to finish, we're in a listener here anyway.
          this._updateURLBarPlaceholderFromDefaultEngine(isPrivate, false);
          gURLBar.removeEventListener("input", placeholderUpdateListener);
          gBrowser.tabContainer.removeEventListener(
            "TabSelect",
            placeholderUpdateListener
          );
        }
      };

      gURLBar.addEventListener("input", placeholderUpdateListener);
      gBrowser.tabContainer.addEventListener(
        "TabSelect",
        placeholderUpdateListener
      );
    } else {
      this._setURLBarPlaceholder(engineName);
    }
  },

  /**
   * Sets the URLBar placeholder to either something based on the engine name,
   * or the default placeholder.
   *
   * @param {String} name The name of the engine to use, an empty string if to
   *                      use the default placeholder.
   */
  _setURLBarPlaceholder(name) {
__L_V__2({
    lN: 4364,tT:'func',pr:'',eT:{'name':name},fN:'_setURLBarPlaceholder'
  });'__L_V__2';
    // Cliqz. We do not need to change text in URL bar. Allowing do all other
    // related stuff when user change search engine, except this part.
    return;
    let placeholder;
    if (name) {
__L_V__2({
    lN: 4369,tT:'if',pr:'name',eT:{},fN:''
  });'__L_V__2';
      placeholder = gBrowserBundle.formatStringFromName("urlbar.placeholder", [
        name,
      ]);
    } else {
      placeholder = gURLBar.getAttribute("defaultPlaceholder");
    }
    gURLBar.placeholder = placeholder;
  },

  addEngine(browser, engine, uri) {
__L_V__2({
    lN: 4379,tT:'func',pr:'',eT:{'browser':browser,'engine':engine,'uri':uri},fN:'addEngine'
  });'__L_V__2';
    if (!this._searchInitComplete) {
__L_V__2({
    lN: 4380,tT:'if',pr:'!this._searchInitComplete',eT:{},fN:''
  });'__L_V__2';
      // We haven't finished initialising search yet. This means we can't
      // call getEngineByName here. Since this is only on start-up and unlikely
      // to happen in the normal case, we'll just return early rather than
      // trying to handle it asynchronously.
      return;
    }
    // Check to see whether we've already added an engine with this title
    if (browser.engines) {
__L_V__2({
    lN: 4388,tT:'if',pr:'browser.engines',eT:{},fN:''
  });'__L_V__2';
      if (browser.engines.some(e => e.title == engine.title)) {
__L_V__2({
    lN: 4389,tT:'if',pr:'browser.engines.some(e => e.title == engine.title)',eT:{},fN:''
  });'__L_V__2';
        return;
      }
    }

    var hidden = false;
    // If this engine (identified by title) is already in the list, add it
    // to the list of hidden engines rather than to the main list.
    // XXX This will need to be changed when engines are identified by URL;
    // see bug 335102.
    if (Services.search.getEngineByName(engine.title)) {
__L_V__2({
    lN: 4399,tT:'if',pr:'Services.search.getEngineByName(engine.title)',eT:{},fN:''
  });'__L_V__2';
      hidden = true;
    }

    var engines = (hidden ? browser.hiddenEngines : browser.engines) || [];

    engines.push({
      uri: engine.href,
      title: engine.title,
      get icon() {
__L_V__2({
    lN: 4408,tT:'func',pr:'',eT:{},fN:'icon'
  });'__L_V__2';
        return browser.mIconURL;
      },
    });

    if (hidden) {
__L_V__2({
    lN: 4413,tT:'if',pr:'hidden',eT:{},fN:''
  });'__L_V__2';
      browser.hiddenEngines = engines;
    } else {
      browser.engines = engines;
      if (browser == gBrowser.selectedBrowser) {
__L_V__2({
    lN: 4417,tT:'if',pr:'browser == gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__2';
        this.updateOpenSearchBadge();
      }
    }
  },

  /**
   * Update the browser UI to show whether or not additional engines are
   * available when a page is loaded or the user switches tabs to a page that
   * has search engines.
   */
  updateOpenSearchBadge() {
__L_V__2({
    lN: 4428,tT:'func',pr:'',eT:{},fN:'updateOpenSearchBadge'
  });'__L_V__2';
#ifdef 0
    BrowserPageActions.addSearchEngine.updateEngines();

    var searchBar = this.searchBar;
    if (!searchBar) {
__L_V__2({
    lN: 4433,tT:'if',pr:'!searchBar',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    var engines = gBrowser.selectedBrowser.engines;
    if (engines && engines.length) {
__L_V__2({
    lN: 4438,tT:'if',pr:'engines && engines.length',eT:{},fN:''
  });'__L_V__2';
      searchBar.setAttribute("addengines", "true");
    } else {
      searchBar.removeAttribute("addengines");
    }
#endif
  },

  /**
   * Focuses the search bar if present on the toolbar, or the address bar,
   * putting it in search mode. Will do so in an existing non-popup browser
   * window or open a new one if necessary.
   */
  webSearch: function BrowserSearch_webSearch() {
__L_V__2({
    lN: 4451,tT:'func',pr:'',eT:{},fN:'BrowserSearch_webSearch'
  });'__L_V__2';
    if (
      window.location.href != AppConstants.BROWSER_CHROME_URL ||
      gURLBar.readOnly
    ) {
__L_V__2({
    lN: 4455,tT:'if',pr:' window.location.href != AppConstants.BROWSER_CHROME_URL || gURLBar.readOnly ',eT:{},fN:''
  });'__L_V__2';
      let win = getTopWin(true);
      if (win) {
__L_V__2({
    lN: 4457,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__2';
        // If there's an open browser window, it should handle this command
        win.focus();
        win.BrowserSearch.webSearch();
      } else {
        // If there are no open browser windows, open a new one
        var observer = function(subject, topic, data) {
__L_V__2({
    lN: 4463,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'function'
  });'__L_V__2';
          if (subject == win) {
__L_V__2({
    lN: 4464,tT:'if',pr:'subject == win',eT:{},fN:''
  });'__L_V__2';
            BrowserSearch.webSearch();
            Services.obs.removeObserver(
              observer,
              "browser-delayed-startup-finished"
            );
          }
        };
        win = window.openDialog(
          AppConstants.BROWSER_CHROME_URL,
          "_blank",
          "chrome,all,dialog=no",
          "about:blank"
        );
        Services.obs.addObserver(observer, "browser-delayed-startup-finished");
      }
      return;
    }

    let focusUrlBarIfSearchFieldIsNotActive = function(aSearchBar) {
__L_V__2({
    lN: 4483,tT:'func',pr:'',eT:{'aSearchBar':aSearchBar},fN:'function'
  });'__L_V__2';
      if (!aSearchBar || document.activeElement != aSearchBar.textbox) {
__L_V__2({
    lN: 4484,tT:'if',pr:'!aSearchBar || document.activeElement != aSearchBar.textbox',eT:{},fN:''
  });'__L_V__2';
        // Limit the results to search suggestions, like the search bar.
        gURLBar.search(UrlbarTokenizer.RESTRICT.SEARCH);
      }
    };

    let searchBar = this.searchBar;
    let placement = CustomizableUI.getPlacementOfWidget("search-container");
    let focusSearchBar = () => {
      searchBar = this.searchBar;
      searchBar.select();
      focusUrlBarIfSearchFieldIsNotActive(searchBar);
    };
    if (
      placement &&
      searchBar &&
      ((searchBar.parentNode.getAttribute("overflowedItem") == "true" &&
        placement.area == CustomizableUI.AREA_NAVBAR) ||
        placement.area == CustomizableUI.AREA_FIXED_OVERFLOW_PANEL)
    ) {
__L_V__2({
    lN: 4503,tT:'if',pr:' placement && searchBar && ((searchBar.parentNode.getAttribute(overflowedItem) == true && placement.area == CustomizableUI.AREA_NAVBAR) || placement.area == CustomizableUI.AREA_FIXED_OVERFLOW_PANEL) ',eT:{},fN:''
  });'__L_V__2';
      let navBar = document.getElementById(CustomizableUI.AREA_NAVBAR);
      navBar.overflowable.show().then(focusSearchBar);
      return;
    }
    if (searchBar) {
__L_V__2({
    lN: 4508,tT:'if',pr:'searchBar',eT:{},fN:''
  });'__L_V__2';
      if (window.fullScreen) {
__L_V__2({
    lN: 4509,tT:'if',pr:'window.fullScreen',eT:{},fN:''
  });'__L_V__2';
        FullScreen.showNavToolbox();
      }
      searchBar.select();
    }
    focusUrlBarIfSearchFieldIsNotActive(searchBar);
  },

  /**
   * Loads a search results page, given a set of search terms. Uses the current
   * engine if the search bar is visible, or the default engine otherwise.
   *
   * @param searchText
   *        The search terms to use for the search.
   *
   * @param where
   *        String indicating where the search should load. Most commonly used
   *        are 'tab' or 'window', defaults to 'current'.
   *
   * @param usePrivate
   *        Whether to use the Private Browsing mode default search engine.
   *        Defaults to `false`.
   *
   * @param purpose [optional]
   *        A string meant to indicate the context of the search request. This
   *        allows the search service to provide a different nsISearchSubmission
   *        depending on e.g. where the search is triggered in the UI.
   *
   * @param triggeringPrincipal
   *        The principal to use for a new window or tab.
   *
   * @param csp
   *        The content security policy to use for a new window or tab.
   *
   * @return engine The search engine used to perform a search, or null if no
   *                search was performed.
   */
  async _loadSearch(
    searchText,
    where,
    usePrivate,
    purpose,
    triggeringPrincipal,
    csp
  ) {
__L_V__2({
    lN: 4553,tT:'func',pr:'',eT:{'searchText':searchText,'where':where,'usePrivate':usePrivate,'purpose':purpose,'triggeringPrincipal':triggeringPrincipal,'csp':csp},fN:'_loadSearch'
  });'__L_V__2';
    if (!triggeringPrincipal) {
__L_V__2({
    lN: 4554,tT:'if',pr:'!triggeringPrincipal',eT:{},fN:''
  });'__L_V__2';
      throw new Error(
        "Required argument triggeringPrincipal missing within _loadSearch"
      );
    }

    let engine = usePrivate
      ? await Services.search.getDefaultPrivate()
      : await Services.search.getDefault();

    let submission = engine.getSubmission(searchText, null, purpose); // HTML response

    // getSubmission can return null if the engine doesn't have a URL
    // with a text/html response type.  This is unlikely (since
    // SearchService._addEngineToStore() should fail for such an engine),
    // but let's be on the safe side.
    if (!submission) {
__L_V__2({
    lN: 4570,tT:'if',pr:'!submission',eT:{},fN:''
  });'__L_V__2';
      return null;
    }

    let inBackground = Services.prefs.getBoolPref(
      "browser.search.context.loadInBackground"
    );
    openLinkIn(submission.uri.spec, where || "current", {
      private: usePrivate && !PrivateBrowsingUtils.isWindowPrivate(window),
      postData: submission.postData,
      inBackground,
      relatedToCurrent: true,
      triggeringPrincipal,
      csp,
    });

    return engine;
  },

  /**
   * Perform a search initiated from the context menu.
   *
   * This should only be called from the context menu. See
   * BrowserSearch.loadSearch for the preferred API.
   */
  async loadSearchFromContext(terms, usePrivate, triggeringPrincipal, csp) {
__L_V__2({
    lN: 4595,tT:'func',pr:'',eT:{'terms':terms,'usePrivate':usePrivate,'triggeringPrincipal':triggeringPrincipal,'csp':csp},fN:'loadSearchFromContext'
  });'__L_V__2';
    let engine = await BrowserSearch._loadSearch(
      terms,
      usePrivate && !PrivateBrowsingUtils.isWindowPrivate(window)
        ? "window"
        : "tab",
      usePrivate,
      "contextmenu",
      Services.scriptSecurityManager.createNullPrincipal(
        triggeringPrincipal.originAttributes
      ),
      csp
    );
    if (engine) {
__L_V__2({
    lN: 4608,tT:'if',pr:'engine',eT:{},fN:''
  });'__L_V__2';
      BrowserSearch.recordSearchInTelemetry(engine, "contextmenu");
    }
  },

  /**
   * Perform a search initiated from the command line.
   */
  async loadSearchFromCommandLine(terms, usePrivate, triggeringPrincipal, csp) {
__L_V__2({
    lN: 4616,tT:'func',pr:'',eT:{'terms':terms,'usePrivate':usePrivate,'triggeringPrincipal':triggeringPrincipal,'csp':csp},fN:'loadSearchFromCommandLine'
  });'__L_V__2';
    let engine = await BrowserSearch._loadSearch(
      terms,
      "current",
      usePrivate,
      "system",
      triggeringPrincipal,
      csp
    );
    if (engine) {
__L_V__2({
    lN: 4625,tT:'if',pr:'engine',eT:{},fN:''
  });'__L_V__2';
      BrowserSearch.recordSearchInTelemetry(engine, "system");
    }
  },

  pasteAndSearch(event) {
__L_V__2({
    lN: 4630,tT:'func',pr:'',eT:{'event':event},fN:'pasteAndSearch'
  });'__L_V__2';
    BrowserSearch.searchBar.select();
    goDoCommand("cmd_paste");
    BrowserSearch.searchBar.handleSearchCommand(event);
  },

  /**
   * Returns the search bar element if it is present in the toolbar, null otherwise.
   */
  get searchBar() {
__L_V__2({
    lN: 4639,tT:'func',pr:'',eT:{},fN:'searchBar'
  });'__L_V__2';
    return document.getElementById("searchbar");
  },

  get searchEnginesURL() {
__L_V__2({
    lN: 4643,tT:'func',pr:'',eT:{},fN:'searchEnginesURL'
  });'__L_V__2';
    return formatURL("browser.search.searchEnginesURL", true);
  },

  loadAddEngines: function BrowserSearch_loadAddEngines() {
__L_V__2({
    lN: 4647,tT:'func',pr:'',eT:{},fN:'BrowserSearch_loadAddEngines'
  });'__L_V__2';
    var newWindowPref = Services.prefs.getIntPref(
      "browser.link.open_newwindow"
    );
    var where = newWindowPref == 3 ? "tab" : "window";
    openTrustedLinkIn(this.searchEnginesURL, where);
  },

  /**
   * Helper to record a search with Telemetry.
   *
   * Telemetry records only search counts and nothing pertaining to the search itself.
   *
   * @param engine
   *        (nsISearchEngine) The engine handling the search.
   * @param source
   *        (string) Where the search originated from. See BrowserUsageTelemetry for
   *        allowed values.
   * @param details [optional]
   *        An optional parameter passed to |BrowserUsageTelemetry.recordSearch|.
   *        See its documentation for allowed options.
   *        Additionally, if the search was a suggested search, |details.selection|
   *        indicates where the item was in the suggestion list and how the user
   *        selected it: {selection: {index: The selected index, kind: "key" or "mouse"}}
   */
  recordSearchInTelemetry(engine, source, details = {}) {
__L_V__2({
    lN: 4672,tT:'func',pr:'',eT:{'engine':engine,'source':source,'details':details},fN:'recordSearchInTelemetry'
  });'__L_V__2';
    try {
      BrowserUsageTelemetry.recordSearch(gBrowser, engine, source, details);
    } catch (ex) {
      Cu.reportError(ex);
    }
  },

  /**
   * Helper to record a one-off search with Telemetry.
   *
   * Telemetry records only search counts and nothing pertaining to the search itself.
   *
   * @param engine
   *        (nsISearchEngine) The engine handling the search.
   * @param source
   *        (string) Where the search originated from. See BrowserUsageTelemetry for
   *        allowed values.
   * @param type
   *        (string) Indicates how the user selected the search item.
   */
  recordOneoffSearchInTelemetry(engine, source, type) {
__L_V__2({
    lN: 4693,tT:'func',pr:'',eT:{'engine':engine,'source':source,'type':type},fN:'recordOneoffSearchInTelemetry'
  });'__L_V__2';
    try {
      const details = { type, isOneOff: true };
      BrowserUsageTelemetry.recordSearch(gBrowser, engine, source, details);
    } catch (ex) {
      Cu.reportError(ex);
    }
  },
};

XPCOMUtils.defineConstant(this, "BrowserSearch", BrowserSearch);

function CreateContainerTabMenu(event) {
__L_V__2({
    lN: 4705,tT:'func',pr:'',eT:{'event':event},fN:'CreateContainerTabMenu'
  });'__L_V__2';
  createUserContextMenu(event, {
    useAccessKeys: false,
    showDefaultTab: true,
  });
}

function FillHistoryMenu(aParent) {
__L_V__2({
    lN: 4712,tT:'func',pr:'',eT:{'aParent':aParent},fN:'FillHistoryMenu'
  });'__L_V__2';
  // Lazily add the hover listeners on first showing and never remove them
  if (!aParent.hasStatusListener) {
__L_V__2({
    lN: 4714,tT:'if',pr:'!aParent.hasStatusListener',eT:{},fN:''
  });'__L_V__2';
    // Show history item's uri in the status bar when hovering, and clear on exit
    aParent.addEventListener("DOMMenuItemActive", function(aEvent) {
__L_V__2({
    lN: 4716,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'function'
  });'__L_V__2';
      // Only the current page should have the checked attribute, so skip it
      if (!aEvent.target.hasAttribute("checked")) {
__L_V__2({
    lN: 4718,tT:'if',pr:'!aEvent.target.hasAttribute(checked)',eT:{},fN:''
  });'__L_V__2';
        XULBrowserWindow.setOverLink(aEvent.target.getAttribute("uri"));
      }
    });
    aParent.addEventListener("DOMMenuItemInactive", function() {
__L_V__2({
    lN: 4722,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__2';
      XULBrowserWindow.setOverLink("");
    });

    aParent.hasStatusListener = true;
  }

  // Remove old entries if any
  let children = aParent.children;
  for (var i = children.length - 1; i >= 0; --i) {
    if (children[i].hasAttribute("index")) {
__L_V__2({
    lN: 4732,tT:'if',pr:'children[i].hasAttribute(index)',eT:{},fN:''
  });'__L_V__2';
      aParent.removeChild(children[i]);
    }
  }

  const MAX_HISTORY_MENU_ITEMS = 15;

  const tooltipBack = gNavigatorBundle.getString("tabHistory.goBack");
  const tooltipCurrent = gNavigatorBundle.getString("tabHistory.current");
  const tooltipForward = gNavigatorBundle.getString("tabHistory.goForward");

  function updateSessionHistory(sessionHistory, initial) {
__L_V__2({
    lN: 4743,tT:'func',pr:'',eT:{'sessionHistory':sessionHistory,'initial':initial},fN:'updateSessionHistory'
  });'__L_V__2';
    let count = sessionHistory.entries.length;

    if (!initial) {
__L_V__2({
    lN: 4746,tT:'if',pr:'!initial',eT:{},fN:''
  });'__L_V__2';
      if (count <= 1) {
__L_V__2({
    lN: 4747,tT:'if',pr:'count <= 1',eT:{},fN:''
  });'__L_V__2';
        // if there is only one entry now, close the popup.
        aParent.hidePopup();
        return;
      } else if (aParent.id != "backForwardMenu" && !aParent.parentNode.open) {
__L_V__2({
    lN: 4751,tT:'if',pr:'aParent.id != backForwardMenu && !aParent.parentNode.open',eT:{},fN:''
  });'__L_V__2';
        // if the popup wasn't open before, but now needs to be, reopen the menu.
        // It should trigger FillHistoryMenu again. This might happen with the
        // delay from click-and-hold menus but skip this for the context menu
        // (backForwardMenu) rather than figuring out how the menu should be
        // positioned and opened as it is an extreme edgecase.
        aParent.parentNode.open = true;
        return;
      }
    }

    let index = sessionHistory.index;
    let half_length = Math.floor(MAX_HISTORY_MENU_ITEMS / 2);
    let start = Math.max(index - half_length, 0);
    let end = Math.min(
      start == 0 ? MAX_HISTORY_MENU_ITEMS : index + half_length + 1,
      count
    );
    if (end == count) {
__L_V__2({
    lN: 4769,tT:'if',pr:'end == count',eT:{},fN:''
  });'__L_V__2';
      start = Math.max(count - MAX_HISTORY_MENU_ITEMS, 0);
    }

    let existingIndex = 0;

    for (let j = end - 1; j >= start; j--) {
      let entry = sessionHistory.entries[j];
      let uri = entry.url;

      let item =
        existingIndex < children.length
          ? children[existingIndex]
          : document.createXULElement("menuitem");

      item.setAttribute("uri", uri);
      item.setAttribute("label", entry.title || uri);
      item.setAttribute("index", j);

      // Cache this so that gotoHistoryIndex doesn't need the original index
      item.setAttribute("historyindex", j - index);

      if (j != index) {
__L_V__2({
    lN: 4791,tT:'if',pr:'j != index',eT:{},fN:''
  });'__L_V__2';
        // Use list-style-image rather than the image attribute in order to
        // allow CSS to override this.
        item.style.listStyleImage = `url(page-icon:${uri})`;
      }

      if (j < index) {
__L_V__2({
    lN: 4797,tT:'if',pr:'j < index',eT:{},fN:''
  });'__L_V__2';
        item.className =
          "unified-nav-back menuitem-iconic menuitem-with-favicon";
        item.setAttribute("tooltiptext", tooltipBack);
      } else if (j == index) {
__L_V__2({
    lN: 4801,tT:'if',pr:'j == index',eT:{},fN:''
  });'__L_V__2';
        item.setAttribute("type", "radio");
        item.setAttribute("checked", "true");
        item.className = "unified-nav-current";
        item.setAttribute("tooltiptext", tooltipCurrent);
      } else {
        item.className =
          "unified-nav-forward menuitem-iconic menuitem-with-favicon";
        item.setAttribute("tooltiptext", tooltipForward);
      }

      if (!item.parentNode) {
__L_V__2({
    lN: 4812,tT:'if',pr:'!item.parentNode',eT:{},fN:''
  });'__L_V__2';
        aParent.appendChild(item);
      }

      existingIndex++;
    }

    if (!initial) {
__L_V__2({
    lN: 4819,tT:'if',pr:'!initial',eT:{},fN:''
  });'__L_V__2';
      let existingLength = children.length;
      while (existingIndex < existingLength) {
        aParent.removeChild(aParent.lastElementChild);
        existingIndex++;
      }
    }
  }

  let sessionHistory = SessionStore.getSessionHistory(
    gBrowser.selectedTab,
    updateSessionHistory
  );
  if (!sessionHistory) {
__L_V__2({
    lN: 4832,tT:'if',pr:'!sessionHistory',eT:{},fN:''
  });'__L_V__2';
    return false;
  }

  // don't display the popup for a single item
  if (sessionHistory.entries.length <= 1) {
__L_V__2({
    lN: 4837,tT:'if',pr:'sessionHistory.entries.length <= 1',eT:{},fN:''
  });'__L_V__2';
    return false;
  }

  updateSessionHistory(sessionHistory, true);
  return true;
}

function BrowserDownloadsUI() {
__L_V__2({
    lN: 4845,tT:'func',pr:'',eT:{},fN:'BrowserDownloadsUI'
  });'__L_V__2';
  if (PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 4846,tT:'if',pr:'PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
    openTrustedLinkIn("about:downloads", "tab");
  } else {
    PlacesCommandHook.showPlacesOrganizer("Downloads");
  }
}

function toOpenWindowByType(inType, uri, features) {
__L_V__2({
    lN: 4853,tT:'func',pr:'',eT:{'inType':inType,'uri':uri,'features':features},fN:'toOpenWindowByType'
  });'__L_V__2';
  var topWindow = Services.wm.getMostRecentWindow(inType);

  if (topWindow) {
__L_V__2({
    lN: 4856,tT:'if',pr:'topWindow',eT:{},fN:''
  });'__L_V__2';
    topWindow.focus();
  } else if (features) {
__L_V__2({
    lN: 4858,tT:'if',pr:'features',eT:{},fN:''
  });'__L_V__2';
    window.open(uri, "_blank", features);
  } else {
    window.open(
      uri,
      "_blank",
      "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar"
    );
  }
}

/**
 * Open a new browser window.
 *
 * @param {Object} options
 *        {
 *          private: A boolean indicating if the window should be
 *                   private
 *          remote:  A boolean indicating if the window should run
 *                   remote browser tabs or not. If omitted, the window
 *                   will choose the profile default state.
 *          fission: A boolean indicating if the window should run
 *                   with fission enabled or not. If omitted, the window
 *                   will choose the profile default state.
 *        }
 * @return a reference to the new window.
 */
function OpenBrowserWindow(options) {
__L_V__2({
    lN: 4885,tT:'func',pr:'',eT:{'options':options},fN:'OpenBrowserWindow'
  });'__L_V__2';
  var telemetryObj = {};
  TelemetryStopwatch.start("FX_NEW_WINDOW_MS", telemetryObj);

  var handler = Cc["@mozilla.org/browser/clh;1"].getService(
    Ci.nsIBrowserHandler
  );
  var defaultArgs = handler.defaultArgs;
  var wintype = document.documentElement.getAttribute("windowtype");

  var extraFeatures = "";
  if (options && options.private && PrivateBrowsingUtils.enabled) {
__L_V__2({
    lN: 4896,tT:'if',pr:'options && options.private && PrivateBrowsingUtils.enabled',eT:{},fN:''
  });'__L_V__2';
    extraFeatures = ",private";
    if (!PrivateBrowsingUtils.permanentPrivateBrowsing) {
__L_V__2({
    lN: 4898,tT:'if',pr:'!PrivateBrowsingUtils.permanentPrivateBrowsing',eT:{},fN:''
  });'__L_V__2';
      // Force the new window to load about:privatebrowsing instead of the default home page
      defaultArgs = "about:privatebrowsing";
    }
  } else {
    extraFeatures = ",non-private";
  }

  if (options && options.remote) {
__L_V__2({
    lN: 4906,tT:'if',pr:'options && options.remote',eT:{},fN:''
  });'__L_V__2';
    extraFeatures += ",remote";
  } else if (options && options.remote === false) {
__L_V__2({
    lN: 4908,tT:'if',pr:'options && options.remote === false',eT:{},fN:''
  });'__L_V__2';
    extraFeatures += ",non-remote";
  }

  if (options && options.fission) {
__L_V__2({
    lN: 4912,tT:'if',pr:'options && options.fission',eT:{},fN:''
  });'__L_V__2';
    extraFeatures += ",fission";
  } else if (options && options.fission === false) {
__L_V__2({
    lN: 4914,tT:'if',pr:'options && options.fission === false',eT:{},fN:''
  });'__L_V__2';
    extraFeatures += ",non-fission";
  }

  // If the window is maximized, we want to skip the animation, since we're
  // going to be taking up most of the screen anyways, and we want to optimize
  // for showing the user a useful window as soon as possible.
  if (window.windowState == window.STATE_MAXIMIZED) {
__L_V__2({
    lN: 4921,tT:'if',pr:'window.windowState == window.STATE_MAXIMIZED',eT:{},fN:''
  });'__L_V__2';
    extraFeatures += ",suppressanimation";
  }

  // if and only if the current window is a browser window and it has a document with a character
  // set, then extract the current charset menu setting from the current document and use it to
  // initialize the new browser window...
  var win;
  if (
    window &&
    wintype == "navigator:browser" &&
    window.content &&
    window.content.document
  ) {
__L_V__2({
    lN: 4934,tT:'if',pr:' window && wintype == navigator:browser && window.content && window.content.document ',eT:{},fN:''
  });'__L_V__2';
    var DocCharset = window.content.document.characterSet;
    let charsetArg = "charset=" + DocCharset;

    // we should "inherit" the charset menu setting in a new window
    win = window.openDialog(
      AppConstants.BROWSER_CHROME_URL,
      "_blank",
      "chrome,all,dialog=no" + extraFeatures,
      defaultArgs,
      charsetArg
    );
  } else {
    // forget about the charset information.
    win = window.openDialog(
      AppConstants.BROWSER_CHROME_URL,
      "_blank",
      "chrome,all,dialog=no" + extraFeatures,
      defaultArgs
    );
  }

// Cliqz. Not used
#if 0
  win.addEventListener(
    "MozAfterPaint",
    () => {
      TelemetryStopwatch.finish("FX_NEW_WINDOW_MS", telemetryObj);
      if (
        Services.prefs.getIntPref("browser.startup.page") == 1 &&
        defaultArgs == HomePage.get()
      ) {
__L_V__2({
    lN: 4965,tT:'if',pr:' Services.prefs.getIntPref(browser.startup.page) == 1 && defaultArgs == HomePage.get() ',eT:{},fN:''
  });'__L_V__2';
        // A notification for when a user has triggered their homepage. This is used
        // to display a doorhanger explaining that an extension has modified the
        // homepage, if necessary.
        Services.obs.notifyObservers(win, "browser-open-homepage-start");
      }
    },
    { once: true }
  );
#endif
  return win;
}

/**
 * Update the global flag that tracks whether or not any edit UI (the Edit menu,
 * edit-related items in the context menu, and edit-related toolbar buttons
 * is visible, then update the edit commands' enabled state accordingly.  We use
 * this flag to skip updating the edit commands on focus or selection changes
 * when no UI is visible to improve performance (including pageload performance,
 * since focus changes when you load a new page).
 *
 * If UI is visible, we use goUpdateGlobalEditMenuItems to set the commands'
 * enabled state so the UI will reflect it appropriately.
 *
 * If the UI isn't visible, we enable all edit commands so keyboard shortcuts
 * still work and just lazily disable them as needed when the user presses a
 * shortcut.
 *
 * This doesn't work on Mac, since Mac menus flash when users press their
 * keyboard shortcuts, so edit UI is essentially always visible on the Mac,
 * and we need to always update the edit commands.  Thus on Mac this function
 * is a no op.
 */
function updateEditUIVisibility() {
__L_V__2({
    lN: 4998,tT:'func',pr:'',eT:{},fN:'updateEditUIVisibility'
  });'__L_V__2';
  if (AppConstants.platform == "macosx") {
__L_V__2({
    lN: 4999,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  let editMenuPopupState = document.getElementById("menu_EditPopup").state;
  let contextMenuPopupState = document.getElementById("contentAreaContextMenu")
    .state;
  let placesContextMenuPopupState = document.getElementById("placesContext")
    .state;

  let oldVisible = gEditUIVisible;

  // The UI is visible if the Edit menu is opening or open, if the context menu
  // is open, or if the toolbar has been customized to include the Cut, Copy,
  // or Paste toolbar buttons.
  gEditUIVisible =
    editMenuPopupState == "showing" ||
    editMenuPopupState == "open" ||
    contextMenuPopupState == "showing" ||
    contextMenuPopupState == "open" ||
    placesContextMenuPopupState == "showing" ||
    placesContextMenuPopupState == "open";
  const kOpenPopupStates = ["showing", "open"];
  if (!gEditUIVisible) {
__L_V__2({
    lN: 5022,tT:'if',pr:'!gEditUIVisible',eT:{},fN:''
  });'__L_V__2';
    // Now check the edit-controls toolbar buttons.
    let placement = CustomizableUI.getPlacementOfWidget("edit-controls");
    let areaType = placement ? CustomizableUI.getAreaType(placement.area) : "";
    if (areaType == CustomizableUI.TYPE_MENU_PANEL) {
__L_V__2({
    lN: 5026,tT:'if',pr:'areaType == CustomizableUI.TYPE_MENU_PANEL',eT:{},fN:''
  });'__L_V__2';
      let customizablePanel = PanelUI.overflowPanel;
      gEditUIVisible = kOpenPopupStates.includes(customizablePanel.state);
    } else if (
      areaType == CustomizableUI.TYPE_TOOLBAR &&
      window.toolbar.visible
    ) {
__L_V__2({
    lN: 5032,tT:'if',pr:' areaType == CustomizableUI.TYPE_TOOLBAR && window.toolbar.visible ',eT:{},fN:''
  });'__L_V__2';
      // The edit controls are on a toolbar, so they are visible,
      // unless they're in a panel that isn't visible...
      if (placement.area == "nav-bar") {
__L_V__2({
    lN: 5035,tT:'if',pr:'placement.area == nav-bar',eT:{},fN:''
  });'__L_V__2';
        let editControls = document.getElementById("edit-controls");
        gEditUIVisible =
          !editControls.hasAttribute("overflowedItem") ||
          kOpenPopupStates.includes(
            document.getElementById("widget-overflow").state
          );
      } else {
        gEditUIVisible = true;
      }
    }
  }

  // Now check the main menu panel
  if (!gEditUIVisible) {
__L_V__2({
    lN: 5049,tT:'if',pr:'!gEditUIVisible',eT:{},fN:''
  });'__L_V__2';
    gEditUIVisible = kOpenPopupStates.includes(PanelUI.panel.state);
  }

  // No need to update commands if the edit UI visibility has not changed.
  if (gEditUIVisible == oldVisible) {
__L_V__2({
    lN: 5054,tT:'if',pr:'gEditUIVisible == oldVisible',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  // If UI is visible, update the edit commands' enabled state to reflect
  // whether or not they are actually enabled for the current focus/selection.
  if (gEditUIVisible) {
__L_V__2({
    lN: 5060,tT:'if',pr:'gEditUIVisible',eT:{},fN:''
  });'__L_V__2';
    goUpdateGlobalEditMenuItems();
  } else {
    // Otherwise, enable all commands, so that keyboard shortcuts still work,
    // then lazily determine their actual enabled state when the user presses
    // a keyboard shortcut.
    goSetCommandEnabled("cmd_undo", true);
    goSetCommandEnabled("cmd_redo", true);
    goSetCommandEnabled("cmd_cut", true);
    goSetCommandEnabled("cmd_copy", true);
    goSetCommandEnabled("cmd_paste", true);
    goSetCommandEnabled("cmd_selectAll", true);
    goSetCommandEnabled("cmd_delete", true);
    goSetCommandEnabled("cmd_switchTextDirection", true);
  }
}

/**
 * Opens a new tab with the userContextId specified as an attribute of
 * sourceEvent. This attribute is propagated to the top level originAttributes
 * living on the tab's docShell.
 *
 * @param event
 *        A click event on a userContext File Menu option
 */
function openNewUserContextTab(event) {
__L_V__2({
    lN: 5085,tT:'func',pr:'',eT:{'event':event},fN:'openNewUserContextTab'
  });'__L_V__2';
  openTrustedLinkIn(BROWSER_NEW_TAB_URL, "tab", {
    userContextId: parseInt(event.target.getAttribute("data-usercontextid")),
  });
}

/**
 * Updates User Context Menu Item UI visibility depending on
 * privacy.userContext.enabled pref state.
 */
function updateFileMenuUserContextUIVisibility(id) {
__L_V__2({
    lN: 5095,tT:'func',pr:'',eT:{'id':id},fN:'updateFileMenuUserContextUIVisibility'
  });'__L_V__2';
  let menu = document.getElementById(id);
  menu.hidden = !Services.prefs.getBoolPref(
    "privacy.userContext.enabled",
    false
  );
  // Visibility of File menu item shouldn't change frequently.
  if (PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 5102,tT:'if',pr:'PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
    menu.setAttribute("disabled", "true");
  }
}

/**
 * Updates the User Context UI indicators if the browser is in a non-default context
 */
function updateUserContextUIIndicator() {
__L_V__2({
    lN: 5110,tT:'func',pr:'',eT:{},fN:'updateUserContextUIIndicator'
  });'__L_V__2';
  function replaceContainerClass(classType, element, value) {
__L_V__2({
    lN: 5111,tT:'func',pr:'',eT:{'classType':classType,'element':element,'value':value},fN:'replaceContainerClass'
  });'__L_V__2';
    let prefix = "identity-" + classType + "-";
    if (value && element.classList.contains(prefix + value)) {
__L_V__2({
    lN: 5113,tT:'if',pr:'value && element.classList.contains(prefix + value)',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    for (let className of element.classList) {
      if (className.startsWith(prefix)) {
__L_V__2({
    lN: 5117,tT:'if',pr:'className.startsWith(prefix)',eT:{},fN:''
  });'__L_V__2';
        element.classList.remove(className);
      }
    }
    if (value) {
__L_V__2({
    lN: 5121,tT:'if',pr:'value',eT:{},fN:''
  });'__L_V__2';
      element.classList.add(prefix + value);
    }
  }

  let hbox = document.getElementById("userContext-icons");

  let userContextId = gBrowser.selectedBrowser.getAttribute("usercontextid");
  if (!userContextId) {
__L_V__2({
    lN: 5129,tT:'if',pr:'!userContextId',eT:{},fN:''
  });'__L_V__2';
    replaceContainerClass("color", hbox, "");
    hbox.hidden = true;
    return;
  }

  let identity = ContextualIdentityService.getPublicIdentityFromId(
    userContextId
  );
  if (!identity) {
__L_V__2({
    lN: 5138,tT:'if',pr:'!identity',eT:{},fN:''
  });'__L_V__2';
    replaceContainerClass("color", hbox, "");
    hbox.hidden = true;
    return;
  }

  replaceContainerClass("color", hbox, identity.color);

  let label = ContextualIdentityService.getUserContextLabel(userContextId);
  document.getElementById("userContext-label").setAttribute("value", label);
  // Also set the container label as the tooltip so we can only show the icon
  // in small windows.
  hbox.setAttribute("tooltiptext", label);

  let indicator = document.getElementById("userContext-indicator");
  replaceContainerClass("icon", indicator, identity.icon);

  hbox.hidden = false;
}

/**
 * Makes the Character Encoding menu enabled or disabled as appropriate.
 * To be called when the View menu or the app menu is opened.
 */
function updateCharacterEncodingMenuState() {
__L_V__2({
    lN: 5162,tT:'func',pr:'',eT:{},fN:'updateCharacterEncodingMenuState'
  });'__L_V__2';
  let charsetMenu = document.getElementById("charsetMenu");
  // gBrowser is null on Mac when the menubar shows in the context of
  // non-browser windows. The above elements may be null depending on
  // what parts of the menubar are present. E.g. no app menu on Mac.
  if (gBrowser && gBrowser.selectedBrowser.mayEnableCharacterEncodingMenu) {
__L_V__2({
    lN: 5167,tT:'if',pr:'gBrowser && gBrowser.selectedBrowser.mayEnableCharacterEncodingMenu',eT:{},fN:''
  });'__L_V__2';
    if (charsetMenu) {
__L_V__2({
    lN: 5168,tT:'if',pr:'charsetMenu',eT:{},fN:''
  });'__L_V__2';
      charsetMenu.removeAttribute("disabled");
    }
  } else if (charsetMenu) {
__L_V__2({
    lN: 5171,tT:'if',pr:'charsetMenu',eT:{},fN:''
  });'__L_V__2';
    charsetMenu.setAttribute("disabled", "true");
  }
}

var XULBrowserWindow = {
  // Stored Status, Link and Loading values
  status: "",
  defaultStatus: "",
  overLink: "",
  startTime: 0,
  isBusy: false,
  busyUI: false,

  QueryInterface: ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsIWebProgressListener2",
    "nsISupportsWeakReference",
    "nsIXULBrowserWindow",
  ]),

  get stopCommand() {
__L_V__2({
    lN: 5192,tT:'func',pr:'',eT:{},fN:'stopCommand'
  });'__L_V__2';
    delete this.stopCommand;
    return (this.stopCommand = document.getElementById("Browser:Stop"));
  },
  get reloadCommand() {
__L_V__2({
    lN: 5196,tT:'func',pr:'',eT:{},fN:'reloadCommand'
  });'__L_V__2';
    delete this.reloadCommand;
    return (this.reloadCommand = document.getElementById("Browser:Reload"));
  },
  get _elementsForTextBasedTypes() {
__L_V__2({
    lN: 5200,tT:'func',pr:'',eT:{},fN:'_elementsForTextBasedTypes'
  });'__L_V__2';
    delete this._elementsForTextBasedTypes;
    return (this._elementsForTextBasedTypes = [
      document.getElementById("pageStyleMenu"),
      document.getElementById("context-viewpartialsource-selection"),
    ]);
  },
  get _elementsForFind() {
__L_V__2({
    lN: 5207,tT:'func',pr:'',eT:{},fN:'_elementsForFind'
  });'__L_V__2';
    delete this._elementsForFind;
    return (this._elementsForFind = [
      document.getElementById("cmd_find"),
      document.getElementById("cmd_findAgain"),
      document.getElementById("cmd_findPrevious"),
    ]);
  },
  get _elementsForViewSource() {
__L_V__2({
    lN: 5215,tT:'func',pr:'',eT:{},fN:'_elementsForViewSource'
  });'__L_V__2';
    delete this._elementsForViewSource;
    return (this._elementsForViewSource = [
      document.getElementById("context-viewsource"),
      document.getElementById("View:PageSource"),
    ]);
  },

  forceInitialBrowserNonRemote(aOpener) {
__L_V__2({
    lN: 5223,tT:'func',pr:'',eT:{'aOpener':aOpener},fN:'forceInitialBrowserNonRemote'
  });'__L_V__2';
    gBrowser.updateBrowserRemoteness(gBrowser.selectedBrowser, {
      opener: aOpener,
      remoteType: E10SUtils.NOT_REMOTE,
    });
  },

  setDefaultStatus(status) {
__L_V__2({
    lN: 5230,tT:'func',pr:'',eT:{'status':status},fN:'setDefaultStatus'
  });'__L_V__2';
    this.defaultStatus = status;
    StatusPanel.update();
  },

  setOverLink(url) {
__L_V__2({
    lN: 5235,tT:'func',pr:'',eT:{'url':url},fN:'setOverLink'
  });'__L_V__2';
    if (url) {
__L_V__2({
    lN: 5236,tT:'if',pr:'url',eT:{},fN:''
  });'__L_V__2';
      url = Services.textToSubURI.unEscapeURIForUI("UTF-8", url);

      // Encode bidirectional formatting characters.
      // (RFC 3987 sections 3.2 and 4.1 paragraph 6)
      url = url.replace(
        /[\u200e\u200f\u202a\u202b\u202c\u202d\u202e]/g,
        encodeURIComponent
      );

      if (UrlbarPrefs.get("trimURLs")) {
__L_V__2({
    lN: 5246,tT:'if',pr:'UrlbarPrefs.get(trimURLs)',eT:{},fN:''
  });'__L_V__2';
        url = BrowserUtils.trimURL(url);
      }
    }

    this.overLink = url;
    LinkTargetDisplay.update();
  },

  showTooltip(x, y, tooltip, direction, browser) {
__L_V__2({
    lN: 5255,tT:'func',pr:'',eT:{'x':x,'y':y,'tooltip':tooltip,'direction':direction,'browser':browser},fN:'showTooltip'
  });'__L_V__2';
    if (
      Cc["@mozilla.org/widget/dragservice;1"]
        .getService(Ci.nsIDragService)
        .getCurrentSession()
    ) {
__L_V__2({
    lN: 5260,tT:'if',pr:' Cc[@mozilla.org/widget/dragservice;1] .getService(Ci.nsIDragService) .getCurrentSession() ',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // The x,y coordinates are relative to the <browser> element using
    // the chrome zoom level.
    let elt = document.getElementById("remoteBrowserTooltip");
    elt.label = tooltip;
    elt.style.direction = direction;

    let screenX;
    let screenY;

    if (browser instanceof XULElement) {
__L_V__2({
    lN: 5273,tT:'if',pr:'browser instanceof XULElement',eT:{},fN:''
  });'__L_V__2';
      // XUL element such as <browser> has the `screenX` and `screenY` fields.
      // https://searchfox.org/mozilla-central/source/dom/webidl/XULElement.webidl
      screenX = browser.screenX;
      screenY = browser.screenY;
    } else {
      // In case of HTML element such as <iframe> which RDM uses,
      // calculate the coordinate manually since it does not have the fields.
      const componentBounds = browser.getBoundingClientRect();
      screenX = window.screenX + componentBounds.x;
      screenY = window.screenY + componentBounds.y;
    }

    elt.openPopupAtScreen(screenX + x, screenY + y, false, null);
  },

  hideTooltip() {
__L_V__2({
    lN: 5289,tT:'func',pr:'',eT:{},fN:'hideTooltip'
  });'__L_V__2';
    let elt = document.getElementById("remoteBrowserTooltip");
    elt.hidePopup();
  },

  getTabCount() {
__L_V__2({
    lN: 5294,tT:'func',pr:'',eT:{},fN:'getTabCount'
  });'__L_V__2';
    return gBrowser.tabs.length;
  },

  // Called before links are navigated to to allow us to retarget them if needed.
  onBeforeLinkTraversal(originalTarget, linkURI, linkNode, isAppTab) {
__L_V__2({
    lN: 5299,tT:'func',pr:'',eT:{'originalTarget':originalTarget,'linkURI':linkURI,'linkNode':linkNode,'isAppTab':isAppTab},fN:'onBeforeLinkTraversal'
  });'__L_V__2';
    return BrowserUtils.onBeforeLinkTraversal(
      originalTarget,
      linkURI,
      linkNode,
      isAppTab
    );
  },

  // Check whether this URI should load in the current process
  shouldLoadURI(
    aDocShell,
    aURI,
    aReferrerInfo,
    aHasPostData,
    aTriggeringPrincipal,
    aCsp
  ) {
__L_V__2({
    lN: 5316,tT:'func',pr:'',eT:{'aDocShell':aDocShell,'aURI':aURI,'aReferrerInfo':aReferrerInfo,'aHasPostData':aHasPostData,'aTriggeringPrincipal':aTriggeringPrincipal,'aCsp':aCsp},fN:'shouldLoadURI'
  });'__L_V__2';
    if (!gMultiProcessBrowser) {
__L_V__2({
    lN: 5317,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__2';
      return true;
    }

    let browser = aDocShell
      .QueryInterface(Ci.nsIDocShellTreeItem)
      .sameTypeRootTreeItem.QueryInterface(Ci.nsIDocShell).chromeEventHandler;

    // Ignore loads that aren't in the main tabbrowser
    if (
      browser.localName != "browser" ||
      !browser.getTabBrowser ||
      browser.getTabBrowser() != gBrowser
    ) {
__L_V__2({
    lN: 5330,tT:'if',pr:' browser.localName != browser || !browser.getTabBrowser || browser.getTabBrowser() != gBrowser ',eT:{},fN:''
  });'__L_V__2';
      return true;
    }

    if (!E10SUtils.shouldLoadURI(aDocShell, aURI, aHasPostData)) {
__L_V__2({
    lN: 5334,tT:'if',pr:'!E10SUtils.shouldLoadURI(aDocShell, aURI, aHasPostData)',eT:{},fN:''
  });'__L_V__2';
      // XXX: Do we want to complain if we have post data but are still
      // redirecting the load? Perhaps a telemetry probe? Theoretically we
      // shouldn't do this, as it throws out data. See bug 1348018.
      E10SUtils.redirectLoad(
        aDocShell,
        aURI,
        aReferrerInfo,
        aTriggeringPrincipal,
        false,
        null,
        aCsp
      );
      return false;
    }

    return true;
  },

  onProgressChange(
    aWebProgress,
    aRequest,
    aCurSelfProgress,
    aMaxSelfProgress,
    aCurTotalProgress,
    aMaxTotalProgress
  ) {
__L_V__2({
    lN: 5360,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aCurSelfProgress':aCurSelfProgress,'aMaxSelfProgress':aMaxSelfProgress,'aCurTotalProgress':aCurTotalProgress,'aMaxTotalProgress':aMaxTotalProgress},fN:'onProgressChange'
  });'__L_V__2';
    // Do nothing.
  },

  onProgressChange64(
    aWebProgress,
    aRequest,
    aCurSelfProgress,
    aMaxSelfProgress,
    aCurTotalProgress,
    aMaxTotalProgress
  ) {
__L_V__2({
    lN: 5371,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aCurSelfProgress':aCurSelfProgress,'aMaxSelfProgress':aMaxSelfProgress,'aCurTotalProgress':aCurTotalProgress,'aMaxTotalProgress':aMaxTotalProgress},fN:'onProgressChange64'
  });'__L_V__2';
    return this.onProgressChange(
      aWebProgress,
      aRequest,
      aCurSelfProgress,
      aMaxSelfProgress,
      aCurTotalProgress,
      aMaxTotalProgress
    );
  },

  // This function fires only for the currently selected tab.
  onStateChange(aWebProgress, aRequest, aStateFlags, aStatus) {
__L_V__2({
    lN: 5383,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aStateFlags':aStateFlags,'aStatus':aStatus},fN:'onStateChange'
  });'__L_V__2';
    const nsIWebProgressListener = Ci.nsIWebProgressListener;

    let browser = gBrowser.selectedBrowser;

#if 0
    gProtectionsHandler.onStateChange(aWebProgress, aStateFlags);
#endif

    if (
      aStateFlags & nsIWebProgressListener.STATE_START &&
      aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK
    ) {
__L_V__2({
    lN: 5395,tT:'if',pr:' aStateFlags & nsIWebProgressListener.STATE_START && aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK ',eT:{},fN:''
  });'__L_V__2';
      if (aRequest && aWebProgress.isTopLevel) {
__L_V__2({
    lN: 5396,tT:'if',pr:'aRequest && aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__2';
        // clear out search-engine data
        browser.engines = null;
      }

      this.isBusy = true;

      if (!(aStateFlags & nsIWebProgressListener.STATE_RESTORING)) {
__L_V__2({
    lN: 5403,tT:'if',pr:'!(aStateFlags & nsIWebProgressListener.STATE_RESTORING)',eT:{},fN:''
  });'__L_V__2';
        this.busyUI = true;

        // XXX: This needs to be based on window activity...
        this.stopCommand.removeAttribute("disabled");
        CombinedStopReload.switchToStop(aRequest, aWebProgress);
      }
    } else if (aStateFlags & nsIWebProgressListener.STATE_STOP) {
__L_V__2({
    lN: 5410,tT:'if',pr:'aStateFlags & nsIWebProgressListener.STATE_STOP',eT:{},fN:''
  });'__L_V__2';
      // This (thanks to the filter) is a network stop or the last
      // request stop outside of loading the document, stop throbbers
      // and progress bars and such
      if (aRequest) {
__L_V__2({
    lN: 5414,tT:'if',pr:'aRequest',eT:{},fN:''
  });'__L_V__2';
        let msg = "";
        let location;
        let canViewSource = true;
        // Get the URI either from a channel or a pseudo-object
        if (aRequest instanceof Ci.nsIChannel || "URI" in aRequest) {
__L_V__2({
    lN: 5419,tT:'if',pr:'aRequest instanceof Ci.nsIChannel || URI in aRequest',eT:{},fN:''
  });'__L_V__2';
          location = aRequest.URI;

          // For keyword URIs clear the user typed value since they will be changed into real URIs
          if (location.scheme == "keyword" && aWebProgress.isTopLevel) {
__L_V__2({
    lN: 5423,tT:'if',pr:'location.scheme == keyword && aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__2';
            gBrowser.userTypedValue = null;
          }

          canViewSource = location.scheme != "view-source";

          if (location.spec != "about:blank") {
__L_V__2({
    lN: 5429,tT:'if',pr:'location.spec != about:blank',eT:{},fN:''
  });'__L_V__2';
__L_V__2({
    lN: 5430,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
            switch (aStatus) {
              case Cr.NS_ERROR_NET_TIMEOUT:
                msg = gNavigatorBundle.getString("nv_timeout");
                break;
            }
          }
        }

        this.status = "";
        this.setDefaultStatus(msg);

        // Disable View Source menu entries for images, enable otherwise
        let isText =
          browser.documentContentType &&
          BrowserUtils.mimeTypeIsTextBased(browser.documentContentType);
        for (let element of this._elementsForViewSource) {
          if (canViewSource && isText) {
__L_V__2({
    lN: 5446,tT:'if',pr:'canViewSource && isText',eT:{},fN:''
  });'__L_V__2';
            element.removeAttribute("disabled");
          } else {
            element.setAttribute("disabled", "true");
          }
        }

        this._updateElementsForContentType();
      }

      this.isBusy = false;

      if (this.busyUI) {
__L_V__2({
    lN: 5458,tT:'if',pr:'this.busyUI',eT:{},fN:''
  });'__L_V__2';
        this.busyUI = false;

        this.stopCommand.setAttribute("disabled", "true");
        CombinedStopReload.switchToReload(aRequest, aWebProgress);
      }
    }
  },

  onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags, aIsSimulated) {
__L_V__2({
    lN: 5467,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aLocationURI':aLocationURI,'aFlags':aFlags,'aIsSimulated':aIsSimulated},fN:'onLocationChange'
  });'__L_V__2';
    var location = aLocationURI ? aLocationURI.spec : "";

    this.hideOverLinkImmediately = true;
    this.setOverLink("");
    this.hideOverLinkImmediately = false;

    // We should probably not do this if the value has changed since the user
    // searched
    // Update urlbar only if a new page was loaded on the primary content area
    // Do not update urlbar if there was a subframe navigation

    if (aWebProgress.isTopLevel) {
__L_V__2({
    lN: 5479,tT:'if',pr:'aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__2';
      if (
        (location == "about:blank" && checkEmptyPageOrigin()) ||
        location == ""
      ) {
__L_V__2({
    lN: 5483,tT:'if',pr:' (location == about:blank && checkEmptyPageOrigin()) || location == ',eT:{},fN:''
  });'__L_V__2';
        // Second condition is for new tabs, otherwise
        // reload function is enabled until tab is refreshed.
        this.reloadCommand.setAttribute("disabled", "true");
      } else {
        this.reloadCommand.removeAttribute("disabled");
      }

      // We want to update the popup visibility if we received this notification
      // via simulated locationchange events such as switching between tabs, however
      // if this is a document navigation then PopupNotifications will be updated
      // via TabsProgressListener.onLocationChange and we do not want it called twice
      gURLBar.setURI(aLocationURI, aIsSimulated);

      BookmarkingUI.onLocationChange();

      gIdentityHandler.onLocationChange();

#if 0
      gProtectionsHandler.onLocationChange();
#endif

      BrowserPageActions.onLocationChange();

      SafeBrowsingNotificationBox.onLocationChange(aLocationURI);

      UrlbarProviderSearchTips.onLocationChange(aLocationURI);

      gTabletModePageCounter.inc();

      this._updateElementsForContentType();

      // Try not to instantiate gCustomizeMode as much as possible,
      // so don't use CustomizeMode.jsm to check for URI or customizing.
      if (
        location == "about:blank" &&
        gBrowser.selectedTab.hasAttribute("customizemode")
      ) {
__L_V__2({
    lN: 5520,tT:'if',pr:' location == about:blank && gBrowser.selectedTab.hasAttribute(customizemode) ',eT:{},fN:''
  });'__L_V__2';
        gCustomizeMode.enter();
      } else if (
        CustomizationHandler.isEnteringCustomizeMode ||
        CustomizationHandler.isCustomizing()
      ) {
__L_V__2({
    lN: 5525,tT:'if',pr:' CustomizationHandler.isEnteringCustomizeMode || CustomizationHandler.isCustomizing() ',eT:{},fN:''
  });'__L_V__2';
        gCustomizeMode.exit();
      }

#ifdef MOZ_ACTIVITY_STREAM
      CFRPageActions.updatePageActions(gBrowser.selectedBrowser);
#endif
    }
    Services.obs.notifyObservers(null, "touchbar-location-change", location);
    UpdateBackForwardCommands(gBrowser.webNavigation);
    ReaderParent.updateReaderButton(gBrowser.selectedBrowser);

    if (!gMultiProcessBrowser) {
__L_V__2({
    lN: 5537,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__2';
      // Bug 1108553 - Cannot rotate images with e10s
      gGestureSupport.restoreRotationState();
    }

    // See bug 358202, when tabs are switched during a drag operation,
    // timers don't fire on windows (bug 203573)
    if (aRequest) {
__L_V__2({
    lN: 5544,tT:'if',pr:'aRequest',eT:{},fN:''
  });'__L_V__2';
      setTimeout(function() {
        XULBrowserWindow.asyncUpdateUI();
      }, 0);
    } else {
      this.asyncUpdateUI();
    }

    if (AppConstants.MOZ_CRASHREPORTER && aLocationURI) {
__L_V__2({
    lN: 5552,tT:'if',pr:'AppConstants.MOZ_CRASHREPORTER && aLocationURI',eT:{},fN:''
  });'__L_V__2';
      let uri = aLocationURI;
      try {
        // If the current URI contains a username/password, remove it.
        uri = aLocationURI
          .mutate()
          .setUserPass("")
          .finalize();
      } catch (ex) {
        /* Ignore failures on about: URIs. */
      }

      try {
        gCrashReporter.annotateCrashReport("URL", uri.spec);
      } catch (ex) {
        // Don't make noise when the crash reporter is built but not enabled.
        if (ex.result != Cr.NS_ERROR_NOT_INITIALIZED) {
__L_V__2({
    lN: 5568,tT:'if',pr:'ex.result != Cr.NS_ERROR_NOT_INITIALIZED',eT:{},fN:''
  });'__L_V__2';
          throw ex;
        }
      }
    }
  },

  _updateElementsForContentType() {
__L_V__2({
    lN: 5575,tT:'func',pr:'',eT:{},fN:'_updateElementsForContentType'
  });'__L_V__2';
    let browser = gBrowser.selectedBrowser;

    let isText =
      browser.documentContentType &&
      BrowserUtils.mimeTypeIsTextBased(browser.documentContentType);
    for (let element of this._elementsForTextBasedTypes) {
      if (isText) {
__L_V__2({
    lN: 5582,tT:'if',pr:'isText',eT:{},fN:''
  });'__L_V__2';
        element.removeAttribute("disabled");
      } else {
        element.setAttribute("disabled", "true");
      }
    }

    // Always enable find commands in PDF documents, otherwise do it only for
    // text documents whose location is not in the blacklist.
    let enableFind =
      browser.documentContentType == "application/pdf" ||
      (isText && BrowserUtils.canFindInPage(gBrowser.currentURI.spec));
    for (let element of this._elementsForFind) {
      if (enableFind) {
__L_V__2({
    lN: 5595,tT:'if',pr:'enableFind',eT:{},fN:''
  });'__L_V__2';
        element.removeAttribute("disabled");
      } else {
        element.setAttribute("disabled", "true");
      }
    }
  },

  asyncUpdateUI() {
__L_V__2({
    lN: 5603,tT:'func',pr:'',eT:{},fN:'asyncUpdateUI'
  });'__L_V__2';
    BrowserSearch.updateOpenSearchBadge();
  },

  onStatusChange(aWebProgress, aRequest, aStatus, aMessage) {
__L_V__2({
    lN: 5607,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aStatus':aStatus,'aMessage':aMessage},fN:'onStatusChange'
  });'__L_V__2';
    this.status = aMessage;
    StatusPanel.update();
  },

  // Properties used to cache security state used to update the UI
  _state: null,
  _lastLocation: null,
  _event: null,
  _lastLocationForEvent: null,

#if 0
  // CLIQZ-MERGE: check errors in console
  // This is called in multiple ways:
  //  1. Due to the nsIWebProgressListener.onContentBlockingEvent notification.
  //  2. Called by tabbrowser.xml when updating the current browser.
  //  3. Called directly during this object's initializations.
  //  4. Due to the nsIWebProgressListener.onLocationChange notification.
  // aRequest will be null always in case 2 and 3, and sometimes in case 1 (for
  // instance, there won't be a request when STATE_BLOCKED_TRACKING_CONTENT or
  // other blocking events are observed).
  onContentBlockingEvent(aWebProgress, aRequest, aEvent, aIsSimulated) {
__L_V__2({
    lN: 5628,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aEvent':aEvent,'aIsSimulated':aIsSimulated},fN:'onContentBlockingEvent'
  });'__L_V__2';
    // Don't need to do anything if the data we use to update the UI hasn't
    // changed
    let uri = gBrowser.currentURI;
    let spec = uri.spec;
    if (this._event == aEvent && this._lastLocationForEvent == spec) {
__L_V__2({
    lN: 5633,tT:'if',pr:'this._event == aEvent && this._lastLocationForEvent == spec',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    this._lastLocationForEvent = spec;

    if (
      typeof aIsSimulated != "boolean" &&
      typeof aIsSimulated != "undefined"
    ) {
__L_V__2({
    lN: 5641,tT:'if',pr:' typeof aIsSimulated != boolean && typeof aIsSimulated != undefined ',eT:{},fN:''
  });'__L_V__2';
      throw new Error(
        "onContentBlockingEvent: aIsSimulated receieved an unexpected type"
      );
    }

    gProtectionsHandler.onContentBlockingEvent(
      aEvent,
      aWebProgress,
      aIsSimulated,
      this._event // previous content blocking event
    );

    // We need the state of the previous content blocking event, so update
    // event after onContentBlockingEvent is called.
    this._event = aEvent;
  },
#endif

  // This is called in multiple ways:
  //  1. Due to the nsIWebProgressListener.onSecurityChange notification.
  //  2. Called by tabbrowser.xml when updating the current browser.
  //  3. Called directly during this object's initializations.
  // aRequest will be null always in case 2 and 3, and sometimes in case 1.
  onSecurityChange(aWebProgress, aRequest, aState, aIsSimulated) {
__L_V__2({
    lN: 5665,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aState':aState,'aIsSimulated':aIsSimulated},fN:'onSecurityChange'
  });'__L_V__2';
    // Don't need to do anything if the data we use to update the UI hasn't
    // changed
    let uri = gBrowser.currentURI;
    let spec = uri.spec;
    if (this._state == aState && this._lastLocation == spec) {
__L_V__2({
    lN: 5670,tT:'if',pr:'this._state == aState && this._lastLocation == spec',eT:{},fN:''
  });'__L_V__2';
      // Switching to a tab of the same URL doesn't change most security
      // information, but tab specific permissions may be different.
      gIdentityHandler.refreshIdentityBlock();
      return;
    }
    this._state = aState;
    this._lastLocation = spec;

    // Make sure the "https" part of the URL is striked out or not,
    // depending on the current mixed active content blocking state.
    gURLBar.formatValue();

    try {
      uri = Services.uriFixup.createExposableURI(uri);
    } catch (e) {}
    gIdentityHandler.updateIdentity(this._state, uri);
  },

  // simulate all change notifications after switching tabs
  onUpdateCurrentBrowser: function XWB_onUpdateCurrentBrowser(
    aStateFlags,
    aStatus,
    aMessage,
    aTotalProgress
  ) {
__L_V__2({
    lN: 5695,tT:'func',pr:'',eT:{'aStateFlags':aStateFlags,'aStatus':aStatus,'aMessage':aMessage,'aTotalProgress':aTotalProgress},fN:'XWB_onUpdateCurrentBrowser'
  });'__L_V__2';
    if (FullZoom.updateBackgroundTabs) {
__L_V__2({
    lN: 5696,tT:'if',pr:'FullZoom.updateBackgroundTabs',eT:{},fN:''
  });'__L_V__2';
      FullZoom.onLocationChange(gBrowser.currentURI, true);
    }

    CombinedStopReload.onTabSwitch();

    // Docshell should normally take care of hiding the tooltip, but we need to do it
    // ourselves for tabswitches.
    this.hideTooltip();

    // Also hide tooltips for content loaded in the parent process:
    document.getElementById("aHTMLTooltip").hidePopup();

    var nsIWebProgressListener = Ci.nsIWebProgressListener;
    var loadingDone = aStateFlags & nsIWebProgressListener.STATE_STOP;
    // use a pseudo-object instead of a (potentially nonexistent) channel for getting
    // a correct error message - and make sure that the UI is always either in
    // loading (STATE_START) or done (STATE_STOP) mode
    this.onStateChange(
      gBrowser.webProgress,
      { URI: gBrowser.currentURI },
      loadingDone
        ? nsIWebProgressListener.STATE_STOP
        : nsIWebProgressListener.STATE_START,
      aStatus
    );
    // status message and progress value are undefined if we're done with loading
    if (loadingDone) {
__L_V__2({
    lN: 5723,tT:'if',pr:'loadingDone',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    this.onStatusChange(gBrowser.webProgress, null, 0, aMessage);
  },

  navigateAndRestoreByIndex: function XWB_navigateAndRestoreByIndex(
    aBrowser,
    aIndex
  ) {
__L_V__2({
    lN: 5732,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aIndex':aIndex},fN:'XWB_navigateAndRestoreByIndex'
  });'__L_V__2';
    let tab = gBrowser.getTabForBrowser(aBrowser);
    if (tab) {
__L_V__2({
    lN: 5734,tT:'if',pr:'tab',eT:{},fN:''
  });'__L_V__2';
      SessionStore.navigateAndRestore(tab, {}, aIndex);
      return;
    }

    throw new Error(
      "Trying to navigateAndRestore a browser which was " +
        "not attached to this tabbrowser is unsupported"
    );
  },
};

var LinkTargetDisplay = {
  get DELAY_SHOW() {
__L_V__2({
    lN: 5747,tT:'func',pr:'',eT:{},fN:'DELAY_SHOW'
  });'__L_V__2';
    delete this.DELAY_SHOW;
    return (this.DELAY_SHOW = Services.prefs.getIntPref(
      "browser.overlink-delay"
    ));
  },

  DELAY_HIDE: 250,
  _timer: 0,

  update() {
__L_V__2({
    lN: 5757,tT:'func',pr:'',eT:{},fN:'update'
  });'__L_V__2';
    clearTimeout(this._timer);
    window.removeEventListener("mousemove", this, true);

    if (!XULBrowserWindow.overLink) {
__L_V__2({
    lN: 5761,tT:'if',pr:'!XULBrowserWindow.overLink',eT:{},fN:''
  });'__L_V__2';
      if (XULBrowserWindow.hideOverLinkImmediately) {
__L_V__2({
    lN: 5762,tT:'if',pr:'XULBrowserWindow.hideOverLinkImmediately',eT:{},fN:''
  });'__L_V__2';
        this._hide();
      } else {
        this._timer = setTimeout(this._hide.bind(this), this.DELAY_HIDE);
      }
      return;
    }

    if (StatusPanel.isVisible) {
__L_V__2({
    lN: 5770,tT:'if',pr:'StatusPanel.isVisible',eT:{},fN:''
  });'__L_V__2';
      StatusPanel.update();
    } else {
      // Let the display appear when the mouse doesn't move within the delay
      this._showDelayed();
      window.addEventListener("mousemove", this, true);
    }
  },

  handleEvent(event) {
__L_V__2({
    lN: 5779,tT:'func',pr:'',eT:{'event':event},fN:'handleEvent'
  });'__L_V__2';
__L_V__2({
    lN: 5780,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
    switch (event.type) {
      case "mousemove":
        // Restart the delay since the mouse was moved
        clearTimeout(this._timer);
        this._showDelayed();
        break;
    }
  },

  _showDelayed() {
__L_V__2({
    lN: 5789,tT:'func',pr:'',eT:{},fN:'_showDelayed'
  });'__L_V__2';
    this._timer = setTimeout(
      function(self) {
__L_V__2({
    lN: 5791,tT:'func',pr:'',eT:{'self':self},fN:'function'
  });'__L_V__2';
        StatusPanel.update();
        window.removeEventListener("mousemove", self, true);
      },
      this.DELAY_SHOW,
      this
    );
  },

  _hide() {
__L_V__2({
    lN: 5800,tT:'func',pr:'',eT:{},fN:'_hide'
  });'__L_V__2';
    clearTimeout(this._timer);

    StatusPanel.update();
  },
};

var CombinedStopReload = {
  // Try to initialize. Returns whether initialization was successful, which
  // may mean we had already initialized.
  ensureInitialized() {
__L_V__2({
    lN: 5810,tT:'func',pr:'',eT:{},fN:'ensureInitialized'
  });'__L_V__2';
    if (this._initialized) {
__L_V__2({
    lN: 5811,tT:'if',pr:'this._initialized',eT:{},fN:''
  });'__L_V__2';
      return true;
    }
    if (this._destroyed) {
__L_V__2({
    lN: 5814,tT:'if',pr:'this._destroyed',eT:{},fN:''
  });'__L_V__2';
      return false;
    }

    let reload = document.getElementById("reload-button");
    let stop = document.getElementById("stop-button");
    // It's possible the stop/reload buttons have been moved to the palette.
    // They may be reinserted later, so we will retry initialization if/when
    // we get notified of document loads.
    if (!stop || !reload) {
__L_V__2({
    lN: 5823,tT:'if',pr:'!stop || !reload',eT:{},fN:''
  });'__L_V__2';
      return false;
    }

    this._initialized = true;
    if (XULBrowserWindow.stopCommand.getAttribute("disabled") != "true") {
__L_V__2({
    lN: 5828,tT:'if',pr:'XULBrowserWindow.stopCommand.getAttribute(disabled) != true',eT:{},fN:''
  });'__L_V__2';
      reload.setAttribute("displaystop", "true");
    }
    stop.addEventListener("click", this);

    // Removing attributes based on the observed command doesn't happen if the button
    // is in the palette when the command's attribute is removed (cf. bug 309953)
    for (let button of [stop, reload]) {
      if (button.hasAttribute("disabled")) {
__L_V__2({
    lN: 5836,tT:'if',pr:'button.hasAttribute(disabled)',eT:{},fN:''
  });'__L_V__2';
        let command = document.getElementById(button.getAttribute("command"));
        if (!command.hasAttribute("disabled")) {
__L_V__2({
    lN: 5838,tT:'if',pr:'!command.hasAttribute(disabled)',eT:{},fN:''
  });'__L_V__2';
          button.removeAttribute("disabled");
        }
      }
    }

    this.reload = reload;
    this.stop = stop;
    this.stopReloadContainer = this.reload.parentNode;
    this.timeWhenSwitchedToStop = 0;

    if (this._shouldStartPrefMonitoring) {
__L_V__2({
    lN: 5849,tT:'if',pr:'this._shouldStartPrefMonitoring',eT:{},fN:''
  });'__L_V__2';
      this.startAnimationPrefMonitoring();
    }
    return true;
  },

  uninit() {
__L_V__2({
    lN: 5855,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    this._destroyed = true;

    if (!this._initialized) {
__L_V__2({
    lN: 5858,tT:'if',pr:'!this._initialized',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    Services.prefs.removeObserver("toolkit.cosmeticAnimations.enabled", this);
    this._cancelTransition();
    this.stop.removeEventListener("click", this);
    this.stopReloadContainer.removeEventListener("animationend", this);
    this.stopReloadContainer.removeEventListener("animationcancel", this);
    this.stopReloadContainer = null;
    this.reload = null;
    this.stop = null;
  },

  handleEvent(event) {
__L_V__2({
    lN: 5872,tT:'func',pr:'',eT:{'event':event},fN:'handleEvent'
  });'__L_V__2';
__L_V__2({
    lN: 5873,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
    switch (event.type) {
      case "click":
        if (event.button == 0 && !this.stop.disabled) {
__L_V__2({
    lN: 5875,tT:'if',pr:'event.button == 0 && !this.stop.disabled',eT:{},fN:''
  });'__L_V__2';
          this._stopClicked = true;
        }
        break;
      case "animationcancel":
      case "animationend": {
        if (
          event.target.classList.contains("toolbarbutton-animatable-image") &&
          (event.animationName == "reload-to-stop" ||
            event.animationName == "stop-to-reload" ||
            event.animationName == "reload-to-stop-rtl" ||
            event.animationName == "stop-to-reload-rtl")
        ) {
__L_V__2({
    lN: 5887,tT:'if',pr:' event.target.classList.contains(toolbarbutton-animatable-image) && (event.animationName == reload-to-stop || event.animationName == stop-to-reload || event.animationName == reload-to-stop-rtl || event.animationName == stop-to-reload-rtl) ',eT:{},fN:''
  });'__L_V__2';
          this.stopReloadContainer.removeAttribute("animate");
        }
      }
    }
  },

  observe(subject, topic, data) {
__L_V__2({
    lN: 5894,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    if (topic == "nsPref:changed") {
__L_V__2({
    lN: 5895,tT:'if',pr:'topic == nsPref:changed',eT:{},fN:''
  });'__L_V__2';
      this.animate = Services.prefs.getBoolPref(
        "toolkit.cosmeticAnimations.enabled"
      );
    }
  },

  startAnimationPrefMonitoring() {
__L_V__2({
    lN: 5902,tT:'func',pr:'',eT:{},fN:'startAnimationPrefMonitoring'
  });'__L_V__2';
    // CombinedStopReload may have been uninitialized before the idleCallback is executed.
    if (this._destroyed) {
__L_V__2({
    lN: 5904,tT:'if',pr:'this._destroyed',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    if (!this.ensureInitialized()) {
__L_V__2({
    lN: 5907,tT:'if',pr:'!this.ensureInitialized()',eT:{},fN:''
  });'__L_V__2';
      this._shouldStartPrefMonitoring = true;
      return;
    }
    this.animate =
      Services.prefs.getBoolPref("toolkit.cosmeticAnimations.enabled") &&
      Services.prefs.getBoolPref("browser.stopReloadAnimation.enabled");
    Services.prefs.addObserver("toolkit.cosmeticAnimations.enabled", this);
    this.stopReloadContainer.addEventListener("animationend", this);
    this.stopReloadContainer.addEventListener("animationcancel", this);
  },

  onTabSwitch() {
__L_V__2({
    lN: 5919,tT:'func',pr:'',eT:{},fN:'onTabSwitch'
  });'__L_V__2';
    // Reset the time in the event of a tabswitch since the stored time
    // would have been associated with the previous tab, so the animation will
    // still run if the page has been loading until long after the tab switch.
    this.timeWhenSwitchedToStop = window.performance.now();
  },

  switchToStop(aRequest, aWebProgress) {
__L_V__2({
    lN: 5926,tT:'func',pr:'',eT:{'aRequest':aRequest,'aWebProgress':aWebProgress},fN:'switchToStop'
  });'__L_V__2';
    if (
      !this.ensureInitialized() ||
      !this._shouldSwitch(aRequest, aWebProgress)
    ) {
__L_V__2({
    lN: 5930,tT:'if',pr:' !this.ensureInitialized() || !this._shouldSwitch(aRequest, aWebProgress) ',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // Store the time that we switched to the stop button only if a request
    // is active. Requests are null if the switch is related to a tabswitch.
    // This is used to determine if we should show the stop->reload animation.
    if (aRequest instanceof Ci.nsIRequest) {
__L_V__2({
    lN: 5937,tT:'if',pr:'aRequest instanceof Ci.nsIRequest',eT:{},fN:''
  });'__L_V__2';
      this.timeWhenSwitchedToStop = window.performance.now();
    }

    let shouldAnimate =
      aRequest instanceof Ci.nsIRequest &&
      aWebProgress.isTopLevel &&
      aWebProgress.isLoadingDocument &&
      !gBrowser.tabAnimationsInProgress &&
      this.stopReloadContainer.closest("#nav-bar-customization-target") &&
      this.animate;

    this._cancelTransition();
    if (shouldAnimate) {
__L_V__2({
    lN: 5950,tT:'if',pr:'shouldAnimate',eT:{},fN:''
  });'__L_V__2';
      BrowserUtils.setToolbarButtonHeightProperty(this.stopReloadContainer);
      this.stopReloadContainer.setAttribute("animate", "true");
    } else {
      this.stopReloadContainer.removeAttribute("animate");
    }
    this.reload.setAttribute("displaystop", "true");
  },

  switchToReload(aRequest, aWebProgress) {
__L_V__2({
    lN: 5959,tT:'func',pr:'',eT:{'aRequest':aRequest,'aWebProgress':aWebProgress},fN:'switchToReload'
  });'__L_V__2';
    if (!this.ensureInitialized() || !this.reload.hasAttribute("displaystop")) {
__L_V__2({
    lN: 5960,tT:'if',pr:'!this.ensureInitialized() || !this.reload.hasAttribute(displaystop)',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    let shouldAnimate =
      aRequest instanceof Ci.nsIRequest &&
      aWebProgress.isTopLevel &&
      !aWebProgress.isLoadingDocument &&
      !gBrowser.tabAnimationsInProgress &&
      this._loadTimeExceedsMinimumForAnimation() &&
      this.stopReloadContainer.closest("#nav-bar-customization-target") &&
      this.animate;

    if (shouldAnimate) {
__L_V__2({
    lN: 5973,tT:'if',pr:'shouldAnimate',eT:{},fN:''
  });'__L_V__2';
      BrowserUtils.setToolbarButtonHeightProperty(this.stopReloadContainer);
      this.stopReloadContainer.setAttribute("animate", "true");
    } else {
      this.stopReloadContainer.removeAttribute("animate");
    }

    this.reload.removeAttribute("displaystop");

    if (!shouldAnimate || this._stopClicked) {
__L_V__2({
    lN: 5982,tT:'if',pr:'!shouldAnimate || this._stopClicked',eT:{},fN:''
  });'__L_V__2';
      this._stopClicked = false;
      this._cancelTransition();
      this.reload.disabled =
        XULBrowserWindow.reloadCommand.getAttribute("disabled") == "true";
      return;
    }

    if (this._timer) {
__L_V__2({
    lN: 5990,tT:'if',pr:'this._timer',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // Temporarily disable the reload button to prevent the user from
    // accidentally reloading the page when intending to click the stop button
    this.reload.disabled = true;
    this._timer = setTimeout(
      function(self) {
__L_V__2({
    lN: 5998,tT:'func',pr:'',eT:{'self':self},fN:'function'
  });'__L_V__2';
        self._timer = 0;
        self.reload.disabled =
          XULBrowserWindow.reloadCommand.getAttribute("disabled") == "true";
      },
      650,
      this
    );
  },

  _loadTimeExceedsMinimumForAnimation() {
__L_V__2({
    lN: 6008,tT:'func',pr:'',eT:{},fN:'_loadTimeExceedsMinimumForAnimation'
  });'__L_V__2';
    // If the time between switching to the stop button then switching to
    // the reload button exceeds 150ms, then we will show the animation.
    // If we don't know when we switched to stop (switchToStop is called
    // after init but before switchToReload), then we will prevent the
    // animation from occuring.
    return (
      this.timeWhenSwitchedToStop &&
      window.performance.now() - this.timeWhenSwitchedToStop > 150
    );
  },

  _shouldSwitch(aRequest, aWebProgress) {
__L_V__2({
    lN: 6020,tT:'func',pr:'',eT:{'aRequest':aRequest,'aWebProgress':aWebProgress},fN:'_shouldSwitch'
  });'__L_V__2';
    if (
      aRequest &&
      aRequest.originalURI &&
      (aRequest.originalURI.schemeIs("chrome") ||
        (aRequest.originalURI.schemeIs("about") &&
          aWebProgress.isTopLevel &&
          !aRequest.originalURI.spec.startsWith("about:reader")))
    ) {
__L_V__2({
    lN: 6028,tT:'if',pr:' aRequest && aRequest.originalURI && (aRequest.originalURI.schemeIs(chrome) || (aRequest.originalURI.schemeIs(about) && aWebProgress.isTopLevel && !aRequest.originalURI.spec.startsWith(about:reader))) ',eT:{},fN:''
  });'__L_V__2';
      return false;
    }

    return true;
  },

  _cancelTransition() {
__L_V__2({
    lN: 6035,tT:'func',pr:'',eT:{},fN:'_cancelTransition'
  });'__L_V__2';
    if (this._timer) {
__L_V__2({
    lN: 6036,tT:'if',pr:'this._timer',eT:{},fN:''
  });'__L_V__2';
      clearTimeout(this._timer);
      this._timer = 0;
    }
  },
};

// This helper only cares about loading the frame
// script if the pref is seen as true.
// After the frame script is loaded, it takes over
// the responsibility of watching the pref and
// enabling/disabling itself.
const AccessibilityRefreshBlocker = {
  PREF: "accessibility.blockautorefresh",

  init() {
__L_V__2({
    lN: 6051,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    if (Services.prefs.getBoolPref(this.PREF)) {
__L_V__2({
    lN: 6052,tT:'if',pr:'Services.prefs.getBoolPref(this.PREF)',eT:{},fN:''
  });'__L_V__2';
      this.loadFrameScript();
    } else {
      Services.prefs.addObserver(this.PREF, this);
    }
  },

  uninit() {
__L_V__2({
    lN: 6059,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    Services.prefs.removeObserver(this.PREF, this);
  },

  observe(aSubject, aTopic, aPrefName) {
__L_V__2({
    lN: 6063,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aPrefName':aPrefName},fN:'observe'
  });'__L_V__2';
    if (
      aTopic == "nsPref:changed" &&
      aPrefName == this.PREF &&
      Services.prefs.getBoolPref(this.PREF)
    ) {
__L_V__2({
    lN: 6068,tT:'if',pr:' aTopic == nsPref:changed && aPrefName == this.PREF && Services.prefs.getBoolPref(this.PREF) ',eT:{},fN:''
  });'__L_V__2';
      this.loadFrameScript();
      Services.prefs.removeObserver(this.PREF, this);
    }
  },

  loadFrameScript() {
__L_V__2({
    lN: 6074,tT:'func',pr:'',eT:{},fN:'loadFrameScript'
  });'__L_V__2';
    if (!this._loaded) {
__L_V__2({
    lN: 6075,tT:'if',pr:'!this._loaded',eT:{},fN:''
  });'__L_V__2';
      this._loaded = true;
      let mm = window.getGroupMessageManager("browsers");
      mm.loadFrameScript(
        "chrome://browser/content/content-refreshblocker.js",
        true,
        true
      );
    }
  },
};

var TabsProgressListener = {
  onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
__L_V__2({
    lN: 6088,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aWebProgress':aWebProgress,'aRequest':aRequest,'aStateFlags':aStateFlags,'aStatus':aStatus},fN:'onStateChange'
  });'__L_V__2';
    // Collect telemetry data about tab load times.
    if (
      aWebProgress.isTopLevel &&
      (!aRequest.originalURI || aRequest.originalURI.scheme != "about")
    ) {
__L_V__2({
    lN: 6093,tT:'if',pr:' aWebProgress.isTopLevel && (!aRequest.originalURI || aRequest.originalURI.scheme != about) ',eT:{},fN:''
  });'__L_V__2';
      let histogram = "FX_PAGE_LOAD_MS_2";
      let recordLoadTelemetry = true;

      if (aWebProgress.loadType & Ci.nsIDocShell.LOAD_CMD_RELOAD) {
__L_V__2({
    lN: 6097,tT:'if',pr:'aWebProgress.loadType & Ci.nsIDocShell.LOAD_CMD_RELOAD',eT:{},fN:''
  });'__L_V__2';
        // loadType is constructed by shifting loadFlags, this is why we need to
        // do the same shifting here.
        // https://searchfox.org/mozilla-central/rev/11cfa0462a6b5d8c5e2111b8cfddcf78098f0141/docshell/base/nsDocShellLoadTypes.h#22
        if (aWebProgress.loadType & (kSkipCacheFlags << 16)) {
__L_V__2({
    lN: 6101,tT:'if',pr:'aWebProgress.loadType & (kSkipCacheFlags << 16)',eT:{},fN:''
  });'__L_V__2';
          histogram = "FX_PAGE_RELOAD_SKIP_CACHE_MS";
        } else if (aWebProgress.loadType == Ci.nsIDocShell.LOAD_CMD_RELOAD) {
__L_V__2({
    lN: 6103,tT:'if',pr:'aWebProgress.loadType == Ci.nsIDocShell.LOAD_CMD_RELOAD',eT:{},fN:''
  });'__L_V__2';
          histogram = "FX_PAGE_RELOAD_NORMAL_MS";
        } else {
          recordLoadTelemetry = false;
        }
      }

      let stopwatchRunning = TelemetryStopwatch.running(histogram, aBrowser);
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW) {
__L_V__2({
    lN: 6111,tT:'if',pr:'aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW',eT:{},fN:''
  });'__L_V__2';
        if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
__L_V__2({
    lN: 6112,tT:'if',pr:'aStateFlags & Ci.nsIWebProgressListener.STATE_START',eT:{},fN:''
  });'__L_V__2';
          if (stopwatchRunning) {
__L_V__2({
    lN: 6113,tT:'if',pr:'stopwatchRunning',eT:{},fN:''
  });'__L_V__2';
            // Oops, we're seeing another start without having noticed the previous stop.
            if (recordLoadTelemetry) {
__L_V__2({
    lN: 6115,tT:'if',pr:'recordLoadTelemetry',eT:{},fN:''
  });'__L_V__2';
              TelemetryStopwatch.cancel(histogram, aBrowser);
            }
          }
          if (recordLoadTelemetry) {
__L_V__2({
    lN: 6119,tT:'if',pr:'recordLoadTelemetry',eT:{},fN:''
  });'__L_V__2';
            TelemetryStopwatch.start(histogram, aBrowser);
          }
          Services.telemetry.getHistogramById("FX_TOTAL_TOP_VISITS").add(true);
        } else if (
          aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
          stopwatchRunning /* we won't see STATE_START events for pre-rendered tabs */
        ) {
__L_V__2({
    lN: 6126,tT:'if',pr:' aStateFlags & Ci.nsIWebProgressListener.STATE_STOP && stopwatchRunning /* we wont see STATE_START events for pre-rendered tabs */ ',eT:{},fN:''
  });'__L_V__2';
          if (recordLoadTelemetry) {
__L_V__2({
    lN: 6127,tT:'if',pr:'recordLoadTelemetry',eT:{},fN:''
  });'__L_V__2';
            TelemetryStopwatch.finish(histogram, aBrowser);
            BrowserUtils.recordSiteOriginTelemetry(browserWindows());
          }
        }
      } else if (
        aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
        aStatus == Cr.NS_BINDING_ABORTED &&
        stopwatchRunning /* we won't see STATE_START events for pre-rendered tabs */
      ) {
__L_V__2({
    lN: 6136,tT:'if',pr:' aStateFlags & Ci.nsIWebProgressListener.STATE_STOP && aStatus == Cr.NS_BINDING_ABORTED && stopwatchRunning /* we wont see STATE_START events for pre-rendered tabs */ ',eT:{},fN:''
  });'__L_V__2';
        if (recordLoadTelemetry) {
__L_V__2({
    lN: 6137,tT:'if',pr:'recordLoadTelemetry',eT:{},fN:''
  });'__L_V__2';
          TelemetryStopwatch.cancel(histogram, aBrowser);
        }
      }
    }
  },

  onLocationChange(aBrowser, aWebProgress, aRequest, aLocationURI, aFlags) {
__L_V__2({
    lN: 6144,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aWebProgress':aWebProgress,'aRequest':aRequest,'aLocationURI':aLocationURI,'aFlags':aFlags},fN:'onLocationChange'
  });'__L_V__2';
    // Filter out location changes caused by anchor navigation
    // or history.push/pop/replaceState.
    if (aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) {
__L_V__2({
    lN: 6147,tT:'if',pr:'aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT',eT:{},fN:''
  });'__L_V__2';
      // Reader mode cares about history.pushState and friends.
      // FIXME: The content process should manage this directly (bug 1445351).
      aBrowser.messageManager.sendAsyncMessage("Reader:PushState", {
        isArticle: aBrowser.isArticle,
      });
      return;
    }

    // Filter out location changes in sub documents.
    if (!aWebProgress.isTopLevel) {
__L_V__2({
    lN: 6157,tT:'if',pr:'!aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // Only need to call locationChange if the PopupNotifications object
    // for this window has already been initialized (i.e. its getter no
    // longer exists)
    if (!Object.getOwnPropertyDescriptor(window, "PopupNotifications").get) {
__L_V__2({
    lN: 6164,tT:'if',pr:'!Object.getOwnPropertyDescriptor(window, PopupNotifications).get',eT:{},fN:''
  });'__L_V__2';
      PopupNotifications.locationChange(aBrowser);
    }

    let tab = gBrowser.getTabForBrowser(aBrowser);
    if (tab && tab._sharingState) {
__L_V__2({
    lN: 6169,tT:'if',pr:'tab && tab._sharingState',eT:{},fN:''
  });'__L_V__2';
      gBrowser.resetBrowserSharing(aBrowser);
    }

    gBrowser.getNotificationBox(aBrowser).removeTransientNotifications();

    FullZoom.onLocationChange(aLocationURI, false, aBrowser);
  },

  onLinkIconAvailable(browser, dataURI, iconURI) {
__L_V__2({
    lN: 6178,tT:'func',pr:'',eT:{'browser':browser,'dataURI':dataURI,'iconURI':iconURI},fN:'onLinkIconAvailable'
  });'__L_V__2';
    if (!iconURI) {
__L_V__2({
    lN: 6179,tT:'if',pr:'!iconURI',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    if (browser == gBrowser.selectedBrowser) {
__L_V__2({
    lN: 6182,tT:'if',pr:'browser == gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__2';
      // If the "Add Search Engine" page action is in the urlbar, its image
      // needs to be set to the new icon, so call updateOpenSearchBadge.
      BrowserSearch.updateOpenSearchBadge();
    }
  },
};

function nsBrowserAccess() {
__L_V__2({
    lN: 6190,tT:'func',pr:'',eT:{},fN:'nsBrowserAccess'
  });'__L_V__2';}

nsBrowserAccess.prototype = {
  QueryInterface: ChromeUtils.generateQI([Ci.nsIBrowserDOMWindow]),

  _openURIInNewTab(
    aURI,
    aReferrerInfo,
    aIsPrivate,
    aIsExternal,
    aForceNotRemote = false,
    aUserContextId = Ci.nsIScriptSecurityManager.DEFAULT_USER_CONTEXT_ID,
    aOpenerWindow = null,
    aOpenerBrowser = null,
    aTriggeringPrincipal = null,
    aNextRemoteTabId = 0,
    aName = "",
    aCsp = null,
    aSkipLoad = false
  ) {
__L_V__2({
    lN: 6209,tT:'func',pr:'',eT:{'aURI':aURI,'aReferrerInfo':aReferrerInfo,'aIsPrivate':aIsPrivate,'aIsExternal':aIsExternal,'aForceNotRemote':aForceNotRemote,'aUserContextId':aUserContextId,'aOpenerWindow':aOpenerWindow,'aOpenerBrowser':aOpenerBrowser,'aTriggeringPrincipal':aTriggeringPrincipal,'aNextRemoteTabId':aNextRemoteTabId,'aName':aName,'aCsp':aCsp,'aSkipLoad':aSkipLoad},fN:'_openURIInNewTab'
  });'__L_V__2';
    let win, needToFocusWin;

    // try the current window.  if we're in a popup, fall back on the most recent browser window
    if (window.toolbar.visible) {
__L_V__2({
    lN: 6213,tT:'if',pr:'window.toolbar.visible',eT:{},fN:''
  });'__L_V__2';
      win = window;
    } else {
      win = BrowserWindowTracker.getTopWindow({ private: aIsPrivate });
      needToFocusWin = true;
    }

    if (!win) {
__L_V__2({
    lN: 6220,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__2';
      // we couldn't find a suitable window, a new one needs to be opened.
      return null;
    }

    if (aIsExternal && (!aURI || aURI.spec == "about:blank")) {
__L_V__2({
    lN: 6225,tT:'if',pr:'aIsExternal && (!aURI || aURI.spec == about:blank)',eT:{},fN:''
  });'__L_V__2';
      win.BrowserOpenTab(); // this also focuses the location bar
      win.focus();
      return win.gBrowser.selectedBrowser;
    }

    let loadInBackground = Services.prefs.getBoolPref(
      "browser.tabs.loadDivertedInBackground"
    );

    let tab = win.gBrowser.loadOneTab(aURI ? aURI.spec : "about:blank", {
      triggeringPrincipal: aTriggeringPrincipal,
      referrerInfo: aReferrerInfo,
      userContextId: aUserContextId,
      fromExternal: aIsExternal,
      inBackground: loadInBackground,
      forceNotRemote: aForceNotRemote,
      opener: aOpenerWindow,
      openerBrowser: aOpenerBrowser,
      nextRemoteTabId: aNextRemoteTabId,
      name: aName,
      csp: aCsp,
      skipLoad: aSkipLoad,
    });
    let browser = win.gBrowser.getBrowserForTab(tab);

    if (needToFocusWin || (!loadInBackground && aIsExternal)) {
__L_V__2({
    lN: 6251,tT:'if',pr:'needToFocusWin || (!loadInBackground && aIsExternal)',eT:{},fN:''
  });'__L_V__2';
      win.focus();
    }

    return browser;
  },

  createContentWindow(
    aURI,
    aOpener,
    aWhere,
    aFlags,
    aTriggeringPrincipal,
    aCsp
  ) {
__L_V__2({
    lN: 6265,tT:'func',pr:'',eT:{'aURI':aURI,'aOpener':aOpener,'aWhere':aWhere,'aFlags':aFlags,'aTriggeringPrincipal':aTriggeringPrincipal,'aCsp':aCsp},fN:'createContentWindow'
  });'__L_V__2';
    return this.getContentWindowOrOpenURI(
      null,
      aOpener,
      aWhere,
      aFlags,
      aTriggeringPrincipal,
      aCsp,
      true
    );
  },

  openURI(aURI, aOpener, aWhere, aFlags, aTriggeringPrincipal, aCsp) {
__L_V__2({
    lN: 6277,tT:'func',pr:'',eT:{'aURI':aURI,'aOpener':aOpener,'aWhere':aWhere,'aFlags':aFlags,'aTriggeringPrincipal':aTriggeringPrincipal,'aCsp':aCsp},fN:'openURI'
  });'__L_V__2';
    if (!aURI) {
__L_V__2({
    lN: 6278,tT:'if',pr:'!aURI',eT:{},fN:''
  });'__L_V__2';
      Cu.reportError("openURI should only be called with a valid URI");
      throw Cr.NS_ERROR_FAILURE;
    }
    return this.getContentWindowOrOpenURI(
      aURI,
      aOpener,
      aWhere,
      aFlags,
      aTriggeringPrincipal,
      aCsp,
      false
    );
  },

  getContentWindowOrOpenURI(
    aURI,
    aOpener,
    aWhere,
    aFlags,
    aTriggeringPrincipal,
    aCsp,
    aSkipLoad
  ) {
__L_V__2({
    lN: 6301,tT:'func',pr:'',eT:{'aURI':aURI,'aOpener':aOpener,'aWhere':aWhere,'aFlags':aFlags,'aTriggeringPrincipal':aTriggeringPrincipal,'aCsp':aCsp,'aSkipLoad':aSkipLoad},fN:'getContentWindowOrOpenURI'
  });'__L_V__2';
    // This function should only ever be called if we're opening a URI
    // from a non-remote browser window (via nsContentTreeOwner).
    if (aOpener && Cu.isCrossProcessWrapper(aOpener)) {
__L_V__2({
    lN: 6304,tT:'if',pr:'aOpener && Cu.isCrossProcessWrapper(aOpener)',eT:{},fN:''
  });'__L_V__2';
      Cu.reportError(
        "nsBrowserAccess.openURI was passed a CPOW for aOpener. " +
          "openURI should only ever be called from non-remote browsers."
      );
      throw Cr.NS_ERROR_FAILURE;
    }

    var browsingContext = null;
    var isExternal = !!(aFlags & Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL);

    if (aOpener && isExternal) {
__L_V__2({
    lN: 6315,tT:'if',pr:'aOpener && isExternal',eT:{},fN:''
  });'__L_V__2';
      Cu.reportError(
        "nsBrowserAccess.openURI did not expect an opener to be " +
          "passed if the context is OPEN_EXTERNAL."
      );
      throw Cr.NS_ERROR_FAILURE;
    }

    if (isExternal && aURI && aURI.schemeIs("chrome")) {
__L_V__2({
    lN: 6323,tT:'if',pr:'isExternal && aURI && aURI.schemeIs(chrome)',eT:{},fN:''
  });'__L_V__2';
      dump("use --chrome command-line option to load external chrome urls\n");
      return null;
    }

    if (aWhere == Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW) {
__L_V__2({
    lN: 6328,tT:'if',pr:'aWhere == Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW',eT:{},fN:''
  });'__L_V__2';
      if (
        isExternal &&
        Services.prefs.prefHasUserValue(
          "browser.link.open_newwindow.override.external"
        )
      ) {
__L_V__2({
    lN: 6334,tT:'if',pr:' isExternal && Services.prefs.prefHasUserValue( browser.link.open_newwindow.override.external ) ',eT:{},fN:''
  });'__L_V__2';
        aWhere = Services.prefs.getIntPref(
          "browser.link.open_newwindow.override.external"
        );
      } else {
        aWhere = Services.prefs.getIntPref("browser.link.open_newwindow");
      }
    }

    let referrerInfo;
    if (aFlags & Ci.nsIBrowserDOMWindow.OPEN_NO_REFERRER) {
__L_V__2({
    lN: 6344,tT:'if',pr:'aFlags & Ci.nsIBrowserDOMWindow.OPEN_NO_REFERRER',eT:{},fN:''
  });'__L_V__2';
      referrerInfo = new ReferrerInfo(Ci.nsIReferrerInfo.EMPTY, false, null);
    } else {
      referrerInfo = new ReferrerInfo(
        aOpener && aOpener.document
          ? aOpener.document.referrerInfo.referrerPolicy
          : Ci.nsIReferrerInfo.EMPTY,
        true,
        aOpener ? makeURI(aOpener.location.href) : null
      );
    }

    let isPrivate = aOpener
      ? PrivateBrowsingUtils.isContentWindowPrivate(aOpener)
      : PrivateBrowsingUtils.isWindowPrivate(window);
__L_V__2({
    lN: 6359,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';

    switch (aWhere) {
      case Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW:
        // FIXME: Bug 408379. So how come this doesn't send the
        // referrer like the other loads do?
        var url = aURI ? aURI.spec : "about:blank";
        let features = "all,dialog=no";
        if (isPrivate) {
__L_V__2({
    lN: 6366,tT:'if',pr:'isPrivate',eT:{},fN:''
  });'__L_V__2';
          features += ",private";
        }
        // Pass all params to openDialog to ensure that "url" isn't passed through
        // loadOneOrMoreURIs, which splits based on "|"
        try {
          openDialog(
            AppConstants.BROWSER_CHROME_URL,
            "_blank",
            features,
            // window.arguments
            url,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            aTriggeringPrincipal,
            null,
            aCsp
          );
          // At this point, the new browser window is just starting to load, and
          // hasn't created the content <browser> that we should return. So we
          // can't actually return a valid BrowsingContext for this load without
          // spinning the event loop.
          //
          // Fortunately, no current callers of this API who pass OPEN_NEWWINDOW
          // actually use the return value, so we're safe returning null for
          // now.
          //
          // Ideally this should be fixed.
          browsingContext = null;
        } catch (ex) {
          Cu.reportError(ex);
        }
        break;
      case Ci.nsIBrowserDOMWindow.OPEN_NEWTAB:
        // If we have an opener, that means that the caller is expecting access
        // to the nsIDOMWindow of the opened tab right away. For e10s windows,
        // this means forcing the newly opened browser to be non-remote so that
        // we can hand back the nsIDOMWindow. The XULBrowserWindow.shouldLoadURI
        // will do the job of shuttling off the newly opened browser to run in
        // the right process once it starts loading a URI.
        let forceNotRemote = !!aOpener;
        let userContextId =
          aOpener && aOpener.document
            ? aOpener.document.nodePrincipal.originAttributes.userContextId
            : Ci.nsIScriptSecurityManager.DEFAULT_USER_CONTEXT_ID;
        let openerWindow =
          aFlags & Ci.nsIBrowserDOMWindow.OPEN_NO_OPENER ? null : aOpener;
        let browser = this._openURIInNewTab(
          aURI,
          referrerInfo,
          isPrivate,
          isExternal,
          forceNotRemote,
          userContextId,
          openerWindow,
          null,
          aTriggeringPrincipal,
          0,
          "",
          aCsp,
          aSkipLoad
        );
        if (browser) {
__L_V__2({
    lN: 6433,tT:'if',pr:'browser',eT:{},fN:''
  });'__L_V__2';
          browsingContext = browser.browsingContext;
        }
        break;
      default:
        // OPEN_CURRENTWINDOW or an illegal value
        browsingContext =
          window.content && BrowsingContext.getFromWindow(window.content);
        if (aURI) {
__L_V__2({
    lN: 6441,tT:'if',pr:'aURI',eT:{},fN:''
  });'__L_V__2';
          let loadflags = isExternal
            ? Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL
            : Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
          gBrowser.loadURI(aURI.spec, {
            triggeringPrincipal: aTriggeringPrincipal,
            csp: aCsp,
            flags: loadflags,
            referrerInfo,
          });
        }
        if (
          !Services.prefs.getBoolPref("browser.tabs.loadDivertedInBackground")
        ) {
__L_V__2({
    lN: 6454,tT:'if',pr:' !Services.prefs.getBoolPref(browser.tabs.loadDivertedInBackground) ',eT:{},fN:''
  });'__L_V__2';
          window.focus();
        }
    }
    return browsingContext;
  },

  createContentWindowInFrame: function browser_createContentWindowInFrame(
    aURI,
    aParams,
    aWhere,
    aFlags,
    aNextRemoteTabId,
    aName
  ) {
__L_V__2({
    lN: 6468,tT:'func',pr:'',eT:{'aURI':aURI,'aParams':aParams,'aWhere':aWhere,'aFlags':aFlags,'aNextRemoteTabId':aNextRemoteTabId,'aName':aName},fN:'browser_createContentWindowInFrame'
  });'__L_V__2';
    // Passing a null-URI to only create the content window,
    // and pass true for aSkipLoad to prevent loading of
    // about:blank
    return this.getContentWindowOrOpenURIInFrame(
      null,
      aParams,
      aWhere,
      aFlags,
      aNextRemoteTabId,
      aName,
      true
    );
  },

  openURIInFrame: function browser_openURIInFrame(
    aURI,
    aParams,
    aWhere,
    aFlags,
    aNextRemoteTabId,
    aName
  ) {
__L_V__2({
    lN: 6490,tT:'func',pr:'',eT:{'aURI':aURI,'aParams':aParams,'aWhere':aWhere,'aFlags':aFlags,'aNextRemoteTabId':aNextRemoteTabId,'aName':aName},fN:'browser_openURIInFrame'
  });'__L_V__2';
    return this.getContentWindowOrOpenURIInFrame(
      aURI,
      aParams,
      aWhere,
      aFlags,
      aNextRemoteTabId,
      aName,
      false
    );
  },

  getContentWindowOrOpenURIInFrame: function browser_getContentWindowOrOpenURIInFrame(
    aURI,
    aParams,
    aWhere,
    aFlags,
    aNextRemoteTabId,
    aName,
    aSkipLoad
  ) {
__L_V__2({
    lN: 6510,tT:'func',pr:'',eT:{'aURI':aURI,'aParams':aParams,'aWhere':aWhere,'aFlags':aFlags,'aNextRemoteTabId':aNextRemoteTabId,'aName':aName,'aSkipLoad':aSkipLoad},fN:'browser_getContentWindowOrOpenURIInFrame'
  });'__L_V__2';
    if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) {
__L_V__2({
    lN: 6511,tT:'if',pr:'aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB',eT:{},fN:''
  });'__L_V__2';
      dump("Error: openURIInFrame can only open in new tabs");
      return null;
    }

    var isExternal = !!(aFlags & Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL);

    var userContextId =
      aParams.openerOriginAttributes &&
      "userContextId" in aParams.openerOriginAttributes
        ? aParams.openerOriginAttributes.userContextId
        : Ci.nsIScriptSecurityManager.DEFAULT_USER_CONTEXT_ID;

    return this._openURIInNewTab(
      aURI,
      aParams.referrerInfo,
      aParams.isPrivate,
      isExternal,
      false,
      userContextId,
      null,
      aParams.openerBrowser,
      aParams.triggeringPrincipal,
      aNextRemoteTabId,
      aName,
      aParams.csp,
      aSkipLoad
    );
  },

  isTabContentWindow(aWindow) {
__L_V__2({
    lN: 6541,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'isTabContentWindow'
  });'__L_V__2';
    return gBrowser.browsers.some(browser => browser.contentWindow == aWindow);
  },

  canClose() {
__L_V__2({
    lN: 6545,tT:'func',pr:'',eT:{},fN:'canClose'
  });'__L_V__2';
    return CanCloseWindow();
  },

  get tabCount() {
__L_V__2({
    lN: 6549,tT:'func',pr:'',eT:{},fN:'tabCount'
  });'__L_V__2';
    return gBrowser.tabs.length;
  },
};

function onViewToolbarsPopupShowing(aEvent, aInsertPoint) {
__L_V__2({
    lN: 6554,tT:'func',pr:'',eT:{'aEvent':aEvent,'aInsertPoint':aInsertPoint},fN:'onViewToolbarsPopupShowing'
  });'__L_V__2';
  var popup = aEvent.target;
  if (popup != aEvent.currentTarget) {
__L_V__2({
    lN: 6556,tT:'if',pr:'popup != aEvent.currentTarget',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  // Empty the menu
  for (var i = popup.children.length - 1; i >= 0; --i) {
    var deadItem = popup.children[i];
    if (deadItem.hasAttribute("toolbarId")) {
__L_V__2({
    lN: 6563,tT:'if',pr:'deadItem.hasAttribute(toolbarId)',eT:{},fN:''
  });'__L_V__2';
      popup.removeChild(deadItem);
    }
  }

  var firstMenuItem = aInsertPoint || popup.firstElementChild;

  let toolbarNodes = gNavToolbox.querySelectorAll("toolbar");

  for (let toolbar of toolbarNodes) {
    if (!toolbar.hasAttribute("toolbarname")) {
__L_V__2({
    lN: 6573,tT:'if',pr:'!toolbar.hasAttribute(toolbarname)',eT:{},fN:''
  });'__L_V__2';
      continue;
    }

    let menuItem = document.createXULElement("menuitem");
    let hidingAttribute =
      toolbar.getAttribute("type") == "menubar" ? "autohide" : "collapsed";
    menuItem.setAttribute("id", "toggle_" + toolbar.id);
    menuItem.setAttribute("toolbarId", toolbar.id);
    menuItem.setAttribute("type", "checkbox");
    menuItem.setAttribute("label", toolbar.getAttribute("toolbarname"));
    menuItem.setAttribute(
      "checked",
      toolbar.getAttribute(hidingAttribute) != "true"
    );
    menuItem.setAttribute("accesskey", toolbar.getAttribute("accesskey"));
    if (popup.id != "toolbar-context-menu") {
__L_V__2({
    lN: 6589,tT:'if',pr:'popup.id != toolbar-context-menu',eT:{},fN:''
  });'__L_V__2';
      menuItem.setAttribute("key", toolbar.getAttribute("key"));
    }

    popup.insertBefore(menuItem, firstMenuItem);

    menuItem.addEventListener("command", onViewToolbarCommand);
  }

  let moveToPanel = popup.querySelector(".customize-context-moveToPanel");
  let removeFromToolbar = popup.querySelector(
    ".customize-context-removeFromToolbar"
  );
  // View -> Toolbars menu doesn't have the moveToPanel or removeFromToolbar items.
  if (!moveToPanel || !removeFromToolbar) {
__L_V__2({
    lN: 6603,tT:'if',pr:'!moveToPanel || !removeFromToolbar',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  // triggerNode can be a nested child element of a toolbaritem.
  let toolbarItem = popup.triggerNode;

  if (toolbarItem && toolbarItem.localName == "toolbarpaletteitem") {
__L_V__2({
    lN: 6610,tT:'if',pr:'toolbarItem && toolbarItem.localName == toolbarpaletteitem',eT:{},fN:''
  });'__L_V__2';
    toolbarItem = toolbarItem.firstElementChild;
  } else if (toolbarItem && toolbarItem.localName != "toolbar") {
__L_V__2({
    lN: 6612,tT:'if',pr:'toolbarItem && toolbarItem.localName != toolbar',eT:{},fN:''
  });'__L_V__2';
    while (toolbarItem && toolbarItem.parentElement) {
      let parent = toolbarItem.parentElement;
      if (
        (parent.classList &&
          parent.classList.contains("customization-target")) ||
        parent.getAttribute("overflowfortoolbar") || // Needs to work in the overflow list as well.
        parent.localName == "toolbarpaletteitem" ||
        parent.localName == "toolbar"
      ) {
__L_V__2({
    lN: 6621,tT:'if',pr:' (parent.classList && parent.classList.contains(customization-target)) || parent.getAttribute(overflowfortoolbar) || // Needs to work in the overflow list as well. parent.localName == toolbarpaletteitem || parent.localName == toolbar ',eT:{},fN:''
  });'__L_V__2';
        break;
      }
      toolbarItem = parent;
    }
  } else {
    toolbarItem = null;
  }

  let showTabStripItems = toolbarItem && toolbarItem.id == "tabbrowser-tabs";
  for (let node of popup.querySelectorAll(
    'menuitem[contexttype="toolbaritem"]'
  )) {
    node.hidden = showTabStripItems;
  }

  for (let node of popup.querySelectorAll('menuitem[contexttype="tabbar"]')) {
    node.hidden = !showTabStripItems;
  }

  if (showTabStripItems) {
__L_V__2({
    lN: 6641,tT:'if',pr:'showTabStripItems',eT:{},fN:''
  });'__L_V__2';
    let multipleTabsSelected = !!gBrowser.multiSelectedTabsCount;
    document.getElementById(
      "toolbar-context-bookmarkSelectedTabs"
    ).hidden = !multipleTabsSelected;
    document.getElementById(
      "toolbar-context-bookmarkSelectedTab"
    ).hidden = multipleTabsSelected;
    document.getElementById(
      "toolbar-context-reloadSelectedTabs"
    ).hidden = !multipleTabsSelected;
    document.getElementById(
      "toolbar-context-reloadSelectedTab"
    ).hidden = multipleTabsSelected;
    document.getElementById(
      "toolbar-context-selectAllTabs"
    ).disabled = gBrowser.allTabsSelected();
    document.getElementById("toolbar-context-undoCloseTab").disabled =
      SessionStore.getClosedTabCount(window) == 0;

    MozXULElement.insertFTLIfNeeded("browser/toolbarContextMenu.ftl");
    document
      .getElementById("toolbar-context-menu")
      .querySelectorAll("[data-lazy-l10n-id]")
      .forEach(el => {
        el.setAttribute("data-l10n-id", el.getAttribute("data-lazy-l10n-id"));
        el.removeAttribute("data-lazy-l10n-id");
      });
    return;
  }

  let movable =
    toolbarItem &&
    toolbarItem.id &&
    CustomizableUI.isWidgetRemovable(toolbarItem);
  if (movable) {
__L_V__2({
    lN: 6676,tT:'if',pr:'movable',eT:{},fN:''
  });'__L_V__2';
    if (CustomizableUI.isSpecialWidget(toolbarItem.id)) {
__L_V__2({
    lN: 6677,tT:'if',pr:'CustomizableUI.isSpecialWidget(toolbarItem.id)',eT:{},fN:''
  });'__L_V__2';
      moveToPanel.setAttribute("disabled", true);
    } else {
      moveToPanel.removeAttribute("disabled");
    }
    removeFromToolbar.removeAttribute("disabled");
  } else {
    moveToPanel.setAttribute("disabled", true);
    removeFromToolbar.setAttribute("disabled", true);
  }
}

function onViewToolbarCommand(aEvent) {
__L_V__2({
    lN: 6689,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'onViewToolbarCommand'
  });'__L_V__2';
  let node = aEvent.originalTarget;
  let toolbarId = node.getAttribute("toolbarId");
  let isVisible = node.getAttribute("checked") == "true";
  CustomizableUI.setToolbarVisibility(toolbarId, isVisible);
  updateToggleControlLabel(node);
}

function setToolbarVisibility(toolbar, isVisible, persist = true) {
__L_V__2({
    lN: 6697,tT:'func',pr:'',eT:{'toolbar':toolbar,'isVisible':isVisible,'persist':persist},fN:'setToolbarVisibility'
  });'__L_V__2';
  let hidingAttribute;
  if (toolbar.getAttribute("type") == "menubar") {
__L_V__2({
    lN: 6699,tT:'if',pr:'toolbar.getAttribute(type) == menubar',eT:{},fN:''
  });'__L_V__2';
    hidingAttribute = "autohide";
    if (AppConstants.platform == "linux") {
__L_V__2({
    lN: 6701,tT:'if',pr:'AppConstants.platform == linux',eT:{},fN:''
  });'__L_V__2';
      Services.prefs.setBoolPref("ui.key.menuAccessKeyFocuses", !isVisible);
    }
  } else {
    hidingAttribute = "collapsed";
  }

  toolbar.setAttribute(hidingAttribute, !isVisible);
  if (persist) {
__L_V__2({
    lN: 6709,tT:'if',pr:'persist',eT:{},fN:''
  });'__L_V__2';
    Services.xulStore.persist(toolbar, hidingAttribute);
  }

  let eventParams = {
    detail: {
      visible: isVisible,
    },
    bubbles: true,
  };
  let event = new CustomEvent("toolbarvisibilitychange", eventParams);
  toolbar.dispatchEvent(event);

  if (
    toolbar.getAttribute("type") == "menubar" &&
    CustomizationHandler.isCustomizing()
  ) {
__L_V__2({
    lN: 6725,tT:'if',pr:' toolbar.getAttribute(type) == menubar && CustomizationHandler.isCustomizing() ',eT:{},fN:''
  });'__L_V__2';
    gCustomizeMode._updateDragSpaceCheckbox();
  }
}

function updateToggleControlLabel(control) {
__L_V__2({
    lN: 6730,tT:'func',pr:'',eT:{'control':control},fN:'updateToggleControlLabel'
  });'__L_V__2';
  if (!control.hasAttribute("label-checked")) {
__L_V__2({
    lN: 6731,tT:'if',pr:'!control.hasAttribute(label-checked)',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  if (!control.hasAttribute("label-unchecked")) {
__L_V__2({
    lN: 6735,tT:'if',pr:'!control.hasAttribute(label-unchecked)',eT:{},fN:''
  });'__L_V__2';
    control.setAttribute("label-unchecked", control.getAttribute("label"));
  }
  let prefix = control.getAttribute("checked") == "true" ? "" : "un";
  control.setAttribute("label", control.getAttribute(`label-${prefix}checked`));
}

var TabletModeUpdater = {
  init() {
__L_V__2({
    lN: 6743,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    if (AppConstants.isPlatformAndVersionAtLeast("win", "10")) {
__L_V__2({
    lN: 6744,tT:'if',pr:'AppConstants.isPlatformAndVersionAtLeast(win, 10)',eT:{},fN:''
  });'__L_V__2';
      this.update(WindowsUIUtils.inTabletMode);
      Services.obs.addObserver(this, "tablet-mode-change");
    }
  },

  uninit() {
__L_V__2({
    lN: 6750,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    if (AppConstants.isPlatformAndVersionAtLeast("win", "10")) {
__L_V__2({
    lN: 6751,tT:'if',pr:'AppConstants.isPlatformAndVersionAtLeast(win, 10)',eT:{},fN:''
  });'__L_V__2';
      Services.obs.removeObserver(this, "tablet-mode-change");
    }
  },

  observe(subject, topic, data) {
__L_V__2({
    lN: 6756,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    this.update(data == "tablet-mode");
  },

  update(isInTabletMode) {
__L_V__2({
    lN: 6760,tT:'func',pr:'',eT:{'isInTabletMode':isInTabletMode},fN:'update'
  });'__L_V__2';
    let wasInTabletMode = document.documentElement.hasAttribute("tabletmode");
    if (isInTabletMode) {
__L_V__2({
    lN: 6762,tT:'if',pr:'isInTabletMode',eT:{},fN:''
  });'__L_V__2';
      document.documentElement.setAttribute("tabletmode", "true");
    } else {
      document.documentElement.removeAttribute("tabletmode");
    }
    if (wasInTabletMode != isInTabletMode) {
__L_V__2({
    lN: 6767,tT:'if',pr:'wasInTabletMode != isInTabletMode',eT:{},fN:''
  });'__L_V__2';
      gUIDensity.update();
    }
  },
};

var gTabletModePageCounter = {
  enabled: false,
  inc() {
__L_V__2({
    lN: 6775,tT:'func',pr:'',eT:{},fN:'inc'
  });'__L_V__2';
    this.enabled = AppConstants.isPlatformAndVersionAtLeast("win", "10.0");
    if (!this.enabled) {
__L_V__2({
    lN: 6777,tT:'if',pr:'!this.enabled',eT:{},fN:''
  });'__L_V__2';
      this.inc = () => {};
      return;
    }
    this.inc = this._realInc;
    this.inc();
  },

  _desktopCount: 0,
  _tabletCount: 0,
  _realInc() {
__L_V__2({
    lN: 6787,tT:'func',pr:'',eT:{},fN:'_realInc'
  });'__L_V__2';
    let inTabletMode = document.documentElement.hasAttribute("tabletmode");
    this[inTabletMode ? "_tabletCount" : "_desktopCount"]++;
  },

  finish() {
__L_V__2({
    lN: 6792,tT:'func',pr:'',eT:{},fN:'finish'
  });'__L_V__2';
    if (this.enabled) {
__L_V__2({
    lN: 6793,tT:'if',pr:'this.enabled',eT:{},fN:''
  });'__L_V__2';
      let histogram = Services.telemetry.getKeyedHistogramById(
        "FX_TABLETMODE_PAGE_LOAD"
      );
      histogram.add("tablet", this._tabletCount);
      histogram.add("desktop", this._desktopCount);
    }
  },
};

function displaySecurityInfo() {
__L_V__2({
    lN: 6803,tT:'func',pr:'',eT:{},fN:'displaySecurityInfo'
  });'__L_V__2';
  BrowserPageInfo(null, "securityTab");
}

// Updates the UI density (for touch and compact mode) based on the uidensity pref.
var gUIDensity = {
  MODE_NORMAL: 0,
  MODE_COMPACT: 1,
  MODE_TOUCH: 2,
  uiDensityPref: "browser.uidensity",
  autoTouchModePref: "browser.touchmode.auto",

  init() {
__L_V__2({
    lN: 6815,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    this.update();
    Services.prefs.addObserver(this.uiDensityPref, this);
    Services.prefs.addObserver(this.autoTouchModePref, this);
  },

  uninit() {
__L_V__2({
    lN: 6821,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    Services.prefs.removeObserver(this.uiDensityPref, this);
    Services.prefs.removeObserver(this.autoTouchModePref, this);
  },

  observe(aSubject, aTopic, aPrefName) {
__L_V__2({
    lN: 6826,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aPrefName':aPrefName},fN:'observe'
  });'__L_V__2';
    if (
      aTopic != "nsPref:changed" ||
      (aPrefName != this.uiDensityPref && aPrefName != this.autoTouchModePref)
    ) {
__L_V__2({
    lN: 6830,tT:'if',pr:' aTopic != nsPref:changed || (aPrefName != this.uiDensityPref && aPrefName != this.autoTouchModePref) ',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    this.update();
  },

  getCurrentDensity() {
__L_V__2({
    lN: 6837,tT:'func',pr:'',eT:{},fN:'getCurrentDensity'
  });'__L_V__2';
    // Automatically override the uidensity to touch in Windows tablet mode.
    if (
      AppConstants.isPlatformAndVersionAtLeast("win", "10") &&
      WindowsUIUtils.inTabletMode &&
      Services.prefs.getBoolPref(this.autoTouchModePref)
    ) {
__L_V__2({
    lN: 6843,tT:'if',pr:' AppConstants.isPlatformAndVersionAtLeast(win, 10) && WindowsUIUtils.inTabletMode && Services.prefs.getBoolPref(this.autoTouchModePref) ',eT:{},fN:''
  });'__L_V__2';
      return { mode: this.MODE_TOUCH, overridden: true };
    }
    return {
      mode: Services.prefs.getIntPref(this.uiDensityPref),
      overridden: false,
    };
  },

  update(mode) {
__L_V__2({
    lN: 6852,tT:'func',pr:'',eT:{'mode':mode},fN:'update'
  });'__L_V__2';
    if (mode == null) {
__L_V__2({
    lN: 6853,tT:'if',pr:'mode == null',eT:{},fN:''
  });'__L_V__2';
      mode = this.getCurrentDensity().mode;
    }

    let docs = [document.documentElement];
    let shouldUpdateSidebar = SidebarUI.initialized && SidebarUI.isOpen;
    if (shouldUpdateSidebar) {
__L_V__2({
    lN: 6859,tT:'if',pr:'shouldUpdateSidebar',eT:{},fN:''
  });'__L_V__2';
      docs.push(SidebarUI.browser.contentDocument.documentElement);
    }
    for (let doc of docs) {
__L_V__2({
    lN: 6863,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
      switch (mode) {
        case this.MODE_COMPACT:
          doc.setAttribute("uidensity", "compact");
          break;
        case this.MODE_TOUCH:
          doc.setAttribute("uidensity", "touch");
          break;
        default:
          doc.removeAttribute("uidensity");
          break;
      }
    }
    if (shouldUpdateSidebar) {
__L_V__2({
    lN: 6875,tT:'if',pr:'shouldUpdateSidebar',eT:{},fN:''
  });'__L_V__2';
      let tree = SidebarUI.browser.contentDocument.querySelector(
        ".sidebar-placesTree"
      );
      if (tree) {
__L_V__2({
    lN: 6879,tT:'if',pr:'tree',eT:{},fN:''
  });'__L_V__2';
        // Tree items don't update their styles without changing some property on the
        // parent tree element, like background-color or border. See bug 1407399.
        tree.style.border = "1px";
        tree.style.border = "";
      }
    }

    gBrowser.tabContainer.uiDensityChanged();
    gURLBar.updateLayoutBreakout();
  },
};

const nodeToTooltipMap = {
  "bookmarks-menu-button": "bookmarksMenuButton.tooltip",
  "context-reload": "reloadButton.tooltip",
  "context-stop": "stopButton.tooltip",
  "downloads-button": "downloads.tooltip",
  "fullscreen-button": "fullscreenButton.tooltip",
  "appMenu-fullscreen-button": "fullscreenButton.tooltip",
  "new-window-button": "newWindowButton.tooltip",
  "new-tab-button": "newTabButton.tooltip",
  "tabs-newtab-button": "newTabButton.tooltip",
  "reload-button": "reloadButton.tooltip",
  "stop-button": "stopButton.tooltip",
  "urlbar-zoom-button": "urlbar-zoom-button.tooltip",
  "appMenu-cut-button": "cut-button.tooltip",
  "appMenu-copy-button": "copy-button.tooltip",
  "appMenu-paste-button": "paste-button.tooltip",
  "appMenu-zoomEnlarge-button": "zoomEnlarge-button.tooltip",
  "appMenu-zoomReset-button": "zoomReset-button.tooltip",
  "appMenu-zoomReduce-button": "zoomReduce-button.tooltip",
  "reader-mode-button": "reader-mode-button.tooltip",
};
const nodeToShortcutMap = {
  "bookmarks-menu-button": "manBookmarkKb",
  "context-reload": "key_reload",
  "context-stop": "key_stop",
  "downloads-button": "key_openDownloads",
  "fullscreen-button": "key_fullScreen",
  "appMenu-fullscreen-button": "key_fullScreen",
  "new-window-button": "key_newNavigator",
  "new-tab-button": "key_newNavigatorTab",
  "tabs-newtab-button": "key_newNavigatorTab",
  "reload-button": "key_reload",
  "stop-button": "key_stop",
  "urlbar-zoom-button": "key_fullZoomReset",
  "appMenu-cut-button": "key_cut",
  "appMenu-copy-button": "key_copy",
  "appMenu-paste-button": "key_paste",
  "appMenu-zoomEnlarge-button": "key_fullZoomEnlarge",
  "appMenu-zoomReset-button": "key_fullZoomReset",
  "appMenu-zoomReduce-button": "key_fullZoomReduce",
  "reader-mode-button": "key_toggleReaderMode",
};

if (AppConstants.platform == "macosx") {
__L_V__2({
    lN: 6935,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__2';
  nodeToTooltipMap["print-button"] = "printButton.tooltip";
  nodeToShortcutMap["print-button"] = "printKb";
}

const gDynamicTooltipCache = new Map();
function GetDynamicShortcutTooltipText(nodeId) {
__L_V__2({
    lN: 6941,tT:'func',pr:'',eT:{'nodeId':nodeId},fN:'GetDynamicShortcutTooltipText'
  });'__L_V__2';
  if (!gDynamicTooltipCache.has(nodeId) && nodeId in nodeToTooltipMap) {
__L_V__2({
    lN: 6942,tT:'if',pr:'!gDynamicTooltipCache.has(nodeId) && nodeId in nodeToTooltipMap',eT:{},fN:''
  });'__L_V__2';
    let strId = nodeToTooltipMap[nodeId];
    let args = [];
    if (nodeId in nodeToShortcutMap) {
__L_V__2({
    lN: 6945,tT:'if',pr:'nodeId in nodeToShortcutMap',eT:{},fN:''
  });'__L_V__2';
      let shortcutId = nodeToShortcutMap[nodeId];
      let shortcut = document.getElementById(shortcutId);
      if (shortcut) {
__L_V__2({
    lN: 6948,tT:'if',pr:'shortcut',eT:{},fN:''
  });'__L_V__2';
        args.push(ShortcutUtils.prettifyShortcut(shortcut));
      }
    }
    gDynamicTooltipCache.set(
      nodeId,
      gNavigatorBundle.getFormattedString(strId, args)
    );
  }
  return gDynamicTooltipCache.get(nodeId);
}

function UpdateDynamicShortcutTooltipText(aTooltip) {
__L_V__2({
    lN: 6960,tT:'func',pr:'',eT:{'aTooltip':aTooltip},fN:'UpdateDynamicShortcutTooltipText'
  });'__L_V__2';
  let nodeId =
    aTooltip.triggerNode.id || aTooltip.triggerNode.getAttribute("anonid");
  aTooltip.setAttribute("label", GetDynamicShortcutTooltipText(nodeId));
}

/*
 * - [ Dependencies ] ---------------------------------------------------------
 *  utilityOverlay.js:
 *    - gatherTextUnder
 */

/**
 * Extracts linkNode and href for the current click target.
 *
 * @param event
 *        The click event.
 * @return [href, linkNode].
 *
 * @note linkNode will be null if the click wasn't on an anchor
 *       element (or XLink).
 */
function hrefAndLinkNodeForClickEvent(event) {
__L_V__2({
    lN: 6982,tT:'func',pr:'',eT:{'event':event},fN:'hrefAndLinkNodeForClickEvent'
  });'__L_V__2';
  function isHTMLLink(aNode) {
__L_V__2({
    lN: 6983,tT:'func',pr:'',eT:{'aNode':aNode},fN:'isHTMLLink'
  });'__L_V__2';
    // Be consistent with what nsContextMenu.js does.
    return (
      (aNode instanceof HTMLAnchorElement && aNode.href) ||
      (aNode instanceof HTMLAreaElement && aNode.href) ||
      aNode instanceof HTMLLinkElement
    );
  }

  let node = event.composedTarget;
  while (node && !isHTMLLink(node)) {
    node = node.flattenedTreeParentNode;
  }

  if (node) {
__L_V__2({
    lN: 6997,tT:'if',pr:'node',eT:{},fN:''
  });'__L_V__2';
    return [node.href, node];
  }

  // If there is no linkNode, try simple XLink.
  let href, baseURI;
  node = event.composedTarget;
  while (node && !href) {
    if (
      node.nodeType == Node.ELEMENT_NODE &&
      (node.localName == "a" ||
        node.namespaceURI == "http://www.w3.org/1998/Math/MathML")
    ) {
__L_V__2({
    lN: 7009,tT:'if',pr:' node.nodeType == Node.ELEMENT_NODE && (node.localName == a || node.namespaceURI == http://www.w3.org/1998/Math/MathML) ',eT:{},fN:''
  });'__L_V__2';
      href =
        node.getAttribute("href") ||
        node.getAttributeNS("http://www.w3.org/1999/xlink", "href");

      if (href) {
__L_V__2({
    lN: 7014,tT:'if',pr:'href',eT:{},fN:''
  });'__L_V__2';
        baseURI = node.baseURI;
        break;
      }
    }
    node = node.flattenedTreeParentNode;
  }

  // In case of XLink, we don't return the node we got href from since
  // callers expect <a>-like elements.
  return [href ? makeURLAbsolute(baseURI, href) : null, null];
}

/**
 * Called whenever the user clicks in the content area.
 *
 * @param event
 *        The click event.
 * @param isPanelClick
 *        Whether the event comes from an extension panel.
 * @note default event is prevented if the click is handled.
 */
function contentAreaClick(event, isPanelClick) {
__L_V__2({
    lN: 7036,tT:'func',pr:'',eT:{'event':event,'isPanelClick':isPanelClick},fN:'contentAreaClick'
  });'__L_V__2';
  if (!event.isTrusted || event.defaultPrevented || event.button != 0) {
__L_V__2({
    lN: 7037,tT:'if',pr:'!event.isTrusted || event.defaultPrevented || event.button != 0',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  let [href, linkNode] = hrefAndLinkNodeForClickEvent(event);
  if (!href) {
__L_V__2({
    lN: 7042,tT:'if',pr:'!href',eT:{},fN:''
  });'__L_V__2';
    // Not a link, handle middle mouse navigation.
    if (
      event.button == 1 &&
      Services.prefs.getBoolPref("middlemouse.contentLoadURL") &&
      !Services.prefs.getBoolPref("general.autoScroll")
    ) {
__L_V__2({
    lN: 7048,tT:'if',pr:' event.button == 1 && Services.prefs.getBoolPref(middlemouse.contentLoadURL) && !Services.prefs.getBoolPref(general.autoScroll) ',eT:{},fN:''
  });'__L_V__2';
      middleMousePaste(event);
      event.preventDefault();
    }
    return;
  }

  // This code only applies if we have a linkNode (i.e. clicks on real anchor
  // elements, as opposed to XLink).
  if (
    linkNode &&
    event.button == 0 &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.metaKey
  ) {
__L_V__2({
    lN: 7064,tT:'if',pr:' linkNode && event.button == 0 && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey ',eT:{},fN:''
  });'__L_V__2';
    // An extension panel's links should target the main content area.  Do this
    // if no modifier keys are down and if there's no target or the target
    // equals _main (the IE convention) or _content (the Mozilla convention).
    let target = linkNode.target;
    let mainTarget = !target || target == "_content" || target == "_main";
    if (isPanelClick && mainTarget) {
__L_V__2({
    lN: 7070,tT:'if',pr:'isPanelClick && mainTarget',eT:{},fN:''
  });'__L_V__2';
      // javascript and data links should be executed in the current browser.
      if (
        linkNode.getAttribute("onclick") ||
        href.startsWith("javascript:") ||
        href.startsWith("data:")
      ) {
__L_V__2({
    lN: 7076,tT:'if',pr:' linkNode.getAttribute(onclick) || href.startsWith(javascript:) || href.startsWith(data:) ',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      try {
        urlSecurityCheck(href, linkNode.ownerDocument.nodePrincipal);
      } catch (ex) {
        // Prevent loading unsecure destinations.
        event.preventDefault();
        return;
      }

      loadURI(href, null, null, false);
      event.preventDefault();
      return;
    }
  }

  handleLinkClick(event, href, linkNode);

  // Mark the page as a user followed link.  This is done so that history can
  // distinguish automatic embed visits from user activated ones.  For example
  // pages loaded in frames are embed visits and lost with the session, while
  // visits across frames should be preserved.
  try {
    if (!PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 7101,tT:'if',pr:'!PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
      PlacesUIUtils.markPageAsFollowedLink(href);
    }
  } catch (ex) {
    /* Skip invalid URIs. */
  }
}

/**
 * Handles clicks on links.
 *
 * @return true if the click event was handled, false otherwise.
 */
function handleLinkClick(event, href, linkNode) {
__L_V__2({
    lN: 7114,tT:'func',pr:'',eT:{'event':event,'href':href,'linkNode':linkNode},fN:'handleLinkClick'
  });'__L_V__2';
  if (event.button == 2) {
__L_V__2({
    lN: 7115,tT:'if',pr:'event.button == 2',eT:{},fN:''
  });'__L_V__2';
    // right click
    return false;
  }

  var where = whereToOpenLink(event);
  if (where == "current") {
__L_V__2({
    lN: 7121,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__2';
    return false;
  }

  var doc = event.target.ownerDocument;
  let referrerInfo = Cc["@mozilla.org/referrer-info;1"].createInstance(
    Ci.nsIReferrerInfo
  );
  if (linkNode) {
__L_V__2({
    lN: 7129,tT:'if',pr:'linkNode',eT:{},fN:''
  });'__L_V__2';
    referrerInfo.initWithNode(linkNode);
  } else {
    referrerInfo.initWithDocument(doc);
  }

  if (where == "save") {
__L_V__2({
    lN: 7135,tT:'if',pr:'where == save',eT:{},fN:''
  });'__L_V__2';
    saveURL(
      href,
      linkNode ? gatherTextUnder(linkNode) : "",
      null,
      true,
      true,
      referrerInfo,
      doc
    );
    event.preventDefault();
    return true;
  }

  // if the mixedContentChannel is present and the referring URI passes
  // a same origin check with the target URI, we can preserve the users
  // decision of disabling MCB on a page for it's child tabs.
  var persistAllowMixedContentInChildTab = false;

  if (where == "tab" && gBrowser.docShell.mixedContentChannel) {
__L_V__2({
    lN: 7154,tT:'if',pr:'where == tab && gBrowser.docShell.mixedContentChannel',eT:{},fN:''
  });'__L_V__2';
    const sm = Services.scriptSecurityManager;
    try {
      var targetURI = makeURI(href);
      let isPrivateWin =
        doc.nodePrincipal.originAttributes.privateBrowsingId > 0;
      sm.checkSameOriginURI(
        doc.documentURIObject,
        targetURI,
        false,
        isPrivateWin
      );
      persistAllowMixedContentInChildTab = true;
    } catch (e) {}
  }

  let frameOuterWindowID = WebNavigationFrames.getFrameId(doc.defaultView);

  urlSecurityCheck(href, doc.nodePrincipal);
  let params = {
    charset: doc.characterSet,
    allowMixedContent: persistAllowMixedContentInChildTab,
    referrerInfo,
    originPrincipal: doc.nodePrincipal,
    originStoragePrincipal: doc.effectiveStoragePrincipal,
    triggeringPrincipal: doc.nodePrincipal,
    csp: doc.csp,
    frameOuterWindowID,
  };

  // The new tab/window must use the same userContextId
  if (doc.nodePrincipal.originAttributes.userContextId) {
__L_V__2({
    lN: 7185,tT:'if',pr:'doc.nodePrincipal.originAttributes.userContextId',eT:{},fN:''
  });'__L_V__2';
    params.userContextId = doc.nodePrincipal.originAttributes.userContextId;
  }

  openLinkIn(href, where, params);
  event.preventDefault();
  return true;
}

/**
 * Handles paste on middle mouse clicks.
 *
 * @param event {Event | Object} Event or JSON object.
 */
function middleMousePaste(event) {
__L_V__2({
    lN: 7199,tT:'func',pr:'',eT:{'event':event},fN:'middleMousePaste'
  });'__L_V__2';
  let clipboard = readFromClipboard();
  if (!clipboard) {
__L_V__2({
    lN: 7201,tT:'if',pr:'!clipboard',eT:{},fN:''
  });'__L_V__2';
    return;
  }

  // Strip embedded newlines and surrounding whitespace, to match the URL
  // bar's behavior (stripsurroundingwhitespace)
  clipboard = clipboard.replace(/\s*\n\s*/g, "");

  clipboard = UrlbarUtils.stripUnsafeProtocolOnPaste(clipboard);

  // if it's not the current tab, we don't need to do anything because the
  // browser doesn't exist.
  let where = whereToOpenLink(event, true, false);
  let lastLocationChange;
  if (where == "current") {
__L_V__2({
    lN: 7215,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__2';
    lastLocationChange = gBrowser.selectedBrowser.lastLocationChange;
  }

  UrlbarUtils.getShortcutOrURIAndPostData(clipboard).then(data => {
    try {
      makeURI(data.url);
    } catch (ex) {
      // Not a valid URI.
      return;
    }

    try {
      UrlbarUtils.addToUrlbarHistory(data.url, window);
    } catch (ex) {
      // Things may go wrong when adding url to session history,
      // but don't let that interfere with the loading of the url.
      Cu.reportError(ex);
    }

    if (
      where != "current" ||
      lastLocationChange == gBrowser.selectedBrowser.lastLocationChange
    ) {
__L_V__2({
    lN: 7238,tT:'if',pr:' where != current || lastLocationChange == gBrowser.selectedBrowser.lastLocationChange ',eT:{},fN:''
  });'__L_V__2';
      openUILink(data.url, event, {
        ignoreButton: true,
        allowInheritPrincipal: data.mayInheritPrincipal,
        triggeringPrincipal: gBrowser.selectedBrowser.contentPrincipal,
        csp: gBrowser.selectedBrowser.csp,
      });
    }
  });

  if (event instanceof Event) {
__L_V__2({
    lN: 7248,tT:'if',pr:'event instanceof Event',eT:{},fN:''
  });'__L_V__2';
    event.stopPropagation();
  }
}

// handleDroppedLink has the following 2 overloads:
//   handleDroppedLink(event, url, name, triggeringPrincipal)
//   handleDroppedLink(event, links, triggeringPrincipal)
function handleDroppedLink(
  event,
  urlOrLinks,
  nameOrTriggeringPrincipal,
  triggeringPrincipal
) {
__L_V__2({
    lN: 7261,tT:'func',pr:'',eT:{'event':event,'urlOrLinks':urlOrLinks,'nameOrTriggeringPrincipal':nameOrTriggeringPrincipal,'triggeringPrincipal':triggeringPrincipal},fN:'handleDroppedLink'
  });'__L_V__2';
  let links;
  if (Array.isArray(urlOrLinks)) {
__L_V__2({
    lN: 7263,tT:'if',pr:'Array.isArray(urlOrLinks)',eT:{},fN:''
  });'__L_V__2';
    links = urlOrLinks;
    triggeringPrincipal = nameOrTriggeringPrincipal;
  } else {
    links = [{ url: urlOrLinks, nameOrTriggeringPrincipal, type: "" }];
  }

  let lastLocationChange = gBrowser.selectedBrowser.lastLocationChange;

  let userContextId = gBrowser.selectedBrowser.getAttribute("usercontextid");

  // event is null if links are dropped in content process.
  // inBackground should be false, as it's loading into current browser.
  let inBackground = false;
  if (event) {
__L_V__2({
    lN: 7277,tT:'if',pr:'event',eT:{},fN:''
  });'__L_V__2';
    inBackground = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
    if (event.shiftKey) {
__L_V__2({
    lN: 7279,tT:'if',pr:'event.shiftKey',eT:{},fN:''
  });'__L_V__2';
      inBackground = !inBackground;
    }
  }

  (async function() {
__L_V__2({
    lN: 7284,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__2';
    if (
      links.length >=
      Services.prefs.getIntPref("browser.tabs.maxOpenBeforeWarn")
    ) {
__L_V__2({
    lN: 7288,tT:'if',pr:' links.length >= Services.prefs.getIntPref(browser.tabs.maxOpenBeforeWarn) ',eT:{},fN:''
  });'__L_V__2';
      // Sync dialog cannot be used inside drop event handler.
      let answer = await OpenInTabsUtils.promiseConfirmOpenInTabs(
        links.length,
        window
      );
      if (!answer) {
__L_V__2({
    lN: 7294,tT:'if',pr:'!answer',eT:{},fN:''
  });'__L_V__2';
        return;
      }
    }

    let urls = [];
    let postDatas = [];
    for (let link of links) {
      let data = await UrlbarUtils.getShortcutOrURIAndPostData(link.url);
      urls.push(data.url);
      postDatas.push(data.postData);
    }
    if (lastLocationChange == gBrowser.selectedBrowser.lastLocationChange) {
__L_V__2({
    lN: 7306,tT:'if',pr:'lastLocationChange == gBrowser.selectedBrowser.lastLocationChange',eT:{},fN:''
  });'__L_V__2';
      gBrowser.loadTabs(urls, {
        inBackground,
        replace: true,
        allowThirdPartyFixup: false,
        postDatas,
        userContextId,
        triggeringPrincipal,
      });
    }
  })();

  // If links are dropped in content process, event.preventDefault() should be
  // called in content process.
  if (event) {
__L_V__2({
    lN: 7320,tT:'if',pr:'event',eT:{},fN:''
  });'__L_V__2';
    // Keep the event from being handled by the dragDrop listeners
    // built-in to gecko if they happen to be above us.
    event.preventDefault();
  }
}

function BrowserSetForcedCharacterSet(aCharset) {
__L_V__2({
    lN: 7327,tT:'func',pr:'',eT:{'aCharset':aCharset},fN:'BrowserSetForcedCharacterSet'
  });'__L_V__2';
  if (aCharset) {
__L_V__2({
    lN: 7328,tT:'if',pr:'aCharset',eT:{},fN:''
  });'__L_V__2';
    if (aCharset == "Japanese") {
__L_V__2({
    lN: 7329,tT:'if',pr:'aCharset == Japanese',eT:{},fN:''
  });'__L_V__2';
      aCharset = "Shift_JIS";
    }
    gBrowser.selectedBrowser.characterSet = aCharset;
    // Save the forced character-set
    PlacesUIUtils.setCharsetForPage(
      gBrowser.currentURI,
      aCharset,
      window
    ).catch(Cu.reportError);
  }
  BrowserCharsetReload();
}

function BrowserCharsetReload() {
__L_V__2({
    lN: 7343,tT:'func',pr:'',eT:{},fN:'BrowserCharsetReload'
  });'__L_V__2';
  BrowserReloadWithFlags(Ci.nsIWebNavigation.LOAD_FLAGS_CHARSET_CHANGE);
}

function UpdateCurrentCharset(target) {
__L_V__2({
    lN: 7347,tT:'func',pr:'',eT:{'target':target},fN:'UpdateCurrentCharset'
  });'__L_V__2';
  let selectedCharset = CharsetMenu.foldCharset(
    gBrowser.selectedBrowser.characterSet,
    gBrowser.selectedBrowser.charsetAutodetected
  );
  for (let menuItem of target.getElementsByTagName("menuitem")) {
    let isSelected = menuItem.getAttribute("charset") === selectedCharset;
    menuItem.setAttribute("checked", isSelected);
  }
}

function promptRemoveExtension(addon) {
__L_V__2({
    lN: 7358,tT:'func',pr:'',eT:{'addon':addon},fN:'promptRemoveExtension'
  });'__L_V__2';
  let { name } = addon;
  let brand = document
    .getElementById("bundle_brand")
    .getString("brandShorterName");
  let { getFormattedString, getString } = gNavigatorBundle;
  let title = getFormattedString("webext.remove.confirmation.title", [name]);
  let message = getFormattedString("webext.remove.confirmation.message", [
    name,
    brand,
  ]);
  let btnTitle = getString("webext.remove.confirmation.button");
  let {
    BUTTON_TITLE_IS_STRING: titleString,
    BUTTON_TITLE_CANCEL: titleCancel,
    BUTTON_POS_0,
    BUTTON_POS_1,
    confirmEx,
  } = Services.prompt;
  let btnFlags = BUTTON_POS_0 * titleString + BUTTON_POS_1 * titleCancel;
  let checkboxState = { value: false };
  let checkboxMessage = null;

  // Enable abuse report checkbox in the remove extension dialog,
  // if enabled by the about:config prefs and the addon type
  // is currently supported.
  if (gAddonAbuseReportEnabled && ["extension", "theme"].includes(addon.type)) {
__L_V__2({
    lN: 7384,tT:'if',pr:'gAddonAbuseReportEnabled && [extension, theme].includes(addon.type)',eT:{},fN:''
  });'__L_V__2';
    checkboxMessage = getFormattedString(
      "webext.remove.abuseReportCheckbox.message",
      [document.getElementById("bundle_brand").getString("vendorShortName")]
    );
  }
  const result = confirmEx(
    null,
    title,
    message,
    btnFlags,
    btnTitle,
    null,
    null,
    checkboxMessage,
    checkboxState
  );
  return { remove: result === 0, report: checkboxState.value };
}

var ToolbarContextMenu = {
  updateDownloadsAutoHide(popup) {
__L_V__2({
    lN: 7405,tT:'func',pr:'',eT:{'popup':popup},fN:'updateDownloadsAutoHide'
  });'__L_V__2';
    let checkbox = document.getElementById(
      "toolbar-context-autohide-downloads-button"
    );
    let isDownloads =
      popup.triggerNode &&
      ["downloads-button", "wrapper-downloads-button"].includes(
        popup.triggerNode.id
      );
    checkbox.hidden = !isDownloads;
    if (DownloadsButton.autoHideDownloadsButton) {
__L_V__2({
    lN: 7415,tT:'if',pr:'DownloadsButton.autoHideDownloadsButton',eT:{},fN:''
  });'__L_V__2';
      checkbox.setAttribute("checked", "true");
    } else {
      checkbox.removeAttribute("checked");
    }
  },

  onDownloadsAutoHideChange(event) {
__L_V__2({
    lN: 7422,tT:'func',pr:'',eT:{'event':event},fN:'onDownloadsAutoHideChange'
  });'__L_V__2';
    let autoHide = event.target.getAttribute("checked") == "true";
    Services.prefs.setBoolPref("browser.download.autohideButton", autoHide);
  },

  _getUnwrappedTriggerNode(popup) {
__L_V__2({
    lN: 7427,tT:'func',pr:'',eT:{'popup':popup},fN:'_getUnwrappedTriggerNode'
  });'__L_V__2';
    // Toolbar buttons are wrapped in customize mode. Unwrap if necessary.
    let { triggerNode } = popup;
    if (triggerNode && gCustomizeMode.isWrappedToolbarItem(triggerNode)) {
__L_V__2({
    lN: 7430,tT:'if',pr:'triggerNode && gCustomizeMode.isWrappedToolbarItem(triggerNode)',eT:{},fN:''
  });'__L_V__2';
      return triggerNode.firstElementChild;
    }
    return triggerNode;
  },

  _getExtensionId(popup) {
__L_V__2({
    lN: 7436,tT:'func',pr:'',eT:{'popup':popup},fN:'_getExtensionId'
  });'__L_V__2';
    let node = this._getUnwrappedTriggerNode(popup);
    return node && node.getAttribute("data-extensionid");
  },

  async updateExtension(popup) {
__L_V__2({
    lN: 7441,tT:'func',pr:'',eT:{'popup':popup},fN:'updateExtension'
  });'__L_V__2';
    let removeExtension = popup.querySelector(
      ".customize-context-removeExtension"
    );
    let manageExtension = popup.querySelector(
      ".customize-context-manageExtension"
    );
    let reportExtension = popup.querySelector(
      ".customize-context-reportExtension"
    );
    let separator = reportExtension.nextElementSibling;
    let id = this._getExtensionId(popup);
    let addon = id && (await AddonManager.getAddonByID(id));

    // CLIQZ-SPECIAL: hide manage, report and remove extensions for cliqz toolbar icons
    let node = this._getUnwrappedTriggerNode(popup);
    let isCliqzButton = node && node.hasAttribute("data-extensionid") && (node.getAttribute("data-extensionid") == "cliqz@cliqz.com");
    for (let element of [removeExtension, manageExtension, separator]) {
      element.hidden = !addon || isCliqzButton;
    }

    reportExtension.hidden = !addon || !gAddonAbuseReportEnabled || isCliqzButton;

    if (addon) {
__L_V__2({
    lN: 7464,tT:'if',pr:'addon',eT:{},fN:''
  });'__L_V__2';
      removeExtension.disabled = !(
        addon.permissions & AddonManager.PERM_CAN_UNINSTALL
      );
    }
  },

  async removeExtensionForContextAction(popup) {
__L_V__2({
    lN: 7471,tT:'func',pr:'',eT:{'popup':popup},fN:'removeExtensionForContextAction'
  });'__L_V__2';
    let id = this._getExtensionId(popup);
    let addon = id && (await AddonManager.getAddonByID(id));
    if (!addon || !(addon.permissions & AddonManager.PERM_CAN_UNINSTALL)) {
__L_V__2({
    lN: 7474,tT:'if',pr:'!addon || !(addon.permissions & AddonManager.PERM_CAN_UNINSTALL)',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    let { remove, report } = promptRemoveExtension(addon);
    AMTelemetry.recordActionEvent({
      object: "browserAction",
      action: "uninstall",
      value: remove ? "accepted" : "cancelled",
      extra: { addonId: addon.id },
    });
    if (remove) {
__L_V__2({
    lN: 7484,tT:'if',pr:'remove',eT:{},fN:''
  });'__L_V__2';
      // Leave the extension in pending uninstall if we are also
      // reporting the add-on.
      await addon.uninstall(report);
      if (report) {
__L_V__2({
    lN: 7488,tT:'if',pr:'report',eT:{},fN:''
  });'__L_V__2';
        this.reportExtensionForContextAction(popup, "uninstall");
      }
    }
  },

  async reportExtensionForContextAction(popup, reportEntryPoint) {
__L_V__2({
    lN: 7494,tT:'func',pr:'',eT:{'popup':popup,'reportEntryPoint':reportEntryPoint},fN:'reportExtensionForContextAction'
  });'__L_V__2';
    let id = this._getExtensionId(popup);
    let addon = id && (await AddonManager.getAddonByID(id));
    if (!addon) {
__L_V__2({
    lN: 7497,tT:'if',pr:'!addon',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    const win = await BrowserOpenAddonsMgr("addons://list/extension");
    win.openAbuseReport({
      addonId: addon.id,
      reportEntryPoint,
    });
  },

  openAboutAddonsForContextAction(popup) {
__L_V__2({
    lN: 7507,tT:'func',pr:'',eT:{'popup':popup},fN:'openAboutAddonsForContextAction'
  });'__L_V__2';
    let id = this._getExtensionId(popup);
    if (id) {
__L_V__2({
    lN: 7509,tT:'if',pr:'id',eT:{},fN:''
  });'__L_V__2';
      let viewID = "addons://detail/" + encodeURIComponent(id);
      BrowserOpenAddonsMgr(viewID);
      AMTelemetry.recordActionEvent({
        object: "browserAction",
        action: "manage",
        extra: { addonId: id },
      });
    }
  },
};

var gPageStyleMenu = {
  // This maps from a <browser> element (or, more specifically, a
  // browser's permanentKey) to an Object that contains the most recent
  // information about the browser content's stylesheets. That Object
  // is populated via the PageStyle:StyleSheets message from the content
  // process. The Object should have the following structure:
  //
  // filteredStyleSheets (Array):
  //   An Array of objects with a filtered list representing all stylesheets
  //   that the current page offers. Each object has the following members:
  //
  //   title (String):
  //     The title of the stylesheet
  //
  //   disabled (bool):
  //     Whether or not the stylesheet is currently applied
  //
  //   href (String):
  //     The URL of the stylesheet. Stylesheets loaded via a data URL will
  //     have this property set to null.
  //
  // authorStyleDisabled (bool):
  //   Whether or not the user currently has "No Style" selected for
  //   the current page.
  //
  // preferredStyleSheetSet (bool):
  //   Whether or not the user currently has the "Default" style selected
  //   for the current page.
  //
  _pageStyleSheets: new WeakMap(),

  /**
   * Add/append styleSheets to the _pageStyleSheets weakmap.
   * @param styleSheets
   *        The stylesheets to add, including the preferred
   *        stylesheet set for this document.
   * @param permanentKey
   *        The permanent key of the browser that
   *        these stylesheets come from.
   */
  addBrowserStyleSheets(styleSheets, permanentKey) {
__L_V__2({
    lN: 7561,tT:'func',pr:'',eT:{'styleSheets':styleSheets,'permanentKey':permanentKey},fN:'addBrowserStyleSheets'
  });'__L_V__2';
    let sheetData = this._pageStyleSheets.get(permanentKey);
    if (!sheetData) {
__L_V__2({
    lN: 7563,tT:'if',pr:'!sheetData',eT:{},fN:''
  });'__L_V__2';
      this._pageStyleSheets.set(permanentKey, styleSheets);
      return;
    }
    sheetData.filteredStyleSheets.push(...styleSheets.filteredStyleSheets);
    sheetData.preferredStyleSheetSet =
      sheetData.preferredStyleSheetSet || styleSheets.preferredStyleSheetSet;
  },

  /**
   * Return an array of Objects representing stylesheets in a
   * browser. Note that the pageshow event needs to fire in content
   * before this information will be available.
   *
   * @param browser (optional)
   *        The <xul:browser> to search for stylesheets. If omitted, this
   *        defaults to the currently selected tab's browser.
   * @returns Array
   *        An Array of Objects representing stylesheets in the browser.
   *        See the documentation for gPageStyleMenu for a description
   *        of the Object structure.
   */
  getBrowserStyleSheets(browser) {
__L_V__2({
    lN: 7585,tT:'func',pr:'',eT:{'browser':browser},fN:'getBrowserStyleSheets'
  });'__L_V__2';
    if (!browser) {
__L_V__2({
    lN: 7586,tT:'if',pr:'!browser',eT:{},fN:''
  });'__L_V__2';
      browser = gBrowser.selectedBrowser;
    }

    let data = this._pageStyleSheets.get(browser.permanentKey);
    if (!data) {
__L_V__2({
    lN: 7591,tT:'if',pr:'!data',eT:{},fN:''
  });'__L_V__2';
      return [];
    }
    return data.filteredStyleSheets;
  },

  clearBrowserStyleSheets(permanentKey) {
__L_V__2({
    lN: 7597,tT:'func',pr:'',eT:{'permanentKey':permanentKey},fN:'clearBrowserStyleSheets'
  });'__L_V__2';
    this._pageStyleSheets.delete(permanentKey);
  },

  _getStyleSheetInfo(browser) {
__L_V__2({
    lN: 7601,tT:'func',pr:'',eT:{'browser':browser},fN:'_getStyleSheetInfo'
  });'__L_V__2';
    let data = this._pageStyleSheets.get(browser.permanentKey);
    if (!data) {
__L_V__2({
    lN: 7603,tT:'if',pr:'!data',eT:{},fN:''
  });'__L_V__2';
      return {
        filteredStyleSheets: [],
        authorStyleDisabled: false,
        preferredStyleSheetSet: true,
      };
    }

    return data;
  },

  fillPopup(menuPopup) {
__L_V__2({
    lN: 7614,tT:'func',pr:'',eT:{'menuPopup':menuPopup},fN:'fillPopup'
  });'__L_V__2';
    let styleSheetInfo = this._getStyleSheetInfo(gBrowser.selectedBrowser);
    var noStyle = menuPopup.firstElementChild;
    var persistentOnly = noStyle.nextElementSibling;
    var sep = persistentOnly.nextElementSibling;
    while (sep.nextElementSibling) {
      menuPopup.removeChild(sep.nextElementSibling);
    }

    let styleSheets = styleSheetInfo.filteredStyleSheets;
    var currentStyleSheets = {};
    var styleDisabled = styleSheetInfo.authorStyleDisabled;
    var haveAltSheets = false;
    var altStyleSelected = false;

    for (let currentStyleSheet of styleSheets) {
      if (!currentStyleSheet.disabled) {
__L_V__2({
    lN: 7630,tT:'if',pr:'!currentStyleSheet.disabled',eT:{},fN:''
  });'__L_V__2';
        altStyleSelected = true;
      }

      haveAltSheets = true;

      let lastWithSameTitle = null;
      if (currentStyleSheet.title in currentStyleSheets) {
__L_V__2({
    lN: 7637,tT:'if',pr:'currentStyleSheet.title in currentStyleSheets',eT:{},fN:''
  });'__L_V__2';
        lastWithSameTitle = currentStyleSheets[currentStyleSheet.title];
      }

      if (!lastWithSameTitle) {
__L_V__2({
    lN: 7641,tT:'if',pr:'!lastWithSameTitle',eT:{},fN:''
  });'__L_V__2';
        let menuItem = document.createXULElement("menuitem");
        menuItem.setAttribute("type", "radio");
        menuItem.setAttribute("label", currentStyleSheet.title);
        menuItem.setAttribute("data", currentStyleSheet.title);
        menuItem.setAttribute(
          "checked",
          !currentStyleSheet.disabled && !styleDisabled
        );
        menuItem.setAttribute(
          "oncommand",
          "gPageStyleMenu.switchStyleSheet(this.getAttribute('data'));"
        );
        menuPopup.appendChild(menuItem);
        currentStyleSheets[currentStyleSheet.title] = menuItem;
      } else if (currentStyleSheet.disabled) {
__L_V__2({
    lN: 7656,tT:'if',pr:'currentStyleSheet.disabled',eT:{},fN:''
  });'__L_V__2';
        lastWithSameTitle.removeAttribute("checked");
      }
    }

    noStyle.setAttribute("checked", styleDisabled);
    persistentOnly.setAttribute("checked", !altStyleSelected && !styleDisabled);
    persistentOnly.hidden = styleSheetInfo.preferredStyleSheetSet
      ? haveAltSheets
      : false;
    sep.hidden = (noStyle.hidden && persistentOnly.hidden) || !haveAltSheets;
  },

  /**
   * Send a message to all PageStyleParents by walking the BrowsingContext tree.
   * @param message
   *        The string message to send to each PageStyleChild.
   * @param data
   *        The data to send to each PageStyleChild within the message.
   */
  _sendMessageToAll(message, data) {
__L_V__2({
    lN: 7676,tT:'func',pr:'',eT:{'message':message,'data':data},fN:'_sendMessageToAll'
  });'__L_V__2';
    let contextsToVisit = [gBrowser.selectedBrowser.browsingContext];
    while (contextsToVisit.length) {
      let currentContext = contextsToVisit.pop();
      let global = currentContext.currentWindowGlobal;

      if (!global) {
__L_V__2({
    lN: 7682,tT:'if',pr:'!global',eT:{},fN:''
  });'__L_V__2';
        continue;
      }

      let actor = global.getActor("PageStyle");
      actor.sendAsyncMessage(message, data);

      contextsToVisit.push(...currentContext.children);
    }
  },

  /**
   * Switch the stylesheet of all documents in the current browser.
   * @param title The title of the stylesheet to switch to.
   */
  switchStyleSheet(title) {
__L_V__2({
    lN: 7697,tT:'func',pr:'',eT:{'title':title},fN:'switchStyleSheet'
  });'__L_V__2';
    let { permanentKey } = gBrowser.selectedBrowser;
    let sheetData = this._pageStyleSheets.get(permanentKey);
    if (sheetData && sheetData.filteredStyleSheets) {
__L_V__2({
    lN: 7700,tT:'if',pr:'sheetData && sheetData.filteredStyleSheets',eT:{},fN:''
  });'__L_V__2';
      sheetData.authorStyleDisabled = false;
      for (let sheet of sheetData.filteredStyleSheets) {
        sheet.disabled = sheet.title !== title;
      }
    }
    this._sendMessageToAll("PageStyle:Switch", { title });
  },

  /**
   * Disable all stylesheets. Called with View > Page Style > No Style.
   */
  disableStyle() {
__L_V__2({
    lN: 7712,tT:'func',pr:'',eT:{},fN:'disableStyle'
  });'__L_V__2';
    let { permanentKey } = gBrowser.selectedBrowser;
    let sheetData = this._pageStyleSheets.get(permanentKey);
    if (sheetData) {
__L_V__2({
    lN: 7715,tT:'if',pr:'sheetData',eT:{},fN:''
  });'__L_V__2';
      sheetData.authorStyleDisabled = true;
    }
    this._sendMessageToAll("PageStyle:Disable", {});
  },
};

var LanguageDetectionListener = {
  init() {
__L_V__2({
    lN: 7723,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    window.messageManager.addMessageListener(
      "Translation:DocumentState",
      msg => {
        Translation.documentStateReceived(msg.target, msg.data);
      }
    );
  },
};

// Note that this is also called from non-browser windows on OSX, which do
// share menu items but not much else. See nonbrowser-mac.js.
var BrowserOffline = {
  _inited: false,

  // BrowserOffline Public Methods
  init() {
__L_V__2({
    lN: 7739,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    if (!this._uiElement) {
__L_V__2({
    lN: 7740,tT:'if',pr:'!this._uiElement',eT:{},fN:''
  });'__L_V__2';
      this._uiElement = document.getElementById("cmd_toggleOfflineStatus");
    }

    Services.obs.addObserver(this, "network:offline-status-changed");

    this._updateOfflineUI(Services.io.offline);

    this._inited = true;
  },

  uninit() {
__L_V__2({
    lN: 7751,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    if (this._inited) {
__L_V__2({
    lN: 7752,tT:'if',pr:'this._inited',eT:{},fN:''
  });'__L_V__2';
      Services.obs.removeObserver(this, "network:offline-status-changed");
    }
  },

  toggleOfflineStatus() {
__L_V__2({
    lN: 7757,tT:'func',pr:'',eT:{},fN:'toggleOfflineStatus'
  });'__L_V__2';
    var ioService = Services.io;

    if (!ioService.offline && !this._canGoOffline()) {
__L_V__2({
    lN: 7760,tT:'if',pr:'!ioService.offline && !this._canGoOffline()',eT:{},fN:''
  });'__L_V__2';
      this._updateOfflineUI(false);
      return;
    }

    ioService.offline = !ioService.offline;
  },

  // nsIObserver
  observe(aSubject, aTopic, aState) {
__L_V__2({
    lN: 7769,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aState':aState},fN:'observe'
  });'__L_V__2';
    if (aTopic != "network:offline-status-changed") {
__L_V__2({
    lN: 7770,tT:'if',pr:'aTopic != network:offline-status-changed',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // This notification is also received because of a loss in connectivity,
    // which we ignore by updating the UI to the current value of io.offline
    this._updateOfflineUI(Services.io.offline);
  },

  // BrowserOffline Implementation Methods
  _canGoOffline() {
__L_V__2({
    lN: 7780,tT:'func',pr:'',eT:{},fN:'_canGoOffline'
  });'__L_V__2';
    try {
      var cancelGoOffline = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
        Ci.nsISupportsPRBool
      );
      Services.obs.notifyObservers(cancelGoOffline, "offline-requested");

      // Something aborted the quit process.
      if (cancelGoOffline.data) {
__L_V__2({
    lN: 7788,tT:'if',pr:'cancelGoOffline.data',eT:{},fN:''
  });'__L_V__2';
        return false;
      }
    } catch (ex) {}

    return true;
  },

  _uiElement: null,
  _updateOfflineUI(aOffline) {
__L_V__2({
    lN: 7797,tT:'func',pr:'',eT:{'aOffline':aOffline},fN:'_updateOfflineUI'
  });'__L_V__2';
    var offlineLocked = Services.prefs.prefIsLocked("network.online");
    if (offlineLocked) {
__L_V__2({
    lN: 7799,tT:'if',pr:'offlineLocked',eT:{},fN:''
  });'__L_V__2';
      this._uiElement.setAttribute("disabled", "true");
    }

    this._uiElement.setAttribute("checked", aOffline);
  },
};

var IndexedDBPromptHelper = {
  _permissionsPrompt: "indexedDB-permissions-prompt",
  _permissionsResponse: "indexedDB-permissions-response",

  _notificationIcon: "indexedDB-notification-icon",

  init: function IndexedDBPromptHelper_init() {
__L_V__2({
    lN: 7813,tT:'func',pr:'',eT:{},fN:'IndexedDBPromptHelper_init'
  });'__L_V__2';
    Services.obs.addObserver(this, this._permissionsPrompt);
  },

  uninit: function IndexedDBPromptHelper_uninit() {
__L_V__2({
    lN: 7817,tT:'func',pr:'',eT:{},fN:'IndexedDBPromptHelper_uninit'
  });'__L_V__2';
    Services.obs.removeObserver(this, this._permissionsPrompt);
  },

  observe: function IndexedDBPromptHelper_observe(subject, topic, data) {
__L_V__2({
    lN: 7821,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'IndexedDBPromptHelper_observe'
  });'__L_V__2';
    if (topic != this._permissionsPrompt) {
__L_V__2({
    lN: 7822,tT:'if',pr:'topic != this._permissionsPrompt',eT:{},fN:''
  });'__L_V__2';
      throw new Error("Unexpected topic!");
    }

    var request = subject.QueryInterface(Ci.nsIIDBPermissionsRequest);

    var browser = request.browserElement;
    if (browser.ownerGlobal != window) {
__L_V__2({
    lN: 7829,tT:'if',pr:'browser.ownerGlobal != window',eT:{},fN:''
  });'__L_V__2';
      // Only listen for notifications for browsers in our chrome window.
      return;
    }

    // Get the host name if available or the file path otherwise.
    var host = browser.currentURI.asciiHost || browser.currentURI.pathQueryRef;

    var message;
    var responseTopic;
    if (topic == this._permissionsPrompt) {
__L_V__2({
    lN: 7839,tT:'if',pr:'topic == this._permissionsPrompt',eT:{},fN:''
  });'__L_V__2';
      message = gNavigatorBundle.getFormattedString("offlineApps.available2", [
        host,
      ]);
      responseTopic = this._permissionsResponse;
    }

    var observer = request.responseObserver;

    var mainAction = {
      label: gNavigatorBundle.getString("offlineApps.allowStoring.label"),
      accessKey: gNavigatorBundle.getString(
        "offlineApps.allowStoring.accesskey"
      ),
      callback() {
__L_V__2({
    lN: 7853,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
        observer.observe(
          null,
          responseTopic,
          Ci.nsIPermissionManager.ALLOW_ACTION
        );
      },
    };

    var secondaryActions = [
      {
        label: gNavigatorBundle.getString("offlineApps.dontAllow.label"),
        accessKey: gNavigatorBundle.getString(
          "offlineApps.dontAllow.accesskey"
        ),
        callback() {
__L_V__2({
    lN: 7868,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
          observer.observe(
            null,
            responseTopic,
            Ci.nsIPermissionManager.DENY_ACTION
          );
        },
      },
    ];

    PopupNotifications.show(
      browser,
      topic,
      message,
      this._notificationIcon,
      mainAction,
      secondaryActions,
      {
        persistent: true,
        hideClose: true,
      }
    );
  },
};

var CanvasPermissionPromptHelper = {
  _permissionsPrompt: "canvas-permissions-prompt",
  _permissionsPromptHideDoorHanger: "canvas-permissions-prompt-hide-doorhanger",
  _notificationIcon: "canvas-notification-icon",

  init() {
__L_V__2({
    lN: 7898,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    Services.obs.addObserver(this, this._permissionsPrompt);
    Services.obs.addObserver(this, this._permissionsPromptHideDoorHanger);
  },

  uninit() {
__L_V__2({
    lN: 7903,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    Services.obs.removeObserver(this, this._permissionsPrompt);
    Services.obs.removeObserver(this, this._permissionsPromptHideDoorHanger);
  },

  // aSubject is an nsIBrowser (e10s) or an nsIDOMWindow (non-e10s).
  // aData is an Origin string.
  observe(aSubject, aTopic, aData) {
__L_V__2({
    lN: 7910,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'observe'
  });'__L_V__2';
    if (
      aTopic != this._permissionsPrompt &&
      aTopic != this._permissionsPromptHideDoorHanger
    ) {
__L_V__2({
    lN: 7914,tT:'if',pr:' aTopic != this._permissionsPrompt && aTopic != this._permissionsPromptHideDoorHanger ',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    let browser;
    if (aSubject instanceof Ci.nsIDOMWindow) {
__L_V__2({
    lN: 7919,tT:'if',pr:'aSubject instanceof Ci.nsIDOMWindow',eT:{},fN:''
  });'__L_V__2';
      browser = aSubject.docShell.chromeEventHandler;
    } else {
      browser = aSubject;
    }

    if (gBrowser.selectedBrowser !== browser) {
__L_V__2({
    lN: 7925,tT:'if',pr:'gBrowser.selectedBrowser !== browser',eT:{},fN:''
  });'__L_V__2';
      // Must belong to some other window.
      return;
    }

    let message = gNavigatorBundle.getFormattedString(
      "canvas.siteprompt",
      ["<>"],
      1
    );

    let principal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(
      aData
    );

    function setCanvasPermission(aPerm, aPersistent) {
__L_V__2({
    lN: 7940,tT:'func',pr:'',eT:{'aPerm':aPerm,'aPersistent':aPersistent},fN:'setCanvasPermission'
  });'__L_V__2';
      Services.perms.addFromPrincipal(
        principal,
        "canvas",
        aPerm,
        aPersistent
          ? Ci.nsIPermissionManager.EXPIRE_NEVER
          : Ci.nsIPermissionManager.EXPIRE_SESSION
      );
    }

    let mainAction = {
      label: gNavigatorBundle.getString("canvas.allow"),
      accessKey: gNavigatorBundle.getString("canvas.allow.accesskey"),
      callback(state) {
__L_V__2({
    lN: 7954,tT:'func',pr:'',eT:{'state':state},fN:'callback'
  });'__L_V__2';
        setCanvasPermission(
          Ci.nsIPermissionManager.ALLOW_ACTION,
          state && state.checkboxChecked
        );
      },
    };

    let secondaryActions = [
      {
        label: gNavigatorBundle.getString("canvas.notAllow"),
        accessKey: gNavigatorBundle.getString("canvas.notAllow.accesskey"),
        callback(state) {
__L_V__2({
    lN: 7966,tT:'func',pr:'',eT:{'state':state},fN:'callback'
  });'__L_V__2';
          setCanvasPermission(
            Ci.nsIPermissionManager.DENY_ACTION,
            state && state.checkboxChecked
          );
        },
      },
    ];

    let checkbox = {
      // In PB mode, we don't want the "always remember" checkbox
      show: !PrivateBrowsingUtils.isWindowPrivate(window),
    };
    if (checkbox.show) {
__L_V__2({
    lN: 7979,tT:'if',pr:'checkbox.show',eT:{},fN:''
  });'__L_V__2';
      checkbox.checked = true;
      checkbox.label = gBrowserBundle.GetStringFromName("canvas.remember");
    }

    let options = {
      checkbox,
      name: principal.URI.host,
      learnMoreURL:
        Services.urlFormatter.formatURLPref("app.support.baseURL") +
        "fingerprint-permission",
      dismissed: aTopic == this._permissionsPromptHideDoorHanger,
    };
    PopupNotifications.show(
      browser,
      this._permissionsPrompt,
      message,
      this._notificationIcon,
      mainAction,
      secondaryActions,
      options
    );
  },
};

var WebAuthnPromptHelper = {
  _icon: "webauthn-notification-icon",
  _topic: "webauthn-prompt",

  // The current notification, if any. The U2F manager is a singleton, we will
  // never allow more than one active request. And thus we'll never have more
  // than one notification either.
  _current: null,

  // The current transaction ID. Will be checked when we're notified of the
  // cancellation of an ongoing WebAuthhn request.
  _tid: 0,

  init() {
__L_V__2({
    lN: 8017,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    Services.obs.addObserver(this, this._topic);
  },

  uninit() {
__L_V__2({
    lN: 8021,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    Services.obs.removeObserver(this, this._topic);
  },

  observe(aSubject, aTopic, aData) {
__L_V__2({
    lN: 8025,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'observe'
  });'__L_V__2';
    let mgr = aSubject.QueryInterface(Ci.nsIU2FTokenManager);
    let data = JSON.parse(aData);

    if (data.action == "register") {
__L_V__2({
    lN: 8029,tT:'if',pr:'data.action == register',eT:{},fN:''
  });'__L_V__2';
      this.register(mgr, data);
    } else if (data.action == "register-direct") {
__L_V__2({
    lN: 8031,tT:'if',pr:'data.action == register-direct',eT:{},fN:''
  });'__L_V__2';
      this.registerDirect(mgr, data);
    } else if (data.action == "sign") {
__L_V__2({
    lN: 8033,tT:'if',pr:'data.action == sign',eT:{},fN:''
  });'__L_V__2';
      this.sign(mgr, data);
    } else if (data.action == "cancel") {
__L_V__2({
    lN: 8035,tT:'if',pr:'data.action == cancel',eT:{},fN:''
  });'__L_V__2';
      this.cancel(data);
    }
  },

  register(mgr, { origin, tid }) {
__L_V__2({
    lN: 8040,tT:'func',pr:'',eT:{'mgr':mgr,'origin':origin,'tid':tid},fN:'register'
  });'__L_V__2';
    let mainAction = this.buildCancelAction(mgr, tid);
    this.show(tid, "register", "webauthn.registerPrompt2", origin, mainAction);
  },

  registerDirect(mgr, { origin, tid }) {
__L_V__2({
    lN: 8045,tT:'func',pr:'',eT:{'mgr':mgr,'origin':origin,'tid':tid},fN:'registerDirect'
  });'__L_V__2';
    let mainAction = this.buildProceedAction(mgr, tid);
    let secondaryActions = [this.buildCancelAction(mgr, tid)];

    let learnMoreURL =
      Services.urlFormatter.formatURLPref("app.support.baseURL") +
      "webauthn-direct-attestation";

    let options = {
      learnMoreURL,
      checkbox: {
        label: gNavigatorBundle.getString("webauthn.anonymize"),
      },
    };

    this.show(
      tid,
      "register-direct",
      "webauthn.registerDirectPrompt2",
      origin,
      mainAction,
      secondaryActions,
      options
    );
  },

  sign(mgr, { origin, tid }) {
__L_V__2({
    lN: 8071,tT:'func',pr:'',eT:{'mgr':mgr,'origin':origin,'tid':tid},fN:'sign'
  });'__L_V__2';
    let mainAction = this.buildCancelAction(mgr, tid);
    this.show(tid, "sign", "webauthn.signPrompt2", origin, mainAction);
  },

  show(
    tid,
    id,
    stringId,
    origin,
    mainAction,
    secondaryActions = [],
    options = {}
  ) {
__L_V__2({
    lN: 8084,tT:'func',pr:'',eT:{'tid':tid,'id':id,'stringId':stringId,'origin':origin,'mainAction':mainAction,'secondaryActions':secondaryActions,'options':options},fN:'show'
  });'__L_V__2';
    this.reset();

    try {
      origin = Services.io.newURI(origin).asciiHost;
    } catch (e) {
      /* Might fail for arbitrary U2F RP IDs. */
    }

    let brandShortName = document
      .getElementById("bundle_brand")
      .getString("brandShortName");
    let message = gNavigatorBundle.getFormattedString(
      stringId,
      ["<>", brandShortName],
      1
    );

    options.name = origin;
    options.hideClose = true;
    options.eventCallback = event => {
      if (event == "removed") {
__L_V__2({
    lN: 8105,tT:'if',pr:'event == removed',eT:{},fN:''
  });'__L_V__2';
        this._current = null;
        this._tid = 0;
      }
    };

    this._tid = tid;
    this._current = PopupNotifications.show(
      gBrowser.selectedBrowser,
      `webauthn-prompt-${id}`,
      message,
      this._icon,
      mainAction,
      secondaryActions,
      options
    );
  },

  cancel({ tid }) {
__L_V__2({
    lN: 8123,tT:'func',pr:'',eT:{'tid':tid},fN:'cancel'
  });'__L_V__2';
    if (this._tid == tid) {
__L_V__2({
    lN: 8124,tT:'if',pr:'this._tid == tid',eT:{},fN:''
  });'__L_V__2';
      this.reset();
    }
  },

  reset() {
__L_V__2({
    lN: 8129,tT:'func',pr:'',eT:{},fN:'reset'
  });'__L_V__2';
    if (this._current) {
__L_V__2({
    lN: 8130,tT:'if',pr:'this._current',eT:{},fN:''
  });'__L_V__2';
      this._current.remove();
    }
  },

  buildProceedAction(mgr, tid) {
__L_V__2({
    lN: 8135,tT:'func',pr:'',eT:{'mgr':mgr,'tid':tid},fN:'buildProceedAction'
  });'__L_V__2';
    return {
      label: gNavigatorBundle.getString("webauthn.proceed"),
      accessKey: gNavigatorBundle.getString("webauthn.proceed.accesskey"),
      callback(state) {
__L_V__2({
    lN: 8139,tT:'func',pr:'',eT:{'state':state},fN:'callback'
  });'__L_V__2';
        mgr.resumeRegister(tid, state.checkboxChecked);
      },
    };
  },

  buildCancelAction(mgr, tid) {
__L_V__2({
    lN: 8145,tT:'func',pr:'',eT:{'mgr':mgr,'tid':tid},fN:'buildCancelAction'
  });'__L_V__2';
    return {
      label: gNavigatorBundle.getString("webauthn.cancel"),
      accessKey: gNavigatorBundle.getString("webauthn.cancel.accesskey"),
      callback() {
__L_V__2({
    lN: 8149,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__2';
        mgr.cancel(tid);
      },
    };
  },
};

function CanCloseWindow() {
__L_V__2({
    lN: 8156,tT:'func',pr:'',eT:{},fN:'CanCloseWindow'
  });'__L_V__2';
  // Avoid redundant calls to canClose from showing multiple
  // PermitUnload dialogs.
  if (Services.startup.shuttingDown || window.skipNextCanClose) {
__L_V__2({
    lN: 8159,tT:'if',pr:'Services.startup.shuttingDown || window.skipNextCanClose',eT:{},fN:''
  });'__L_V__2';
    return true;
  }

  let timedOutProcesses = new WeakSet();

  for (let browser of gBrowser.browsers) {
    // Don't instantiate lazy browsers.
    if (!browser.isConnected) {
__L_V__2({
    lN: 8167,tT:'if',pr:'!browser.isConnected',eT:{},fN:''
  });'__L_V__2';
      continue;
    }

    let pmm = browser.messageManager.processMessageManager;

    if (timedOutProcesses.has(pmm)) {
__L_V__2({
    lN: 8173,tT:'if',pr:'timedOutProcesses.has(pmm)',eT:{},fN:''
  });'__L_V__2';
      continue;
    }

    let { permitUnload, timedOut } = browser.permitUnload();

    if (timedOut) {
__L_V__2({
    lN: 8179,tT:'if',pr:'timedOut',eT:{},fN:''
  });'__L_V__2';
      timedOutProcesses.add(pmm);
      continue;
    }

    if (!permitUnload) {
__L_V__2({
    lN: 8184,tT:'if',pr:'!permitUnload',eT:{},fN:''
  });'__L_V__2';
      return false;
    }
  }
  return true;
}

function WindowIsClosing() {
__L_V__2({
    lN: 8191,tT:'func',pr:'',eT:{},fN:'WindowIsClosing'
  });'__L_V__2';
  if (!closeWindow(false, warnAboutClosingWindow)) {
__L_V__2({
    lN: 8192,tT:'if',pr:'!closeWindow(false, warnAboutClosingWindow)',eT:{},fN:''
  });'__L_V__2';
    return false;
  }

  // In theory we should exit here and the Window's internal Close
  // method should trigger canClose on nsBrowserAccess. However, by
  // that point it's too late to be able to show a prompt for
  // PermitUnload. So we do it here, when we still can.
  if (CanCloseWindow()) {
__L_V__2({
    lN: 8200,tT:'if',pr:'CanCloseWindow()',eT:{},fN:''
  });'__L_V__2';
    // This flag ensures that the later canClose call does nothing.
    // It's only needed to make tests pass, since they detect the
    // prompt even when it's not actually shown.
    window.skipNextCanClose = true;
    return true;
  }

  return false;
}

/**
 * Checks if this is the last full *browser* window around. If it is, this will
 * be communicated like quitting. Otherwise, we warn about closing multiple tabs.
 * @returns true if closing can proceed, false if it got cancelled.
 */
function warnAboutClosingWindow() {
__L_V__2({
    lN: 8216,tT:'func',pr:'',eT:{},fN:'warnAboutClosingWindow'
  });'__L_V__2';
  // Popups aren't considered full browser windows; we also ignore private windows.
  let isPBWindow =
    PrivateBrowsingUtils.isWindowPrivate(window) &&
    !PrivateBrowsingUtils.permanentPrivateBrowsing;

  let closingTabs = gBrowser.tabs.length - gBrowser._removingTabs.length;

  if (!isPBWindow && !toolbar.visible) {
__L_V__2({
    lN: 8224,tT:'if',pr:'!isPBWindow && !toolbar.visible',eT:{},fN:''
  });'__L_V__2';
    return gBrowser.warnAboutClosingTabs(
      closingTabs,
      gBrowser.closingTabsEnum.ALL
    );
  }

  // Figure out if there's at least one other browser window around.
  let otherPBWindowExists = false;
  let otherWindowExists = false;
  for (let win of browserWindows()) {
    if (!win.closed && win != window) {
__L_V__2({
    lN: 8235,tT:'if',pr:'!win.closed && win != window',eT:{},fN:''
  });'__L_V__2';
      otherWindowExists = true;
      if (isPBWindow && PrivateBrowsingUtils.isWindowPrivate(win)) {
__L_V__2({
    lN: 8237,tT:'if',pr:'isPBWindow && PrivateBrowsingUtils.isWindowPrivate(win)',eT:{},fN:''
  });'__L_V__2';
        otherPBWindowExists = true;
      }
      // If the current window is not in private browsing mode we don't need to
      // look for other pb windows, we can leave the loop when finding the
      // first non-popup window. If however the current window is in private
      // browsing mode then we need at least one other pb and one non-popup
      // window to break out early.
      if (!isPBWindow || otherPBWindowExists) {
__L_V__2({
    lN: 8245,tT:'if',pr:'!isPBWindow || otherPBWindowExists',eT:{},fN:''
  });'__L_V__2';
        break;
      }
    }
  }

  if (isPBWindow && !otherPBWindowExists) {
__L_V__2({
    lN: 8251,tT:'if',pr:'isPBWindow && !otherPBWindowExists',eT:{},fN:''
  });'__L_V__2';
    let exitingCanceled = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
      Ci.nsISupportsPRBool
    );
    exitingCanceled.data = false;
    Services.obs.notifyObservers(exitingCanceled, "last-pb-context-exiting");
    if (exitingCanceled.data) {
__L_V__2({
    lN: 8257,tT:'if',pr:'exitingCanceled.data',eT:{},fN:''
  });'__L_V__2';
      return false;
    }
  }

  if (otherWindowExists) {
__L_V__2({
    lN: 8262,tT:'if',pr:'otherWindowExists',eT:{},fN:''
  });'__L_V__2';
    return (
      isPBWindow ||
      gBrowser.warnAboutClosingTabs(closingTabs, gBrowser.closingTabsEnum.ALL)
    );
  }

  let os = Services.obs;

  let closingCanceled = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
    Ci.nsISupportsPRBool
  );
  os.notifyObservers(closingCanceled, "browser-lastwindow-close-requested");
  if (closingCanceled.data) {
__L_V__2({
    lN: 8275,tT:'if',pr:'closingCanceled.data',eT:{},fN:''
  });'__L_V__2';
    return false;
  }

  os.notifyObservers(null, "browser-lastwindow-close-granted");

  // OS X doesn't quit the application when the last window is closed, but keeps
  // the session alive. Hence don't prompt users to save tabs, but warn about
  // closing multiple tabs.
  return (
    AppConstants.platform != "macosx" ||
    (isPBWindow ||
      gBrowser.warnAboutClosingTabs(closingTabs, gBrowser.closingTabsEnum.ALL))
  );
}

var MailIntegration = {
  sendLinkForBrowser(aBrowser) {
__L_V__2({
    lN: 8292,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'sendLinkForBrowser'
  });'__L_V__2';
    this.sendMessage(
      gURLBar.makeURIReadable(aBrowser.currentURI).displaySpec,
      aBrowser.contentTitle
    );
  },

  sendMessage(aBody, aSubject) {
__L_V__2({
    lN: 8299,tT:'func',pr:'',eT:{'aBody':aBody,'aSubject':aSubject},fN:'sendMessage'
  });'__L_V__2';
    // generate a mailto url based on the url and the url's title
    var mailtoUrl = "mailto:";
    if (aBody) {
__L_V__2({
    lN: 8302,tT:'if',pr:'aBody',eT:{},fN:''
  });'__L_V__2';
      mailtoUrl += "?body=" + encodeURIComponent(aBody);
      mailtoUrl += "&subject=" + encodeURIComponent(aSubject);
    }

    var uri = makeURI(mailtoUrl);

    // now pass this uri to the operating system
    this._launchExternalUrl(uri);
  },

  // a generic method which can be used to pass arbitrary urls to the operating
  // system.
  // aURL --> a nsIURI which represents the url to launch
  _launchExternalUrl(aURL) {
__L_V__2({
    lN: 8316,tT:'func',pr:'',eT:{'aURL':aURL},fN:'_launchExternalUrl'
  });'__L_V__2';
    var extProtocolSvc = Cc[
      "@mozilla.org/uriloader/external-protocol-service;1"
    ].getService(Ci.nsIExternalProtocolService);
    if (extProtocolSvc) {
__L_V__2({
    lN: 8320,tT:'if',pr:'extProtocolSvc',eT:{},fN:''
  });'__L_V__2';
      extProtocolSvc.loadURI(aURL);
    }
  },
};

function BrowserOpenAddonsMgr(aView) {
__L_V__2({
    lN: 8326,tT:'func',pr:'',eT:{'aView':aView},fN:'BrowserOpenAddonsMgr'
  });'__L_V__2';
  return new Promise(resolve => {
    let emWindow;
    let browserWindow;

    var receivePong = function(aSubject, aTopic, aData) {
__L_V__2({
    lN: 8331,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'function'
  });'__L_V__2';
      let browserWin = aSubject.docShell.rootTreeItem.domWindow;
      if (!emWindow || browserWin == window /* favor the current window */) {
__L_V__2({
    lN: 8333,tT:'if',pr:'!emWindow || browserWin == window /* favor the current window */',eT:{},fN:''
  });'__L_V__2';
        emWindow = aSubject;
        browserWindow = browserWin;
      }
    };
    Services.obs.addObserver(receivePong, "EM-pong");
    Services.obs.notifyObservers(null, "EM-ping");
    Services.obs.removeObserver(receivePong, "EM-pong");

    if (emWindow) {
__L_V__2({
    lN: 8342,tT:'if',pr:'emWindow',eT:{},fN:''
  });'__L_V__2';
      if (aView) {
__L_V__2({
    lN: 8343,tT:'if',pr:'aView',eT:{},fN:''
  });'__L_V__2';
        emWindow.loadView(aView);
      }
      let tab = browserWindow.gBrowser.getTabForBrowser(
        emWindow.docShell.chromeEventHandler
      );
      browserWindow.gBrowser.selectedTab = tab;
      emWindow.focus();
      resolve(emWindow);
      return;
    }

    // This must be a new load, else the ping/pong would have
    // found the window above.
    let whereToOpen =
      window.gBrowser && gBrowser.selectedTab.isEmpty ? "current" : "tab";
    openTrustedLinkIn("about:addons", whereToOpen);

    Services.obs.addObserver(function observer(aSubject, aTopic, aData) {
__L_V__2({
    lN: 8361,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'observer'
  });'__L_V__2';
      Services.obs.removeObserver(observer, aTopic);
      if (aView) {
__L_V__2({
    lN: 8363,tT:'if',pr:'aView',eT:{},fN:''
  });'__L_V__2';
        aSubject.loadView(aView);
      }
      aSubject.focus();
      resolve(aSubject);
    }, "EM-loaded");
  });
}

function AddKeywordForSearchField() {
__L_V__2({
    lN: 8372,tT:'func',pr:'',eT:{},fN:'AddKeywordForSearchField'
  });'__L_V__2';
  if (!gContextMenu) {
__L_V__2({
    lN: 8373,tT:'if',pr:'!gContextMenu',eT:{},fN:''
  });'__L_V__2';
    throw new Error("Context menu doesn't seem to be open.");
  }

  gContextMenu.addKeywordForSearchField();
}

/**
 * Re-open a closed tab.
 * @param aIndex
 *        The index of the tab (via SessionStore.getClosedTabData)
 * @returns a reference to the reopened tab.
 */
function undoCloseTab(aIndex) {
__L_V__2({
    lN: 8386,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'undoCloseTab'
  });'__L_V__2';
  // wallpaper patch to prevent an unnecessary blank tab (bug 343895)
  var blankTabToRemove = null;
  if (gBrowser.tabs.length == 1 && gBrowser.selectedTab.isEmpty) {
__L_V__2({
    lN: 8389,tT:'if',pr:'gBrowser.tabs.length == 1 && gBrowser.selectedTab.isEmpty',eT:{},fN:''
  });'__L_V__2';
    blankTabToRemove = gBrowser.selectedTab;
  }

  var tab = null;
  if (SessionStore.getClosedTabCount(window) > (aIndex || 0)) {
__L_V__2({
    lN: 8394,tT:'if',pr:'SessionStore.getClosedTabCount(window) > (aIndex || 0)',eT:{},fN:''
  });'__L_V__2';
    tab = SessionStore.undoCloseTab(window, aIndex || 0);

    if (blankTabToRemove) {
__L_V__2({
    lN: 8397,tT:'if',pr:'blankTabToRemove',eT:{},fN:''
  });'__L_V__2';
      gBrowser.removeTab(blankTabToRemove);
    }
  }

  return tab;
}

/**
 * Re-open a closed window.
 * @param aIndex
 *        The index of the window (via SessionStore.getClosedWindowData)
 * @returns a reference to the reopened window.
 */
function undoCloseWindow(aIndex) {
__L_V__2({
    lN: 8411,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'undoCloseWindow'
  });'__L_V__2';
  let window = null;
  if (SessionStore.getClosedWindowCount() > (aIndex || 0)) {
__L_V__2({
    lN: 8413,tT:'if',pr:'SessionStore.getClosedWindowCount() > (aIndex || 0)',eT:{},fN:''
  });'__L_V__2';
    window = SessionStore.undoCloseWindow(aIndex || 0);
  }

  return window;
}

/**
 * Check whether a page can be considered as 'empty', that its URI
 * reflects its origin, and that if it's loaded in a tab, that tab
 * could be considered 'empty' (e.g. like the result of opening
 * a 'blank' new tab).
 *
 * We have to do more than just check the URI, because especially
 * for things like about:blank, it is possible that the opener or
 * some other page has control over the contents of the page.
 *
 * @param browser {Browser}
 *        The browser whose page we're checking (the selected browser
 *        in this window if omitted).
 * @param uri {nsIURI}
 *        The URI against which we're checking (the browser's currentURI
 *        if omitted).
 *
 * @return false if the page was opened by or is controlled by arbitrary web
 *         content, unless that content corresponds with the URI.
 *         true if the page is blank and controlled by a principal matching
 *         that URI (or the system principal if the principal has no URI)
 */
function checkEmptyPageOrigin(
  browser = gBrowser.selectedBrowser,
  uri = browser.currentURI
) {
__L_V__2({
    lN: 8445,tT:'func',pr:'',eT:{'browser':browser,'uri':uri},fN:'checkEmptyPageOrigin'
  });'__L_V__2';
  // If another page opened this page with e.g. window.open, this page might
  // be controlled by its opener - return false.
  if (browser.hasContentOpener) {
__L_V__2({
    lN: 8448,tT:'if',pr:'browser.hasContentOpener',eT:{},fN:''
  });'__L_V__2';
    return false;
  }
  let contentPrincipal = browser.contentPrincipal;
  // Not all principals have URIs...
  if (contentPrincipal.URI) {
__L_V__2({
    lN: 8453,tT:'if',pr:'contentPrincipal.URI',eT:{},fN:''
  });'__L_V__2';
    // There are two special-cases involving about:blank. One is where
    // the user has manually loaded it and it got created with a null
    // principal. The other involves the case where we load
    // some other empty page in a browser and the current page is the
    // initial about:blank page (which has that as its principal, not
    // just URI in which case it could be web-based). Especially in
    // e10s, we need to tackle that case specifically to avoid race
    // conditions when updating the URL bar.
    //
    // Note that we check the documentURI here, since the currentURI on
    // the browser might have been set by SessionStore in order to
    // support switch-to-tab without having actually loaded the content
    // yet.
    let uriToCheck = browser.documentURI || uri;
    if (
      (uriToCheck.spec == "about:blank" && contentPrincipal.isNullPrincipal) ||
      contentPrincipal.URI.spec == "about:blank"
    ) {
__L_V__2({
    lN: 8471,tT:'if',pr:' (uriToCheck.spec == about:blank && contentPrincipal.isNullPrincipal) || contentPrincipal.URI.spec == about:blank ',eT:{},fN:''
  });'__L_V__2';
      return true;
    }
    // CLIQZ-SPECIAL: DB-2359, compare two Cliqz uris ignoring their hash parameters.
    if (CliqzResources.isCliqzPage(uri.spec) &&
      CliqzResources.isCliqzPage(contentPrincipal.URI.spec)) {
__L_V__2({
    lN: 8476,tT:'if',pr:'CliqzResources.isCliqzPage(uri.spec) && CliqzResources.isCliqzPage(contentPrincipal.URI.spec)',eT:{},fN:''
  });'__L_V__2';
        return contentPrincipal.URI.equalsExceptRef(uri);
    }
    return contentPrincipal.URI.equals(uri);
  }
  // ... so for those that don't have them, enforce that the page has the
  // system principal (this matches e.g. on about:newtab).

  return contentPrincipal.isSystemPrincipal;
}

function ReportFalseDeceptiveSite() {
__L_V__2({
    lN: 8487,tT:'func',pr:'',eT:{},fN:'ReportFalseDeceptiveSite'
  });'__L_V__2';
  let contextsToVisit = [gBrowser.selectedBrowser.browsingContext];
  while (contextsToVisit.length) {
    let currentContext = contextsToVisit.pop();
    let global = currentContext.currentWindowGlobal;

    if (!global) {
__L_V__2({
    lN: 8493,tT:'if',pr:'!global',eT:{},fN:''
  });'__L_V__2';
      continue;
    }
    let docURI = global.documentURI;
    // Ensure the page is an about:blocked pagae before handling.
    if (docURI && docURI.spec.startsWith("about:blocked?e=deceptiveBlocked")) {
__L_V__2({
    lN: 8498,tT:'if',pr:'docURI && docURI.spec.startsWith(about:blocked?e=deceptiveBlocked)',eT:{},fN:''
  });'__L_V__2';
      let actor = global.getActor("BlockedSite");
      actor.sendQuery("DeceptiveBlockedDetails").then(data => {
        let reportUrl = gSafeBrowsing.getReportURL(
          "PhishMistake",
          data.blockedInfo
        );
        if (reportUrl) {
__L_V__2({
    lN: 8505,tT:'if',pr:'reportUrl',eT:{},fN:''
  });'__L_V__2';
          openTrustedLinkIn(reportUrl, "tab");
        } else {
          let bundle = Services.strings.createBundle(
            "chrome://browser/locale/safebrowsing/safebrowsing.properties"
          );
          Services.prompt.alert(
            window,
            bundle.GetStringFromName("errorReportFalseDeceptiveTitle"),
            bundle.formatStringFromName("errorReportFalseDeceptiveMessage", [
              data.blockedInfo.provider,
            ])
          );
        }
      });
    }

    contextsToVisit.push(...currentContext.children);
  }
}

/**
 * Format a URL
 * eg:
 * echo formatURL("https://addons.mozilla.org/%LOCALE%/%APP%/%VERSION%/");
 * > https://addons.mozilla.org/en-US/firefox/3.0a1/
 *
 * Currently supported built-ins are LOCALE, APP, and any value from nsIXULAppInfo, uppercased.
 */
function formatURL(aFormat, aIsPref) {
__L_V__2({
    lN: 8534,tT:'func',pr:'',eT:{'aFormat':aFormat,'aIsPref':aIsPref},fN:'formatURL'
  });'__L_V__2';
  return aIsPref
    ? Services.urlFormatter.formatURLPref(aFormat)
    : Services.urlFormatter.formatURL(aFormat);
}

/**
 * When the browser is being controlled from out-of-process,
 * e.g. when Marionette or the remote debugging protocol is used,
 * we add a visual hint to the browser UI to indicate to the user
 * that the browser session is under remote control.
 *
 * This is called when the content browser initialises (from gBrowserInit.onLoad())
 * and when the "remote-listening" system notification fires.
 */
const gRemoteControl = {
  observe(subject, topic, data) {
__L_V__2({
    lN: 8550,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    gRemoteControl.updateVisualCue(data);
  },

  updateVisualCue(enabled) {
__L_V__2({
    lN: 8554,tT:'func',pr:'',eT:{'enabled':enabled},fN:'updateVisualCue'
  });'__L_V__2';
    const mainWindow = document.documentElement;
    if (enabled) {
__L_V__2({
    lN: 8556,tT:'if',pr:'enabled',eT:{},fN:''
  });'__L_V__2';
      mainWindow.setAttribute("remotecontrol", "true");
    } else {
      mainWindow.removeAttribute("remotecontrol");
    }
  },
};

const gAccessibilityServiceIndicator = {
  init() {
__L_V__2({
    lN: 8565,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    // Pref to enable accessibility service indicator.
    Services.prefs.addObserver("accessibility.indicator.enabled", this);
    // Accessibility service init/shutdown event.
    Services.obs.addObserver(this, "a11y-init-or-shutdown");
    this._update(Services.appinfo.accessibilityEnabled);
  },

  _update(accessibilityEnabled = false) {
__L_V__2({
    lN: 8573,tT:'func',pr:'',eT:{'accessibilityEnabled':accessibilityEnabled},fN:'_update'
  });'__L_V__2';
    if (this.enabled && accessibilityEnabled) {
__L_V__2({
    lN: 8574,tT:'if',pr:'this.enabled && accessibilityEnabled',eT:{},fN:''
  });'__L_V__2';
      this._active = true;
      document.documentElement.setAttribute("accessibilitymode", "true");
      [...document.querySelectorAll(".accessibility-indicator")].forEach(
        indicator =>
          ["click", "keypress"].forEach(type =>
            indicator.addEventListener(type, this)
          )
      );
    } else if (this._active) {
__L_V__2({
    lN: 8583,tT:'if',pr:'this._active',eT:{},fN:''
  });'__L_V__2';
      this._active = false;
      document.documentElement.removeAttribute("accessibilitymode");
      [...document.querySelectorAll(".accessibility-indicator")].forEach(
        indicator =>
          ["click", "keypress"].forEach(type =>
            indicator.removeEventListener(type, this)
          )
      );
    }
  },

  observe(subject, topic, data) {
__L_V__2({
    lN: 8595,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__2';
    if (
      topic == "nsPref:changed" &&
      data === "accessibility.indicator.enabled"
    ) {
__L_V__2({
    lN: 8599,tT:'if',pr:' topic == nsPref:changed && data === accessibility.indicator.enabled ',eT:{},fN:''
  });'__L_V__2';
      this._update(Services.appinfo.accessibilityEnabled);
    } else if (topic === "a11y-init-or-shutdown") {
__L_V__2({
    lN: 8601,tT:'if',pr:'topic === a11y-init-or-shutdown',eT:{},fN:''
  });'__L_V__2';
      // When "a11y-init-or-shutdown" event is fired, "1" indicates that
      // accessibility service is started and "0" that it is shut down.
      this._update(data === "1");
    }
  },

  get enabled() {
__L_V__2({
    lN: 8608,tT:'func',pr:'',eT:{},fN:'enabled'
  });'__L_V__2';
    return Services.prefs.getBoolPref("accessibility.indicator.enabled");
  },

  handleEvent({ key, type }) {
__L_V__2({
    lN: 8612,tT:'func',pr:'',eT:{'key':key,'type':type},fN:'handleEvent'
  });'__L_V__2';
    if (
      (type === "keypress" && [" ", "Enter"].includes(key)) ||
      type === "click"
    ) {
__L_V__2({
    lN: 8616,tT:'if',pr:' (type === keypress && [ , Enter].includes(key)) || type === click ',eT:{},fN:''
  });'__L_V__2';
      let a11yServicesSupportURL = Services.urlFormatter.formatURLPref(
        "accessibility.support.url"
      );
      // This is a known URL coming from trusted UI
      openTrustedLinkIn(a11yServicesSupportURL, "tab");
      Services.telemetry.scalarSet("a11y.indicator_acted_on", true);
    }
  },

  uninit() {
__L_V__2({
    lN: 8626,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    Services.prefs.removeObserver("accessibility.indicator.enabled", this);
    Services.obs.removeObserver(this, "a11y-init-or-shutdown");
  },
};

// Note that this is also called from non-browser windows on OSX, which do
// share menu items but not much else. See nonbrowser-mac.js.
var gPrivateBrowsingUI = {
  init: function PBUI_init() {
__L_V__2({
    lN: 8635,tT:'func',pr:'',eT:{},fN:'PBUI_init'
  });'__L_V__2';
    // Do nothing for normal windows
    if (!PrivateBrowsingUtils.isWindowPrivate(window)) {
__L_V__2({
    lN: 8637,tT:'if',pr:'!PrivateBrowsingUtils.isWindowPrivate(window)',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // Disable the Clear Recent History... menu item when in PB mode
    // temporary fix until bug 463607 is fixed
    document.getElementById("Tools:Sanitize").setAttribute("disabled", "true");

    if (window.location.href != AppConstants.BROWSER_CHROME_URL) {
__L_V__2({
    lN: 8645,tT:'if',pr:'window.location.href != AppConstants.BROWSER_CHROME_URL',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    // Adjust the window's title
    let docElement = document.documentElement;
    docElement.setAttribute(
      "privatebrowsingmode",
      PrivateBrowsingUtils.permanentPrivateBrowsing ? "permanent" : "temporary"
    );
    gBrowser.updateTitlebar();

    if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
__L_V__2({
    lN: 8657,tT:'if',pr:'PrivateBrowsingUtils.permanentPrivateBrowsing',eT:{},fN:''
  });'__L_V__2';
      // Adjust the New Window menu entries
      let newWindow = document.getElementById("menu_newNavigator");
      let newPrivateWindow = document.getElementById("menu_newPrivateWindow");
      if (newWindow && newPrivateWindow) {
__L_V__2({
    lN: 8661,tT:'if',pr:'newWindow && newPrivateWindow',eT:{},fN:''
  });'__L_V__2';
        newPrivateWindow.hidden = true;
        newWindow.label = newPrivateWindow.label;
        newWindow.accessKey = newPrivateWindow.accessKey;
        newWindow.command = newPrivateWindow.command;
      }
    }
  },
};

/**
 * Switch to a tab that has a given URI, and focuses its browser window.
 * If a matching tab is in this window, it will be switched to. Otherwise, other
 * windows will be searched.
 *
 * @param aURI
 *        URI to search for
 * @param aOpenNew
 *        True to open a new tab and switch to it, if no existing tab is found.
 *        If no suitable window is found, a new one will be opened.
 * @param aOpenParams
 *        If switching to this URI results in us opening a tab, aOpenParams
 *        will be the parameter object that gets passed to openTrustedLinkIn. Please
 *        see the documentation for openTrustedLinkIn to see what parameters can be
 *        passed via this object.
 *        This object also allows:
 *        - 'ignoreFragment' property to be set to true to exclude fragment-portion
 *        matching when comparing URIs.
 *          If set to "whenComparing", the fragment will be unmodified.
 *          If set to "whenComparingAndReplace", the fragment will be replaced.
 *        - 'ignoreQueryString' boolean property to be set to true to exclude query string
 *        matching when comparing URIs.
 *        - 'replaceQueryString' boolean property to be set to true to exclude query string
 *        matching when comparing URIs and overwrite the initial query string with
 *        the one from the new URI.
 *        - 'adoptIntoActiveWindow' boolean property to be set to true to adopt the tab
 *        into the current window.
 * @return True if an existing tab was found, false otherwise
 */
function switchToTabHavingURI(aURI, aOpenNew, aOpenParams = {}) {
__L_V__2({
    lN: 8700,tT:'func',pr:'',eT:{'aURI':aURI,'aOpenNew':aOpenNew,'aOpenParams':aOpenParams},fN:'switchToTabHavingURI'
  });'__L_V__2';
  // Certain URLs can be switched to irrespective of the source or destination
  // window being in private browsing mode:
  const kPrivateBrowsingWhitelist = new Set(["about:addons"]);

  let ignoreFragment = aOpenParams.ignoreFragment;
  let ignoreQueryString = aOpenParams.ignoreQueryString;
  let replaceQueryString = aOpenParams.replaceQueryString;
  let adoptIntoActiveWindow = aOpenParams.adoptIntoActiveWindow;

  // These properties are only used by switchToTabHavingURI and should
  // not be used as a parameter for the new load.
  delete aOpenParams.ignoreFragment;
  delete aOpenParams.ignoreQueryString;
  delete aOpenParams.replaceQueryString;
  delete aOpenParams.adoptIntoActiveWindow;

  let isBrowserWindow = !!window.gBrowser;

  // This will switch to the tab in aWindow having aURI, if present.
  function switchIfURIInWindow(aWindow) {
__L_V__2({
    lN: 8720,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'switchIfURIInWindow'
  });'__L_V__2';
    // Only switch to the tab if neither the source nor the destination window
    // are private and they are not in permanent private browsing mode
    if (
      !kPrivateBrowsingWhitelist.has(aURI.spec) &&
      (PrivateBrowsingUtils.isWindowPrivate(window) ||
        PrivateBrowsingUtils.isWindowPrivate(aWindow)) &&
      !PrivateBrowsingUtils.permanentPrivateBrowsing
    ) {
__L_V__2({
    lN: 8728,tT:'if',pr:' !kPrivateBrowsingWhitelist.has(aURI.spec) && (PrivateBrowsingUtils.isWindowPrivate(window) || PrivateBrowsingUtils.isWindowPrivate(aWindow)) && !PrivateBrowsingUtils.permanentPrivateBrowsing ',eT:{},fN:''
  });'__L_V__2';
      return false;
    }

    // Remove the query string, fragment, both, or neither from a given url.
    function cleanURL(url, removeQuery, removeFragment) {
__L_V__2({
    lN: 8733,tT:'func',pr:'',eT:{'url':url,'removeQuery':removeQuery,'removeFragment':removeFragment},fN:'cleanURL'
  });'__L_V__2';
      let ret = url;
      if (removeFragment) {
__L_V__2({
    lN: 8735,tT:'if',pr:'removeFragment',eT:{},fN:''
  });'__L_V__2';
        ret = ret.split("#")[0];
        if (removeQuery) {
__L_V__2({
    lN: 8737,tT:'if',pr:'removeQuery',eT:{},fN:''
  });'__L_V__2';
          // This removes a query, if present before the fragment.
          ret = ret.split("?")[0];
        }
      } else if (removeQuery) {
__L_V__2({
    lN: 8741,tT:'if',pr:'removeQuery',eT:{},fN:''
  });'__L_V__2';
        // This is needed in case there is a fragment after the query.
        let fragment = ret.split("#")[1];
        ret = ret
          .split("?")[0]
          .concat(fragment != undefined ? "#".concat(fragment) : "");
      }
      return ret;
    }

    // Need to handle nsSimpleURIs here too (e.g. about:...), which don't
    // work correctly with URL objects - so treat them as strings
    let ignoreFragmentWhenComparing =
      typeof ignoreFragment == "string" &&
      ignoreFragment.startsWith("whenComparing");
    let requestedCompare = cleanURL(
      aURI.displaySpec,
      ignoreQueryString || replaceQueryString,
      ignoreFragmentWhenComparing
    );
    let browsers = aWindow.gBrowser.browsers;
    for (let i = 0; i < browsers.length; i++) {
      let browser = browsers[i];
      let browserCompare = cleanURL(
        browser.currentURI.displaySpec,
        ignoreQueryString || replaceQueryString,
        ignoreFragmentWhenComparing
      );
      if (requestedCompare == browserCompare) {
__L_V__2({
    lN: 8769,tT:'if',pr:'requestedCompare == browserCompare',eT:{},fN:''
  });'__L_V__2';
        // If adoptIntoActiveWindow is set, and this is a cross-window switch,
        // adopt the tab into the current window, after the active tab.
        let doAdopt =
          adoptIntoActiveWindow && isBrowserWindow && aWindow != window;

        if (doAdopt) {
__L_V__2({
    lN: 8775,tT:'if',pr:'doAdopt',eT:{},fN:''
  });'__L_V__2';
          window.gBrowser.adoptTab(
            aWindow.gBrowser.getTabForBrowser(browser),
            window.gBrowser.tabContainer.selectedIndex + 1,
            /* aSelectTab = */ true
          );
        } else {
          aWindow.focus();
        }

        if (ignoreFragment == "whenComparingAndReplace" || replaceQueryString) {
__L_V__2({
    lN: 8785,tT:'if',pr:'ignoreFragment == whenComparingAndReplace || replaceQueryString',eT:{},fN:''
  });'__L_V__2';
          browser.loadURI(aURI.spec, {
            triggeringPrincipal:
              aOpenParams.triggeringPrincipal ||
              _createNullPrincipalFromTabUserContextId(),
          });
        }

        if (!doAdopt) {
__L_V__2({
    lN: 8793,tT:'if',pr:'!doAdopt',eT:{},fN:''
  });'__L_V__2';
          aWindow.gBrowser.tabContainer.selectedIndex = i;
        }

        return true;
      }
    }
    return false;
  }

  // This can be passed either nsIURI or a string.
  if (!(aURI instanceof Ci.nsIURI)) {
__L_V__2({
    lN: 8804,tT:'if',pr:'!(aURI instanceof Ci.nsIURI)',eT:{},fN:''
  });'__L_V__2';
    aURI = Services.io.newURI(aURI);
  }

  // Prioritise this window.
  if (isBrowserWindow && switchIfURIInWindow(window)) {
__L_V__2({
    lN: 8809,tT:'if',pr:'isBrowserWindow && switchIfURIInWindow(window)',eT:{},fN:''
  });'__L_V__2';
    return true;
  }

  for (let browserWin of browserWindows()) {
    // Skip closed (but not yet destroyed) windows,
    // and the current window (which was checked earlier).
    if (browserWin.closed || browserWin == window) {
__L_V__2({
    lN: 8816,tT:'if',pr:'browserWin.closed || browserWin == window',eT:{},fN:''
  });'__L_V__2';
      continue;
    }
    if (switchIfURIInWindow(browserWin)) {
__L_V__2({
    lN: 8819,tT:'if',pr:'switchIfURIInWindow(browserWin)',eT:{},fN:''
  });'__L_V__2';
      return true;
    }
  }

  // No opened tab has that url.
  if (aOpenNew) {
__L_V__2({
    lN: 8825,tT:'if',pr:'aOpenNew',eT:{},fN:''
  });'__L_V__2';
    if (isBrowserWindow && gBrowser.selectedTab.isEmpty) {
__L_V__2({
    lN: 8826,tT:'if',pr:'isBrowserWindow && gBrowser.selectedTab.isEmpty',eT:{},fN:''
  });'__L_V__2';
      openTrustedLinkIn(aURI.spec, "current", aOpenParams);
    } else {
      openTrustedLinkIn(aURI.spec, "tab", aOpenParams);
    }
  }

  return false;
}

var RestoreLastSessionObserver = {
  init() {
__L_V__2({
    lN: 8837,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    if (
      SessionStore.canRestoreLastSession &&
      !PrivateBrowsingUtils.isWindowPrivate(window)
    ) {
__L_V__2({
    lN: 8841,tT:'if',pr:' SessionStore.canRestoreLastSession && !PrivateBrowsingUtils.isWindowPrivate(window) ',eT:{},fN:''
  });'__L_V__2';
      Services.obs.addObserver(this, "sessionstore-last-session-cleared", true);
      goSetCommandEnabled("Browser:RestoreLastSession", true);
    } else if (SessionStore.willAutoRestore) {
__L_V__2({
    lN: 8844,tT:'if',pr:'SessionStore.willAutoRestore',eT:{},fN:''
  });'__L_V__2';
      document
        .getElementById("Browser:RestoreLastSession")
        .setAttribute("hidden", true);
    }
  },

  observe() {
__L_V__2({
    lN: 8851,tT:'func',pr:'',eT:{},fN:'observe'
  });'__L_V__2';
    // The last session can only be restored once so there's
    // no way we need to re-enable our menu item.
    Services.obs.removeObserver(this, "sessionstore-last-session-cleared");
    goSetCommandEnabled("Browser:RestoreLastSession", false);
  },

  QueryInterface: ChromeUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference,
  ]),
};

/* Observes menus and adjusts their size for better
 * usability when opened via a touch screen. */
var MenuTouchModeObserver = {
  init() {
__L_V__2({
    lN: 8867,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    window.addEventListener("popupshowing", this, true);
  },

  handleEvent(event) {
__L_V__2({
    lN: 8871,tT:'func',pr:'',eT:{'event':event},fN:'handleEvent'
  });'__L_V__2';
    let target = event.originalTarget;
    if (event.mozInputSource == MouseEvent.MOZ_SOURCE_TOUCH) {
__L_V__2({
    lN: 8873,tT:'if',pr:'event.mozInputSource == MouseEvent.MOZ_SOURCE_TOUCH',eT:{},fN:''
  });'__L_V__2';
      target.setAttribute("touchmode", "true");
    } else {
      target.removeAttribute("touchmode");
    }
  },

  uninit() {
__L_V__2({
    lN: 8880,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    window.removeEventListener("popupshowing", this, true);
  },
};

// Prompt user to restart the browser in safe mode
function safeModeRestart() {
__L_V__2({
    lN: 8886,tT:'func',pr:'',eT:{},fN:'safeModeRestart'
  });'__L_V__2';
  if (Services.appinfo.inSafeMode) {
__L_V__2({
    lN: 8887,tT:'if',pr:'Services.appinfo.inSafeMode',eT:{},fN:''
  });'__L_V__2';
    let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
      Ci.nsISupportsPRBool
    );
    Services.obs.notifyObservers(
      cancelQuit,
      "quit-application-requested",
      "restart"
    );

    if (cancelQuit.data) {
__L_V__2({
    lN: 8897,tT:'if',pr:'cancelQuit.data',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    Services.startup.quit(
      Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit
    );
    return;
  }

  Services.obs.notifyObservers(null, "restart-in-safe-mode");
}

/* duplicateTabIn duplicates tab in a place specified by the parameter |where|.
 *
 * |where| can be:
 *  "tab"         new tab
 *  "tabshifted"  same as "tab" but in background if default is to select new
 *                tabs, and vice versa
 *  "window"      new window
 *
 * delta is the offset to the history entry that you want to load.
 */
function duplicateTabIn(aTab, where, delta) {
__L_V__2({
    lN: 8920,tT:'func',pr:'',eT:{'aTab':aTab,'where':where,'delta':delta},fN:'duplicateTabIn'
  });'__L_V__2';
__L_V__2({
    lN: 8921,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
  switch (where) {
    case "window":
      let otherWin = OpenBrowserWindow();
      let delayedStartupFinished = (subject, topic) => {
        if (
          topic == "browser-delayed-startup-finished" &&
          subject == otherWin
        ) {
__L_V__2({
    lN: 8928,tT:'if',pr:' topic == browser-delayed-startup-finished && subject == otherWin ',eT:{},fN:''
  });'__L_V__2';
          Services.obs.removeObserver(delayedStartupFinished, topic);
          let otherGBrowser = otherWin.gBrowser;
          let otherTab = otherGBrowser.selectedTab;
          SessionStore.duplicateTab(otherWin, aTab, delta);
          otherGBrowser.removeTab(otherTab, { animate: false });
        }
      };

      Services.obs.addObserver(
        delayedStartupFinished,
        "browser-delayed-startup-finished"
      );
      break;
    case "tabshifted":
      SessionStore.duplicateTab(window, aTab, delta);
      // A background tab has been opened, nothing else to do here.
      break;
    case "tab":
      let newTab = SessionStore.duplicateTab(window, aTab, delta);
      gBrowser.selectedTab = newTab;
      break;
    case "tabadjacent":
      let newTab2 = SessionStore.duplicateTab(window, aTab, delta);
      gBrowser.moveTabTo(newTab2, aTab._tPos + 1);
      gBrowser.selectedTab = newTab2;
      break;
  }
}

var MousePosTracker = {
  _listeners: new Set(),
  _x: 0,
  _y: 0,

  /**
   * Registers a listener.
   *
   * @param listener (object)
   *        A listener is expected to expose the following properties:
   *
   *        getMouseTargetRect (function)
   *          Returns the rect that the MousePosTracker needs to alert
   *          the listener about if the mouse happens to be within it.
   *
   *        onMouseEnter (function, optional)
   *          The function to be called if the mouse enters the rect
   *          returned by getMouseTargetRect. MousePosTracker always
   *          runs this inside of a requestAnimationFrame, since it
   *          assumes that the notification is used to update the DOM.
   *
   *        onMouseLeave (function, optional)
   *          The function to be called if the mouse exits the rect
   *          returned by getMouseTargetRect. MousePosTracker always
   *          runs this inside of a requestAnimationFrame, since it
   *          assumes that the notification is used to update the DOM.
   */
  addListener(listener) {
__L_V__2({
    lN: 8985,tT:'func',pr:'',eT:{'listener':listener},fN:'addListener'
  });'__L_V__2';
    if (this._listeners.has(listener)) {
__L_V__2({
    lN: 8986,tT:'if',pr:'this._listeners.has(listener)',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    listener._hover = false;
    this._listeners.add(listener);

    this._callListener(listener);
  },

  removeListener(listener) {
__L_V__2({
    lN: 8996,tT:'func',pr:'',eT:{'listener':listener},fN:'removeListener'
  });'__L_V__2';
    this._listeners.delete(listener);
  },

  handleEvent(event) {
__L_V__2({
    lN: 9000,tT:'func',pr:'',eT:{'event':event},fN:'handleEvent'
  });'__L_V__2';
    let fullZoom = window.windowUtils.fullZoom;
    this._x = event.screenX / fullZoom - window.mozInnerScreenX;
    this._y = event.screenY / fullZoom - window.mozInnerScreenY;

    this._listeners.forEach(listener => {
      try {
        this._callListener(listener);
      } catch (e) {
        Cu.reportError(e);
      }
    });
  },

  _callListener(listener) {
__L_V__2({
    lN: 9014,tT:'func',pr:'',eT:{'listener':listener},fN:'_callListener'
  });'__L_V__2';
    let rect = listener.getMouseTargetRect();
    let hover =
      this._x >= rect.left &&
      this._x <= rect.right &&
      this._y >= rect.top &&
      this._y <= rect.bottom;

    if (hover == listener._hover) {
__L_V__2({
    lN: 9022,tT:'if',pr:'hover == listener._hover',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    listener._hover = hover;

    if (hover) {
__L_V__2({
    lN: 9028,tT:'if',pr:'hover',eT:{},fN:''
  });'__L_V__2';
      if (listener.onMouseEnter) {
__L_V__2({
    lN: 9029,tT:'if',pr:'listener.onMouseEnter',eT:{},fN:''
  });'__L_V__2';
        listener.onMouseEnter();
      }
    } else if (listener.onMouseLeave) {
__L_V__2({
    lN: 9032,tT:'if',pr:'listener.onMouseLeave',eT:{},fN:''
  });'__L_V__2';
      listener.onMouseLeave();
    }
  },
};

var ToolbarIconColor = {
  _windowState: {
    active: false,
    fullscreen: false,
    tabsintitlebar: false,
  },
  init() {
__L_V__2({
    lN: 9044,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    this._initialized = true;

    window.addEventListener("activate", this);
    window.addEventListener("deactivate", this);
    window.addEventListener("toolbarvisibilitychange", this);
    window.addEventListener("windowlwthemeupdate", this);

    // If the window isn't active now, we assume that it has never been active
    // before and will soon become active such that inferFromText will be
    // called from the initial activate event.
    if (Services.focus.activeWindow == window) {
__L_V__2({
    lN: 9055,tT:'if',pr:'Services.focus.activeWindow == window',eT:{},fN:''
  });'__L_V__2';
      this.inferFromText("activate");
    }
  },

  uninit() {
__L_V__2({
    lN: 9060,tT:'func',pr:'',eT:{},fN:'uninit'
  });'__L_V__2';
    this._initialized = false;

    window.removeEventListener("activate", this);
    window.removeEventListener("deactivate", this);
    window.removeEventListener("toolbarvisibilitychange", this);
    window.removeEventListener("windowlwthemeupdate", this);
  },

  handleEvent(event) {
__L_V__2({
    lN: 9069,tT:'func',pr:'',eT:{'event':event},fN:'handleEvent'
  });'__L_V__2';
__L_V__2({
    lN: 9070,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';
    switch (event.type) {
      case "activate":
      case "deactivate":
      case "windowlwthemeupdate":
        this.inferFromText(event.type);
        break;
      case "toolbarvisibilitychange":
        this.inferFromText(event.type, event.visible);
        break;
    }
  },

  // a cache of luminance values for each toolbar
  // to avoid unnecessary calls to getComputedStyle
  _toolbarLuminanceCache: new Map(),

  inferFromText(reason, reasonValue) {
__L_V__2({
    lN: 9086,tT:'func',pr:'',eT:{'reason':reason,'reasonValue':reasonValue},fN:'inferFromText'
  });'__L_V__2';
    if (!this._initialized) {
__L_V__2({
    lN: 9087,tT:'if',pr:'!this._initialized',eT:{},fN:''
  });'__L_V__2';
      return;
    }
    function parseRGB(aColorString) {
__L_V__2({
    lN: 9090,tT:'func',pr:'',eT:{'aColorString':aColorString},fN:'parseRGB'
  });'__L_V__2';
      let rgb = aColorString.match(/^rgba?\((\d+), (\d+), (\d+)/);
      rgb.shift();
      return rgb.map(x => parseInt(x));
    }
__L_V__2({
    lN: 9095,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__2';

    switch (reason) {
      case "activate": // falls through
      case "deactivate":
        this._windowState.active = reason === "activate";
        break;
      case "fullscreen":
        this._windowState.fullscreen = reasonValue;
        break;
      case "windowlwthemeupdate":
        // theme change, we'll need to recalculate all color values
        this._toolbarLuminanceCache.clear();
        break;
      case "toolbarvisibilitychange":
        // toolbar changes dont require reset of the cached color values
        break;
      case "tabsintitlebar":
        this._windowState.tabsintitlebar = reasonValue;
        break;
    }

    let toolbarSelector = ".browser-toolbar:not([collapsed=true])";
    if (AppConstants.platform == "macosx") {
__L_V__2({
    lN: 9117,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__2';
      toolbarSelector += ":not([type=menubar])";
    }

    // The getComputedStyle calls and setting the brighttext are separated in
    // two loops to avoid flushing layout and making it dirty repeatedly.
    let cachedLuminances = this._toolbarLuminanceCache;
    let luminances = new Map();
    for (let toolbar of document.querySelectorAll(toolbarSelector)) {
      // toolbars *should* all have ids, but guard anyway to avoid blowing up
      let cacheKey =
        toolbar.id && toolbar.id + JSON.stringify(this._windowState);
      // lookup cached luminance value for this toolbar in this window state
      let luminance = cacheKey && cachedLuminances.get(cacheKey);
      if (isNaN(luminance)) {
__L_V__2({
    lN: 9131,tT:'if',pr:'isNaN(luminance)',eT:{},fN:''
  });'__L_V__2';
        let [r, g, b] = parseRGB(getComputedStyle(toolbar).color);
        luminance = 0.2125 * r + 0.7154 * g + 0.0721 * b;
        if (cacheKey) {
__L_V__2({
    lN: 9134,tT:'if',pr:'cacheKey',eT:{},fN:''
  });'__L_V__2';
          cachedLuminances.set(cacheKey, luminance);
        }
      }
      luminances.set(toolbar, luminance);
    }

    for (let [toolbar, luminance] of luminances) {
      if (luminance <= 110) {
__L_V__2({
    lN: 9142,tT:'if',pr:'luminance <= 110',eT:{},fN:''
  });'__L_V__2';
        toolbar.removeAttribute("brighttext");
      } else {
        toolbar.setAttribute("brighttext", "true");
      }
    }
  },
};

var PanicButtonNotifier = {
  init() {
__L_V__2({
    lN: 9152,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
    this._initialized = true;
    if (window.PanicButtonNotifierShouldNotify) {
__L_V__2({
    lN: 9154,tT:'if',pr:'window.PanicButtonNotifierShouldNotify',eT:{},fN:''
  });'__L_V__2';
      delete window.PanicButtonNotifierShouldNotify;
      this.notify();
    }
  },
  notify() {
__L_V__2({
    lN: 9159,tT:'func',pr:'',eT:{},fN:'notify'
  });'__L_V__2';
    if (!this._initialized) {
__L_V__2({
    lN: 9160,tT:'if',pr:'!this._initialized',eT:{},fN:''
  });'__L_V__2';
      window.PanicButtonNotifierShouldNotify = true;
      return;
    }
    // Display notification panel here...
    try {
      let popup = document.getElementById("panic-button-success-notification");
      popup.hidden = false;
      // To close the popup in 3 seconds after the popup is shown but left uninteracted.
      let onTimeout = () => {
        PanicButtonNotifier.close();
        removeListeners();
      };
      popup.addEventListener("popupshown", function() {
__L_V__2({
    lN: 9173,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__2';
        PanicButtonNotifier.timer = setTimeout(onTimeout, 3000);
      });
      // To prevent the popup from closing when user tries to interact with the
      // popup using mouse or keyboard.
      let onUserInteractsWithPopup = () => {
        clearTimeout(PanicButtonNotifier.timer);
        removeListeners();
      };
      popup.addEventListener("mouseover", onUserInteractsWithPopup);
      window.addEventListener("keydown", onUserInteractsWithPopup);
      let removeListeners = () => {
        popup.removeEventListener("mouseover", onUserInteractsWithPopup);
        window.removeEventListener("keydown", onUserInteractsWithPopup);
        popup.removeEventListener("popuphidden", removeListeners);
      };
      popup.addEventListener("popuphidden", removeListeners);

      let widget = CustomizableUI.getWidget("panic-button").forWindow(window);
      let anchor = widget.anchor.icon;
      popup.openPopup(anchor, popup.getAttribute("position"));
    } catch (ex) {
      Cu.reportError(ex);
    }
  },
  close() {
__L_V__2({
    lN: 9198,tT:'func',pr:'',eT:{},fN:'close'
  });'__L_V__2';
    let popup = document.getElementById("panic-button-success-notification");
    popup.hidePopup();
  },
};

const SafeBrowsingNotificationBox = {
  _currentURIBaseDomain: null,
  show(title, buttons) {
__L_V__2({
    lN: 9206,tT:'func',pr:'',eT:{'title':title,'buttons':buttons},fN:'show'
  });'__L_V__2';
    let uri = gBrowser.currentURI;

    // start tracking host so that we know when we leave the domain
    this._currentURIBaseDomain = Services.eTLD.getBaseDomain(uri);

    let notificationBox = gBrowser.getNotificationBox();
    let value = "blocked-badware-page";

    let previousNotification = notificationBox.getNotificationWithValue(value);
    if (previousNotification) {
__L_V__2({
    lN: 9216,tT:'if',pr:'previousNotification',eT:{},fN:''
  });'__L_V__2';
      notificationBox.removeNotification(previousNotification);
    }

    let notification = notificationBox.appendNotification(
      title,
      value,
      "chrome://global/skin/icons/blocklist_favicon.png",
      notificationBox.PRIORITY_CRITICAL_HIGH,
      buttons
    );
    // Persist the notification until the user removes so it
    // doesn't get removed on redirects.
    notification.persistence = -1;
  },
  onLocationChange(aLocationURI) {
__L_V__2({
    lN: 9231,tT:'func',pr:'',eT:{'aLocationURI':aLocationURI},fN:'onLocationChange'
  });'__L_V__2';
    // take this to represent that you haven't visited a bad place
    if (!this._currentURIBaseDomain) {
__L_V__2({
    lN: 9233,tT:'if',pr:'!this._currentURIBaseDomain',eT:{},fN:''
  });'__L_V__2';
      return;
    }

    let newURIBaseDomain = Services.eTLD.getBaseDomain(aLocationURI);

    if (newURIBaseDomain !== this._currentURIBaseDomain) {
__L_V__2({
    lN: 9239,tT:'if',pr:'newURIBaseDomain !== this._currentURIBaseDomain',eT:{},fN:''
  });'__L_V__2';
      let notificationBox = gBrowser.getNotificationBox();
      let notification = notificationBox.getNotificationWithValue(
        "blocked-badware-page"
      );
      if (notification) {
__L_V__2({
    lN: 9244,tT:'if',pr:'notification',eT:{},fN:''
  });'__L_V__2';
        notificationBox.removeNotification(notification, false);
      }

      this._currentURIBaseDomain = null;
    }
  },
};

function TabModalPromptBox(browser) {
__L_V__2({
    lN: 9253,tT:'func',pr:'',eT:{'browser':browser},fN:'TabModalPromptBox'
  });'__L_V__2';
  this._weakBrowserRef = Cu.getWeakReference(browser);
  /*
   * This WeakMap holds the TabModalPrompt instances, key to the <tabmodalprompt> prompt
   * in the DOM. We don't want to hold the instances directly to avoid leaking.
   *
   * WeakMap also prevents us from reading back its insertion order.
   * Order of the elements in the DOM should be the only order to consider.
   */
  this.prompts = new WeakMap();
}

TabModalPromptBox.prototype = {
  _promptCloseCallback(
    onCloseCallback,
    principalToAllowFocusFor,
    allowFocusCheckbox,
    ...args
  ) {
__L_V__2({
    lN: 9271,tT:'func',pr:'',eT:{'onCloseCallback':onCloseCallback,'principalToAllowFocusFor':principalToAllowFocusFor,'allowFocusCheckbox':allowFocusCheckbox,'args':args},fN:'_promptCloseCallback'
  });'__L_V__2';
    if (
      principalToAllowFocusFor &&
      allowFocusCheckbox &&
      allowFocusCheckbox.checked
    ) {
__L_V__2({
    lN: 9276,tT:'if',pr:' principalToAllowFocusFor && allowFocusCheckbox && allowFocusCheckbox.checked ',eT:{},fN:''
  });'__L_V__2';
      Services.perms.addFromPrincipal(
        principalToAllowFocusFor,
        "focus-tab-by-prompt",
        Services.perms.ALLOW_ACTION
      );
    }
    onCloseCallback.apply(this, args);
  },

  appendPrompt(args, onCloseCallback) {
__L_V__2({
    lN: 9286,tT:'func',pr:'',eT:{'args':args,'onCloseCallback':onCloseCallback},fN:'appendPrompt'
  });'__L_V__2';
    let browser = this.browser;
    let newPrompt = new TabModalPrompt(browser.ownerGlobal);
    this.prompts.set(newPrompt.element, newPrompt);

    browser.parentNode.insertBefore(
      newPrompt.element,
      browser.nextElementSibling
    );
    browser.setAttribute("tabmodalPromptShowing", true);

    let prompts = this.listPrompts();
    if (prompts.length > 1) {
__L_V__2({
    lN: 9298,tT:'if',pr:'prompts.length > 1',eT:{},fN:''
  });'__L_V__2';
      // Let's hide ourself behind the current prompt.
      newPrompt.element.hidden = true;
    }

    let principalToAllowFocusFor = this._allowTabFocusByPromptPrincipal;
    delete this._allowTabFocusByPromptPrincipal;

    let allowFocusCheckbox; // Define outside the if block so we can bind it into the callback.
    let hostForAllowFocusCheckbox = "";
    try {
      hostForAllowFocusCheckbox = principalToAllowFocusFor.URI.host;
    } catch (ex) {
      /* Ignore exceptions for host-less URIs */
    }
    if (hostForAllowFocusCheckbox) {
__L_V__2({
    lN: 9313,tT:'if',pr:'hostForAllowFocusCheckbox',eT:{},fN:''
  });'__L_V__2';
      let allowFocusRow = document.createXULElement("row");
      allowFocusCheckbox = document.createXULElement("checkbox");
      let spacer = document.createXULElement("spacer");
      allowFocusRow.appendChild(spacer);
      let label = gTabBrowserBundle.formatStringFromName(
        "tabs.allowTabFocusByPromptForSite",
        [hostForAllowFocusCheckbox]
      );
      allowFocusCheckbox.setAttribute("label", label);
      allowFocusRow.appendChild(allowFocusCheckbox);
      newPrompt.ui.rows.append(allowFocusRow);
    }

    let tab = gBrowser.getTabForBrowser(browser);
    let closeCB = this._promptCloseCallback.bind(
      null,
      onCloseCallback,
      principalToAllowFocusFor,
      allowFocusCheckbox
    );
    newPrompt.init(args, tab, closeCB);
    return newPrompt;
  },

  removePrompt(aPrompt) {
__L_V__2({
    lN: 9338,tT:'func',pr:'',eT:{'aPrompt':aPrompt},fN:'removePrompt'
  });'__L_V__2';
    this.prompts.delete(aPrompt.element);
    let browser = this.browser;
    aPrompt.element.remove();

    let prompts = this.listPrompts();
    if (prompts.length) {
__L_V__2({
    lN: 9344,tT:'if',pr:'prompts.length',eT:{},fN:''
  });'__L_V__2';
      let prompt = prompts[prompts.length - 1];
      prompt.element.hidden = false;
      // Because we were hidden before, this won't have been possible, so do it now:
      prompt.Dialog.setDefaultFocus();
    } else {
      browser.removeAttribute("tabmodalPromptShowing");
      browser.focus();
    }
  },

  listPrompts(aPrompt) {
__L_V__2({
    lN: 9355,tT:'func',pr:'',eT:{'aPrompt':aPrompt},fN:'listPrompts'
  });'__L_V__2';
    // Get the nodelist, then return the TabModalPrompt instances as an array
    const XUL_NS =
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let els = this.browser.parentNode.getElementsByTagNameNS(
      XUL_NS,
      "tabmodalprompt"
    );
    return Array.from(els).map(el => this.prompts.get(el));
  },

  onNextPromptShowAllowFocusCheckboxFor(principal) {
__L_V__2({
    lN: 9366,tT:'func',pr:'',eT:{'principal':principal},fN:'onNextPromptShowAllowFocusCheckboxFor'
  });'__L_V__2';
    this._allowTabFocusByPromptPrincipal = principal;
  },

  get browser() {
__L_V__2({
    lN: 9370,tT:'func',pr:'',eT:{},fN:'browser'
  });'__L_V__2';
    let browser = this._weakBrowserRef.get();
    if (!browser) {
__L_V__2({
    lN: 9372,tT:'if',pr:'!browser',eT:{},fN:''
  });'__L_V__2';
      throw new Error("Stale promptbox! The associated browser is gone.");
    }
    return browser;
  },
};

var ConfirmationHint = {
  /**
   * Shows a transient, non-interactive confirmation hint anchored to an
   * element, usually used in response to a user action to reaffirm that it was
   * successful and potentially provide extra context. Examples for such hints:
   * - "Saved to Library!" after bookmarking a page
   * - "Sent!" after sending a tab to another device
   * - "Queued (offline)" when attempting to send a tab to another device
   *   while offline
   *
   * @param  anchor (DOM node, required)
   *         The anchor for the panel.
   * @param  messageId (string, required)
   *         For getting the message string from browser.properties:
   *         confirmationHint.<messageId>.label
   * @param  options (object, optional)
   *         An object with the following optional properties:
   *         - event (DOM event): The event that triggered the feedback.
   *         - hideArrow (boolean): Optionally hide the arrow.
   *         - showDescription (boolean): show description text (confirmationHint.<messageId>.description)
   *
   */
  show(anchor, messageId, options = {}) {
__L_V__2({
    lN: 9401,tT:'func',pr:'',eT:{'anchor':anchor,'messageId':messageId,'options':options},fN:'show'
  });'__L_V__2';
    this._message.textContent = gBrowserBundle.GetStringFromName(
      `confirmationHint.${messageId}.label`
    );

    if (options.showDescription) {
__L_V__2({
    lN: 9406,tT:'if',pr:'options.showDescription',eT:{},fN:''
  });'__L_V__2';
      this._description.textContent = gBrowserBundle.GetStringFromName(
        `confirmationHint.${messageId}.description`
      );
      this._description.hidden = false;
      this._panel.classList.add("with-description");
    } else {
      this._description.hidden = true;
      this._panel.classList.remove("with-description");
    }

    if (options.hideArrow) {
__L_V__2({
    lN: 9417,tT:'if',pr:'options.hideArrow',eT:{},fN:''
  });'__L_V__2';
      this._panel.setAttribute("hidearrow", "true");
    }

    // The timeout value used here allows the panel to stay open for
    // 1.5s second after the text transition (duration=120ms) has finished.
    // If there is a description, we show for 4s after the text transition.
    const DURATION = options.showDescription ? 4000 : 1500;
    this._panel.addEventListener(
      "popupshown",
      () => {
        this._animationBox.setAttribute("animate", "true");

        setTimeout(() => {
          this._panel.hidePopup(true);
        }, DURATION + 120);
      },
      { once: true }
    );

    this._panel.addEventListener(
      "popuphidden",
      () => {
        this._panel.removeAttribute("hidearrow");
        this._animationBox.removeAttribute("animate");
      },
      { once: true }
    );

    this._panel.hidden = false;
    this._panel.openPopup(anchor, {
      position: "bottomcenter topleft",
      triggerEvent: options.event,
    });
  },

  get _panel() {
__L_V__2({
    lN: 9453,tT:'func',pr:'',eT:{},fN:'_panel'
  });'__L_V__2';
    delete this._panel;
    return (this._panel = document.getElementById("confirmation-hint"));
  },

  get _animationBox() {
__L_V__2({
    lN: 9458,tT:'func',pr:'',eT:{},fN:'_animationBox'
  });'__L_V__2';
    delete this._animationBox;
    return (this._animationBox = document.getElementById(
      "confirmation-hint-checkmark-animation-container"
    ));
  },

  get _message() {
__L_V__2({
    lN: 9465,tT:'func',pr:'',eT:{},fN:'_message'
  });'__L_V__2';
    delete this._message;
    return (this._message = document.getElementById(
      "confirmation-hint-message"
    ));
  },

  get _description() {
__L_V__2({
    lN: 9472,tT:'func',pr:'',eT:{},fN:'_description'
  });'__L_V__2';
    delete this._description;
    return (this._description = document.getElementById(
      "confirmation-hint-description"
    ));
  },
};

function reportRemoteSubframesEnabledTelemetry() {
__L_V__2({
    lN: 9480,tT:'func',pr:'',eT:{},fN:'reportRemoteSubframesEnabledTelemetry'
  });'__L_V__2';
  let autostart = Services.prefs.getBoolPref("fission.autostart");

  let categoryLabel = gFissionBrowser ? "Enabled" : "Disabled";
  if (autostart == gFissionBrowser) {
__L_V__2({
    lN: 9484,tT:'if',pr:'autostart == gFissionBrowser',eT:{},fN:''
  });'__L_V__2';
    categoryLabel += "ByAutostart";
  } else {
    categoryLabel += "ByUser";
  }

  Services.telemetry
    .getHistogramById("WINDOW_REMOTE_SUBFRAMES_ENABLED_STATUS")
    .add(categoryLabel);
}

if (AppConstants.NIGHTLY_BUILD) {
__L_V__2({
    lN: 9495,tT:'if',pr:'AppConstants.NIGHTLY_BUILD',eT:{},fN:''
  });'__L_V__2';
  var FissionTestingUI = {
    init() {
__L_V__2({
    lN: 9497,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__2';
      // Handle the Fission/Non-Fission testing UI.
      let autostart = Services.prefs.getBoolPref("fission.autostart");
      if (!autostart) {
__L_V__2({
    lN: 9500,tT:'if',pr:'!autostart',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      let newFissionWindow = document.getElementById("Tools:FissionWindow");
      let newNonFissionWindow = document.getElementById(
        "Tools:NonFissionWindow"
      );

      newFissionWindow.hidden = gFissionBrowser;
      newNonFissionWindow.hidden = !gFissionBrowser;

      if (!Cu.isInAutomation) {
__L_V__2({
    lN: 9512,tT:'if',pr:'!Cu.isInAutomation',eT:{},fN:''
  });'__L_V__2';
        // We don't want to display the warning in automation as it messes with many tests
        // that rely on a specific state of the screen at the end of startup.
        this.checkFissionWithoutWebRender();
      }
    },

    // Display a warning if we're attempting to use Fission without WebRender
    checkFissionWithoutWebRender() {
__L_V__2({
    lN: 9520,tT:'func',pr:'',eT:{},fN:'checkFissionWithoutWebRender'
  });'__L_V__2';
      let isFissionEnabled = Services.prefs.getBoolPref("fission.autostart");
      if (!isFissionEnabled) {
__L_V__2({
    lN: 9522,tT:'if',pr:'!isFissionEnabled',eT:{},fN:''
  });'__L_V__2';
        return;
      }

      let isWebRenderEnabled = Services.prefs.getBoolPref("gfx.webrender.all");

      if (isWebRenderEnabled) {
__L_V__2({
    lN: 9528,tT:'if',pr:'isWebRenderEnabled',eT:{},fN:''
  });'__L_V__2';
        return;
      }
      // Note: Test is hardcoded in English. This is a Nightly-locked warning, so we can afford to.
      window.gNotificationBox.appendNotification(
        "You are running with Fission enabled but without WebRender. This combination is untested, so use at your own risk.",
        "warning-fission-without-webrender-notification",
        "chrome://global/skin/icons/question-16.png",
        window.gNotificationBox.PRIORITY_WARNING_LOW
      );
    },
  };
}
