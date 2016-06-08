// Copyright Cliqz GmbH, 2016.

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const APT_ID = "{998eec19-ade7-4b42-ad3f-5d19d98de71d}";
const ADULT_DOMAINS_BF_FILE_NAME = "adult-domains.bin";
const USR_BLACKLIST_FILE_NAME = "apt-extra-domains.json";
const USR_WHITELIST_FILE_NAME = "apt-white-domains.json";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/BloomFilterUtils.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Timer.jsm");

XPCOMUtils.defineLazyGetter(this, "nsIJSON", () => {
  return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
});

const browserStrings = Services.strings.createBundle(
    "chrome://browser/locale/browser.properties");

function AutoPrivateTabDatabase() {
}
AutoPrivateTabDatabase.prototype = {
  // Public:

  get active() {
    return this._adultDomainsBF &&
        Preferences.get("browser.privatebrowsing.apt", false);
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
    const domain = this._maybeGetDomain(tab.linkedBrowser.currentURI);
    if (tab.private) {
      if (rememberDomain)
        this.whitelistDomain(domain);
    }
    else {
      if (rememberDomain)
        this.blacklistDomain(domain);
      this._cleanupHistory(domain);
    }
    tab.private = !tab.private;
    tab.linkedBrowser.reload();
  },

  /**
   * Request addition of |domain| to user's whitelist (domains to always loaded
   * in normal mode).
   * @param {String} domain to add.
   * @returns {Boolean} whether actual changes to the list were made.
   */
  whitelistDomain: function(domain) {
    if (!domain || this._usrWhitelisted(domain))
      return false;
    this._usrBlackList.delete(domain);
    this._usrWhiteList.add(domain);
    this._usrListsDirty = true;
    return true;
  },

  /**
   * Request addition of |domain| to user's blacklist (domains to load in forget
   * mode).
   * @param {String} domain to add.
   * @returns {Boolean} whether actual changes to the list were made.
   */
  blacklistDomain: function(domain) {
    if (!domain || this._blacklisted(domain))
      return false;
    this._usrBlackList.add(domain);
    this._usrWhiteList.delete(domain);
    this._usrListsDirty = true;
    return true;
  },

  // nsIObserver:
  observe: function APT_observe(subject, topic, data) {
    try {
      switch(topic) {
        case "profile-after-change": {
          Services.obs.addObserver(this, "profile-before-change", false);
          this._load();
          break;
        }
        case "profile-before-change": {
          this._persist();
          break;
        }
      }
    }
    catch (e) {
      dump("APT: " + e + "\n");
      dump("APT:\n" + e.stack);
    }
  },

  // Private:
  _persist: function APT_persist() {
    if (!this._usrListsDirty)
      return
    JSONToFile([...this._usrBlackList],
        FileUtils.getFile("ProfD", [USR_BLACKLIST_FILE_NAME]));
    JSONToFile([...this._usrWhiteList],
        FileUtils.getFile("ProfD", [USR_WHITELIST_FILE_NAME]));
  },

  _load: function APT_load() {
    var bfFile = FileUtils.getFile("ProfD", [ADULT_DOMAINS_BF_FILE_NAME]);
    if (!bfFile.exists() || !bfFile.isFile()) {
      bfFile = FileUtils.getFile("XCurProcD", [ADULT_DOMAINS_BF_FILE_NAME]);
    }
    if (bfFile.exists() && bfFile.isFile()) {
      let [filter, version] = BloomFilterUtils.loadFromFile(bfFile);
      this._adultDomainsBF = filter;
      this._adultDomainsVer = version;
    }

    this._usrBlackList = SetFromFileOrRemoveIt(
        FileUtils.getFile("ProfD", [USR_BLACKLIST_FILE_NAME]));

    this._usrWhiteList = SetFromFileOrRemoveIt(
        FileUtils.getFile("ProfD", [USR_WHITELIST_FILE_NAME]));
  },

  _usrWhitelisted: function(domain) {
    return this._usrWhiteList.has(domain);
  },

  _blacklisted: function(domain) {
    return !this._usrWhitelisted(domain) &&
        (this._adultDomainsBF.test(domain) || this._usrBlackList.has(domain));
  },

  /**
   * @param {nsIURI or string} uri - a URL to check.
   * @return {[boolean, string]} pair with the following values:
   *   whether a particular URL is unwelcome in normal mode,
   *   extracted domain name (may be absent).
   */
  _shouldLoadURIInPrivateMode: function APT__shouldLoadURIInPrivateMode(uri) {
    if (!this.active)
      return [false, undefined];

    const domain = this._maybeGetDomain(uri);
    if (!domain)
      [false, undefined];
    return [this._blacklisted(domain), domain];
  },

  /**
   * Exception-safely checks whether URI is white- or black-listable and returns
   * host part if true.
   * @param uri - uri to check. Type should be either nsIURI or a string.
   * @returns host part of the URI or undefined.
   */
  _maybeGetDomain: function(uri) {
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
        return undefined;

      return uri.host.replace(/^www\./i, '');
    }
    catch (e) {
      Cu.reportError("Could not check spec: " + spec);
      Cu.reportError(e);
      return undefined;
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
      label: browserStrings.GetStringFromName(
          "apt.notification.alwaysNormalButton"),
      accessKey: browserStrings.GetStringFromName(
          "apt.notification.alwaysNormalButton.AK"),
      popup: null,
      callback: (notification, descr) => {
          this._reloadBrowserAsNormal(tabBrowser, true);
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

  _reloadBrowserAsNormal: function APT__reloadBrowserAsNormal(
      tabBrowser, remember) {
    const gBrowser = tabBrowser.ownerGlobal.gBrowser;
    const tab = gBrowser.getTabForBrowser(tabBrowser);

    if (remember) {
      const domain = this._maybeGetDomain(tab.linkedBrowser.currentURI);
      this.whitelistDomain(domain);
    }
    tab.private = false;
    tab.linkedBrowser.reload();
  },

  _cleanupHistory: function(domain) {
    // TODO: Implement history cleanup.
  },

  _consts: {
    AUTO_PRIVATE_TAB_NOTIFICATION: "auto-private-tab"
  },

  _adultDomainsBF: null,  // BloomFilter instance with a set of adult domains.
  _adultDomainsVer: undefined,  // Number, domain filter version.
  _usrWhiteList: new Set(),
  _usrBlackList: new Set(),
  _usrListsDirty: false,

  // XPCOM:
  classID: Components.ID(APT_ID),

  QueryInterface: XPCOMUtils.generateQI([
      Ci.nsISupports,
      Ci.nsIObserver,
  ]),

  get wrappedJSObject() {
    return this;
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AutoPrivateTabDatabase]);

function SetFromFileOrRemoveIt(file) {
  if (!file.exists() || !file.isFile())
    return new Set();
  try {
    const inStream = FileUtils.openFileInputStream(file);
    return new Set(nsIJSON.decodeFromStream(inStream, inStream.available()));
  }
  catch (e) {
    Cu.reportError(e);
    file.remove();
  }
}

function JSONToFile(obj, file) {
  const outStream = FileUtils.openFileOutputStream(file);
  try {
    nsIJSON.encodeToStream(outStream, "UTF-8", true, obj);
  }
  finally {
    outStream.close();
  }
}
