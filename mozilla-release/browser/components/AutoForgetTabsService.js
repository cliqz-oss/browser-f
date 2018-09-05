// Copyright Cliqz GmbH, 2016.

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const XPC_ID = "{998eec19-ade7-4b42-ad3f-5d19d98de71d}";
const ADULT_DOMAINS_BF_FILE_NAME = "adult-domains.bin";
const ADULT_DOMAINS_BF_RESOURCE_PATH =
    "chrome://cliqz/content/freshtab/adult-domains.bin";
const USR_BLACKLIST_FILE_NAME = "apt-extra-domains.json";
const USR_WHITELIST_FILE_NAME = "apt-white-domains.json";
const NOTIFICATION_TIMEOUT_MS = 60000;  // 1 minute.
const PREF_NAME_ENABLED = "browser.privatebrowsing.apt";

Cu.import("resource://gre/modules/BloomFilterUtils.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

Cu.import("resource:///modules/AutoForgetTabs-utils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ForgetAboutSite",
    "resource://gre/modules/ForgetAboutSite.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
    "resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyGetter(this, "gTextDecoder", () => {
  return new TextDecoder();
});

var {Sanitizer} = ChromeUtils.import("resource:///modules/Sanitizer.jsm", {});

const browserStrings = Services.strings.createBundle(
    "chrome://browser/locale/browser.properties");

var telemetry = {
  states: {
    NOTIFICATION_DISPLAYED: 0,
    USER_PICKED_RELOAD_IN_NORMAL_MODE: 1,
    USER_PICKED_ALWAYS_LOAD_IN_NORMAL_MODE: 2,
    USER_PICKED_CHANGE_SETTINGS: 3
  },
  updateHistogram: function(state) {
    Services.telemetry.getHistogramById("AUTO_FORGET_TAB_NOTIFICATION_STATES").add(state);
  }
};

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
      try {
        removeNotificationIfAny(browser, this._consts.HIST_CLEANUP_CONFIRM);
        removeNotificationIfAny(browser, this._consts.AUTO_SWITCHED_TO_FORGET);
      }
      finally {
        this._reloadBrowserAsNormal(browser, rememberDomain);
      }
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
    telemetry.updateHistogram(telemetry.states.NOTIFICATION_DISPLAYED);
    const buttons = [
      {
        label: browserStrings.GetStringFromName("apt.notification.revertButton"),
        accessKey: browserStrings.GetStringFromName(
            "apt.notification.revertButton.AK"),
        popup: null,
        callback: (notification, descr) => {
          this._reloadBrowserAsNormal(browser);
          telemetry.updateHistogram(telemetry.states.USER_PICKED_RELOAD_IN_NORMAL_MODE);
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
          telemetry.updateHistogram(telemetry.states.USER_PICKED_ALWAYS_LOAD_IN_NORMAL_MODE);
          return false;
        }
      },
      {
        label: browserStrings.GetStringFromName("apt.notification.setupButton"),
        accessKey: browserStrings.GetStringFromName(
            "apt.notification.setupButton.AK"),
        popup: null,
        callback: (notification, descr) => {
          browser.ownerGlobal.openPreferences("privacy-afm");
          telemetry.updateHistogram(telemetry.states.USER_PICKED_CHANGE_SETTINGS);
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
    let stream;
    try {
      let adultDomainsURI = Services.io.newURI(ADULT_DOMAINS_BF_RESOURCE_PATH);
      let channel = NetUtil.newChannel({
        uri: adultDomainsURI,
        loadingPrincipal: Services.scriptSecurityManager.createCodebasePrincipal(adultDomainsURI, {}),
        securityFlags: Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL,
        contentPolicyType: Ci.nsIContentPolicy.TYPE_INTERNAL_XMLHTTPREQUEST
      });
      stream = channel.open();
    }
    catch(e) {
      Cu.reportError("There are no AFT file in extension. Trying to load from file.\n");
    }

    if (!stream) {
      const bfFile = FileUtils.getFile("XCurProcD", [ADULT_DOMAINS_BF_FILE_NAME]);
      if (bfFile.exists() && bfFile.isFile()) {
        stream = FileUtils.openFileInputStream(bfFile);
      }
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
      cleanup(domain);
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
          cleanup(domain);
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

function cleanup(domain) {
  ForgetAboutSite.removeDataFromDomain(domain);
  let range = Sanitizer.getClearRange(Sanitizer.TIMESPAN_5MIN);
  let options = {
    ignoreTimespan: false,
    range,
  };
  Sanitizer.sanitize(["formdata"], options);
}

function removeNotificationIfAny(browser, id) {
  const gBrowser = browser.ownerGlobal.gBrowser;
  const notificationBox = gBrowser && gBrowser.getNotificationBox(browser);
  if (!notificationBox)
    return;  // Who knows.
  let notification = notificationBox.getNotificationWithValue(id);
  if (notification)
    notificationBox.removeNotification(notification);
}

function addOrReplaceNotification (browser, id, priName, iconURL, text,
    buttons) {
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
