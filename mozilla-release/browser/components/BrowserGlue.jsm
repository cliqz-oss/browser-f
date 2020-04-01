
/*LS-265703*/var { CliqzLogger } = ChromeUtils.import('resource://gre/modules/CliqzLogger.jsm');
var __L_V__0 = CliqzLogger.init('mozilla-release/browser/components/BrowserGlue.jsm','BrowserGlue');/*LE-265703*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = [
  "BrowserGlue",
  "ContentPermissionPrompt",
  "DefaultBrowserCheck",
];

const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);
const { PermissionsUtils } = ChromeUtils.import(
  "resource://gre/modules/PermissionsUtils.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "ActorManagerParent",
  "resource://gre/modules/ActorManagerParent.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "CustomizableUI",
  "resource:///modules/CustomizableUI.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "FileUtils",
  "resource://gre/modules/FileUtils.jsm"
);

XPCOMUtils.defineLazyServiceGetter(
  this,
  "PushService",
  "@mozilla.org/push/Service;1",
  "nsIPushService"
);

const PREF_PDFJS_ENABLED_CACHE_STATE = "pdfjs.enabledCache.state";

// CLIQZ-SPECIAL: DB-2313, we need to set and lock it
// lockPref("security.enterprise_roots.enabled", true);
// for Kaspersky to work properly;
const cliqz_shouldMakeEnterpriseRootsEnabled = async function() {
__L_V__0({
    lN: 57,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
  const KAV_PATTERN = /^kl_prefs_.*\.js$/;
  const PREF_NAME = "security.enterprise_roots.enabled";

  // /Application/<CLIQZ_VERSION>/Contents/Resources;
  const dir = FileUtils.getDir('GreD', [], false);
  // Passing a relative path as 'defaults/pref' at once will throw an exception
  // UNRECOGNIZED_PATH on Windows platform.
  dir.appendRelativePath('defaults');
  dir.appendRelativePath('pref');
  dir.normalize();

  const dirIter = new OS.File.DirectoryIterator(dir.path);
  let nextItem = await dirIter.next();

  while (nextItem.done != true) {
    // We look for KAV file name here kl_prefs_<GUID>.js
    if (nextItem.value.isDir || !KAV_PATTERN.test(nextItem.value.name)) {
__L_V__0({
    lN: 74,tT:'if',pr:'nextItem.value.isDir || !KAV_PATTERN.test(nextItem.value.name)',eT:{},fN:''
  });'__L_V__0';
      nextItem = await dirIter.next();
      continue;
    }

    if (Services.prefs.prefIsLocked(PREF_NAME)) {
__L_V__0({
    lN: 79,tT:'if',pr:'Services.prefs.prefIsLocked(PREF_NAME)',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.unlockPref(PREF_NAME);
    }
    const defaultBranch = Services.prefs.getDefaultBranch("");
    defaultBranch.setBoolPref(PREF_NAME, true);
    Services.prefs.lockPref(PREF_NAME);

    return;
  }
};

// CLIQZ-SPECIAL: DB-2373
// Make Cliqz Search engine default for special browser build;
// extensions.cliqz.full_distribution has to be set and contain
// default_search=cliqz among other GET-like params;
const cliqz_shouldMakeCliqzEngineDefault = function() {
__L_V__0({
    lN: 94,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
  let fullDistribution = Services.prefs.getStringPref("extensions.cliqz.full_distribution", "");
  if (!fullDistribution) {
__L_V__0({
    lN: 96,tT:'if',pr:'!fullDistribution',eT:{},fN:''
  });'__L_V__0';
    return;
  }

  let shouldUseCliqzSearchAsDefault = false;
  fullDistribution = fullDistribution.split("&");

  for (let i = 0, l = fullDistribution.length; i < l; i++) {
    if (fullDistribution[i].toLowerCase() === "default_search=cliqz") {
__L_V__0({
    lN: 104,tT:'if',pr:'fullDistribution[i].toLowerCase() === default_search=cliqz',eT:{},fN:''
  });'__L_V__0';
      shouldUseCliqzSearchAsDefault = true;
      break;
    }
  }

  if (!shouldUseCliqzSearchAsDefault) {
__L_V__0({
    lN: 110,tT:'if',pr:'!shouldUseCliqzSearchAsDefault',eT:{},fN:''
  });'__L_V__0';
    return;
  }

  if (Services.prefs.getIntPref("extensions.cliqz.installer_default_search", 0) != 1) {
__L_V__0({
    lN: 114,tT:'if',pr:'Services.prefs.getIntPref(extensions.cliqz.installer_default_search, 0) != 1',eT:{},fN:''
  });'__L_V__0';
    Services.prefs.setIntPref("extensions.cliqz.installer_default_search", 1);

    Services.search.init().then(function() {
      let cliqzSearchEngine = Services.search.getEngineByName("Cliqz");
      if (cliqzSearchEngine != null) {
__L_V__0({
    lN: 119,tT:'if',pr:'cliqzSearchEngine != null',eT:{},fN:''
  });'__L_V__0';
        Services.search.setDefault(cliqzSearchEngine);
      }
    });
  }
};

/**
 * Fission-compatible JSWindowActor implementations.
 * Detailed documentation of these is in dom/docs/Fission.rst,
 * available at https://firefox-source-docs.mozilla.org/dom/Fission.html#jswindowactor
 */
let ACTORS = {
  AboutLogins: {
    parent: {
      moduleURI: "resource:///actors/AboutLoginsParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/AboutLoginsChild.jsm",
      events: {
        AboutLoginsCopyLoginDetail: { wantUntrusted: true },
        AboutLoginsCreateLogin: { wantUntrusted: true },
        AboutLoginsDeleteLogin: { wantUntrusted: true },
        AboutLoginsDismissBreachAlert: { wantUntrusted: true },
        AboutLoginsHideFooter: { wantUntrusted: true },
        AboutLoginsImport: { wantUntrusted: true },
        AboutLoginsInit: { wantUntrusted: true },
        AboutLoginsGetHelp: { wantUntrusted: true },
        AboutLoginsOpenMobileAndroid: { wantUntrusted: true },
        AboutLoginsOpenMobileIos: { wantUntrusted: true },
        AboutLoginsOpenPreferences: { wantUntrusted: true },
        AboutLoginsOpenSite: { wantUntrusted: true },
        AboutLoginsRecordTelemetryEvent: { wantUntrusted: true },
        AboutLoginsSortChanged: { wantUntrusted: true },
        AboutLoginsSyncEnable: { wantUntrusted: true },
        AboutLoginsSyncOptions: { wantUntrusted: true },
        AboutLoginsUpdateLogin: { wantUntrusted: true },
      },
    },
    matches: ["about:logins", "about:logins?*"],
  },

  BlockedSite: {
    parent: {
      moduleURI: "resource:///actors/BlockedSiteParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/BlockedSiteChild.jsm",
      events: {
        AboutBlockedLoaded: { wantUntrusted: true },
        click: {},
      },
    },
    matches: ["about:blocked?*"],
    allFrames: true,
  },

  BrowserTab: {
    parent: {
      moduleURI: "resource:///actors/BrowserTabParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/BrowserTabChild.jsm",

      events: {
        DOMWindowCreated: {},
        MozAfterPaint: {},
        "MozDOMPointerLock:Entered": {},
        "MozDOMPointerLock:Exited": {},
      },
    },
  },

  ClickHandler: {
    parent: {
      moduleURI: "resource:///actors/ClickHandlerParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/ClickHandlerChild.jsm",
      events: {
        click: { capture: true, mozSystemGroup: true },
        auxclick: { capture: true, mozSystemGroup: true },
      },
    },

    allFrames: true,
  },

  // Collects description and icon information from meta tags.
  ContentMeta: {
    parent: {
      moduleURI: "resource:///actors/ContentMetaParent.jsm",
    },

    child: {
      moduleURI: "resource:///actors/ContentMetaChild.jsm",
      events: {
        DOMMetaAdded: {},
      },
    },
  },

  ContextMenu: {
    parent: {
      moduleURI: "resource:///actors/ContextMenuParent.jsm",
    },

    child: {
      moduleURI: "resource:///actors/ContextMenuChild.jsm",
      events: {
        contextmenu: { mozSystemGroup: true },
      },
    },

    allFrames: true,
  },

  DOMFullscreen: {
    parent: {
      moduleURI: "resource:///actors/DOMFullscreenParent.jsm",
    },

    child: {
      moduleURI: "resource:///actors/DOMFullscreenChild.jsm",
      group: "browsers",
      events: {
        "MozDOMFullscreen:Request": {},
        "MozDOMFullscreen:Entered": {},
        "MozDOMFullscreen:NewOrigin": {},
        "MozDOMFullscreen:Exit": {},
        "MozDOMFullscreen:Exited": {},
      },
    },

    allFrames: true,
  },

  FormValidation: {
    parent: {
      moduleURI: "resource:///actors/FormValidationParent.jsm",
    },

    child: {
      moduleURI: "resource:///actors/FormValidationChild.jsm",
      events: {
        MozInvalidForm: {},
      },
    },

    allFrames: true,
  },

  LightweightTheme: {
    child: {
      moduleURI: "resource:///actors/LightweightThemeChild.jsm",
      events: {
        pageshow: { mozSystemGroup: true },
      },
    },
    includeChrome: true,
    allFrames: true,
    matches: [
      "about:home",
      "about:newtab",
      "about:welcome",
      "chrome://browser/content/syncedtabs/sidebar.xhtml",
      "chrome://browser/content/places/historySidebar.xhtml",
      "chrome://browser/content/places/bookmarksSidebar.xhtml",
    ],
  },

  LinkHandler: {
    parent: {
      moduleURI: "resource:///actors/LinkHandlerParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/LinkHandlerChild.jsm",
      events: {
        DOMHeadElementParsed: {},
        DOMLinkAdded: {},
        DOMLinkChanged: {},
        pageshow: {},
        pagehide: {},
      },
    },
  },

  NetError: {
    parent: {
      moduleURI: "resource:///actors/NetErrorParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/NetErrorChild.jsm",
      events: {
        DOMWindowCreated: {},
        click: {},
      },
    },

    matches: ["about:certerror?*", "about:neterror?*"],
    allFrames: true,
  },

  PageInfo: {
    child: {
      moduleURI: "resource:///actors/PageInfoChild.jsm",
    },

    allFrames: true,
  },

  PageStyle: {
    parent: {
      moduleURI: "resource:///actors/PageStyleParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/PageStyleChild.jsm",
      events: {
        pageshow: {},
      },
    },

    // Only matching web pages, as opposed to internal about:, chrome: or
    // resource: pages. See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns
    matches: ["*://*/*"],
    allFrames: true,
  },

  Plugin: {
    parent: {
      moduleURI: "resource:///actors/PluginParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/PluginChild.jsm",
      events: {
        PluginBindingAttached: { capture: true, wantUntrusted: true },
        PluginCrashed: { capture: true },
        PluginOutdated: { capture: true },
        PluginInstantiated: { capture: true },
        PluginRemoved: { capture: true },
        HiddenPlugin: { capture: true },
      },

      observers: ["decoder-doctor-notification"],
    },

    allFrames: true,
  },

  Prompt: {
    parent: {
      moduleURI: "resource:///actors/PromptParent.jsm",
    },

    allFrames: true,
  },

  SearchTelemetry: {
    parent: {
      moduleURI: "resource:///actors/SearchTelemetryParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/SearchTelemetryChild.jsm",
      events: {
        DOMContentLoaded: {},
        pageshow: { mozSystemGroup: true },
        unload: {},
      },
    },
  },

  ShieldFrame: {
    parent: {
      moduleURI: "resource://normandy-content/ShieldFrameParent.jsm",
    },
    child: {
      moduleURI: "resource://normandy-content/ShieldFrameChild.jsm",
      events: {
        pageshow: {},
        pagehide: {},
        ShieldPageEvent: { wantUntrusted: true },
      },
    },
    matches: ["about:studies"],
  },

  SwitchDocumentDirection: {
    child: {
      moduleURI: "resource:///actors/SwitchDocumentDirectionChild.jsm",
    },

    allFrames: true,
  },

  SiteSpecificBrowser: {
    parent: {
      moduleURI: "resource:///actors/SiteSpecificBrowserParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/SiteSpecificBrowserChild.jsm",
    },

    allFrames: true,
  },

  UITour: {
    parent: {
      moduleURI: "resource:///modules/UITourParent.jsm",
    },
    child: {
      moduleURI: "resource:///modules/UITourChild.jsm",
      events: {
        mozUITour: { wantUntrusted: true },
      },
    },
  },

  WebRTC: {
    parent: {
      moduleURI: "resource:///actors/WebRTCParent.jsm",
    },
    child: {
      moduleURI: "resource:///actors/WebRTCChild.jsm",
    },

    allFrames: true,
  },
};

let LEGACY_ACTORS = {
  AboutReader: {
    child: {
      module: "resource:///actors/AboutReaderChild.jsm",
      group: "browsers",
      events: {
        AboutReaderContentLoaded: { wantUntrusted: true },
        DOMContentLoaded: {},
        pageshow: { mozSystemGroup: true },
        pagehide: { mozSystemGroup: true },
      },
      messages: ["Reader:ToggleReaderMode", "Reader:PushState"],
    },
  },

  ContentSearch: {
    child: {
      module: "resource:///actors/ContentSearchChild.jsm",
      group: "browsers",
      matches: [
        "about:home",
        "about:newtab",
        "about:welcome",
        "about:privatebrowsing",
        "chrome://mochitests/content/*",
      ],
      events: {
        ContentSearchClient: { capture: true, wantUntrusted: true },
      },
      messages: ["ContentSearch"],
    },
  },

  URIFixup: {
    child: {
      module: "resource:///actors/URIFixupChild.jsm",
      group: "browsers",
      observers: ["keyword-uri-fixup"],
    },
  },
};

// See Bug 1618306
// This should be moved to BrowserGlue.jsm and this file should be deleted
// when we turn on separate about:welcome for all users.
const ACTOR_CONFIG = {
  parent: {
    moduleURI: "resource:///actors/AboutWelcomeParent.jsm",
  },
  child: {
    moduleURI: "resource:///actors/AboutWelcomeChild.jsm",
    events: {
      // This is added so the actor instantiates immediately and makes
      // methods available to the page js on load.
      DOMWindowCreated: {},
    },
  },
  matches: ["about:welcome"],
};

const AboutWelcomeActorHelper = {
  register() {
__L_V__0({
    lN: 509,tT:'func',pr:'',eT:{},fN:'register'
  });'__L_V__0';
    ChromeUtils.registerWindowActor("AboutWelcome", ACTOR_CONFIG);
  },
  unregister() {
__L_V__0({
    lN: 512,tT:'func',pr:'',eT:{},fN:'unregister'
  });'__L_V__0';
    ChromeUtils.unregisterWindowActor("AboutWelcome");
  },
};

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "isSeparateAboutWelcome",
  "browser.aboutwelcome.enabled",
  false,
  (prefName, prevValue, isEnabled) => {
    if (isEnabled) {
__L_V__0({
    lN: 523,tT:'if',pr:'isEnabled',eT:{},fN:''
  });'__L_V__0';
      AboutWelcomeActorHelper.register();
    } else {
      AboutWelcomeActorHelper.unregister();
    }
  }
);

if (isSeparateAboutWelcome) {
__L_V__0({
    lN: 531,tT:'if',pr:'isSeparateAboutWelcome',eT:{},fN:''
  });'__L_V__0';
  AboutWelcomeActorHelper.register();
}

(function earlyBlankFirstPaint() {
__L_V__0({
    lN: 535,tT:'func',pr:'',eT:{},fN:'earlyBlankFirstPaint'
  });'__L_V__0';
  if (
    AppConstants.platform == "macosx" ||
    !Services.prefs.getBoolPref("browser.startup.blankWindow", false)
  ) {
__L_V__0({
    lN: 539,tT:'if',pr:' AppConstants.platform == macosx || !Services.prefs.getBoolPref(browser.startup.blankWindow, false) ',eT:{},fN:''
  });'__L_V__0';
    return;
  }

  // Until bug 1450626 and bug 1488384 are fixed, skip the blank window when
  // using a non-default theme.
  if (
    Services.prefs.getCharPref(
      "extensions.activeThemeID",
      "default-theme@mozilla.org"
    ) != "default-theme@mozilla.org"
  ) {
__L_V__0({
    lN: 550,tT:'if',pr:' Services.prefs.getCharPref( extensions.activeThemeID, default-theme@mozilla.org ) != default-theme@mozilla.org ',eT:{},fN:''
  });'__L_V__0';
    return;
  }

  let store = Services.xulStore;
  let getValue = attr =>
    store.getValue(AppConstants.BROWSER_CHROME_URL, "main-window", attr);
  let width = getValue("width");
  let height = getValue("height");

  // The clean profile case isn't handled yet. Return early for now.
  if (!width || !height) {
__L_V__0({
    lN: 561,tT:'if',pr:'!width || !height',eT:{},fN:''
  });'__L_V__0';
    return;
  }

  let browserWindowFeatures =
    "chrome,all,dialog=no,extrachrome,menubar,resizable,scrollbars,status," +
    "location,toolbar,personalbar";
  let win = Services.ww.openWindow(
    null,
    "about:blank",
    null,
    browserWindowFeatures,
    null
  );

  // Hide the titlebar if the actual browser window will draw in it.
  let hiddenTitlebar = Services.prefs.getBoolPref(
    "browser.tabs.drawInTitlebar",
    win.matchMedia("(-moz-gtk-csd-hide-titlebar-by-default)").matches
  );
  if (hiddenTitlebar) {
__L_V__0({
    lN: 581,tT:'if',pr:'hiddenTitlebar',eT:{},fN:''
  });'__L_V__0';
    win.windowUtils.setChromeMargin(0, 2, 2, 2);
  }

  let docElt = win.document.documentElement;
  docElt.setAttribute("screenX", getValue("screenX"));
  docElt.setAttribute("screenY", getValue("screenY"));

  // The sizemode="maximized" attribute needs to be set before first paint.
  let sizemode = getValue("sizemode");
  if (sizemode == "maximized") {
__L_V__0({
    lN: 591,tT:'if',pr:'sizemode == maximized',eT:{},fN:''
  });'__L_V__0';
    docElt.setAttribute("sizemode", sizemode);

    // Set the size to use when the user leaves the maximized mode.
    // The persisted size is the outer size, but the height/width
    // attributes set the inner size.
    let appWin = win.docShell.treeOwner
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIAppWindow);
    height -= appWin.outerToInnerHeightDifferenceInCSSPixels;
    width -= appWin.outerToInnerWidthDifferenceInCSSPixels;
    docElt.setAttribute("height", height);
    docElt.setAttribute("width", width);
  } else {
    // Setting the size of the window in the features string instead of here
    // causes the window to grow by the size of the titlebar.
    win.resizeTo(width, height);
  }

  // Set this before showing the window so that graphics code can use it to
  // decide to skip some expensive code paths (eg. starting the GPU process).
  docElt.setAttribute("windowtype", "navigator:blank");

  // The window becomes visible after OnStopRequest, so make this happen now.
  win.stop();

  let { TelemetryTimestamps } = ChromeUtils.import(
    "resource://gre/modules/TelemetryTimestamps.jsm"
  );
  TelemetryTimestamps.add("blankWindowShown");
})();

#ifdef MOZ_SERVICES_SYNC
XPCOMUtils.defineLazyGetter(
  this,
  "WeaveService",
  () => Cc["@mozilla.org/weave/service;1"].getService().wrappedJSObject
);
#endif

// lazy module getters

XPCOMUtils.defineLazyModuleGetters(this, {
  AboutPrivateBrowsingHandler:
    "resource:///modules/aboutpages/AboutPrivateBrowsingHandler.jsm",
#if 0
  AboutProtectionsHandler:
    "resource:///modules/aboutpages/AboutProtectionsHandler.jsm",
#endif
  AddonManager: "resource://gre/modules/AddonManager.jsm",
  AppMenuNotifications: "resource://gre/modules/AppMenuNotifications.jsm",
  AsyncShutdown: "resource://gre/modules/AsyncShutdown.jsm",
  Blocklist: "resource://gre/modules/Blocklist.jsm",
  BookmarkHTMLUtils: "resource://gre/modules/BookmarkHTMLUtils.jsm",
  BookmarkJSONUtils: "resource://gre/modules/BookmarkJSONUtils.jsm",
  BrowserUsageTelemetry: "resource:///modules/BrowserUsageTelemetry.jsm",
  BrowserUtils: "resource://gre/modules/BrowserUtils.jsm",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  ContextualIdentityService:
    "resource://gre/modules/ContextualIdentityService.jsm",
  Corroborate: "resource://gre/modules/Corroborate.jsm",
#if 0
  Discovery: "resource:///modules/Discovery.jsm",
#endif
  ExtensionsUI: "resource:///modules/ExtensionsUI.jsm",
  #if 0
  FirefoxMonitor: "resource:///modules/FirefoxMonitor.jsm",
  #endif
  FxAccounts: "resource://gre/modules/FxAccounts.jsm",
  HomePage: "resource:///modules/HomePage.jsm",
  Integration: "resource://gre/modules/Integration.jsm",
  LoginBreaches: "resource:///modules/LoginBreaches.jsm",
  LiveBookmarkMigrator: "resource:///modules/LiveBookmarkMigrator.jsm",
  NewTabUtils: "resource://gre/modules/NewTabUtils.jsm",
  Normandy: "resource://normandy/Normandy.jsm",
  ObjectUtils: "resource://gre/modules/ObjectUtils.jsm",
  OS: "resource://gre/modules/osfile.jsm",
  PageActions: "resource:///modules/PageActions.jsm",
  PageThumbs: "resource://gre/modules/PageThumbs.jsm",
  PdfJs: "resource://pdf.js/PdfJs.jsm",
  PermissionUI: "resource:///modules/PermissionUI.jsm",
  PlacesBackups: "resource://gre/modules/PlacesBackups.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  PluralForm: "resource://gre/modules/PluralForm.jsm",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  ProcessHangMonitor: "resource:///modules/ProcessHangMonitor.jsm",
  PublicSuffixList: "resource://gre/modules/netwerk-dns/PublicSuffixList.jsm",
  RemoteSettings: "resource://services-settings/remote-settings.js",
  RemoteSecuritySettings:
    "resource://gre/modules/psm/RemoteSecuritySettings.jsm",
  RFPHelper: "resource://gre/modules/RFPHelper.jsm",
  SafeBrowsing: "resource://gre/modules/SafeBrowsing.jsm",
  Sanitizer: "resource:///modules/Sanitizer.jsm",
#if 0
  SaveToPocket: "chrome://pocket/content/SaveToPocket.jsm",
#endif
  SearchTelemetry: "resource:///modules/SearchTelemetry.jsm",
  SessionStartup: "resource:///modules/sessionstore/SessionStartup.jsm",
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
  ShellService: "resource:///modules/ShellService.jsm",
  TabCrashHandler: "resource:///modules/ContentCrashHandlers.jsm",
  TabUnloader: "resource:///modules/TabUnloader.jsm",
  TRRRacer: "resource:///modules/TRRPerformance.jsm",
  UIState: "resource://services-sync/UIState.jsm",
  WebChannel: "resource://gre/modules/WebChannel.jsm",
  WindowsRegistry: "resource://gre/modules/WindowsRegistry.jsm",
});

// eslint-disable-next-line no-unused-vars
XPCOMUtils.defineLazyModuleGetters(this, {
  AboutLoginsParent: "resource:///modules/AboutLoginsParent.jsm",
  AsyncPrefs: "resource://gre/modules/AsyncPrefs.jsm",
  PluginManager: "resource:///actors/PluginParent.jsm",
  ReaderParent: "resource:///modules/ReaderParent.jsm",
});

/**
 * IF YOU ADD OR REMOVE FROM THIS LIST, PLEASE UPDATE THE LIST ABOVE AS WELL.
 * XXX Bug 1325373 is for making eslint detect these automatically.
 */

let initializedModules = {};

[
  [
    "ContentPrefServiceParent",
    "resource://gre/modules/ContentPrefServiceParent.jsm",
    "alwaysInit",
  ],
  ["ContentSearch", "resource:///modules/ContentSearch.jsm", "init"],
  ["UpdateListener", "resource://gre/modules/UpdateListener.jsm", "init"],
].forEach(([name, resource, init]) => {
  XPCOMUtils.defineLazyGetter(this, name, () => {
    ChromeUtils.import(resource, initializedModules);
    initializedModules[name][init]();
    return initializedModules[name];
  });
});

if (AppConstants.MOZ_CRASHREPORTER) {
__L_V__0({
    lN: 730,tT:'if',pr:'AppConstants.MOZ_CRASHREPORTER',eT:{},fN:''
  });'__L_V__0';
  XPCOMUtils.defineLazyModuleGetters(this, {
    UnsubmittedCrashHandler: "resource:///modules/ContentCrashHandlers.jsm",
  });
}

