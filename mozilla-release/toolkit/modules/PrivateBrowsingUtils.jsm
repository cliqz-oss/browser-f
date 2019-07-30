/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["PrivateBrowsingUtils"];

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

function PrivateBrowsingContentBlockingAllowList() {
  Services.obs.addObserver(this, "last-pb-context-exited", true);
}

PrivateBrowsingContentBlockingAllowList.prototype = {
  QueryInterface: ChromeUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

  /**
   * Add the provided URI to the list of allowed tracking sites.
   *
   * @param uri nsIURI
   *        The URI to add to the list.
   */
  addToAllowList(uri) {
    Services.perms.add(uri, "trackingprotection-pb", Ci.nsIPermissionManager.ALLOW_ACTION,
                       Ci.nsIPermissionManager.EXPIRE_SESSION);
  },

  /**
   * Remove the provided URI from the list of allowed tracking sites.
   *
   * @param uri nsIURI
   *        The URI to remove from the list.
   */
  removeFromAllowList(uri) {
    Services.perms.remove(uri, "trackingprotection-pb");
  },

  observe(subject, topic, data) {
    if (topic == "last-pb-context-exited") {
      Services.perms.removeByType("trackingprotection-pb");
    }
  },
};

const kAutoStartPref = "browser.privatebrowsing.autostart";

// This will be set to true when the PB mode is autostarted from the command
// line for the current session.
var gTemporaryAutoStartMode = false;

var PrivateBrowsingUtils = {
  get enabled() {
    return Services.policies.isAllowed("privatebrowsing");
  },

  // Rather than passing content windows to this function, please use
  // isBrowserPrivate since it works with e10s.
  isWindowPrivate: function pbu_isWindowPrivate(aWindow) {
    if (!aWindow.isChromeWindow) {
      dump("WARNING: content window passed to PrivateBrowsingUtils.isWindowPrivate. " +
           "Use isContentWindowPrivate instead (but only for frame scripts).\n"
           + new Error().stack);
    }

    return this.privacyContextFromWindow(aWindow).usePrivateBrowsing;
  },

  // This should be used only in frame scripts.
  isContentWindowPrivate: function pbu_isWindowPrivate(aWindow) {
    return this.privacyContextFromWindow(aWindow).usePrivateBrowsing;
  },

  isBrowserPrivate(aBrowser, fromContainer) {
    // CLIQZ-SPECIAL: Force default Firefox isBrowserPrivate in case of containers
    if (fromContainer) {
      let chromeWin = aBrowser.ownerGlobal;
      if (chromeWin.gMultiProcessBrowser || !aBrowser.contentWindow) {
        // In e10s we have to look at the chrome window's private
        // browsing status since the only alternative is to check the
        // content window, which is in another process.  If the browser
        // is lazy or is running in windowless configuration then the
        // content window doesn't exist.
        return this.isWindowPrivate(chromeWin);
      }
      return this.privacyContextFromWindow(aBrowser.contentWindow).usePrivateBrowsing;
    }

    try {
      return aBrowser.loadContext.usePrivateBrowsing;
    } catch(e) {
      // There might be cases when aBrowser.loadContext is not yet (or not anymore)
      // exists for a given aBrowser. As we don't have any other way to know if it's
      // private or not, it's safer to assume it is.
      Components.utils.reportError("Browser passed to PrivateBrowsingUtils.isBrowserPrivate " +
                                   "does not have loadContext.");
      return true;
    }
  },

  isTabContextPrivate(aTab, fromContainer) {
    if (aTab == null) {
      return false;
    }

    if (aTab.linkedBrowser == null || aTab.linkedBrowser.loadContext == null) {
      return aTab.getAttribute("private") === "true";
    }

    return this.isBrowserPrivate(aTab.linkedBrowser, fromContainer);
  },

  privacyContextFromWindow: function pbu_privacyContextFromWindow(aWindow) {
    return aWindow.docShell.QueryInterface(Ci.nsILoadContext);
  },

  get _pbCBAllowList() {
    delete this._pbCBAllowList;
    return this._pbCBAllowList = new PrivateBrowsingContentBlockingAllowList();
  },

  addToTrackingAllowlist(aURI) {
    this._pbCBAllowList.addToAllowList(aURI);
  },

  removeFromTrackingAllowlist(aURI) {
    this._pbCBAllowList.removeFromAllowList(aURI);
  },

  get permanentPrivateBrowsing() {
    try {
      return gTemporaryAutoStartMode ||
             Services.prefs.getBoolPref(kAutoStartPref);
    } catch (e) {
      // The pref does not exist
      return false;
    }
  },

  // These should only be used from internal code
  enterTemporaryAutoStartMode: function pbu_enterTemporaryAutoStartMode() {
    gTemporaryAutoStartMode = true;
  },
  get isInTemporaryAutoStartMode() {
    return gTemporaryAutoStartMode;
  },
};

