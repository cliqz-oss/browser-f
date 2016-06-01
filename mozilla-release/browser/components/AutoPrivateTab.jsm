// Copyright Cliqz GmbH, 2016.

"use strict";

this.EXPORTED_SYMBOLS = ["AutoPrivateTab"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/BloomFilterUtils.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

const ADULT_DOMAINS_BF_FILE_NAME = "adult-domains.bin";

let filter;
let version;
try {
  [filter, version] = BloomFilterUtils.loadFromFile(
      FileUtils.getFile("XCurProcD", [ADULT_DOMAINS_BF_FILE_NAME]));
  dump("AutoPrivateTab: Loaded database version " + version + "\n");
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

  handleTabNavigation: function APT_handleTabNavigation(uri, tabBrowser) {
    const [pm, domain] = this._shouldLoadURIInPrivateMode(uri)
    if (!pm)
      return;
    const gBrowser = tabBrowser.ownerGlobal.gBrowser;
    tabBrowser.loadContext.usePrivateBrowsing = true;
    const tab = gBrowser.getTabForBrowser(tabBrowser)
    if (tab)
      tab.private = true;
    // TODO: Navigation could happen in a background tab, not the current one.
    setTimeout(
      this._addOrUpdateNotification.bind(this, tabBrowser, domain),
      1000);
  },

  /**
   * @param {DOMElement} tab - <xul:tab> to toggle mode on.
   */
  toggleTabPrivateMode: function APT_toggleTabPrivateMode(tab, rememberDomain) {
    // TODO: Clean history when going into private mode.
    tab.private = !tab.private;
    tab.linkedBrowser.reload();
  },

  /**
   * @param {nsIURI or string} uri - a URL to check.
   * @return {[boolean, string]} pair with the following values:
   *   whether a particular URL is unwelcome in normal mode,
   *   extracted domain name (may be absent).
   */
  _shouldLoadURIInPrivateMode: function APT__shouldLoadURIInPrivateMode(uri) {
    if (!filter || !Preferences.get("browser.privatebrowsing.apt", false))
      return [false, undefined];

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
      tabBrowser, domain) {
    const gBrowser = tabBrowser.ownerGlobal.gBrowser;
    const notificationBox = gBrowser.getNotificationBox();
    const notification = notificationBox.getNotificationWithValue(
        this._consts.AUTO_PRIVATE_TAB_NOTIFICATION);
    if (notification) {
      notificationBox.removeNotification(notification);
    }
    const buttons = [
    {
      label: browserStrings.GetStringFromName("apt.notification.revertButton"),
      accessKey: browserStrings.GetStringFromName(
          "apt.notification.revertButton.AK"),
      popup: null,
      callback: (notification, descr) => {
          this._reloadBrowserAsNormal(tabBrowser);
      }
    },
    {
      label: browserStrings.GetStringFromName("apt.notification.setupButton"),
      accessKey: browserStrings.GetStringFromName(
          "apt.notification.setupButton.AK"),
      popup: null,
      callback: (notification, descr) => {
        gBrowser.ownerGlobal.openPreferences("panePrivacy");
      }
    }];

    notificationBox.appendNotification(
        browserStrings.GetStringFromName("apt.notification.label"),
        this._consts.AUTO_PRIVATE_TAB_NOTIFICATION,
        "chrome://browser/skin/privatebrowsing-eraser.svg",
        notificationBox.PRIORITY_INFO_HIGH,
        buttons);
  },

  _reloadBrowserAsNormal: function APT__reloadBrowserAsNormal(tabBrowser) {
    const gBrowser = tabBrowser.ownerGlobal.gBrowser;
    const tab = gBrowser.getTabForBrowser(tabBrowser);
    tab.private = false;
    tab.linkedBrowser.reload();
  },

  _consts: {
    AUTO_PRIVATE_TAB_NOTIFICATION: "auto-private-tab"
  },
  // List of domains which should be loaded in normal mode.
  _whiteList: new Set(),
  _dirty: false
};

const browserStrings = Services.strings.createBundle(
    "chrome://browser/locale/browser.properties");