XPCOMUtils.defineLazyGetter(this, "gBrandBundle", function() {
__L_V__0({
    lN: 736,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
  return Services.strings.createBundle(
    "chrome://branding/locale/brand.properties"
  );
});

XPCOMUtils.defineLazyGetter(this, "gBrowserBundle", function() {
__L_V__0({
    lN: 742,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
  return Services.strings.createBundle(
    "chrome://browser/locale/browser.properties"
  );
});

XPCOMUtils.defineLazyGetter(this, "gTabbrowserBundle", function() {
__L_V__0({
    lN: 748,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
  return Services.strings.createBundle(
    "chrome://browser/locale/tabbrowser.properties"
  );
});

const global = this;

const listeners = {
  observers: {
    "update-staged": ["UpdateListener"],
    "update-downloaded": ["UpdateListener"],
    "update-available": ["UpdateListener"],
    "update-error": ["UpdateListener"],
    "gmp-plugin-crash": ["PluginManager"],
    "plugin-crashed": ["PluginManager"],
  },

  ppmm: {
    // PLEASE KEEP THIS LIST IN SYNC WITH THE LISTENERS ADDED IN ContentPrefServiceParent.init
    "ContentPrefs:FunctionCall": ["ContentPrefServiceParent"],
    "ContentPrefs:AddObserverForName": ["ContentPrefServiceParent"],
    "ContentPrefs:RemoveObserverForName": ["ContentPrefServiceParent"],
    // PLEASE KEEP THIS LIST IN SYNC WITH THE LISTENERS ADDED IN ContentPrefServiceParent.init

    // PLEASE KEEP THIS LIST IN SYNC WITH THE LISTENERS ADDED IN AsyncPrefs.init
    "AsyncPrefs:SetPref": ["AsyncPrefs"],
    "AsyncPrefs:ResetPref": ["AsyncPrefs"],
    // PLEASE KEEP THIS LIST IN SYNC WITH THE LISTENERS ADDED IN AsyncPrefs.init
  },

  mm: {
    "AboutLogins:CreateLogin": ["AboutLoginsParent"],
    "AboutLogins:DeleteLogin": ["AboutLoginsParent"],
    "AboutLogins:DismissBreachAlert": ["AboutLoginsParent"],
    "AboutLogins:HideFooter": ["AboutLoginsParent"],
    "AboutLogins:Import": ["AboutLoginsParent"],
    "AboutLogins:MasterPasswordRequest": ["AboutLoginsParent"],
    "AboutLogins:OpenFAQ": ["AboutLoginsParent"],
    "AboutLogins:GetHelp": ["AboutLoginsParent"],
    "AboutLogins:OpenPreferences": ["AboutLoginsParent"],
    "AboutLogins:OpenMobileAndroid": ["AboutLoginsParent"],
    "AboutLogins:OpenMobileIos": ["AboutLoginsParent"],
    "AboutLogins:OpenSite": ["AboutLoginsParent"],
    "AboutLogins:SortChanged": ["AboutLoginsParent"],
    "AboutLogins:Subscribe": ["AboutLoginsParent"],
    "AboutLogins:SyncEnable": ["AboutLoginsParent"],
    "AboutLogins:SyncOptions": ["AboutLoginsParent"],
    "AboutLogins:UpdateLogin": ["AboutLoginsParent"],
    ContentSearch: ["ContentSearch"],
    "Reader:FaviconRequest": ["ReaderParent"],
    "Reader:UpdateReaderButton": ["ReaderParent"],
  },

  observe(subject, topic, data) {
__L_V__0({
    lN: 802,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__0';
    for (let module of this.observers[topic]) {
      try {
        global[module].observe(subject, topic, data);
      } catch (e) {
        Cu.reportError(e);
      }
    }
  },

  receiveMessage(modules, data) {
__L_V__0({
    lN: 812,tT:'func',pr:'',eT:{'modules':modules,'data':data},fN:'receiveMessage'
  });'__L_V__0';
    let val;
    for (let module of modules[data.name]) {
      try {
        val = global[module].receiveMessage(data) || val;
      } catch (e) {
        Cu.reportError(e);
      }
    }
    return val;
  },

  init() {
__L_V__0({
    lN: 824,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__0';
    for (let observer of Object.keys(this.observers)) {
      Services.obs.addObserver(this, observer);
    }

    let receiveMessageMM = this.receiveMessage.bind(this, this.mm);
    for (let message of Object.keys(this.mm)) {
      Services.mm.addMessageListener(message, receiveMessageMM);
    }

    let receiveMessagePPMM = this.receiveMessage.bind(this, this.ppmm);
    for (let message of Object.keys(this.ppmm)) {
      Services.ppmm.addMessageListener(message, receiveMessagePPMM);
    }
  },
};

// Seconds of idle before trying to create a bookmarks backup.
const BOOKMARKS_BACKUP_IDLE_TIME_SEC = 8 * 60;
// Minimum interval between backups.  We try to not create more than one backup
// per interval.
const BOOKMARKS_BACKUP_MIN_INTERVAL_DAYS = 1;
// Maximum interval between backups.  If the last backup is older than these
// days we will try to create a new one more aggressively.
const BOOKMARKS_BACKUP_MAX_INTERVAL_DAYS = 3;
// Seconds of idle time before the late idle tasks will be scheduled.
const LATE_TASKS_IDLE_TIME_SEC = 20;
// Time after we stop tracking startup crashes.
const STARTUP_CRASHES_END_DELAY_MS = 30 * 1000;

/*
 * OS X has the concept of zero-window sessions and therefore ignores the
 * browser-lastwindow-close-* topics.
 */
const OBSERVE_LASTWINDOW_CLOSE_TOPICS = AppConstants.platform != "macosx";

function BrowserGlue() {
__L_V__0({
    lN: 860,tT:'func',pr:'',eT:{},fN:'BrowserGlue'
  });'__L_V__0';
  XPCOMUtils.defineLazyServiceGetter(
    this,
    "_idleService",
    "@mozilla.org/widget/idleservice;1",
    "nsIIdleService"
  );

  XPCOMUtils.defineLazyGetter(this, "_distributionCustomizer", function() {
__L_V__0({
    lN: 868,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
    const { DistributionCustomizer } = ChromeUtils.import(
      "resource:///modules/distribution.js"
    );
    return new DistributionCustomizer();
  });

  XPCOMUtils.defineLazyServiceGetter(
    this,
    "AlertsService",
    "@mozilla.org/alerts-service;1",
    "nsIAlertsService"
  );

  this._init();
}

BrowserGlue.prototype = {
  _saveSession: false,
  _migrationImportsDefaultBookmarks: false,
  _placesBrowserInitComplete: false,
  _isNewProfile: undefined,

  _setPrefToSaveSession: function BG__setPrefToSaveSession(aForce) {
__L_V__0({
    lN: 891,tT:'func',pr:'',eT:{'aForce':aForce},fN:'BG__setPrefToSaveSession'
  });'__L_V__0';
    if (!this._saveSession && !aForce) {
__L_V__0({
    lN: 892,tT:'if',pr:'!this._saveSession && !aForce',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    if (!PrivateBrowsingUtils.permanentPrivateBrowsing) {
__L_V__0({
    lN: 896,tT:'if',pr:'!PrivateBrowsingUtils.permanentPrivateBrowsing',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.setBoolPref(
        "browser.sessionstore.resume_session_once",
        true
      );
    }

    // This method can be called via [NSApplication terminate:] on Mac, which
    // ends up causing prefs not to be flushed to disk, so we need to do that
    // explicitly here. See bug 497652.
    Services.prefs.savePrefFile(null);
  },

#ifdef MOZ_SERVICES_SYNC
  _setSyncAutoconnectDelay: function BG__setSyncAutoconnectDelay() {
__L_V__0({
    lN: 910,tT:'func',pr:'',eT:{},fN:'BG__setSyncAutoconnectDelay'
  });'__L_V__0';
    // Assume that a non-zero value for services.sync.autoconnectDelay should override
    if (Services.prefs.prefHasUserValue("services.sync.autoconnectDelay")) {
__L_V__0({
    lN: 912,tT:'if',pr:'Services.prefs.prefHasUserValue(services.sync.autoconnectDelay)',eT:{},fN:''
  });'__L_V__0';
      let prefDelay = Services.prefs.getIntPref(
        "services.sync.autoconnectDelay"
      );

      if (prefDelay > 0) {
__L_V__0({
    lN: 917,tT:'if',pr:'prefDelay > 0',eT:{},fN:''
  });'__L_V__0';
        return;
      }
    }

    // delays are in seconds
    const MAX_DELAY = 300;
    let delay = 3;
    for (let win of Services.wm.getEnumerator("navigator:browser")) {
      // browser windows without a gBrowser almost certainly means we are
      // shutting down, so instead of just ignoring that window we abort.
      if (win.closed || !win.gBrowser) {
__L_V__0({
    lN: 928,tT:'if',pr:'win.closed || !win.gBrowser',eT:{},fN:''
  });'__L_V__0';
        return;
      }
      delay += win.gBrowser.tabs.length;
    }
    delay = delay <= MAX_DELAY ? delay : MAX_DELAY;

    const { Weave } = ChromeUtils.import("resource://services-sync/main.js");
    Weave.Service.scheduler.delayedAutoConnect(delay);
  },
#endif

  // nsIObserver implementation
  observe: async function BG_observe(subject, topic, data) {
__L_V__0({
    lN: 941,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'BG_observe'
  });'__L_V__0';
__L_V__0({
    lN: 942,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__0';
    switch (topic) {
      case "notifications-open-settings":
        this._openPreferences("privacy-permissions");
        break;
      case "final-ui-startup":
        this._beforeUIStartup();
        break;
      case "browser-delayed-startup-finished":
        this._onFirstWindowLoaded(subject);
        Services.obs.removeObserver(this, "browser-delayed-startup-finished");
        break;
      case "sessionstore-windows-restored":
        this._onWindowsRestored();
        break;
      case "browser:purge-session-history":
        // reset the console service's error buffer
        Services.console.logStringMessage(null); // clear the console (in case it's open)
        Services.console.reset();
        break;
      case "restart-in-safe-mode":
        this._onSafeModeRestart();
        break;
      case "quit-application-requested":
        this._onQuitRequest(subject, data);
        break;
      case "quit-application-granted":
        this._onQuitApplicationGranted();
        break;
      case "browser-lastwindow-close-requested":
        if (OBSERVE_LASTWINDOW_CLOSE_TOPICS) {
__L_V__0({
    lN: 971,tT:'if',pr:'OBSERVE_LASTWINDOW_CLOSE_TOPICS',eT:{},fN:''
  });'__L_V__0';
          // The application is not actually quitting, but the last full browser
          // window is about to be closed.
          this._onQuitRequest(subject, "lastwindow");
        }
        break;
      case "browser-lastwindow-close-granted":
        if (OBSERVE_LASTWINDOW_CLOSE_TOPICS) {
__L_V__0({
    lN: 978,tT:'if',pr:'OBSERVE_LASTWINDOW_CLOSE_TOPICS',eT:{},fN:''
  });'__L_V__0';
          this._setPrefToSaveSession();
        }
        break;
#ifdef MOZ_SERVICES_SYNC
      case "weave:service:ready":
        this._setSyncAutoconnectDelay();
        break;
      case "fxaccounts:onverified":
        this._onThisDeviceConnected();
        break;
      case "fxaccounts:device_connected":
        this._onDeviceConnected(data);
        break;
      case "fxaccounts:verify_login":
        this._onVerifyLoginNotification(JSON.parse(data));
        break;
      case "fxaccounts:device_disconnected":
        data = JSON.parse(data);
        if (data.isLocalDevice) {
__L_V__0({
    lN: 997,tT:'if',pr:'data.isLocalDevice',eT:{},fN:''
  });'__L_V__0';
          this._onDeviceDisconnected();
        }
        break;
      case "fxaccounts:commands:open-uri":
      case "weave:engine:clients:display-uris":
        this._onDisplaySyncURIs(subject);
        break;
#endif
      case "session-save":
        this._setPrefToSaveSession(true);
        subject.QueryInterface(Ci.nsISupportsPRBool);
        subject.data = true;
        break;
      case "places-init-complete":
        Services.obs.removeObserver(this, "places-init-complete");
        if (!this._migrationImportsDefaultBookmarks) {
__L_V__0({
    lN: 1013,tT:'if',pr:'!this._migrationImportsDefaultBookmarks',eT:{},fN:''
  });'__L_V__0';
          this._initPlaces(false);
        }
        break;
      case "idle":
        this._backupBookmarks();
        break;
      case "distribution-customization-complete":
        Services.obs.removeObserver(
          this,
          "distribution-customization-complete"
        );
        // Customization has finished, we don't need the customizer anymore.
        delete this._distributionCustomizer;
        break;
      case "browser-glue-test": // used by tests
        if (data == "force-ui-migration") {
__L_V__0({
    lN: 1029,tT:'if',pr:'data == force-ui-migration',eT:{},fN:''
  });'__L_V__0';
          this._migrateUI();
        } else if (data == "force-distribution-customization") {
__L_V__0({
    lN: 1031,tT:'if',pr:'data == force-distribution-customization',eT:{},fN:''
  });'__L_V__0';
          this._distributionCustomizer.applyCustomizations();
          // To apply distribution bookmarks use "places-init-complete".
        } else if (data == "force-places-init") {
__L_V__0({
    lN: 1034,tT:'if',pr:'data == force-places-init',eT:{},fN:''
  });'__L_V__0';
          this._initPlaces(false);
        } else if (data == "mock-alerts-service") {
__L_V__0({
    lN: 1036,tT:'if',pr:'data == mock-alerts-service',eT:{},fN:''
  });'__L_V__0';
          Object.defineProperty(this, "AlertsService", {
            value: subject.wrappedJSObject,
          });
        } else if (data == "places-browser-init-complete") {
__L_V__0({
    lN: 1040,tT:'if',pr:'data == places-browser-init-complete',eT:{},fN:''
  });'__L_V__0';
          if (this._placesBrowserInitComplete) {
__L_V__0({
    lN: 1041,tT:'if',pr:'this._placesBrowserInitComplete',eT:{},fN:''
  });'__L_V__0';
            Services.obs.notifyObservers(null, "places-browser-init-complete");
          }
        } else if (data == "migrateMatchBucketsPrefForUI66") {
__L_V__0({
    lN: 1044,tT:'if',pr:'data == migrateMatchBucketsPrefForUI66',eT:{},fN:''
  });'__L_V__0';
          this._migrateMatchBucketsPrefForUI66().then(() => {
            Services.obs.notifyObservers(
              null,
              "browser-glue-test",
              "migrateMatchBucketsPrefForUI66-done"
            );
          });
        } else if (data == "add-breaches-sync-handler") {
__L_V__0({
    lN: 1052,tT:'if',pr:'data == add-breaches-sync-handler',eT:{},fN:''
  });'__L_V__0';
          this._addBreachesSyncHandler();
        }
        break;
      case "initial-migration-will-import-default-bookmarks":
        this._migrationImportsDefaultBookmarks = true;
        break;
      case "initial-migration-did-import-default-bookmarks":
        this._initPlaces(true);
        break;
      case "handle-xul-text-link":
        let linkHandled = subject.QueryInterface(Ci.nsISupportsPRBool);
        if (!linkHandled.data) {
__L_V__0({
    lN: 1064,tT:'if',pr:'!linkHandled.data',eT:{},fN:''
  });'__L_V__0';
          let win = BrowserWindowTracker.getTopWindow();
          if (win) {
__L_V__0({
    lN: 1066,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__0';
            data = JSON.parse(data);
            let where = win.whereToOpenLink(data);
            // Preserve legacy behavior of non-modifier left-clicks
            // opening in a new selected tab.
            if (where == "current") {
__L_V__0({
    lN: 1071,tT:'if',pr:'where == current',eT:{},fN:''
  });'__L_V__0';
              where = "tab";
            }
            win.openTrustedLinkIn(data.href, where);
            linkHandled.data = true;
          }
        }
        break;
      case "profile-before-change":
        // Any component depending on Places should be finalized in
        // _onPlacesShutdown.  Any component that doesn't need to act after
        // the UI has gone should be finalized in _onQuitApplicationGranted.
        this._dispose();
        break;
      case "keyword-search":
        // This notification is broadcast by the docshell when it "fixes up" a
        // URI that it's been asked to load into a keyword search.
        let engine = null;
        try {
          engine = subject.QueryInterface(Ci.nsISearchEngine);
        } catch (ex) {
          Cu.reportError(ex);
        }
        let win = BrowserWindowTracker.getTopWindow();
        win.BrowserSearch.recordSearchInTelemetry(engine, "urlbar");
        break;
      case "browser-search-engine-modified":
        // Ensure we cleanup the hiddenOneOffs pref when removing
        // an engine, and that newly added engines are visible.
        if (data == "engine-added" || data == "engine-removed") {
__L_V__0({
    lN: 1100,tT:'if',pr:'data == engine-added || data == engine-removed',eT:{},fN:''
  });'__L_V__0';
          let engineName = subject.QueryInterface(Ci.nsISearchEngine).name;
          let pref = Services.prefs.getStringPref(
            "browser.search.hiddenOneOffs"
          );
          let hiddenList = pref ? pref.split(",") : [];
          hiddenList = hiddenList.filter(x => x !== engineName);
          Services.prefs.setStringPref(
            "browser.search.hiddenOneOffs",
            hiddenList.join(",")
          );
        }
        break;
      case "flash-plugin-hang":
        this._handleFlashHang();
        break;
      case "xpi-signature-changed":
        let disabledAddons = JSON.parse(data).disabled;
        let addons = await AddonManager.getAddonsByIDs(disabledAddons);
        if (addons.some(addon => addon)) {
__L_V__0({
    lN: 1119,tT:'if',pr:'addons.some(addon => addon)',eT:{},fN:''
  });'__L_V__0';
          this._notifyUnsignedAddonsDisabled();
        }
        break;
      case "sync-ui-state:update":
        this._updateFxaBadges();
        break;
      case "handlersvc-store-initialized":
        // Initialize PdfJs when running in-process and remote. This only
        // happens once since PdfJs registers global hooks. If the PdfJs
        // extension is installed the init method below will be overridden
        // leaving initialization to the extension.
        // parent only: configure default prefs, set up pref observers, register
        // pdf content handler, and initializes parent side message manager
        // shim for privileged api access.
        PdfJs.init(this._isNewProfile);
        break;
      case "shield-init-complete":
        this._shieldInitComplete = true;
        break;
    }
  },

  // initialization (called on application startup)
  _init: function BG__init() {
__L_V__0({
    lN: 1143,tT:'func',pr:'',eT:{},fN:'BG__init'
  });'__L_V__0';
    let os = Services.obs;
    os.addObserver(this, "notifications-open-settings");
    os.addObserver(this, "final-ui-startup");
    os.addObserver(this, "browser-delayed-startup-finished");
    os.addObserver(this, "sessionstore-windows-restored");
    os.addObserver(this, "browser:purge-session-history");
    os.addObserver(this, "quit-application-requested");
    os.addObserver(this, "quit-application-granted");
    if (OBSERVE_LASTWINDOW_CLOSE_TOPICS) {
__L_V__0({
    lN: 1152,tT:'if',pr:'OBSERVE_LASTWINDOW_CLOSE_TOPICS',eT:{},fN:''
  });'__L_V__0';
      os.addObserver(this, "browser-lastwindow-close-requested");
      os.addObserver(this, "browser-lastwindow-close-granted");
    }
#ifdef MOZ_SERVICES_SYNC
    os.addObserver(this, "weave:service:ready");
    os.addObserver(this, "fxaccounts:onverified");
    os.addObserver(this, "fxaccounts:device_connected");
    os.addObserver(this, "fxaccounts:verify_login");
    os.addObserver(this, "fxaccounts:device_disconnected");
    os.addObserver(this, "fxaccounts:commands:open-uri");
    os.addObserver(this, "weave:engine:clients:display-uris");
#endif
    os.addObserver(this, "session-save");
    os.addObserver(this, "places-init-complete");
    os.addObserver(this, "distribution-customization-complete");
    os.addObserver(this, "handle-xul-text-link");
    os.addObserver(this, "profile-before-change");
    os.addObserver(this, "keyword-search");
    os.addObserver(this, "browser-search-engine-modified");
    os.addObserver(this, "restart-in-safe-mode");
    os.addObserver(this, "flash-plugin-hang");
    os.addObserver(this, "xpi-signature-changed");
    os.addObserver(this, "sync-ui-state:update");
    os.addObserver(this, "handlersvc-store-initialized");
    os.addObserver(this, "shield-init-complete");

    ActorManagerParent.addActors(ACTORS);
    ActorManagerParent.addLegacyActors(LEGACY_ACTORS);
    ActorManagerParent.flush();

    this._flashHangCount = 0;
    this._firstWindowReady = new Promise(
      resolve => (this._firstWindowLoaded = resolve)
    );
    if (AppConstants.platform == "win") {
__L_V__0({
    lN: 1187,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__0';
      JawsScreenReaderVersionCheck.init();
    }
  },

  // cleanup (called on application shutdown)
  _dispose: function BG__dispose() {
__L_V__0({
    lN: 1193,tT:'func',pr:'',eT:{},fN:'BG__dispose'
  });'__L_V__0';
    let os = Services.obs;
    os.removeObserver(this, "notifications-open-settings");
    os.removeObserver(this, "final-ui-startup");
    os.removeObserver(this, "sessionstore-windows-restored");
    os.removeObserver(this, "browser:purge-session-history");
    os.removeObserver(this, "quit-application-requested");
    os.removeObserver(this, "quit-application-granted");
    os.removeObserver(this, "restart-in-safe-mode");
    if (OBSERVE_LASTWINDOW_CLOSE_TOPICS) {
__L_V__0({
    lN: 1202,tT:'if',pr:'OBSERVE_LASTWINDOW_CLOSE_TOPICS',eT:{},fN:''
  });'__L_V__0';
      os.removeObserver(this, "browser-lastwindow-close-requested");
      os.removeObserver(this, "browser-lastwindow-close-granted");
    }
#ifdef MOZ_SERVICES_SYNC
    os.removeObserver(this, "weave:service:ready");
    os.removeObserver(this, "fxaccounts:onverified");
    os.removeObserver(this, "fxaccounts:device_connected");
    os.removeObserver(this, "fxaccounts:verify_login");
    os.removeObserver(this, "fxaccounts:device_disconnected");
    os.removeObserver(this, "fxaccounts:commands:open-uri");
    os.removeObserver(this, "weave:engine:clients:display-uris");
#endif
    os.removeObserver(this, "session-save");
    if (this._bookmarksBackupIdleTime) {
__L_V__0({
    lN: 1216,tT:'if',pr:'this._bookmarksBackupIdleTime',eT:{},fN:''
  });'__L_V__0';
      this._idleService.removeIdleObserver(this, this._bookmarksBackupIdleTime);
      delete this._bookmarksBackupIdleTime;
    }
    if (this._lateTasksIdleObserver) {
__L_V__0({
    lN: 1220,tT:'if',pr:'this._lateTasksIdleObserver',eT:{},fN:''
  });'__L_V__0';
      this._idleService.removeIdleObserver(
        this._lateTasksIdleObserver,
        LATE_TASKS_IDLE_TIME_SEC
      );
      delete this._lateTasksIdleObserver;
    }
    if (this._gmpInstallManager) {
__L_V__0({
    lN: 1227,tT:'if',pr:'this._gmpInstallManager',eT:{},fN:''
  });'__L_V__0';
      this._gmpInstallManager.uninit();
      delete this._gmpInstallManager;
    }
    try {
      os.removeObserver(this, "places-init-complete");
    } catch (ex) {
      /* Could have been removed already */
    }
    os.removeObserver(this, "handle-xul-text-link");
    os.removeObserver(this, "profile-before-change");
    os.removeObserver(this, "keyword-search");
    os.removeObserver(this, "browser-search-engine-modified");
    os.removeObserver(this, "flash-plugin-hang");
    os.removeObserver(this, "xpi-signature-changed");
    os.removeObserver(this, "sync-ui-state:update");
    os.removeObserver(this, "shield-init-complete");

    Services.prefs.removeObserver(
      "privacy.trackingprotection",
      this._matchCBCategory
    );
    Services.prefs.removeObserver(
      "network.cookie.cookieBehavior",
      this._matchCBCategory
    );
    Services.prefs.removeObserver(
      ContentBlockingCategoriesPrefs.PREF_CB_CATEGORY,
      this._updateCBCategory
    );
    Services.prefs.removeObserver(
      "privacy.trackingprotection",
      this._setPrefExpectations
    );
    Services.prefs.removeObserver(
      "browser.contentblocking.features.strict",
      this._setPrefExpectationsAndUpdate
    );
  },

  // runs on startup, before the first command line handler is invoked
  // (i.e. before the first window is opened)
  _beforeUIStartup: function BG__beforeUIStartup() {
__L_V__0({
    lN: 1269,tT:'func',pr:'',eT:{},fN:'BG__beforeUIStartup'
  });'__L_V__0';
    SessionStartup.init();

    // check if we're in safe mode
    if (Services.appinfo.inSafeMode) {
__L_V__0({
    lN: 1273,tT:'if',pr:'Services.appinfo.inSafeMode',eT:{},fN:''
  });'__L_V__0';
      Services.ww.openWindow(
        null,
        "chrome://browser/content/safeMode.xhtml",
        "_blank",
        "chrome,centerscreen,modal,resizable=no",
        null
      );
    }

    // apply distribution customizations
    this._distributionCustomizer.applyCustomizations();

    // handle any UI migration
    this._migrateUI();

    if (Services.prefs.prefHasUserValue(PREF_PDFJS_ENABLED_CACHE_STATE)) {
__L_V__0({
    lN: 1289,tT:'if',pr:'Services.prefs.prefHasUserValue(PREF_PDFJS_ENABLED_CACHE_STATE)',eT:{},fN:''
  });'__L_V__0';
      Services.ppmm.sharedData.set(
        "pdfjs.enabled",
        Services.prefs.getBoolPref(PREF_PDFJS_ENABLED_CACHE_STATE)
      );
    } else {
      PdfJs.earlyInit(this._isNewProfile);
    }

    listeners.init();

    SessionStore.init();

    AddonManager.maybeInstallBuiltinAddon(
      "firefox-compact-light@mozilla.org",
      "1.0",
      "resource:///modules/themes/light/"
    );
    AddonManager.maybeInstallBuiltinAddon(
      "firefox-compact-dark@mozilla.org",
      "1.0",
      "resource:///modules/themes/dark/"
    );

    if (AppConstants.MOZ_NORMANDY) {
__L_V__0({
    lN: 1313,tT:'if',pr:'AppConstants.MOZ_NORMANDY',eT:{},fN:''
  });'__L_V__0';
      Normandy.init();
    }

#if 0
    SaveToPocket.init();
#endif
    Services.obs.notifyObservers(null, "browser-ui-startup-complete");

    if (AppConstants.platform == "win") {
__L_V__0({
    lN: 1322,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__0';
      cliqz_shouldMakeEnterpriseRootsEnabled();
    }

    cliqz_shouldMakeCliqzEngineDefault();
  },

  _checkForOldBuildUpdates() {
__L_V__0({
    lN: 1329,tT:'func',pr:'',eT:{},fN:'_checkForOldBuildUpdates'
  });'__L_V__0';
    // check for update if our build is old
    if (
      AppConstants.MOZ_UPDATER &&
      Services.prefs.getBoolPref("app.update.checkInstallTime")
    ) {
__L_V__0({
    lN: 1334,tT:'if',pr:' AppConstants.MOZ_UPDATER && Services.prefs.getBoolPref(app.update.checkInstallTime) ',eT:{},fN:''
  });'__L_V__0';
      let buildID = Services.appinfo.appBuildID;
      let today = new Date().getTime();
      /* eslint-disable no-multi-spaces */
      let buildDate = new Date(
        buildID.slice(0, 4), // year
        buildID.slice(4, 6) - 1, // months are zero-based.
        buildID.slice(6, 8), // day
        buildID.slice(8, 10), // hour
        buildID.slice(10, 12), // min
        buildID.slice(12, 14)
      ) // ms
        .getTime();
      /* eslint-enable no-multi-spaces */

      const millisecondsIn24Hours = 86400000;
      let acceptableAge =
        Services.prefs.getIntPref("app.update.checkInstallTime.days") *
        millisecondsIn24Hours;

      if (buildDate + acceptableAge < today) {
__L_V__0({
    lN: 1354,tT:'if',pr:'buildDate + acceptableAge < today',eT:{},fN:''
  });'__L_V__0';
        Cc["@mozilla.org/updates/update-service;1"]
          .getService(Ci.nsIApplicationUpdateService)
          .checkForBackgroundUpdates();
      }
    }
  },

  _onSafeModeRestart: function BG_onSafeModeRestart() {
__L_V__0({
    lN: 1362,tT:'func',pr:'',eT:{},fN:'BG_onSafeModeRestart'
  });'__L_V__0';
    // prompt the user to confirm
    let strings = gBrowserBundle;
    let promptTitle = strings.GetStringFromName("safeModeRestartPromptTitle");
    let promptMessage = strings.GetStringFromName(
      "safeModeRestartPromptMessage"
    );
    let restartText = strings.GetStringFromName("safeModeRestartButton");
    let buttonFlags =
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
      Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL +
      Services.prompt.BUTTON_POS_0_DEFAULT;

    let rv = Services.prompt.confirmEx(
      null,
      promptTitle,
      promptMessage,
      buttonFlags,
      restartText,
      null,
      null,
      null,
      {}
    );
    if (rv != 0) {
__L_V__0({
    lN: 1386,tT:'if',pr:'rv != 0',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
      Ci.nsISupportsPRBool
    );
    Services.obs.notifyObservers(
      cancelQuit,
      "quit-application-requested",
      "restart"
    );

    if (!cancelQuit.data) {
__L_V__0({
    lN: 1399,tT:'if',pr:'!cancelQuit.data',eT:{},fN:''
  });'__L_V__0';
      Services.startup.restartInSafeMode(Ci.nsIAppStartup.eAttemptQuit);
    }
  },

  _trackSlowStartup() {
__L_V__0({
    lN: 1404,tT:'func',pr:'',eT:{},fN:'_trackSlowStartup'
  });'__L_V__0';
    let disabled = Services.prefs.getBoolPref(
      "browser.slowStartup.notificationDisabled"
    );

    Services.telemetry.scalarSet(
      "browser.startup.slow_startup_notification_disabled",
      disabled
    );

    if (Services.startup.interrupted || disabled) {
__L_V__0({
    lN: 1414,tT:'if',pr:'Services.startup.interrupted || disabled',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    let currentTime = Math.round(Cu.now());

    Services.telemetry.scalarSet("browser.startup.recorded_time", currentTime);

    let averageTime = 0;
    let samples = 0;
    try {
      averageTime = Services.prefs.getIntPref(
        "browser.slowStartup.averageTime"
      );
      samples = Services.prefs.getIntPref("browser.slowStartup.samples");
    } catch (e) {}

    let totalTime = averageTime * samples + currentTime;
    samples++;
    averageTime = totalTime / samples;

    Services.telemetry.scalarSet("browser.startup.average_time", averageTime);

    if (
      samples >= Services.prefs.getIntPref("browser.slowStartup.maxSamples")
    ) {
__L_V__0({
    lN: 1439,tT:'if',pr:' samples >= Services.prefs.getIntPref(browser.slowStartup.maxSamples) ',eT:{},fN:''
  });'__L_V__0';
      if (
        averageTime >
        Services.prefs.getIntPref("browser.slowStartup.timeThreshold")
      ) {
__L_V__0({
    lN: 1443,tT:'if',pr:' averageTime > Services.prefs.getIntPref(browser.slowStartup.timeThreshold) ',eT:{},fN:''
  });'__L_V__0';
        this._calculateProfileAgeInDays().then(
          this._showSlowStartupNotification,
          null
        );
      }
      averageTime = 0;
      samples = 0;
    }

    Services.prefs.setIntPref("browser.slowStartup.averageTime", averageTime);
    Services.prefs.setIntPref("browser.slowStartup.samples", samples);
  },

  async _calculateProfileAgeInDays() {
__L_V__0({
    lN: 1457,tT:'func',pr:'',eT:{},fN:'_calculateProfileAgeInDays'
  });'__L_V__0';
    let ProfileAge = ChromeUtils.import(
      "resource://gre/modules/ProfileAge.jsm",
      {}
    ).ProfileAge;
    let profileAge = await ProfileAge();

    let creationDate = await profileAge.created;
    let resetDate = await profileAge.reset;

    // if the profile was reset, consider the
    // reset date for its age.
    let profileDate = resetDate || creationDate;

    const ONE_DAY = 24 * 60 * 60 * 1000;
    return (Date.now() - profileDate) / ONE_DAY;
  },

  _showSlowStartupNotification(profileAge) {
__L_V__0({
    lN: 1475,tT:'func',pr:'',eT:{'profileAge':profileAge},fN:'_showSlowStartupNotification'
  });'__L_V__0';
    if (profileAge < 90) {
__L_V__0({
    lN: 1476,tT:'if',pr:'profileAge < 90',eT:{},fN:''
  });'__L_V__0';
      // 3 months
      Services.telemetry.scalarSet(
        "browser.startup.too_new_for_notification",
        true
      );
      return;
    }

    let win = BrowserWindowTracker.getTopWindow();
    if (!win) {
__L_V__0({
    lN: 1486,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    Services.telemetry.scalarSet("browser.startup.slow_startup_notified", true);

    const NO_ACTION = 0;
    const OPENED_SUMO = 1;
    const NEVER_SHOW_AGAIN = 2;
    const DISMISS_NOTIFICATION = 3;

    Services.telemetry.scalarSet("browser.startup.action", NO_ACTION);

    let productName = gBrandBundle.GetStringFromName("brandFullName");
    let message = win.gNavigatorBundle.getFormattedString(
      "slowStartup.message",
      [productName]
    );

    let buttons = [
      {
        label: win.gNavigatorBundle.getString("slowStartup.helpButton.label"),
        accessKey: win.gNavigatorBundle.getString(
          "slowStartup.helpButton.accesskey"
        ),
        callback() {
__L_V__0({
    lN: 1511,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__0';
          Services.telemetry.scalarSet("browser.startup.action", OPENED_SUMO);
          win.openTrustedLinkIn(
            "https://support.mozilla.org/kb/reset-firefox-easily-fix-most-problems",
            "tab"
          );
        },
      },
      {
        label: win.gNavigatorBundle.getString(
          "slowStartup.disableNotificationButton.label"
        ),
        accessKey: win.gNavigatorBundle.getString(
          "slowStartup.disableNotificationButton.accesskey"
        ),
        callback() {
__L_V__0({
    lN: 1526,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__0';
          Services.telemetry.scalarSet(
            "browser.startup.action",
            NEVER_SHOW_AGAIN
          );
          Services.prefs.setBoolPref(
            "browser.slowStartup.notificationDisabled",
            true
          );
        },
      },
    ];

    let closeCallback = closeType => {
      if (closeType == "dismissed") {
__L_V__0({
    lN: 1540,tT:'if',pr:'closeType == dismissed',eT:{},fN:''
  });'__L_V__0';
        Services.telemetry.scalarSet(
          "browser.startup.action",
          DISMISS_NOTIFICATION
        );
      }
    };

    win.gNotificationBox.appendNotification(
      message,
      "slow-startup",
      "chrome://browser/skin/slowStartup-16.png",
      win.gNotificationBox.PRIORITY_INFO_LOW,
      buttons,
      closeCallback
    );
  },

  /**
   * Show a notification bar offering a reset.
   *
   * @param reason
   *        String of either "unused" or "uninstall", specifying the reason
   *        why a profile reset is offered.
   */
  _resetProfileNotification(reason) {
__L_V__0({
    lN: 1565,tT:'func',pr:'',eT:{'reason':reason},fN:'_resetProfileNotification'
  });'__L_V__0';
    let win = BrowserWindowTracker.getTopWindow();
    if (!win) {
__L_V__0({
    lN: 1567,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    const { ResetProfile } = ChromeUtils.import(
      "resource://gre/modules/ResetProfile.jsm"
    );
    if (!ResetProfile.resetSupported()) {
__L_V__0({
    lN: 1574,tT:'if',pr:'!ResetProfile.resetSupported()',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    let productName = gBrandBundle.GetStringFromName("brandShortName");
    let resetBundle = Services.strings.createBundle(
      "chrome://global/locale/resetProfile.properties"
    );

    let message;
    if (reason == "unused") {
__L_V__0({
    lN: 1584,tT:'if',pr:'reason == unused',eT:{},fN:''
  });'__L_V__0';
      message = resetBundle.formatStringFromName("resetUnusedProfile.message", [
        productName,
      ]);
    } else if (reason == "uninstall") {
__L_V__0({
    lN: 1588,tT:'if',pr:'reason == uninstall',eT:{},fN:''
  });'__L_V__0';
      message = resetBundle.formatStringFromName("resetUninstalled.message", [
        productName,
      ]);
    } else {
      throw new Error(
        `Unknown reason (${reason}) given to _resetProfileNotification.`
      );
    }
    let buttons = [
      {
        label: resetBundle.formatStringFromName(
          "refreshProfile.resetButton.label",
          [productName]
        ),
        accessKey: resetBundle.GetStringFromName(
          "refreshProfile.resetButton.accesskey"
        ),
        callback() {
__L_V__0({
    lN: 1606,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__0';
          ResetProfile.openConfirmationDialog(win);
        },
      },
    ];

    win.gNotificationBox.appendNotification(
      message,
      "reset-profile-notification",
      "chrome://global/skin/icons/question-16.png",
      win.gNotificationBox.PRIORITY_INFO_LOW,
      buttons
    );
  },

  _notifyUnsignedAddonsDisabled() {
__L_V__0({
    lN: 1621,tT:'func',pr:'',eT:{},fN:'_notifyUnsignedAddonsDisabled'
  });'__L_V__0';
    let win = BrowserWindowTracker.getTopWindow();
    if (!win) {
__L_V__0({
    lN: 1623,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    let message = win.gNavigatorBundle.getString(
      "unsignedAddonsDisabled.message"
    );
    let buttons = [
      {
        label: win.gNavigatorBundle.getString(
          "unsignedAddonsDisabled.learnMore.label"
        ),
        accessKey: win.gNavigatorBundle.getString(
          "unsignedAddonsDisabled.learnMore.accesskey"
        ),
        callback() {
__L_V__0({
    lN: 1638,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__0';
          win.openUILinkIn("https://cliqz.com/support/wieso-keine-addons", "tab")
        },
      },
    ];

    win.gHighPriorityNotificationBox.appendNotification(
      message,
      "unsigned-addons-disabled",
      "",
      win.gHighPriorityNotificationBox.PRIORITY_WARNING_MEDIUM,
      buttons
    );
  },

  _firstWindowTelemetry(aWindow) {
__L_V__0({
    lN: 1653,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'_firstWindowTelemetry'
  });'__L_V__0';
    let scaling = aWindow.devicePixelRatio * 100;
    try {
      Services.telemetry.getHistogramById("DISPLAY_SCALING").add(scaling);
    } catch (ex) {}
  },

  _collectStartupConditionsTelemetry() {
__L_V__0({
    lN: 1660,tT:'func',pr:'',eT:{},fN:'_collectStartupConditionsTelemetry'
  });'__L_V__0';
    let nowSeconds = Math.round(Date.now() / 1000);
    // Don't include cases where we don't have the pref. This rules out the first install
    // as well as the first run of a build since this was introduced. These could by some
    // definitions be referred to as "cold" startups, but probably not since we likely
    // just wrote many of the files we use to disk. This way we should approximate a lower
    // bound to the number of cold startups rather than an upper bound.
    let lastCheckSeconds = Services.prefs.getIntPref(
      "browser.startup.lastColdStartupCheck",
      nowSeconds
    );
    Services.prefs.setIntPref(
      "browser.startup.lastColdStartupCheck",
      nowSeconds
    );
    try {
      let secondsSinceLastOSRestart =
        Services.startup.secondsSinceLastOSRestart;
      let isColdStartup =
        nowSeconds - secondsSinceLastOSRestart > lastCheckSeconds;
      Services.telemetry.scalarSet("startup.is_cold", isColdStartup);
    } catch (ex) {
      Cu.reportError(ex);
    }
  },

  // the first browser window has finished initializing
  _onFirstWindowLoaded: function BG__onFirstWindowLoaded(aWindow) {
__L_V__0({
    lN: 1687,tT:'func',pr:'',eT:{'aWindow':aWindow},fN:'BG__onFirstWindowLoaded'
  });'__L_V__0';
    TabCrashHandler.init();

    ProcessHangMonitor.init();

    // A channel for "remote troubleshooting" code...
    let channel = new WebChannel(
      "remote-troubleshooting",
      "remote-troubleshooting"
    );
    channel.listen((id, data, target) => {
      if (data.command == "request") {
__L_V__0({
    lN: 1698,tT:'if',pr:'data.command == request',eT:{},fN:''
  });'__L_V__0';
        let { Troubleshoot } = ChromeUtils.import(
          "resource://gre/modules/Troubleshoot.jsm"
        );
        Troubleshoot.snapshot(snapshotData => {
          // for privacy we remove crash IDs and all preferences (but bug 1091944
          // exists to expose prefs once we are confident of privacy implications)
          delete snapshotData.crashes;
          delete snapshotData.modifiedPreferences;
          channel.send(snapshotData, target);
        });
      }
    });

    this._trackSlowStartup();

    // Offer to reset a user's profile if it hasn't been used for 60 days.
    const OFFER_PROFILE_RESET_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000;
    let lastUse = Services.appinfo.replacedLockTime;
    let disableResetPrompt = Services.prefs.getBoolPref(
      "browser.disableResetPrompt",
      false
    );

    if (
      !disableResetPrompt &&
      lastUse &&
      Date.now() - lastUse >= OFFER_PROFILE_RESET_INTERVAL_MS
    ) {
__L_V__0({
    lN: 1726,tT:'if',pr:' !disableResetPrompt && lastUse && Date.now() - lastUse >= OFFER_PROFILE_RESET_INTERVAL_MS ',eT:{},fN:''
  });'__L_V__0';
      this._resetProfileNotification("unused");
    } else if (AppConstants.platform == "win" && !disableResetPrompt) {
__L_V__0({
    lN: 1728,tT:'if',pr:'AppConstants.platform == win && !disableResetPrompt',eT:{},fN:''
  });'__L_V__0';
      // Check if we were just re-installed and offer Firefox Reset
      let updateChannel;
      try {
        updateChannel = ChromeUtils.import(
          "resource://gre/modules/UpdateUtils.jsm",
          {}
        ).UpdateUtils.UpdateChannel;
      } catch (ex) {}
      if (updateChannel) {
__L_V__0({
    lN: 1737,tT:'if',pr:'updateChannel',eT:{},fN:''
  });'__L_V__0';
        let uninstalledValue = WindowsRegistry.readRegKey(
          Ci.nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
          "Software\\Cliqz",
          `Uninstalled-${updateChannel}`
        );
        let removalSuccessful = WindowsRegistry.removeRegKey(
          Ci.nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
          "Software\\Cliqz",
          `Uninstalled-${updateChannel}`
        );
        if (removalSuccessful && uninstalledValue == "True") {
__L_V__0({
    lN: 1748,tT:'if',pr:'removalSuccessful && uninstalledValue == True',eT:{},fN:''
  });'__L_V__0';
          this._resetProfileNotification("uninstall");
        }
      }
    }

    this._checkForOldBuildUpdates();

    // Check if Sync is configured
    if (Services.prefs.prefHasUserValue("services.sync.username")) {
__L_V__0({
    lN: 1757,tT:'if',pr:'Services.prefs.prefHasUserValue(services.sync.username)',eT:{},fN:''
  });'__L_V__0';
#ifdef MOZ_SERVICES_SYNC
      WeaveService.init();
#endif
    }

    PageThumbs.init();

    NewTabUtils.init();

    AboutPrivateBrowsingHandler.init();

#if 0
    AboutProtectionsHandler.init();
#endif

    PageActions.init();

    this._firstWindowTelemetry(aWindow);
    this._firstWindowLoaded();

    this._collectStartupConditionsTelemetry();

    // Set the default favicon size for UI views that use the page-icon protocol.
    PlacesUtils.favicons.setDefaultIconURIPreferredSize(
      16 * aWindow.devicePixelRatio
    );
    this._setPrefExpectationsAndUpdate();
    this._matchCBCategory();

    // This observes the entire privacy.trackingprotection.* pref tree.
    Services.prefs.addObserver(
      "privacy.trackingprotection",
      this._matchCBCategory
    );
    Services.prefs.addObserver(
      "network.cookie.cookieBehavior",
      this._matchCBCategory
    );
    Services.prefs.addObserver(
      ContentBlockingCategoriesPrefs.PREF_CB_CATEGORY,
      this._updateCBCategory
    );
    Services.prefs.addObserver(
      "media.autoplay.default",
      this._updateAutoplayPref
    );
    Services.prefs.addObserver(
      "privacy.trackingprotection",
      this._setPrefExpectations
    );
    Services.prefs.addObserver(
      "browser.contentblocking.features.strict",
      this._setPrefExpectationsAndUpdate
    );
  },

  _updateAutoplayPref() {
__L_V__0({
    lN: 1814,tT:'func',pr:'',eT:{},fN:'_updateAutoplayPref'
  });'__L_V__0';
    const blocked = Services.prefs.getIntPref("media.autoplay.default", 1);
    const telemetry = Services.telemetry.getHistogramById(
      "AUTOPLAY_DEFAULT_SETTING_CHANGE"
    );
    const labels = { 0: "allow", 1: "blockAudible", 5: "blockAll" };
    if (blocked in labels) {
__L_V__0({
    lN: 1820,tT:'if',pr:'blocked in labels',eT:{},fN:''
  });'__L_V__0';
      telemetry.add(labels[blocked]);
    }
  },

  _setPrefExpectations() {
__L_V__0({
    lN: 1825,tT:'func',pr:'',eT:{},fN:'_setPrefExpectations'
  });'__L_V__0';
    ContentBlockingCategoriesPrefs.setPrefExpectations();
  },

  _setPrefExpectationsAndUpdate() {
__L_V__0({
    lN: 1829,tT:'func',pr:'',eT:{},fN:'_setPrefExpectationsAndUpdate'
  });'__L_V__0';
    ContentBlockingCategoriesPrefs.setPrefExpectations();
    ContentBlockingCategoriesPrefs.updateCBCategory();
  },

  _matchCBCategory() {
__L_V__0({
    lN: 1834,tT:'func',pr:'',eT:{},fN:'_matchCBCategory'
  });'__L_V__0';
    ContentBlockingCategoriesPrefs.matchCBCategory();
  },

  _updateCBCategory() {
__L_V__0({
    lN: 1838,tT:'func',pr:'',eT:{},fN:'_updateCBCategory'
  });'__L_V__0';
    ContentBlockingCategoriesPrefs.updateCBCategory();
  },

  _recordContentBlockingTelemetry() {
__L_V__0({
    lN: 1842,tT:'func',pr:'',eT:{},fN:'_recordContentBlockingTelemetry'
  });'__L_V__0';
    Services.telemetry.setEventRecordingEnabled(
      "security.ui.protectionspopup",
      Services.prefs.getBoolPref(
        "security.protectionspopup.recordEventTelemetry"
      )
    );
    Services.telemetry.setEventRecordingEnabled(
      "security.ui.app_menu",
      Services.prefs.getBoolPref("security.app_menu.recordEventTelemetry")
    );

    let tpEnabled = Services.prefs.getBoolPref(
      "privacy.trackingprotection.enabled"
    );
    Services.telemetry
      .getHistogramById("TRACKING_PROTECTION_ENABLED")
      .add(tpEnabled);

    let tpPBDisabled = Services.prefs.getBoolPref(
      "privacy.trackingprotection.pbmode.enabled"
    );
    Services.telemetry
      .getHistogramById("TRACKING_PROTECTION_PBM_DISABLED")
      .add(!tpPBDisabled);

    let cookieBehavior = Services.prefs.getIntPref(
      "network.cookie.cookieBehavior"
    );
    Services.telemetry.getHistogramById("COOKIE_BEHAVIOR").add(cookieBehavior);

    let fpEnabled = Services.prefs.getBoolPref(
      "privacy.trackingprotection.fingerprinting.enabled"
    );
    let cmEnabled = Services.prefs.getBoolPref(
      "privacy.trackingprotection.cryptomining.enabled"
    );
    let categoryPref;
__L_V__0({
    lN: 1880,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__0';
    switch (
      Services.prefs.getStringPref("browser.contentblocking.category", null)
    ) {
      case "standard":
        categoryPref = 0;
        break;
      case "strict":
        categoryPref = 1;
        break;
      case "custom":
        categoryPref = 2;
        break;
      default:
        // Any other value is unsupported.
        categoryPref = 3;
        break;
    }

    Services.telemetry.scalarSet(
      "contentblocking.fingerprinting_blocking_enabled",
      fpEnabled
    );
    Services.telemetry.scalarSet(
      "contentblocking.cryptomining_blocking_enabled",
      cmEnabled
    );
    Services.telemetry.scalarSet("contentblocking.category", categoryPref);
  },

  _recordDataSanitizationPrefs() {
__L_V__0({
    lN: 1909,tT:'func',pr:'',eT:{},fN:'_recordDataSanitizationPrefs'
  });'__L_V__0';
    Services.telemetry.scalarSet(
      "datasanitization.network_cookie_lifetimePolicy",
      Services.prefs.getIntPref("network.cookie.lifetimePolicy")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_sanitize_sanitizeOnShutdown",
      Services.prefs.getBoolPref("privacy.sanitize.sanitizeOnShutdown")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_cookies",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.cookies")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_history",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.history")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_formdata",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.formdata")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_downloads",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.downloads")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_cache",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.cache")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_sessions",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.sessions")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_offlineApps",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.offlineApps")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_siteSettings",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.siteSettings")
    );
    Services.telemetry.scalarSet(
      "datasanitization.privacy_clearOnShutdown_openWindows",
      Services.prefs.getBoolPref("privacy.clearOnShutdown.openWindows")
    );

    let exceptions = 0;
    for (let permission of Services.perms.all) {
      let uri = permission.principal.URI;
      // We consider just permissions set for http, https and file URLs.
      if (
        permission.type == "cookie" &&
        permission.capability == Ci.nsICookiePermission.ACCESS_SESSION &&
        (uri.scheme == "http" || uri.scheme == "https" || uri.scheme == "file")
      ) {
__L_V__0({
    lN: 1963,tT:'if',pr:' permission.type == cookie && permission.capability == Ci.nsICookiePermission.ACCESS_SESSION && (uri.scheme == http || uri.scheme == https || uri.scheme == file) ',eT:{},fN:''
  });'__L_V__0';
        exceptions++;
      }
    }
    Services.telemetry.scalarSet(
      "datasanitization.session_permission_exceptions",
      exceptions
    );
  },

  _sendMediaTelemetry() {
__L_V__0({
    lN: 1973,tT:'func',pr:'',eT:{},fN:'_sendMediaTelemetry'
  });'__L_V__0';
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    if (win) {
__L_V__0({
    lN: 1975,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__0';
      let v = win.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "video"
      );
      v.reportCanPlayTelemetry();
    }
  },

  /**
   * Application shutdown handler.
   */
  _onQuitApplicationGranted() {
__L_V__0({
    lN: 1987,tT:'func',pr:'',eT:{},fN:'_onQuitApplicationGranted'
  });'__L_V__0';
    // This pref must be set here because SessionStore will use its value
    // on quit-application.
    this._setPrefToSaveSession();

    // Call trackStartupCrashEnd here in case the delayed call on startup hasn't
    // yet occurred (see trackStartupCrashEnd caller in browser.js).
    try {
      Services.startup.trackStartupCrashEnd();
    } catch (e) {
      Cu.reportError(
        "Could not end startup crash tracking in quit-application-granted: " + e
      );
    }

    if (this._bookmarksBackupIdleTime) {
__L_V__0({
    lN: 2002,tT:'if',pr:'this._bookmarksBackupIdleTime',eT:{},fN:''
  });'__L_V__0';
      this._idleService.removeIdleObserver(this, this._bookmarksBackupIdleTime);
      delete this._bookmarksBackupIdleTime;
    }

    for (let mod of Object.values(initializedModules)) {
      if (mod.uninit) {
__L_V__0({
    lN: 2008,tT:'if',pr:'mod.uninit',eT:{},fN:''
  });'__L_V__0';
        mod.uninit();
      }
    }

    BrowserUsageTelemetry.uninit();
    SearchTelemetry.uninit();
    PageThumbs.uninit();
    NewTabUtils.uninit();
    AboutPrivateBrowsingHandler.uninit();
#if 0
    AboutProtectionsHandler.uninit();
#endif

    Normandy.uninit();
    RFPHelper.uninit();
  },

  // Set up a listener to enable/disable the screenshots extension
  // based on its preference.
  _monitorScreenshotsPref() {
__L_V__0({
    lN: 2028,tT:'func',pr:'',eT:{},fN:'_monitorScreenshotsPref'
  });'__L_V__0';
    const PREF = "extensions.screenshots.disabled";
    const ID = "screenshots@mozilla.org";
    const _checkScreenshotsPref = async () => {
      let addon = await AddonManager.getAddonByID(ID);
      let disabled = Services.prefs.getBoolPref(PREF, false);
      if (disabled) {
__L_V__0({
    lN: 2034,tT:'if',pr:'disabled',eT:{},fN:''
  });'__L_V__0';
        await addon.disable({ allowSystemAddons: true });
      } else {
        await addon.enable({ allowSystemAddons: true });
      }
    };
    Services.prefs.addObserver(PREF, _checkScreenshotsPref);
    _checkScreenshotsPref();
  },

  _monitorWebcompatReporterPref() {
__L_V__0({
    lN: 2044,tT:'func',pr:'',eT:{},fN:'_monitorWebcompatReporterPref'
  });'__L_V__0';
    const PREF = "extensions.webcompat-reporter.enabled";
    const ID = "webcompat-reporter@mozilla.org";
    Services.prefs.addObserver(PREF, async () => {
      let addon = await AddonManager.getAddonByID(ID);
      let enabled = Services.prefs.getBoolPref(PREF, false);
      if (enabled && !addon.isActive) {
__L_V__0({
    lN: 2050,tT:'if',pr:'enabled && !addon.isActive',eT:{},fN:''
  });'__L_V__0';
        await addon.enable({ allowSystemAddons: true });
      } else if (!enabled && addon.isActive) {
__L_V__0({
    lN: 2052,tT:'if',pr:'!enabled && addon.isActive',eT:{},fN:''
  });'__L_V__0';
        await addon.disable({ allowSystemAddons: true });
      }
    });
  },
#if 0
  _showNewInstallModal() {
__L_V__0({
    lN: 2058,tT:'func',pr:'',eT:{},fN:'_showNewInstallModal'
  });'__L_V__0';
    // Allow other observers of the same topic to run while we open the dialog.
    Services.tm.dispatchToMainThread(() => {
      let win = BrowserWindowTracker.getTopWindow();

      let stack = win.gBrowser.getPanel().querySelector(".browserStack");
      let mask = win.document.createElementNS(XULNS, "box");
      mask.setAttribute("id", "content-mask");
      stack.appendChild(mask);

      Services.ww.openWindow(
        win,
        "chrome://browser/content/newInstall.xhtml",
        "_blank",
        "chrome,modal,resizable=no,centerscreen",
        null
      );
      mask.remove();
    });
  },
#endif
  // All initial windows have opened.
  _onWindowsRestored: function BG__onWindowsRestored() {
__L_V__0({
    lN: 2080,tT:'func',pr:'',eT:{},fN:'BG__onWindowsRestored'
  });'__L_V__0';
    if (this._windowsWereRestored) {
__L_V__0({
    lN: 2081,tT:'if',pr:'this._windowsWereRestored',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    this._windowsWereRestored = true;

    BrowserUsageTelemetry.init();
    SearchTelemetry.init();

    ExtensionsUI.init();

    let signingRequired;
    if (AppConstants.MOZ_REQUIRE_SIGNING) {
__L_V__0({
    lN: 2092,tT:'if',pr:'AppConstants.MOZ_REQUIRE_SIGNING',eT:{},fN:''
  });'__L_V__0';
      signingRequired = true;
    } else {
      signingRequired = Services.prefs.getBoolPref(
        "xpinstall.signatures.required"
      );
    }

    if (signingRequired) {
__L_V__0({
    lN: 2100,tT:'if',pr:'signingRequired',eT:{},fN:''
  });'__L_V__0';
      let disabledAddons = AddonManager.getStartupChanges(
        AddonManager.STARTUP_CHANGE_DISABLED
      );
      AddonManager.getAddonsByIDs(disabledAddons).then(addons => {
        for (let addon of addons) {
          if (addon.signedState <= AddonManager.SIGNEDSTATE_MISSING) {
__L_V__0({
    lN: 2106,tT:'if',pr:'addon.signedState <= AddonManager.SIGNEDSTATE_MISSING',eT:{},fN:''
  });'__L_V__0';
            this._notifyUnsignedAddonsDisabled();
            break;
          }
        }
      });
    }

    if (AppConstants.MOZ_CRASHREPORTER) {
__L_V__0({
    lN: 2114,tT:'if',pr:'AppConstants.MOZ_CRASHREPORTER',eT:{},fN:''
  });'__L_V__0';
      UnsubmittedCrashHandler.init();
      UnsubmittedCrashHandler.scheduleCheckForUnsubmittedCrashReports();
    }

    if (AppConstants.ASAN_REPORTER) {
__L_V__0({
    lN: 2119,tT:'if',pr:'AppConstants.ASAN_REPORTER',eT:{},fN:''
  });'__L_V__0';
      var { AsanReporter } = ChromeUtils.import(
        "resource:///modules/AsanReporter.jsm"
      );
      AsanReporter.init();
    }

    Sanitizer.onStartup();
    this._scheduleStartupIdleTasks();
    this._lateTasksIdleObserver = (idleService, topic, data) => {
      if (topic == "idle") {
__L_V__0({
    lN: 2129,tT:'if',pr:'topic == idle',eT:{},fN:''
  });'__L_V__0';
        idleService.removeIdleObserver(
          this._lateTasksIdleObserver,
          LATE_TASKS_IDLE_TIME_SEC
        );
        delete this._lateTasksIdleObserver;
        this._scheduleArbitrarilyLateIdleTasks();
      }
    };
    this._idleService.addIdleObserver(
      this._lateTasksIdleObserver,
      LATE_TASKS_IDLE_TIME_SEC
    );

#if 0
    this._monitorScreenshotsPref();
    this._monitorWebcompatReporterPref();

    let pService = Cc["@mozilla.org/toolkit/profile-service;1"].getService(
      Ci.nsIToolkitProfileService
    );
    if (pService.createdAlternateProfile) {
__L_V__0({
    lN: 2150,tT:'if',pr:'pService.createdAlternateProfile',eT:{},fN:''
  });'__L_V__0';
      this._showNewInstallModal();
    }

    FirefoxMonitor.init();
#endif
  },

  /**
   * Use this function as an entry point to schedule tasks that
   * need to run only once after startup, and can be scheduled
   * by using an idle callback.
   *
   * The functions scheduled here will fire from idle callbacks
   * once every window has finished being restored by session
   * restore, and it's guaranteed that they will run before
   * the equivalent per-window idle tasks
   * (from _schedulePerWindowIdleTasks in browser.js).
   *
   * If you have something that can wait even further than the
   * per-window initialization, please schedule them using
   * _scheduleArbitrarilyLateIdleTasks.
   * Don't be fooled by thinking that the use of the timeout parameter
   * will delay your function: it will just ensure that it potentially
   * happens _earlier_ than expected (when the timeout limit has been reached),
   * but it will not make it happen later (and out of order) compared
   * to the other ones scheduled together.
   */
  _scheduleStartupIdleTasks() {
__L_V__0({
    lN: 2178,tT:'func',pr:'',eT:{},fN:'_scheduleStartupIdleTasks'
  });'__L_V__0';
    const idleTasks = [
      // It's important that SafeBrowsing is initialized reasonably
      // early, so we use a maximum timeout for it.
      {
        task: () => {
          SafeBrowsing.init();
        },
        timeout: 5000,
      },

      {
        task: async () => {
          await ContextualIdentityService.load();
#if 0
          Discovery.update();
#endif
        },
      },

#if 0
      // Begin listening for incoming push messages.
      {
        task: () => {
          try {
            PushService.wrappedJSObject.ensureReady();
          } catch (ex) {
            // NS_ERROR_NOT_AVAILABLE will get thrown for the PushService
            // getter if the PushService is disabled.
            if (ex.result != Cr.NS_ERROR_NOT_AVAILABLE) {
__L_V__0({
    lN: 2207,tT:'if',pr:'ex.result != Cr.NS_ERROR_NOT_AVAILABLE',eT:{},fN:''
  });'__L_V__0';
              throw ex;
            }
          }
        },
      },

      {
        task: () => {
          this._recordContentBlockingTelemetry();
        },
      },
#endif

      {
        task: () => {
          this._recordDataSanitizationPrefs();
        },
      },

      {
        task: () => {
          let siteSpecific = Services.prefs.getBoolPref(
            "browser.zoom.siteSpecific",
            false
          );
          Services.telemetry.scalarSet("a11y.sitezoom", siteSpecific);
        },
      },

      // Load the Login Manager data from disk off the main thread, some time
      // after startup.  If the data is required before this runs, for example
      // because a restored page contains a password field, it will be loaded on
      // the main thread, and this initialization request will be ignored.
      {
        task: () => {
          try {
            Services.logins;
          } catch (ex) {
            Cu.reportError(ex);
          }
        },
        timeout: 3000,
      },

      // Add breach alerts pref observer reasonably early so the pref flip works
      {
        task: () => {
          this._addBreachAlertsPrefObserver();
        },
      },

      {
        condition: AppConstants.platform == "win",
        task: () => {
          // For Windows 7, initialize the jump list module.
          const WINTASKBAR_CONTRACTID = "@mozilla.org/windows-taskbar;1";
          if (
            WINTASKBAR_CONTRACTID in Cc &&
            Cc[WINTASKBAR_CONTRACTID].getService(Ci.nsIWinTaskbar).available
          ) {
__L_V__0({
    lN: 2267,tT:'if',pr:' WINTASKBAR_CONTRACTID in Cc && Cc[WINTASKBAR_CONTRACTID].getService(Ci.nsIWinTaskbar).available ',eT:{},fN:''
  });'__L_V__0';
            let temp = {};
            ChromeUtils.import(
              "resource:///modules/WindowsJumpLists.jsm",
              temp
            );
            temp.WinTaskbarJumpList.startup();
          }
        },
      },

      {
        task: () => {
          this._maybeShowDefaultBrowserPrompt();
        },
      },

      {
        task: () => {
          let { setTimeout } = ChromeUtils.import(
            "resource://gre/modules/Timer.jsm"
          );
          setTimeout(function() {
            Services.tm.idleDispatchToMainThread(
              Services.startup.trackStartupCrashEnd
            );
          }, STARTUP_CRASHES_END_DELAY_MS);
        },
      },

      {
        task: () => {
          let handlerService = Cc[
            "@mozilla.org/uriloader/handler-service;1"
          ].getService(Ci.nsIHandlerService);
          handlerService.asyncInit();
        },
      },

      {
        condition: AppConstants.platform == "win",
        task: () => {
          JawsScreenReaderVersionCheck.onWindowsRestored();
        },
      },

      {
        task: () => {
          RFPHelper.init();
        },
      },

      {
        task: () => {
          Blocklist.loadBlocklistAsync();
        },
      },

      {
        condition:
          Services.prefs.getIntPref(
            "browser.livebookmarks.migrationAttemptsLeft",
            0
          ) > 0,
        task: () => {
          LiveBookmarkMigrator.migrate().catch(Cu.reportError);
        },
      },

      {
        task: () => {
          TabUnloader.init();
        },
      },

      {
        condition: Services.prefs.getBoolPref("corroborator.enabled", false),
        task: () => {
          Corroborate.init().catch(Cu.reportError);
        },
      },

      // request startup of Chromium remote debugging protocol
      // (observer will only be notified when --remote-debugger is passed)
      {
        condition: AppConstants.ENABLE_REMOTE_AGENT,
        task: () => {
          Services.obs.notifyObservers(null, "remote-startup-requested");
        },
      },

#if 0
      // Marionette needs to be initialized as very last step
      {
        task: () => {
          Services.obs.notifyObservers(null, "marionette-startup-requested");
        },
      },
#endif

      // Run TRR performance measurements for DoH.
      {
        task: () => {
          if (
            Services.prefs.getBoolPref("doh-rollout.trrRace.enabled", false)
          ) {
__L_V__0({
    lN: 2372,tT:'if',pr:' Services.prefs.getBoolPref(doh-rollout.trrRace.enabled, false) ',eT:{},fN:''
  });'__L_V__0';
            if (
              !Services.prefs.getBoolPref("doh-rollout.trrRace.complete", false)
            ) {
__L_V__0({
    lN: 2375,tT:'if',pr:' !Services.prefs.getBoolPref(doh-rollout.trrRace.complete, false) ',eT:{},fN:''
  });'__L_V__0';
              new TRRRacer().run();
            }
          } else {
            Services.prefs.addObserver(
              "doh-rollout.trrRace.enabled",
              function observer() {
__L_V__0({
    lN: 2381,tT:'func',pr:'',eT:{},fN:'observer'
  });'__L_V__0';
                if (
                  Services.prefs.getBoolPref(
                    "doh-rollout.trrRace.enabled",
                    false
                  )
                ) {
__L_V__0({
    lN: 2387,tT:'if',pr:' Services.prefs.getBoolPref( doh-rollout.trrRace.enabled, false ) ',eT:{},fN:''
  });'__L_V__0';
                  Services.prefs.removeObserver(
                    "doh-rollout.trrRace.enabled",
                    observer
                  );
                  if (
                    !Services.prefs.getBoolPref(
                      "doh-rollout.trrRace.complete",
                      false
                    )
                  ) {
__L_V__0({
    lN: 2397,tT:'if',pr:' !Services.prefs.getBoolPref( doh-rollout.trrRace.complete, false ) ',eT:{},fN:''
  });'__L_V__0';
                    new TRRRacer().run();
                  }
                }
              }
            );
          }
        },
      },
    ];

    for (let task of idleTasks) {
      if ("condition" in task && !task.condition) {
__L_V__0({
    lN: 2409,tT:'if',pr:'condition in task && !task.condition',eT:{},fN:''
  });'__L_V__0';
        continue;
      }

      ChromeUtils.idleDispatch(
        () => {
          if (!Services.startup.shuttingDown) {
__L_V__0({
    lN: 2415,tT:'if',pr:'!Services.startup.shuttingDown',eT:{},fN:''
  });'__L_V__0';
            Services.profiler.AddMarker("startupIdleTask");
            try {
              task.task();
            } catch (ex) {
              Cu.reportError(ex);
            }
          }
        },
        task.timeout ? { timeout: task.timeout } : undefined
      );
    }
  },

  /**
   * Use this function as an entry point to schedule tasks that need
   * to run once per session, at any arbitrary point in time.
   * This function will be called from an idle observer. Check the value of
   * LATE_TASKS_IDLE_TIME_SEC to see the current value for this idle
   * observer.
   *
   * Note: this function may never be called if the user is never idle for the
   * full length of the period of time specified. But given a reasonably low
   * value, this is unlikely.
   */
  _scheduleArbitrarilyLateIdleTasks() {
__L_V__0({
    lN: 2440,tT:'func',pr:'',eT:{},fN:'_scheduleArbitrarilyLateIdleTasks'
  });'__L_V__0';
    const idleTasks = [
      () => {
        this._sendMediaTelemetry();
      },

      () => {
        // Telemetry for master-password - we do this after a delay as it
        // can cause IO if NSS/PSM has not already initialized.
        let tokenDB = Cc["@mozilla.org/security/pk11tokendb;1"].getService(
          Ci.nsIPK11TokenDB
        );
        let token = tokenDB.getInternalKeyToken();
        let mpEnabled = token.hasPassword;
        if (mpEnabled) {
__L_V__0({
    lN: 2454,tT:'if',pr:'mpEnabled',eT:{},fN:''
  });'__L_V__0';
          Services.telemetry
            .getHistogramById("MASTER_PASSWORD_ENABLED")
            .add(mpEnabled);
        }
      },

      () => {
        let obj = {};
        ChromeUtils.import("resource://gre/modules/GMPInstallManager.jsm", obj);
        this._gmpInstallManager = new obj.GMPInstallManager();
        // We don't really care about the results, if someone is interested they
        // can check the log.
        this._gmpInstallManager.simpleCheckAndInstall().catch(() => {});
      },

      () => {
        RemoteSettings.init();
        this._addBreachesSyncHandler();
      },

      () => {
        PublicSuffixList.init();
      },

      () => {
        RemoteSecuritySettings.init();
      },
    ];

    for (let task of idleTasks) {
      ChromeUtils.idleDispatch(() => {
        if (!Services.startup.shuttingDown) {
__L_V__0({
    lN: 2486,tT:'if',pr:'!Services.startup.shuttingDown',eT:{},fN:''
  });'__L_V__0';
          Services.profiler.AddMarker("startupLateIdleTask");
          try {
            task();
          } catch (ex) {
            Cu.reportError(ex);
          }
        }
      });
    }
  },

  _addBreachesSyncHandler() {
__L_V__0({
    lN: 2498,tT:'func',pr:'',eT:{},fN:'_addBreachesSyncHandler'
  });'__L_V__0';
    if (
      Services.prefs.getBoolPref(
        "signon.management.page.breach-alerts.enabled",
        false
      )
    ) {
__L_V__0({
    lN: 2504,tT:'if',pr:' Services.prefs.getBoolPref( signon.management.page.breach-alerts.enabled, false ) ',eT:{},fN:''
  });'__L_V__0';
      RemoteSettings(LoginBreaches.REMOTE_SETTINGS_COLLECTION).on(
        "sync",
        async event => {
          await LoginBreaches.update(event.data.current);
        }
      );
    }
  },

  _addBreachAlertsPrefObserver() {
__L_V__0({
    lN: 2514,tT:'func',pr:'',eT:{},fN:'_addBreachAlertsPrefObserver'
  });'__L_V__0';
    const BREACH_ALERTS_PREF = "signon.management.page.breach-alerts.enabled";
    const clearVulnerablePasswordsIfBreachAlertsDisabled = async function() {
__L_V__0({
    lN: 2516,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
      if (!Services.prefs.getBoolPref(BREACH_ALERTS_PREF)) {
__L_V__0({
    lN: 2517,tT:'if',pr:'!Services.prefs.getBoolPref(BREACH_ALERTS_PREF)',eT:{},fN:''
  });'__L_V__0';
        await LoginBreaches.clearAllPotentiallyVulnerablePasswords();
      }
    };
    clearVulnerablePasswordsIfBreachAlertsDisabled();
    Services.prefs.addObserver(
      BREACH_ALERTS_PREF,
      clearVulnerablePasswordsIfBreachAlertsDisabled
    );
  },

  _onQuitRequest: function BG__onQuitRequest(aCancelQuit, aQuitType) {
__L_V__0({
    lN: 2528,tT:'func',pr:'',eT:{'aCancelQuit':aCancelQuit,'aQuitType':aQuitType},fN:'BG__onQuitRequest'
  });'__L_V__0';
    // If user has already dismissed quit request, then do nothing
    if (aCancelQuit instanceof Ci.nsISupportsPRBool && aCancelQuit.data) {
__L_V__0({
    lN: 2530,tT:'if',pr:'aCancelQuit instanceof Ci.nsISupportsPRBool && aCancelQuit.data',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    // There are several cases where we won't show a dialog here:
    // 1. There is only 1 tab open in 1 window
    // 2. browser.warnOnQuit == false
    // 3. The browser is currently in Private Browsing mode
    // 4. The browser will be restarted.
    // 5. The user has automatic session restore enabled and
    //    browser.sessionstore.warnOnQuit is not set to true.
    // 6. The user doesn't have automatic session restore enabled
    //    and browser.tabs.warnOnClose is not set to true.
    //
    // Otherwise, we will show the "closing multiple tabs" dialog.
    //
    // aQuitType == "lastwindow" is overloaded. "lastwindow" is used to indicate
    // "the last window is closing but we're not quitting (a non-browser window is open)"
    // and also "we're quitting by closing the last window".

    if (aQuitType == "restart" || aQuitType == "os-restart") {
__L_V__0({
    lN: 2550,tT:'if',pr:'aQuitType == restart || aQuitType == os-restart',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    var windowcount = 0;
    var pagecount = 0;
    for (let win of BrowserWindowTracker.orderedWindows) {
      if (win.closed) {
__L_V__0({
    lN: 2557,tT:'if',pr:'win.closed',eT:{},fN:''
  });'__L_V__0';
        continue;
      }
      windowcount++;
      let tabbrowser = win.gBrowser;
      if (tabbrowser) {
__L_V__0({
    lN: 2562,tT:'if',pr:'tabbrowser',eT:{},fN:''
  });'__L_V__0';
        pagecount +=
          tabbrowser.browsers.length -
          tabbrowser._numPinnedTabs -
          tabbrowser._removingTabs.length;
      }
    }

    if (pagecount < 2) {
__L_V__0({
    lN: 2570,tT:'if',pr:'pagecount < 2',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    if (!aQuitType) {
__L_V__0({
    lN: 2574,tT:'if',pr:'!aQuitType',eT:{},fN:''
  });'__L_V__0';
      aQuitType = "quit";
    }

    // browser.warnOnQuit is a hidden global boolean to override all quit prompts
    if (!Services.prefs.getBoolPref("browser.warnOnQuit")) {
__L_V__0({
    lN: 2579,tT:'if',pr:'!Services.prefs.getBoolPref(browser.warnOnQuit)',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    // If we're going to automatically restore the session, only warn if the user asked for that.
    let sessionWillBeRestored =
      Services.prefs.getBoolPref("browser.startup.restoreTabs") ||
      Services.prefs.getBoolPref("browser.sessionstore.resume_session_once");
    // In the sessionWillBeRestored case, we only check the sessionstore-specific pref:
    if (sessionWillBeRestored) {
__L_V__0({
    lN: 2588,tT:'if',pr:'sessionWillBeRestored',eT:{},fN:''
  });'__L_V__0';
      if (
        !Services.prefs.getBoolPref("browser.sessionstore.warnOnQuit", false)
      ) {
__L_V__0({
    lN: 2591,tT:'if',pr:' !Services.prefs.getBoolPref(browser.sessionstore.warnOnQuit, false) ',eT:{},fN:''
  });'__L_V__0';
        return;
      }
      // Otherwise, we check browser.tabs.warnOnClose
    } else if (!Services.prefs.getBoolPref("browser.tabs.warnOnClose")) {
__L_V__0({
    lN: 2595,tT:'if',pr:'!Services.prefs.getBoolPref(browser.tabs.warnOnClose)',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    let win = BrowserWindowTracker.getTopWindow();

    let warningMessage;
    // More than 1 window. Compose our own message.
    if (windowcount > 1) {
__L_V__0({
    lN: 2603,tT:'if',pr:'windowcount > 1',eT:{},fN:''
  });'__L_V__0';
      let tabSubstring = gTabbrowserBundle.GetStringFromName(
        "tabs.closeWarningMultipleWindowsTabSnippet"
      );
      tabSubstring = PluralForm.get(pagecount, tabSubstring).replace(
        /#1/,
        pagecount
      );

      let stringID = sessionWillBeRestored
        ? "tabs.closeWarningMultipleWindowsSessionRestore2"
        : "tabs.closeWarningMultipleWindows";
      let windowString = gTabbrowserBundle.GetStringFromName(stringID);
      windowString = PluralForm.get(windowcount, windowString).replace(
        /#1/,
        windowcount
      );
      warningMessage = windowString.replace(/%(?:1\$)?S/i, tabSubstring);
    } else {
      let stringID = sessionWillBeRestored
        ? "tabs.closeWarningMultipleSessionRestore2"
        : "tabs.closeWarningMultiple";
      warningMessage = gTabbrowserBundle.GetStringFromName(stringID);
      warningMessage = PluralForm.get(pagecount, warningMessage).replace(
        "#1",
        pagecount
      );
    }

    let warnOnClose = { value: true };
    let titleId =
      AppConstants.platform == "win"
        ? "tabs.closeAndQuitTitleTabsWin"
        : "tabs.closeAndQuitTitleTabs";
    let flags =
      Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0 +
      Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1;
    // Only display the checkbox in the non-sessionrestore case.
    let checkboxLabel = !sessionWillBeRestored
      ? gTabbrowserBundle.GetStringFromName("tabs.closeWarningPromptMe")
      : null;

    // buttonPressed will be 0 for closing, 1 for cancel (don't close/quit)
    let buttonPressed = Services.prompt.confirmEx(
      win,
      gTabbrowserBundle.GetStringFromName(titleId),
      warningMessage,
      flags,
      gTabbrowserBundle.GetStringFromName("tabs.closeButtonMultiple"),
      null,
      null,
      checkboxLabel,
      warnOnClose
    );
    // If the user has unticked the box, and has confirmed closing, stop showing
    // the warning.
    if (!sessionWillBeRestored && buttonPressed == 0 && !warnOnClose.value) {
__L_V__0({
    lN: 2659,tT:'if',pr:'!sessionWillBeRestored && buttonPressed == 0 && !warnOnClose.value',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.setBoolPref("browser.tabs.warnOnClose", false);
    }
    aCancelQuit.data = buttonPressed != 0;
  },

  /**
   * Initialize Places
   * - imports the bookmarks html file if bookmarks database is empty, try to
   *   restore bookmarks from a JSON backup if the backend indicates that the
   *   database was corrupt.
   *
   * These prefs can be set up by the frontend:
   *
   * WARNING: setting these preferences to true will overwite existing bookmarks
   *
   * - browser.places.importBookmarksHTML
   *   Set to true will import the bookmarks.html file from the profile folder.
   * - browser.bookmarks.restore_default_bookmarks
   *   Set to true by safe-mode dialog to indicate we must restore default
   *   bookmarks.
   */
  _initPlaces: function BG__initPlaces(aInitialMigrationPerformed) {
__L_V__0({
    lN: 2681,tT:'func',pr:'',eT:{'aInitialMigrationPerformed':aInitialMigrationPerformed},fN:'BG__initPlaces'
  });'__L_V__0';
    // We must instantiate the history service since it will tell us if we
    // need to import or restore bookmarks due to first-run, corruption or
    // forced migration (due to a major schema change).
    // If the database is corrupt or has been newly created we should
    // import bookmarks.
    let dbStatus = PlacesUtils.history.databaseStatus;

    // Show a notification with a "more info" link for a locked places.sqlite.
    if (dbStatus == PlacesUtils.history.DATABASE_STATUS_LOCKED) {
__L_V__0({
    lN: 2690,tT:'if',pr:'dbStatus == PlacesUtils.history.DATABASE_STATUS_LOCKED',eT:{},fN:''
  });'__L_V__0';
      // Note: initPlaces should always happen when the first window is ready,
      // in any case, better safe than sorry.
      this._firstWindowReady.then(() => {
        this._showPlacesLockedNotificationBox();
        this._placesBrowserInitComplete = true;
        Services.obs.notifyObservers(null, "places-browser-init-complete");
      });
      return;
    }

    let importBookmarks =
      !aInitialMigrationPerformed &&
      (dbStatus == PlacesUtils.history.DATABASE_STATUS_CREATE ||
        dbStatus == PlacesUtils.history.DATABASE_STATUS_CORRUPT);

    // Check if user or an extension has required to import bookmarks.html
    let importBookmarksHTML = false;
    try {
      importBookmarksHTML = Services.prefs.getBoolPref(
        "browser.places.importBookmarksHTML"
      );
      if (importBookmarksHTML) {
__L_V__0({
    lN: 2712,tT:'if',pr:'importBookmarksHTML',eT:{},fN:''
  });'__L_V__0';
        importBookmarks = true;
      }
    } catch (ex) {}

    // Support legacy bookmarks.html format for apps that depend on that format.
    let autoExportHTML = Services.prefs.getBoolPref(
      "browser.bookmarks.autoExportHTML",
      false
    ); // Do not export.
    if (autoExportHTML) {
__L_V__0({
    lN: 2722,tT:'if',pr:'autoExportHTML',eT:{},fN:''
  });'__L_V__0';
      // Sqlite.jsm and Places shutdown happen at profile-before-change, thus,
      // to be on the safe side, this should run earlier.
      AsyncShutdown.profileChangeTeardown.addBlocker(
        "Places: export bookmarks.html",
        () => BookmarkHTMLUtils.exportToFile(BookmarkHTMLUtils.defaultPath)
      );
    }

    (async () => {
      // Check if Safe Mode or the user has required to restore bookmarks from
      // default profile's bookmarks.html
      let restoreDefaultBookmarks = false;
      try {
        restoreDefaultBookmarks = Services.prefs.getBoolPref(
          "browser.bookmarks.restore_default_bookmarks"
        );
        if (restoreDefaultBookmarks) {
__L_V__0({
    lN: 2739,tT:'if',pr:'restoreDefaultBookmarks',eT:{},fN:''
  });'__L_V__0';
          // Ensure that we already have a bookmarks backup for today.
          await this._backupBookmarks();
          importBookmarks = true;
        }
      } catch (ex) {}

      // This may be reused later, check for "=== undefined" to see if it has
      // been populated already.
      let lastBackupFile;

      // If the user did not require to restore default bookmarks, or import
      // from bookmarks.html, we will try to restore from JSON
      if (importBookmarks && !restoreDefaultBookmarks && !importBookmarksHTML) {
__L_V__0({
    lN: 2752,tT:'if',pr:'importBookmarks && !restoreDefaultBookmarks && !importBookmarksHTML',eT:{},fN:''
  });'__L_V__0';
        // get latest JSON backup
        lastBackupFile = await PlacesBackups.getMostRecentBackup();
        if (lastBackupFile) {
__L_V__0({
    lN: 2755,tT:'if',pr:'lastBackupFile',eT:{},fN:''
  });'__L_V__0';
          // restore from JSON backup
          await BookmarkJSONUtils.importFromFile(lastBackupFile, {
            replace: true,
            source: PlacesUtils.bookmarks.SOURCES.RESTORE_ON_STARTUP,
          });
          importBookmarks = false;
        } else {
          // We have created a new database but we don't have any backup available
          importBookmarks = true;
          if (await OS.File.exists(BookmarkHTMLUtils.defaultPath)) {
__L_V__0({
    lN: 2765,tT:'if',pr:'await OS.File.exists(BookmarkHTMLUtils.defaultPath)',eT:{},fN:''
  });'__L_V__0';
            // If bookmarks.html is available in current profile import it...
            importBookmarksHTML = true;
          } else {
            // ...otherwise we will restore defaults
            restoreDefaultBookmarks = true;
          }
        }
      }

      // Import default bookmarks when necessary.
      // Otherwise, if any kind of import runs, default bookmarks creation should be
      // delayed till the import operations has finished.  Not doing so would
      // cause them to be overwritten by the newly imported bookmarks.
      if (!importBookmarks) {
__L_V__0({
    lN: 2779,tT:'if',pr:'!importBookmarks',eT:{},fN:''
  });'__L_V__0';
        // Now apply distribution customized bookmarks.
        // This should always run after Places initialization.
        try {
          await this._distributionCustomizer.applyBookmarks();
        } catch (e) {
          Cu.reportError(e);
        }
      } else {
        // An import operation is about to run.
        let bookmarksUrl = null;
        if (restoreDefaultBookmarks) {
__L_V__0({
    lN: 2790,tT:'if',pr:'restoreDefaultBookmarks',eT:{},fN:''
  });'__L_V__0';
          // User wants to restore bookmarks.html file from default profile folder
          bookmarksUrl = "chrome://browser/locale/bookmarks.html";
        } else if (await OS.File.exists(BookmarkHTMLUtils.defaultPath)) {
__L_V__0({
    lN: 2793,tT:'if',pr:'await OS.File.exists(BookmarkHTMLUtils.defaultPath)',eT:{},fN:''
  });'__L_V__0';
          bookmarksUrl = OS.Path.toFileURI(BookmarkHTMLUtils.defaultPath);
        }

        if (bookmarksUrl) {
__L_V__0({
    lN: 2797,tT:'if',pr:'bookmarksUrl',eT:{},fN:''
  });'__L_V__0';
          // Import from bookmarks.html file.
          try {
            if (Services.policies.isAllowed("defaultBookmarks")) {
__L_V__0({
    lN: 2800,tT:'if',pr:'Services.policies.isAllowed(defaultBookmarks)',eT:{},fN:''
  });'__L_V__0';
              await BookmarkHTMLUtils.importFromURL(bookmarksUrl, {
                replace: true,
                source: PlacesUtils.bookmarks.SOURCES.RESTORE_ON_STARTUP,
              });
            }
          } catch (e) {
            Cu.reportError("Bookmarks.html file could be corrupt. " + e);
          }
          try {
            // Now apply distribution customized bookmarks.
            // This should always run after Places initialization.
            await this._distributionCustomizer.applyBookmarks();
          } catch (e) {
            Cu.reportError(e);
          }
        } else {
          Cu.reportError(new Error("Unable to find bookmarks.html file."));
        }

        // Reset preferences, so we won't try to import again at next run
        if (importBookmarksHTML) {
__L_V__0({
    lN: 2821,tT:'if',pr:'importBookmarksHTML',eT:{},fN:''
  });'__L_V__0';
          Services.prefs.setBoolPref(
            "browser.places.importBookmarksHTML",
            false
          );
        }
        if (restoreDefaultBookmarks) {
__L_V__0({
    lN: 2827,tT:'if',pr:'restoreDefaultBookmarks',eT:{},fN:''
  });'__L_V__0';
          Services.prefs.setBoolPref(
            "browser.bookmarks.restore_default_bookmarks",
            false
          );
        }
      }

      // Initialize bookmark archiving on idle.
      if (!this._bookmarksBackupIdleTime) {
__L_V__0({
    lN: 2836,tT:'if',pr:'!this._bookmarksBackupIdleTime',eT:{},fN:''
  });'__L_V__0';
        this._bookmarksBackupIdleTime = BOOKMARKS_BACKUP_IDLE_TIME_SEC;

        // If there is no backup, or the last bookmarks backup is too old, use
        // a more aggressive idle observer.
        if (lastBackupFile === undefined) {
__L_V__0({
    lN: 2841,tT:'if',pr:'lastBackupFile === undefined',eT:{},fN:''
  });'__L_V__0';
          lastBackupFile = await PlacesBackups.getMostRecentBackup();
        }
        if (!lastBackupFile) {
__L_V__0({
    lN: 2844,tT:'if',pr:'!lastBackupFile',eT:{},fN:''
  });'__L_V__0';
          this._bookmarksBackupIdleTime /= 2;
        } else {
          let lastBackupTime = PlacesBackups.getDateForFile(lastBackupFile);
          let profileLastUse = Services.appinfo.replacedLockTime || Date.now();

          // If there is a backup after the last profile usage date it's fine,
          // regardless its age.  Otherwise check how old is the last
          // available backup compared to that session.
          if (profileLastUse > lastBackupTime) {
__L_V__0({
    lN: 2853,tT:'if',pr:'profileLastUse > lastBackupTime',eT:{},fN:''
  });'__L_V__0';
            let backupAge = Math.round(
              (profileLastUse - lastBackupTime) / 86400000
            );
            // Report the age of the last available backup.
            try {
              Services.telemetry
                .getHistogramById("PLACES_BACKUPS_DAYSFROMLAST")
                .add(backupAge);
            } catch (ex) {
              Cu.reportError(new Error("Unable to report telemetry."));
            }

            if (backupAge > BOOKMARKS_BACKUP_MAX_INTERVAL_DAYS) {
__L_V__0({
    lN: 2866,tT:'if',pr:'backupAge > BOOKMARKS_BACKUP_MAX_INTERVAL_DAYS',eT:{},fN:''
  });'__L_V__0';
              this._bookmarksBackupIdleTime /= 2;
            }
          }
        }
        this._idleService.addIdleObserver(this, this._bookmarksBackupIdleTime);
      }

      if (this._isNewProfile) {
__L_V__0({
    lN: 2874,tT:'if',pr:'this._isNewProfile',eT:{},fN:''
  });'__L_V__0';
        try {
          // New profiles may have existing bookmarks (imported from another browser or
          // copied into the profile) and we want to show the bookmark toolbar for them
          // in some cases.
          this._maybeToggleBookmarkToolbarVisibility();
        } catch (ex) {
          Cu.reportError(ex);
        }
      }
    })()
      .catch(ex => {
        Cu.reportError(ex);
      })
      .then(() => {
        // NB: deliberately after the catch so that we always do this, even if
        // we threw halfway through initializing in the Task above.
        this._placesBrowserInitComplete = true;
        Services.obs.notifyObservers(null, "places-browser-init-complete");
      });
  },

  /**
   * If a backup for today doesn't exist, this creates one.
   */
  _backupBookmarks: function BG__backupBookmarks() {
__L_V__0({
    lN: 2899,tT:'func',pr:'',eT:{},fN:'BG__backupBookmarks'
  });'__L_V__0';
    return (async function() {
__L_V__0({
    lN: 2900,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__0';
      let lastBackupFile = await PlacesBackups.getMostRecentBackup();
      // Should backup bookmarks if there are no backups or the maximum
      // interval between backups elapsed.
      if (
        !lastBackupFile ||
        new Date() - PlacesBackups.getDateForFile(lastBackupFile) >
          BOOKMARKS_BACKUP_MIN_INTERVAL_DAYS * 86400000
      ) {
__L_V__0({
    lN: 2908,tT:'if',pr:' !lastBackupFile || new Date() - PlacesBackups.getDateForFile(lastBackupFile) > BOOKMARKS_BACKUP_MIN_INTERVAL_DAYS * 86400000 ',eT:{},fN:''
  });'__L_V__0';
        let maxBackups = Services.prefs.getIntPref(
          "browser.bookmarks.max_backups"
        );
        await PlacesBackups.create(maxBackups);
      }
    })();
  },

  /**
   * Show the notificationBox for a locked places database.
   */
  _showPlacesLockedNotificationBox: function BG__showPlacesLockedNotificationBox() {
__L_V__0({
    lN: 2920,tT:'func',pr:'',eT:{},fN:'BG__showPlacesLockedNotificationBox'
  });'__L_V__0';
    var applicationName = gBrandBundle.GetStringFromName("brandShortName");
    var placesBundle = Services.strings.createBundle(
      "chrome://browser/locale/places/places.properties"
    );
    var title = placesBundle.GetStringFromName("lockPrompt.title");
    var text = placesBundle.formatStringFromName("lockPrompt.text", [
      applicationName,
    ]);
    var buttonText = placesBundle.GetStringFromName(
      "lockPromptInfoButton.label"
    );
    var accessKey = placesBundle.GetStringFromName(
      "lockPromptInfoButton.accessKey"
    );

    var helpTopic = "places-locked";
    var url = Services.urlFormatter.formatURLPref("app.support.baseURL");
    url += helpTopic;

    var win = BrowserWindowTracker.getTopWindow();

    var buttons = [
      {
        label: buttonText,
        accessKey,
        popup: null,
        callback(aNotificationBar, aButton) {
__L_V__0({
    lN: 2947,tT:'func',pr:'',eT:{'aNotificationBar':aNotificationBar,'aButton':aButton},fN:'callback'
  });'__L_V__0';
          win.openTrustedLinkIn(url, "tab");
        },
      },
    ];

    var notifyBox = win.gBrowser.getNotificationBox();
    var notification = notifyBox.appendNotification(
      text,
      title,
      null,
      notifyBox.PRIORITY_CRITICAL_MEDIUM,
      buttons
    );
    notification.persistence = -1; // Until user closes it
  },

  _onThisDeviceConnected() {
__L_V__0({
    lN: 2964,tT:'func',pr:'',eT:{},fN:'_onThisDeviceConnected'
  });'__L_V__0';
    let bundle = Services.strings.createBundle(
      "chrome://browser/locale/accounts.properties"
    );
    let title = bundle.GetStringFromName("deviceConnDisconnTitle");
    let body = bundle.GetStringFromName("thisDeviceConnectedBody");

    let clickCallback = (subject, topic, data) => {
      if (topic != "alertclickcallback") {
__L_V__0({
    lN: 2972,tT:'if',pr:'topic != alertclickcallback',eT:{},fN:''
  });'__L_V__0';
        return;
      }
      this._openPreferences("sync");
    };
    this.AlertsService.showAlertNotification(
      null,
      title,
      body,
      true,
      null,
      clickCallback
    );
  },

  /**
   * Uncollapses PersonalToolbar if its collapsed status is not
   * persisted, and user customized it or changed default bookmarks.
   *
   * If the user does not have a persisted value for the toolbar's
   * "collapsed" attribute, try to determine whether it's customized.
   */
  _maybeToggleBookmarkToolbarVisibility() {
__L_V__0({
    lN: 2994,tT:'func',pr:'',eT:{},fN:'_maybeToggleBookmarkToolbarVisibility'
  });'__L_V__0';
    const BROWSER_DOCURL = AppConstants.BROWSER_CHROME_URL;
    const NUM_TOOLBAR_BOOKMARKS_TO_UNHIDE = 3;
    let xulStore = Services.xulStore;

    if (!xulStore.hasValue(BROWSER_DOCURL, "PersonalToolbar", "collapsed")) {
__L_V__0({
    lN: 2999,tT:'if',pr:'!xulStore.hasValue(BROWSER_DOCURL, PersonalToolbar, collapsed)',eT:{},fN:''
  });'__L_V__0';
      // We consider the toolbar customized if it has more than NUM_TOOLBAR_BOOKMARKS_TO_UNHIDE
      // children, or if it has a persisted currentset value.
      let toolbarIsCustomized = xulStore.hasValue(
        BROWSER_DOCURL,
        "PersonalToolbar",
        "currentset"
      );
      let getToolbarFolderCount = () => {
        let toolbarFolder = PlacesUtils.getFolderContents(
          PlacesUtils.bookmarks.toolbarGuid
        ).root;
        let toolbarChildCount = toolbarFolder.childCount;
        toolbarFolder.containerOpen = false;
        return toolbarChildCount;
      };

      if (
        toolbarIsCustomized ||
        getToolbarFolderCount() > NUM_TOOLBAR_BOOKMARKS_TO_UNHIDE
      ) {
__L_V__0({
    lN: 3019,tT:'if',pr:' toolbarIsCustomized || getToolbarFolderCount() > NUM_TOOLBAR_BOOKMARKS_TO_UNHIDE ',eT:{},fN:''
  });'__L_V__0';
        CustomizableUI.setToolbarVisibility(
          CustomizableUI.AREA_BOOKMARKS,
          true
        );
      }
    }
  },

  _migrateXULStoreForDocument(fromURL, toURL) {
__L_V__0({
    lN: 3028,tT:'func',pr:'',eT:{'fromURL':fromURL,'toURL':toURL},fN:'_migrateXULStoreForDocument'
  });'__L_V__0';
    Array.from(Services.xulStore.getIDsEnumerator(fromURL)).forEach(id => {
      Array.from(Services.xulStore.getAttributeEnumerator(fromURL, id)).forEach(
        attr => {
          let value = Services.xulStore.getValue(fromURL, id, attr);
          Services.xulStore.setValue(toURL, id, attr, value);
        }
      );
    });
  },

  // eslint-disable-next-line complexity
  _migrateUI: function BG__migrateUI() {
__L_V__0({
    lN: 3040,tT:'func',pr:'',eT:{},fN:'BG__migrateUI'
  });'__L_V__0';
    // Use an increasing number to keep track of the current migration state.
    // Completely unrelated to the current Firefox release number.
    const UI_VERSION = 92;
    const BROWSER_DOCURL = AppConstants.BROWSER_CHROME_URL;

    PermissionsUtils.importFromPrefs("blockautoplay.", "autoplay-media");
    if (!Services.prefs.prefHasUserValue("browser.migration.version")) {
__L_V__0({
    lN: 3047,tT:'if',pr:'!Services.prefs.prefHasUserValue(browser.migration.version)',eT:{},fN:''
  });'__L_V__0';
      // This is a new profile, nothing to migrate.
      Services.prefs.setIntPref("browser.migration.version", UI_VERSION);
      this._isNewProfile = true;
      return;
    }

    this._isNewProfile = false;
    let currentUIVersion = Services.prefs.getIntPref(
      "browser.migration.version"
    );
    if (currentUIVersion >= UI_VERSION) {
__L_V__0({
    lN: 3058,tT:'if',pr:'currentUIVersion >= UI_VERSION',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    // CLIQZ-SPECIAL: Show whats new page on every update
    // set false for 1.28 as we do not show whats new page
    // set true if we need to show whats new page
    Services.prefs.setBoolPref("browser.migration.showWhatsNew", false);

    let xulStore = Services.xulStore;

    if (currentUIVersion < 52) {
__L_V__0({
    lN: 3069,tT:'if',pr:'currentUIVersion < 52',eT:{},fN:''
  });'__L_V__0';
      // Keep old devtools log persistence behavior after splitting netmonitor and
      // webconsole prefs (bug 1307881).
      if (Services.prefs.getBoolPref("devtools.webconsole.persistlog", false)) {
__L_V__0({
    lN: 3072,tT:'if',pr:'Services.prefs.getBoolPref(devtools.webconsole.persistlog, false)',eT:{},fN:''
  });'__L_V__0';
        Services.prefs.setBoolPref("devtools.netmonitor.persistlog", true);
      }
    }

    // Update user customizations that will interfere with the Safe Browsing V2
    // to V4 migration (bug 1395419).
    if (currentUIVersion < 53) {
__L_V__0({
    lN: 3079,tT:'if',pr:'currentUIVersion < 53',eT:{},fN:''
  });'__L_V__0';
      const MALWARE_PREF = "urlclassifier.malwareTable";
      if (Services.prefs.prefHasUserValue(MALWARE_PREF)) {
__L_V__0({
    lN: 3081,tT:'if',pr:'Services.prefs.prefHasUserValue(MALWARE_PREF)',eT:{},fN:''
  });'__L_V__0';
        let malwareList = Services.prefs.getCharPref(MALWARE_PREF);
        if (malwareList.includes("goog-malware-shavar")) {
__L_V__0({
    lN: 3083,tT:'if',pr:'malwareList.includes(goog-malware-shavar)',eT:{},fN:''
  });'__L_V__0';
          malwareList.replace("goog-malware-shavar", "goog-malware-proto");
          Services.prefs.setCharPref(MALWARE_PREF, malwareList);
        }
      }
    }

    if (currentUIVersion < 55) {
__L_V__0({
    lN: 3090,tT:'if',pr:'currentUIVersion < 55',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.clearUserPref("browser.customizemode.tip0.shown");
    }

    if (currentUIVersion < 56) {
__L_V__0({
    lN: 3094,tT:'if',pr:'currentUIVersion < 56',eT:{},fN:''
  });'__L_V__0';
      // Prior to the end of the Firefox 57 cycle, the sidebarcommand being present
      // or not was the only thing that distinguished whether the sidebar was open.
      // Now, the sidebarcommand always indicates the last opened sidebar, and we
      // correctly persist the checked attribute to indicate whether or not the
      // sidebar was open. We should set the checked attribute in case it wasn't:
      if (xulStore.getValue(BROWSER_DOCURL, "sidebar-box", "sidebarcommand")) {
__L_V__0({
    lN: 3100,tT:'if',pr:'xulStore.getValue(BROWSER_DOCURL, sidebar-box, sidebarcommand)',eT:{},fN:''
  });'__L_V__0';
        xulStore.setValue(BROWSER_DOCURL, "sidebar-box", "checked", "true");
      }
    }

    if (currentUIVersion < 58) {
__L_V__0({
    lN: 3105,tT:'if',pr:'currentUIVersion < 58',eT:{},fN:''
  });'__L_V__0';
      // With Firefox 57, we are doing a one time reset of the geo prefs due to bug 1413652
      Services.prefs.clearUserPref("browser.search.countryCode");
      Services.prefs.clearUserPref("browser.search.region");
      Services.prefs.clearUserPref("browser.search.isUS");
    }

    if (currentUIVersion < 59) {
__L_V__0({
    lN: 3112,tT:'if',pr:'currentUIVersion < 59',eT:{},fN:''
  });'__L_V__0';
      let searchInitializedPromise = new Promise(resolve => {
        if (Services.search.isInitialized) {
__L_V__0({
    lN: 3114,tT:'if',pr:'Services.search.isInitialized',eT:{},fN:''
  });'__L_V__0';
          resolve();
        }
        const SEARCH_SERVICE_TOPIC = "browser-search-service";
        Services.obs.addObserver(function observer(subject, topic, data) {
__L_V__0({
    lN: 3118,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observer'
  });'__L_V__0';
          if (data != "init-complete") {
__L_V__0({
    lN: 3119,tT:'if',pr:'data != init-complete',eT:{},fN:''
  });'__L_V__0';
            return;
          }
          Services.obs.removeObserver(observer, SEARCH_SERVICE_TOPIC);
          resolve();
        }, SEARCH_SERVICE_TOPIC);
      });
      searchInitializedPromise.then(() => {
        let currentEngine = Services.search.defaultEngine.wrappedJSObject;
        // Only reset the current engine if it wasn't set by a WebExtension
        // and it is not one of the default engines.
        // If the original default is not a default, the user has a weird
        // configuration probably involving langpacks, it's not worth
        // attempting to reset their settings.
        if (
          currentEngine._extensionID ||
          currentEngine._isDefault ||
          !Services.search.originalDefaultEngine.wrappedJSObject._isDefault
        ) {
__L_V__0({
    lN: 3137,tT:'if',pr:' currentEngine._extensionID || currentEngine._isDefault || !Services.search.originalDefaultEngine.wrappedJSObject._isDefault ',eT:{},fN:''
  });'__L_V__0';
          return;
        }

        if (!currentEngine._loadPath.startsWith("[https]")) {
__L_V__0({
    lN: 3141,tT:'if',pr:'!currentEngine._loadPath.startsWith([https])',eT:{},fN:''
  });'__L_V__0';
          Services.search.resetToOriginalDefaultEngine();
        }
      });

      // Migrate the old requested locales prefs to use the new model
      const SELECTED_LOCALE_PREF = "general.useragent.locale";
      const MATCHOS_LOCALE_PREF = "intl.locale.matchOS";

      if (
        Services.prefs.prefHasUserValue(MATCHOS_LOCALE_PREF) ||
        Services.prefs.prefHasUserValue(SELECTED_LOCALE_PREF)
      ) {
__L_V__0({
    lN: 3153,tT:'if',pr:' Services.prefs.prefHasUserValue(MATCHOS_LOCALE_PREF) || Services.prefs.prefHasUserValue(SELECTED_LOCALE_PREF) ',eT:{},fN:''
  });'__L_V__0';
        if (Services.prefs.getBoolPref(MATCHOS_LOCALE_PREF, false)) {
__L_V__0({
    lN: 3154,tT:'if',pr:'Services.prefs.getBoolPref(MATCHOS_LOCALE_PREF, false)',eT:{},fN:''
  });'__L_V__0';
          Services.locale.requestedLocales = [];
        } else {
          let locale = Services.prefs.getComplexValue(
            SELECTED_LOCALE_PREF,
            Ci.nsIPrefLocalizedString
          );
          if (locale) {
__L_V__0({
    lN: 3161,tT:'if',pr:'locale',eT:{},fN:''
  });'__L_V__0';
            try {
              Services.locale.requestedLocales = [locale.data];
            } catch (e) {
              /* Don't panic if the value is not a valid locale code. */
            }
          }
        }
        Services.prefs.clearUserPref(SELECTED_LOCALE_PREF);
        Services.prefs.clearUserPref(MATCHOS_LOCALE_PREF);
      }
    }

    if (currentUIVersion < 61) {
__L_V__0({
    lN: 3174,tT:'if',pr:'currentUIVersion < 61',eT:{},fN:''
  });'__L_V__0';
      // Remove persisted toolbarset from navigator toolbox
      xulStore.removeValue(BROWSER_DOCURL, "navigator-toolbox", "toolbarset");
    }

    if (currentUIVersion < 62) {
__L_V__0({
    lN: 3179,tT:'if',pr:'currentUIVersion < 62',eT:{},fN:''
  });'__L_V__0';
      // Remove iconsize and mode from all the toolbars
      let toolbars = [
        "navigator-toolbox",
        "nav-bar",
        "PersonalToolbar",
        "TabsToolbar",
        "toolbar-menubar",
      ];
      for (let resourceName of ["mode", "iconsize"]) {
        for (let toolbarId of toolbars) {
          xulStore.removeValue(BROWSER_DOCURL, toolbarId, resourceName);
        }
      }
    }

    if (currentUIVersion < 64) {
__L_V__0({
    lN: 3195,tT:'if',pr:'currentUIVersion < 64',eT:{},fN:''
  });'__L_V__0';
      OS.File.remove(
        OS.Path.join(OS.Constants.Path.profileDir, "directoryLinks.json"),
        { ignoreAbsent: true }
      );
    }

    if (
      currentUIVersion < 65 &&
      Services.prefs.getCharPref("general.config.filename", "") ==
        "dsengine.cfg"
    ) {
__L_V__0({
    lN: 3206,tT:'if',pr:' currentUIVersion < 65 && Services.prefs.getCharPref(general.config.filename, ) == dsengine.cfg ',eT:{},fN:''
  });'__L_V__0';
      let searchInitializedPromise = new Promise(resolve => {
        if (Services.search.isInitialized) {
__L_V__0({
    lN: 3208,tT:'if',pr:'Services.search.isInitialized',eT:{},fN:''
  });'__L_V__0';
          resolve();
        }
        const SEARCH_SERVICE_TOPIC = "browser-search-service";
        Services.obs.addObserver(function observer(subject, topic, data) {
__L_V__0({
    lN: 3212,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observer'
  });'__L_V__0';
          if (data != "init-complete") {
__L_V__0({
    lN: 3213,tT:'if',pr:'data != init-complete',eT:{},fN:''
  });'__L_V__0';
            return;
          }
          Services.obs.removeObserver(observer, SEARCH_SERVICE_TOPIC);
          resolve();
        }, SEARCH_SERVICE_TOPIC);
      });
      searchInitializedPromise.then(() => {
        let engineNames = [
          "Bing Search Engine",
          "Yahoo! Search Engine",
          "Yandex Search Engine",
        ];
        for (let engineName of engineNames) {
          let engine = Services.search.getEngineByName(engineName);
          if (engine) {
__L_V__0({
    lN: 3228,tT:'if',pr:'engine',eT:{},fN:''
  });'__L_V__0';
            Services.search.removeEngine(engine);
          }
        }
      });
    }

    if (currentUIVersion < 66) {
__L_V__0({
    lN: 3235,tT:'if',pr:'currentUIVersion < 66',eT:{},fN:''
  });'__L_V__0';
      // Set whether search suggestions or history/bookmarks results come first
      // in the urlbar results, and uninstall a related Shield study.
      this._migrateMatchBucketsPrefForUI66();
    }

    if (currentUIVersion < 67) {
__L_V__0({
    lN: 3241,tT:'if',pr:'currentUIVersion < 67',eT:{},fN:''
  });'__L_V__0';
      // Migrate devtools firebug theme users to light theme (bug 1378108):
      if (Services.prefs.getCharPref("devtools.theme") == "firebug") {
__L_V__0({
    lN: 3243,tT:'if',pr:'Services.prefs.getCharPref(devtools.theme) == firebug',eT:{},fN:''
  });'__L_V__0';
        Services.prefs.setCharPref("devtools.theme", "light");
      }
    }

    if (currentUIVersion < 68) {
__L_V__0({
    lN: 3248,tT:'if',pr:'currentUIVersion < 68',eT:{},fN:''
  });'__L_V__0';
      // Remove blocklists legacy storage, now relying on IndexedDB.
      OS.File.remove(
        OS.Path.join(OS.Constants.Path.profileDir, "kinto.sqlite"),
        { ignoreAbsent: true }
      );
    }

    if (currentUIVersion < 69) {
__L_V__0({
    lN: 3256,tT:'if',pr:'currentUIVersion < 69',eT:{},fN:''
  });'__L_V__0';
      // Clear old social prefs from profile (bug 1460675)
      let socialPrefs = Services.prefs.getBranch("social.");
      if (socialPrefs) {
__L_V__0({
    lN: 3259,tT:'if',pr:'socialPrefs',eT:{},fN:''
  });'__L_V__0';
        let socialPrefsArray = socialPrefs.getChildList("");
        for (let item of socialPrefsArray) {
          Services.prefs.clearUserPref("social." + item);
        }
      }
    }

    if (currentUIVersion < 70) {
__L_V__0({
    lN: 3267,tT:'if',pr:'currentUIVersion < 70',eT:{},fN:''
  });'__L_V__0';
      // Migrate old ctrl-tab pref to new one in existing profiles. (This code
      // doesn't run at all in new profiles.)
      Services.prefs.setBoolPref(
        "browser.ctrlTab.recentlyUsedOrder",
        Services.prefs.getBoolPref("browser.ctrlTab.previews", false)
      );
      Services.prefs.clearUserPref("browser.ctrlTab.previews");
      // Remember that we migrated the pref in case we decide to flip it for
      // these users.
      Services.prefs.setBoolPref("browser.ctrlTab.migrated", true);
    }

    if (currentUIVersion < 71) {
__L_V__0({
    lN: 3280,tT:'if',pr:'currentUIVersion < 71',eT:{},fN:''
  });'__L_V__0';
      // Clear legacy saved prefs for content handlers.
      let savedContentHandlers = Services.prefs.getChildList(
        "browser.contentHandlers.types"
      );
      for (let savedHandlerPref of savedContentHandlers) {
        Services.prefs.clearUserPref(savedHandlerPref);
      }
    }

    if (currentUIVersion < 72) {
__L_V__0({
    lN: 3290,tT:'if',pr:'currentUIVersion < 72',eT:{},fN:''
  });'__L_V__0';
      // Migrate performance tool's recording interval value from msec to usec.
      let pref = "devtools.performance.recording.interval";
      Services.prefs.setIntPref(
        pref,
        Services.prefs.getIntPref(pref, 1) * 1000
      );
    }

    if (currentUIVersion < 73) {
__L_V__0({
    lN: 3299,tT:'if',pr:'currentUIVersion < 73',eT:{},fN:''
  });'__L_V__0';
      // Remove blocklist JSON local dumps in profile.
      OS.File.removeDir(
        OS.Path.join(OS.Constants.Path.profileDir, "blocklists"),
        { ignoreAbsent: true }
      );
      OS.File.removeDir(
        OS.Path.join(OS.Constants.Path.profileDir, "blocklists-preview"),
        { ignoreAbsent: true }
      );
      for (const filename of ["addons.json", "plugins.json", "gfx.json"]) {
        // Some old versions used to dump without subfolders. Clean them while we are at it.
        const path = OS.Path.join(
          OS.Constants.Path.profileDir,
          `blocklists-${filename}`
        );
        OS.File.remove(path, { ignoreAbsent: true });
      }
    }

    if (currentUIVersion < 75) {
__L_V__0({
    lN: 3319,tT:'if',pr:'currentUIVersion < 75',eT:{},fN:''
  });'__L_V__0';
      // Ensure we try to migrate any live bookmarks the user might have, trying up to
      // 5 times. We set this early, and here, to avoid running the migration on
      // new profile (or, indeed, ever creating the pref there).
      Services.prefs.setIntPref(
        "browser.livebookmarks.migrationAttemptsLeft",
        5
      );
    }

    if (currentUIVersion < 76) {
__L_V__0({
    lN: 3329,tT:'if',pr:'currentUIVersion < 76',eT:{},fN:''
  });'__L_V__0';
      // Clear old onboarding prefs from profile (bug 1462415)
      let onboardingPrefs = Services.prefs.getBranch("browser.onboarding.");
      if (onboardingPrefs) {
__L_V__0({
    lN: 3332,tT:'if',pr:'onboardingPrefs',eT:{},fN:''
  });'__L_V__0';
        let onboardingPrefsArray = onboardingPrefs.getChildList("");
        for (let item of onboardingPrefsArray) {
          Services.prefs.clearUserPref("browser.onboarding." + item);
        }
      }
      // CLIQZ: Initiate doorhanger notification if its update from <1.24.0
      AppMenuNotifications.showNotification("allow-addons", null, null, {dismissed: true});
    }

    if (currentUIVersion < 77) {
__L_V__0({
    lN: 3342,tT:'if',pr:'currentUIVersion < 77',eT:{},fN:''
  });'__L_V__0';
      // Remove currentset from all the toolbars
      let toolbars = [
        "nav-bar",
        "PersonalToolbar",
        "TabsToolbar",
        "toolbar-menubar",
      ];
      for (let toolbarId of toolbars) {
        xulStore.removeValue(BROWSER_DOCURL, toolbarId, "currentset");
      }
    }

    if (currentUIVersion < 78) {
__L_V__0({
    lN: 3355,tT:'if',pr:'currentUIVersion < 78',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.clearUserPref("browser.search.region");
    }

    if (currentUIVersion < 79) {
__L_V__0({
    lN: 3359,tT:'if',pr:'currentUIVersion < 79',eT:{},fN:''
  });'__L_V__0';
      // The handler app service will read this. We need to wait with migrating
      // until the handler service has started up, so just set a pref here.
      Services.prefs.setCharPref("browser.handlers.migrations", "30boxes");
    }

    if (currentUIVersion < 80) {
__L_V__0({
    lN: 3365,tT:'if',pr:'currentUIVersion < 80',eT:{},fN:''
  });'__L_V__0';
      let hosts = Services.prefs.getCharPref("network.proxy.no_proxies_on");
      // remove "localhost" and "127.0.0.1" from the no_proxies_on list
      const kLocalHosts = new Set(["localhost", "127.0.0.1"]);
      hosts = hosts
        .split(/[ ,]+/)
        .filter(host => !kLocalHosts.has(host))
        .join(", ");
      Services.prefs.setCharPref("network.proxy.no_proxies_on", hosts);
    }

    if (currentUIVersion < 81) {
__L_V__0({
    lN: 3376,tT:'if',pr:'currentUIVersion < 81',eT:{},fN:''
  });'__L_V__0';
      // Reset homepage pref for users who have it set to a default from before Firefox 4:
      //   <locale>.(start|start2|start3).mozilla.(com|org)
      if (HomePage.overridden) {
__L_V__0({
    lN: 3379,tT:'if',pr:'HomePage.overridden',eT:{},fN:''
  });'__L_V__0';
        const DEFAULT = HomePage.getDefault();
        let value = HomePage.get();
        let updated = value.replace(
          /https?:\/\/([\w\-]+\.)?start\d*\.mozilla\.(org|com)[^|]*/gi,
          DEFAULT
        );
        if (updated != value) {
__L_V__0({
    lN: 3386,tT:'if',pr:'updated != value',eT:{},fN:''
  });'__L_V__0';
          if (updated == DEFAULT) {
__L_V__0({
    lN: 3387,tT:'if',pr:'updated == DEFAULT',eT:{},fN:''
  });'__L_V__0';
            HomePage.reset();
          } else {
            value = updated;
            HomePage.safeSet(value);
          }
        }
      }
    }

    if (currentUIVersion < 82) {
__L_V__0({
    lN: 3397,tT:'if',pr:'currentUIVersion < 82',eT:{},fN:''
  });'__L_V__0';
      this._migrateXULStoreForDocument(
        "chrome://browser/content/browser.xul",
        "chrome://browser/content/browser.xhtml"
      );
    }

    if (currentUIVersion < 83) {
__L_V__0({
    lN: 3404,tT:'if',pr:'currentUIVersion < 83',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.clearUserPref("browser.search.reset.status");
    }

    if (currentUIVersion < 84) {
__L_V__0({
    lN: 3408,tT:'if',pr:'currentUIVersion < 84',eT:{},fN:''
  });'__L_V__0';
      // Reset flash "always allow/block" permissions
      // We keep session and policy permissions, which could both be
      // the result of enterprise policy settings. "Never/Always allow"
      // settings for flash were actually time-bound on recent-ish Firefoxen,
      // so we remove EXPIRE_TIME entries, too.
      const { EXPIRE_NEVER, EXPIRE_TIME } = Services.perms;
      let flashPermissions = Services.perms
        .getAllWithTypePrefix("plugin:flash")
        .filter(
          p =>
            p.type == "plugin:flash" &&
            (p.expireType == EXPIRE_NEVER || p.expireType == EXPIRE_TIME)
        );
      flashPermissions.forEach(p => Services.perms.removePermission(p));
    }

    // currentUIVersion < 85 is missing due to the following:
    // Origianlly, Bug #1568900 added currentUIVersion 85 but was targeting FF70 release.
    // In between it landing in FF70, Bug #1562601 (currentUIVersion 86) landed and
    // was uplifted to Beta. To make sure the migration doesn't get skipped, the
    // code block that was at 85 has been moved/bumped to currentUIVersion 87.

    if (currentUIVersion < 86) {
__L_V__0({
    lN: 3431,tT:'if',pr:'currentUIVersion < 86',eT:{},fN:''
  });'__L_V__0';
      // If the user has set "media.autoplay.allow-muted" to false
      // migrate that to media.autoplay.default=BLOCKED_ALL.
      if (
        Services.prefs.prefHasUserValue("media.autoplay.allow-muted") &&
        !Services.prefs.getBoolPref("media.autoplay.allow-muted") &&
        !Services.prefs.prefHasUserValue("media.autoplay.default") &&
        Services.prefs.getIntPref("media.autoplay.default") ==
          Ci.nsIAutoplay.BLOCKED
      ) {
__L_V__0({
    lN: 3440,tT:'if',pr:' Services.prefs.prefHasUserValue(media.autoplay.allow-muted) && !Services.prefs.getBoolPref(media.autoplay.allow-muted) && !Services.prefs.prefHasUserValue(media.autoplay.default) && Services.prefs.getIntPref(media.autoplay.default) == Ci.nsIAutoplay.BLOCKED ',eT:{},fN:''
  });'__L_V__0';
        Services.prefs.setIntPref(
          "media.autoplay.default",
          Ci.nsIAutoplay.BLOCKED_ALL
        );
      }
      Services.prefs.clearUserPref("media.autoplay.allow-muted");
    }

    if (currentUIVersion < 87) {
__L_V__0({
    lN: 3449,tT:'if',pr:'currentUIVersion < 87',eT:{},fN:''
  });'__L_V__0';
      const TRACKING_TABLE_PREF = "urlclassifier.trackingTable";
      const CUSTOM_BLOCKING_PREF =
        "browser.contentblocking.customBlockList.preferences.ui.enabled";
      // Check if user has set custom tables pref, and show custom block list UI
      // in the about:preferences#privacy custom panel.
      if (Services.prefs.prefHasUserValue(TRACKING_TABLE_PREF)) {
__L_V__0({
    lN: 3455,tT:'if',pr:'Services.prefs.prefHasUserValue(TRACKING_TABLE_PREF)',eT:{},fN:''
  });'__L_V__0';
        Services.prefs.setBoolPref(CUSTOM_BLOCKING_PREF, true);
      }
    }

    if (currentUIVersion < 88) {
__L_V__0({
    lN: 3460,tT:'if',pr:'currentUIVersion < 88',eT:{},fN:''
  });'__L_V__0';
      // If the user the has "browser.contentblocking.category = custom", but has
      // the exact same settings as "standard", move them once to "standard". This is
      // to reset users who we may have moved accidentally, or moved to get ETP early.
      let category_prefs = [
        "network.cookie.cookieBehavior",
        "privacy.trackingprotection.pbmode.enabled",
        "privacy.trackingprotection.enabled",
        "privacy.trackingprotection.socialtracking.enabled",
        "privacy.trackingprotection.fingerprinting.enabled",
        "privacy.trackingprotection.cryptomining.enabled",
      ];
      if (
        Services.prefs.getStringPref(
          "browser.contentblocking.category",
          "standard"
        ) == "custom"
      ) {
__L_V__0({
    lN: 3477,tT:'if',pr:' Services.prefs.getStringPref( browser.contentblocking.category, standard ) == custom ',eT:{},fN:''
  });'__L_V__0';
        let shouldMigrate = true;
        for (let pref of category_prefs) {
          if (Services.prefs.prefHasUserValue(pref)) {
__L_V__0({
    lN: 3480,tT:'if',pr:'Services.prefs.prefHasUserValue(pref)',eT:{},fN:''
  });'__L_V__0';
            shouldMigrate = false;
          }
        }
        if (shouldMigrate) {
__L_V__0({
    lN: 3484,tT:'if',pr:'shouldMigrate',eT:{},fN:''
  });'__L_V__0';
          Services.prefs.setStringPref(
            "browser.contentblocking.category",
            "standard"
          );
        }
      }
    }

    if (currentUIVersion < 89) {
__L_V__0({
    lN: 3493,tT:'if',pr:'currentUIVersion < 89',eT:{},fN:''
  });'__L_V__0';
      // This file was renamed in https://bugzilla.mozilla.org/show_bug.cgi?id=1595636.
      this._migrateXULStoreForDocument(
        "chrome://devtools/content/framework/toolbox-window.xul",
        "chrome://devtools/content/framework/toolbox-window.xhtml"
      );
    }

    if (currentUIVersion < 90) {
__L_V__0({
    lN: 3501,tT:'if',pr:'currentUIVersion < 90',eT:{},fN:''
  });'__L_V__0';
      this._migrateXULStoreForDocument(
        "chrome://browser/content/places/historySidebar.xul",
        "chrome://browser/content/places/historySidebar.xhtml"
      );
      this._migrateXULStoreForDocument(
        "chrome://browser/content/places/places.xul",
        "chrome://browser/content/places/places.xhtml"
      );
      this._migrateXULStoreForDocument(
        "chrome://browser/content/places/bookmarksSidebar.xul",
        "chrome://browser/content/places/bookmarksSidebar.xhtml"
      );
    }

    // Clear socks proxy values if they were shared from http, to prevent
    // websocket breakage after bug 1577862 (see bug 969282).
    if (
      currentUIVersion < 91 &&
      Services.prefs.getBoolPref("network.proxy.share_proxy_settings", false) &&
      Services.prefs.getIntPref("network.proxy.type", 0) == 1
    ) {
__L_V__0({
    lN: 3522,tT:'if',pr:' currentUIVersion < 91 && Services.prefs.getBoolPref(network.proxy.share_proxy_settings, false) && Services.prefs.getIntPref(network.proxy.type, 0) == 1 ',eT:{},fN:''
  });'__L_V__0';
      let httpProxy = Services.prefs.getCharPref("network.proxy.http", "");
      let httpPort = Services.prefs.getIntPref("network.proxy.http_port", 0);
      let socksProxy = Services.prefs.getCharPref("network.proxy.socks", "");
      let socksPort = Services.prefs.getIntPref("network.proxy.socks_port", 0);
      if (httpProxy && httpProxy == socksProxy && httpPort == socksPort) {
__L_V__0({
    lN: 3527,tT:'if',pr:'httpProxy && httpProxy == socksProxy && httpPort == socksPort',eT:{},fN:''
  });'__L_V__0';
        Services.prefs.setCharPref(
          "network.proxy.socks",
          Services.prefs.getCharPref("network.proxy.backup.socks", "")
        );
        Services.prefs.setIntPref(
          "network.proxy.socks_port",
          Services.prefs.getIntPref("network.proxy.backup.socks_port", 0)
        );
      }
    }

    if (currentUIVersion < 92) {
__L_V__0({
    lN: 3539,tT:'if',pr:'currentUIVersion < 92',eT:{},fN:''
  });'__L_V__0';
      // privacy.userContext.longPressBehavior pref was renamed and changed to a boolean
      let longpress = Services.prefs.getIntPref(
        "privacy.userContext.longPressBehavior",
        0
      );
      if (longpress == 1) {
__L_V__0({
    lN: 3545,tT:'if',pr:'longpress == 1',eT:{},fN:''
  });'__L_V__0';
        Services.prefs.setBoolPref(
          "privacy.userContext.newTabContainerOnLeftClick.enabled",
          true
        );
      }
    }

    // Update the migration version.
    Services.prefs.setIntPref("browser.migration.version", UI_VERSION);
  },

  _maybeShowDefaultBrowserPrompt() {
__L_V__0({
    lN: 3557,tT:'func',pr:'',eT:{},fN:'_maybeShowDefaultBrowserPrompt'
  });'__L_V__0';
    DefaultBrowserCheck.willCheckDefaultBrowser(/* isStartupCheck */ true).then(
      willPrompt => {
        if (!willPrompt) {
__L_V__0({
    lN: 3560,tT:'if',pr:'!willPrompt',eT:{},fN:''
  });'__L_V__0';
          return;
        }
        DefaultBrowserCheck.prompt(BrowserWindowTracker.getTopWindow());
      }
    );
  },

  async _migrateMatchBucketsPrefForUI66() {
__L_V__0({
    lN: 3568,tT:'func',pr:'',eT:{},fN:'_migrateMatchBucketsPrefForUI66'
  });'__L_V__0';
    // This does two related things.
    //
    // (1) Profiles created on or after Firefox 57's release date were eligible
    // for a Shield study that changed the browser.urlbar.matchBuckets pref in
    // order to show search suggestions above history/bookmarks in the urlbar
    // popup.  This uninstalls that study.  (It's actually slightly more
    // complex.  The study set the pref to several possible values, but the
    // overwhelming number of profiles in the study got search suggestions
    // first, followed by history/bookmarks.)
    //
    // (2) This also ensures that (a) new users see search suggestions above
    // history/bookmarks, thereby effectively making the study permanent, and
    // (b) old users (including those in the study) continue to see whatever
    // they were seeing before.  This works together with UnifiedComplete.js.
    // By default, the browser.urlbar.matchBuckets pref does not exist, and
    // UnifiedComplete.js internally hardcodes a default value for it.  Before
    // Firefox 60, the hardcoded default was to show history/bookmarks first.
    // After 60, it's to show search suggestions first.

    // Wait for Shield init to complete.
    await new Promise(resolve => {
      if (this._shieldInitComplete) {
__L_V__0({
    lN: 3590,tT:'if',pr:'this._shieldInitComplete',eT:{},fN:''
  });'__L_V__0';
        resolve();
        return;
      }
      let topic = "shield-init-complete";
      Services.obs.addObserver(function obs() {
__L_V__0({
    lN: 3595,tT:'func',pr:'',eT:{},fN:'obs'
  });'__L_V__0';
        Services.obs.removeObserver(obs, topic);
        resolve();
      }, topic);
    });

    // Now get the pref's value.  If the study is active, the value will have
    // just been set (on the default branch) as part of Shield's init.  The pref
    // should not exist otherwise (normally).
    let prefName = "browser.urlbar.matchBuckets";
    let prefValue = Services.prefs.getCharPref(prefName, "");

    // Get the study (aka experiment).  It may not be installed.
    let experiment = null;
    let experimentName = "pref-flip-search-composition-57-release-1413565";
    let { PreferenceExperiments } = ChromeUtils.import(
      "resource://normandy/lib/PreferenceExperiments.jsm"
    );
    try {
      experiment = await PreferenceExperiments.get(experimentName);
    } catch (e) {}

    // Uninstall the study, resetting the pref to its state before the study.
    if (experiment && !experiment.expired) {
__L_V__0({
    lN: 3618,tT:'if',pr:'experiment && !experiment.expired',eT:{},fN:''
  });'__L_V__0';
      await PreferenceExperiments.stop(experimentName, {
        resetValue: true,
        reason: "external:search-ui-migration",
      });
    }

    // At this point, normally the pref should not exist.  If it does, then it
    // either has a user value, or something unexpectedly set its value on the
    // default branch.  Either way, preserve that value.
    if (Services.prefs.getCharPref(prefName, "")) {
__L_V__0({
    lN: 3628,tT:'if',pr:'Services.prefs.getCharPref(prefName, )',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    // The new default is "suggestion:4,general:5" (show search suggestions
    // before history/bookmarks), but we implement that by leaving the pref
    // undefined, and UnifiedComplete.js hardcodes that value internally.  So if
    // the pref was "suggestion:4,general:5" (modulo whitespace), we're done.
    if (prefValue) {
__L_V__0({
    lN: 3636,tT:'if',pr:'prefValue',eT:{},fN:''
  });'__L_V__0';
      let buckets = PlacesUtils.convertMatchBucketsStringToArray(prefValue);
      if (ObjectUtils.deepEqual(buckets, [["suggestion", 4], ["general", 5]])) {
__L_V__0({
    lN: 3638,tT:'if',pr:'ObjectUtils.deepEqual(buckets, [[suggestion, 4], [general, 5]])',eT:{},fN:''
  });'__L_V__0';
        return;
      }
    }

    // Set the pref on the user branch.  If the pref had a value, then preserve
    // it.  Otherwise, set the previous default value, which was to show history
    // and bookmarks before search suggestions.
    prefValue = prefValue || "general:5,suggestion:Infinity";
    Services.prefs.setCharPref(prefName, prefValue);
  },

  /**
   * Open preferences even if there are no open windows.
   */
  _openPreferences(...args) {
__L_V__0({
    lN: 3653,tT:'func',pr:'',eT:{'args':args},fN:'_openPreferences'
  });'__L_V__0';
    let chromeWindow = BrowserWindowTracker.getTopWindow();
    if (chromeWindow) {
__L_V__0({
    lN: 3655,tT:'if',pr:'chromeWindow',eT:{},fN:''
  });'__L_V__0';
      chromeWindow.openPreferences(...args);
      return;
    }

    if (Services.appShell.hiddenDOMWindow.openPreferences) {
__L_V__0({
    lN: 3660,tT:'if',pr:'Services.appShell.hiddenDOMWindow.openPreferences',eT:{},fN:''
  });'__L_V__0';
      Services.appShell.hiddenDOMWindow.openPreferences(...args);
    }
  },

  _openURLInNewWindow(url) {
__L_V__0({
    lN: 3665,tT:'func',pr:'',eT:{'url':url},fN:'_openURLInNewWindow'
  });'__L_V__0';
    let urlString = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString
    );
    urlString.data = url;
    return new Promise(resolve => {
      let win = Services.ww.openWindow(
        null,
        AppConstants.BROWSER_CHROME_URL,
        "_blank",
        "chrome,all,dialog=no",
        urlString
      );
      win.addEventListener(
        "load",
        () => {
          resolve(win);
        },
        { once: true }
      );
    });
  },

#ifdef MOZ_SERVICES_SYNC
  /**
   * Called as an observer when Sync's "display URIs" notification is fired.
   *
   * We open the received URIs in background tabs.
   */
  async _onDisplaySyncURIs(data) {
__L_V__0({
    lN: 3694,tT:'func',pr:'',eT:{'data':data},fN:'_onDisplaySyncURIs'
  });'__L_V__0';
    try {
      // The payload is wrapped weirdly because of how Sync does notifications.
      const URIs = data.wrappedJSObject.object;

      // win can be null, but it's ok, we'll assign it later in openTab()
      let win = BrowserWindowTracker.getTopWindow({ private: false });

      const openTab = async URI => {
        let tab;
        if (!win) {
__L_V__0({
    lN: 3704,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
          win = await this._openURLInNewWindow(URI.uri);
          let tabs = win.gBrowser.tabs;
          tab = tabs[tabs.length - 1];
        } else {
          tab = win.gBrowser.addWebTab(URI.uri);
        }
        tab.setAttribute("attention", true);
        return tab;
      };

      const firstTab = await openTab(URIs[0]);
      await Promise.all(URIs.slice(1).map(URI => openTab(URI)));

      const deviceName = URIs[0].sender && URIs[0].sender.name;
      let title, body;
      const bundle = Services.strings.createBundle(
        "chrome://browser/locale/accounts.properties"
      );
      if (URIs.length == 1) {
__L_V__0({
    lN: 3723,tT:'if',pr:'URIs.length == 1',eT:{},fN:''
  });'__L_V__0';
        // Due to bug 1305895, tabs from iOS may not have device information, so
        // we have separate strings to handle those cases. (See Also
        // unnamedTabsArrivingNotificationNoDevice.body below)
        if (deviceName) {
__L_V__0({
    lN: 3727,tT:'if',pr:'deviceName',eT:{},fN:''
  });'__L_V__0';
          title = bundle.formatStringFromName(
            "tabArrivingNotificationWithDevice.title",
            [deviceName]
          );
        } else {
          title = bundle.GetStringFromName("tabArrivingNotification.title");
        }
        // Use the page URL as the body. We strip the fragment and query (after
        // the `?` and `#` respectively) to reduce size, and also format it the
        // same way that the url bar would.
        body = URIs[0].uri.replace(/([?#]).*$/, "$1");
        let wasTruncated = body.length < URIs[0].uri.length;
        body = BrowserUtils.trimURL(body);
        if (wasTruncated) {
__L_V__0({
    lN: 3741,tT:'if',pr:'wasTruncated',eT:{},fN:''
  });'__L_V__0';
          body = bundle.formatStringFromName(
            "singleTabArrivingWithTruncatedURL.body",
            [body]
          );
        }
      } else {
        title = bundle.GetStringFromName(
          "multipleTabsArrivingNotification.title"
        );
        const allKnownSender = URIs.every(URI => URI.sender != null);
        const allSameDevice =
          allKnownSender &&
          URIs.every(URI => URI.sender.id == URIs[0].sender.id);
        let tabArrivingBody;
        if (allSameDevice) {
__L_V__0({
    lN: 3756,tT:'if',pr:'allSameDevice',eT:{},fN:''
  });'__L_V__0';
          if (deviceName) {
__L_V__0({
    lN: 3757,tT:'if',pr:'deviceName',eT:{},fN:''
  });'__L_V__0';
            tabArrivingBody = "unnamedTabsArrivingNotification2.body";
          } else {
            tabArrivingBody = "unnamedTabsArrivingNotificationNoDevice.body";
          }
        } else {
          tabArrivingBody = "unnamedTabsArrivingNotificationMultiple2.body";
        }

        body = bundle.GetStringFromName(tabArrivingBody);
        body = PluralForm.get(URIs.length, body);
        body = body.replace("#1", URIs.length);
        body = body.replace("#2", deviceName);
      }

      const clickCallback = (obsSubject, obsTopic, obsData) => {
        if (obsTopic == "alertclickcallback") {
__L_V__0({
    lN: 3773,tT:'if',pr:'obsTopic == alertclickcallback',eT:{},fN:''
  });'__L_V__0';
          win.gBrowser.selectedTab = firstTab;
        }
      };

      // Specify an icon because on Windows no icon is shown at the moment
      let imageURL;
      if (AppConstants.platform == "win") {
__L_V__0({
    lN: 3780,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__0';
        imageURL = "chrome://branding/content/icon64.png";
      }
      this.AlertsService.showAlertNotification(
        imageURL,
        title,
        body,
        true,
        null,
        clickCallback
      );
    } catch (ex) {
      Cu.reportError("Error displaying tab(s) received by Sync: " + ex);
    }
  },
#endif

  async _onVerifyLoginNotification({ body, title, url }) {
__L_V__0({
    lN: 3797,tT:'func',pr:'',eT:{'body':body,'title':title,'url':url},fN:'_onVerifyLoginNotification'
  });'__L_V__0';
    let tab;
    let imageURL;
    if (AppConstants.platform == "win") {
__L_V__0({
    lN: 3800,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__0';
      imageURL = "chrome://branding/content/icon64.png";
    }
    let win = BrowserWindowTracker.getTopWindow({ private: false });
    if (!win) {
__L_V__0({
    lN: 3804,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
      win = await this._openURLInNewWindow(url);
      let tabs = win.gBrowser.tabs;
      tab = tabs[tabs.length - 1];
    } else {
      tab = win.gBrowser.addWebTab(url);
    }
    tab.setAttribute("attention", true);
    let clickCallback = (subject, topic, data) => {
      if (topic != "alertclickcallback") {
__L_V__0({
    lN: 3813,tT:'if',pr:'topic != alertclickcallback',eT:{},fN:''
  });'__L_V__0';
        return;
      }
      win.gBrowser.selectedTab = tab;
    };

    try {
      this.AlertsService.showAlertNotification(
        imageURL,
        title,
        body,
        true,
        null,
        clickCallback
      );
    } catch (ex) {
      Cu.reportError("Error notifying of a verify login event: " + ex);
    }
  },

  _onDeviceConnected(deviceName) {
__L_V__0({
    lN: 3833,tT:'func',pr:'',eT:{'deviceName':deviceName},fN:'_onDeviceConnected'
  });'__L_V__0';
    let accountsBundle = Services.strings.createBundle(
      "chrome://browser/locale/accounts.properties"
    );
    let title = accountsBundle.GetStringFromName("deviceConnDisconnTitle");
    let body = accountsBundle.formatStringFromName(
      "otherDeviceConnectedBody" + (deviceName ? "" : ".noDeviceName"),
      [deviceName]
    );

    let clickCallback = async (subject, topic, data) => {
      if (topic != "alertclickcallback") {
__L_V__0({
    lN: 3844,tT:'if',pr:'topic != alertclickcallback',eT:{},fN:''
  });'__L_V__0';
        return;
      }
      let url = await FxAccounts.config.promiseManageDevicesURI(
        "device-connected-notification"
      );
      let win = BrowserWindowTracker.getTopWindow({ private: false });
      if (!win) {
__L_V__0({
    lN: 3851,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
        this._openURLInNewWindow(url);
      } else {
        win.gBrowser.addWebTab(url);
      }
    };

    try {
      this.AlertsService.showAlertNotification(
        null,
        title,
        body,
        true,
        null,
        clickCallback
      );
    } catch (ex) {
      Cu.reportError("Error notifying of a new Sync device: " + ex);
    }
  },

  _onDeviceDisconnected() {
__L_V__0({
    lN: 3872,tT:'func',pr:'',eT:{},fN:'_onDeviceDisconnected'
  });'__L_V__0';
    let bundle = Services.strings.createBundle(
      "chrome://browser/locale/accounts.properties"
    );
    let title = bundle.GetStringFromName("deviceConnDisconnTitle");
    let body = bundle.GetStringFromName("thisDeviceDisconnectedBody");

    let clickCallback = (subject, topic, data) => {
      if (topic != "alertclickcallback") {
__L_V__0({
    lN: 3880,tT:'if',pr:'topic != alertclickcallback',eT:{},fN:''
  });'__L_V__0';
        return;
      }
      this._openPreferences("sync");
    };
    this.AlertsService.showAlertNotification(
      null,
      title,
      body,
      true,
      null,
      clickCallback
    );
  },

  _handleFlashHang() {
__L_V__0({
    lN: 3895,tT:'func',pr:'',eT:{},fN:'_handleFlashHang'
  });'__L_V__0';
    ++this._flashHangCount;
    if (this._flashHangCount < 2) {
__L_V__0({
    lN: 3897,tT:'if',pr:'this._flashHangCount < 2',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    // protected mode only applies to win32
    if (Services.appinfo.XPCOMABI != "x86-msvc") {
__L_V__0({
    lN: 3901,tT:'if',pr:'Services.appinfo.XPCOMABI != x86-msvc',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    if (
      Services.prefs.getBoolPref("dom.ipc.plugins.flash.disable-protected-mode")
    ) {
__L_V__0({
    lN: 3907,tT:'if',pr:' Services.prefs.getBoolPref(dom.ipc.plugins.flash.disable-protected-mode) ',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    if (
      !Services.prefs.getBoolPref("browser.flash-protected-mode-flip.enable")
    ) {
__L_V__0({
    lN: 3912,tT:'if',pr:' !Services.prefs.getBoolPref(browser.flash-protected-mode-flip.enable) ',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    if (Services.prefs.getBoolPref("browser.flash-protected-mode-flip.done")) {
__L_V__0({
    lN: 3915,tT:'if',pr:'Services.prefs.getBoolPref(browser.flash-protected-mode-flip.done)',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    Services.prefs.setBoolPref(
      "dom.ipc.plugins.flash.disable-protected-mode",
      true
    );
    Services.prefs.setBoolPref("browser.flash-protected-mode-flip.done", true);

    let win = BrowserWindowTracker.getTopWindow();
    if (!win) {
__L_V__0({
    lN: 3925,tT:'if',pr:'!win',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    let productName = gBrandBundle.GetStringFromName("brandShortName");
    let message = win.gNavigatorBundle.getFormattedString("flashHang.message", [
      productName,
    ]);
    let buttons = [
      {
        label: win.gNavigatorBundle.getString("flashHang.helpButton.label"),
        accessKey: win.gNavigatorBundle.getString(
          "flashHang.helpButton.accesskey"
        ),
        callback() {
__L_V__0({
    lN: 3938,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__0';
          win.openTrustedLinkIn(
            "https://support.mozilla.org/kb/flash-protected-mode-autodisabled",
            "tab"
          );
        },
      },
    ];

    win.gNotificationBox.appendNotification(
      message,
      "flash-hang",
      null,
      win.gNotificationBox.PRIORITY_INFO_MEDIUM,
      buttons
    );
  },

  _updateFxaBadges() {
__L_V__0({
    lN: 3956,tT:'func',pr:'',eT:{},fN:'_updateFxaBadges'
  });'__L_V__0';
    let state = UIState.get();
    if (
      state.status == UIState.STATUS_LOGIN_FAILED ||
      state.status == UIState.STATUS_NOT_VERIFIED
    ) {
__L_V__0({
    lN: 3961,tT:'if',pr:' state.status == UIState.STATUS_LOGIN_FAILED || state.status == UIState.STATUS_NOT_VERIFIED ',eT:{},fN:''
  });'__L_V__0';
      AppMenuNotifications.showBadgeOnlyNotification(
        "fxa-needs-authentication"
      );
    } else {
      AppMenuNotifications.removeNotification("fxa-needs-authentication");
    }
  },

  QueryInterface: ChromeUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference,
  ]),
};

var ContentBlockingCategoriesPrefs = {
  PREF_CB_CATEGORY: "browser.contentblocking.category",
  PREF_STRICT_DEF: "browser.contentblocking.features.strict",
  switchingCategory: false,

  setPrefExpectations() {
__L_V__0({
    lN: 3981,tT:'func',pr:'',eT:{},fN:'setPrefExpectations'
  });'__L_V__0';
    // The prefs inside CATEGORY_PREFS are initial values.
    // If the pref remains null, then it will expect the default value.
    // The "standard" category is defined as expecting all 5 default values.
    this.CATEGORY_PREFS = {
      strict: {
        "network.cookie.cookieBehavior": null,
        "privacy.trackingprotection.pbmode.enabled": null,
        "privacy.trackingprotection.enabled": null,
        "privacy.trackingprotection.socialtracking.enabled": null,
        "privacy.trackingprotection.fingerprinting.enabled": null,
        "privacy.trackingprotection.cryptomining.enabled": null,
      },
      standard: {
        "network.cookie.cookieBehavior": null,
        "privacy.trackingprotection.pbmode.enabled": null,
        "privacy.trackingprotection.enabled": null,
        "privacy.trackingprotection.socialtracking.enabled": null,
        "privacy.trackingprotection.fingerprinting.enabled": null,
        "privacy.trackingprotection.cryptomining.enabled": null,
      },
    };
    let type = "strict";
    let rulesArray = Services.prefs
      .getStringPref(this.PREF_STRICT_DEF)
      .split(",");
    for (let item of rulesArray) {
__L_V__0({
    lN: 4008,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__0';
      switch (item) {
        case "tp":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.enabled"
          ] = true;
          break;
        case "-tp":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.enabled"
          ] = false;
          break;
        case "tpPrivate":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.pbmode.enabled"
          ] = true;
          break;
        case "-tpPrivate":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.pbmode.enabled"
          ] = false;
          break;
        case "fp":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.fingerprinting.enabled"
          ] = true;
          break;
        case "-fp":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.fingerprinting.enabled"
          ] = false;
          break;
        case "cm":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.cryptomining.enabled"
          ] = true;
          break;
        case "-cm":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.cryptomining.enabled"
          ] = false;
          break;
        case "stp":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.socialtracking.enabled"
          ] = true;
          break;
        case "-stp":
          this.CATEGORY_PREFS[type][
            "privacy.trackingprotection.socialtracking.enabled"
          ] = false;
          break;
        case "cookieBehavior0":
          this.CATEGORY_PREFS[type]["network.cookie.cookieBehavior"] =
            Ci.nsICookieService.BEHAVIOR_ACCEPT;
          break;
        case "cookieBehavior1":
          this.CATEGORY_PREFS[type]["network.cookie.cookieBehavior"] =
            Ci.nsICookieService.BEHAVIOR_REJECT_FOREIGN;
          break;
        case "cookieBehavior2":
          this.CATEGORY_PREFS[type]["network.cookie.cookieBehavior"] =
            Ci.nsICookieService.BEHAVIOR_REJECT;
          break;
        case "cookieBehavior3":
          this.CATEGORY_PREFS[type]["network.cookie.cookieBehavior"] =
            Ci.nsICookieService.BEHAVIOR_LIMIT_FOREIGN;
          break;
        case "cookieBehavior4":
          this.CATEGORY_PREFS[type]["network.cookie.cookieBehavior"] =
            Ci.nsICookieService.BEHAVIOR_REJECT_TRACKER;
          break;
        case "cookieBehavior5":
          this.CATEGORY_PREFS[type]["network.cookie.cookieBehavior"] =
            Ci.nsICookieService.BEHAVIOR_REJECT_TRACKER_AND_PARTITION_FOREIGN;
          break;
        default:
          Cu.reportError(`Error: Unknown rule observed ${item}`);
      }
    }
  },

  /**
   * Checks if CB prefs match perfectly with one of our pre-defined categories.
   */
  prefsMatch(category) {
__L_V__0({
    lN: 4092,tT:'func',pr:'',eT:{'category':category},fN:'prefsMatch'
  });'__L_V__0';
    // The category pref must be either unset, or match.
    if (
      Services.prefs.prefHasUserValue(this.PREF_CB_CATEGORY) &&
      Services.prefs.getStringPref(this.PREF_CB_CATEGORY) != category
    ) {
__L_V__0({
    lN: 4097,tT:'if',pr:' Services.prefs.prefHasUserValue(this.PREF_CB_CATEGORY) && Services.prefs.getStringPref(this.PREF_CB_CATEGORY) != category ',eT:{},fN:''
  });'__L_V__0';
      return false;
    }
    for (let pref in this.CATEGORY_PREFS[category]) {
      let value = this.CATEGORY_PREFS[category][pref];
      if (value == null) {
__L_V__0({
    lN: 4102,tT:'if',pr:'value == null',eT:{},fN:''
  });'__L_V__0';
        if (Services.prefs.prefHasUserValue(pref)) {
__L_V__0({
    lN: 4103,tT:'if',pr:'Services.prefs.prefHasUserValue(pref)',eT:{},fN:''
  });'__L_V__0';
          return false;
        }
      } else {
        let prefType = Services.prefs.getPrefType(pref);
        if (
          (prefType == Services.prefs.PREF_BOOL &&
            Services.prefs.getBoolPref(pref) != value) ||
          (prefType == Services.prefs.PREF_INT &&
            Services.prefs.getIntPref(pref) != value) ||
          (prefType == Services.prefs.PREF_STRING &&
            Services.prefs.getStringPref(pref) != value)
        ) {
__L_V__0({
    lN: 4115,tT:'if',pr:' (prefType == Services.prefs.PREF_BOOL && Services.prefs.getBoolPref(pref) != value) || (prefType == Services.prefs.PREF_INT && Services.prefs.getIntPref(pref) != value) || (prefType == Services.prefs.PREF_STRING && Services.prefs.getStringPref(pref) != value) ',eT:{},fN:''
  });'__L_V__0';
          return false;
        }
      }
    }
    return true;
  },

  matchCBCategory() {
__L_V__0({
    lN: 4123,tT:'func',pr:'',eT:{},fN:'matchCBCategory'
  });'__L_V__0';
    if (this.switchingCategory) {
__L_V__0({
    lN: 4124,tT:'if',pr:'this.switchingCategory',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    // If PREF_CB_CATEGORY is not set match users to a Content Blocking category. Check if prefs fit
    // perfectly into strict or standard, otherwise match with custom. If PREF_CB_CATEGORY has previously been set,
    // a change of one of these prefs necessarily puts us in "custom".
    if (this.prefsMatch("standard")) {
__L_V__0({
    lN: 4130,tT:'if',pr:'this.prefsMatch(standard)',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.setStringPref(this.PREF_CB_CATEGORY, "standard");
    } else if (this.prefsMatch("strict")) {
__L_V__0({
    lN: 4132,tT:'if',pr:'this.prefsMatch(strict)',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.setStringPref(this.PREF_CB_CATEGORY, "strict");
    } else {
      Services.prefs.setStringPref(this.PREF_CB_CATEGORY, "custom");
    }

    // If there is a custom policy which changes a related pref, then put the user in custom so
    // they still have access to other content blocking prefs, and to keep our default definitions
    // from changing.
    let policy = Services.policies.getActivePolicies();
    if (policy && (policy.EnableTrackingProtection || policy.Cookies)) {
__L_V__0({
    lN: 4142,tT:'if',pr:'policy && (policy.EnableTrackingProtection || policy.Cookies)',eT:{},fN:''
  });'__L_V__0';
      Services.prefs.setStringPref(this.PREF_CB_CATEGORY, "custom");
    }
  },

  updateCBCategory() {
__L_V__0({
    lN: 4147,tT:'func',pr:'',eT:{},fN:'updateCBCategory'
  });'__L_V__0';
    if (
      this.switchingCategory ||
      !Services.prefs.prefHasUserValue(this.PREF_CB_CATEGORY)
    ) {
__L_V__0({
    lN: 4151,tT:'if',pr:' this.switchingCategory || !Services.prefs.prefHasUserValue(this.PREF_CB_CATEGORY) ',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    // Turn on switchingCategory flag, to ensure that when the individual prefs that change as a result
    // of the category change do not trigger yet another category change.
    this.switchingCategory = true;
    let value = Services.prefs.getStringPref(this.PREF_CB_CATEGORY);
    this.setPrefsToCategory(value);
    this.switchingCategory = false;
  },

  /**
   * Sets all user-exposed content blocking preferences to values that match the selected category.
   */
  setPrefsToCategory(category) {
__L_V__0({
    lN: 4165,tT:'func',pr:'',eT:{'category':category},fN:'setPrefsToCategory'
  });'__L_V__0';
    // Leave prefs as they were if we are switching to "custom" category.
    if (category == "custom") {
__L_V__0({
    lN: 4167,tT:'if',pr:'category == custom',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    for (let pref in this.CATEGORY_PREFS[category]) {
      let value = this.CATEGORY_PREFS[category][pref];
      if (!Services.prefs.prefIsLocked(pref)) {
__L_V__0({
    lN: 4173,tT:'if',pr:'!Services.prefs.prefIsLocked(pref)',eT:{},fN:''
  });'__L_V__0';
        if (value == null) {
__L_V__0({
    lN: 4174,tT:'if',pr:'value == null',eT:{},fN:''
  });'__L_V__0';
          Services.prefs.clearUserPref(pref);
        } else {
__L_V__0({
    lN: 4177,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__0';
          switch (Services.prefs.getPrefType(pref)) {
            case Services.prefs.PREF_BOOL:
              Services.prefs.setBoolPref(pref, value);
              break;
            case Services.prefs.PREF_INT:
              Services.prefs.setIntPref(pref, value);
              break;
            case Services.prefs.PREF_STRING:
              Services.prefs.setStringPref(pref, value);
              break;
          }
        }
      }
    }
  },
};

/**
 * ContentPermissionIntegration is responsible for showing the user
 * simple permission prompts when content requests additional
 * capabilities.
 *
 * While there are some built-in permission prompts, createPermissionPrompt
 * can also be overridden by system add-ons or tests to provide new ones.
 *
 * This override ability is provided by Integration.jsm. See
 * PermissionUI.jsm for an example of how to provide a new prompt
 * from an add-on.
 */
const ContentPermissionIntegration = {
  /**
   * Creates a PermissionPrompt for a given permission type and
   * nsIContentPermissionRequest.
   *
   * @param {string} type
   *        The type of the permission request from content. This normally
   *        matches the "type" field of an nsIContentPermissionType, but it
   *        can be something else if the permission does not use the
   *        nsIContentPermissionRequest model. Note that this type might also
   *        be different from the permission key used in the permissions
   *        database.
   *        Example: "geolocation"
   * @param {nsIContentPermissionRequest} request
   *        The request for a permission from content.
   * @return {PermissionPrompt} (see PermissionUI.jsm),
   *         or undefined if the type cannot be handled.
   */
  createPermissionPrompt(type, request) {
__L_V__0({
    lN: 4224,tT:'func',pr:'',eT:{'type':type,'request':request},fN:'createPermissionPrompt'
  });'__L_V__0';
__L_V__0({
    lN: 4225,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__0';
    switch (type) {
      case "geolocation": {
        return new PermissionUI.GeolocationPermissionPrompt(request);
      }
      case "xr": {
        return new PermissionUI.XRPermissionPrompt(request);
      }
      case "desktop-notification": {
        return new PermissionUI.DesktopNotificationPermissionPrompt(request);
      }
      case "persistent-storage": {
        return new PermissionUI.PersistentStoragePermissionPrompt(request);
      }
      case "midi": {
        return new PermissionUI.MIDIPermissionPrompt(request);
      }
      case "storage-access": {
        return new PermissionUI.StorageAccessPermissionPrompt(request);
      }
    }
    return undefined;
  },
};

function ContentPermissionPrompt() {
__L_V__0({
    lN: 4249,tT:'func',pr:'',eT:{},fN:'ContentPermissionPrompt'
  });'__L_V__0';}

ContentPermissionPrompt.prototype = {
  classID: Components.ID("{d8903bf6-68d5-4e97-bcd1-e4d3012f721a}"),

  QueryInterface: ChromeUtils.generateQI([Ci.nsIContentPermissionPrompt]),

  /**
   * This implementation of nsIContentPermissionPrompt.prompt ensures
   * that there's only one nsIContentPermissionType in the request,
   * and that it's of type nsIContentPermissionType. Failing to
   * satisfy either of these conditions will result in this method
   * throwing NS_ERRORs. If the combined ContentPermissionIntegration
   * cannot construct a prompt for this particular request, an
   * NS_ERROR_FAILURE will be thrown.
   *
   * Any time an error is thrown, the nsIContentPermissionRequest is
   * cancelled automatically.
   *
   * @param {nsIContentPermissionRequest} request
   *        The request that we're to show a prompt for.
   */
  prompt(request) {
__L_V__0({
    lN: 4271,tT:'func',pr:'',eT:{'request':request},fN:'prompt'
  });'__L_V__0';
    if (request.element && request.element.fxrPermissionPrompt) {
__L_V__0({
    lN: 4272,tT:'if',pr:'request.element && request.element.fxrPermissionPrompt',eT:{},fN:''
  });'__L_V__0';
      // For Firefox Reality on Desktop, switch to a different mechanism to
      // prompt the user since fewer permissions are available and since many
      // UI dependencies are not availabe.
      request.element.fxrPermissionPrompt(request);
      return;
    }

    let type;
    try {
      // Only allow exactly one permission request here.
      let types = request.types.QueryInterface(Ci.nsIArray);
      if (types.length != 1) {
__L_V__0({
    lN: 4284,tT:'if',pr:'types.length != 1',eT:{},fN:''
  });'__L_V__0';
        throw Components.Exception(
          "Expected an nsIContentPermissionRequest with only 1 type.",
          Cr.NS_ERROR_UNEXPECTED
        );
      }

      type = types.queryElementAt(0, Ci.nsIContentPermissionType).type;
      let combinedIntegration = Integration.contentPermission.getCombined(
        ContentPermissionIntegration
      );

      let permissionPrompt = combinedIntegration.createPermissionPrompt(
        type,
        request
      );
      if (!permissionPrompt) {
__L_V__0({
    lN: 4300,tT:'if',pr:'!permissionPrompt',eT:{},fN:''
  });'__L_V__0';
        throw Components.Exception(
          `Failed to handle permission of type ${type}`,
          Cr.NS_ERROR_FAILURE
        );
      }

      permissionPrompt.prompt();
    } catch (ex) {
      Cu.reportError(ex);
      request.cancel();
      throw ex;
    }

    let schemeHistogram = Services.telemetry.getKeyedHistogramById(
      "PERMISSION_REQUEST_ORIGIN_SCHEME"
    );
    let scheme = 0;
    try {
      if (request.principal.schemeIs("http")) {
__L_V__0({
    lN: 4319,tT:'if',pr:'request.principal.schemeIs(http)',eT:{},fN:''
  });'__L_V__0';
        scheme = 1;
      } else if (request.principal.schemeIs("https")) {
__L_V__0({
    lN: 4321,tT:'if',pr:'request.principal.schemeIs(https)',eT:{},fN:''
  });'__L_V__0';
        scheme = 2;
      }
    } catch (ex) {
      // If the request principal is not available at this point,
      // the request has likely been cancelled before being shown to the
      // user. We shouldn't record this request.
      if (ex.result != Cr.NS_ERROR_FAILURE) {
__L_V__0({
    lN: 4328,tT:'if',pr:'ex.result != Cr.NS_ERROR_FAILURE',eT:{},fN:''
  });'__L_V__0';
        Cu.reportError(ex);
      }
      return;
    }
    schemeHistogram.add(type, scheme);

    let userInputHistogram = Services.telemetry.getKeyedHistogramById(
      "PERMISSION_REQUEST_HANDLING_USER_INPUT"
    );
    userInputHistogram.add(type, request.isHandlingUserInput);
  },
};

var DefaultBrowserCheck = {
  get OPTIONPOPUP() {
__L_V__0({
    lN: 4343,tT:'func',pr:'',eT:{},fN:'OPTIONPOPUP'
  });'__L_V__0';
    return "defaultBrowserNotificationPopup";
  },

  closePrompt(aNode) {
__L_V__0({
    lN: 4347,tT:'func',pr:'',eT:{'aNode':aNode},fN:'closePrompt'
  });'__L_V__0';
    if (this._notification) {
__L_V__0({
    lN: 4348,tT:'if',pr:'this._notification',eT:{},fN:''
  });'__L_V__0';
      this._notification.close();
    }
  },

  setAsDefault() {
__L_V__0({
    lN: 4353,tT:'func',pr:'',eT:{},fN:'setAsDefault'
  });'__L_V__0';
    let claimAllTypes = true;
    let setAsDefaultError = false;
    if (AppConstants.platform == "win") {
__L_V__0({
    lN: 4356,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__0';
      try {
        // In Windows 8+, the UI for selecting default protocol is much
        // nicer than the UI for setting file type associations. So we
        // only show the protocol association screen on Windows 8+.
        // Windows 8 is version 6.2.
        let version = Services.sysinfo.getProperty("version");
        claimAllTypes = parseFloat(version) < 6.2;
      } catch (ex) {}
    }
    try {
      ShellService.setDefaultBrowser(claimAllTypes, false);
    } catch (ex) {
      setAsDefaultError = true;
      Cu.reportError(ex);
    }
    // Here BROWSER_IS_USER_DEFAULT and BROWSER_SET_USER_DEFAULT_ERROR appear
    // to be inverse of each other, but that is only because this function is
    // called when the browser is set as the default. During startup we record
    // the BROWSER_IS_USER_DEFAULT value without recording BROWSER_SET_USER_DEFAULT_ERROR.
    Services.telemetry
      .getHistogramById("BROWSER_IS_USER_DEFAULT")
      .add(!setAsDefaultError);
    Services.telemetry
      .getHistogramById("BROWSER_SET_DEFAULT_ERROR")
      .add(setAsDefaultError);
  },

  _createPopup(win, notNowStrings, neverStrings) {
__L_V__0({
    lN: 4384,tT:'func',pr:'',eT:{'win':win,'notNowStrings':notNowStrings,'neverStrings':neverStrings},fN:'_createPopup'
  });'__L_V__0';
    let doc = win.document;
    let popup = doc.createXULElement("menupopup");
    popup.id = this.OPTIONPOPUP;

    let notNowItem = doc.createXULElement("menuitem");
    notNowItem.id = "defaultBrowserNotNow";
    notNowItem.setAttribute("label", notNowStrings.label);
    notNowItem.setAttribute("accesskey", notNowStrings.accesskey);
    popup.appendChild(notNowItem);

    let neverItem = doc.createXULElement("menuitem");
    neverItem.id = "defaultBrowserNever";
    neverItem.setAttribute("label", neverStrings.label);
    neverItem.setAttribute("accesskey", neverStrings.accesskey);
    popup.appendChild(neverItem);

    popup.addEventListener("command", this);

    let popupset = doc.getElementById("mainPopupSet");
    popupset.appendChild(popup);
  },

  handleEvent(event) {
__L_V__0({
    lN: 4407,tT:'func',pr:'',eT:{'event':event},fN:'handleEvent'
  });'__L_V__0';
    if (event.type == "command") {
__L_V__0({
    lN: 4408,tT:'if',pr:'event.type == command',eT:{},fN:''
  });'__L_V__0';
      if (event.target.id == "defaultBrowserNever") {
__L_V__0({
    lN: 4409,tT:'if',pr:'event.target.id == defaultBrowserNever',eT:{},fN:''
  });'__L_V__0';
        ShellService.shouldCheckDefaultBrowser = false;
      }
      this.closePrompt();
    }
  },

  prompt(win) {
__L_V__0({
    lN: 4416,tT:'func',pr:'',eT:{'win':win},fN:'prompt'
  });'__L_V__0';
    let useNotificationBar = Services.prefs.getBoolPref(
      "browser.defaultbrowser.notificationbar"
    );

    let brandBundle = win.document.getElementById("bundle_brand");
    let brandShortName = brandBundle.getString("brandShortName");

    let shellBundle = win.document.getElementById("bundle_shell");
    let buttonPrefix =
      "setDefaultBrowser" + (useNotificationBar ? "" : "Alert");
    let yesButton = shellBundle.getFormattedString(
      buttonPrefix + "Confirm.label",
      [brandShortName]
    );
    let notNowButton = shellBundle.getString(buttonPrefix + "NotNow.label");

    if (useNotificationBar) {
__L_V__0({
    lN: 4433,tT:'if',pr:'useNotificationBar',eT:{},fN:''
  });'__L_V__0';
      let promptMessage = shellBundle.getFormattedString(
        "setDefaultBrowserMessage2",
        [brandShortName]
      );
      let optionsMessage = shellBundle.getString(
        "setDefaultBrowserOptions.label"
      );
      let optionsKey = shellBundle.getString(
        "setDefaultBrowserOptions.accesskey"
      );

      let neverLabel = shellBundle.getString("setDefaultBrowserNever.label");
      let neverKey = shellBundle.getString("setDefaultBrowserNever.accesskey");

      let yesButtonKey = shellBundle.getString(
        "setDefaultBrowserConfirm.accesskey"
      );
      let notNowButtonKey = shellBundle.getString(
        "setDefaultBrowserNotNow.accesskey"
      );

      this._createPopup(
        win,
        {
          label: notNowButton,
          accesskey: notNowButtonKey,
        },
        {
          label: neverLabel,
          accesskey: neverKey,
        }
      );

      let buttons = [
        {
          label: yesButton,
          accessKey: yesButtonKey,
          callback: () => {
            this.setAsDefault();
            this.closePrompt();
          },
        },
        {
          label: optionsMessage,
          accessKey: optionsKey,
          popup: this.OPTIONPOPUP,
        },
      ];

      let iconPixels = win.devicePixelRatio > 1 ? "32" : "16";
      let iconURL = "chrome://branding/content/icon" + iconPixels + ".png";
      const priority = win.gHighPriorityNotificationBox.PRIORITY_WARNING_HIGH;
      let callback = this._onNotificationEvent.bind(this);
      this._notification = win.gHighPriorityNotificationBox.appendNotification(
        promptMessage,
        "default-browser",
        iconURL,
        priority,
        buttons,
        callback
      );
    } else {
      // Modal prompt
      let promptTitle = shellBundle.getString("setDefaultBrowserTitle");
      let promptMessage = shellBundle.getFormattedString(
        "setDefaultBrowserMessage",
        [brandShortName]
      );
      let askLabel = shellBundle.getFormattedString(
        "setDefaultBrowserDontAsk",
        [brandShortName]
      );

      let ps = Services.prompt;
      let shouldAsk = { value: true };
      let buttonFlags =
        ps.BUTTON_TITLE_IS_STRING * ps.BUTTON_POS_0 +
        ps.BUTTON_TITLE_IS_STRING * ps.BUTTON_POS_1 +
        ps.BUTTON_POS_0_DEFAULT;
      let rv = ps.confirmEx(
        win,
        promptTitle,
        promptMessage,
        buttonFlags,
        yesButton,
        notNowButton,
        null,
        null,
        { value: 0 }
      );
      if (rv == 0) {
__L_V__0({
    lN: 4524,tT:'if',pr:'rv == 0',eT:{},fN:''
  });'__L_V__0';
        this.setAsDefault();
      } else if (!shouldAsk.value) {
__L_V__0({
    lN: 4526,tT:'if',pr:'!shouldAsk.value',eT:{},fN:''
  });'__L_V__0';
        ShellService.shouldCheckDefaultBrowser = false;
      }

      try {
        let resultEnum = rv * 2 + shouldAsk.value;
        Services.telemetry
          .getHistogramById("BROWSER_SET_DEFAULT_RESULT")
          .add(resultEnum);
      } catch (ex) {
        /* Don't break if Telemetry is acting up. */
      }
    }
  },

  _onNotificationEvent(eventType) {
__L_V__0({
    lN: 4541,tT:'func',pr:'',eT:{'eventType':eventType},fN:'_onNotificationEvent'
  });'__L_V__0';
    if (eventType == "removed") {
__L_V__0({
    lN: 4542,tT:'if',pr:'eventType == removed',eT:{},fN:''
  });'__L_V__0';
      let doc = this._notification.ownerDocument;
      let popup = doc.getElementById(this.OPTIONPOPUP);
      popup.removeEventListener("command", this);
      popup.remove();
      delete this._notification;
    }
  },

  _cliqz_customHandleForDefaultBrowserCheck() {
__L_V__0({
    lN: 4551,tT:'func',pr:'',eT:{},fN:'_cliqz_customHandleForDefaultBrowserCheck'
  });'__L_V__0';
    let defaultBrowserCheckFlag = false;
    let firstDefaultBrowserCheckTimestamp =
      Services.prefs.getPrefType("browser.shell.firstDefaultBrowserCheckTimestamp") !== 0 ?
        Services.prefs.getIntPref("browser.shell.firstDefaultBrowserCheckTimestamp") :
        null;

    if (!firstDefaultBrowserCheckTimestamp) {
__L_V__0({
    lN: 4558,tT:'if',pr:'!firstDefaultBrowserCheckTimestamp',eT:{},fN:''
  });'__L_V__0';
      firstDefaultBrowserCheckTimestamp = parseInt(Date.now() / 1000);
      Services.prefs.setIntPref("browser.shell.firstDefaultBrowserCheckTimestamp", firstDefaultBrowserCheckTimestamp);
    }

    let checkLevel =
      Services.prefs.getPrefType("browser.shell.defaultBrowserCheckLevel") !== 0 ?
        Services.prefs.getIntPref("browser.shell.defaultBrowserCheckLevel"):
        0;

    function setLevel(val) {
__L_V__0({
    lN: 4568,tT:'func',pr:'',eT:{'val':val},fN:'setLevel'
  });'__L_V__0';
      Services.prefs.setIntPref("browser.shell.defaultBrowserCheckLevel", val);
      popupCount++;
      Services.prefs.setIntPref("browser.shell.defaultBrowserCheckCount", popupCount);
      return true;
    }

    if (firstDefaultBrowserCheckTimestamp && willPrompt) {
__L_V__0({
    lN: 4575,tT:'if',pr:'firstDefaultBrowserCheckTimestamp && willPrompt',eT:{},fN:''
  });'__L_V__0';
      let whatsNow = parseInt(Date.now() / 1000);
      let timeDiff = whatsNow - firstDefaultBrowserCheckTimestamp;
      let monthAge = 30 * 24 * 60 * 60;
      let monthCount = Math.floor(timeDiff / monthAge);
      let fortNightAge = 15 * 24 * 60 * 60;
      let weekAge = 7 * 24 * 60 * 60;
      if (timeDiff < weekAge) {
__L_V__0({
    lN: 4582,tT:'if',pr:'timeDiff < weekAge',eT:{},fN:''
  });'__L_V__0';
        if (checkLevel == 0) {
__L_V__0({
    lN: 4583,tT:'if',pr:'checkLevel == 0',eT:{},fN:''
  });'__L_V__0';
          defaultBrowserCheckFlag = setLevel(1);
        }
      } else if (timeDiff < fortNightAge) {
__L_V__0({
    lN: 4586,tT:'if',pr:'timeDiff < fortNightAge',eT:{},fN:''
  });'__L_V__0';
        if (checkLevel <= 1) {
__L_V__0({
    lN: 4587,tT:'if',pr:'checkLevel <= 1',eT:{},fN:''
  });'__L_V__0';
          defaultBrowserCheckFlag = setLevel(2);
        }
      } else if (timeDiff < monthAge) {
__L_V__0({
    lN: 4590,tT:'if',pr:'timeDiff < monthAge',eT:{},fN:''
  });'__L_V__0';
        if (checkLevel <= 2) {
__L_V__0({
    lN: 4591,tT:'if',pr:'checkLevel <= 2',eT:{},fN:''
  });'__L_V__0';
          defaultBrowserCheckFlag = setLevel(3);
        }
      } else {
        let monthLevel = monthCount + 3;
        if (checkLevel < monthLevel) {
__L_V__0({
    lN: 4596,tT:'if',pr:'checkLevel < monthLevel',eT:{},fN:''
  });'__L_V__0';
          defaultBrowserCheckFlag = setLevel(monthLevel);
        }
      }
    }

    return defaultBrowserCheckFlag;
  },

  /**
   * Checks if the default browser check prompt will be shown.
   * @param {boolean} isStartupCheck
   *   If true, prefs will be set and telemetry will be recorded.
   * @returns {boolean} True if the default browser check prompt will be shown.
   */
  async willCheckDefaultBrowser(isStartupCheck) {
__L_V__0({
    lN: 4611,tT:'func',pr:'',eT:{'isStartupCheck':isStartupCheck},fN:'willCheckDefaultBrowser'
  });'__L_V__0';
    // Perform default browser checking.
    if (!ShellService) {
__L_V__0({
    lN: 4613,tT:'if',pr:'!ShellService',eT:{},fN:''
  });'__L_V__0';
      return false;
    }

    let shouldCheck =
      !AppConstants.DEBUG && ShellService.shouldCheckDefaultBrowser;

    // Even if we shouldn't check the default browser, we still continue when
    // isStartupCheck = true to set prefs and telemetry.
    if (!shouldCheck && !isStartupCheck) {
__L_V__0({
    lN: 4622,tT:'if',pr:'!shouldCheck && !isStartupCheck',eT:{},fN:''
  });'__L_V__0';
      return false;
    }

    // Skip the "Set Default Browser" check during first-run or after the
    // browser has been run a few times.
    const skipDefaultBrowserCheck =
      Services.prefs.getBoolPref(
        "browser.shell.skipDefaultBrowserCheckOnFirstRun"
      ) &&
      !Services.prefs.getBoolPref(
        "browser.shell.didSkipDefaultBrowserCheckOnFirstRun"
      );

    const usePromptLimit = !AppConstants.RELEASE_OR_BETA;
    let promptCount = usePromptLimit
      ? Services.prefs.getIntPref("browser.shell.defaultBrowserCheckCount")
      : 0;

    // If SessionStartup's state is not initialized, checking sessionType will set
    // its internal state to "do not restore".
    await SessionStartup.onceInitialized;
    let willRecoverSession =
      SessionStartup.sessionType == SessionStartup.RECOVER_SESSION;

    // Don't show the prompt if we're already the default browser.
    let isDefault = false;
    let isDefaultError = false;
    try {
      isDefault = ShellService.isDefaultBrowser(isStartupCheck, false);
    } catch (ex) {
      isDefaultError = true;
    }

    if (isDefault && isStartupCheck) {
__L_V__0({
    lN: 4656,tT:'if',pr:'isDefault && isStartupCheck',eT:{},fN:''
  });'__L_V__0';
      let now = Math.floor(Date.now() / 1000).toString();
      Services.prefs.setCharPref(
        "browser.shell.mostRecentDateSetAsDefault",
        now
      );
    }

    let willPrompt = shouldCheck && !isDefault && !willRecoverSession;

    if (willPrompt) {
__L_V__0({
    lN: 4666,tT:'if',pr:'willPrompt',eT:{},fN:''
  });'__L_V__0';
      if (skipDefaultBrowserCheck) {
__L_V__0({
    lN: 4667,tT:'if',pr:'skipDefaultBrowserCheck',eT:{},fN:''
  });'__L_V__0';
        if (isStartupCheck) {
__L_V__0({
    lN: 4668,tT:'if',pr:'isStartupCheck',eT:{},fN:''
  });'__L_V__0';
          Services.prefs.setBoolPref(
            "browser.shell.didSkipDefaultBrowserCheckOnFirstRun",
            true
          );
        }
        willPrompt = false;
      }
      /* CLIQZ-SPECIAL: Avoid FF handling of default browser msg popup
      if (usePromptLimit) {
__L_V__0({
    lN: 4677,tT:'if',pr:'usePromptLimit',eT:{},fN:''
  });'__L_V__0';
        promptCount++;
        if (isStartupCheck) {
__L_V__0({
    lN: 4679,tT:'if',pr:'isStartupCheck',eT:{},fN:''
  });'__L_V__0';
          Services.prefs.setIntPref(
            "browser.shell.defaultBrowserCheckCount",
            promptCount
          );
        }
        
        if (promptCount > 3) {
__L_V__0({
    lN: 4686,tT:'if',pr:'promptCount > 3',eT:{},fN:''
  });'__L_V__0';
          willPrompt = false;
        }
        
      }
      */
    }

    if (isStartupCheck) {
__L_V__0({
    lN: 4694,tT:'if',pr:'isStartupCheck',eT:{},fN:''
  });'__L_V__0';
      try {
        // Report default browser status on startup to telemetry
        // so we can track whether we are the default.
        Services.telemetry
          .getHistogramById("BROWSER_IS_USER_DEFAULT")
          .add(isDefault);
        Services.telemetry
          .getHistogramById("BROWSER_IS_USER_DEFAULT_ERROR")
          .add(isDefaultError);
        Services.telemetry
          .getHistogramById("BROWSER_SET_DEFAULT_ALWAYS_CHECK")
          .add(shouldCheck);
        Services.telemetry
          .getHistogramById("BROWSER_SET_DEFAULT_DIALOG_PROMPT_RAWCOUNT")
          .add(promptCount);
      } catch (ex) {
        /* Don't break the default prompt if telemetry is broken. */
      }
    }

    // CLIQZ-SPECIAL: custom default browser logic
    return willPrompt && this._cliqz_customHandleForDefaultBrowserCheck();
  },
};

/*
 * Prompts users who have an outdated JAWS screen reader informing
 * them they need to update JAWS or switch to esr. Can be removed
 * 12/31/2018.
 */
var JawsScreenReaderVersionCheck = {
  _prompted: false,

  init() {
__L_V__0({
    lN: 4728,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__0';
    Services.obs.addObserver(this, "a11y-init-or-shutdown", true);
  },

  QueryInterface: ChromeUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference,
  ]),

  observe(subject, topic, data) {
__L_V__0({
    lN: 4737,tT:'func',pr:'',eT:{'subject':subject,'topic':topic,'data':data},fN:'observe'
  });'__L_V__0';
    if (topic == "a11y-init-or-shutdown" && data == "1") {
__L_V__0({
    lN: 4738,tT:'if',pr:'topic == a11y-init-or-shutdown && data == 1',eT:{},fN:''
  });'__L_V__0';
      Services.tm.dispatchToMainThread(() => this._checkVersionAndPrompt());
    }
  },

  onWindowsRestored() {
__L_V__0({
    lN: 4743,tT:'func',pr:'',eT:{},fN:'onWindowsRestored'
  });'__L_V__0';
    Services.tm.dispatchToMainThread(() => this._checkVersionAndPrompt());
  },

  _checkVersionAndPrompt() {
__L_V__0({
    lN: 4747,tT:'func',pr:'',eT:{},fN:'_checkVersionAndPrompt'
  });'__L_V__0';
    // Make sure we only prompt for versions of JAWS we do not
    // support and never prompt if e10s is disabled or if we're on
    // nightly.
    if (
      !Services.appinfo.shouldBlockIncompatJaws ||
      !Services.appinfo.browserTabsRemoteAutostart ||
      AppConstants.NIGHTLY_BUILD
    ) {
__L_V__0({
    lN: 4755,tT:'if',pr:' !Services.appinfo.shouldBlockIncompatJaws || !Services.appinfo.browserTabsRemoteAutostart || AppConstants.NIGHTLY_BUILD ',eT:{},fN:''
  });'__L_V__0';
      return;
    }

    let win = BrowserWindowTracker.getTopWindow();
    if (!win || !win.gBrowser || !win.gBrowser.selectedBrowser) {
__L_V__0({
    lN: 4760,tT:'if',pr:'!win || !win.gBrowser || !win.gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__0';
      Services.console.logStringMessage(
        "Content access support for older versions of JAWS is disabled " +
          "due to compatibility issues with this version of Firefox."
      );
      this._prompted = false;
      return;
    }

    // Only prompt once per session
    if (this._prompted) {
__L_V__0({
    lN: 4770,tT:'if',pr:'this._prompted',eT:{},fN:''
  });'__L_V__0';
      return;
    }
    this._prompted = true;

    let browser = win.gBrowser.selectedBrowser;

    // Prompt JAWS users to let them know they need to update
    let promptMessage = win.gNavigatorBundle.getFormattedString(
      "e10s.accessibilityNotice.jawsMessage",
      [gBrandBundle.GetStringFromName("brandShortName")]
    );
    let notification;
    // main option: an Ok button, keeps running with content accessibility disabled
    let mainAction = {
      label: win.gNavigatorBundle.getString(
        "e10s.accessibilityNotice.acceptButton.label"
      ),
      accessKey: win.gNavigatorBundle.getString(
        "e10s.accessibilityNotice.acceptButton.accesskey"
      ),
      callback() {
__L_V__0({
    lN: 4791,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__0';
        // If the user invoked the button option remove the notification,
        // otherwise keep the alert icon around in the address bar.
        notification.remove();
      },
    };
    let options = {
      popupIconURL: "chrome://browser/skin/e10s-64@2x.png",
      persistWhileVisible: true,
      persistent: true,
      persistence: 100,
    };

    notification = win.PopupNotifications.show(
      browser,
      "e10s_enabled_with_incompat_jaws",
      promptMessage,
      null,
      mainAction,
      null,
      options
    );
  },
};
