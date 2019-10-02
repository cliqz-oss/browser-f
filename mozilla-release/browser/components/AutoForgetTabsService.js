// Copyright Cliqz GmbH, 2016.

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const XPC_ID = "{998eec19-ade7-4b42-ad3f-5d19d98de71d}";
const ADULT_DOMAINS_BF_FILE_NAME = "adult-domains.bin";
const USR_BLACKLIST_FILE_NAME = "apt-extra-domains.json";
const USR_WHITELIST_FILE_NAME = "apt-white-domains.json";
const NOTIFICATION_TIMEOUT_MS = 60000;  // 1 minute.
const PREF_NAME_ENABLED = "browser.privatebrowsing.apt";

const {BloomFilterUtils} = ChromeUtils.import("resource://gre/modules/BloomFilterUtils.jsm");
const {FileUtils} = ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
const {Preferences} = ChromeUtils.import("resource://gre/modules/Preferences.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
const {
  RPC_PREFIX,
  AFTSvcRPCMethods,
  AFTMonRPCMethods,
  RPCCaller,
  RPCResponder,
  maybeGetDomain,
} = ChromeUtils.import("resource:///modules/AutoForgetTabs-utils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
    "resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyGetter(this, "gTextDecoder", () => {
  return new TextDecoder();
});

/**
 * This is a XPCOM-service providing access to domain database and controls for
 * "Automatic Forget Tabs" feature.
 * It's intended to work in the main process and communicate with its content
 * counterpart through IPC messaging.
 */
