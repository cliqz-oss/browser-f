
/*LS-666865*/var { CliqzLogger } = ChromeUtils.import('resource://gre/modules/CliqzLogger.jsm');
var __L_V__1 = CliqzLogger.init('mozilla-release/browser/components/BrowserContentHandler.jsm','BrowserContentHandler');/*LE-666865*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = [
  "nsBrowserContentHandler",
  "nsDefaultCommandLineHandler",
];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AboutPrivateBrowsingHandler:
    "resource:///modules/aboutpages/AboutPrivateBrowsingHandler.jsm",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  HeadlessShell: "resource:///modules/HeadlessShell.jsm",
  HomePage: "resource:///modules/HomePage.jsm",
  FirstStartup: "resource://gre/modules/FirstStartup.jsm",
  LaterRun: "resource:///modules/LaterRun.jsm",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  SessionStartup: "resource:///modules/sessionstore/SessionStartup.jsm",
  ShellService: "resource:///modules/ShellService.jsm",
  UpdatePing: "resource://gre/modules/UpdatePing.jsm",
#if 0
  RemotePages:
    "resource://gre/modules/remotepagemanager/RemotePageManagerParent.jsm",
#endif
});
XPCOMUtils.defineLazyServiceGetter(
  this,
  "WindowsUIUtils",
  "@mozilla.org/windows-ui-utils;1",
  "nsIWindowsUIUtils"
);
XPCOMUtils.defineLazyServiceGetter(
  this,
  "UpdateManager",
  "@mozilla.org/updates/update-manager;1",
  "nsIUpdateManager"
);

XPCOMUtils.defineLazyGetter(this, "gSystemPrincipal", () =>
  Services.scriptSecurityManager.getSystemPrincipal()
);
#if 0
XPCOMUtils.defineLazyGlobalGetters(this, [URL]);

const NEWINSTALL_PAGE = "about:newinstall";
#endif

// One-time startup homepage override configurations
const ONCE_DOMAINS = ["mozilla.org", "firefox.com"];
const ONCE_PREF = "browser.startup.homepage_override.once";

function shouldLoadURI(aURI) {
__L_V__1({
    lN: 64,tT:'func',pr:'',eT:{'aURI':aURI},fN:'shouldLoadURI'
  });'__L_V__1';
  if (aURI && !aURI.schemeIs("chrome")) {
__L_V__1({
    lN: 65,tT:'if',pr:'aURI && !aURI.schemeIs(chrome)',eT:{},fN:''
  });'__L_V__1';
    return true;
  }

  dump("*** Preventing external load of chrome: URI into browser window\n");
  dump("    Use --chrome <uri> instead\n");
  return false;
}

function resolveURIInternal(aCmdLine, aArgument) {
__L_V__1({
    lN: 74,tT:'func',pr:'',eT:{'aCmdLine':aCmdLine,'aArgument':aArgument},fN:'resolveURIInternal'
  });'__L_V__1';
  var uri = aCmdLine.resolveURI(aArgument);
  var uriFixup = Services.uriFixup;

  if (!(uri instanceof Ci.nsIFileURL)) {
__L_V__1({
    lN: 78,tT:'if',pr:'!(uri instanceof Ci.nsIFileURL)',eT:{},fN:''
  });'__L_V__1';
    return uriFixup.createFixupURI(
      aArgument,
      uriFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS
    );
  }

  try {
    if (uri.file.exists()) {
__L_V__1({
    lN: 86,tT:'if',pr:'uri.file.exists()',eT:{},fN:''
  });'__L_V__1';
      return uri;
    }
  } catch (e) {
    Cu.reportError(e);
  }

  // We have interpreted the argument as a relative file URI, but the file
  // doesn't exist. Try URI fixup heuristics: see bug 290782.

  try {
    uri = uriFixup.createFixupURI(aArgument, 0);
  } catch (e) {
    Cu.reportError(e);
  }

  return uri;
}

let gKiosk = false;
#if 0
let gRemoteInstallPage = null;

function getNewInstallPage() {
__L_V__1({
    lN: 109,tT:'func',pr:'',eT:{},fN:'getNewInstallPage'
  });'__L_V__1';
  if (!gRemoteInstallPage) {
__L_V__1({
    lN: 110,tT:'if',pr:'!gRemoteInstallPage',eT:{},fN:''
  });'__L_V__1';
    gRemoteInstallPage = new RemotePages(NEWINSTALL_PAGE);
  }

  return NEWINSTALL_PAGE;
}
#endif
var gFirstWindow = false;

const OVERRIDE_NONE = 0;
const OVERRIDE_NEW_PROFILE = 1;
const OVERRIDE_NEW_MSTONE = 2;
const OVERRIDE_NEW_BUILD_ID = 3;
#if 0
const OVERRIDE_ALTERNATE_PROFILE = 4;
#endif
/**
 * Determines whether a home page override is needed.
 * Returns:
 *  OVERRIDE_NEW_PROFILE if this is the first run with a new profile.
 *  OVERRIDE_NEW_MSTONE if this is the first run with a build with a different
 *                      Gecko milestone (i.e. right after an upgrade).
 *  OVERRIDE_NEW_BUILD_ID if this is the first run with a new build ID of the
 *                        same Gecko milestone (i.e. after a nightly upgrade).
 *  OVERRIDE_NONE otherwise.
 */
function needHomepageOverride(prefb) {
__L_V__1({
    lN: 136,tT:'func',pr:'',eT:{'prefb':prefb},fN:'needHomepageOverride'
  });'__L_V__1';
#if 0
  let pService = Cc["@mozilla.org/toolkit/profile-service;1"].getService(
    Ci.nsIToolkitProfileService
  );
  if (pService.createdAlternateProfile) {
__L_V__1({
    lN: 141,tT:'if',pr:'pService.createdAlternateProfile',eT:{},fN:''
  });'__L_V__1';
    return OVERRIDE_ALTERNATE_PROFILE;
  }
#endif
  var savedmstone = prefb.getCharPref(
    "browser.startup.homepage_override.mstone",
    ""
  );

  // CLIQZ-SPECIAL: DB-2131 | DB-2186,
  // We should show WhatsNewPage for a user only in case of there is something to tell about;
  // That includes major updates only + the fact that these updates have definitely
  // features we would like to promote.
  const shouldShowWhatsNew = prefb.getBoolPref(
    "browser.migration.showWhatsNew",
    false
  );
  if (shouldShowWhatsNew) {
__L_V__1({
    lN: 158,tT:'if',pr:'shouldShowWhatsNew',eT:{},fN:''
  });'__L_V__1';
    // set the flag to false to not show next time
    Services.prefs.setBoolPref("browser.migration.showWhatsNew", false);
  }

  if (savedmstone == "ignore") {
__L_V__1({
    lN: 163,tT:'if',pr:'savedmstone == ignore',eT:{},fN:''
  });'__L_V__1';
    return OVERRIDE_NONE;
  }

  var mstone = Services.appinfo.platformVersion;

  var savedBuildID = prefb.getCharPref(
    "browser.startup.homepage_override.buildID",
    ""
  );

  var buildID = Services.appinfo.platformBuildID;

  if (mstone != savedmstone) {
__L_V__1({
    lN: 176,tT:'if',pr:'mstone != savedmstone',eT:{},fN:''
  });'__L_V__1';
    // Bug 462254. Previous releases had a default pref to suppress the EULA
    // agreement if the platform's installer had already shown one. Now with
    // about:rights we've removed the EULA stuff and default pref, but we need
    // a way to make existing profiles retain the default that we removed.
    if (savedmstone) {
__L_V__1({
    lN: 181,tT:'if',pr:'savedmstone',eT:{},fN:''
  });'__L_V__1';
      prefb.setBoolPref("browser.rights.3.shown", true);
    }

    prefb.setCharPref("browser.startup.homepage_override.mstone", mstone);
    prefb.setCharPref("browser.startup.homepage_override.buildID", buildID);
    return shouldShowWhatsNew ? OVERRIDE_NEW_MSTONE : OVERRIDE_NEW_PROFILE;
  }

  if (buildID != savedBuildID) {
__L_V__1({
    lN: 190,tT:'if',pr:'buildID != savedBuildID',eT:{},fN:''
  });'__L_V__1';
    prefb.setCharPref("browser.startup.homepage_override.buildID", buildID);
    return OVERRIDE_NEW_BUILD_ID;
  }

  return OVERRIDE_NONE;
}

