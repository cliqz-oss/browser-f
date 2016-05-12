// Copyright Cliqz GmbH, 2016.

"use strict";

this.EXPORTED_SYMBOLS = ["AutoPrivateTab"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/BloomFilterUtils.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

const PORN_DATA_FILE_NAME = "porn-domains.bin";
const FILTER_N_HASHES = 14;

let filter;
try {
  filter = BloomFilterUtils.loadFromFile(
      FileUtils.getFile("XCurProcD", [PORN_DATA_FILE_NAME]));
}
catch (e) {
  Cu.reportError(e);
}

const AutoPrivateTab = {
  // Stores internal data to disk. Call before quitting application.
  persist: function APT_persist() {
    if (!this._dirty)
      return;
    // TODO: Write _whiteList to file.
  },

  handleTabNavigation: function APT_handleTabNavigation(uri, tab_browser) {
    const [pm, domain] = this._shouldLoadURIInPrivateMode(uri)
    if (!pm)
      return;
    const gBrowser = tab_browser.ownerGlobal.gBrowser;
    tab_browser.loadContext.usePrivateBrowsing = true;
    const tab = gBrowser.getTabForBrowser(tab_browser)
    if (tab)
      tab.private = true;
    // TODO: Navigation could happen in a background tab, not the current one.
    setTimeout(
      this._addOrUpdateNotification.bind(this, tab_browser, domain),
      1000);
  },

  /**
   * @param {nsIURI or string} uri - a URL to check.
   * @return {[boolean, string]} pair with the following values:
   *   whether a particular URL is unwelcome in normal mode,
   *   extracted domain name (may be absent).
   */
  _shouldLoadURIInPrivateMode: function APT__shouldLoadURIInPrivateMode(uri) {
    if (!filter)
      return false;

    var spec;
    try {
      if (uri instanceof Ci.nsIURI) {
        spec = uri.spec;
      }
      else {
        spec = uri;
        uri = Services.uriFixup.createFixupURI(spec,
            Services.uriFixup.FIXUP_FLAG_NONE);
      }

      if (!uri.schemeIs("http") && !uri.schemeIs("https"))
        return [false, undefined];

      const host = uri.host.replace(/^www\./i, '');
      const pm = !this._whiteList.has(host) && filter.test(host);
      return [pm, host];
    }
    catch (e) {
      Cu.reportError("Could not check spec: " + spec);
      Cu.reportError(e);
      return [false, undefined];
    }
  },

  _addOrUpdateNotification: function APT__addOrUpdateNotification(
      tab_browser, domain) {
    const gBrowser = tab_browser.ownerGlobal.gBrowser;
    const notificationBox = gBrowser.getNotificationBox();
    const notification = notificationBox.getNotificationWithValue(
        this._consts.AUTO_PRIVATE_TAB_NOTIFICATION);
    if (notification) {
      notificationBox.removeNotification(notification);
    }
    const buttons = [
    {
      label: "Reload in normal mode",
      accessKey: "R",
      popup: null,
      callback: (notification, descr) => {
          this._reloadTabAsNormal(tab_browser);
      }
    },
    {
      label: "Always load in normal mode",
      accessKey: "A",
      popup: null,
      callback: (notification, descr) => {
        this._reloadTabAsNormal(tab_browser);
        this._whiteList.add(domain);
        this._dirty = true;
      }
    }];

    notificationBox.appendNotification(
        domain + " is better viewed in private mode",
        this._consts.AUTO_PRIVATE_TAB_NOTIFICATION,
        "chrome://browser/skin/privatebrowsing-mask.png",
        notificationBox.PRIORITY_INFO_HIGH,
        buttons);
  },

  _reloadTabAsNormal: function APT__reloadTabAsNormal(tab_browser) {
    tab_browser.loadContext.usePrivateBrowsing = false;
    const gBrowser = tab_browser.ownerGlobal.gBrowser;
    const tab = gBrowser.getTabForBrowser(tab_browser)
    if (tab)
      tab.private = false;
    tab_browser.reload();
  },

  _consts: {
    AUTO_PRIVATE_TAB_NOTIFICATION: "auto-private-tab"
  },
  // List of domains which should be loaded in normal mode.
  _whiteList: new Set(),
  _dirty: false
};
