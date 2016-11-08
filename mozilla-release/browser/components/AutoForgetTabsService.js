// Copyright Cliqz GmbH, 2016.

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const XPC_ID = "{998eec19-ade7-4b42-ad3f-5d19d98de71d}";
const ADULT_DOMAINS_BF_FILE_NAME = "adult-domains.bin";
const USR_BLACKLIST_FILE_NAME = "apt-extra-domains.json";
const USR_WHITELIST_FILE_NAME = "apt-white-domains.json";
const NOTIFICATION_TIMEOUT_MS = 60000;  // 1 minute.
const PREF_NAME_ENABLED = "browser.privatebrowsing.apt";

Cu.import("resource://gre/modules/BloomFilterUtils.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("resource:///modules/AutoForgetTabs-utils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ForgetAboutSite",
    "resource://gre/modules/ForgetAboutSite.jsm");

XPCOMUtils.defineLazyGetter(this, "nsJSON", () => {
  return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
});

const browserStrings = Services.strings.createBundle(
    "chrome://browser/locale/browser.properties");

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

  /**
   * @param {DOMElement} browser - <xul:browser> to toggle mode on.
   */
  toggleBrowserPrivateMode: function AFTSvc_toggleBrowserPrivateMode(
      browser, rememberDomain) {
    if (browser.loadContext.usePrivateBrowsing) {
      this._reloadBrowserAsNormal(browser, rememberDomain);
    }
    else {
      this._reloadBrowserAsPrivate(browser, rememberDomain);
    }
  },

  blacklisted: function AFTSvc_blacklisted(domain) {
    return !this._usrWhiteList.has(domain) &&
        (this._adultDomainsBF.test(domain) || this._usrBlackList.has(domain));
  },

  /**
   * Request addition of |domain| to user's whitelist (domains to always loaded
   * in normal mode).
   * @param {String} domain to add.
   * @returns {Boolean} whether actual changes to the list were made.
   */
  whitelistDomain: function AFTSvc_whitelistDomain(domain) {
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
  blacklistDomain: function AFTSvc_blacklistDomain(domain) {
    if (!domain || this.blacklisted(domain))
      return false;
    this._usrBlackList.add(domain);
    this._usrWhiteList.delete(domain);
    this._usrListsDirty = true;
    return true;
  },

  // RPC
  isActive: function AFTSvc_isActive() {
    return !!(this.hasDatabase() && Preferences.get(PREF_NAME_ENABLED, false));
  },

  // RPC
  hasDatabase: function AFTSvc_hasDatabase() {
    return !!this._adultDomainsBF;
  },

  // RPC
  shouldForget: function AFTSvc_shouldForget(browser, domain) {
    const isTempNormalDomain =
        this._tempNormalLoadMap.has(browser) &&
        this._tempNormalLoadMap.get(browser) === domain;

    if (!isTempNormalDomain) {
      // After user has left the temporarily whitelisted domain, forget it.
      // See DB-770.
      this._tempNormalLoadMap.delete(browser);
    }

    return !isTempNormalDomain && this.blacklisted(domain);
  },

  // RPC
  notifyAutoSwitched: function AFTSvc_notifyAutoSwitched(browser) {
    const buttons = [
      {
        label: browserStrings.GetStringFromName("apt.notification.revertButton"),
        accessKey: browserStrings.GetStringFromName(
            "apt.notification.revertButton.AK"),
        popup: null,
        callback: (notification, descr) => {
          this._reloadBrowserAsNormal(browser);
          return false;
        }
      },
      {
        label: browserStrings.GetStringFromName(
            "apt.notification.alwaysNormalButton"),
        accessKey: browserStrings.GetStringFromName(
            "apt.notification.alwaysNormalButton.AK"),
        popup: null,
        callback: (notification, descr) => {
          this._reloadBrowserAsNormal(browser, true);
          return false;
        }
      },
      {
        label: browserStrings.GetStringFromName("apt.notification.setupButton"),
        accessKey: browserStrings.GetStringFromName(
            "apt.notification.setupButton.AK"),
        popup: null,
        callback: (notification, descr) => {
          browser.ownerGlobal.openPreferences("panePrivacy");
          return false;
        }
      }
    ];

    addOrReplaceNotification(
        browser,
        this._consts.AUTO_SWITCHED_TO_FORGET,
        "PRIORITY_INFO_HIGH",
        "chrome://browser/skin/privatebrowsing-eraser.svg",
        browserStrings.GetStringFromName("apt.notification.label"),
        buttons);
  },

  // nsISupports:
  QueryInterface: XPCOMUtils.generateQI([
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
    var bfFile = FileUtils.getFile("ProfD", [ADULT_DOMAINS_BF_FILE_NAME]);
    if (!bfFile.exists() || !bfFile.isFile()) {
      bfFile = FileUtils.getFile("XCurProcD", [ADULT_DOMAINS_BF_FILE_NAME]);
    }
    if (bfFile.exists() && bfFile.isFile()) {
      let [filter, version] = BloomFilterUtils.loadFromFile(bfFile);
      this._adultDomainsBF = filter;
      this._adultDomainsVer = version;
    }
    else {
      dump("No AFT database file: " + bfFile.path + "\n");
    }

    this._usrBlackList = readSetFromFileOrRemoveIt(
        FileUtils.getFile("ProfD", [USR_BLACKLIST_FILE_NAME]));

    this._usrWhiteList = readSetFromFileOrRemoveIt(
        FileUtils.getFile("ProfD", [USR_WHITELIST_FILE_NAME]));
  },

  _reloadBrowserAsNormal: function AFTSvc__reloadBrowserAsNormal(
      browser, remember) {
    const domain = maybeGetDomain(browser.currentURI);
    if (remember) {
      this.whitelistDomain(domain);
    }
    else {
      this._tempNormalLoadMap.set(browser, domain);
    }

    this._tabMonitor.switchPrivateFlag(browser.messageManager, false);
  },

  _reloadBrowserAsPrivate: function AFTSvc__reloadBrowserAsPrivate(
      browser, remember) {
    const domain = maybeGetDomain(browser.currentURI);
    if (remember) {
      this.blacklistDomain(domain);
    }

    this._tabMonitor.switchPrivateFlag(browser.messageManager, true);

    if (!domain)
      return;

    if (remember) {
      ForgetAboutSite.removeDataFromDomain(domain);
    }
    else {
      this._confirmCleanup(browser, domain);
    }
  },

  _confirmCleanup: function AFTSvc__confirmCleanup(browser, domain) {
    const buttons = [
      {
        label: browserStrings.GetStringFromName(
            "apt.cleanupPrompt.cleanButton"),
        callback: (notification, descr) => {
          ForgetAboutSite.removeDataFromDomain(domain);
          return false;
        }
      },
      {
        label: browserStrings.GetStringFromName(
            "apt.cleanupPrompt.leaveButton"),
        callback: (notification, descr) => { return false; }
      },
      {
        label: browserStrings.GetStringFromName(
            "apt.cleanupPrompt.learnMoreButton"),
        callback: (notification, descr) => {
          browser.ownerGlobal.openLinkIn(
              "https://cliqz.com/support/automatic-forget-mode",
              "tab",
              {
                relatedToCurrent: true,
                inBackground: false
              });
          return true;  // Don't close the notification.
        }
      }
    ];
    addOrReplaceNotification(
        browser,
        this._consts.HIST_CLEANUP_CONFIRM,
        "PRIORITY_INFO_HIGH",
        "chrome://browser/skin/privatebrowsing-eraser.svg",
        browserStrings.GetStringFromName("apt.cleanupPrompt.label"),
        buttons
    );
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

function addOrReplaceNotification (browser, id, priName, iconURL, text, buttons) {
  const gBrowser = browser.ownerGlobal.gBrowser;
  const notificationBox = gBrowser && gBrowser.getNotificationBox(browser);
  if (!notificationBox)
    return;  // Who knows.
  // Remove existing notification, if any.
  let notification = notificationBox.getNotificationWithValue(id);
  if (notification)
    notificationBox.removeNotification(notification);
  // Add new notification.
  const priority = (priName in notificationBox) ?
      notificationBox[priName] :
      notificationBox.PRIORITY_INFO_LOW;
  notification = notificationBox.appendNotification(
      text, id, iconURL, priority, buttons);
  notification.timeout = Date.now() + NOTIFICATION_TIMEOUT_MS;
}

function readSetFromFileOrRemoveIt(file) {
  if (!file.exists() || !file.isFile())
    return new Set();
  try {
    const inStream = FileUtils.openFileInputStream(file);
    return new Set(nsJSON.decodeFromStream(inStream, inStream.available()));
  }
  catch (e) {
    Cu.reportError(e);
    file.remove();
  }
}

function JSONToFile(obj, file) {
  const outStream = FileUtils.openFileOutputStream(file);
  try {
    nsJSON.encodeToStream(outStream, "UTF-8", true, obj);
  }
  finally {
    outStream.close();
  }
}