/**
 * Gets the override page for the first run after the application has been
 * updated.
 * @param  update
 *         The nsIUpdate for the update that has been applied.
 * @param  defaultOverridePage
 *         The default override page.
 * @return The override page.
 */
function getPostUpdateOverridePage(update, defaultOverridePage) {
__L_V__1({
    lN: 207,tT:'func',pr:'',eT:{'update':update,'defaultOverridePage':defaultOverridePage},fN:'getPostUpdateOverridePage'
  });'__L_V__1';
  update = update.QueryInterface(Ci.nsIWritablePropertyBag);
  let actions = update.getProperty("actions");
  // When the update doesn't specify actions fallback to the original behavior
  // of displaying the default override page.
  if (!actions) {
__L_V__1({
    lN: 212,tT:'if',pr:'!actions',eT:{},fN:''
  });'__L_V__1';
    return defaultOverridePage;
  }

  // The existence of silent or the non-existence of showURL in the actions both
  // mean that an override page should not be displayed.
  if (actions.includes("silent") || !actions.includes("showURL")) {
__L_V__1({
    lN: 218,tT:'if',pr:'actions.includes(silent) || !actions.includes(showURL)',eT:{},fN:''
  });'__L_V__1';
    return "";
  }

  // If a policy was set to not allow the update.xml-provided
  // URL to be used, use the default fallback (which will also
  // be provided by the policy).
  if (!Services.policies.isAllowed("postUpdateCustomPage")) {
__L_V__1({
    lN: 225,tT:'if',pr:'!Services.policies.isAllowed(postUpdateCustomPage)',eT:{},fN:''
  });'__L_V__1';
    return defaultOverridePage;
  }

  return update.getProperty("openURL") || defaultOverridePage;
}

function isCommandLineInitialLaunch(cmdLine) {
__L_V__1({
    lN: 232,tT:'func',pr:'',eT:{'cmdLine':cmdLine},fN:'isCommandLineInitialLaunch'
  });'__L_V__1';
  return cmdLine.state == Ci.nsICommandLine.STATE_INITIAL_LAUNCH;
}
/**
 * Open a browser window. If this is the initial launch, this function will
 * attempt to use the navigator:blank window opened by BrowserGlue.jsm during
 * early startup.
 *
 * @param cmdLine
 *        The nsICommandLine object given to nsICommandLineHandler's handle
 *        method.
 *        Used to check if we are processing the command line for the initial launch.
 * @param triggeringPrincipal
 *        The nsIPrincipal to use as triggering principal for the page load(s).
 * @param urlOrUrlList (optional)
 *        When omitted, the browser window will be opened with the default
 *        arguments, which will usually load the homepage.
 *        This can be a JS array of urls provided as strings, each url will be
 *        loaded in a tab. postData will be ignored in this case.
 *        This can be a single url to load in the new window, provided as a string.
 *        postData will be used in this case if provided.
 * @param postData (optional)
 *        An nsIInputStream object to use as POST data when loading the provided
 *        url, or null.
 * @param forcePrivate (optional)
 *        Boolean. If set to true, the new window will be a private browsing one.
 *
 * @returns {ChromeWindow}
 *          Returns the top level window opened.
 */