function AutoForgetTabsService() {
  this._tabMonitor = new RPCCaller(AFTMonRPCMethods, null, RPC_PREFIX);
  this._rpcResponder = new RPCResponder(
      this, AFTSvcRPCMethods, Services.mm, RPC_PREFIX);
}
AutoForgetTabsService.prototype = {
  // XPCOM:
  classID: Components.ID(XPC_ID),
  get wrappedJSObject() { return this; },

  // PUBLIC:

  get active() {
    return this.isActive();
  },

  blacklisted: function AFTSvc_blacklisted(domain, isURL) {
    if (isURL) {
      domain = maybeGetDomain(domain);
    }
    return !this._usrWhiteList.has(domain) &&
        (this._adultDomainsBF.test(domain) || this._usrBlackList.has(domain));
  },

  /**
   * Request addition of |domain| to user's whitelist (domains to always loaded
   * in normal mode).
   * @param {String} domain to add.
   * @returns {Boolean} whether actual changes to the list were made.
   */
  whitelistDomain: function AFTSvc_whitelistDomain(domain, isURL) {
    if (isURL) {
      domain = maybeGetDomain(domain);
    }
    if (!domain || this._usrWhiteList.has(domain))
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
  blacklistDomain: function AFTSvc_blacklistDomain(domain, isURL) {
    if (isURL) {
      domain = maybeGetDomain(domain);
    }
    if (!domain || this.blacklisted(domain))
      return false;
    this._usrBlackList.add(domain);
    this._usrWhiteList.delete(domain);
    this._usrListsDirty = true;
    return true;
  },

  // RPC
  isActive: function AFTSvc_isActive(isAFW = false) {
    return !!(this.hasDatabase() && Preferences.get(PREF_NAME_ENABLED, false));
  },

  // RPC
  hasDatabase: function AFTSvc_hasDatabase() {
    return !!this._adultDomainsBF;
  },

  // nsISupports:
  QueryInterface: ChromeUtils.generateQI([
      Ci.nsISupports,
      Ci.nsIObserver,
      Ci.nsIMessageListener
  ]),

  // nsIObserver:
  observe: function AFTSvc_observe(subject, topic, data) {
    try {
      switch(topic) {
        case "profile-after-change": {
          this._onProfileAfterChange();
          break;
        }
        case "profile-before-change": {
          this._onProfileBeforeChange();
          break;
        }
      }
    }
    catch (e) {
      dump("APT: " + e + "\n");
      dump("APT:\n" + e.stack);
    }
  },

  // PRIVATE:

  _notifyTabModeChanges: function AFTSvc__notifyTabModeChanges(browser, detail = {}) {
    let event = new CustomEvent("TabPrivateModeChanged", {
      bubbles: true,
      cancelable: false,
      detail: {
        private: detail.private,
      },
    });
    browser.dispatchEvent(event);
  },

  _onProfileAfterChange: function AFTSvc__onProfileAfterChange() {
    Services.obs.addObserver(this, "profile-before-change", false);
    this._load();
    this._rpcResponder.connect();
    Preferences.observe(PREF_NAME_ENABLED, this._onEnabledPrefChange, this);
  },

  _onProfileBeforeChange: function AFTSvc__onProfileBeforeChange() {
    try {
      Preferences.ignore(PREF_NAME_ENABLED, this._onEnabledPrefChange, this);
      Services.obs.removeObserver(this, "profile-before-change");
      this._rpcResponder.disconnect();
    }
    finally {
      this._persist();
    }
  },

  _onEnabledPrefChange: function AFTSvc__onEnabledPrefChange(enabled) {
    // Broadcast to all tab monitors.
    this._tabMonitor.switchMonitor(Services.mm, enabled);
  },

  _persist: function AFTSvc_persist() {
    if (!this._usrListsDirty)
      return
    JSONToFile([...this._usrBlackList],
        FileUtils.getFile("ProfD", [USR_BLACKLIST_FILE_NAME]));
    JSONToFile([...this._usrWhiteList],
        FileUtils.getFile("ProfD", [USR_WHITELIST_FILE_NAME]));
  },

  _load: function AFTSvc_load() {
    let stream;

    const bfFile = FileUtils.getFile("XCurProcD", [ADULT_DOMAINS_BF_FILE_NAME]);
    if (bfFile.exists() && bfFile.isFile()) {
      stream = FileUtils.openFileInputStream(bfFile);
    }

    if (stream) {
      try {
        let [filter, version] = BloomFilterUtils.loadFromStream(stream);
        this._adultDomainsBF = filter;
        this._adultDomainsVer = version;
      }
      finally {
        stream.close();
      }
    }
    else {
      Cu.reportError("No AFT database file or resource.\n");
    }

    this._usrBlackList = readSetFromFileOrRemoveIt(
        FileUtils.getFile("ProfD", [USR_BLACKLIST_FILE_NAME]));

    this._usrWhiteList = readSetFromFileOrRemoveIt(
        FileUtils.getFile("ProfD", [USR_WHITELIST_FILE_NAME]));
  },

  _consts: {
    AUTO_SWITCHED_TO_FORGET: "apt-auto-switched",
    HIST_CLEANUP_CONFIRM: "apt-confirm-cleanup"
  },

  _tempNormalLoadMap: new WeakMap(),  // browser-domain map to load normally.
  _adultDomainsBF: null,  // BloomFilter instance with a set of adult domains.
  _adultDomainsVer: undefined,  // Number, domain filter version.
  _usrWhiteList: new Set(),
  _usrBlackList: new Set(),
  _usrListsDirty: false
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AutoForgetTabsService]);

function readSetFromFileOrRemoveIt(file) {
  if (!file.exists() || !file.isFile())
    return new Set();
  try {
    const inStream = FileUtils.openFileInputStream(file);
    let bytes = NetUtil.readInputStream(inStream, inStream.available());
    return new Set(JSON.parse(gTextDecoder.decode(bytes)));
  }
  catch (e) {
    Cu.reportError(e);
    file.remove();
  }
}

function JSONToFile(obj, file) {
  const outStream = FileUtils.openFileOutputStream(file);
  try {
    let savedata = JSON.stringify(obj);
    outStream.write(savedata, savedata.length);
  }
  finally {
    outStream.close();
  }
}

this.EXPORTED_SYMBOLS = ["AutoForgetTabsService"];
