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

XPCOMUtils.defineLazyServiceGetter(this, "docLoadService",
    "@mozilla.org/docloaderservice;1", "nsIWebProgress");

XPCOMUtils.defineLazyModuleGetter(this, "ForgetAboutSite",
    "resource://gre/modules/ForgetAboutSite.jsm");

XPCOMUtils.defineLazyGetter(this, "nsIJSON", () => {
  return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
});

const browserStrings = Services.strings.createBundle(
    "chrome://browser/locale/browser.properties");

function AutoPrivateTabDatabase() {
}
AutoPrivateTabDatabase.prototype = {
  // Public:

  get hasDatabase() {
    return !!this._adultDomainsBF;
  },

  get active() {
    return this.hasDatabase &&
        Preferences.get("browser.privatebrowsing.apt", false);
  },

  /**
   * @param {DOMElement} tab - <xul:tab> to toggle mode on.
   */
  toggleTabPrivateMode: function APT_toggleTabPrivateMode(tab, rememberDomain) {
    if (tab.private) {
      this._reloadTabAsNormal(tab, rememberDomain);
    }
    else {
      this._reloadTabAsPrivate(tab, rememberDomain);
    }
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

  // nsIWebProgressListener:
  onStateChange: function APT_onStateChange(aWebProgress, aRequest, aStateFlags,
      aStatus) {
    if (false /* for debugging purposes */) {
      let flags = bitFlagsToNames(
          aStateFlags, WEB_PROGRESS_LISTENER_FLAGS, Ci.nsIWebProgressListener);
      let channel = aRequest.QueryInterface(Ci.nsIChannel);
      let spec = channel.URI && channel.URI.spec;
      let oldSpec = channel.originalURI && channel.originalURI.spec;
      dump("APT_onStateChange: " + flags +
           ", URI: " + spec +
           ", originalURI: " + oldSpec + "\n");
    }
    const startOrRedirect =
        (aStateFlags & Ci.nsIWebProgressListener.STATE_START) ||
        (aStateFlags & Ci.nsIWebProgressListener.STATE_REDIRECTING);
    const isDoc =
        (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_REDIR_DOC) ||
        (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT);
    if (startOrRedirect && isDoc) {
      this._filterDocRequest(aRequest, aWebProgress.isTopLevel);
    }
  },

  // Private:

  _onProfileAfterChange: function APT__onProfileAfterChange() {
    Services.obs.addObserver(this, "profile-before-change", false);
    this._load();
    docLoadService.addProgressListener(this,
        Ci.nsIWebProgress.NOTIFY_STATE_ALL);
  },

  _onProfileBeforeChange: function APT__onProfileBeforeChange() {
    try {
      Services.obs.removeObserver(this, "profile-before-change");
      docLoadService.removeProgressListener(this);
    }
    finally {
      this._persist();
    }
  },

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

  _filterDocRequest: function APT__filterDocRequest(request, isTopLevel) {
    const channel = request.QueryInterface(Ci.nsIChannel);
    const [pm, domain] = this._shouldLoadURIInPrivateMode(
        channel.URI || channel.originalURI);
    if (!pm)
      return;
    const loadContext = findChannelLoadContext(channel);
    if (!loadContext || loadContext.usePrivateBrowsing)
      return;

    const chromeWindow = findChromeWindowForLoadContext(loadContext);
    const tab = chromeWindow.gBrowser._getTabForContentWindow(
        loadContext.associatedWindow);

    if (this._oneTimeNormalLoadSet.has(tab)) {
      this._oneTimeNormalLoadSet.delete(tab);
      return;  // Allow the tab to be loaded normally.
    }

    loadContext.usePrivateBrowsing = true;
    // Load flags seem to be unaffected by privateness after request is already
    // created, so we have to make it anonymous here to prevent http headers
    // from being populated by cookies and potentially other deanonimyzers.
    request.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
    // Unfortunately, at this moment cookie header is already set. Clear it.
    // TODO: Put request into anonymous mode earlier, as there may be other
    // pieces of data leaking, because of that.
    const httpChannel = request.QueryInterface(Ci.nsIHttpChannel);
    if (httpChannel)
      httpChannel.setEmptyRequestHeader("Cookie");

    // We filter sub-document requests, but don't want to display any
    // notifications for those, because top-level page may be left in normal
    // mode.
    if (isTopLevel)
      this._addOrUpdateNotification(tab, domain);
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

  _addOrUpdateNotification: function APT__addOrUpdateNotification(tab, domain) {
    const gBrowser = tab.ownerGlobal.gBrowser;
    const buttons = [
    {
      label: browserStrings.GetStringFromName("apt.notification.revertButton"),
      accessKey: browserStrings.GetStringFromName(
          "apt.notification.revertButton.AK"),
      popup: null,
      callback: (notification, descr) => {
        this._reloadTabAsNormal(tab);
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
        this._reloadTabAsNormal(tab, true);
        return false;
      }
    },
    {
      label: browserStrings.GetStringFromName("apt.notification.setupButton"),
      accessKey: browserStrings.GetStringFromName(
          "apt.notification.setupButton.AK"),
      popup: null,
      callback: (notification, descr) => {
        gBrowser.ownerGlobal.openPreferences("panePrivacy");
        return false;
      }
    }];

    addOrReplaceNotification(
        tab,
        this._consts.AUTO_SWITCHED_TO_FORGET,
        "PRIORITY_INFO_HIGH",
        "chrome://browser/skin/privatebrowsing-eraser.svg",
        browserStrings.GetStringFromName("apt.notification.label"),
        buttons);
  },

  _reloadTabAsNormal: function APT__reloadTabAsNormal(tab, remember) {
    const tabBrowser = tab.linkedBrowser;

    if (remember) {
      const domain = this._maybeGetDomain(tabBrowser.currentURI);
      this.whitelistDomain(domain);
    }
    else {
      this._oneTimeNormalLoadSet.add(tab);
    }

    tab.private = false;
    tabBrowser.reload();
  },

  _reloadTabAsPrivate: function APT__reloadTabAsPrivate(tab, remember) {
    const tabBrowser = tab.linkedBrowser;

    const domain = this._maybeGetDomain(tabBrowser.currentURI);
    if (remember) {
      this.blacklistDomain(domain);
    }

    tab.private = true;
    tabBrowser.reload();

    if (remember) {
      ForgetAboutSite.removeDataFromDomain(domain);
    }
    else {
      const gBrowser = tab.ownerGlobal.gBrowser;
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
            gBrowser.ownerGlobal.openLinkIn(
                "https://cliqz.com/support/daten-vergessen-modus",
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
          tab,
          this._consts.HIST_CLEANUP_CONFIRM,
          "PRIORITY_INFO_HIGH",
          "chrome://browser/skin/privatebrowsing-eraser.svg",
          browserStrings.GetStringFromName("apt.cleanupPrompt.label"),
          buttons
      );
    }
  },

  _cleanupHistory: function(domain) {
    ForgetAboutSite.removeDataFromDomain(domain);
  },

  _consts: {
    AUTO_SWITCHED_TO_FORGET: "apt-auto-switched",
    HIST_CLEANUP_CONFIRM: "apt-confirm-cleanup"
  },

  _adultDomainsBF: null,  // BloomFilter instance with a set of adult domains.
  _adultDomainsVer: undefined,  // Number, domain filter version.
  _usrWhiteList: new Set(),
  _usrBlackList: new Set(),
  _usrListsDirty: false,
  _oneTimeNormalLoadSet: new WeakSet(),  // Set of tabs to load normally.

  // XPCOM:
  classID: Components.ID(APT_ID),

  QueryInterface: XPCOMUtils.generateQI([
      Ci.nsISupports,
      Ci.nsIObserver,
      Ci.nsISupportsWeakReference,
      Ci.nsIWebProgressListener,
  ]),

  get wrappedJSObject() {
    return this;
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AutoPrivateTabDatabase]);

function findChannelLoadContext(channel) {
  if (!(channel instanceof Ci.nsIChannel))
    return;

  const notificationCallbacks = channel.notificationCallbacks ||
      (channel.loadGroup && channel.loadGroup.notificationCallbacks);
  if (!notificationCallbacks)
    return;

  try {
    return notificationCallbacks.getInterface(Ci.nsILoadContext);
  }
  catch (e) {
    // Most likely |e| is NS_NOINTERFACE, nothing can be done.
  }
}

function findChromeWindowForLoadContext(loadContext) {
  const contentWindow = loadContext.associatedWindow;
  if (!contentWindow)
    return;
  const iReqtor = contentWindow.top.QueryInterface(Ci.nsIInterfaceRequestor);
  if (!iReqtor)
    return;

  try {
    return iReqtor.getInterface(Ci.nsIWebNavigation).
        QueryInterface(Ci.nsIDocShellTreeItem).rootTreeItem.
        QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
  }
  catch (e) {
    // Nothing we can do here.
  }
}

function addOrReplaceNotification (tab, id, priName, iconURL, text, buttons) {
  const gBrowser = tab.ownerGlobal.gBrowser;
  const notificationBox = gBrowser.getNotificationBox(tab.linkedBrowser);
  // Remove existing notification, if any.
  let notification = notificationBox.getNotificationWithValue(id);
  if (notification) {
    notificationBox.removeNotification(notification);
  }
  // Add new notification.
  const priority = (priName in notificationBox) ?
      notificationBox[priName] :
      notificationBox.PRIORITY_INFO_LOW;
  notification = notificationBox.appendNotification(
      text, id, iconURL, priority, buttons);
  notification.timeout = Date.now() + 60000;  // 1 minute.
}

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

// The rest is solely for debugging purposes.

function bitFlagsToNames(flags, knownNames, intf) {
  return knownNames.map( (F) => {
    return (flags & intf[F]) ? F : undefined;
  }).filter( (s) => !!s );
}

const WEB_PROGRESS_LISTENER_FLAGS = [
    "STATE_IS_DOCUMENT",
    "STATE_IS_REQUEST",
    "STATE_IS_NETWORK",
    "STATE_IS_WINDOW",
    "STATE_IS_REDIR_DOC",
    "STATE_START",
    "STATE_REDIRECTING",
    "STATE_TRANSFERRING",
    "STATE_NEGOTIATING",
    "STATE_STOP"
];

const CHANNEL_LOAD_FLAGS = [
    "LOAD_DOCUMENT_URI",
    "LOAD_RETARGETED_DOCUMENT_URI",
    "LOAD_REPLACE",
    "LOAD_INITIAL_DOCUMENT_URI",
    "LOAD_TARGETED",
    "LOAD_CALL_CONTENT_SNIFFERS",
    "LOAD_CLASSIFY_URI",
    "LOAD_MEDIA_SNIFFER_OVERRIDES_CONTENT_TYPE",
    "LOAD_EXPLICIT_CREDENTIALS",
    "LOAD_BYPASS_SERVICE_WORKER"
];