function openBrowserWindow(
  cmdLine,
  triggeringPrincipal,
  urlOrUrlList,
  postData = null,
  forcePrivate = false
) {
__L_V__1({
    lN: 268,tT:'func',pr:'',eT:{'cmdLine':cmdLine,'triggeringPrincipal':triggeringPrincipal,'urlOrUrlList':urlOrUrlList,'postData':postData,'forcePrivate':forcePrivate},fN:'openBrowserWindow'
  });'__L_V__1';
  let chromeURL = AppConstants.BROWSER_CHROME_URL;
  const isStartup =
    cmdLine && cmdLine.state == Ci.nsICommandLine.STATE_INITIAL_LAUNCH;

  let args;
  if (!urlOrUrlList) {
__L_V__1({
    lN: 274,tT:'if',pr:'!urlOrUrlList',eT:{},fN:''
  });'__L_V__1';
    // Just pass in the defaultArgs directly. We'll use system principal on the other end.
    args = [gBrowserContentHandler.getDefaultArgs(isCommandLineInitialLaunch(cmdLine))];
  } else {
#if 0
    let pService = Cc["@mozilla.org/toolkit/profile-service;1"].getService(
      Ci.nsIToolkitProfileService
    );
    if (isStartup && pService.createdAlternateProfile) {
__L_V__1({
    lN: 282,tT:'if',pr:'isStartup && pService.createdAlternateProfile',eT:{},fN:''
  });'__L_V__1';
      let url = getNewInstallPage();
      if (Array.isArray(urlOrUrlList)) {
__L_V__1({
    lN: 284,tT:'if',pr:'Array.isArray(urlOrUrlList)',eT:{},fN:''
  });'__L_V__1';
        urlOrUrlList.unshift(url);
      } else {
        urlOrUrlList = [url, urlOrUrlList];
      }
    }
#endif

    if (Array.isArray(urlOrUrlList)) {
__L_V__1({
    lN: 292,tT:'if',pr:'Array.isArray(urlOrUrlList)',eT:{},fN:''
  });'__L_V__1';
      // There isn't an explicit way to pass a principal here, so we load multiple URLs
      // with system principal when we get to actually loading them.
      if (
        !triggeringPrincipal ||
        !triggeringPrincipal.equals(gSystemPrincipal)
      ) {
__L_V__1({
    lN: 298,tT:'if',pr:' !triggeringPrincipal || !triggeringPrincipal.equals(gSystemPrincipal) ',eT:{},fN:''
  });'__L_V__1';
        throw new Error(
          "Can't open multiple URLs with something other than system principal."
        );
      }
      // Passing an nsIArray for the url disables the "|"-splitting behavior.
      let uriArray = Cc["@mozilla.org/array;1"].createInstance(
        Ci.nsIMutableArray
      );
      urlOrUrlList.forEach(function(uri) {
        var sstring = Cc["@mozilla.org/supports-string;1"].createInstance(
          Ci.nsISupportsString
        );
        sstring.data = uri;
        uriArray.appendElement(sstring);
      });
      args = [uriArray];
    } else {
      // Always pass at least 3 arguments to avoid the "|"-splitting behavior,
      // ie. avoid the loadOneOrMoreURIs function.
      // Also, we need to pass the triggering principal.
      args = [
        urlOrUrlList,
        null, // charset
        null, // refererInfo
        postData,
        undefined, // allowThirdPartyFixup; this would be `false` but that
        // needs a conversion. Hopefully bug 1485961 will fix.
        undefined, // user context id
        null, // origin principal
        null, // origin storage principal
        triggeringPrincipal,
      ];
    }
  }

  if (isStartup) {
__L_V__1({
    lN: 334,tT:'if',pr:'isStartup',eT:{},fN:''
  });'__L_V__1';
    let win = Services.wm.getMostRecentWindow("navigator:blank");
    if (win) {
__L_V__1({
    lN: 336,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__1';
      // Remove the windowtype of our blank window so that we don't close it
      // later on when seeing cmdLine.preventDefault is true.
      win.document.documentElement.removeAttribute("windowtype");

      if (forcePrivate) {
__L_V__1({
    lN: 341,tT:'if',pr:'forcePrivate',eT:{},fN:''
  });'__L_V__1';
        win.docShell.QueryInterface(
          Ci.nsILoadContext
        ).usePrivateBrowsing = true;
      }

      win.location = chromeURL;
      win.arguments = args; // <-- needs to be a plain JS array here.

      return win;
    }
  }

  // We can't provide arguments to openWindow as a JS array.
  if (!urlOrUrlList) {
__L_V__1({
    lN: 355,tT:'if',pr:'!urlOrUrlList',eT:{},fN:''
  });'__L_V__1';
    // If we have a single string guaranteed to not contain '|' we can simply
    // wrap it in an nsISupportsString object.
    let [url] = args;
    args = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString
    );
    args.data = url;
  } else {
    // Otherwise, pass an nsIArray.
    if (args.length > 1) {
__L_V__1({
    lN: 365,tT:'if',pr:'args.length > 1',eT:{},fN:''
  });'__L_V__1';
      let string = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );
      string.data = args[0];
      args[0] = string;
    }
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    args.forEach(a => {
      array.appendElement(a);
    });
    args = array;
  }

  let features =
    "chrome,dialog=no,all" + gBrowserContentHandler.getFeatures(cmdLine);
  if (forcePrivate) {
__L_V__1({
    lN: 381,tT:'if',pr:'forcePrivate',eT:{},fN:''
  });'__L_V__1';
    features += ",private";
  }

  return Services.ww.openWindow(null, chromeURL, "_blank", features, args);
}

function openPreferences(cmdLine, extraArgs) {
__L_V__1({
    lN: 388,tT:'func',pr:'',eT:{'cmdLine':cmdLine,'extraArgs':extraArgs},fN:'openPreferences'
  });'__L_V__1';
  openBrowserWindow(cmdLine, gSystemPrincipal, "about:preferences");
}

async function doSearch(searchTerm, cmdLine) {
__L_V__1({
    lN: 392,tT:'func',pr:'',eT:{'searchTerm':searchTerm,'cmdLine':cmdLine},fN:'doSearch'
  });'__L_V__1';
  // XXXbsmedberg: use handURIToExistingBrowser to obey tabbed-browsing
  // preferences, but need nsIBrowserDOMWindow extensions
  // Open the window immediately as BrowserContentHandler needs to
  // be handled synchronously. Then load the search URI when the
  // SearchService has loaded.
  let win = openBrowserWindow(cmdLine, gSystemPrincipal, "about:blank");
  await new Promise(resolve => {
    Services.obs.addObserver(function observe(subject) {
__L_V__1({
    lN: 400,tT:'func',pr:'',eT:{'subject':subject},fN:'observe'
  });'__L_V__1';
      if (subject == win) {
__L_V__1({
    lN: 401,tT:'if',pr:'subject == win',eT:{},fN:''
  });'__L_V__1';
        Services.obs.removeObserver(
          observe,
          "browser-delayed-startup-finished"
        );
        resolve();
      }
    }, "browser-delayed-startup-finished");
  });

  win.BrowserSearch.loadSearchFromCommandLine(
    searchTerm,
    PrivateBrowsingUtils.isInTemporaryAutoStartMode ||
      PrivateBrowsingUtils.isWindowPrivate(win),
    gSystemPrincipal,
    win.gBrowser.selectedBrowser.csp
  ).catch(Cu.reportError);
}

function nsBrowserContentHandler() {
__L_V__1({
    lN: 420,tT:'func',pr:'',eT:{},fN:'nsBrowserContentHandler'
  });'__L_V__1';
  if (!gBrowserContentHandler) {
__L_V__1({
    lN: 421,tT:'if',pr:'!gBrowserContentHandler',eT:{},fN:''
  });'__L_V__1';
    gBrowserContentHandler = this;
  }
  return gBrowserContentHandler;
}
nsBrowserContentHandler.prototype = {
  /* nsISupports */
  QueryInterface: ChromeUtils.generateQI([
    Ci.nsICommandLineHandler,
    Ci.nsIBrowserHandler,
    Ci.nsIContentHandler,
    Ci.nsICommandLineValidator,
  ]),

  /* nsICommandLineHandler */
  handle: function bch_handle(cmdLine) {
__L_V__1({
    lN: 436,tT:'func',pr:'',eT:{'cmdLine':cmdLine},fN:'bch_handle'
  });'__L_V__1';
    if (cmdLine.handleFlag("kiosk", false)) {
__L_V__1({
    lN: 437,tT:'if',pr:'cmdLine.handleFlag(kiosk, false)',eT:{},fN:''
  });'__L_V__1';
      gKiosk = true;
    }
    if (cmdLine.handleFlag("browser", false)) {
__L_V__1({
    lN: 440,tT:'if',pr:'cmdLine.handleFlag(browser, false)',eT:{},fN:''
  });'__L_V__1';
      openBrowserWindow(cmdLine, gSystemPrincipal);
      cmdLine.preventDefault = true;
    }

    // In the past, when an instance was not already running, the -remote
    // option returned an error code. Any script or application invoking the
    // -remote option is expected to be handling this case, otherwise they
    // wouldn't be doing anything when there is no Firefox already running.
    // Making the -remote option always return an error code makes those
    // scripts or applications handle the situation as if Firefox was not
    // already running.
    if (cmdLine.handleFlag("remote", true)) {
__L_V__1({
    lN: 452,tT:'if',pr:'cmdLine.handleFlag(remote, true)',eT:{},fN:''
  });'__L_V__1';
      throw Cr.NS_ERROR_ABORT;
    }

    var uriparam;
    try {
      while ((uriparam = cmdLine.handleFlagWithParam("new-window", false))) {
        let uri = resolveURIInternal(cmdLine, uriparam);
        if (!shouldLoadURI(uri)) {
__L_V__1({
    lN: 460,tT:'if',pr:'!shouldLoadURI(uri)',eT:{},fN:''
  });'__L_V__1';
          continue;
        }
        openBrowserWindow(cmdLine, gSystemPrincipal, uri.spec);
        cmdLine.preventDefault = true;
      }
    } catch (e) {
      Cu.reportError(e);
    }

    try {
      while ((uriparam = cmdLine.handleFlagWithParam("new-tab", false))) {
        let uri = resolveURIInternal(cmdLine, uriparam);
        handURIToExistingBrowser(
          uri,
          Ci.nsIBrowserDOMWindow.OPEN_NEWTAB,
          cmdLine,
          false,
          gSystemPrincipal
        );
        cmdLine.preventDefault = true;
      }
    } catch (e) {
      Cu.reportError(e);
    }

    var chromeParam = cmdLine.handleFlagWithParam("chrome", false);
    if (chromeParam) {
__L_V__1({
    lN: 487,tT:'if',pr:'chromeParam',eT:{},fN:''
  });'__L_V__1';
      // Handle old preference dialog URLs.
      if (
        chromeParam == "chrome://browser/content/pref/pref.xul" ||
        chromeParam == "chrome://browser/content/preferences/preferences.xul"
      ) {
__L_V__1({
    lN: 492,tT:'if',pr:' chromeParam == chrome://browser/content/pref/pref.xul || chromeParam == chrome://browser/content/preferences/preferences.xul ',eT:{},fN:''
  });'__L_V__1';
        openPreferences(cmdLine);
        cmdLine.preventDefault = true;
      } else {
        try {
          let resolvedURI = resolveURIInternal(cmdLine, chromeParam);
          let isLocal = uri => {
            let localSchemes = new Set(["chrome", "file", "resource"]);
            if (uri instanceof Ci.nsINestedURI) {
__L_V__1({
    lN: 500,tT:'if',pr:'uri instanceof Ci.nsINestedURI',eT:{},fN:''
  });'__L_V__1';
              uri = uri.QueryInterface(Ci.nsINestedURI).innerMostURI;
            }
            return localSchemes.has(uri.scheme);
          };
          if (isLocal(resolvedURI)) {
__L_V__1({
    lN: 505,tT:'if',pr:'isLocal(resolvedURI)',eT:{},fN:''
  });'__L_V__1';
            // If the URI is local, we are sure it won't wrongly inherit chrome privs
            let features = "chrome,dialog=no,all" + this.getFeatures(cmdLine);
            // Provide 1 null argument, as openWindow has a different behavior
            // when the arg count is 0.
            let argArray = Cc["@mozilla.org/array;1"].createInstance(
              Ci.nsIMutableArray
            );
            argArray.appendElement(null);
            Services.ww.openWindow(
              null,
              resolvedURI.spec,
              "_blank",
              features,
              argArray
            );
            cmdLine.preventDefault = true;
          } else {
            dump("*** Preventing load of web URI as chrome\n");
            dump(
              "    If you're trying to load a webpage, do not pass --chrome.\n"
            );
          }
        } catch (e) {
          Cu.reportError(e);
        }
      }
    }
    if (cmdLine.handleFlag("preferences", false)) {
__L_V__1({
    lN: 533,tT:'if',pr:'cmdLine.handleFlag(preferences, false)',eT:{},fN:''
  });'__L_V__1';
      openPreferences(cmdLine);
      cmdLine.preventDefault = true;
    }
    if (cmdLine.handleFlag("silent", false)) {
__L_V__1({
    lN: 537,tT:'if',pr:'cmdLine.handleFlag(silent, false)',eT:{},fN:''
  });'__L_V__1';
      cmdLine.preventDefault = true;
    }

    try {
      var privateWindowParam = cmdLine.handleFlagWithParam(
        "private-window",
        false
      );
      if (privateWindowParam) {
__L_V__1({
    lN: 546,tT:'if',pr:'privateWindowParam',eT:{},fN:''
  });'__L_V__1';
        // Ensure we initialize the handler before trying to load
        // about:privatebrowsing.
        AboutPrivateBrowsingHandler.init();
        let forcePrivate = true;
        let resolvedURI;
        if (!PrivateBrowsingUtils.enabled) {
__L_V__1({
    lN: 552,tT:'if',pr:'!PrivateBrowsingUtils.enabled',eT:{},fN:''
  });'__L_V__1';
          // Load about:privatebrowsing in a normal tab, which will display an error indicating
          // access to private browsing has been disabled.
          forcePrivate = false;
          resolvedURI = Services.io.newURI("about:privatebrowsing");
        } else {
          resolvedURI = resolveURIInternal(cmdLine, privateWindowParam);
        }
        handURIToExistingBrowser(
          resolvedURI,
          Ci.nsIBrowserDOMWindow.OPEN_NEWTAB,
          cmdLine,
          forcePrivate,
          gSystemPrincipal
        );
        cmdLine.preventDefault = true;
      }
    } catch (e) {
      if (e.result != Cr.NS_ERROR_INVALID_ARG) {
__L_V__1({
    lN: 570,tT:'if',pr:'e.result != Cr.NS_ERROR_INVALID_ARG',eT:{},fN:''
  });'__L_V__1';
        throw e;
      }
      // NS_ERROR_INVALID_ARG is thrown when flag exists, but has no param.
      if (cmdLine.handleFlag("private-window", false)) {
__L_V__1({
    lN: 574,tT:'if',pr:'cmdLine.handleFlag(private-window, false)',eT:{},fN:''
  });'__L_V__1';
        // Ensure we initialize the handler before trying to load
        // about:privatebrowsing.
        AboutPrivateBrowsingHandler.init();
        openBrowserWindow(
          cmdLine,
          gSystemPrincipal,
          "about:privatebrowsing",
          null,
          PrivateBrowsingUtils.enabled
        );
        cmdLine.preventDefault = true;
      }
    }

    var searchParam = cmdLine.handleFlagWithParam("search", false);
    if (searchParam) {
__L_V__1({
    lN: 590,tT:'if',pr:'searchParam',eT:{},fN:''
  });'__L_V__1';
      doSearch(searchParam, cmdLine);
      cmdLine.preventDefault = true;
    }

    // The global PB Service consumes this flag, so only eat it in per-window
    // PB builds.
    if (cmdLine.handleFlag("private", false) && PrivateBrowsingUtils.enabled) {
__L_V__1({
    lN: 597,tT:'if',pr:'cmdLine.handleFlag(private, false) && PrivateBrowsingUtils.enabled',eT:{},fN:''
  });'__L_V__1';
      PrivateBrowsingUtils.enterTemporaryAutoStartMode();
      if (isCommandLineInitialLaunch(cmdLine)) {
__L_V__1({
    lN: 599,tT:'if',pr:'isCommandLineInitialLaunch(cmdLine)',eT:{},fN:''
  });'__L_V__1';
        let win = Services.wm.getMostRecentWindow("navigator:blank");
        if (win) {
__L_V__1({
    lN: 601,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__1';
          win.docShell.QueryInterface(
            Ci.nsILoadContext
          ).usePrivateBrowsing = true;
        }
      }
    }
    if (cmdLine.handleFlag("setDefaultBrowser", false)) {
__L_V__1({
    lN: 608,tT:'if',pr:'cmdLine.handleFlag(setDefaultBrowser, false)',eT:{},fN:''
  });'__L_V__1';
      ShellService.setDefaultBrowser(true, true);
    }

    if (cmdLine.handleFlag("first-startup", false)) {
__L_V__1({
    lN: 612,tT:'if',pr:'cmdLine.handleFlag(first-startup, false)',eT:{},fN:''
  });'__L_V__1';
      FirstStartup.init();
    }

    var fileParam = cmdLine.handleFlagWithParam("file", false);
    if (fileParam) {
__L_V__1({
    lN: 617,tT:'if',pr:'fileParam',eT:{},fN:''
  });'__L_V__1';
      var file = cmdLine.resolveFile(fileParam);
      var fileURI = Services.io.newFileURI(file);
      openBrowserWindow(cmdLine, gSystemPrincipal, fileURI.spec);
      cmdLine.preventDefault = true;
    }

    if (AppConstants.platform == "win") {
__L_V__1({
    lN: 624,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__1';
      // Handle "? searchterm" for Windows Vista start menu integration
      for (var i = cmdLine.length - 1; i >= 0; --i) {
        var param = cmdLine.getArgument(i);
        if (param.match(/^\? /)) {
__L_V__1({
    lN: 628,tT:'if',pr:'param.match(/^\? /)',eT:{},fN:''
  });'__L_V__1';
          cmdLine.removeArguments(i, i);
          cmdLine.preventDefault = true;

          searchParam = param.substr(2);
          doSearch(searchParam, cmdLine);
        }
      }
    }
  },

  get helpInfo() {
__L_V__1({
    lN: 639,tT:'func',pr:'',eT:{},fN:'helpInfo'
  });'__L_V__1';
    let info =
      "  --browser          Open a browser window.\n" +
      "  --new-window <url> Open <url> in a new window.\n" +
      "  --new-tab <url>    Open <url> in a new tab.\n" +
      "  --private-window <url> Open <url> in a new private window.\n";
    if (AppConstants.platform == "win") {
__L_V__1({
    lN: 645,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__1';
      info += "  --preferences      Open Options dialog.\n";
    } else {
      info += "  --preferences      Open Preferences dialog.\n";
    }
    info +=
      "  --screenshot [<path>] Save screenshot to <path> or in working directory.\n";
    info +=
      "  --window-size width[,height] Width and optionally height of screenshot.\n";
    info +=
      "  --search <term>    Search <term> with your default search engine.\n";
    info += "  --setDefaultBrowser Set this app as the default browser.\n";
    info +=
      "  --first-startup    Run post-install actions before opening a new window.\n";
    info += "  --kiosk Start the browser in kiosk mode.\n";
    return info;
  },

  /* nsIBrowserHandler */

  get defaultArgs() {
__L_V__1({
    lN: 665,tT:'func',pr:'',eT:{},fN:'defaultArgs'
  });'__L_V__1';
    return this.getDefaultArgs();
  },

  getDefaultArgs: function bch_getDefaultArgs(initialLaunch) {
__L_V__1({
    lN: 669,tT:'func',pr:'',eT:{'initialLaunch':initialLaunch},fN:'bch_getDefaultArgs'
  });'__L_V__1';
    // CLIQZ-SPECIAL:
    // DB-2064:
    // overridePage will be used in case of a user has restarted the browser after update.
    // A function needHomepageOverride determines whether our homepage has to be replaced.
    // In this case it means that we might need to display What's New page for a user.
    // There are 2 different prefs (taken into account in needHomepageOverride);
    // browser.startup.homepage_override.mstone - it stores last saved platform version.
    // That value could be an actual version like 65.0.x or empty string (new profile start).
    // Also there is Services.appinfo.platformVersion which is 'live' meaning that whenever new
    // update gets unstalled the property will be affected.
    // If last stored platformVersion exists (not equal empty string) and does not equal
    // Services.appinfo.platformVersion then the latest one is saved under
    // browser.startup.homepage_override.mstone and taken into account further.
    // Also OVERRIDE_NEW_MSTONE will be returned from needHomepageOverride;
    var overridePage = "";

    try {
      // Read the old value of homepage_override.mstone before
      // needHomepageOverride updates it, so that we can later add it to the
      // URL if we do end up showing an overridePage. This makes it possible
      // to have the overridePage's content vary depending on the version we're
      // upgrading from.
      let override = needHomepageOverride(Services.prefs);
      if (override === OVERRIDE_NEW_MSTONE) {
__L_V__1({
    lN: 693,tT:'if',pr:'override === OVERRIDE_NEW_MSTONE',eT:{},fN:''
  });'__L_V__1';
        let old_cliqz_mstone = Services.prefs.getCharPref("distribution.previous_version", "");
        let new_cliqz_mstone = Services.prefs.getCharPref("distribution.version", "");

        overridePage = Services.prefs.getStringPref("startup.homepage_override_url");
#if 0
        // %VERSION% placeholder gets formatted by Services.urlFormatter internally
        // https://dxr.mozilla.org/mozilla-central/source/toolkit/components/urlformatter/URLFormatter.jsm#96
        overridePage = Services.urlFormatter.formatURLPref("startup.homepage_override_url");
        overridePage = overridePage.replace("%OLD_VERSION%", old_mstone);
#endif

        overridePage = overridePage.replace("%VERSION%", new_cliqz_mstone)
                                   .replace("%OLD_VERSION%", old_cliqz_mstone);

        Services.prefs.setCharPref("distribution.previous_version", new_cliqz_mstone);
      }
    } catch (ex) {}

    if (overridePage !== '') {
__L_V__1({
    lN: 712,tT:'if',pr:'overridePage !== ',eT:{},fN:''
  });'__L_V__1';
      return overridePage;
    }

    if (!gFirstWindow) {
__L_V__1({
    lN: 716,tT:'if',pr:'!gFirstWindow',eT:{},fN:''
  });'__L_V__1';
      gFirstWindow = true;
      if (PrivateBrowsingUtils.isInTemporaryAutoStartMode) {
__L_V__1({
    lN: 718,tT:'if',pr:'PrivateBrowsingUtils.isInTemporaryAutoStartMode',eT:{},fN:''
  });'__L_V__1';
        return "about:privatebrowsing";
      }
    }
    // CLIQZ-SPECIAL
    // Remove source code below which only complicated the logical process
    // rather than made it simple.
    //
    // DB-1929 According to this ticket we have a simple final steps which define
    // when should be displayed home page and restored windows
    // (details could be found in the ticket).
    //
    // Shortly: home page defines a rule when it should/could be displayed.
    // It is up to us to decide whether we need to do this check or not.
    // Meaning that if some other rules beyond appear
    // then we can combine them with what we have in HomePage.canBeDisplayed.
    if (HomePage.canBeDisplayed()) {
__L_V__1({
    lN: 734,tT:'if',pr:'HomePage.canBeDisplayed()',eT:{},fN:''
  });'__L_V__1';
      return HomePage.get();
    }

    return 'about:blank';
#if 0
    var override;
    var overridePage = "";
    var additionalPage = "";
    var willRestoreSession = false;
    try {
      // Read the old value of homepage_override.mstone before
      // needHomepageOverride updates it, so that we can later add it to the
      // URL if we do end up showing an overridePage. This makes it possible
      // to have the overridePage's content vary depending on the version we're
      // upgrading from.
      let old_mstone = Services.prefs.getCharPref(
        "browser.startup.homepage_override.mstone",
        "unknown"
      );
      let old_buildId = Services.prefs.getCharPref(
        "browser.startup.homepage_override.buildID",
        "unknown"
      );
      override = needHomepageOverride(prefb);
      if (override != OVERRIDE_NONE) {
__L_V__1({
    lN: 759,tT:'if',pr:'override != OVERRIDE_NONE',eT:{},fN:''
  });'__L_V__1';
__L_V__1({
    lN: 760,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__1';
        switch (override) {
          case OVERRIDE_ALTERNATE_PROFILE:
            // Override the welcome page to explain why the user has a new
            // profile. nsBrowserGlue.css will be responsible for showing the
            // modal dialog.
            overridePage = getNewInstallPage();
            break;
          case OVERRIDE_NEW_PROFILE:
            // New profile.
            overridePage = Services.urlFormatter.formatURLPref(
              "startup.homepage_welcome_url"
            );
            additionalPage = Services.urlFormatter.formatURLPref(
              "startup.homepage_welcome_url.additional"
            );
            // Turn on 'later run' pages for new profiles.
            LaterRun.enabled = true;
            break;
          case OVERRIDE_NEW_MSTONE:
            // Check whether we will restore a session. If we will, we assume
            // that this is an "update" session. This does not take crashes
            // into account because that requires waiting for the session file
            // to be read. If a crash occurs after updating, before restarting,
            // we may open the startPage in addition to restoring the session.
            willRestoreSession = SessionStartup.isAutomaticRestoreEnabled();

            overridePage = Services.urlFormatter.formatURLPref(
              "startup.homepage_override_url"
            );
            let update = UpdateManager.activeUpdate;
            if (
              update &&
              Services.vc.compare(update.appVersion, old_mstone) > 0
            ) {
__L_V__1({
    lN: 793,tT:'if',pr:' update && Services.vc.compare(update.appVersion, old_mstone) > 0 ',eT:{},fN:''
  });'__L_V__1';
              overridePage = getPostUpdateOverridePage(update, overridePage);
              // Send the update ping to signal that the update was successful.
              UpdatePing.handleUpdateSuccess(old_mstone, old_buildId);
            }

            overridePage = overridePage.replace("%OLD_VERSION%", old_mstone);
            break;
          case OVERRIDE_NEW_BUILD_ID:
            if (UpdateManager.activeUpdate) {
__L_V__1({
    lN: 802,tT:'if',pr:'UpdateManager.activeUpdate',eT:{},fN:''
  });'__L_V__1';
              // Send the update ping to signal that the update was successful.
              UpdatePing.handleUpdateSuccess(old_mstone, old_buildId);
            }
            break;
        }
      }
    } catch (ex) {}

    // formatURLPref might return "about:blank" if getting the pref fails
    if (overridePage == "about:blank") {
__L_V__1({
    lN: 812,tT:'if',pr:'overridePage == about:blank',eT:{},fN:''
  });'__L_V__1';
      overridePage = "";
    }

    // Allow showing a one-time startup override if we're not showing one
    if (isStartup && overridePage == "" && prefb.prefHasUserValue(ONCE_PREF)) {
__L_V__1({
    lN: 817,tT:'if',pr:'isStartup && overridePage == && prefb.prefHasUserValue(ONCE_PREF)',eT:{},fN:''
  });'__L_V__1';
      try {
        // Show if we haven't passed the expiration or there's no expiration
        const { expire, url } = JSON.parse(
          Services.urlFormatter.formatURLPref(ONCE_PREF)
        );
        if (!(Date.now() > expire)) {
__L_V__1({
    lN: 823,tT:'if',pr:'!(Date.now() > expire)',eT:{},fN:''
  });'__L_V__1';
          // Only set allowed urls as override pages
          overridePage = url
            .split("|")
            .map(val => {
              try {
                return new URL(val);
              } catch (ex) {
                // Invalid URL, so filter out below
                Cu.reportError(`Invalid once url: ${ex}`);
                return null;
              }
            })
            .filter(
              parsed =>
                parsed &&
                parsed.protocol == "https:" &&
                // Only accept exact hostname or subdomain; without port
                ONCE_DOMAINS.includes(
                  Services.eTLD.getBaseDomainFromHost(parsed.host)
                )
            )
            .join("|");

          // Be noisy as properly configured urls should be unchanged
          if (overridePage != url) {
__L_V__1({
    lN: 848,tT:'if',pr:'overridePage != url',eT:{},fN:''
  });'__L_V__1';
            Cu.reportError(`Mismatched once urls: ${url}`);
          }
        }
      } catch (ex) {
        // Invalid json pref, so ignore (and clear below)
        Cu.reportError(`Invalid once pref: ${ex}`);
      } finally {
        prefb.clearUserPref(ONCE_PREF);
      }
    }

    if (!additionalPage) {
__L_V__1({
    lN: 860,tT:'if',pr:'!additionalPage',eT:{},fN:''
  });'__L_V__1';
      additionalPage = LaterRun.getURL() || "";
    }

    if (additionalPage && additionalPage != "about:blank") {
__L_V__1({
    lN: 864,tT:'if',pr:'additionalPage && additionalPage != about:blank',eT:{},fN:''
  });'__L_V__1';
      if (overridePage) {
__L_V__1({
    lN: 865,tT:'if',pr:'overridePage',eT:{},fN:''
  });'__L_V__1';
        overridePage += "|" + additionalPage;
      } else {
        overridePage = additionalPage;
      }
    }

    // CLIQZ-SPECIAL, DB-1849, DB-1878
    // If this is initial launch (meaning that isCommandLineInitialLaunch returns true)
    // then we need to show a Cliqz home page only if browser.startup.addFreshTab is true.
    // Otherwise a blank page should be displayed.
    var startPage = "";
    try {
      var choice = prefb.getIntPref("browser.startup.page");
      if (choice == 1 || choice == 3) {
__L_V__1({
    lN: 879,tT:'if',pr:'choice == 1 || choice == 3',eT:{},fN:''
  });'__L_V__1';
        startPage = HomePage.get();
      }
    } catch (e) {
      Cu.reportError(e);
    }

    if (startPage == "about:blank") {
__L_V__1({
    lN: 886,tT:'if',pr:'startPage == about:blank',eT:{},fN:''
  });'__L_V__1';
      startPage = "";
    }

    let skipStartPage =
      (override == OVERRIDE_NEW_PROFILE ||
        override == OVERRIDE_ALTERNATE_PROFILE) &&
      prefb.getBoolPref("browser.startup.firstrunSkipsHomepage");
    // Only show the startPage if we're not restoring an update session and are
    // not set to skip the start page on this profile
    if (overridePage && startPage && !willRestoreSession && !skipStartPage) {
__L_V__1({
    lN: 896,tT:'if',pr:'overridePage && startPage && !willRestoreSession && !skipStartPage',eT:{},fN:''
  });'__L_V__1';
      return overridePage + "|" + startPage;
    }

    return overridePage || startPage || "about:blank";
#endif
  },

  mFeatures: null,

  getFeatures: function bch_features(cmdLine) {
__L_V__1({
    lN: 906,tT:'func',pr:'',eT:{'cmdLine':cmdLine},fN:'bch_features'
  });'__L_V__1';
    if (this.mFeatures === null) {
__L_V__1({
    lN: 907,tT:'if',pr:'this.mFeatures === null',eT:{},fN:''
  });'__L_V__1';
      this.mFeatures = "";

      if (cmdLine) {
__L_V__1({
    lN: 910,tT:'if',pr:'cmdLine',eT:{},fN:''
  });'__L_V__1';
        try {
          var width = cmdLine.handleFlagWithParam("width", false);
          var height = cmdLine.handleFlagWithParam("height", false);

          if (width) {
__L_V__1({
    lN: 915,tT:'if',pr:'width',eT:{},fN:''
  });'__L_V__1';
            this.mFeatures += ",width=" + width;
          }
          if (height) {
__L_V__1({
    lN: 918,tT:'if',pr:'height',eT:{},fN:''
  });'__L_V__1';
            this.mFeatures += ",height=" + height;
          }
        } catch (e) {}
      }

      // The global PB Service consumes this flag, so only eat it in per-window
      // PB builds.
      if (PrivateBrowsingUtils.isInTemporaryAutoStartMode) {
__L_V__1({
    lN: 926,tT:'if',pr:'PrivateBrowsingUtils.isInTemporaryAutoStartMode',eT:{},fN:''
  });'__L_V__1';
        this.mFeatures += ",private";
      }

      if (
        Services.prefs.getBoolPref("browser.suppress_first_window_animation") &&
        !Services.wm.getMostRecentWindow("navigator:browser")
      ) {
__L_V__1({
    lN: 933,tT:'if',pr:' Services.prefs.getBoolPref(browser.suppress_first_window_animation) && !Services.wm.getMostRecentWindow(navigator:browser) ',eT:{},fN:''
  });'__L_V__1';
        this.mFeatures += ",suppressanimation";
      }
    }

    return this.mFeatures;
  },

  get kiosk() {
__L_V__1({
    lN: 941,tT:'func',pr:'',eT:{},fN:'kiosk'
  });'__L_V__1';
    return gKiosk;
  },

  /* nsIContentHandler */

  handleContent: function bch_handleContent(contentType, context, request) {
__L_V__1({
    lN: 947,tT:'func',pr:'',eT:{'contentType':contentType,'context':context,'request':request},fN:'bch_handleContent'
  });'__L_V__1';
    const NS_ERROR_WONT_HANDLE_CONTENT = 0x805d0001;

    try {
      var webNavInfo = Cc["@mozilla.org/webnavigation-info;1"].getService(
        Ci.nsIWebNavigationInfo
      );
      if (!webNavInfo.isTypeSupported(contentType, null)) {
__L_V__1({
    lN: 954,tT:'if',pr:'!webNavInfo.isTypeSupported(contentType, null)',eT:{},fN:''
  });'__L_V__1';
        throw NS_ERROR_WONT_HANDLE_CONTENT;
      }
    } catch (e) {
      throw NS_ERROR_WONT_HANDLE_CONTENT;
    }

    request.QueryInterface(Ci.nsIChannel);
    handURIToExistingBrowser(
      request.URI,
      Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW,
      null,
      false,
      request.loadInfo.triggeringPrincipal
    );
    request.cancel(Cr.NS_BINDING_ABORTED);
  },

  /* nsICommandLineValidator */
  validate: function bch_validate(cmdLine) {
__L_V__1({
    lN: 973,tT:'func',pr:'',eT:{'cmdLine':cmdLine},fN:'bch_validate'
  });'__L_V__1';
    var urlFlagIdx = cmdLine.findFlag("url", false);
    if (
      urlFlagIdx > -1 &&
      cmdLine.state == Ci.nsICommandLine.STATE_REMOTE_EXPLICIT
    ) {
__L_V__1({
    lN: 978,tT:'if',pr:' urlFlagIdx > -1 && cmdLine.state == Ci.nsICommandLine.STATE_REMOTE_EXPLICIT ',eT:{},fN:''
  });'__L_V__1';
      var urlParam = cmdLine.getArgument(urlFlagIdx + 1);
      if (
        cmdLine.length != urlFlagIdx + 2 ||
        /firefoxurl(-[a-f0-9]+)?:/i.test(urlParam)
      ) {
__L_V__1({
    lN: 983,tT:'if',pr:' cmdLine.length != urlFlagIdx + 2 || /firefoxurl(-[a-f0-9]+)?:/i.test(urlParam) ',eT:{},fN:''
  });'__L_V__1';
        throw Cr.NS_ERROR_ABORT;
      }
      var isDefault = false;
      try {
        var url =
          Services.urlFormatter.formatURLPref("app.support.baseURL") +
          "win10-default-browser";
        if (urlParam == url) {
__L_V__1({
    lN: 991,tT:'if',pr:'urlParam == url',eT:{},fN:''
  });'__L_V__1';
          isDefault = ShellService.isDefaultBrowser(false, false);
        }
      } catch (ex) {}
      if (isDefault) {
__L_V__1({
    lN: 995,tT:'if',pr:'isDefault',eT:{},fN:''
  });'__L_V__1';
        // Firefox is already the default HTTP handler.
        // We don't have to show the instruction page.
        throw Cr.NS_ERROR_ABORT;
      }
    }
  },
};
var gBrowserContentHandler = new nsBrowserContentHandler();

function handURIToExistingBrowser(
  uri,
  location,
  cmdLine,
  forcePrivate,
  triggeringPrincipal
) {
__L_V__1({
    lN: 1011,tT:'func',pr:'',eT:{'uri':uri,'location':location,'cmdLine':cmdLine,'forcePrivate':forcePrivate,'triggeringPrincipal':triggeringPrincipal},fN:'handURIToExistingBrowser'
  });'__L_V__1';
  if (!shouldLoadURI(uri)) {
__L_V__1({
    lN: 1012,tT:'if',pr:'!shouldLoadURI(uri)',eT:{},fN:''
  });'__L_V__1';
    return;
  }

  // Unless using a private window is forced, open external links in private
  // windows only if we're in perma-private mode.
  var allowPrivate =
    forcePrivate || PrivateBrowsingUtils.permanentPrivateBrowsing;
  var navWin = BrowserWindowTracker.getTopWindow({ private: allowPrivate });
  if (!navWin) {
__L_V__1({
    lN: 1021,tT:'if',pr:'!navWin',eT:{},fN:''
  });'__L_V__1';
    // if we couldn't load it in an existing window, open a new one
    openBrowserWindow(
      cmdLine,
      triggeringPrincipal,
      uri.spec,
      null,
      forcePrivate
    );
    return;
  }

  var bwin = navWin.browserDOMWindow;
  bwin.openURI(
    uri,
    null,
    location,
    Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL,
    triggeringPrincipal
  );
}

function nsDefaultCommandLineHandler() {
__L_V__1({
    lN: 1043,tT:'func',pr:'',eT:{},fN:'nsDefaultCommandLineHandler'
  });'__L_V__1';}

nsDefaultCommandLineHandler.prototype = {
  /* nsISupports */
  QueryInterface: ChromeUtils.generateQI(["nsICommandLineHandler"]),

  _haveProfile: false,

  /* nsICommandLineHandler */
  handle: function dch_handle(cmdLine) {
__L_V__1({
    lN: 1052,tT:'func',pr:'',eT:{'cmdLine':cmdLine},fN:'dch_handle'
  });'__L_V__1';
    var urilist = [];

    if (AppConstants.platform == "win") {
__L_V__1({
    lN: 1055,tT:'if',pr:'AppConstants.platform == win',eT:{},fN:''
  });'__L_V__1';
      // If we don't have a profile selected yet (e.g. the Profile Manager is
      // displayed) we will crash if we open an url and then select a profile. To
      // prevent this handle all url command line flags and set the command line's
      // preventDefault to true to prevent the display of the ui. The initial
      // command line will be retained when nsAppRunner calls LaunchChild though
      // urls launched after the initial launch will be lost.
      if (!this._haveProfile) {
__L_V__1({
    lN: 1062,tT:'if',pr:'!this._haveProfile',eT:{},fN:''
  });'__L_V__1';
        try {
          // This will throw when a profile has not been selected.
          Services.dirsvc.get("ProfD", Ci.nsIFile);
          this._haveProfile = true;
        } catch (e) {
          // eslint-disable-next-line no-empty
          while ((ar = cmdLine.handleFlagWithParam("url", false))) {}
          cmdLine.preventDefault = true;
        }
      }
    }

    try {
      var ar;
      while ((ar = cmdLine.handleFlagWithParam("url", false))) {
        var uri = resolveURIInternal(cmdLine, ar);
        urilist.push(uri);
      }
    } catch (e) {
      Cu.reportError(e);
    }

    if (cmdLine.findFlag("screenshot", true) != -1) {
__L_V__1({
    lN: 1085,tT:'if',pr:'cmdLine.findFlag(screenshot, true) != -1',eT:{},fN:''
  });'__L_V__1';
      HeadlessShell.handleCmdLineArgs(
        cmdLine,
        urilist.filter(shouldLoadURI).map(u => u.spec)
      );
      return;
    }

    for (let i = 0; i < cmdLine.length; ++i) {
      var curarg = cmdLine.getArgument(i);
      if (curarg.match(/^-/)) {
__L_V__1({
    lN: 1095,tT:'if',pr:'curarg.match(/^-/)',eT:{},fN:''
  });'__L_V__1';
        Cu.reportError(
          "Warning: unrecognized command line flag " + curarg + "\n"
        );
        // To emulate the pre-nsICommandLine behavior, we ignore
        // the argument after an unrecognized flag.
        ++i;
      } else {
        try {
          urilist.push(resolveURIInternal(cmdLine, curarg));
        } catch (e) {
          Cu.reportError(
            "Error opening URI '" +
              curarg +
              "' from the command line: " +
              e +
              "\n"
          );
        }
      }
    }

    if (urilist.length) {
__L_V__1({
    lN: 1117,tT:'if',pr:'urilist.length',eT:{},fN:''
  });'__L_V__1';
      if (!isCommandLineInitialLaunch(cmdLine) && urilist.length == 1) {
__L_V__1({
    lN: 1118,tT:'if',pr:'!isCommandLineInitialLaunch(cmdLine) && urilist.length == 1',eT:{},fN:''
  });'__L_V__1';
        // Try to find an existing window and load our URI into the
        // current tab, new tab, or new window as prefs determine.
        try {
          handURIToExistingBrowser(
            urilist[0],
            Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW,
            cmdLine,
            false,
            gSystemPrincipal
          );
          return;
        } catch (e) {}
      }

      var URLlist = urilist.filter(shouldLoadURI).map(u => u.spec);
      if (URLlist.length) {
__L_V__1({
    lN: 1134,tT:'if',pr:'URLlist.length',eT:{},fN:''
  });'__L_V__1';
        // DB-1929
        // If HomePage can be displayed then we get its' URL and add it to the URLlist
        // So a window could start loading two tabs at once (without waiting for restore process).
        if (HomePage.canBeDisplayed()) {
__L_V__1({
    lN: 1138,tT:'if',pr:'HomePage.canBeDisplayed()',eT:{},fN:''
  });'__L_V__1';
          URLlist.push(HomePage.get());
        }
        openBrowserWindow(cmdLine, gSystemPrincipal, URLlist);
      }
    } else if (!cmdLine.preventDefault) {
__L_V__1({
    lN: 1143,tT:'if',pr:'!cmdLine.preventDefault',eT:{},fN:''
  });'__L_V__1';
      if (
        AppConstants.isPlatformAndVersionAtLeast("win", "10") &&
        !isCommandLineInitialLaunch(cmdLine) &&
        WindowsUIUtils.inTabletMode
      ) {
__L_V__1({
    lN: 1148,tT:'if',pr:' AppConstants.isPlatformAndVersionAtLeast(win, 10) && !isCommandLineInitialLaunch(cmdLine) && WindowsUIUtils.inTabletMode ',eT:{},fN:''
  });'__L_V__1';
        // In windows 10 tablet mode, do not create a new window, but reuse the existing one.
        let win = BrowserWindowTracker.getTopWindow();
        if (win) {
__L_V__1({
    lN: 1151,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__1';
          win.focus();
          return;
        }
      }
      openBrowserWindow(cmdLine, gSystemPrincipal);
    } else {
      // Need a better solution in the future to avoid opening the blank window
      // when command line parameters say we are not going to show a browser
      // window, but for now the blank window getting closed quickly (and
      // causing only a slight flicker) is better than leaving it open.
      let win = Services.wm.getMostRecentWindow("navigator:blank");
      if (win) {
__L_V__1({
    lN: 1163,tT:'if',pr:'win',eT:{},fN:''
  });'__L_V__1';
        win.close();
      }
    }
  },

  helpInfo: "",
};
