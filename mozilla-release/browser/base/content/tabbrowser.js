
/*LS-199671*/var { CliqzLogger } = ChromeUtils.import('resource://gre/modules/CliqzLogger.jsm');
var __L_V__3 = CliqzLogger.init('mozilla-release/browser/base/content/tabbrowser.js','tabbrowser');/*LE-199671*/
/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

{
  // start private scope for gBrowser
  /**
   * A set of known icons to use for internal pages. These are hardcoded so we can
   * start loading them faster than ContentLinkHandler would normally find them.
   */
  const FAVICON_DEFAULTS = {
    "about:newtab": "chrome://branding/content/icon32.png",
    "about:home": "chrome://branding/content/icon32.png",
    "about:welcome": "chrome://branding/content/icon32.png",
    "about:privatebrowsing":
      "chrome://browser/skin/privatebrowsing/favicon.svg",
  };

  window._gBrowser = {
    init() {
__L_V__3({
    lN: 24,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__3';
      ChromeUtils.defineModuleGetter(
        this,
        "AsyncTabSwitcher",
        "resource:///modules/AsyncTabSwitcher.jsm"
      );
      ChromeUtils.defineModuleGetter(
        this,
        "UrlbarProviderOpenTabs",
        "resource:///modules/UrlbarProviderOpenTabs.jsm"
      );

      Services.obs.addObserver(this, "contextual-identity-updated");

      Services.els.addSystemEventListener(document, "keydown", this, false);
      if (AppConstants.platform == "macosx") {
__L_V__3({
    lN: 39,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__3';
        Services.els.addSystemEventListener(document, "keypress", this, false);
      }
      window.addEventListener("sizemodechange", this);
      window.addEventListener("occlusionstatechange", this);
      window.addEventListener("framefocusrequested", this);

      this.tabContainer.init();
      this._setupInitialBrowserAndTab();

      if (Services.prefs.getBoolPref("browser.display.use_system_colors")) {
__L_V__3({
    lN: 49,tT:'if',pr:'Services.prefs.getBoolPref(browser.display.use_system_colors)',eT:{},fN:''
  });'__L_V__3';
        this.tabpanels.style.backgroundColor = "-moz-default-background-color";
      } else if (
        Services.prefs.getIntPref("browser.display.document_color_use") == 2
      ) {
__L_V__3({
    lN: 53,tT:'if',pr:' Services.prefs.getIntPref(browser.display.document_color_use) == 2 ',eT:{},fN:''
  });'__L_V__3';
        this.tabpanels.style.backgroundColor = Services.prefs.getCharPref(
          "browser.display.background_color"
        );
      }

      let messageManager = window.getGroupMessageManager("browsers");
      window.messageManager.addMessageListener("contextmenu", this);

      if (gMultiProcessBrowser) {
__L_V__3({
    lN: 62,tT:'if',pr:'gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        messageManager.addMessageListener("DOMTitleChanged", this);
        messageManager.addMessageListener("DOMWindowClose", this);
        messageManager.addMessageListener("Browser:Init", this);
      } else {
        this._outerWindowIDBrowserMap.set(
          this.selectedBrowser.outerWindowID,
          this.selectedBrowser
        );
      }
      messageManager.addMessageListener("RefreshBlocker:Blocked", this);

      this._setFindbarData();

      XPCOMUtils.defineLazyModuleGetters(this, {
        E10SUtils: "resource://gre/modules/E10SUtils.jsm",
      });

      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "animationsEnabled",
        "toolkit.cosmeticAnimations.enabled"
      );

      this._setupEventListeners();
      this._initialized = true;
    },

    ownerGlobal: window,

    ownerDocument: document,

    closingTabsEnum: { ALL: 0, OTHER: 1, TO_END: 2, MULTI_SELECTED: 3 },

    _visibleTabs: null,

    _tabs: null,

    _lastRelatedTabMap: new WeakMap(),

    mProgressListeners: [],

    mTabsProgressListeners: [],

    _tabListeners: new Map(),

    _tabFilters: new Map(),

    _isBusy: false,

    _outerWindowIDBrowserMap: new Map(),

    arrowKeysShouldWrap: AppConstants == "macosx",

    _autoScrollPopup: null,

    _previewMode: false,

    _lastFindValue: "",

    _contentWaitingCount: 0,

    _tabLayerCache: [],

    tabAnimationsInProgress: 0,

    _XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

    /**
     * Binding from browser to tab
     */
    _tabForBrowser: new WeakMap(),

    /**
     * `_createLazyBrowser` will define properties on the unbound lazy browser
     * which correspond to properties defined in MozBrowser which will be bound to
     * the browser when it is inserted into the document.  If any of these
     * properties are accessed by consumers, `_insertBrowser` is called and
     * the browser is inserted to ensure that things don't break.  This list
     * provides the names of properties that may be called while the browser
     * is in its unbound (lazy) state.
     */
    _browserBindingProperties: [
      "canGoBack",
      "canGoForward",
      "goBack",
      "goForward",
      "permitUnload",
      "reload",
      "reloadWithFlags",
      "stop",
      "loadURI",
      "gotoIndex",
      "currentURI",
      "documentURI",
      "remoteType",
      "preferences",
      "imageDocument",
      "isRemoteBrowser",
      "messageManager",
      "getTabBrowser",
      "finder",
      "fastFind",
      "sessionHistory",
      "contentTitle",
      "characterSet",
      "fullZoom",
      "textZoom",
      "tabHasCustomZoom",
      "webProgress",
      "addProgressListener",
      "removeProgressListener",
      "audioPlaybackStarted",
      "audioPlaybackStopped",
      "resumeMedia",
      "mute",
      "unmute",
      "blockedPopups",
      "lastURI",
      "purgeSessionHistory",
      "stopScroll",
      "startScroll",
      "userTypedValue",
      "userTypedClear",
      "didStartLoadSinceLastUserTyping",
      "audioMuted",
    ],

    _removingTabs: [],

    _multiSelectedTabsSet: new WeakSet(),

    _lastMultiSelectedTabRef: null,

    _clearMultiSelectionLocked: false,

    _clearMultiSelectionLockedOnce: false,

    _multiSelectChangeStarted: false,

    _multiSelectChangeAdditions: new Set(),

    _multiSelectChangeRemovals: new Set(),

    _multiSelectChangeSelected: false,

    /**
     * Tab close requests are ignored if the window is closing anyway,
     * e.g. when holding Ctrl+W.
     */
    _windowIsClosing: false,

    /**
     * We'll use this to cache the accessor to the title element.
     * It's important that the defualt is `undefined`, so that it
     * can be set to `null` by the `querySelector`.
     */
    _titleElement: undefined,

    preloadedBrowser: null,

    /**
     * This defines a proxy which allows us to access browsers by
     * index without actually creating a full array of browsers.
     */
    browsers: new Proxy([], {
      has: (target, name) => {
        if (typeof name == "string" && Number.isInteger(parseInt(name))) {
__L_V__3({
    lN: 229,tT:'if',pr:'typeof name == string && Number.isInteger(parseInt(name))',eT:{},fN:''
  });'__L_V__3';
          return name in gBrowser.tabs;
        }
        return false;
      },
      get: (target, name) => {
        if (name == "length") {
__L_V__3({
    lN: 235,tT:'if',pr:'name == length',eT:{},fN:''
  });'__L_V__3';
          return gBrowser.tabs.length;
        }
        if (typeof name == "string" && Number.isInteger(parseInt(name))) {
__L_V__3({
    lN: 238,tT:'if',pr:'typeof name == string && Number.isInteger(parseInt(name))',eT:{},fN:''
  });'__L_V__3';
          if (!(name in gBrowser.tabs)) {
__L_V__3({
    lN: 239,tT:'if',pr:'!(name in gBrowser.tabs)',eT:{},fN:''
  });'__L_V__3';
            return undefined;
          }
          return gBrowser.tabs[name].linkedBrowser;
        }
        return target[name];
      },
    }),

    /**
     * List of browsers whose docshells must be active in order for print preview
     * to work.
     */
    _printPreviewBrowsers: new Set(),

    _switcher: null,

    _soundPlayingAttrRemovalTimer: 0,

    _hoverTabTimer: null,

    get tabContainer() {
__L_V__3({
    lN: 260,tT:'func',pr:'',eT:{},fN:'tabContainer'
  });'__L_V__3';
      delete this.tabContainer;
      return (this.tabContainer = document.getElementById("tabbrowser-tabs"));
    },

    get tabs() {
__L_V__3({
    lN: 265,tT:'func',pr:'',eT:{},fN:'tabs'
  });'__L_V__3';
      if (!this._tabs) {
__L_V__3({
    lN: 266,tT:'if',pr:'!this._tabs',eT:{},fN:''
  });'__L_V__3';
        this._tabs = this.tabContainer.allTabs;
      }
      return this._tabs;
    },

    get tabbox() {
__L_V__3({
    lN: 272,tT:'func',pr:'',eT:{},fN:'tabbox'
  });'__L_V__3';
      delete this.tabbox;
      return (this.tabbox = document.getElementById("tabbrowser-tabbox"));
    },

    get tabpanels() {
__L_V__3({
    lN: 277,tT:'func',pr:'',eT:{},fN:'tabpanels'
  });'__L_V__3';
      delete this.tabpanels;
      return (this.tabpanels = document.getElementById("tabbrowser-tabpanels"));
    },

    addEventListener(...args) {
__L_V__3({
    lN: 282,tT:'func',pr:'',eT:{'args':args},fN:'addEventListener'
  });'__L_V__3';
      this.tabpanels.addEventListener(...args);
    },

    removeEventListener(...args) {
__L_V__3({
    lN: 286,tT:'func',pr:'',eT:{'args':args},fN:'removeEventListener'
  });'__L_V__3';
      this.tabpanels.removeEventListener(...args);
    },

    dispatchEvent(...args) {
__L_V__3({
    lN: 290,tT:'func',pr:'',eT:{'args':args},fN:'dispatchEvent'
  });'__L_V__3';
      return this.tabpanels.dispatchEvent(...args);
    },

    get visibleTabs() {
__L_V__3({
    lN: 294,tT:'func',pr:'',eT:{},fN:'visibleTabs'
  });'__L_V__3';
      if (!this._visibleTabs) {
__L_V__3({
    lN: 295,tT:'if',pr:'!this._visibleTabs',eT:{},fN:''
  });'__L_V__3';
        this._visibleTabs = Array.prototype.filter.call(
          this.tabs,
          tab => !tab.hidden && !tab.closing
        );
      }
      return this._visibleTabs;
    },

    get _numPinnedTabs() {
__L_V__3({
    lN: 304,tT:'func',pr:'',eT:{},fN:'_numPinnedTabs'
  });'__L_V__3';
      for (var i = 0; i < this.tabs.length; i++) {
        if (!this.tabs[i].pinned) {
__L_V__3({
    lN: 306,tT:'if',pr:'!this.tabs[i].pinned',eT:{},fN:''
  });'__L_V__3';
          break;
        }
      }
      return i;
    },

    set selectedTab(val) {
__L_V__3({
    lN: 313,tT:'func',pr:'',eT:{'val':val},fN:'selectedTab'
  });'__L_V__3';
      if (gNavToolbox.collapsed && !this._allowTabChange) {
__L_V__3({
    lN: 314,tT:'if',pr:'gNavToolbox.collapsed && !this._allowTabChange',eT:{},fN:''
  });'__L_V__3';
        return this.tabbox.selectedTab;
      }
      // Update the tab
      this.tabbox.selectedTab = val;
      return val;
    },

    get selectedTab() {
__L_V__3({
    lN: 322,tT:'func',pr:'',eT:{},fN:'selectedTab'
  });'__L_V__3';
      return this._selectedTab;
    },

    get selectedBrowser() {
__L_V__3({
    lN: 326,tT:'func',pr:'',eT:{},fN:'selectedBrowser'
  });'__L_V__3';
      return this._selectedBrowser;
    },

    _setupInitialBrowserAndTab() {
__L_V__3({
    lN: 330,tT:'func',pr:'',eT:{},fN:'_setupInitialBrowserAndTab'
  });'__L_V__3';
      // See browser.js for the meaning of window.arguments.
      // Bug 1485961 covers making this more sane.
      let userContextId = window.arguments && window.arguments[5];

      let tabArgument = gBrowserInit.getTabToAdopt();

      // We only need sameProcessAsFrameLoader in the case where we're passed a tab
      let sameProcessAsFrameLoader;
      // If we have a tab argument with browser, we use its remoteType. Otherwise,
      // if e10s is disabled or there's a parent process opener (e.g. parent
      // process about: page) for the content tab, we use a parent
      // process remoteType. Otherwise, we check the URI to determine
      // what to do - if there isn't one, we default to the default remote type.
      let remoteType;
      if (tabArgument && tabArgument.linkedBrowser) {
__L_V__3({
    lN: 345,tT:'if',pr:'tabArgument && tabArgument.linkedBrowser',eT:{},fN:''
  });'__L_V__3';
        remoteType = tabArgument.linkedBrowser.remoteType;
        sameProcessAsFrameLoader = tabArgument.linkedBrowser.frameLoader;
      } else if (
        !gMultiProcessBrowser ||
        window.hasOpenerForInitialContentBrowser
      ) {
__L_V__3({
    lN: 351,tT:'if',pr:' !gMultiProcessBrowser || window.hasOpenerForInitialContentBrowser ',eT:{},fN:''
  });'__L_V__3';
        remoteType = E10SUtils.NOT_REMOTE;
      } else {
        let uriToLoad = gBrowserInit.uriToLoadPromise;
        if (uriToLoad && Array.isArray(uriToLoad)) {
__L_V__3({
    lN: 355,tT:'if',pr:'uriToLoad && Array.isArray(uriToLoad)',eT:{},fN:''
  });'__L_V__3';
          uriToLoad = uriToLoad[0]; // we only care about the first item
        }

        if (uriToLoad && typeof uriToLoad == "string") {
__L_V__3({
    lN: 359,tT:'if',pr:'uriToLoad && typeof uriToLoad == string',eT:{},fN:''
  });'__L_V__3';
          remoteType = E10SUtils.getRemoteTypeForURI(
            uriToLoad,
            gMultiProcessBrowser,
            gFissionBrowser,
            E10SUtils.DEFAULT_REMOTE_TYPE
          );
        } else {
          remoteType = E10SUtils.DEFAULT_REMOTE_TYPE;
        }
      }

      if (tabArgument && tabArgument.hasAttribute("usercontextid")) {
__L_V__3({
    lN: 371,tT:'if',pr:'tabArgument && tabArgument.hasAttribute(usercontextid)',eT:{},fN:''
  });'__L_V__3';
        // The window's first argument is a tab if and only if we are swapping tabs.
        // We must set the browser's usercontextid so that the newly created remote
        // tab child has the correct usercontextid.
        userContextId = parseInt(tabArgument.getAttribute("usercontextid"), 10);
      }

      let createOptions = {
        uriIsAboutBlank: false,
        userContextId,
        sameProcessAsFrameLoader,
        remoteType,
      };
      let browser = this.createBrowser(createOptions);
      browser.setAttribute("primary", "true");
      if (gBrowserAllowScriptsToCloseInitialTabs) {
__L_V__3({
    lN: 386,tT:'if',pr:'gBrowserAllowScriptsToCloseInitialTabs',eT:{},fN:''
  });'__L_V__3';
        browser.setAttribute("allowscriptstoclose", "true");
      }
      browser.droppedLinkHandler = handleDroppedLink;
      browser.loadURI = _loadURI.bind(null, browser);

      let uniqueId = this._generateUniquePanelID();
      let panel = this.getPanel(browser);
      panel.id = uniqueId;
      this.tabpanels.appendChild(panel);

      let tab = this.tabs[0];
      tab.linkedPanel = uniqueId;
      this._selectedTab = tab;
      this._selectedBrowser = browser;
      tab.permanentKey = browser.permanentKey;
      tab._tPos = 0;
      tab._fullyOpen = true;
      tab.linkedBrowser = browser;

      if (userContextId) {
__L_V__3({
    lN: 406,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__3';
        tab.setAttribute("usercontextid", userContextId);
        ContextualIdentityService.setTabStyle(tab);
      }

      this._tabForBrowser.set(browser, tab);

      this._appendStatusPanel();

      // This is the initial browser, so it's usually active; the default is false
      // so we have to update it:
      browser.docShellIsActive = this.shouldActivateDocShell(browser);

      let autoScrollPopup = browser._createAutoScrollPopup();
      autoScrollPopup.id = "autoscroller";
      document.getElementById("mainPopupSet").appendChild(autoScrollPopup);
      browser.setAttribute("autoscrollpopup", autoScrollPopup.id);
      this._autoScrollPopup = autoScrollPopup;

      // Hook the browser up with a progress listener.
      let tabListener = new TabProgressListener(tab, browser, true, false);
      let filter = Cc[
        "@mozilla.org/appshell/component/browser-status-filter;1"
      ].createInstance(Ci.nsIWebProgress);
      filter.addProgressListener(tabListener, Ci.nsIWebProgress.NOTIFY_ALL);
      this._tabListeners.set(tab, tabListener);
      this._tabFilters.set(tab, filter);
      browser.webProgress.addProgressListener(
        filter,
        Ci.nsIWebProgress.NOTIFY_ALL
      );
    },

    /**
     * BEGIN FORWARDED BROWSER PROPERTIES.  IF YOU ADD A PROPERTY TO THE BROWSER ELEMENT
     * MAKE SURE TO ADD IT HERE AS WELL.
     */
    get canGoBack() {
__L_V__3({
    lN: 443,tT:'func',pr:'',eT:{},fN:'canGoBack'
  });'__L_V__3';
      return this.selectedBrowser.canGoBack;
    },

    get canGoForward() {
__L_V__3({
    lN: 447,tT:'func',pr:'',eT:{},fN:'canGoForward'
  });'__L_V__3';
      return this.selectedBrowser.canGoForward;
    },

    goBack() {
__L_V__3({
    lN: 451,tT:'func',pr:'',eT:{},fN:'goBack'
  });'__L_V__3';
      return this.selectedBrowser.goBack();
    },

    goForward() {
__L_V__3({
    lN: 455,tT:'func',pr:'',eT:{},fN:'goForward'
  });'__L_V__3';
      return this.selectedBrowser.goForward();
    },

    reload() {
__L_V__3({
    lN: 459,tT:'func',pr:'',eT:{},fN:'reload'
  });'__L_V__3';
      return this.selectedBrowser.reload();
    },

    reloadWithFlags(aFlags) {
__L_V__3({
    lN: 463,tT:'func',pr:'',eT:{'aFlags':aFlags},fN:'reloadWithFlags'
  });'__L_V__3';
      return this.selectedBrowser.reloadWithFlags(aFlags);
    },

    stop() {
__L_V__3({
    lN: 467,tT:'func',pr:'',eT:{},fN:'stop'
  });'__L_V__3';
      return this.selectedBrowser.stop();
    },

    /**
     * throws exception for unknown schemes
     */
    loadURI(aURI, aParams) {
__L_V__3({
    lN: 474,tT:'func',pr:'',eT:{'aURI':aURI,'aParams':aParams},fN:'loadURI'
  });'__L_V__3';
      return this.selectedBrowser.loadURI(aURI, aParams);
    },

    gotoIndex(aIndex) {
__L_V__3({
    lN: 478,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'gotoIndex'
  });'__L_V__3';
      return this.selectedBrowser.gotoIndex(aIndex);
    },

    get currentURI() {
__L_V__3({
    lN: 482,tT:'func',pr:'',eT:{},fN:'currentURI'
  });'__L_V__3';
      return this.selectedBrowser.currentURI;
    },

    get finder() {
__L_V__3({
    lN: 486,tT:'func',pr:'',eT:{},fN:'finder'
  });'__L_V__3';
      return this.selectedBrowser.finder;
    },

    get docShell() {
__L_V__3({
    lN: 490,tT:'func',pr:'',eT:{},fN:'docShell'
  });'__L_V__3';
      return this.selectedBrowser.docShell;
    },

    get webNavigation() {
__L_V__3({
    lN: 494,tT:'func',pr:'',eT:{},fN:'webNavigation'
  });'__L_V__3';
      return this.selectedBrowser.webNavigation;
    },

    get webProgress() {
__L_V__3({
    lN: 498,tT:'func',pr:'',eT:{},fN:'webProgress'
  });'__L_V__3';
      return this.selectedBrowser.webProgress;
    },

    get contentWindow() {
__L_V__3({
    lN: 502,tT:'func',pr:'',eT:{},fN:'contentWindow'
  });'__L_V__3';
      return this.selectedBrowser.contentWindow;
    },

    get sessionHistory() {
__L_V__3({
    lN: 506,tT:'func',pr:'',eT:{},fN:'sessionHistory'
  });'__L_V__3';
      return this.selectedBrowser.sessionHistory;
    },

    get markupDocumentViewer() {
__L_V__3({
    lN: 510,tT:'func',pr:'',eT:{},fN:'markupDocumentViewer'
  });'__L_V__3';
      return this.selectedBrowser.markupDocumentViewer;
    },

    get contentDocument() {
__L_V__3({
    lN: 514,tT:'func',pr:'',eT:{},fN:'contentDocument'
  });'__L_V__3';
      return this.selectedBrowser.contentDocument;
    },

    get contentTitle() {
__L_V__3({
    lN: 518,tT:'func',pr:'',eT:{},fN:'contentTitle'
  });'__L_V__3';
      return this.selectedBrowser.contentTitle;
    },

    get contentPrincipal() {
__L_V__3({
    lN: 522,tT:'func',pr:'',eT:{},fN:'contentPrincipal'
  });'__L_V__3';
      return this.selectedBrowser.contentPrincipal;
    },

    get securityUI() {
__L_V__3({
    lN: 526,tT:'func',pr:'',eT:{},fN:'securityUI'
  });'__L_V__3';
      return this.selectedBrowser.securityUI;
    },

    set fullZoom(val) {
__L_V__3({
    lN: 530,tT:'func',pr:'',eT:{'val':val},fN:'fullZoom'
  });'__L_V__3';
      this.selectedBrowser.fullZoom = val;
    },

    get fullZoom() {
__L_V__3({
    lN: 534,tT:'func',pr:'',eT:{},fN:'fullZoom'
  });'__L_V__3';
      return this.selectedBrowser.fullZoom;
    },

    set textZoom(val) {
__L_V__3({
    lN: 538,tT:'func',pr:'',eT:{'val':val},fN:'textZoom'
  });'__L_V__3';
      this.selectedBrowser.textZoom = val;
    },

    get textZoom() {
__L_V__3({
    lN: 542,tT:'func',pr:'',eT:{},fN:'textZoom'
  });'__L_V__3';
      return this.selectedBrowser.textZoom;
    },

    get isSyntheticDocument() {
__L_V__3({
    lN: 546,tT:'func',pr:'',eT:{},fN:'isSyntheticDocument'
  });'__L_V__3';
      return this.selectedBrowser.isSyntheticDocument;
    },

    set userTypedValue(val) {
__L_V__3({
    lN: 550,tT:'func',pr:'',eT:{'val':val},fN:'userTypedValue'
  });'__L_V__3';
      this.selectedBrowser.userTypedValue = val;
    },

    get userTypedValue() {
__L_V__3({
    lN: 554,tT:'func',pr:'',eT:{},fN:'userTypedValue'
  });'__L_V__3';
      return this.selectedBrowser.userTypedValue;
    },

    _invalidateCachedTabs() {
__L_V__3({
    lN: 558,tT:'func',pr:'',eT:{},fN:'_invalidateCachedTabs'
  });'__L_V__3';
      this._tabs = null;
      this._visibleTabs = null;
    },

    _setFindbarData() {
__L_V__3({
    lN: 563,tT:'func',pr:'',eT:{},fN:'_setFindbarData'
  });'__L_V__3';
      // Ensure we know what the find bar key is in the content process:
      let { sharedData } = Services.ppmm;
      if (!sharedData.has("Findbar:Shortcut")) {
__L_V__3({
    lN: 566,tT:'if',pr:'!sharedData.has(Findbar:Shortcut)',eT:{},fN:''
  });'__L_V__3';
        let keyEl = document.getElementById("key_find");
        let mods = keyEl
          .getAttribute("modifiers")
          .replace(
            /accel/i,
            AppConstants.platform == "macosx" ? "meta" : "control"
          );
        sharedData.set("Findbar:Shortcut", {
          key: keyEl.getAttribute("key"),
          shiftKey: mods.includes("shift"),
          ctrlKey: mods.includes("control"),
          altKey: mods.includes("alt"),
          metaKey: mods.includes("meta"),
        });
      }
    },

    isFindBarInitialized(aTab) {
__L_V__3({
    lN: 584,tT:'func',pr:'',eT:{'aTab':aTab},fN:'isFindBarInitialized'
  });'__L_V__3';
      return (aTab || this.selectedTab)._findBar != undefined;
    },

    /**
     * Get the already constructed findbar
     */
    getCachedFindBar(aTab = this.selectedTab) {
__L_V__3({
    lN: 591,tT:'func',pr:'',eT:{'aTab':aTab},fN:'getCachedFindBar'
  });'__L_V__3';
      return aTab._findBar;
    },

    /**
     * Get the findbar, and create it if it doesn't exist.
     * @return the find bar (or null if the window or tab is closed/closing in the interim).
     */
    async getFindBar(aTab = this.selectedTab) {
__L_V__3({
    lN: 599,tT:'func',pr:'',eT:{'aTab':aTab},fN:'getFindBar'
  });'__L_V__3';
      let findBar = this.getCachedFindBar(aTab);
      if (findBar) {
__L_V__3({
    lN: 601,tT:'if',pr:'findBar',eT:{},fN:''
  });'__L_V__3';
        return findBar;
      }

      // Avoid re-entrancy by caching the promise we're about to return.
      if (!aTab._pendingFindBar) {
__L_V__3({
    lN: 606,tT:'if',pr:'!aTab._pendingFindBar',eT:{},fN:''
  });'__L_V__3';
        aTab._pendingFindBar = this._createFindBar(aTab);
      }
      return aTab._pendingFindBar;
    },

    /**
     * Create a findbar instance.
     * @param aTab the tab to create the find bar for.
     * @return the created findbar, or null if the window or tab is closed/closing.
     */
    async _createFindBar(aTab) {
__L_V__3({
    lN: 617,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_createFindBar'
  });'__L_V__3';
      let findBar = document.createXULElement("findbar");
      let browser = this.getBrowserForTab(aTab);

      // The findbar should be inserted after the browserStack and, if present for
      // this tab, after the StatusPanel as well.
      let insertAfterElement = browser.parentNode;
      if (insertAfterElement.nextElementSibling == StatusPanel.panel) {
__L_V__3({
    lN: 624,tT:'if',pr:'insertAfterElement.nextElementSibling == StatusPanel.panel',eT:{},fN:''
  });'__L_V__3';
        insertAfterElement = StatusPanel.panel;
      }
      insertAfterElement.insertAdjacentElement("afterend", findBar);

      await new Promise(r => requestAnimationFrame(r));
      delete aTab._pendingFindBar;
      if (window.closed || aTab.closing) {
__L_V__3({
    lN: 631,tT:'if',pr:'window.closed || aTab.closing',eT:{},fN:''
  });'__L_V__3';
        return null;
      }

      findBar.browser = browser;
      findBar._findField.value = this._lastFindValue;

      aTab._findBar = findBar;

      let event = document.createEvent("Events");
      event.initEvent("TabFindInitialized", true, false);
      aTab.dispatchEvent(event);

      return findBar;
    },

    _appendStatusPanel() {
__L_V__3({
    lN: 647,tT:'func',pr:'',eT:{},fN:'_appendStatusPanel'
  });'__L_V__3';
      this.selectedBrowser.parentNode.insertAdjacentElement(
        "afterend",
        StatusPanel.panel
      );
    },

    _updateTabBarForPinnedTabs() {
__L_V__3({
    lN: 654,tT:'func',pr:'',eT:{},fN:'_updateTabBarForPinnedTabs'
  });'__L_V__3';
      this.tabContainer._unlockTabSizing();
      this.tabContainer._positionPinnedTabs();
      this.tabContainer._updateCloseButtons();
    },

    _notifyPinnedStatus(aTab) {
__L_V__3({
    lN: 660,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_notifyPinnedStatus'
  });'__L_V__3';
      aTab.linkedBrowser.sendMessageToActor(
        "Browser:AppTab",
        { isAppTab: aTab.pinned },
        "BrowserTab"
      );

      let event = document.createEvent("Events");
      event.initEvent(aTab.pinned ? "TabPinned" : "TabUnpinned", true, false);
      aTab.dispatchEvent(event);
    },

    pinTab(aTab) {
__L_V__3({
    lN: 672,tT:'func',pr:'',eT:{'aTab':aTab},fN:'pinTab'
  });'__L_V__3';
      if (aTab.pinned) {
__L_V__3({
    lN: 673,tT:'if',pr:'aTab.pinned',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      if (aTab.hidden) {
__L_V__3({
    lN: 677,tT:'if',pr:'aTab.hidden',eT:{},fN:''
  });'__L_V__3';
        this.showTab(aTab);
      }

      this.moveTabTo(aTab, this._numPinnedTabs);
      aTab.setAttribute("pinned", "true");
      this._updateTabBarForPinnedTabs();
      this._notifyPinnedStatus(aTab);
    },

    unpinTab(aTab) {
__L_V__3({
    lN: 687,tT:'func',pr:'',eT:{'aTab':aTab},fN:'unpinTab'
  });'__L_V__3';
      if (!aTab.pinned) {
__L_V__3({
    lN: 688,tT:'if',pr:'!aTab.pinned',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      this.moveTabTo(aTab, this._numPinnedTabs - 1);
      aTab.removeAttribute("pinned");
      aTab.style.marginInlineStart = "";
      aTab._pinnedUnscrollable = false;
      this._updateTabBarForPinnedTabs();
      this._notifyPinnedStatus(aTab);
    },

    previewTab(aTab, aCallback) {
__L_V__3({
    lN: 700,tT:'func',pr:'',eT:{'aTab':aTab,'aCallback':aCallback},fN:'previewTab'
  });'__L_V__3';
      let currentTab = this.selectedTab;
      try {
        // Suppress focus, ownership and selected tab changes
        this._previewMode = true;
        this.selectedTab = aTab;
        aCallback();
      } finally {
        this.selectedTab = currentTab;
        this._previewMode = false;
      }
    },

    syncThrobberAnimations(aTab) {
__L_V__3({
    lN: 713,tT:'func',pr:'',eT:{'aTab':aTab},fN:'syncThrobberAnimations'
  });'__L_V__3';
      aTab.ownerGlobal.promiseDocumentFlushed(() => {
        if (!aTab.container) {
__L_V__3({
    lN: 715,tT:'if',pr:'!aTab.container',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        const animations = Array.from(
          aTab.container.getElementsByTagName("tab")
        )
          .map(tab => {
            const throbber = tab.throbber;
            return throbber ? throbber.getAnimations({ subtree: true }) : [];
          })
          .reduce((a, b) => a.concat(b))
          .filter(
            anim =>
              anim instanceof CSSAnimation &&
              (anim.animationName === "tab-throbber-animation" ||
                anim.animationName === "tab-throbber-animation-rtl") &&
              anim.playState === "running"
          );

        // Synchronize with the oldest running animation, if any.
        const firstStartTime = Math.min(
          ...animations.map(anim =>
            anim.startTime === null ? Infinity : anim.startTime
          )
        );
        if (firstStartTime === Infinity) {
__L_V__3({
    lN: 741,tT:'if',pr:'firstStartTime === Infinity',eT:{},fN:''
  });'__L_V__3';
          return;
        }
        requestAnimationFrame(() => {
          for (let animation of animations) {
            // If |animation| has been cancelled since this rAF callback
            // was scheduled we don't want to set its startTime since
            // that would restart it. We check for a cancelled animation
            // by looking for a null currentTime rather than checking
            // the playState, since reading the playState of
            // a CSSAnimation object will flush style.
            if (animation.currentTime !== null) {
__L_V__3({
    lN: 752,tT:'if',pr:'animation.currentTime !== null',eT:{},fN:''
  });'__L_V__3';
              animation.startTime = firstStartTime;
            }
          }
        });
      });
    },

    getBrowserAtIndex(aIndex) {
__L_V__3({
    lN: 760,tT:'func',pr:'',eT:{'aIndex':aIndex},fN:'getBrowserAtIndex'
  });'__L_V__3';
      return this.browsers[aIndex];
    },

    getBrowserForOuterWindowID(aID) {
__L_V__3({
    lN: 764,tT:'func',pr:'',eT:{'aID':aID},fN:'getBrowserForOuterWindowID'
  });'__L_V__3';
      return this._outerWindowIDBrowserMap.get(aID);
    },

    getTabForBrowser(aBrowser) {
__L_V__3({
    lN: 768,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'getTabForBrowser'
  });'__L_V__3';
      return this._tabForBrowser.get(aBrowser);
    },

    getPanel(aBrowser) {
__L_V__3({
    lN: 772,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'getPanel'
  });'__L_V__3';
      return this.getBrowserContainer(aBrowser).parentNode;
    },

    getBrowserContainer(aBrowser) {
__L_V__3({
    lN: 776,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'getBrowserContainer'
  });'__L_V__3';
      return (aBrowser || this.selectedBrowser).parentNode.parentNode;
    },

    getNotificationBox(aBrowser) {
__L_V__3({
    lN: 780,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'getNotificationBox'
  });'__L_V__3';
      let browser = aBrowser || this.selectedBrowser;
      if (!browser._notificationBox) {
__L_V__3({
    lN: 782,tT:'if',pr:'!browser._notificationBox',eT:{},fN:''
  });'__L_V__3';
        browser._notificationBox = new MozElements.NotificationBox(element => {
          element.setAttribute("notificationside", "top");
          this.getBrowserContainer(browser).prepend(element);
        });
      }
      return browser._notificationBox;
    },

    getTabModalPromptBox(aBrowser) {
__L_V__3({
    lN: 791,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'getTabModalPromptBox'
  });'__L_V__3';
      let browser = aBrowser || this.selectedBrowser;
      if (!browser.tabModalPromptBox) {
__L_V__3({
    lN: 793,tT:'if',pr:'!browser.tabModalPromptBox',eT:{},fN:''
  });'__L_V__3';
        browser.tabModalPromptBox = new TabModalPromptBox(browser);
      }
      return browser.tabModalPromptBox;
    },

    getTabFromAudioEvent(aEvent) {
__L_V__3({
    lN: 799,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'getTabFromAudioEvent'
  });'__L_V__3';
      if (
        !Services.prefs.getBoolPref("browser.tabs.showAudioPlayingIcon") ||
        !aEvent.isTrusted
      ) {
__L_V__3({
    lN: 803,tT:'if',pr:' !Services.prefs.getBoolPref(browser.tabs.showAudioPlayingIcon) || !aEvent.isTrusted ',eT:{},fN:''
  });'__L_V__3';
        return null;
      }

      var browser = aEvent.originalTarget;
      var tab = this.getTabForBrowser(browser);
      return tab;
    },

    _callProgressListeners(
      aBrowser,
      aMethod,
      aArguments,
      aCallGlobalListeners = true,
      aCallTabsListeners = true
    ) {
__L_V__3({
    lN: 818,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aMethod':aMethod,'aArguments':aArguments,'aCallGlobalListeners':aCallGlobalListeners,'aCallTabsListeners':aCallTabsListeners},fN:'_callProgressListeners'
  });'__L_V__3';
      var rv = true;

      function callListeners(listeners, args) {
__L_V__3({
    lN: 821,tT:'func',pr:'',eT:{'listeners':listeners,'args':args},fN:'callListeners'
  });'__L_V__3';
        for (let p of listeners) {
          if (aMethod in p) {
__L_V__3({
    lN: 823,tT:'if',pr:'aMethod in p',eT:{},fN:''
  });'__L_V__3';
            try {
              if (!p[aMethod].apply(p, args)) {
__L_V__3({
    lN: 825,tT:'if',pr:'!p[aMethod].apply(p, args)',eT:{},fN:''
  });'__L_V__3';
                rv = false;
              }
            } catch (e) {
              // don't inhibit other listeners
              Cu.reportError(e);
            }
          }
        }
      }

      aBrowser = aBrowser || this.selectedBrowser;

      if (aCallGlobalListeners && aBrowser == this.selectedBrowser) {
__L_V__3({
    lN: 838,tT:'if',pr:'aCallGlobalListeners && aBrowser == this.selectedBrowser',eT:{},fN:''
  });'__L_V__3';
        callListeners(this.mProgressListeners, aArguments);
      }

      if (aCallTabsListeners) {
__L_V__3({
    lN: 842,tT:'if',pr:'aCallTabsListeners',eT:{},fN:''
  });'__L_V__3';
        aArguments.unshift(aBrowser);

        callListeners(this.mTabsProgressListeners, aArguments);
      }

      return rv;
    },

    /**
     * Sets an icon for the tab if the URI is defined in FAVICON_DEFAULTS.
     */
    setDefaultIcon(aTab, aURI) {
__L_V__3({
    lN: 854,tT:'func',pr:'',eT:{'aTab':aTab,'aURI':aURI},fN:'setDefaultIcon'
  });'__L_V__3';
      if (aURI && aURI.spec in FAVICON_DEFAULTS) {
__L_V__3({
    lN: 855,tT:'if',pr:'aURI && aURI.spec in FAVICON_DEFAULTS',eT:{},fN:''
  });'__L_V__3';
        this.setIcon(aTab, FAVICON_DEFAULTS[aURI.spec]);
      }
    },

    setIcon(
      aTab,
      aIconURL = "",
      aOriginalURL = aIconURL,
      aLoadingPrincipal = null
    ) {
__L_V__3({
    lN: 865,tT:'func',pr:'',eT:{'aTab':aTab,'aIconURL':aIconURL,'aOriginalURL':aOriginalURL,'aLoadingPrincipal':aLoadingPrincipal},fN:'setIcon'
  });'__L_V__3';
      let makeString = url => (url instanceof Ci.nsIURI ? url.spec : url);

      aIconURL = makeString(aIconURL);
      aOriginalURL = makeString(aOriginalURL);

      let LOCAL_PROTOCOLS = ["chrome:", "about:", "resource:", "data:"];

      if (
        aIconURL &&
        !aLoadingPrincipal &&
        !LOCAL_PROTOCOLS.some(protocol => aIconURL.startsWith(protocol))
      ) {
__L_V__3({
    lN: 877,tT:'if',pr:' aIconURL && !aLoadingPrincipal && !LOCAL_PROTOCOLS.some(protocol => aIconURL.startsWith(protocol)) ',eT:{},fN:''
  });'__L_V__3';
        console.error(
          `Attempt to set a remote URL ${aIconURL} as a tab icon without a loading principal.`
        );
        return;
      }

      let browser = this.getBrowserForTab(aTab);
      browser.mIconURL = aIconURL;

      if (aIconURL != aTab.getAttribute("image")) {
__L_V__3({
    lN: 887,tT:'if',pr:'aIconURL != aTab.getAttribute(image)',eT:{},fN:''
  });'__L_V__3';
        if (aIconURL) {
__L_V__3({
    lN: 888,tT:'if',pr:'aIconURL',eT:{},fN:''
  });'__L_V__3';
          if (aLoadingPrincipal) {
__L_V__3({
    lN: 889,tT:'if',pr:'aLoadingPrincipal',eT:{},fN:''
  });'__L_V__3';
            aTab.setAttribute("iconloadingprincipal", aLoadingPrincipal);
          } else {
            aTab.removeAttribute("iconloadingprincipal");
          }
          aTab.setAttribute("image", aIconURL);
        } else {
          aTab.removeAttribute("image");
          aTab.removeAttribute("iconloadingprincipal");
        }
        this._tabAttrModified(aTab, ["image"]);
      }

      // The aOriginalURL argument is currently only used by tests.
      this._callProgressListeners(browser, "onLinkIconAvailable", [
        aIconURL,
        aOriginalURL,
      ]);
    },

    getIcon(aTab) {
__L_V__3({
    lN: 909,tT:'func',pr:'',eT:{'aTab':aTab},fN:'getIcon'
  });'__L_V__3';
      let browser = aTab ? this.getBrowserForTab(aTab) : this.selectedBrowser;
      return browser.mIconURL;
    },

    setPageInfo(aURL, aDescription, aPreviewImage) {
__L_V__3({
    lN: 914,tT:'func',pr:'',eT:{'aURL':aURL,'aDescription':aDescription,'aPreviewImage':aPreviewImage},fN:'setPageInfo'
  });'__L_V__3';
      if (aURL) {
__L_V__3({
    lN: 915,tT:'if',pr:'aURL',eT:{},fN:''
  });'__L_V__3';
        let pageInfo = {
          url: aURL,
          description: aDescription,
          previewImageURL: aPreviewImage,
        };
        PlacesUtils.history.update(pageInfo).catch(Cu.reportError);
      }
    },

    getWindowTitleForBrowser(aBrowser) {
__L_V__3({
    lN: 925,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'getWindowTitleForBrowser'
  });'__L_V__3';
      let title = "";

      let docElement = document.documentElement;

      // If location bar is hidden and the URL type supports a host,
      // add the scheme and host to the title to prevent spoofing.
      // XXX https://bugzilla.mozilla.org/show_bug.cgi?id=22183#c239
      try {
        if (docElement.getAttribute("chromehidden").includes("location")) {
__L_V__3({
    lN: 934,tT:'if',pr:'docElement.getAttribute(chromehidden).includes(location)',eT:{},fN:''
  });'__L_V__3';
          const uri = Services.uriFixup.createExposableURI(aBrowser.currentURI);
          let prefix = uri.prePath;
          if (uri.scheme == "about") {
__L_V__3({
    lN: 937,tT:'if',pr:'uri.scheme == about',eT:{},fN:''
  });'__L_V__3';
            prefix = uri.spec;
          } else if (uri.scheme == "moz-extension") {
__L_V__3({
    lN: 939,tT:'if',pr:'uri.scheme == moz-extension',eT:{},fN:''
  });'__L_V__3';
            const ext = WebExtensionPolicy.getByHostname(uri.host);
            if (ext && ext.name) {
__L_V__3({
    lN: 941,tT:'if',pr:'ext && ext.name',eT:{},fN:''
  });'__L_V__3';
              let extensionLabel = document.getElementById(
                "urlbar-label-extension"
              );
              prefix = `${extensionLabel.value} (${ext.name})`;
            }
          }
          title = prefix + " - ";
        }
      } catch (e) {
        // ignored
      }

      if (docElement.hasAttribute("titlepreface")) {
__L_V__3({
    lN: 954,tT:'if',pr:'docElement.hasAttribute(titlepreface)',eT:{},fN:''
  });'__L_V__3';
        title += docElement.getAttribute("titlepreface");
      }

      let tab = this.getTabForBrowser(aBrowser);

      if (tab._labelIsContentTitle) {
__L_V__3({
    lN: 960,tT:'if',pr:'tab._labelIsContentTitle',eT:{},fN:''
  });'__L_V__3';
        // Strip out any null bytes in the content title, since the
        // underlying widget implementations of nsWindow::SetTitle pass
        // null-terminated strings to system APIs.
        title += tab.getAttribute("label").replace(/\0/g, "");
      }

      let mode =
        docElement.getAttribute("privatebrowsingmode") == "temporary"
          ? "private"
          : "default";

      if (title) {
__L_V__3({
    lN: 972,tT:'if',pr:'title',eT:{},fN:''
  });'__L_V__3';
        return {
          id:
            mode == "private"
              ? "browser-main-window-content-title-private"
              : "browser-main-window-content-title-default",
          args: {
            title,
          },
        };
      }
      return {
        id: "browser-main-window-title",
        args: {
          mode,
        },
      };
    },

    async updateTitlebar() {
__L_V__3({
    lN: 991,tT:'func',pr:'',eT:{},fN:'updateTitlebar'
  });'__L_V__3';
      if (!this._titleElement) {
__L_V__3({
    lN: 992,tT:'if',pr:'!this._titleElement',eT:{},fN:''
  });'__L_V__3';
        this._titleElement = document.documentElement.querySelector("title");
      }

      let { id, args } = this.getWindowTitleForBrowser(this.selectedBrowser);
      document.l10n.setAttributes(this._titleElement, id, args);
      await document.l10n.translateElements([this._titleElement]);
    },

    updateCurrentBrowser(aForceUpdate) {
__L_V__3({
    lN: 1001,tT:'func',pr:'',eT:{'aForceUpdate':aForceUpdate},fN:'updateCurrentBrowser'
  });'__L_V__3';
      let newBrowser = this.getBrowserAtIndex(this.tabContainer.selectedIndex);
      if (this.selectedBrowser == newBrowser && !aForceUpdate) {
__L_V__3({
    lN: 1003,tT:'if',pr:'this.selectedBrowser == newBrowser && !aForceUpdate',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      let newTab = this.getTabForBrowser(newBrowser);

      if (!aForceUpdate) {
__L_V__3({
    lN: 1009,tT:'if',pr:'!aForceUpdate',eT:{},fN:''
  });'__L_V__3';
        TelemetryStopwatch.start("FX_TAB_SWITCH_UPDATE_MS");

        if (gMultiProcessBrowser) {
__L_V__3({
    lN: 1012,tT:'if',pr:'gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
          this._getSwitcher().requestTab(newTab);
        }

        document.commandDispatcher.lock();
      }

      let oldTab = this.selectedTab;

      // Preview mode should not reset the owner
      if (!this._previewMode && !oldTab.selected) {
__L_V__3({
    lN: 1022,tT:'if',pr:'!this._previewMode && !oldTab.selected',eT:{},fN:''
  });'__L_V__3';
        oldTab.owner = null;
      }

      let lastRelatedTab = this._lastRelatedTabMap.get(oldTab);
      if (lastRelatedTab) {
__L_V__3({
    lN: 1027,tT:'if',pr:'lastRelatedTab',eT:{},fN:''
  });'__L_V__3';
        if (!lastRelatedTab.selected) {
__L_V__3({
    lN: 1028,tT:'if',pr:'!lastRelatedTab.selected',eT:{},fN:''
  });'__L_V__3';
          lastRelatedTab.owner = null;
        }
      }
      this._lastRelatedTabMap = new WeakMap();

      let oldBrowser = this.selectedBrowser;

      if (!gMultiProcessBrowser) {
__L_V__3({
    lN: 1036,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        oldBrowser.removeAttribute("primary");
        oldBrowser.docShellIsActive = false;
        newBrowser.setAttribute("primary", "true");
        newBrowser.docShellIsActive =
          window.windowState != window.STATE_MINIMIZED &&
          !window.isFullyOccluded;
      }

      this._selectedBrowser = newBrowser;
      this._selectedTab = newTab;
      this.showTab(newTab);

      gURLBar.setAttribute("switchingtabs", "true");
      window.addEventListener(
        "MozAfterPaint",
        function() {
__L_V__3({
    lN: 1052,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__3';
          gURLBar.removeAttribute("switchingtabs");
        },
        { once: true }
      );

      this._appendStatusPanel();

      let oldBrowserPopupsBlocked = oldBrowser.popupBlocker.getBlockedPopupCount();
      let newBrowserPopupsBlocked = newBrowser.popupBlocker.getBlockedPopupCount();
      if (oldBrowserPopupsBlocked != newBrowserPopupsBlocked) {
__L_V__3({
    lN: 1062,tT:'if',pr:'oldBrowserPopupsBlocked != newBrowserPopupsBlocked',eT:{},fN:''
  });'__L_V__3';
        newBrowser.popupBlocker.updateBlockedPopupsUI();
      }

      // Update the URL bar.
      let webProgress = newBrowser.webProgress;
      this._callProgressListeners(
        null,
        "onLocationChange",
        [webProgress, null, newBrowser.currentURI, 0, true],
        true,
        false
      );

      let securityUI = newBrowser.securityUI;
      if (securityUI) {
__L_V__3({
    lN: 1077,tT:'if',pr:'securityUI',eT:{},fN:''
  });'__L_V__3';
        this._callProgressListeners(
          null,
          "onSecurityChange",
          [webProgress, null, securityUI.state],
          true,
          false
        );
        // Include the true final argument to indicate that this event is
        // simulated (instead of being observed by the webProgressListener).
        this._callProgressListeners(
          null,
          "onContentBlockingEvent",
          [webProgress, null, newBrowser.getContentBlockingEvents(), true],
          true,
          false
        );
      }

      let listener = this._tabListeners.get(newTab);
      if (listener && listener.mStateFlags) {
__L_V__3({
    lN: 1097,tT:'if',pr:'listener && listener.mStateFlags',eT:{},fN:''
  });'__L_V__3';
        this._callProgressListeners(
          null,
          "onUpdateCurrentBrowser",
          [
            listener.mStateFlags,
            listener.mStatus,
            listener.mMessage,
            listener.mTotalProgress,
          ],
          true,
          false
        );
      }

      if (!this._previewMode) {
__L_V__3({
    lN: 1112,tT:'if',pr:'!this._previewMode',eT:{},fN:''
  });'__L_V__3';
        newTab.updateLastAccessed();
        oldTab.updateLastAccessed();

        let oldFindBar = oldTab._findBar;
        if (
          oldFindBar &&
          oldFindBar.findMode == oldFindBar.FIND_NORMAL &&
          !oldFindBar.hidden
        ) {
__L_V__3({
    lN: 1121,tT:'if',pr:' oldFindBar && oldFindBar.findMode == oldFindBar.FIND_NORMAL && !oldFindBar.hidden ',eT:{},fN:''
  });'__L_V__3';
          this._lastFindValue = oldFindBar._findField.value;
        }

        this.updateTitlebar();

        newTab.removeAttribute("titlechanged");
        newTab.removeAttribute("attention");
        this._tabAttrModified(newTab, ["attention"]);

        // The tab has been selected, it's not unselected anymore.
        // (1) Call the current tab's finishUnselectedTabHoverTimer()
        //     to save a telemetry record.
        // (2) Call the current browser's unselectedTabHover() with false
        //     to dispatch an event.
        newTab.finishUnselectedTabHoverTimer();
        newBrowser.unselectedTabHover(false);
      }

      // If the new tab is busy, and our current state is not busy, then
      // we need to fire a start to all progress listeners.
      if (newTab.hasAttribute("busy") && !this._isBusy) {
__L_V__3({
    lN: 1142,tT:'if',pr:'newTab.hasAttribute(busy) && !this._isBusy',eT:{},fN:''
  });'__L_V__3';
        this._isBusy = true;
        this._callProgressListeners(
          null,
          "onStateChange",
          [
            webProgress,
            null,
            Ci.nsIWebProgressListener.STATE_START |
              Ci.nsIWebProgressListener.STATE_IS_NETWORK,
            0,
          ],
          true,
          false
        );
      }

      // If the new tab is not busy, and our current state is busy, then
      // we need to fire a stop to all progress listeners.
      if (!newTab.hasAttribute("busy") && this._isBusy) {
__L_V__3({
    lN: 1161,tT:'if',pr:'!newTab.hasAttribute(busy) && this._isBusy',eT:{},fN:''
  });'__L_V__3';
        this._isBusy = false;
        this._callProgressListeners(
          null,
          "onStateChange",
          [
            webProgress,
            null,
            Ci.nsIWebProgressListener.STATE_STOP |
              Ci.nsIWebProgressListener.STATE_IS_NETWORK,
            0,
          ],
          true,
          false
        );
      }

      // TabSelect events are suppressed during preview mode to avoid confusing extensions and other bits of code
      // that might rely upon the other changes suppressed.
      // Focus is suppressed in the event that the main browser window is minimized - focusing a tab would restore the window
      if (!this._previewMode) {
__L_V__3({
    lN: 1181,tT:'if',pr:'!this._previewMode',eT:{},fN:''
  });'__L_V__3';
        // We've selected the new tab, so go ahead and notify listeners.
        let event = new CustomEvent("TabSelect", {
          bubbles: true,
          cancelable: false,
          detail: {
            previousTab: oldTab,
          },
        });
        newTab.dispatchEvent(event);

        this._tabAttrModified(oldTab, ["selected"]);
        this._tabAttrModified(newTab, ["selected"]);

        this._startMultiSelectChange();
        this._multiSelectChangeSelected = true;
        this.clearMultiSelectedTabs({ isLastMultiSelectChange: true });

        if (oldBrowser != newBrowser && oldBrowser.getInPermitUnload) {
__L_V__3({
    lN: 1199,tT:'if',pr:'oldBrowser != newBrowser && oldBrowser.getInPermitUnload',eT:{},fN:''
  });'__L_V__3';
          oldBrowser.getInPermitUnload(inPermitUnload => {
            if (!inPermitUnload) {
__L_V__3({
    lN: 1201,tT:'if',pr:'!inPermitUnload',eT:{},fN:''
  });'__L_V__3';
              return;
            }
            // Since the user is switching away from a tab that has
            // a beforeunload prompt active, we remove the prompt.
            // This prevents confusing user flows like the following:
            //   1. User attempts to close Firefox
            //   2. User switches tabs (ingoring a beforeunload prompt)
            //   3. User returns to tab, presses "Leave page"
            let promptBox = this.getTabModalPromptBox(oldBrowser);
            let prompts = promptBox.listPrompts();
            // There might not be any prompts here if the tab was closed
            // while in an onbeforeunload prompt, which will have
            // destroyed aforementioned prompt already, so check there's
            // something to remove, first:
            if (prompts.length) {
__L_V__3({
    lN: 1216,tT:'if',pr:'prompts.length',eT:{},fN:''
  });'__L_V__3';
              // NB: This code assumes that the beforeunload prompt
              //     is the top-most prompt on the tab.
              prompts[prompts.length - 1].abortPrompt();
            }
          });
        }

        if (!gMultiProcessBrowser) {
__L_V__3({
    lN: 1224,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
          this._adjustFocusBeforeTabSwitch(oldTab, newTab);
          this._adjustFocusAfterTabSwitch(newTab);
          gURLBar.afterTabSwitchFocusChange();
        }
      }

      updateUserContextUIIndicator();
      gIdentityHandler.updateSharingIndicator();

      // Enable touch events to start a native dragging
      // session to allow the user to easily drag the selected tab.
      // This is currently only supported on Windows.
      oldTab.removeAttribute("touchdownstartsdrag");
      newTab.setAttribute("touchdownstartsdrag", "true");

      if (!gMultiProcessBrowser) {
__L_V__3({
    lN: 1240,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        this.tabContainer._setPositionalAttributes();

        document.commandDispatcher.unlock();

        let event = new CustomEvent("TabSwitchDone", {
          bubbles: true,
          cancelable: true,
        });
        this.dispatchEvent(event);
      }

      if (!aForceUpdate) {
__L_V__3({
    lN: 1252,tT:'if',pr:'!aForceUpdate',eT:{},fN:''
  });'__L_V__3';
        TelemetryStopwatch.finish("FX_TAB_SWITCH_UPDATE_MS");
      }
    },

    _adjustFocusBeforeTabSwitch(oldTab, newTab) {
__L_V__3({
    lN: 1257,tT:'func',pr:'',eT:{'oldTab':oldTab,'newTab':newTab},fN:'_adjustFocusBeforeTabSwitch'
  });'__L_V__3';
      if (this._previewMode) {
__L_V__3({
    lN: 1258,tT:'if',pr:'this._previewMode',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      let oldBrowser = oldTab.linkedBrowser;
      let newBrowser = newTab.linkedBrowser;

      oldBrowser._urlbarFocused = gURLBar && gURLBar.focused;

      if (this.isFindBarInitialized(oldTab)) {
__L_V__3({
    lN: 1267,tT:'if',pr:'this.isFindBarInitialized(oldTab)',eT:{},fN:''
  });'__L_V__3';
        let findBar = this.getCachedFindBar(oldTab);
        oldTab._findBarFocused =
          !findBar.hidden &&
          findBar._findField.getAttribute("focused") == "true";
      }

      let activeEl = document.activeElement;
      // If focus is on the old tab, move it to the new tab.
      if (activeEl == oldTab) {
__L_V__3({
    lN: 1276,tT:'if',pr:'activeEl == oldTab',eT:{},fN:''
  });'__L_V__3';
        newTab.focus();
      } else if (
        gMultiProcessBrowser &&
        activeEl != newBrowser &&
        activeEl != newTab
      ) {
__L_V__3({
    lN: 1282,tT:'if',pr:' gMultiProcessBrowser && activeEl != newBrowser && activeEl != newTab ',eT:{},fN:''
  });'__L_V__3';
        // In e10s, if focus isn't already in the tabstrip or on the new browser,
        // and the new browser's previous focus wasn't in the url bar but focus is
        // there now, we need to adjust focus further.
        let keepFocusOnUrlBar =
          newBrowser && newBrowser._urlbarFocused && gURLBar && gURLBar.focused;
        if (!keepFocusOnUrlBar) {
__L_V__3({
    lN: 1288,tT:'if',pr:'!keepFocusOnUrlBar',eT:{},fN:''
  });'__L_V__3';
          // Clear focus so that _adjustFocusAfterTabSwitch can detect if
          // some element has been focused and respect that.
          document.activeElement.blur();
        }
      }
    },

    _adjustFocusAfterTabSwitch(newTab) {
__L_V__3({
    lN: 1296,tT:'func',pr:'',eT:{'newTab':newTab},fN:'_adjustFocusAfterTabSwitch'
  });'__L_V__3';
      // Don't steal focus from the tab bar.
      if (document.activeElement == newTab) {
__L_V__3({
    lN: 1298,tT:'if',pr:'document.activeElement == newTab',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      let newBrowser = this.getBrowserForTab(newTab);

      // If there's a tabmodal prompt showing, focus it.
      if (newBrowser.hasAttribute("tabmodalPromptShowing")) {
__L_V__3({
    lN: 1305,tT:'if',pr:'newBrowser.hasAttribute(tabmodalPromptShowing)',eT:{},fN:''
  });'__L_V__3';
        let prompts = newBrowser.tabModalPromptBox.listPrompts();
        let prompt = prompts[prompts.length - 1];
        // @tabmodalPromptShowing is also set for other tab modal prompts
        // (e.g. the Payment Request dialog) so there may not be a <tabmodalprompt>.
        // Bug 1492814 will implement this for the Payment Request dialog.
        if (prompt) {
__L_V__3({
    lN: 1311,tT:'if',pr:'prompt',eT:{},fN:''
  });'__L_V__3';
          prompt.Dialog.setDefaultFocus();
          return;
        }
      }

      // Focus the location bar if it was previously focused for that tab.
      // In full screen mode, only bother making the location bar visible
      // if the tab is a blank one.
      if (newBrowser._urlbarFocused && gURLBar) {
__L_V__3({
    lN: 1320,tT:'if',pr:'newBrowser._urlbarFocused && gURLBar',eT:{},fN:''
  });'__L_V__3';
        // If the user happened to type into the URL bar for this browser
        // by the time we got here, focusing will cause the text to be
        // selected which could cause them to overwrite what they've
        // already typed in.
        if (gURLBar.focused && newBrowser.userTypedValue) {
__L_V__3({
    lN: 1325,tT:'if',pr:'gURLBar.focused && newBrowser.userTypedValue',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        if (!window.fullScreen || newTab.isEmpty) {
__L_V__3({
    lN: 1329,tT:'if',pr:'!window.fullScreen || newTab.isEmpty',eT:{},fN:''
  });'__L_V__3';
          focusAndSelectUrlBar();
          return;
        }
      }

      // Focus the find bar if it was previously focused for that tab.
      if (
        gFindBarInitialized &&
        !gFindBar.hidden &&
        this.selectedTab._findBarFocused
      ) {
__L_V__3({
    lN: 1340,tT:'if',pr:' gFindBarInitialized && !gFindBar.hidden && this.selectedTab._findBarFocused ',eT:{},fN:''
  });'__L_V__3';
        gFindBar._findField.focus();
        return;
      }

      // Don't focus the content area if something has been focused after the
      // tab switch was initiated.
      if (gMultiProcessBrowser && document.activeElement != document.body) {
__L_V__3({
    lN: 1347,tT:'if',pr:'gMultiProcessBrowser && document.activeElement != document.body',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      // We're now committed to focusing the content area.
      let fm = Services.focus;
      let focusFlags = fm.FLAG_NOSCROLL;

      if (!gMultiProcessBrowser) {
__L_V__3({
    lN: 1355,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        let newFocusedElement = fm.getFocusedElementForWindow(
          window.content,
          true,
          {}
        );

        // for anchors, use FLAG_SHOWRING so that it is clear what link was
        // last clicked when switching back to that tab
        if (
          newFocusedElement &&
          (newFocusedElement instanceof HTMLAnchorElement ||
            newFocusedElement.getAttributeNS(
              "http://www.w3.org/1999/xlink",
              "type"
            ) == "simple")
        ) {
__L_V__3({
    lN: 1371,tT:'if',pr:' newFocusedElement && (newFocusedElement instanceof HTMLAnchorElement || newFocusedElement.getAttributeNS( http://www.w3.org/1999/xlink, type ) == simple) ',eT:{},fN:''
  });'__L_V__3';
          focusFlags |= fm.FLAG_SHOWRING;
        }
      }

      fm.setFocus(newBrowser, focusFlags);
    },

    _tabAttrModified(aTab, aChanged) {
__L_V__3({
    lN: 1379,tT:'func',pr:'',eT:{'aTab':aTab,'aChanged':aChanged},fN:'_tabAttrModified'
  });'__L_V__3';
      if (aTab.closing) {
__L_V__3({
    lN: 1380,tT:'if',pr:'aTab.closing',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      let event = new CustomEvent("TabAttrModified", {
        bubbles: true,
        cancelable: false,
        detail: {
          changed: aChanged,
        },
      });
      aTab.dispatchEvent(event);
    },

    resetBrowserSharing(aBrowser) {
__L_V__3({
    lN: 1394,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'resetBrowserSharing'
  });'__L_V__3';
      let tab = this.getTabForBrowser(aBrowser);
      if (!tab) {
__L_V__3({
    lN: 1396,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
        return;
      }
      tab._sharingState = {};
      tab.removeAttribute("sharing");
      this._tabAttrModified(tab, ["sharing"]);
      if (aBrowser == this.selectedBrowser) {
__L_V__3({
    lN: 1402,tT:'if',pr:'aBrowser == this.selectedBrowser',eT:{},fN:''
  });'__L_V__3';
        gIdentityHandler.updateSharingIndicator();
      }
    },

    updateBrowserSharing(aBrowser, aState) {
__L_V__3({
    lN: 1407,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aState':aState},fN:'updateBrowserSharing'
  });'__L_V__3';
      let tab = this.getTabForBrowser(aBrowser);
      if (!tab) {
__L_V__3({
    lN: 1409,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
        return;
      }
      if (tab._sharingState == null) {
__L_V__3({
    lN: 1412,tT:'if',pr:'tab._sharingState == null',eT:{},fN:''
  });'__L_V__3';
        tab._sharingState = {};
      }
      tab._sharingState = Object.assign(tab._sharingState, aState);
      if (aState.webRTC && aState.webRTC.sharing) {
__L_V__3({
    lN: 1416,tT:'if',pr:'aState.webRTC && aState.webRTC.sharing',eT:{},fN:''
  });'__L_V__3';
        if (aState.webRTC.paused) {
__L_V__3({
    lN: 1417,tT:'if',pr:'aState.webRTC.paused',eT:{},fN:''
  });'__L_V__3';
          tab.removeAttribute("sharing");
        } else {
          tab.setAttribute("sharing", aState.webRTC.sharing);
        }
      } else {
        tab._sharingState.webRTC = null;
        tab.removeAttribute("sharing");
      }
      this._tabAttrModified(tab, ["sharing"]);

      if (aBrowser == this.selectedBrowser) {
__L_V__3({
    lN: 1428,tT:'if',pr:'aBrowser == this.selectedBrowser',eT:{},fN:''
  });'__L_V__3';
        gIdentityHandler.updateSharingIndicator();
      }
    },

    getTabSharingState(aTab) {
__L_V__3({
    lN: 1433,tT:'func',pr:'',eT:{'aTab':aTab},fN:'getTabSharingState'
  });'__L_V__3';
      // Normalize the state object for consumers (ie.extensions).
      let state = Object.assign(
        {},
        aTab._sharingState && aTab._sharingState.webRTC
      );
      return {
        camera: !!state.camera,
        microphone: !!state.microphone,
        screen: state.screen && state.screen.replace("Paused", ""),
      };
    },

    setInitialTabTitle(aTab, aTitle, aOptions = {}) {
__L_V__3({
    lN: 1446,tT:'func',pr:'',eT:{'aTab':aTab,'aTitle':aTitle,'aOptions':aOptions},fN:'setInitialTabTitle'
  });'__L_V__3';
      // Convert some non-content title (actually a url) to human readable title
      if (!aOptions.isContentTitle && isBlankPageURL(aTitle)) {
__L_V__3({
    lN: 1448,tT:'if',pr:'!aOptions.isContentTitle && isBlankPageURL(aTitle)',eT:{},fN:''
  });'__L_V__3';
        aTitle = this.tabContainer.emptyTabTitle;
      }

      if (aTitle) {
__L_V__3({
    lN: 1452,tT:'if',pr:'aTitle',eT:{},fN:''
  });'__L_V__3';
        if (!aTab.getAttribute("label")) {
__L_V__3({
    lN: 1453,tT:'if',pr:'!aTab.getAttribute(label)',eT:{},fN:''
  });'__L_V__3';
          aTab._labelIsInitialTitle = true;
        }

        this._setTabLabel(aTab, aTitle, aOptions);
      }
    },

    setTabTitle(aTab) {
__L_V__3({
    lN: 1461,tT:'func',pr:'',eT:{'aTab':aTab},fN:'setTabTitle'
  });'__L_V__3';
      var browser = this.getBrowserForTab(aTab);
      var title = browser.contentTitle;

      // Don't replace an initially set label with the URL while the tab
      // is loading.
      if (aTab._labelIsInitialTitle) {
__L_V__3({
    lN: 1467,tT:'if',pr:'aTab._labelIsInitialTitle',eT:{},fN:''
  });'__L_V__3';
        if (!title) {
__L_V__3({
    lN: 1468,tT:'if',pr:'!title',eT:{},fN:''
  });'__L_V__3';
          return false;
        }
        delete aTab._labelIsInitialTitle;
      }

      let isContentTitle = false;
      if (title) {
__L_V__3({
    lN: 1475,tT:'if',pr:'title',eT:{},fN:''
  });'__L_V__3';
        isContentTitle = true;
      } else if (aTab.hasAttribute("customizemode")) {
__L_V__3({
    lN: 1477,tT:'if',pr:'aTab.hasAttribute(customizemode)',eT:{},fN:''
  });'__L_V__3';
        let brandBundle = document.getElementById("bundle_brand");
        let brandShortName = brandBundle.getString("brandShortName");
        title = gNavigatorBundle.getFormattedString("customizeMode.tabTitle", [
          brandShortName,
        ]);
        isContentTitle = true;
      } else {
        // See if we can use the URI as the title.
        if (browser.currentURI.displaySpec) {
__L_V__3({
    lN: 1486,tT:'if',pr:'browser.currentURI.displaySpec',eT:{},fN:''
  });'__L_V__3';
          try {
            title = Services.uriFixup.createExposableURI(browser.currentURI)
              .displaySpec;
          } catch (ex) {
            title = browser.currentURI.displaySpec;
          }
        }

        if (title && !isBlankPageURL(title)) {
__L_V__3({
    lN: 1495,tT:'if',pr:'title && !isBlankPageURL(title)',eT:{},fN:''
  });'__L_V__3';
          // If it's a long data: URI that uses base64 encoding, truncate to a
          // reasonable length rather than trying to display the entire thing,
          // which can be slow.
          // We can't shorten arbitrary URIs like this, as bidi etc might mean
          // we need the trailing characters for display. But a base64-encoded
          // data-URI is plain ASCII, so this is OK for tab-title display.
          // (See bug 1408854.)
          if (title.length > 500 && title.match(/^data:[^,]+;base64,/)) {
__L_V__3({
    lN: 1503,tT:'if',pr:'title.length > 500 && title.match(/^data:[^,]+;base64,/)',eT:{},fN:''
  });'__L_V__3';
            title = title.substring(0, 500) + "\u2026";
          } else {
            // Try to unescape not-ASCII URIs using the current character set.
            try {
              let characterSet = browser.characterSet;
              title = Services.textToSubURI.unEscapeNonAsciiURI(
                characterSet,
                title
              );
            } catch (ex) {
              /* Do nothing. */
            }
          }
        } else {
          // No suitable URI? Fall back to our untitled string.
          title = this.tabContainer.emptyTabTitle;
        }
      }

      return this._setTabLabel(aTab, title, { isContentTitle });
    },

    _setTabLabel(aTab, aLabel, { beforeTabOpen, isContentTitle } = {}) {
__L_V__3({
    lN: 1526,tT:'func',pr:'',eT:{'aTab':aTab,'aLabel':aLabel,'beforeTabOpen':beforeTabOpen,'isContentTitle':isContentTitle},fN:'_setTabLabel'
  });'__L_V__3';
      if (!aLabel) {
__L_V__3({
    lN: 1527,tT:'if',pr:'!aLabel',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      aTab._fullLabel = aLabel;

      if (!isContentTitle) {
__L_V__3({
    lN: 1533,tT:'if',pr:'!isContentTitle',eT:{},fN:''
  });'__L_V__3';
        // Remove protocol and "www."
        if (!("_regex_shortenURLForTabLabel" in this)) {
__L_V__3({
    lN: 1535,tT:'if',pr:'!(_regex_shortenURLForTabLabel in this)',eT:{},fN:''
  });'__L_V__3';
          this._regex_shortenURLForTabLabel = /^[^:]+:\/\/(?:www\.)?/;
        }
        aLabel = aLabel.replace(this._regex_shortenURLForTabLabel, "");
      }

      aTab._labelIsContentTitle = isContentTitle;

      if (aTab.getAttribute("label") == aLabel) {
__L_V__3({
    lN: 1543,tT:'if',pr:'aTab.getAttribute(label) == aLabel',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      let dwu = window.windowUtils;
      let isRTL =
        dwu.getDirectionFromText(aLabel) == Ci.nsIDOMWindowUtils.DIRECTION_RTL;

      aTab.setAttribute("label", aLabel);
      aTab.setAttribute("labeldirection", isRTL ? "rtl" : "ltr");

      // Dispatch TabAttrModified event unless we're setting the label
      // before the TabOpen event was dispatched.
      if (!beforeTabOpen) {
__L_V__3({
    lN: 1556,tT:'if',pr:'!beforeTabOpen',eT:{},fN:''
  });'__L_V__3';
        this._tabAttrModified(aTab, ["label"]);
      }

      if (aTab.selected) {
__L_V__3({
    lN: 1560,tT:'if',pr:'aTab.selected',eT:{},fN:''
  });'__L_V__3';
        this.updateTitlebar();
      }

      return true;
    },

    loadOneTab(
      aURI,
      aReferrerInfoOrParams,
      aCharset,
      aPostData,
      aLoadInBackground,
      aAllowThirdPartyFixup
    ) {
__L_V__3({
    lN: 1574,tT:'func',pr:'',eT:{'aURI':aURI,'aReferrerInfoOrParams':aReferrerInfoOrParams,'aCharset':aCharset,'aPostData':aPostData,'aLoadInBackground':aLoadInBackground,'aAllowThirdPartyFixup':aAllowThirdPartyFixup},fN:'loadOneTab'
  });'__L_V__3';
      var aTriggeringPrincipal;
      var aReferrerInfo;
      var aFromExternal;
      var aRelatedToCurrent;
      var aAllowInheritPrincipal;
      var aAllowMixedContent;
      var aSkipAnimation;
      var aForceNotRemote;
      var aPreferredRemoteType;
      var aUserContextId;
      var aSameProcessAsFrameLoader;
      var aOriginPrincipal;
      var aOriginStoragePrincipal;
      var aOpener;
      var aOpenerBrowser;
      var aCreateLazyBrowser;
      var aNextRemoteTabId;
      var aFocusUrlBar;
      var aName;
      var aCsp;
      var aSkipLoad;
      if (
        arguments.length == 2 &&
        typeof arguments[1] == "object" &&
        !(arguments[1] instanceof Ci.nsIURI)
      ) {
__L_V__3({
    lN: 1600,tT:'if',pr:' arguments.length == 2 && typeof arguments[1] == object && !(arguments[1] instanceof Ci.nsIURI) ',eT:{},fN:''
  });'__L_V__3';
        let params = arguments[1];
        aTriggeringPrincipal = params.triggeringPrincipal;
        aReferrerInfo = params.referrerInfo;
        aCharset = params.charset;
        aPostData = params.postData;
        aLoadInBackground = params.inBackground;
        aAllowThirdPartyFixup = params.allowThirdPartyFixup;
        aFromExternal = params.fromExternal;
        aRelatedToCurrent = params.relatedToCurrent;
        aAllowInheritPrincipal = !!params.allowInheritPrincipal;
        aAllowMixedContent = params.allowMixedContent;
        aSkipAnimation = params.skipAnimation;
        aForceNotRemote = params.forceNotRemote;
        aPreferredRemoteType = params.preferredRemoteType;
        aUserContextId = params.userContextId;
        aSameProcessAsFrameLoader = params.sameProcessAsFrameLoader;
        aOriginPrincipal = params.originPrincipal;
        aOriginStoragePrincipal = params.originStoragePrincipal;
        aOpener = params.opener;
        aOpenerBrowser = params.openerBrowser;
        aCreateLazyBrowser = params.createLazyBrowser;
        aNextRemoteTabId = params.nextRemoteTabId;
        aFocusUrlBar = params.focusUrlBar;
        aName = params.name;
        aCsp = params.csp;
        aSkipLoad = params.skipLoad;
      }

      // all callers of loadOneTab need to pass a valid triggeringPrincipal.
      if (!aTriggeringPrincipal) {
__L_V__3({
    lN: 1630,tT:'if',pr:'!aTriggeringPrincipal',eT:{},fN:''
  });'__L_V__3';
        throw new Error(
          "Required argument triggeringPrincipal missing within loadOneTab"
        );
      }

      var bgLoad =
        aLoadInBackground != null
          ? aLoadInBackground
          : Services.prefs.getBoolPref("browser.tabs.loadInBackground");
      var owner = bgLoad ? null : this.selectedTab;

      var tab = this.addTab(aURI, {
        triggeringPrincipal: aTriggeringPrincipal,
        referrerInfo: aReferrerInfo,
        charset: aCharset,
        postData: aPostData,
        ownerTab: owner,
        allowInheritPrincipal: aAllowInheritPrincipal,
        allowThirdPartyFixup: aAllowThirdPartyFixup,
        fromExternal: aFromExternal,
        relatedToCurrent: aRelatedToCurrent,
        skipAnimation: aSkipAnimation,
        allowMixedContent: aAllowMixedContent,
        forceNotRemote: aForceNotRemote,
        createLazyBrowser: aCreateLazyBrowser,
        preferredRemoteType: aPreferredRemoteType,
        userContextId: aUserContextId,
        originPrincipal: aOriginPrincipal,
        originStoragePrincipal: aOriginStoragePrincipal,
        sameProcessAsFrameLoader: aSameProcessAsFrameLoader,
        opener: aOpener,
        openerBrowser: aOpenerBrowser,
        nextRemoteTabId: aNextRemoteTabId,
        focusUrlBar: aFocusUrlBar,
        name: aName,
        csp: aCsp,
        skipLoad: aSkipLoad,
      });
      if (!bgLoad) {
__L_V__3({
    lN: 1669,tT:'if',pr:'!bgLoad',eT:{},fN:''
  });'__L_V__3';
        this.selectedTab = tab;
      }

      return tab;
    },

    loadTabs(
      aURIs,
      {
        allowInheritPrincipal,
        allowThirdPartyFixup,
        inBackground,
        newIndex,
        postDatas,
        replace,
        targetTab,
        triggeringPrincipal,
        csp,
        userContextId,
        fromExternal,
      } = {}
    ) {
__L_V__3({
    lN: 1691,tT:'func',pr:'',eT:{'aURIs':aURIs,'allowInheritPrincipal':allowInheritPrincipal,'allowThirdPartyFixup':allowThirdPartyFixup,'inBackground':inBackground,'newIndex':newIndex,'postDatas':postDatas,'replace':replace,'targetTab':targetTab,'triggeringPrincipal':triggeringPrincipal,'csp':csp,'userContextId':userContextId,'fromExternal':fromExternal},fN:'loadTabs'
  });'__L_V__3';
      if (!aURIs.length) {
__L_V__3({
    lN: 1692,tT:'if',pr:'!aURIs.length',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      // The tab selected after this new tab is closed (i.e. the new tab's
      // "owner") is the next adjacent tab (i.e. not the previously viewed tab)
      // when several urls are opened here (i.e. closing the first should select
      // the next of many URLs opened) or if the pref to have UI links opened in
      // the background is set (i.e. the link is not being opened modally)
      //
      // i.e.
      //    Number of URLs    Load UI Links in BG       Focus Last Viewed?
      //    == 1              false                     YES
      //    == 1              true                      NO
      //    > 1               false/true                NO
      var multiple = aURIs.length > 1;
      var owner = multiple || inBackground ? null : this.selectedTab;
      var firstTabAdded = null;
      var targetTabIndex = -1;

      if (typeof newIndex != "number") {
__L_V__3({
    lN: 1712,tT:'if',pr:'typeof newIndex != number',eT:{},fN:''
  });'__L_V__3';
        newIndex = -1;
      }

      // When bulk opening tabs, such as from a bookmark folder, we want to insertAfterCurrent
      // if necessary, but we also will set the bulkOrderedOpen flag so that the bookmarks
      // open in the same order they are in the folder.
      if (
        multiple &&
        newIndex < 0 &&
        Services.prefs.getBoolPref("browser.tabs.insertAfterCurrent")
      ) {
__L_V__3({
    lN: 1723,tT:'if',pr:' multiple && newIndex < 0 && Services.prefs.getBoolPref(browser.tabs.insertAfterCurrent) ',eT:{},fN:''
  });'__L_V__3';
        newIndex = this.selectedTab._tPos + 1;
      }

      if (replace) {
__L_V__3({
    lN: 1727,tT:'if',pr:'replace',eT:{},fN:''
  });'__L_V__3';
        let browser;
        if (targetTab) {
__L_V__3({
    lN: 1729,tT:'if',pr:'targetTab',eT:{},fN:''
  });'__L_V__3';
          browser = this.getBrowserForTab(targetTab);
          targetTabIndex = targetTab._tPos;
        } else {
          browser = this.selectedBrowser;
          targetTabIndex = this.tabContainer.selectedIndex;
        }
        let flags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
        if (allowThirdPartyFixup) {
__L_V__3({
    lN: 1737,tT:'if',pr:'allowThirdPartyFixup',eT:{},fN:''
  });'__L_V__3';
          flags |=
            Ci.nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP |
            Ci.nsIWebNavigation.LOAD_FLAGS_FIXUP_SCHEME_TYPOS;
        }
        if (!allowInheritPrincipal) {
__L_V__3({
    lN: 1742,tT:'if',pr:'!allowInheritPrincipal',eT:{},fN:''
  });'__L_V__3';
          flags |= Ci.nsIWebNavigation.LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL;
        }
        if (fromExternal) {
__L_V__3({
    lN: 1745,tT:'if',pr:'fromExternal',eT:{},fN:''
  });'__L_V__3';
          flags |= Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL;
        }
        try {
          browser.loadURI(aURIs[0], {
            flags,
            postData: postDatas && postDatas[0],
            triggeringPrincipal,
            csp,
          });
        } catch (e) {
          // Ignore failure in case a URI is wrong, so we can continue
          // opening the next ones.
        }
      } else {
        let params = {
          allowInheritPrincipal,
          ownerTab: owner,
          skipAnimation: multiple,
          allowThirdPartyFixup,
          postData: postDatas && postDatas[0],
          userContextId,
          triggeringPrincipal,
          bulkOrderedOpen: multiple,
          csp,
          fromExternal,
        };
        if (newIndex > -1) {
__L_V__3({
    lN: 1772,tT:'if',pr:'newIndex > -1',eT:{},fN:''
  });'__L_V__3';
          params.index = newIndex;
        }
        firstTabAdded = this.addTab(aURIs[0], params);
        if (newIndex > -1) {
__L_V__3({
    lN: 1776,tT:'if',pr:'newIndex > -1',eT:{},fN:''
  });'__L_V__3';
          targetTabIndex = firstTabAdded._tPos;
        }
      }

      let tabNum = targetTabIndex;
      for (let i = 1; i < aURIs.length; ++i) {
        let params = {
          allowInheritPrincipal,
          skipAnimation: true,
          allowThirdPartyFixup,
          postData: postDatas && postDatas[i],
          userContextId,
          triggeringPrincipal,
          bulkOrderedOpen: true,
          csp,
          fromExternal,
        };
        if (targetTabIndex > -1) {
__L_V__3({
    lN: 1794,tT:'if',pr:'targetTabIndex > -1',eT:{},fN:''
  });'__L_V__3';
          params.index = ++tabNum;
        }
        this.addTab(aURIs[i], params);
      }

      if (firstTabAdded && !inBackground) {
__L_V__3({
    lN: 1800,tT:'if',pr:'firstTabAdded && !inBackground',eT:{},fN:''
  });'__L_V__3';
        this.selectedTab = firstTabAdded;
      }
    },

    updateBrowserRemoteness(
      aBrowser,
      {
        newFrameloader,
        opener,
        remoteType,
        sameProcessAsFrameLoader,
        replaceBrowsingContext,
        redirectLoadSwitchId,
      } = {}
    ) {
__L_V__3({
    lN: 1815,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'newFrameloader':newFrameloader,'opener':opener,'remoteType':remoteType,'sameProcessAsFrameLoader':sameProcessAsFrameLoader,'replaceBrowsingContext':replaceBrowsingContext,'redirectLoadSwitchId':redirectLoadSwitchId},fN:'updateBrowserRemoteness'
  });'__L_V__3';
      let isRemote = aBrowser.getAttribute("remote") == "true";

      // We have to be careful with this here, as the "no remote type" is null,
      // not a string. Make sure to check only for undefined, since null is
      // allowed.
      if (remoteType === undefined) {
__L_V__3({
    lN: 1821,tT:'if',pr:'remoteType === undefined',eT:{},fN:''
  });'__L_V__3';
        throw new Error("Remote type must be set!");
      }

      let shouldBeRemote = remoteType !== E10SUtils.NOT_REMOTE;

      if (!gMultiProcessBrowser && shouldBeRemote) {
__L_V__3({
    lN: 1827,tT:'if',pr:'!gMultiProcessBrowser && shouldBeRemote',eT:{},fN:''
  });'__L_V__3';
        throw new Error(
          "Cannot switch to remote browser in a window " +
            "without the remote tabs load context."
        );
      }

      // If we are passed an opener, we must be making the browser non-remote, and
      // if the browser is _currently_ non-remote, we need the openers to match,
      // because it is already too late to change it.
      if (opener) {
__L_V__3({
    lN: 1837,tT:'if',pr:'opener',eT:{},fN:''
  });'__L_V__3';
        if (shouldBeRemote) {
__L_V__3({
    lN: 1838,tT:'if',pr:'shouldBeRemote',eT:{},fN:''
  });'__L_V__3';
          throw new Error(
            "Cannot set an opener on a browser which should be remote!"
          );
        }
        if (!isRemote && aBrowser.contentWindow.opener != opener) {
__L_V__3({
    lN: 1843,tT:'if',pr:'!isRemote && aBrowser.contentWindow.opener != opener',eT:{},fN:''
  });'__L_V__3';
          throw new Error(
            "Cannot change opener on an already non-remote browser!"
          );
        }
      }

      // Abort if we're not going to change anything
      let oldRemoteType = aBrowser.remoteType;
      if (
        isRemote == shouldBeRemote &&
        !newFrameloader &&
        (!isRemote || oldRemoteType == remoteType)
      ) {
__L_V__3({
    lN: 1856,tT:'if',pr:' isRemote == shouldBeRemote && !newFrameloader && (!isRemote || oldRemoteType == remoteType) ',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      let tab = this.getTabForBrowser(aBrowser);
      // aBrowser needs to be inserted now if it hasn't been already.
      this._insertBrowser(tab);

      let evt = document.createEvent("Events");
      evt.initEvent("BeforeTabRemotenessChange", true, false);
      tab.dispatchEvent(evt);

      let wasActive = document.activeElement == aBrowser;

      // Unmap the old outerWindowID.
      this._outerWindowIDBrowserMap.delete(aBrowser.outerWindowID);

      // Unhook our progress listener.
      let filter = this._tabFilters.get(tab);
      let listener = this._tabListeners.get(tab);
      aBrowser.webProgress.removeProgressListener(filter);
      filter.removeProgressListener(listener);

      // We'll be creating a new listener, so destroy the old one.
      listener.destroy();

      let oldDroppedLinkHandler = aBrowser.droppedLinkHandler;
      let oldSameProcessAsFrameLoader = aBrowser.sameProcessAsFrameLoader;
      let oldUserTypedValue = aBrowser.userTypedValue;
      let hadStartedLoad = aBrowser.didStartLoadSinceLastUserTyping();
      let parent = aBrowser.parentNode;

      // Change the "remote" attribute.

      // Make sure the browser is destroyed so it unregisters from observer notifications
      aBrowser.destroy();
      // Only remove the node if we're not rebuilding the frameloader via nsFrameLoaderOwner.
      let rebuildFrameLoaders =
        E10SUtils.rebuildFrameloadersOnRemotenessChange ||
        window.docShell.nsILoadContext.useRemoteSubframes;
      if (!rebuildFrameLoaders) {
__L_V__3({
    lN: 1896,tT:'if',pr:'!rebuildFrameLoaders',eT:{},fN:''
  });'__L_V__3';
        aBrowser.remove();
      }

      // NB: This works with the hack in the browser constructor that
      // turns this normal property into a field.
      if (sameProcessAsFrameLoader) {
__L_V__3({
    lN: 1902,tT:'if',pr:'sameProcessAsFrameLoader',eT:{},fN:''
  });'__L_V__3';
        // Always set sameProcessAsFrameLoader when passed in explicitly.
        aBrowser.sameProcessAsFrameLoader = sameProcessAsFrameLoader;
      } else if (!shouldBeRemote || oldRemoteType == remoteType) {
__L_V__3({
    lN: 1905,tT:'if',pr:'!shouldBeRemote || oldRemoteType == remoteType',eT:{},fN:''
  });'__L_V__3';
        // Only copy existing sameProcessAsFrameLoader when not switching
        // remote type otherwise it would stop the switch.
        aBrowser.sameProcessAsFrameLoader = oldSameProcessAsFrameLoader;
      }

      if (opener) {
__L_V__3({
    lN: 1911,tT:'if',pr:'opener',eT:{},fN:''
  });'__L_V__3';
        // Set the opener window on the browser, such that when the frame
        // loader is created the opener is set correctly.
        aBrowser.presetOpenerWindow(opener);
      }

      // Note that this block is also affected by the
      // rebuild_frameloaders_on_remoteness_change pref. If the pref is set to
      // false, this attribute change is observed by browser-custom-element,
      // causing browser destroy()/construct() to be run. If the pref is true,
      // then we update the attributes, we run the construct() call ourselves
      // after the new frameloader has been created.
      if (shouldBeRemote) {
__L_V__3({
    lN: 1923,tT:'if',pr:'shouldBeRemote',eT:{},fN:''
  });'__L_V__3';
        aBrowser.setAttribute("remote", "true");
        aBrowser.setAttribute("remoteType", remoteType);
      } else {
        aBrowser.setAttribute("remote", "false");
        aBrowser.removeAttribute("remoteType");
      }

      if (!rebuildFrameLoaders) {
__L_V__3({
    lN: 1931,tT:'if',pr:'!rebuildFrameLoaders',eT:{},fN:''
  });'__L_V__3';
        parent.appendChild(aBrowser);
      } else {
        // This call actually switches out our frameloaders. Do this as late as
        // possible before rebuilding the browser, as we'll need the new browser
        // state set up completely first.
        aBrowser.changeRemoteness({
          remoteType,
          replaceBrowsingContext,
          switchingInProgressLoad: redirectLoadSwitchId != null,
        });
        // Once we have new frameloaders, this call sets the browser back up.
        //
        // FIXME(emilio): Shouldn't we call destroy() first? What hides the
        // select pop-ups and such otherwise?
        aBrowser.construct();
      }

      aBrowser.userTypedValue = oldUserTypedValue;
      if (hadStartedLoad) {
__L_V__3({
    lN: 1950,tT:'if',pr:'hadStartedLoad',eT:{},fN:''
  });'__L_V__3';
        aBrowser.urlbarChangeTracker.startedLoad();
      }

      aBrowser.droppedLinkHandler = oldDroppedLinkHandler;

      // Switching a browser's remoteness will create a new frameLoader.
      // As frameLoaders start out with an active docShell we have to
      // deactivate it if this is not the selected tab's browser or the
      // browser window is minimized.
      aBrowser.docShellIsActive = this.shouldActivateDocShell(aBrowser);

      // Create a new tab progress listener for the new browser we just injected,
      // since tab progress listeners have logic for handling the initial about:blank
      // load
      listener = new TabProgressListener(tab, aBrowser, true, false);
      this._tabListeners.set(tab, listener);
      filter.addProgressListener(listener, Ci.nsIWebProgress.NOTIFY_ALL);

      // Restore the progress listener.
      aBrowser.webProgress.addProgressListener(
        filter,
        Ci.nsIWebProgress.NOTIFY_ALL
      );

      // Restore the securityUI state.
      let securityUI = aBrowser.securityUI;
      let state = securityUI
        ? securityUI.state
        : Ci.nsIWebProgressListener.STATE_IS_INSECURE;
      this._callProgressListeners(
        aBrowser,
        "onSecurityChange",
        [aBrowser.webProgress, null, state],
        true,
        false
      );
      let event = aBrowser.getContentBlockingEvents();
      // Include the true final argument to indicate that this event is
      // simulated (instead of being observed by the webProgressListener).
      this._callProgressListeners(
        aBrowser,
        "onContentBlockingEvent",
        [aBrowser.webProgress, null, event, true],
        true,
        false
      );

      if (shouldBeRemote) {
__L_V__3({
    lN: 1998,tT:'if',pr:'shouldBeRemote',eT:{},fN:''
  });'__L_V__3';
        // Switching the browser to be remote will connect to a new child
        // process so the browser can no longer be considered to be
        // crashed.
        tab.removeAttribute("crashed");
      } else {
        aBrowser.sendMessageToActor(
          "Browser:AppTab",
          { isAppTab: tab.pinned },
          "BrowserTab"
        );

        // Register the new outerWindowID.
        this._outerWindowIDBrowserMap.set(aBrowser.outerWindowID, aBrowser);
      }

      if (wasActive) {
__L_V__3({
    lN: 2014,tT:'if',pr:'wasActive',eT:{},fN:''
  });'__L_V__3';
        aBrowser.focus();
      }

      // If the findbar has been initialised, reset its browser reference.
      if (this.isFindBarInitialized(tab)) {
__L_V__3({
    lN: 2019,tT:'if',pr:'this.isFindBarInitialized(tab)',eT:{},fN:''
  });'__L_V__3';
        this.getCachedFindBar(tab).browser = aBrowser;
      }

      tab.linkedBrowser.sendMessageToActor(
        "Browser:HasSiblings",
        this.tabs.length > 1,
        "BrowserTab"
      );

      evt = document.createEvent("Events");
      evt.initEvent("TabRemotenessChange", true, false);
      tab.dispatchEvent(evt);

      return true;
    },

    updateBrowserRemotenessByURL(aBrowser, aURL, aOptions = {}) {
__L_V__3({
    lN: 2036,tT:'func',pr:'',eT:{'aBrowser':aBrowser,'aURL':aURL,'aOptions':aOptions},fN:'updateBrowserRemotenessByURL'
  });'__L_V__3';
      if (!gMultiProcessBrowser) {
__L_V__3({
    lN: 2037,tT:'if',pr:'!gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        return this.updateBrowserRemoteness(aBrowser, {
          remoteType: E10SUtils.NOT_REMOTE,
        });
      }

      let oldRemoteType = aBrowser.remoteType;

      aOptions.remoteType = E10SUtils.getRemoteTypeForURI(
        aURL,
        gMultiProcessBrowser,
        gFissionBrowser,
        oldRemoteType,
        aBrowser.currentURI
      );

      // If this URL can't load in the current browser then flip it to the
      // correct type.
      if (oldRemoteType != aOptions.remoteType || aOptions.newFrameloader) {
__L_V__3({
    lN: 2055,tT:'if',pr:'oldRemoteType != aOptions.remoteType || aOptions.newFrameloader',eT:{},fN:''
  });'__L_V__3';
        return this.updateBrowserRemoteness(aBrowser, aOptions);
      }

      return false;
    },

    createBrowser({
      isPreloadBrowser,
      name,
      nextRemoteTabId,
      openerWindow,
      remoteType,
      sameProcessAsFrameLoader,
      uriIsAboutBlank,
      userContextId,
      skipLoad,
    } = {}) {
__L_V__3({
    lN: 2072,tT:'func',pr:'',eT:{'isPreloadBrowser':isPreloadBrowser,'name':name,'nextRemoteTabId':nextRemoteTabId,'openerWindow':openerWindow,'remoteType':remoteType,'sameProcessAsFrameLoader':sameProcessAsFrameLoader,'uriIsAboutBlank':uriIsAboutBlank,'userContextId':userContextId,'skipLoad':skipLoad},fN:'createBrowser'
  });'__L_V__3';
      let b = document.createXULElement("browser");
      // Use the JSM global to create the permanentKey, so that if the
      // permanentKey is held by something after this window closes, it
      // doesn't keep the window alive.
      b.permanentKey = new (Cu.getGlobalForObject(Services)).Object();

      const defaultBrowserAttributes = {
        contextmenu: "contentAreaContextMenu",
        datetimepicker: "DateTimePickerPanel",
        message: "true",
        messagemanagergroup: "browsers",
        selectmenulist: "ContentSelectDropdown",
        tooltip: "aHTMLTooltip",
        type: "content",
      };
      for (let attribute in defaultBrowserAttributes) {
        b.setAttribute(attribute, defaultBrowserAttributes[attribute]);
      }

      if (userContextId) {
__L_V__3({
    lN: 2092,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__3';
        b.setAttribute("usercontextid", userContextId);
      }

      if (remoteType) {
__L_V__3({
    lN: 2096,tT:'if',pr:'remoteType',eT:{},fN:''
  });'__L_V__3';
        b.setAttribute("remoteType", remoteType);
        b.setAttribute("remote", "true");
      }

      if (openerWindow) {
__L_V__3({
    lN: 2101,tT:'if',pr:'openerWindow',eT:{},fN:''
  });'__L_V__3';
        if (remoteType) {
__L_V__3({
    lN: 2102,tT:'if',pr:'remoteType',eT:{},fN:''
  });'__L_V__3';
          throw new Error("Cannot set opener window on a remote browser!");
        }
        b.presetOpenerWindow(openerWindow);
      }

      if (!isPreloadBrowser) {
__L_V__3({
    lN: 2108,tT:'if',pr:'!isPreloadBrowser',eT:{},fN:''
  });'__L_V__3';
        b.setAttribute("autocompletepopup", "PopupAutoComplete");
      }
      if (this._autoScrollPopup) {
__L_V__3({
    lN: 2111,tT:'if',pr:'this._autoScrollPopup',eT:{},fN:''
  });'__L_V__3';
        b.setAttribute("autoscrollpopup", this._autoScrollPopup.id);
      }

      /*
       * This attribute is meant to describe if the browser is the
       * preloaded browser. There are 2 defined states: "preloaded" or
       * "consumed". The order of events goes as follows:
       *   1. The preloaded browser is created and the 'preloadedState'
       *      attribute for that browser is set to "preloaded".
       *   2. When a new tab is opened and it is time to show that
       *      preloaded browser, the 'preloadedState' attribute for that
       *      browser is set to "consumed"
       *   3. When we then navigate away from about:newtab, the "consumed"
       *      browsers will attempt to switch to a new content process,
       *      therefore the 'preloadedState' attribute is removed from
       *      that browser altogether
       * See more details on Bug 1420285.
       */
      if (isPreloadBrowser) {
__L_V__3({
    lN: 2130,tT:'if',pr:'isPreloadBrowser',eT:{},fN:''
  });'__L_V__3';
        b.setAttribute("preloadedState", "preloaded");
      }

      if (nextRemoteTabId) {
__L_V__3({
    lN: 2134,tT:'if',pr:'nextRemoteTabId',eT:{},fN:''
  });'__L_V__3';
        if (!remoteType) {
__L_V__3({
    lN: 2135,tT:'if',pr:'!remoteType',eT:{},fN:''
  });'__L_V__3';
          throw new Error("Cannot have nextRemoteTabId without a remoteType");
        }
        // Gecko is going to read this attribute and use it.
        b.setAttribute("nextRemoteTabId", nextRemoteTabId.toString());
      }

      if (sameProcessAsFrameLoader) {
__L_V__3({
    lN: 2142,tT:'if',pr:'sameProcessAsFrameLoader',eT:{},fN:''
  });'__L_V__3';
        b.sameProcessAsFrameLoader = sameProcessAsFrameLoader;
      }

      // This will be used by gecko to control the name of the opened
      // window.
      if (name) {
__L_V__3({
    lN: 2148,tT:'if',pr:'name',eT:{},fN:''
  });'__L_V__3';
        // XXX: The `name` property is special in HTML and XUL. Should
        // we use a different attribute name for this?
        b.setAttribute("name", name);
      }

      let notificationbox = document.createXULElement("notificationbox");
      notificationbox.setAttribute("notificationside", "top");

      // We set large flex on both containers to allow the devtools toolbox to
      // set a flex attribute. We don't want the toolbox to actually take up free
      // space, but we do want it to collapse when the window shrinks, and with
      // flex=0 it can't. When the toolbox is on the bottom it's a sibling of
      // browserStack, and when it's on the side it's a sibling of
      // browserContainer.
      let stack = document.createXULElement("stack");
      stack.className = "browserStack";
      stack.appendChild(b);
      stack.setAttribute("flex", "10000");

      let browserContainer = document.createXULElement("vbox");
      browserContainer.className = "browserContainer";
      browserContainer.appendChild(notificationbox);
      browserContainer.appendChild(stack);
      browserContainer.setAttribute("flex", "10000");

      let browserSidebarContainer = document.createXULElement("hbox");
      browserSidebarContainer.className = "browserSidebarContainer";
      browserSidebarContainer.appendChild(browserContainer);

      // Prevent the superfluous initial load of a blank document
      // if we're going to load something other than about:blank.
      if (!uriIsAboutBlank || skipLoad) {
__L_V__3({
    lN: 2180,tT:'if',pr:'!uriIsAboutBlank || skipLoad',eT:{},fN:''
  });'__L_V__3';
        b.setAttribute("nodefaultsrc", "true");
      }

      return b;
    },

    _createLazyBrowser(aTab) {
__L_V__3({
    lN: 2187,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_createLazyBrowser'
  });'__L_V__3';
      let browser = aTab.linkedBrowser;

      let names = this._browserBindingProperties;

      for (let i = 0; i < names.length; i++) {
        let name = names[i];
        let getter;
        let setter;
__L_V__3({
    lN: 2196,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';
        switch (name) {
          case "audioMuted":
            getter = () => aTab.hasAttribute("muted");
            break;
          case "contentTitle":
            getter = () => SessionStore.getLazyTabValue(aTab, "title");
            break;
          case "currentURI":
            getter = () => {
              let url = SessionStore.getLazyTabValue(aTab, "url");
              // Avoid recreating the same nsIURI object over and over again...
              if (browser._cachedCurrentURI) {
__L_V__3({
    lN: 2207,tT:'if',pr:'browser._cachedCurrentURI',eT:{},fN:''
  });'__L_V__3';
                return browser._cachedCurrentURI;
              }
              return (browser._cachedCurrentURI = Services.io.newURI(url));
            };
            break;
          case "didStartLoadSinceLastUserTyping":
            getter = () => () => false;
            break;
          case "fullZoom":
          case "textZoom":
            getter = () => 1;
            break;
          case "tabHasCustomZoom":
            getter = () => false;
            break;
          case "getTabBrowser":
            getter = () => () => this;
            break;
          case "isRemoteBrowser":
            getter = () => browser.getAttribute("remote") == "true";
            break;
          case "permitUnload":
            getter = () => () => ({ permitUnload: true, timedOut: false });
            break;
          case "reload":
          case "reloadWithFlags":
            getter = () => params => {
              // Wait for load handler to be instantiated before
              // initializing the reload.
              aTab.addEventListener(
                "SSTabRestoring",
                () => {
                  browser[name](params);
                },
                { once: true }
              );
              gBrowser._insertBrowser(aTab);
            };
            break;
          case "remoteType":
            getter = () => {
              let url = SessionStore.getLazyTabValue(aTab, "url");
              // Avoid recreating the same nsIURI object over and over again...
              let uri;
              if (browser._cachedCurrentURI) {
__L_V__3({
    lN: 2252,tT:'if',pr:'browser._cachedCurrentURI',eT:{},fN:''
  });'__L_V__3';
                uri = browser._cachedCurrentURI;
              } else {
                uri = browser._cachedCurrentURI = Services.io.newURI(url);
              }
              return E10SUtils.getRemoteTypeForURI(
                url,
                gMultiProcessBrowser,
                gFissionBrowser,
                undefined,
                uri
              );
            };
            break;
          case "userTypedValue":
          case "userTypedClear":
            getter = () => SessionStore.getLazyTabValue(aTab, name);
            break;
          default:
            getter = () => {
              if (AppConstants.NIGHTLY_BUILD) {
__L_V__3({
    lN: 2272,tT:'if',pr:'AppConstants.NIGHTLY_BUILD',eT:{},fN:''
  });'__L_V__3';
                let message = `[bug 1345098] Lazy browser prematurely inserted via '${name}' property access:\n`;
                console.log(message + new Error().stack);
              }
              this._insertBrowser(aTab);
              return browser[name];
            };
            setter = value => {
              if (AppConstants.NIGHTLY_BUILD) {
__L_V__3({
    lN: 2280,tT:'if',pr:'AppConstants.NIGHTLY_BUILD',eT:{},fN:''
  });'__L_V__3';
                let message = `[bug 1345098] Lazy browser prematurely inserted via '${name}' property access:\n`;
                console.log(message + new Error().stack);
              }
              this._insertBrowser(aTab);
              return (browser[name] = value);
            };
        }
        Object.defineProperty(browser, name, {
          get: getter,
          set: setter,
          configurable: true,
          enumerable: true,
        });
      }
    },

    _insertBrowser(aTab, aInsertedOnTabCreation) {
__L_V__3({
    lN: 2297,tT:'func',pr:'',eT:{'aTab':aTab,'aInsertedOnTabCreation':aInsertedOnTabCreation},fN:'_insertBrowser'
  });'__L_V__3';
      "use strict";

      // If browser is already inserted or window is closed don't do anything.
      if (aTab.linkedPanel || window.closed) {
__L_V__3({
    lN: 2301,tT:'if',pr:'aTab.linkedPanel || window.closed',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      let browser = aTab.linkedBrowser;

      // If browser is a lazy browser, delete the substitute properties.
      if (this._browserBindingProperties[0] in browser) {
__L_V__3({
    lN: 2308,tT:'if',pr:'this._browserBindingProperties[0] in browser',eT:{},fN:''
  });'__L_V__3';
        for (let name of this._browserBindingProperties) {
          delete browser[name];
        }
      }

      let {
        uriIsAboutBlank,
        remoteType,
        usingPreloadedContent,
      } = aTab._browserParams;
      delete aTab._browserParams;
      delete aTab._cachedCurrentURI;

      let panel = this.getPanel(browser);
      let uniqueId = this._generateUniquePanelID();
      panel.id = uniqueId;
      aTab.linkedPanel = uniqueId;

      // Inject the <browser> into the DOM if necessary.
      if (!panel.parentNode) {
__L_V__3({
    lN: 2328,tT:'if',pr:'!panel.parentNode',eT:{},fN:''
  });'__L_V__3';
        // NB: this appendChild call causes us to run constructors for the
        // browser element, which fires off a bunch of notifications. Some
        // of those notifications can cause code to run that inspects our
        // state, so it is important that the tab element is fully
        // initialized by this point.
        this.tabpanels.appendChild(panel);
      }

      // wire up a progress listener for the new browser object.
      let tabListener = new TabProgressListener(
        aTab,
        browser,
        uriIsAboutBlank,
        usingPreloadedContent
      );
      const filter = Cc[
        "@mozilla.org/appshell/component/browser-status-filter;1"
      ].createInstance(Ci.nsIWebProgress);
      filter.addProgressListener(tabListener, Ci.nsIWebProgress.NOTIFY_ALL);
      browser.webProgress.addProgressListener(
        filter,
        Ci.nsIWebProgress.NOTIFY_ALL
      );
      this._tabListeners.set(aTab, tabListener);
      this._tabFilters.set(aTab, filter);

      browser.droppedLinkHandler = handleDroppedLink;
      browser.loadURI = _loadURI.bind(null, browser);

      // Most of the time, we start our browser's docShells out as inactive,
      // and then maintain activeness in the tab switcher. Preloaded about:newtab's
      // are already created with their docShell's as inactive, but then explicitly
      // render their layers to ensure that we can switch to them quickly. We avoid
      // setting docShellIsActive to false again in this case, since that'd cause
      // the layers for the preloaded tab to be dropped, and we'd see a flash
      // of empty content instead.
      //
      // So for all browsers except for the preloaded case, we set the browser
      // docShell to inactive.
      if (!usingPreloadedContent) {
__L_V__3({
    lN: 2368,tT:'if',pr:'!usingPreloadedContent',eT:{},fN:''
  });'__L_V__3';
        browser.docShellIsActive = false;
      }

      // When addTab() is called with an URL that is not "about:blank" we
      // set the "nodefaultsrc" attribute that prevents a frameLoader
      // from being created as soon as the linked <browser> is inserted
      // into the DOM. We thus have to register the new outerWindowID
      // for non-remote browsers after we have called browser.loadURI().
      if (remoteType == E10SUtils.NOT_REMOTE) {
__L_V__3({
    lN: 2377,tT:'if',pr:'remoteType == E10SUtils.NOT_REMOTE',eT:{},fN:''
  });'__L_V__3';
        this._outerWindowIDBrowserMap.set(browser.outerWindowID, browser);
      }

      // If we transitioned from one browser to two browsers, we need to set
      // hasSiblings=false on both the existing browser and the new browser.
      if (this.tabs.length == 2) {
__L_V__3({
    lN: 2383,tT:'if',pr:'this.tabs.length == 2',eT:{},fN:''
  });'__L_V__3';
        this.tabs[0].linkedBrowser.sendMessageToActor(
          "Browser:HasSiblings",
          true,
          "BrowserTab"
        );
        this.tabs[1].linkedBrowser.sendMessageToActor(
          "Browser:HasSiblings",
          true,
          "BrowserTab"
        );
      } else {
        aTab.linkedBrowser.sendMessageToActor(
          "Browser:HasSiblings",
          this.tabs.length > 1,
          "BrowserTab"
        );
      }

      // Only fire this event if the tab is already in the DOM
      // and will be handled by a listener.
      if (aTab.isConnected) {
__L_V__3({
    lN: 2404,tT:'if',pr:'aTab.isConnected',eT:{},fN:''
  });'__L_V__3';
        var evt = new CustomEvent("TabBrowserInserted", {
          bubbles: true,
          detail: { insertedOnTabCreation: aInsertedOnTabCreation },
        });
        aTab.dispatchEvent(evt);
      }
    },

    _mayDiscardBrowser(aTab, aForceDiscard) {
__L_V__3({
    lN: 2413,tT:'func',pr:'',eT:{'aTab':aTab,'aForceDiscard':aForceDiscard},fN:'_mayDiscardBrowser'
  });'__L_V__3';
      let browser = aTab.linkedBrowser;
      let permitUnloadFlags = aForceDiscard
        ? browser.dontPromptAndUnload
        : browser.dontPromptAndDontUnload;

      if (
        !aTab ||
        aTab.selected ||
        aTab.closing ||
        this._windowIsClosing ||
        !browser.isConnected ||
        !browser.isRemoteBrowser ||
        !browser.permitUnload(permitUnloadFlags).permitUnload
      ) {
__L_V__3({
    lN: 2427,tT:'if',pr:' !aTab || aTab.selected || aTab.closing || this._windowIsClosing || !browser.isConnected || !browser.isRemoteBrowser || !browser.permitUnload(permitUnloadFlags).permitUnload ',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      return true;
    },

    discardBrowser(aTab, aForceDiscard) {
__L_V__3({
    lN: 2434,tT:'func',pr:'',eT:{'aTab':aTab,'aForceDiscard':aForceDiscard},fN:'discardBrowser'
  });'__L_V__3';
      "use strict";
      let browser = aTab.linkedBrowser;

      if (!this._mayDiscardBrowser(aTab, aForceDiscard)) {
__L_V__3({
    lN: 2438,tT:'if',pr:'!this._mayDiscardBrowser(aTab, aForceDiscard)',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      // Reset sharing state.
      if (aTab._sharingState) {
__L_V__3({
    lN: 2443,tT:'if',pr:'aTab._sharingState',eT:{},fN:''
  });'__L_V__3';
        this.resetBrowserSharing(browser);
      }
      webrtcUI.forgetStreamsFromBrowserContext(browser.browsingContext);

      // Set browser parameters for when browser is restored.  Also remove
      // listeners and set up lazy restore data in SessionStore. This must
      // be done before browser is destroyed and removed from the document.
      aTab._browserParams = {
        uriIsAboutBlank: browser.currentURI.spec == "about:blank",
        remoteType: browser.remoteType,
        usingPreloadedContent: false,
      };

      SessionStore.resetBrowserToLazyState(aTab);

      this._outerWindowIDBrowserMap.delete(browser.outerWindowID);

      // Remove the tab's filter and progress listener.
      let filter = this._tabFilters.get(aTab);
      let listener = this._tabListeners.get(aTab);
      browser.webProgress.removeProgressListener(filter);
      filter.removeProgressListener(listener);
      listener.destroy();

      this._tabListeners.delete(aTab);
      this._tabFilters.delete(aTab);

      // Reset the findbar and remove it if it is attached to the tab.
      if (aTab._findBar) {
__L_V__3({
    lN: 2472,tT:'if',pr:'aTab._findBar',eT:{},fN:''
  });'__L_V__3';
        aTab._findBar.close(true);
        aTab._findBar.remove();
        delete aTab._findBar;
      }

      browser.destroy();
      this.getPanel(browser).remove();
      aTab.removeAttribute("linkedpanel");

      this._createLazyBrowser(aTab);

      let evt = new CustomEvent("TabBrowserDiscarded", { bubbles: true });
      aTab.dispatchEvent(evt);
      return true;
    },

    /**
     * Loads a tab with a default null principal unless specified
     */
    addWebTab(aURI, params = {}) {
__L_V__3({
    lN: 2492,tT:'func',pr:'',eT:{'aURI':aURI,'params':params},fN:'addWebTab'
  });'__L_V__3';
      if (!params.triggeringPrincipal) {
__L_V__3({
    lN: 2493,tT:'if',pr:'!params.triggeringPrincipal',eT:{},fN:''
  });'__L_V__3';
        params.triggeringPrincipal = Services.scriptSecurityManager.createNullPrincipal(
          {
            userContextId: params.userContextId,
          }
        );
      }
      if (params.triggeringPrincipal.isSystemPrincipal) {
__L_V__3({
    lN: 2500,tT:'if',pr:'params.triggeringPrincipal.isSystemPrincipal',eT:{},fN:''
  });'__L_V__3';
        throw new Error(
          "System principal should never be passed into addWebTab()"
        );
      }
      return this.addTab(aURI, params);
    },

    /**
     * Must only be used sparingly for content that came from Chrome context
     * If in doubt use addWebTab
     */
    addTrustedTab(aURI, params = {}) {
__L_V__3({
    lN: 2512,tT:'func',pr:'',eT:{'aURI':aURI,'params':params},fN:'addTrustedTab'
  });'__L_V__3';
      params.triggeringPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
      return this.addTab(aURI, params);
    },

    // eslint-disable-next-line complexity
    addTab(
      aURI,
      {
        allowInheritPrincipal,
        allowMixedContent,
        allowThirdPartyFixup,
        bulkOrderedOpen,
        charset,
        createLazyBrowser,
        disableTRR,
        eventDetail,
        focusUrlBar,
        forceNotRemote,
        fromExternal,
        index,
        lazyTabTitle,
        name,
        nextRemoteTabId,
        noInitialLabel,
        opener,
        openerBrowser,
        originPrincipal,
        originStoragePrincipal,
        ownerTab,
        pinned,
        postData,
        preferredRemoteType,
        referrerInfo,
        relatedToCurrent,
        sameProcessAsFrameLoader,
        skipAnimation,
        skipBackgroundNotify,
        triggeringPrincipal,
        userContextId,
        csp,
        skipLoad,
        batchInsertingTabs,
      } = {}
    ) {
__L_V__3({
    lN: 2556,tT:'func',pr:'',eT:{'aURI':aURI,'allowInheritPrincipal':allowInheritPrincipal,'allowMixedContent':allowMixedContent,'allowThirdPartyFixup':allowThirdPartyFixup,'bulkOrderedOpen':bulkOrderedOpen,'charset':charset,'createLazyBrowser':createLazyBrowser,'disableTRR':disableTRR,'eventDetail':eventDetail,'focusUrlBar':focusUrlBar,'forceNotRemote':forceNotRemote,'fromExternal':fromExternal,'index':index,'lazyTabTitle':lazyTabTitle,'name':name,'nextRemoteTabId':nextRemoteTabId,'noInitialLabel':noInitialLabel,'opener':opener,'openerBrowser':openerBrowser,'originPrincipal':originPrincipal,'originStoragePrincipal':originStoragePrincipal,'ownerTab':ownerTab,'pinned':pinned,'postData':postData,'preferredRemoteType':preferredRemoteType,'referrerInfo':referrerInfo,'relatedToCurrent':relatedToCurrent,'sameProcessAsFrameLoader':sameProcessAsFrameLoader,'skipAnimation':skipAnimation,'skipBackgroundNotify':skipBackgroundNotify,'triggeringPrincipal':triggeringPrincipal,'userContextId':userContextId,'csp':csp,'skipLoad':skipLoad,'batchInsertingTabs':batchInsertingTabs},fN:'addTab'
  });'__L_V__3';
      // all callers of addTab that pass a params object need to pass
      // a valid triggeringPrincipal.
      if (!triggeringPrincipal) {
__L_V__3({
    lN: 2559,tT:'if',pr:'!triggeringPrincipal',eT:{},fN:''
  });'__L_V__3';
        throw new Error(
          "Required argument triggeringPrincipal missing within addTab"
        );
      }

      // if we're adding tabs, we're past interrupt mode, ditch the owner
      if (this.selectedTab.owner) {
__L_V__3({
    lN: 2566,tT:'if',pr:'this.selectedTab.owner',eT:{},fN:''
  });'__L_V__3';
        this.selectedTab.owner = null;
      }

      // Find the tab that opened this one, if any. This is used for
      // determining positioning, and inherited attributes such as the
      // user context ID.
      //
      // If we have a browser opener (which is usually the browser
      // element from a remote window.open() call), use that.
      //
      // Otherwise, if the tab is related to the current tab (e.g.,
      // because it was opened by a link click), use the selected tab as
      // the owner. If referrerInfo is set, and we don't have an
      // explicit relatedToCurrent arg, we assume that the tab is
      // related to the current tab, since referrerURI is null or
      // undefined if the tab is opened from an external application or
      // bookmark (i.e. somewhere other than an existing tab).
      if (relatedToCurrent == null) {
__L_V__3({
    lN: 2584,tT:'if',pr:'relatedToCurrent == null',eT:{},fN:''
  });'__L_V__3';
        relatedToCurrent = !!(referrerInfo && referrerInfo.originalReferrer);
      }
      let openerTab =
        (openerBrowser && this.getTabForBrowser(openerBrowser)) ||
        (relatedToCurrent && this.selectedTab);

      var t = document.createXULElement("tab", { is: "tabbrowser-tab" });
      // Tag the tab as being created so extension code can ignore events
      // prior to TabOpen.
      t.initializingTab = true;
      t.openerTab = openerTab;

      aURI = aURI || "about:blank";
      let aURIObject = null;
      try {
        aURIObject = Services.io.newURI(aURI);
      } catch (ex) {
        /* we'll try to fix up this URL later */
      }

      let lazyBrowserURI;
      if (createLazyBrowser && aURI != "about:blank") {
__L_V__3({
    lN: 2606,tT:'if',pr:'createLazyBrowser && aURI != about:blank',eT:{},fN:''
  });'__L_V__3';
        lazyBrowserURI = aURIObject;
        aURI = "about:blank";
      }

      var uriIsAboutBlank = aURI == "about:blank";

      // When overflowing, new tabs are scrolled into view smoothly, which
      // doesn't go well together with the width transition. So we skip the
      // transition in that case.
      let animate =
        !skipAnimation &&
        !pinned &&
        this.tabContainer.getAttribute("overflow") != "true" &&
        this.animationsEnabled;

      // Related tab inherits current tab's user context unless a different
      // usercontextid is specified
      if (userContextId == null && openerTab) {
__L_V__3({
    lN: 2624,tT:'if',pr:'userContextId == null && openerTab',eT:{},fN:''
  });'__L_V__3';
        userContextId = openerTab.getAttribute("usercontextid") || 0;
      }

      if (!noInitialLabel) {
__L_V__3({
    lN: 2628,tT:'if',pr:'!noInitialLabel',eT:{},fN:''
  });'__L_V__3';
        if (isBlankPageURL(aURI)) {
__L_V__3({
    lN: 2629,tT:'if',pr:'isBlankPageURL(aURI)',eT:{},fN:''
  });'__L_V__3';
          t.setAttribute("label", this.tabContainer.emptyTabTitle);
        } else {
          // Set URL as label so that the tab isn't empty initially.
          this.setInitialTabTitle(t, aURI, { beforeTabOpen: true });
        }
      }

      if (userContextId) {
__L_V__3({
    lN: 2637,tT:'if',pr:'userContextId',eT:{},fN:''
  });'__L_V__3';
        t.setAttribute("usercontextid", userContextId);
        ContextualIdentityService.setTabStyle(t);
      }

      if (skipBackgroundNotify) {
__L_V__3({
    lN: 2642,tT:'if',pr:'skipBackgroundNotify',eT:{},fN:''
  });'__L_V__3';
        t.setAttribute("skipbackgroundnotify", true);
      }

      if (pinned) {
__L_V__3({
    lN: 2646,tT:'if',pr:'pinned',eT:{},fN:''
  });'__L_V__3';
        t.setAttribute("pinned", "true");
      }

      t.classList.add("tabbrowser-tab");

      this.tabContainer._unlockTabSizing();

      if (!animate) {
__L_V__3({
    lN: 2654,tT:'if',pr:'!animate',eT:{},fN:''
  });'__L_V__3';
        t.setAttribute("fadein", "true");

        // Call _handleNewTab asynchronously as it needs to know if the
        // new tab is selected.
        setTimeout(
          function(tabContainer) {
__L_V__3({
    lN: 2660,tT:'func',pr:'',eT:{'tabContainer':tabContainer},fN:'function'
  });'__L_V__3';
            tabContainer._handleNewTab(t);
          },
          0,
          this.tabContainer
        );
      }

      let usingPreloadedContent = false;
      let b;

      try {
        if (!batchInsertingTabs) {
__L_V__3({
    lN: 2672,tT:'if',pr:'!batchInsertingTabs',eT:{},fN:''
  });'__L_V__3';
          // When we are not restoring a session, we need to know
          // insert the tab into the tab container in the correct position
          this._insertTabAtIndex(t, {
            index,
            ownerTab,
            openerTab,
            pinned,
            bulkOrderedOpen,
          });
        }

        // If we don't have a preferred remote type, and we have a remote
        // opener, use the opener's remote type.
        if (!preferredRemoteType && openerBrowser) {
__L_V__3({
    lN: 2686,tT:'if',pr:'!preferredRemoteType && openerBrowser',eT:{},fN:''
  });'__L_V__3';
          preferredRemoteType = openerBrowser.remoteType;
        }

        // If URI is about:blank and we don't have a preferred remote type,
        // then we need to use the referrer, if we have one, to get the
        // correct remote type for the new tab.
        if (
          uriIsAboutBlank &&
          !preferredRemoteType &&
          referrerInfo &&
          referrerInfo.originalReferrer
        ) {
__L_V__3({
    lN: 2698,tT:'if',pr:' uriIsAboutBlank && !preferredRemoteType && referrerInfo && referrerInfo.originalReferrer ',eT:{},fN:''
  });'__L_V__3';
          preferredRemoteType = E10SUtils.getRemoteTypeForURI(
            referrerInfo.originalReferrer.spec,
            gMultiProcessBrowser,
            gFissionBrowser
          );
        }

        let remoteType = forceNotRemote
          ? E10SUtils.NOT_REMOTE
          : E10SUtils.getRemoteTypeForURI(
              aURI,
              gMultiProcessBrowser,
              gFissionBrowser,
              preferredRemoteType
            );

        // If we open a new tab with the newtab URL in the default
        // userContext, check if there is a preloaded browser ready.
        if (aURI == BROWSER_NEW_TAB_URL && !userContextId) {
__L_V__3({
    lN: 2717,tT:'if',pr:'aURI == BROWSER_NEW_TAB_URL && !userContextId',eT:{},fN:''
  });'__L_V__3';
          b = NewTabPagePreloading.getPreloadedBrowser(window);
          if (b) {
__L_V__3({
    lN: 2719,tT:'if',pr:'b',eT:{},fN:''
  });'__L_V__3';
            usingPreloadedContent = true;
          }
        }

        if (!b) {
__L_V__3({
    lN: 2724,tT:'if',pr:'!b',eT:{},fN:''
  });'__L_V__3';
          // No preloaded browser found, create one.
          b = this.createBrowser({
            remoteType,
            uriIsAboutBlank,
            userContextId,
            sameProcessAsFrameLoader,
            openerWindow: opener,
            nextRemoteTabId,
            name,
            skipLoad,
          });
        }

        t.linkedBrowser = b;

        if (focusUrlBar) {
__L_V__3({
    lN: 2740,tT:'if',pr:'focusUrlBar',eT:{},fN:''
  });'__L_V__3';
          b._urlbarFocused = true;
        }

        this._tabForBrowser.set(b, t);
        t.permanentKey = b.permanentKey;
        t._browserParams = {
          uriIsAboutBlank,
          remoteType,
          usingPreloadedContent,
        };

        // If the caller opts in, create a lazy browser.
        if (createLazyBrowser) {
__L_V__3({
    lN: 2753,tT:'if',pr:'createLazyBrowser',eT:{},fN:''
  });'__L_V__3';
          this._createLazyBrowser(t);

          if (lazyBrowserURI) {
__L_V__3({
    lN: 2756,tT:'if',pr:'lazyBrowserURI',eT:{},fN:''
  });'__L_V__3';
            // Lazy browser must be explicitly registered so tab will appear as
            // a switch-to-tab candidate in autocomplete.
            this.UrlbarProviderOpenTabs.registerOpenTab(
              lazyBrowserURI.spec,
              userContextId
            );
            b.registeredOpenURI = lazyBrowserURI;
          }
          SessionStore.setTabState(t, {
            entries: [
              {
                url: lazyBrowserURI ? lazyBrowserURI.spec : "about:blank",
                title: lazyTabTitle,
                triggeringPrincipal_base64: E10SUtils.serializePrincipal(
                  triggeringPrincipal
                ),
              },
            ],
          });
        } else {
          this._insertBrowser(t, true);
        }
      } catch (e) {
        Cu.reportError("Failed to create tab");
        Cu.reportError(e);
        t.remove();
        if (t.linkedBrowser) {
__L_V__3({
    lN: 2783,tT:'if',pr:'t.linkedBrowser',eT:{},fN:''
  });'__L_V__3';
          this._tabFilters.delete(t);
          this._tabListeners.delete(t);
          this.getPanel(t.linkedBrowser).remove();
        }
        throw e;
      }

      // Hack to ensure that the about:newtab, and about:welcome favicon is loaded
      // instantaneously, to avoid flickering and improve perceived performance.
      this.setDefaultIcon(t, aURIObject);

      if (!batchInsertingTabs) {
__L_V__3({
    lN: 2795,tT:'if',pr:'!batchInsertingTabs',eT:{},fN:''
  });'__L_V__3';
        // Fire a TabOpen event
        this._fireTabOpen(t, eventDetail);

        if (
          !usingPreloadedContent &&
          originPrincipal &&
          originStoragePrincipal &&
          aURI
        ) {
__L_V__3({
    lN: 2804,tT:'if',pr:' !usingPreloadedContent && originPrincipal && originStoragePrincipal && aURI ',eT:{},fN:''
  });'__L_V__3';
          let { URI_INHERITS_SECURITY_CONTEXT } = Ci.nsIProtocolHandler;
          // Unless we know for sure we're not inheriting principals,
          // force the about:blank viewer to have the right principal:
          if (
            !aURIObject ||
            doGetProtocolFlags(aURIObject) & URI_INHERITS_SECURITY_CONTEXT
          ) {
__L_V__3({
    lN: 2811,tT:'if',pr:' !aURIObject || doGetProtocolFlags(aURIObject) & URI_INHERITS_SECURITY_CONTEXT ',eT:{},fN:''
  });'__L_V__3';
            b.createAboutBlankContentViewer(
              originPrincipal,
              originStoragePrincipal
            );
          }
        }

        // If we didn't swap docShells with a preloaded browser
        // then let's just continue loading the page normally.
        if (
          !usingPreloadedContent &&
          (!uriIsAboutBlank || !allowInheritPrincipal) &&
          !skipLoad
        ) {
__L_V__3({
    lN: 2825,tT:'if',pr:' !usingPreloadedContent && (!uriIsAboutBlank || !allowInheritPrincipal) && !skipLoad ',eT:{},fN:''
  });'__L_V__3';
          // pretend the user typed this so it'll be available till
          // the document successfully loads
          if (aURI && !gInitialPages.includes(aURI)) {
__L_V__3({
    lN: 2828,tT:'if',pr:'aURI && !gInitialPages.includes(aURI)',eT:{},fN:''
  });'__L_V__3';
            b.userTypedValue = aURI;
          }

          let flags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
          if (allowThirdPartyFixup) {
__L_V__3({
    lN: 2833,tT:'if',pr:'allowThirdPartyFixup',eT:{},fN:''
  });'__L_V__3';
            flags |= Ci.nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP;
            flags |= Ci.nsIWebNavigation.LOAD_FLAGS_FIXUP_SCHEME_TYPOS;
          }
          if (fromExternal) {
__L_V__3({
    lN: 2837,tT:'if',pr:'fromExternal',eT:{},fN:''
  });'__L_V__3';
            flags |= Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL;
          }
          if (allowMixedContent) {
__L_V__3({
    lN: 2840,tT:'if',pr:'allowMixedContent',eT:{},fN:''
  });'__L_V__3';
            flags |= Ci.nsIWebNavigation.LOAD_FLAGS_ALLOW_MIXED_CONTENT;
          }
          if (!allowInheritPrincipal) {
__L_V__3({
    lN: 2843,tT:'if',pr:'!allowInheritPrincipal',eT:{},fN:''
  });'__L_V__3';
            flags |= Ci.nsIWebNavigation.LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL;
          }
          if (disableTRR) {
__L_V__3({
    lN: 2846,tT:'if',pr:'disableTRR',eT:{},fN:''
  });'__L_V__3';
            flags |= Ci.nsIWebNavigation.LOAD_FLAGS_DISABLE_TRR;
          }
          try {
            b.loadURI(aURI, {
              flags,
              triggeringPrincipal,
              referrerInfo,
              charset,
              postData,
              csp,
            });
          } catch (ex) {
            Cu.reportError(ex);
          }
        }
      }

      // This field is updated regardless if we actually animate
      // since it's important that we keep this count correct in all cases.
      this.tabAnimationsInProgress++;

      if (animate) {
__L_V__3({
    lN: 2868,tT:'if',pr:'animate',eT:{},fN:''
  });'__L_V__3';
        requestAnimationFrame(function() {
          // kick the animation off
          t.setAttribute("fadein", "true");
        });
      }

      // Additionally send pinned tab events
      if (pinned) {
__L_V__3({
    lN: 2876,tT:'if',pr:'pinned',eT:{},fN:''
  });'__L_V__3';
        this._notifyPinnedStatus(t);
      }

      return t;
    },

    addMultipleTabs(restoreTabsLazily, selectTab, aPropertiesTabs) {
__L_V__3({
    lN: 2883,tT:'func',pr:'',eT:{'restoreTabsLazily':restoreTabsLazily,'selectTab':selectTab,'aPropertiesTabs':aPropertiesTabs},fN:'addMultipleTabs'
  });'__L_V__3';
      let tabs = [];
      let tabsFragment = document.createDocumentFragment();
      let tabToSelect = null;
      let hiddenTabs = new Map();
      let shouldUpdateForPinnedTabs = false;

      // We create each tab and browser, but only insert them
      // into a document fragment so that we can insert them all
      // together. This prevents synch reflow for each tab
      // insertion.
      for (var i = 0; i < aPropertiesTabs.length; i++) {
        let tabData = aPropertiesTabs[i];

        let userContextId = tabData.userContextId;
        let select = i == selectTab - 1;
        let tab;
        let tabWasReused = false;

        // Re-use existing selected tab if possible to avoid the overhead of
        // selecting a new tab.
        if (select && this.selectedTab.userContextId == userContextId) {
__L_V__3({
    lN: 2904,tT:'if',pr:'select && this.selectedTab.userContextId == userContextId',eT:{},fN:''
  });'__L_V__3';
          tabWasReused = true;
          tab = this.selectedTab;
          if (!tabData.pinned) {
__L_V__3({
    lN: 2907,tT:'if',pr:'!tabData.pinned',eT:{},fN:''
  });'__L_V__3';
            this.unpinTab(tab);
          } else {
            this.pinTab(tab);
          }
          if (gMultiProcessBrowser && !tab.linkedBrowser.isRemoteBrowser) {
__L_V__3({
    lN: 2912,tT:'if',pr:'gMultiProcessBrowser && !tab.linkedBrowser.isRemoteBrowser',eT:{},fN:''
  });'__L_V__3';
            this.updateBrowserRemoteness(tab.linkedBrowser, {
              remoteType: E10SUtils.DEFAULT_REMOTE_TYPE,
            });
          }
        }

        // Add a new tab if needed.
        if (!tab) {
__L_V__3({
    lN: 2920,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
          let createLazyBrowser =
            restoreTabsLazily && !select && !tabData.pinned;

          let url = "about:blank";
          if (createLazyBrowser && tabData.entries && tabData.entries.length) {
__L_V__3({
    lN: 2925,tT:'if',pr:'createLazyBrowser && tabData.entries && tabData.entries.length',eT:{},fN:''
  });'__L_V__3';
            // Let tabbrowser know the future URI because progress listeners won't
            // get onLocationChange notification before the browser is inserted.
            let activeIndex = (tabData.index || tabData.entries.length) - 1;
            // Ensure the index is in bounds.
            activeIndex = Math.min(activeIndex, tabData.entries.length - 1);
            activeIndex = Math.max(activeIndex, 0);
            url = tabData.entries[activeIndex].url;
          }

          // Setting noInitialLabel is a perf optimization. Rendering tab labels
          // would make resizing the tabs more expensive as we're adding them.
          // Each tab will get its initial label set in restoreTab.
          tab = this.addTrustedTab(url, {
            createLazyBrowser,
            skipAnimation: true,
            allowInheritPrincipal: true,
            noInitialLabel: true,
            userContextId,
            skipBackgroundNotify: true,
            bulkOrderedOpen: true,
            batchInsertingTabs: true,
          });

          if (select) {
__L_V__3({
    lN: 2949,tT:'if',pr:'select',eT:{},fN:''
  });'__L_V__3';
            tabToSelect = tab;
          }
        }

        tabs.push(tab);

        if (tabData.pinned) {
__L_V__3({
    lN: 2956,tT:'if',pr:'tabData.pinned',eT:{},fN:''
  });'__L_V__3';
          // Calling `pinTab` calls `moveTabTo`, which assumes the tab is
          // inserted in the DOM. If the tab is not yet in the DOM,
          // just insert it in the right place from the start.
          if (!tab.parentNode) {
__L_V__3({
    lN: 2960,tT:'if',pr:'!tab.parentNode',eT:{},fN:''
  });'__L_V__3';
            tab._tPos = this._numPinnedTabs;
            this.tabContainer.insertBefore(tab, this.tabs[this._numPinnedTabs]);
            tab.setAttribute("pinned", "true");
            this._invalidateCachedTabs();
            // Then ensure all the tab open/pinning information is sent.
            this._fireTabOpen(tab, {});
            this._notifyPinnedStatus(tab);
            // Once we're done adding all tabs, _updateTabBarForPinnedTabs
            // needs calling:
            shouldUpdateForPinnedTabs = true;
          }
        } else {
          if (tab.hidden) {
__L_V__3({
    lN: 2973,tT:'if',pr:'tab.hidden',eT:{},fN:''
  });'__L_V__3';
            tab.setAttribute("hidden", "true");
            hiddenTabs.set(tab, tabData.extData && tabData.extData.hiddenBy);
          }

          tabsFragment.appendChild(tab);
          if (tabWasReused) {
__L_V__3({
    lN: 2979,tT:'if',pr:'tabWasReused',eT:{},fN:''
  });'__L_V__3';
            this._invalidateCachedTabs();
          }
        }

        tab.initialize();
      }

      // inject the new DOM nodes
      this.tabContainer.appendChild(tabsFragment);

      for (let [tab, hiddenBy] of hiddenTabs) {
        let event = document.createEvent("Events");
        event.initEvent("TabHide", true, false);
        tab.dispatchEvent(event);
        if (hiddenBy) {
__L_V__3({
    lN: 2994,tT:'if',pr:'hiddenBy',eT:{},fN:''
  });'__L_V__3';
          SessionStore.setCustomTabValue(tab, "hiddenBy", hiddenBy);
        }
      }

      this._invalidateCachedTabs();
      if (shouldUpdateForPinnedTabs) {
__L_V__3({
    lN: 3000,tT:'if',pr:'shouldUpdateForPinnedTabs',eT:{},fN:''
  });'__L_V__3';
        this._updateTabBarForPinnedTabs();
      }

      // We need to wait until after all tabs have been appended to the DOM
      // to remove the old selected tab.
      if (tabToSelect) {
__L_V__3({
    lN: 3006,tT:'if',pr:'tabToSelect',eT:{},fN:''
  });'__L_V__3';
        let leftoverTab = this.selectedTab;
        this.selectedTab = tabToSelect;
        this.removeTab(leftoverTab);
      }

      if (tabs.length > 1 || !tabs[0].selected) {
__L_V__3({
    lN: 3012,tT:'if',pr:'tabs.length > 1 || !tabs[0].selected',eT:{},fN:''
  });'__L_V__3';
        this._updateTabsAfterInsert();
        this.tabContainer._setPositionalAttributes();
        TabBarVisibility.update();

        for (let tab of tabs) {
          // If tabToSelect is a tab, we didn't reuse the selected tab.
          if (tabToSelect || !tab.selected) {
__L_V__3({
    lN: 3019,tT:'if',pr:'tabToSelect || !tab.selected',eT:{},fN:''
  });'__L_V__3';
            // Fire a TabOpen event for all unpinned tabs, except reused selected
            // tabs.
            if (!tab.pinned) {
__L_V__3({
    lN: 3022,tT:'if',pr:'!tab.pinned',eT:{},fN:''
  });'__L_V__3';
              this._fireTabOpen(tab, {});
            }

            // Fire a TabBrowserInserted event on all tabs that have a connected,
            // real browser, except for reused selected tabs.
            if (tab.linkedPanel) {
__L_V__3({
    lN: 3028,tT:'if',pr:'tab.linkedPanel',eT:{},fN:''
  });'__L_V__3';
              var evt = new CustomEvent("TabBrowserInserted", {
                bubbles: true,
                detail: { insertedOnTabCreation: true },
              });
              tab.dispatchEvent(evt);
            }
          }
        }
      }

      return tabs;
    },

    moveTabsToStart(contextTab) {
__L_V__3({
    lN: 3042,tT:'func',pr:'',eT:{'contextTab':contextTab},fN:'moveTabsToStart'
  });'__L_V__3';
      let tabs = contextTab.multiselected ? this.selectedTabs : [contextTab];
      // Walk the array in reverse order so the tabs are kept in order.
      for (let i = tabs.length - 1; i >= 0; i--) {
        let tab = tabs[i];
        if (tab._tPos > 0) {
__L_V__3({
    lN: 3047,tT:'if',pr:'tab._tPos > 0',eT:{},fN:''
  });'__L_V__3';
          this.moveTabTo(tab, 0);
        }
      }
    },

    moveTabsToEnd(contextTab) {
__L_V__3({
    lN: 3053,tT:'func',pr:'',eT:{'contextTab':contextTab},fN:'moveTabsToEnd'
  });'__L_V__3';
      let tabs = contextTab.multiselected ? this.selectedTabs : [contextTab];
      for (let tab of tabs) {
        if (tab._tPos < this.tabs.length - 1) {
__L_V__3({
    lN: 3056,tT:'if',pr:'tab._tPos < this.tabs.length - 1',eT:{},fN:''
  });'__L_V__3';
          this.moveTabTo(tab, this.tabs.length - 1);
        }
      }
    },

    warnAboutClosingTabs(tabsToClose, aCloseTabs) {
__L_V__3({
    lN: 3062,tT:'func',pr:'',eT:{'tabsToClose':tabsToClose,'aCloseTabs':aCloseTabs},fN:'warnAboutClosingTabs'
  });'__L_V__3';
      if (tabsToClose <= 1) {
__L_V__3({
    lN: 3063,tT:'if',pr:'tabsToClose <= 1',eT:{},fN:''
  });'__L_V__3';
        return true;
      }

      const pref =
        aCloseTabs == this.closingTabsEnum.ALL
          ? "browser.tabs.warnOnClose"
          : "browser.tabs.warnOnCloseOtherTabs";
      var shouldPrompt = Services.prefs.getBoolPref(pref);
      if (!shouldPrompt) {
__L_V__3({
    lN: 3072,tT:'if',pr:'!shouldPrompt',eT:{},fN:''
  });'__L_V__3';
        return true;
      }

      const maxTabsUndo = Services.prefs.getIntPref(
        "browser.sessionstore.max_tabs_undo"
      );
      if (
        aCloseTabs != this.closingTabsEnum.ALL &&
        tabsToClose <= maxTabsUndo
      ) {
__L_V__3({
    lN: 3082,tT:'if',pr:' aCloseTabs != this.closingTabsEnum.ALL && tabsToClose <= maxTabsUndo ',eT:{},fN:''
  });'__L_V__3';
        return true;
      }

      var ps = Services.prompt;

      // default to true: if it were false, we wouldn't get this far
      var warnOnClose = { value: true };

      // focus the window before prompting.
      // this will raise any minimized window, which will
      // make it obvious which window the prompt is for and will
      // solve the problem of windows "obscuring" the prompt.
      // see bug #350299 for more details
      window.focus();
      let warningMessage = gTabBrowserBundle.GetStringFromName(
        "tabs.closeWarningMultiple"
      );
      warningMessage = PluralForm.get(tabsToClose, warningMessage).replace(
        "#1",
        tabsToClose
      );
      let flags =
        ps.BUTTON_TITLE_IS_STRING * ps.BUTTON_POS_0 +
        ps.BUTTON_TITLE_CANCEL * ps.BUTTON_POS_1;
      let checkboxLabel =
        aCloseTabs == this.closingTabsEnum.ALL
          ? gTabBrowserBundle.GetStringFromName("tabs.closeWarningPromptMe")
          : null;
      var buttonPressed = ps.confirmEx(
        window,
        gTabBrowserBundle.GetStringFromName("tabs.closeTitleTabs"),
        warningMessage,
        flags,
        gTabBrowserBundle.GetStringFromName("tabs.closeButtonMultiple"),
        null,
        null,
        checkboxLabel,
        warnOnClose
      );
      var reallyClose = buttonPressed == 0;

      // don't set the pref unless they press OK and it's false
      if (
        aCloseTabs == this.closingTabsEnum.ALL &&
        reallyClose &&
        !warnOnClose.value
      ) {
__L_V__3({
    lN: 3129,tT:'if',pr:' aCloseTabs == this.closingTabsEnum.ALL && reallyClose && !warnOnClose.value ',eT:{},fN:''
  });'__L_V__3';
        Services.prefs.setBoolPref(pref, false);
      }

      return reallyClose;
    },

    /**
     * This determines where the tab should be inserted within the tabContainer
     */
    _insertTabAtIndex(
      tab,
      { index, ownerTab, openerTab, pinned, bulkOrderedOpen } = {}
    ) {
__L_V__3({
    lN: 3142,tT:'func',pr:'',eT:{'tab':tab,'index':index,'ownerTab':ownerTab,'openerTab':openerTab,'pinned':pinned,'bulkOrderedOpen':bulkOrderedOpen},fN:'_insertTabAtIndex'
  });'__L_V__3';
      // If this new tab is owned by another, assert that relationship
      if (ownerTab) {
__L_V__3({
    lN: 3144,tT:'if',pr:'ownerTab',eT:{},fN:''
  });'__L_V__3';
        tab.owner = ownerTab;
      }

      // Ensure we have an index if one was not provided.
      if (typeof index != "number") {
__L_V__3({
    lN: 3149,tT:'if',pr:'typeof index != number',eT:{},fN:''
  });'__L_V__3';
        // Move the new tab after another tab if needed.
        if (
          !bulkOrderedOpen &&
          ((openerTab &&
            Services.prefs.getBoolPref(
              "browser.tabs.insertRelatedAfterCurrent"
            )) ||
            Services.prefs.getBoolPref("browser.tabs.insertAfterCurrent"))
        ) {
__L_V__3({
    lN: 3158,tT:'if',pr:' !bulkOrderedOpen && ((openerTab && Services.prefs.getBoolPref( browser.tabs.insertRelatedAfterCurrent )) || Services.prefs.getBoolPref(browser.tabs.insertAfterCurrent)) ',eT:{},fN:''
  });'__L_V__3';
          let lastRelatedTab =
            openerTab && this._lastRelatedTabMap.get(openerTab);
          let previousTab = lastRelatedTab || openerTab || this.selectedTab;
          if (previousTab.multiselected) {
__L_V__3({
    lN: 3162,tT:'if',pr:'previousTab.multiselected',eT:{},fN:''
  });'__L_V__3';
            index = this.selectedTabs[this.selectedTabs.length - 1]._tPos + 1;
          } else {
            index = previousTab._tPos + 1;
          }

          if (lastRelatedTab) {
__L_V__3({
    lN: 3168,tT:'if',pr:'lastRelatedTab',eT:{},fN:''
  });'__L_V__3';
            lastRelatedTab.owner = null;
          } else if (openerTab) {
__L_V__3({
    lN: 3170,tT:'if',pr:'openerTab',eT:{},fN:''
  });'__L_V__3';
            tab.owner = openerTab;
          }
          // Always set related map if opener exists.
          if (openerTab) {
__L_V__3({
    lN: 3174,tT:'if',pr:'openerTab',eT:{},fN:''
  });'__L_V__3';
            this._lastRelatedTabMap.set(openerTab, tab);
          }
        } else {
          index = Infinity;
        }
      }
      // Ensure index is within bounds.
      if (pinned) {
__L_V__3({
    lN: 3182,tT:'if',pr:'pinned',eT:{},fN:''
  });'__L_V__3';
        index = Math.max(index, 0);
        index = Math.min(index, this._numPinnedTabs);
      } else {
        index = Math.max(index, this._numPinnedTabs);
        index = Math.min(index, this.tabs.length);
      }

      let tabAfter = this.tabs[index] || null;
      this._invalidateCachedTabs();
      // Prevent a flash of unstyled content by setting up the tab content
      // and inherited attributes before appending it (see Bug 1592054):
      tab.initialize();
      this.tabContainer.insertBefore(tab, tabAfter);
      if (tabAfter) {
__L_V__3({
    lN: 3196,tT:'if',pr:'tabAfter',eT:{},fN:''
  });'__L_V__3';
        this._updateTabsAfterInsert();
      } else {
        tab._tPos = index;
      }

      if (pinned) {
__L_V__3({
    lN: 3202,tT:'if',pr:'pinned',eT:{},fN:''
  });'__L_V__3';
        this._updateTabBarForPinnedTabs();
      }
      this.tabContainer._setPositionalAttributes();

      TabBarVisibility.update();
    },

    /**
     * Dispatch a new tab event. This should be called when things are in a
     * consistent state, such that listeners of this event can again open
     * or close tabs.
     */
    _fireTabOpen(tab, eventDetail) {
__L_V__3({
    lN: 3215,tT:'func',pr:'',eT:{'tab':tab,'eventDetail':eventDetail},fN:'_fireTabOpen'
  });'__L_V__3';
      delete tab.initializingTab;
      let evt = new CustomEvent("TabOpen", {
        bubbles: true,
        detail: eventDetail || {},
      });
      tab.dispatchEvent(evt);
    },

    getTabsToTheEndFrom(aTab) {
__L_V__3({
    lN: 3224,tT:'func',pr:'',eT:{'aTab':aTab},fN:'getTabsToTheEndFrom'
  });'__L_V__3';
      let tabsToEnd = [];
      let tabs = this.visibleTabs;
      for (let i = tabs.length - 1; i >= 0; --i) {
        if (tabs[i] == aTab || tabs[i].pinned) {
__L_V__3({
    lN: 3228,tT:'if',pr:'tabs[i] == aTab || tabs[i].pinned',eT:{},fN:''
  });'__L_V__3';
          break;
        }
        // In a multi-select context, select all unselected tabs
        // starting from the context tab.
        if (aTab.multiselected && tabs[i].multiselected) {
__L_V__3({
    lN: 3233,tT:'if',pr:'aTab.multiselected && tabs[i].multiselected',eT:{},fN:''
  });'__L_V__3';
          continue;
        }
        tabsToEnd.push(tabs[i]);
      }
      return tabsToEnd;
    },

    /**
     * In a multi-select context, the tabs (except pinned tabs) that are located to the
     * right of the rightmost selected tab will be removed.
     */
    removeTabsToTheEndFrom(aTab) {
__L_V__3({
    lN: 3245,tT:'func',pr:'',eT:{'aTab':aTab},fN:'removeTabsToTheEndFrom'
  });'__L_V__3';
      let tabs = this.getTabsToTheEndFrom(aTab);
      if (
        !this.warnAboutClosingTabs(tabs.length, this.closingTabsEnum.TO_END)
      ) {
__L_V__3({
    lN: 3249,tT:'if',pr:' !this.warnAboutClosingTabs(tabs.length, this.closingTabsEnum.TO_END) ',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      this.removeTabs(tabs);
    },

    /**
     * In a multi-select context, all unpinned and unselected tabs are removed.
     * Otherwise all unpinned tabs except aTab are removed.
     */
    removeAllTabsBut(aTab) {
__L_V__3({
    lN: 3260,tT:'func',pr:'',eT:{'aTab':aTab},fN:'removeAllTabsBut'
  });'__L_V__3';
      let tabsToRemove = [];
      if (aTab && aTab.multiselected) {
__L_V__3({
    lN: 3262,tT:'if',pr:'aTab && aTab.multiselected',eT:{},fN:''
  });'__L_V__3';
        tabsToRemove = this.visibleTabs.filter(
          tab => !tab.multiselected && !tab.pinned
        );
      } else {
        tabsToRemove = this.visibleTabs.filter(
          tab => tab != aTab && !tab.pinned
        );
      }

      if (
        !this.warnAboutClosingTabs(
          tabsToRemove.length,
          this.closingTabsEnum.OTHER
        )
      ) {
__L_V__3({
    lN: 3277,tT:'if',pr:' !this.warnAboutClosingTabs( tabsToRemove.length, this.closingTabsEnum.OTHER ) ',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      this.removeTabs(tabsToRemove);
    },

    removeMultiSelectedTabs() {
__L_V__3({
    lN: 3284,tT:'func',pr:'',eT:{},fN:'removeMultiSelectedTabs'
  });'__L_V__3';
      let selectedTabs = this.selectedTabs;
      if (
        !this.warnAboutClosingTabs(
          selectedTabs.length,
          this.closingTabsEnum.MULTI_SELECTED
        )
      ) {
__L_V__3({
    lN: 3291,tT:'if',pr:' !this.warnAboutClosingTabs( selectedTabs.length, this.closingTabsEnum.MULTI_SELECTED ) ',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      this.removeTabs(selectedTabs);
    },

    removeTabs(tabs) {
__L_V__3({
    lN: 3298,tT:'func',pr:'',eT:{'tabs':tabs},fN:'removeTabs'
  });'__L_V__3';
      // When 'closeWindowWithLastTab' pref is enabled, closing all tabs
      // can be considered equivalent to closing the window.
      if (
        this.tabs.length == tabs.length &&
        Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab")
      ) {
__L_V__3({
    lN: 3304,tT:'if',pr:' this.tabs.length == tabs.length && Services.prefs.getBoolPref(browser.tabs.closeWindowWithLastTab) ',eT:{},fN:''
  });'__L_V__3';
        window.closeWindow(true, window.warnAboutClosingWindow);
        return;
      }

      this._clearMultiSelectionLocked = true;

      // Guarantee that _clearMultiSelectionLocked lock gets released.
      try {
        let tabsWithBeforeUnload = [];
        let lastToClose;
        let aParams = { animate: true, prewarmed: true };
        for (let tab of tabs) {
          if (tab.selected) {
__L_V__3({
    lN: 3317,tT:'if',pr:'tab.selected',eT:{},fN:''
  });'__L_V__3';
            lastToClose = tab;
            let toBlurTo = this._findTabToBlurTo(lastToClose, tabs);
            if (toBlurTo) {
__L_V__3({
    lN: 3320,tT:'if',pr:'toBlurTo',eT:{},fN:''
  });'__L_V__3';
              this._getSwitcher().warmupTab(toBlurTo);
            }
          } else if (this._hasBeforeUnload(tab)) {
__L_V__3({
    lN: 3323,tT:'if',pr:'this._hasBeforeUnload(tab)',eT:{},fN:''
  });'__L_V__3';
            tabsWithBeforeUnload.push(tab);
          } else {
            this.removeTab(tab, aParams);
          }
        }
        for (let tab of tabsWithBeforeUnload) {
          this.removeTab(tab, aParams);
        }

        // Avoid changing the selected browser several times by removing it,
        // if appropriate, lastly.
        if (lastToClose) {
__L_V__3({
    lN: 3335,tT:'if',pr:'lastToClose',eT:{},fN:''
  });'__L_V__3';
          this.removeTab(lastToClose, aParams);
        }
      } catch (e) {
        Cu.reportError(e);
      }

      this._clearMultiSelectionLocked = false;
      this.avoidSingleSelectedTab();
    },

    removeCurrentTab(aParams) {
__L_V__3({
    lN: 3346,tT:'func',pr:'',eT:{'aParams':aParams},fN:'removeCurrentTab'
  });'__L_V__3';
      this.removeTab(this.selectedTab, aParams);
    },

    removeTab(
      aTab,
      {
        animate,
        byMouse,
        skipPermitUnload,
        closeWindowWithLastTab,
        prewarmed,
      } = {}
    ) {
__L_V__3({
    lN: 3359,tT:'func',pr:'',eT:{'aTab':aTab,'animate':animate,'byMouse':byMouse,'skipPermitUnload':skipPermitUnload,'closeWindowWithLastTab':closeWindowWithLastTab,'prewarmed':prewarmed},fN:'removeTab'
  });'__L_V__3';
      // Telemetry stopwatches may already be running if removeTab gets
      // called again for an already closing tab.
      if (
        !TelemetryStopwatch.running("FX_TAB_CLOSE_TIME_ANIM_MS", aTab) &&
        !TelemetryStopwatch.running("FX_TAB_CLOSE_TIME_NO_ANIM_MS", aTab)
      ) {
__L_V__3({
    lN: 3365,tT:'if',pr:' !TelemetryStopwatch.running(FX_TAB_CLOSE_TIME_ANIM_MS, aTab) && !TelemetryStopwatch.running(FX_TAB_CLOSE_TIME_NO_ANIM_MS, aTab) ',eT:{},fN:''
  });'__L_V__3';
        // Speculatevely start both stopwatches now. We'll cancel one of
        // the two later depending on whether we're animating.
        TelemetryStopwatch.start("FX_TAB_CLOSE_TIME_ANIM_MS", aTab);
        TelemetryStopwatch.start("FX_TAB_CLOSE_TIME_NO_ANIM_MS", aTab);
      }

      // Handle requests for synchronously removing an already
      // asynchronously closing tab.
      if (!animate && aTab.closing) {
__L_V__3({
    lN: 3374,tT:'if',pr:'!animate && aTab.closing',eT:{},fN:''
  });'__L_V__3';
        this._endRemoveTab(aTab);
        return;
      }

      var isLastTab = this.tabs.length - this._removingTabs.length == 1;
      let windowUtils = window.windowUtils;
      // We have to sample the tab width now, since _beginRemoveTab might
      // end up modifying the DOM in such a way that aTab gets a new
      // frame created for it (for example, by updating the visually selected
      // state).
      let tabWidth = windowUtils.getBoundsWithoutFlushing(aTab).width;

      if (
        !this._beginRemoveTab(aTab, {
          closeWindowFastpath: true,
          skipPermitUnload,
          closeWindowWithLastTab,
          prewarmed,
        })
      ) {
__L_V__3({
    lN: 3394,tT:'if',pr:' !this._beginRemoveTab(aTab, { closeWindowFastpath: true, skipPermitUnload, closeWindowWithLastTab, prewarmed, }) ',eT:{},fN:''
  });'__L_V__3';
        TelemetryStopwatch.cancel("FX_TAB_CLOSE_TIME_ANIM_MS", aTab);
        TelemetryStopwatch.cancel("FX_TAB_CLOSE_TIME_NO_ANIM_MS", aTab);
        return;
      }

      if (!aTab.pinned && !aTab.hidden && aTab._fullyOpen && byMouse) {
__L_V__3({
    lN: 3400,tT:'if',pr:'!aTab.pinned && !aTab.hidden && aTab._fullyOpen && byMouse',eT:{},fN:''
  });'__L_V__3';
        this.tabContainer._lockTabSizing(aTab, tabWidth);
      } else {
        this.tabContainer._unlockTabSizing();
      }

      if (
        !animate /* the caller didn't opt in */ ||
        isLastTab ||
        aTab.pinned ||
        aTab.hidden ||
        this._removingTabs.length >
          3 /* don't want lots of concurrent animations */ ||
        aTab.getAttribute("fadein") !=
          "true" /* fade-in transition hasn't been triggered yet */ ||
        window.getComputedStyle(aTab).maxWidth ==
          "0.1px" /* fade-in transition hasn't moved yet */ ||
        !this.animationsEnabled
      ) {
__L_V__3({
    lN: 3418,tT:'if',pr:' !animate /* the caller didnt opt in */ || isLastTab || aTab.pinned || aTab.hidden || this._removingTabs.length > 3 /* dont want lots of concurrent animations */ || aTab.getAttribute(fadein) != true /* fade-in transition hasnt been triggered yet */ || window.getComputedStyle(aTab).maxWidth == 0.1px /* fade-in transition hasnt moved yet */ || !this.animationsEnabled ',eT:{},fN:''
  });'__L_V__3';
        // We're not animating, so we can cancel the animation stopwatch.
        TelemetryStopwatch.cancel("FX_TAB_CLOSE_TIME_ANIM_MS", aTab);
        this._endRemoveTab(aTab);
        return;
      }

      // We're animating, so we can cancel the non-animation stopwatch.
      TelemetryStopwatch.cancel("FX_TAB_CLOSE_TIME_NO_ANIM_MS", aTab);

      aTab.style.maxWidth = ""; // ensure that fade-out transition happens
      aTab.removeAttribute("fadein");
      aTab.removeAttribute("bursting");

      setTimeout(
        function(tab, tabbrowser) {
__L_V__3({
    lN: 3433,tT:'func',pr:'',eT:{'tab':tab,'tabbrowser':tabbrowser},fN:'function'
  });'__L_V__3';
          if (
            tab.container &&
            window.getComputedStyle(tab).maxWidth == "0.1px"
          ) {
__L_V__3({
    lN: 3437,tT:'if',pr:' tab.container && window.getComputedStyle(tab).maxWidth == 0.1px ',eT:{},fN:''
  });'__L_V__3';
            console.assert(
              false,
              "Giving up waiting for the tab closing animation to finish (bug 608589)"
            );
            tabbrowser._endRemoveTab(tab);
          }
        },
        3000,
        aTab,
        this
      );
    },

    _hasBeforeUnload(aTab) {
__L_V__3({
    lN: 3451,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_hasBeforeUnload'
  });'__L_V__3';
      let browser = aTab.linkedBrowser;
      if (browser.isRemoteBrowser && browser.frameLoader) {
__L_V__3({
    lN: 3453,tT:'if',pr:'browser.isRemoteBrowser && browser.frameLoader',eT:{},fN:''
  });'__L_V__3';
        return PermitUnloader.hasBeforeUnload(browser.frameLoader);
      }
      return false;
    },

    _beginRemoveTab(
      aTab,
      {
        adoptedByTab,
        closeWindowWithLastTab,
        closeWindowFastpath,
        skipPermitUnload,
        prewarmed,
      } = {}
    ) {
__L_V__3({
    lN: 3468,tT:'func',pr:'',eT:{'aTab':aTab,'adoptedByTab':adoptedByTab,'closeWindowWithLastTab':closeWindowWithLastTab,'closeWindowFastpath':closeWindowFastpath,'skipPermitUnload':skipPermitUnload,'prewarmed':prewarmed},fN:'_beginRemoveTab'
  });'__L_V__3';
      if (aTab.closing || this._windowIsClosing) {
__L_V__3({
    lN: 3469,tT:'if',pr:'aTab.closing || this._windowIsClosing',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      var browser = this.getBrowserForTab(aTab);
      if (
        !skipPermitUnload &&
        !adoptedByTab &&
        aTab.linkedPanel &&
        !aTab._pendingPermitUnload &&
        (!browser.isRemoteBrowser || this._hasBeforeUnload(aTab))
      ) {
__L_V__3({
    lN: 3480,tT:'if',pr:' !skipPermitUnload && !adoptedByTab && aTab.linkedPanel && !aTab._pendingPermitUnload && (!browser.isRemoteBrowser || this._hasBeforeUnload(aTab)) ',eT:{},fN:''
  });'__L_V__3';
        if (!prewarmed) {
__L_V__3({
    lN: 3481,tT:'if',pr:'!prewarmed',eT:{},fN:''
  });'__L_V__3';
          let blurTab = this._findTabToBlurTo(aTab);
          if (blurTab) {
__L_V__3({
    lN: 3483,tT:'if',pr:'blurTab',eT:{},fN:''
  });'__L_V__3';
            this.warmupTab(blurTab);
          }
        }

        TelemetryStopwatch.start("FX_TAB_CLOSE_PERMIT_UNLOAD_TIME_MS", aTab);

        // We need to block while calling permitUnload() because it
        // processes the event queue and may lead to another removeTab()
        // call before permitUnload() returns.
        aTab._pendingPermitUnload = true;
        let { permitUnload, timedOut } = browser.permitUnload();
        delete aTab._pendingPermitUnload;

        TelemetryStopwatch.finish("FX_TAB_CLOSE_PERMIT_UNLOAD_TIME_MS", aTab);

        // If we were closed during onbeforeunload, we return false now
        // so we don't (try to) close the same tab again. Of course, we
        // also stop if the unload was cancelled by the user:
        if (aTab.closing || (!timedOut && !permitUnload)) {
__L_V__3({
    lN: 3502,tT:'if',pr:'aTab.closing || (!timedOut && !permitUnload)',eT:{},fN:''
  });'__L_V__3';
          return false;
        }
      }

      // this._switcher would normally cover removing a tab from this
      // cache, but we may not have one at this time.
      let tabCacheIndex = this._tabLayerCache.indexOf(aTab);
      if (tabCacheIndex != -1) {
__L_V__3({
    lN: 3510,tT:'if',pr:'tabCacheIndex != -1',eT:{},fN:''
  });'__L_V__3';
        this._tabLayerCache.splice(tabCacheIndex, 1);
      }

      this._blurTab(aTab);

      var closeWindow = false;
      var newTab = false;
      if (this.tabs.length - this._removingTabs.length == 1) {
__L_V__3({
    lN: 3518,tT:'if',pr:'this.tabs.length - this._removingTabs.length == 1',eT:{},fN:''
  });'__L_V__3';
        closeWindow =
          closeWindowWithLastTab != null
            ? closeWindowWithLastTab
            : !window.toolbar.visible ||
              Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab");

        if (closeWindow) {
__L_V__3({
    lN: 3525,tT:'if',pr:'closeWindow',eT:{},fN:''
  });'__L_V__3';
          // We've already called beforeunload on all the relevant tabs if we get here,
          // so avoid calling it again:
          window.skipNextCanClose = true;
        }

        // Closing the tab and replacing it with a blank one is notably slower
        // than closing the window right away. If the caller opts in, take
        // the fast path.
        if (closeWindow && closeWindowFastpath && !this._removingTabs.length) {
__L_V__3({
    lN: 3534,tT:'if',pr:'closeWindow && closeWindowFastpath && !this._removingTabs.length',eT:{},fN:''
  });'__L_V__3';
          // This call actually closes the window, unless the user
          // cancels the operation.  We are finished here in both cases.
          this._windowIsClosing = window.closeWindow(
            true,
            window.warnAboutClosingWindow
          );
          return false;
        }

        newTab = true;
      }
      aTab._endRemoveArgs = [closeWindow, newTab];

      // swapBrowsersAndCloseOther will take care of closing the window without animation.
      if (closeWindow && adoptedByTab) {
__L_V__3({
    lN: 3549,tT:'if',pr:'closeWindow && adoptedByTab',eT:{},fN:''
  });'__L_V__3';
        // Remove the tab's filter and progress listener to avoid leaking.
        if (aTab.linkedPanel) {
__L_V__3({
    lN: 3551,tT:'if',pr:'aTab.linkedPanel',eT:{},fN:''
  });'__L_V__3';
          const filter = this._tabFilters.get(aTab);
          browser.webProgress.removeProgressListener(filter);
          const listener = this._tabListeners.get(aTab);
          filter.removeProgressListener(listener);
          listener.destroy();
          this._tabListeners.delete(aTab);
          this._tabFilters.delete(aTab);
        }
        return true;
      }

      if (!aTab._fullyOpen) {
__L_V__3({
    lN: 3563,tT:'if',pr:'!aTab._fullyOpen',eT:{},fN:''
  });'__L_V__3';
        // If the opening tab animation hasn't finished before we start closing the
        // tab, decrement the animation count since _handleNewTab will not get called.
        this.tabAnimationsInProgress--;
      }

      this.tabAnimationsInProgress++;

      // Mute audio immediately to improve perceived speed of tab closure.
      if (!adoptedByTab && aTab.hasAttribute("soundplaying")) {
__L_V__3({
    lN: 3572,tT:'if',pr:'!adoptedByTab && aTab.hasAttribute(soundplaying)',eT:{},fN:''
  });'__L_V__3';
        // Don't persist the muted state as this wasn't a user action.
        // This lets undo-close-tab return it to an unmuted state.
        aTab.linkedBrowser.mute(true);
      }

      aTab.closing = true;
      this._removingTabs.push(aTab);
      this._invalidateCachedTabs();

      // Invalidate hovered tab state tracking for this closing tab.
      if (this.tabContainer._hoveredTab == aTab) {
__L_V__3({
    lN: 3583,tT:'if',pr:'this.tabContainer._hoveredTab == aTab',eT:{},fN:''
  });'__L_V__3';
        aTab._mouseleave();
      }

      if (newTab) {
__L_V__3({
    lN: 3587,tT:'if',pr:'newTab',eT:{},fN:''
  });'__L_V__3';
        this.addTrustedTab(BROWSER_NEW_TAB_URL, {
          skipAnimation: true,
        });
      } else {
        TabBarVisibility.update();
      }

      // Splice this tab out of any lines of succession before any events are
      // dispatched.
      this.replaceInSuccession(aTab, aTab.successor);
      this.setSuccessor(aTab, null);

      // We're committed to closing the tab now.
      // Dispatch a notification.
      // We dispatch it before any teardown so that event listeners can
      // inspect the tab that's about to close.
      let evt = new CustomEvent("TabClose", {
        bubbles: true,
        detail: { adoptedBy: adoptedByTab },
      });
      aTab.dispatchEvent(evt);

      if (this.tabs.length == 2) {
__L_V__3({
    lN: 3610,tT:'if',pr:'this.tabs.length == 2',eT:{},fN:''
  });'__L_V__3';
        // We're closing one of our two open tabs, inform the other tab that its
        // sibling is going away.
        this.tabs[0].linkedBrowser.sendMessageToActor(
          "Browser:HasSiblings",
          false,
          "BrowserTab"
        );
        this.tabs[1].linkedBrowser.sendMessageToActor(
          "Browser:HasSiblings",
          false,
          "BrowserTab"
        );
      }

      if (aTab.linkedPanel) {
__L_V__3({
    lN: 3625,tT:'if',pr:'aTab.linkedPanel',eT:{},fN:''
  });'__L_V__3';
        if (!adoptedByTab && !gMultiProcessBrowser) {
__L_V__3({
    lN: 3626,tT:'if',pr:'!adoptedByTab && !gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
          // Prevent this tab from showing further dialogs, since we're closing it
          browser.contentWindow.windowUtils.disableDialogs();
        }

        // Remove the tab's filter and progress listener.
        const filter = this._tabFilters.get(aTab);

        browser.webProgress.removeProgressListener(filter);

        const listener = this._tabListeners.get(aTab);
        filter.removeProgressListener(listener);
        listener.destroy();
      }

      if (browser.registeredOpenURI && !adoptedByTab) {
__L_V__3({
    lN: 3641,tT:'if',pr:'browser.registeredOpenURI && !adoptedByTab',eT:{},fN:''
  });'__L_V__3';
        let userContextId = browser.getAttribute("usercontextid") || 0;
        this.UrlbarProviderOpenTabs.unregisterOpenTab(
          browser.registeredOpenURI.spec,
          userContextId
        );
        delete browser.registeredOpenURI;
      }

      // We are no longer the primary content area.
      browser.removeAttribute("primary");

      // Remove this tab as the owner of any other tabs, since it's going away.
      for (let tab of this.tabs) {
        if ("owner" in tab && tab.owner == aTab) {
__L_V__3({
    lN: 3655,tT:'if',pr:'owner in tab && tab.owner == aTab',eT:{},fN:''
  });'__L_V__3';
          // |tab| is a child of the tab we're removing, make it an orphan
          tab.owner = null;
        }
      }

      return true;
    },

    _endRemoveTab(aTab) {
__L_V__3({
    lN: 3664,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_endRemoveTab'
  });'__L_V__3';
      if (!aTab || !aTab._endRemoveArgs) {
__L_V__3({
    lN: 3665,tT:'if',pr:'!aTab || !aTab._endRemoveArgs',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      var [aCloseWindow, aNewTab] = aTab._endRemoveArgs;
      aTab._endRemoveArgs = null;

      if (this._windowIsClosing) {
__L_V__3({
    lN: 3672,tT:'if',pr:'this._windowIsClosing',eT:{},fN:''
  });'__L_V__3';
        aCloseWindow = false;
        aNewTab = false;
      }

      this.tabAnimationsInProgress--;

      this._lastRelatedTabMap = new WeakMap();

      // update the UI early for responsiveness
      aTab.collapsed = true;
      this._blurTab(aTab);

      this._removingTabs.splice(this._removingTabs.indexOf(aTab), 1);

      if (aCloseWindow) {
__L_V__3({
    lN: 3687,tT:'if',pr:'aCloseWindow',eT:{},fN:''
  });'__L_V__3';
        this._windowIsClosing = true;
        while (this._removingTabs.length) {
          this._endRemoveTab(this._removingTabs[0]);
        }
      } else if (!this._windowIsClosing) {
__L_V__3({
    lN: 3692,tT:'if',pr:'!this._windowIsClosing',eT:{},fN:''
  });'__L_V__3';
        if (aNewTab) {
__L_V__3({
    lN: 3693,tT:'if',pr:'aNewTab',eT:{},fN:''
  });'__L_V__3';
          focusAndSelectUrlBar();
        }

        // workaround for bug 345399
        this.tabContainer.arrowScrollbox._updateScrollButtonsDisabledState();
      }

      // We're going to remove the tab and the browser now.
      this._tabFilters.delete(aTab);
      this._tabListeners.delete(aTab);

      var browser = this.getBrowserForTab(aTab);

      if (aTab.linkedPanel) {
__L_V__3({
    lN: 3707,tT:'if',pr:'aTab.linkedPanel',eT:{},fN:''
  });'__L_V__3';
        this._outerWindowIDBrowserMap.delete(browser.outerWindowID);

        // Because of the fact that we are setting JS properties on
        // the browser elements, and we have code in place
        // to preserve the JS objects for any elements that have
        // JS properties set on them, the browser element won't be
        // destroyed until the document goes away.  So we force a
        // cleanup ourselves.
        // This has to happen before we remove the child since functions
        // like `getBrowserContainer` expect the browser to be parented.
        browser.destroy();
      }

      var wasPinned = aTab.pinned;

      // Remove the tab ...
      aTab.remove();
      this._invalidateCachedTabs();

      // Update hashiddentabs if this tab was hidden.
      if (aTab.hidden) {
__L_V__3({
    lN: 3728,tT:'if',pr:'aTab.hidden',eT:{},fN:''
  });'__L_V__3';
        this.tabContainer._updateHiddenTabsStatus();
      }

      // ... and fix up the _tPos properties immediately.
      for (let i = aTab._tPos; i < this.tabs.length; i++) {
        this.tabs[i]._tPos = i;
      }

      if (!this._windowIsClosing) {
__L_V__3({
    lN: 3737,tT:'if',pr:'!this._windowIsClosing',eT:{},fN:''
  });'__L_V__3';
        if (wasPinned) {
__L_V__3({
    lN: 3738,tT:'if',pr:'wasPinned',eT:{},fN:''
  });'__L_V__3';
          this.tabContainer._positionPinnedTabs();
        }

        // update tab close buttons state
        this.tabContainer._updateCloseButtons();

        setTimeout(
          function(tabs) {
__L_V__3({
    lN: 3746,tT:'func',pr:'',eT:{'tabs':tabs},fN:'function'
  });'__L_V__3';
            tabs._lastTabClosedByMouse = false;
          },
          0,
          this.tabContainer
        );
      }

      // update tab positional properties and attributes
      this.selectedTab._selected = true;
      this.tabContainer._setPositionalAttributes();

      // Removing the panel requires fixing up selectedPanel immediately
      // (see below), which would be hindered by the potentially expensive
      // browser removal. So we remove the browser and the panel in two
      // steps.

      var panel = this.getPanel(browser);

      // In the multi-process case, it's possible an asynchronous tab switch
      // is still underway. If so, then it's possible that the last visible
      // browser is the one we're in the process of removing. There's the
      // risk of displaying preloaded browsers that are at the end of the
      // deck if we remove the browser before the switch is complete, so
      // we alert the switcher in order to show a spinner instead.
      if (this._switcher) {
__L_V__3({
    lN: 3771,tT:'if',pr:'this._switcher',eT:{},fN:''
  });'__L_V__3';
        this._switcher.onTabRemoved(aTab);
      }

      // This will unload the document. An unload handler could remove
      // dependant tabs, so it's important that the tabbrowser is now in
      // a consistent state (tab removed, tab positions updated, etc.).
      browser.remove();

      // Release the browser in case something is erroneously holding a
      // reference to the tab after its removal.
      this._tabForBrowser.delete(aTab.linkedBrowser);
      aTab.linkedBrowser = null;

      panel.remove();

      // closeWindow might wait an arbitrary length of time if we're supposed
      // to warn about closing the window, so we'll just stop the tab close
      // stopwatches here instead.
      TelemetryStopwatch.finish(
        "FX_TAB_CLOSE_TIME_ANIM_MS",
        aTab,
        true /* aCanceledOkay */
      );
      TelemetryStopwatch.finish(
        "FX_TAB_CLOSE_TIME_NO_ANIM_MS",
        aTab,
        true /* aCanceledOkay */
      );

      if (aCloseWindow) {
__L_V__3({
    lN: 3801,tT:'if',pr:'aCloseWindow',eT:{},fN:''
  });'__L_V__3';
        this._windowIsClosing = closeWindow(
          true,
          window.warnAboutClosingWindow
        );
      }
    },

    /**
     * Finds the tab that we will blur to if we blur aTab.
     * @param   aTab
     *          The tab we would blur
     * @param   aExcludeTabs
     *          Tabs to exclude from our search (i.e., because they are being
     *          closed along with aTab)
     */
    _findTabToBlurTo(aTab, aExcludeTabs = []) {
__L_V__3({
    lN: 3817,tT:'func',pr:'',eT:{'aTab':aTab,'aExcludeTabs':aExcludeTabs},fN:'_findTabToBlurTo'
  });'__L_V__3';
      if (!aTab.selected) {
__L_V__3({
    lN: 3818,tT:'if',pr:'!aTab.selected',eT:{},fN:''
  });'__L_V__3';
        return null;
      }

      let excludeTabs = new Set(aExcludeTabs);

      // If this tab has a successor, it should be selectable, since
      // hiding or closing a tab removes that tab as a successor.
      if (aTab.successor && !excludeTabs.has(aTab.successor)) {
__L_V__3({
    lN: 3826,tT:'if',pr:'aTab.successor && !excludeTabs.has(aTab.successor)',eT:{},fN:''
  });'__L_V__3';
        return aTab.successor;
      }

      if (
        aTab.owner &&
        !aTab.owner.hidden &&
        !aTab.owner.closing &&
        !excludeTabs.has(aTab.owner) &&
        Services.prefs.getBoolPref("browser.tabs.selectOwnerOnClose")
      ) {
__L_V__3({
    lN: 3836,tT:'if',pr:' aTab.owner && !aTab.owner.hidden && !aTab.owner.closing && !excludeTabs.has(aTab.owner) && Services.prefs.getBoolPref(browser.tabs.selectOwnerOnClose) ',eT:{},fN:''
  });'__L_V__3';
        return aTab.owner;
      }

      // Switch to a visible tab unless there aren't any others remaining
      let remainingTabs = this.visibleTabs;
      let numTabs = remainingTabs.length;
      if (numTabs == 0 || (numTabs == 1 && remainingTabs[0] == aTab)) {
__L_V__3({
    lN: 3843,tT:'if',pr:'numTabs == 0 || (numTabs == 1 && remainingTabs[0] == aTab)',eT:{},fN:''
  });'__L_V__3';
        remainingTabs = Array.prototype.filter.call(
          this.tabs,
          tab => !tab.closing && !excludeTabs.has(tab)
        );
      }

      // Try to find a remaining tab that comes after the given tab
      let tab = this.tabContainer.findNextTab(aTab, {
        direction: 1,
        filter: _tab => remainingTabs.includes(_tab),
      });

      if (!tab) {
__L_V__3({
    lN: 3856,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
        tab = this.tabContainer.findNextTab(aTab, {
          direction: -1,
          filter: _tab => remainingTabs.includes(_tab),
        });
      }

      return tab;
    },

    _blurTab(aTab) {
__L_V__3({
    lN: 3866,tT:'func',pr:'',eT:{'aTab':aTab},fN:'_blurTab'
  });'__L_V__3';
      this.selectedTab = this._findTabToBlurTo(aTab);
    },

    /**
     * @returns {boolean}
     *   False if swapping isn't permitted, true otherwise.
     */
    swapBrowsersAndCloseOther(aOurTab, aOtherTab) {
__L_V__3({
    lN: 3874,tT:'func',pr:'',eT:{'aOurTab':aOurTab,'aOtherTab':aOtherTab},fN:'swapBrowsersAndCloseOther'
  });'__L_V__3';
      // Do not allow transfering a private tab to a non-private window
      // and vice versa.
      if (
        PrivateBrowsingUtils.isWindowPrivate(window) !=
        PrivateBrowsingUtils.isWindowPrivate(aOtherTab.ownerGlobal)
      ) {
__L_V__3({
    lN: 3880,tT:'if',pr:' PrivateBrowsingUtils.isWindowPrivate(window) != PrivateBrowsingUtils.isWindowPrivate(aOtherTab.ownerGlobal) ',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      // Do not allow transfering a useRemoteSubframes tab to a
      // non-useRemoteSubframes window and vice versa.
      if (gFissionBrowser != aOtherTab.ownerGlobal.gFissionBrowser) {
__L_V__3({
    lN: 3886,tT:'if',pr:'gFissionBrowser != aOtherTab.ownerGlobal.gFissionBrowser',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      let ourBrowser = this.getBrowserForTab(aOurTab);
      let otherBrowser = aOtherTab.linkedBrowser;

      // Can't swap between chrome and content processes.
      if (ourBrowser.isRemoteBrowser != otherBrowser.isRemoteBrowser) {
__L_V__3({
    lN: 3894,tT:'if',pr:'ourBrowser.isRemoteBrowser != otherBrowser.isRemoteBrowser',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      // Keep the userContextId if set on other browser
      if (otherBrowser.hasAttribute("usercontextid")) {
__L_V__3({
    lN: 3899,tT:'if',pr:'otherBrowser.hasAttribute(usercontextid)',eT:{},fN:''
  });'__L_V__3';
        ourBrowser.setAttribute(
          "usercontextid",
          otherBrowser.getAttribute("usercontextid")
        );
      }

      // That's gBrowser for the other window, not the tab's browser!
      var remoteBrowser = aOtherTab.ownerGlobal.gBrowser;
      var isPending = aOtherTab.hasAttribute("pending");

      let otherTabListener = remoteBrowser._tabListeners.get(aOtherTab);
      let stateFlags = 0;
      if (otherTabListener) {
__L_V__3({
    lN: 3912,tT:'if',pr:'otherTabListener',eT:{},fN:''
  });'__L_V__3';
        stateFlags = otherTabListener.mStateFlags;
      }

      // Expedite the removal of the icon if it was already scheduled.
      if (aOtherTab._soundPlayingAttrRemovalTimer) {
__L_V__3({
    lN: 3917,tT:'if',pr:'aOtherTab._soundPlayingAttrRemovalTimer',eT:{},fN:''
  });'__L_V__3';
        clearTimeout(aOtherTab._soundPlayingAttrRemovalTimer);
        aOtherTab._soundPlayingAttrRemovalTimer = 0;
        aOtherTab.removeAttribute("soundplaying");
        remoteBrowser._tabAttrModified(aOtherTab, ["soundplaying"]);
      }

      // First, start teardown of the other browser.  Make sure to not
      // fire the beforeunload event in the process.  Close the other
      // window if this was its last tab.
      if (
        !remoteBrowser._beginRemoveTab(aOtherTab, {
          adoptedByTab: aOurTab,
          closeWindowWithLastTab: true,
        })
      ) {
__L_V__3({
    lN: 3932,tT:'if',pr:' !remoteBrowser._beginRemoveTab(aOtherTab, { adoptedByTab: aOurTab, closeWindowWithLastTab: true, }) ',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      // If this is the last tab of the window, hide the window
      // immediately without animation before the docshell swap, to avoid
      // about:blank being painted.
      let [closeWindow] = aOtherTab._endRemoveArgs;
      if (closeWindow) {
__L_V__3({
    lN: 3940,tT:'if',pr:'closeWindow',eT:{},fN:''
  });'__L_V__3';
        let win = aOtherTab.ownerGlobal;
        win.windowUtils.suppressAnimation(true);
        // Only suppressing window animations isn't enough to avoid
        // an empty content area being painted.
        let baseWin = win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
        baseWin.visibility = false;
      }

      let modifiedAttrs = [];
      if (aOtherTab.hasAttribute("muted")) {
__L_V__3({
    lN: 3950,tT:'if',pr:'aOtherTab.hasAttribute(muted)',eT:{},fN:''
  });'__L_V__3';
        aOurTab.setAttribute("muted", "true");
        aOurTab.muteReason = aOtherTab.muteReason;
        ourBrowser.mute();
        modifiedAttrs.push("muted");
      }
      if (aOtherTab.hasAttribute("soundplaying")) {
__L_V__3({
    lN: 3956,tT:'if',pr:'aOtherTab.hasAttribute(soundplaying)',eT:{},fN:''
  });'__L_V__3';
        aOurTab.setAttribute("soundplaying", "true");
        modifiedAttrs.push("soundplaying");
      }
      if (aOtherTab.hasAttribute("usercontextid")) {
__L_V__3({
    lN: 3960,tT:'if',pr:'aOtherTab.hasAttribute(usercontextid)',eT:{},fN:''
  });'__L_V__3';
        aOurTab.setUserContextId(aOtherTab.getAttribute("usercontextid"));
        modifiedAttrs.push("usercontextid");
      }
      if (aOtherTab.hasAttribute("sharing")) {
__L_V__3({
    lN: 3964,tT:'if',pr:'aOtherTab.hasAttribute(sharing)',eT:{},fN:''
  });'__L_V__3';
        aOurTab.setAttribute("sharing", aOtherTab.getAttribute("sharing"));
        modifiedAttrs.push("sharing");
        aOurTab._sharingState = aOtherTab._sharingState;
        webrtcUI.swapBrowserForNotification(otherBrowser, ourBrowser);
      }

      SitePermissions.copyTemporaryPermissions(otherBrowser, ourBrowser);

      // If the other tab is pending (i.e. has not been restored, yet)
      // then do not switch docShells but retrieve the other tab's state
      // and apply it to our tab.
      if (isPending) {
__L_V__3({
    lN: 3976,tT:'if',pr:'isPending',eT:{},fN:''
  });'__L_V__3';
        SessionStore.setTabState(aOurTab, SessionStore.getTabState(aOtherTab));

        // Make sure to unregister any open URIs.
        this._swapRegisteredOpenURIs(ourBrowser, otherBrowser);
      } else {
        // Workarounds for bug 458697
        // Icon might have been set on DOMLinkAdded, don't override that.
        if (!ourBrowser.mIconURL && otherBrowser.mIconURL) {
__L_V__3({
    lN: 3984,tT:'if',pr:'!ourBrowser.mIconURL && otherBrowser.mIconURL',eT:{},fN:''
  });'__L_V__3';
          this.setIcon(aOurTab, otherBrowser.mIconURL);
        }
        var isBusy = aOtherTab.hasAttribute("busy");
        if (isBusy) {
__L_V__3({
    lN: 3988,tT:'if',pr:'isBusy',eT:{},fN:''
  });'__L_V__3';
          aOurTab.setAttribute("busy", "true");
          modifiedAttrs.push("busy");
          if (aOurTab.selected) {
__L_V__3({
    lN: 3991,tT:'if',pr:'aOurTab.selected',eT:{},fN:''
  });'__L_V__3';
            this._isBusy = true;
          }
        }

        this._swapBrowserDocShells(aOurTab, otherBrowser, stateFlags);
      }

      // Unregister the previously opened URI
      if (otherBrowser.registeredOpenURI) {
__L_V__3({
    lN: 4000,tT:'if',pr:'otherBrowser.registeredOpenURI',eT:{},fN:''
  });'__L_V__3';
        let userContextId = otherBrowser.getAttribute("usercontextid") || 0;
        this.UrlbarProviderOpenTabs.unregisterOpenTab(
          otherBrowser.registeredOpenURI.spec,
          userContextId
        );
        delete otherBrowser.registeredOpenURI;
      }

      // Handle findbar data (if any)
      let otherFindBar = aOtherTab._findBar;
      if (otherFindBar && otherFindBar.findMode == otherFindBar.FIND_NORMAL) {
__L_V__3({
    lN: 4011,tT:'if',pr:'otherFindBar && otherFindBar.findMode == otherFindBar.FIND_NORMAL',eT:{},fN:''
  });'__L_V__3';
        let oldValue = otherFindBar._findField.value;
        let wasHidden = otherFindBar.hidden;
        let ourFindBarPromise = this.getFindBar(aOurTab);
        ourFindBarPromise.then(ourFindBar => {
          if (!ourFindBar) {
__L_V__3({
    lN: 4016,tT:'if',pr:'!ourFindBar',eT:{},fN:''
  });'__L_V__3';
            return;
          }
          ourFindBar._findField.value = oldValue;
          if (!wasHidden) {
__L_V__3({
    lN: 4020,tT:'if',pr:'!wasHidden',eT:{},fN:''
  });'__L_V__3';
            ourFindBar.onFindCommand();
          }
        });
      }

      // Finish tearing down the tab that's going away.
      if (closeWindow) {
__L_V__3({
    lN: 4027,tT:'if',pr:'closeWindow',eT:{},fN:''
  });'__L_V__3';
        aOtherTab.ownerGlobal.close();
      } else {
        remoteBrowser._endRemoveTab(aOtherTab);
      }

      this.setTabTitle(aOurTab);

      // If the tab was already selected (this happens in the scenario
      // of replaceTabWithWindow), notify onLocationChange, etc.
      if (aOurTab.selected) {
__L_V__3({
    lN: 4037,tT:'if',pr:'aOurTab.selected',eT:{},fN:''
  });'__L_V__3';
        this.updateCurrentBrowser(true);
      }

      if (modifiedAttrs.length) {
__L_V__3({
    lN: 4041,tT:'if',pr:'modifiedAttrs.length',eT:{},fN:''
  });'__L_V__3';
        this._tabAttrModified(aOurTab, modifiedAttrs);
      }

      return true;
    },

    swapBrowsers(aOurTab, aOtherTab) {
__L_V__3({
    lN: 4048,tT:'func',pr:'',eT:{'aOurTab':aOurTab,'aOtherTab':aOtherTab},fN:'swapBrowsers'
  });'__L_V__3';
      let otherBrowser = aOtherTab.linkedBrowser;
      let otherTabBrowser = otherBrowser.getTabBrowser();

      // We aren't closing the other tab so, we also need to swap its tablisteners.
      let filter = otherTabBrowser._tabFilters.get(aOtherTab);
      let tabListener = otherTabBrowser._tabListeners.get(aOtherTab);
      otherBrowser.webProgress.removeProgressListener(filter);
      filter.removeProgressListener(tabListener);

      // Perform the docshell swap through the common mechanism.
      this._swapBrowserDocShells(aOurTab, otherBrowser);

      // Restore the listeners for the swapped in tab.
      tabListener = new otherTabBrowser.ownerGlobal.TabProgressListener(
        aOtherTab,
        otherBrowser,
        false,
        false
      );
      otherTabBrowser._tabListeners.set(aOtherTab, tabListener);

      const notifyAll = Ci.nsIWebProgress.NOTIFY_ALL;
      filter.addProgressListener(tabListener, notifyAll);
      otherBrowser.webProgress.addProgressListener(filter, notifyAll);
    },

    _swapBrowserDocShells(aOurTab, aOtherBrowser, aStateFlags) {
__L_V__3({
    lN: 4075,tT:'func',pr:'',eT:{'aOurTab':aOurTab,'aOtherBrowser':aOtherBrowser,'aStateFlags':aStateFlags},fN:'_swapBrowserDocShells'
  });'__L_V__3';
      // aOurTab's browser needs to be inserted now if it hasn't already.
      this._insertBrowser(aOurTab);

      // Unhook our progress listener
      const filter = this._tabFilters.get(aOurTab);
      let tabListener = this._tabListeners.get(aOurTab);
      let ourBrowser = this.getBrowserForTab(aOurTab);
      ourBrowser.webProgress.removeProgressListener(filter);
      filter.removeProgressListener(tabListener);

      // Make sure to unregister any open URIs.
      this._swapRegisteredOpenURIs(ourBrowser, aOtherBrowser);

      // Unmap old outerWindowIDs.
      this._outerWindowIDBrowserMap.delete(ourBrowser.outerWindowID);
      let remoteBrowser = aOtherBrowser.ownerGlobal.gBrowser;
      if (remoteBrowser) {
__L_V__3({
    lN: 4092,tT:'if',pr:'remoteBrowser',eT:{},fN:''
  });'__L_V__3';
        remoteBrowser._outerWindowIDBrowserMap.delete(
          aOtherBrowser.outerWindowID
        );
      }

      // If switcher is active, it will intercept swap events and
      // react as needed.
      if (!this._switcher) {
__L_V__3({
    lN: 4100,tT:'if',pr:'!this._switcher',eT:{},fN:''
  });'__L_V__3';
        aOtherBrowser.docShellIsActive = this.shouldActivateDocShell(
          ourBrowser
        );
      }

      // Swap the docshells
      ourBrowser.swapDocShells(aOtherBrowser);

      if (ourBrowser.isRemoteBrowser) {
__L_V__3({
    lN: 4109,tT:'if',pr:'ourBrowser.isRemoteBrowser',eT:{},fN:''
  });'__L_V__3';
        // Switch outerWindowIDs for remote browsers.
        let ourOuterWindowID = ourBrowser._outerWindowID;
        ourBrowser._outerWindowID = aOtherBrowser._outerWindowID;
        aOtherBrowser._outerWindowID = ourOuterWindowID;
      }

      // Register new outerWindowIDs.
      this._outerWindowIDBrowserMap.set(ourBrowser.outerWindowID, ourBrowser);
      if (remoteBrowser) {
__L_V__3({
    lN: 4118,tT:'if',pr:'remoteBrowser',eT:{},fN:''
  });'__L_V__3';
        remoteBrowser._outerWindowIDBrowserMap.set(
          aOtherBrowser.outerWindowID,
          aOtherBrowser
        );
      }

      // Swap permanentKey properties.
      let ourPermanentKey = ourBrowser.permanentKey;
      ourBrowser.permanentKey = aOtherBrowser.permanentKey;
      aOtherBrowser.permanentKey = ourPermanentKey;
      aOurTab.permanentKey = ourBrowser.permanentKey;
      if (remoteBrowser) {
__L_V__3({
    lN: 4130,tT:'if',pr:'remoteBrowser',eT:{},fN:''
  });'__L_V__3';
        let otherTab = remoteBrowser.getTabForBrowser(aOtherBrowser);
        if (otherTab) {
__L_V__3({
    lN: 4132,tT:'if',pr:'otherTab',eT:{},fN:''
  });'__L_V__3';
          otherTab.permanentKey = aOtherBrowser.permanentKey;
        }
      }

      // Restore the progress listener
      tabListener = new TabProgressListener(
        aOurTab,
        ourBrowser,
        false,
        false,
        aStateFlags
      );
      this._tabListeners.set(aOurTab, tabListener);

      const notifyAll = Ci.nsIWebProgress.NOTIFY_ALL;
      filter.addProgressListener(tabListener, notifyAll);
      ourBrowser.webProgress.addProgressListener(filter, notifyAll);
    },

    _swapRegisteredOpenURIs(aOurBrowser, aOtherBrowser) {
__L_V__3({
    lN: 4152,tT:'func',pr:'',eT:{'aOurBrowser':aOurBrowser,'aOtherBrowser':aOtherBrowser},fN:'_swapRegisteredOpenURIs'
  });'__L_V__3';
      // Swap the registeredOpenURI properties of the two browsers
      let tmp = aOurBrowser.registeredOpenURI;
      delete aOurBrowser.registeredOpenURI;
      if (aOtherBrowser.registeredOpenURI) {
__L_V__3({
    lN: 4156,tT:'if',pr:'aOtherBrowser.registeredOpenURI',eT:{},fN:''
  });'__L_V__3';
        aOurBrowser.registeredOpenURI = aOtherBrowser.registeredOpenURI;
        delete aOtherBrowser.registeredOpenURI;
      }
      if (tmp) {
__L_V__3({
    lN: 4160,tT:'if',pr:'tmp',eT:{},fN:''
  });'__L_V__3';
        aOtherBrowser.registeredOpenURI = tmp;
      }
    },

    announceWindowCreated(browser, userContextId) {
__L_V__3({
    lN: 4165,tT:'func',pr:'',eT:{'browser':browser,'userContextId':userContextId},fN:'announceWindowCreated'
  });'__L_V__3';
      let tab = this.getTabForBrowser(browser);
      if (tab && userContextId) {
__L_V__3({
    lN: 4167,tT:'if',pr:'tab && userContextId',eT:{},fN:''
  });'__L_V__3';
        ContextualIdentityService.telemetry(userContextId);
        tab.setUserContextId(userContextId);
      }

      // We don't want to update the container icon and identifier if
      // this is not the selected browser.
      if (browser == gBrowser.selectedBrowser) {
__L_V__3({
    lN: 4174,tT:'if',pr:'browser == gBrowser.selectedBrowser',eT:{},fN:''
  });'__L_V__3';
        updateUserContextUIIndicator();
      }
    },

    reloadMultiSelectedTabs() {
__L_V__3({
    lN: 4179,tT:'func',pr:'',eT:{},fN:'reloadMultiSelectedTabs'
  });'__L_V__3';
      this.reloadTabs(this.selectedTabs);
    },

    reloadTabs(tabs) {
__L_V__3({
    lN: 4183,tT:'func',pr:'',eT:{'tabs':tabs},fN:'reloadTabs'
  });'__L_V__3';
      for (let tab of tabs) {
        try {
          this.getBrowserForTab(tab).reload();
        } catch (e) {
          // ignore failure to reload so others will be reloaded
        }
      }
    },

    reloadTab(aTab) {
__L_V__3({
    lN: 4193,tT:'func',pr:'',eT:{'aTab':aTab},fN:'reloadTab'
  });'__L_V__3';
      let browser = this.getBrowserForTab(aTab);
      // Reset temporary permissions on the current tab. This is done here
      // because we only want to reset permissions on user reload.
      SitePermissions.clearTemporaryPermissions(browser);
      // Also reset DOS mitigations for the basic auth prompt on reload.
      delete browser.authPromptAbuseCounter;
      PanelMultiView.hidePopup(gIdentityHandler._identityPopup);
      browser.reload();
    },

    addProgressListener(aListener) {
__L_V__3({
    lN: 4204,tT:'func',pr:'',eT:{'aListener':aListener},fN:'addProgressListener'
  });'__L_V__3';
      if (arguments.length != 1) {
__L_V__3({
    lN: 4205,tT:'if',pr:'arguments.length != 1',eT:{},fN:''
  });'__L_V__3';
        Cu.reportError(
          "gBrowser.addProgressListener was " +
            "called with a second argument, " +
            "which is not supported. See bug " +
            "608628. Call stack: " +
            new Error().stack
        );
      }

      this.mProgressListeners.push(aListener);
    },

    removeProgressListener(aListener) {
__L_V__3({
    lN: 4218,tT:'func',pr:'',eT:{'aListener':aListener},fN:'removeProgressListener'
  });'__L_V__3';
      this.mProgressListeners = this.mProgressListeners.filter(
        l => l != aListener
      );
    },

    addTabsProgressListener(aListener) {
__L_V__3({
    lN: 4224,tT:'func',pr:'',eT:{'aListener':aListener},fN:'addTabsProgressListener'
  });'__L_V__3';
      this.mTabsProgressListeners.push(aListener);
    },

    removeTabsProgressListener(aListener) {
__L_V__3({
    lN: 4228,tT:'func',pr:'',eT:{'aListener':aListener},fN:'removeTabsProgressListener'
  });'__L_V__3';
      this.mTabsProgressListeners = this.mTabsProgressListeners.filter(
        l => l != aListener
      );
    },

    getBrowserForTab(aTab) {
__L_V__3({
    lN: 4234,tT:'func',pr:'',eT:{'aTab':aTab},fN:'getBrowserForTab'
  });'__L_V__3';
      return aTab.linkedBrowser;
    },

    showOnlyTheseTabs(aTabs) {
__L_V__3({
    lN: 4238,tT:'func',pr:'',eT:{'aTabs':aTabs},fN:'showOnlyTheseTabs'
  });'__L_V__3';
      for (let tab of this.tabs) {
        if (!aTabs.includes(tab)) {
__L_V__3({
    lN: 4240,tT:'if',pr:'!aTabs.includes(tab)',eT:{},fN:''
  });'__L_V__3';
          this.hideTab(tab);
        } else {
          this.showTab(tab);
        }
      }

      this.tabContainer._updateHiddenTabsStatus();
      this.tabContainer._handleTabSelect(true);
    },

    showTab(aTab) {
__L_V__3({
    lN: 4251,tT:'func',pr:'',eT:{'aTab':aTab},fN:'showTab'
  });'__L_V__3';
      if (aTab.hidden) {
__L_V__3({
    lN: 4252,tT:'if',pr:'aTab.hidden',eT:{},fN:''
  });'__L_V__3';
        aTab.removeAttribute("hidden");
        this._invalidateCachedTabs();

        this.tabContainer._updateCloseButtons();
        this.tabContainer._updateHiddenTabsStatus();

        this.tabContainer._setPositionalAttributes();

        let event = document.createEvent("Events");
        event.initEvent("TabShow", true, false);
        aTab.dispatchEvent(event);
        SessionStore.deleteCustomTabValue(aTab, "hiddenBy");
      }
    },

    hideTab(aTab, aSource) {
__L_V__3({
    lN: 4268,tT:'func',pr:'',eT:{'aTab':aTab,'aSource':aSource},fN:'hideTab'
  });'__L_V__3';
      if (
        aTab.hidden ||
        aTab.pinned ||
        aTab.selected ||
        aTab.closing ||
        // Tabs that are sharing the screen, microphone or camera cannot be hidden.
        (aTab._sharingState && aTab._sharingState.webRTC)
      ) {
__L_V__3({
    lN: 4276,tT:'if',pr:' aTab.hidden || aTab.pinned || aTab.selected || aTab.closing || // Tabs that are sharing the screen, microphone or camera cannot be hidden. (aTab._sharingState && aTab._sharingState.webRTC) ',eT:{},fN:''
  });'__L_V__3';
        return;
      }
      aTab.setAttribute("hidden", "true");
      this._invalidateCachedTabs();

      this.tabContainer._updateCloseButtons();
      this.tabContainer._updateHiddenTabsStatus();

      this.tabContainer._setPositionalAttributes();

      // Splice this tab out of any lines of succession before any events are
      // dispatched.
      this.replaceInSuccession(aTab, aTab.successor);
      this.setSuccessor(aTab, null);

      let event = document.createEvent("Events");
      event.initEvent("TabHide", true, false);
      aTab.dispatchEvent(event);
      if (aSource) {
__L_V__3({
    lN: 4295,tT:'if',pr:'aSource',eT:{},fN:''
  });'__L_V__3';
        SessionStore.setCustomTabValue(aTab, "hiddenBy", aSource);
      }
    },

    selectTabAtIndex(aIndex, aEvent) {
__L_V__3({
    lN: 4300,tT:'func',pr:'',eT:{'aIndex':aIndex,'aEvent':aEvent},fN:'selectTabAtIndex'
  });'__L_V__3';
      let tabs = this.visibleTabs;

      // count backwards for aIndex < 0
      if (aIndex < 0) {
__L_V__3({
    lN: 4304,tT:'if',pr:'aIndex < 0',eT:{},fN:''
  });'__L_V__3';
        aIndex += tabs.length;
        // clamp at index 0 if still negative.
        if (aIndex < 0) {
__L_V__3({
    lN: 4307,tT:'if',pr:'aIndex < 0',eT:{},fN:''
  });'__L_V__3';
          aIndex = 0;
        }
      } else if (aIndex >= tabs.length) {
__L_V__3({
    lN: 4310,tT:'if',pr:'aIndex >= tabs.length',eT:{},fN:''
  });'__L_V__3';
        // clamp at right-most tab if out of range.
        aIndex = tabs.length - 1;
      }

      this.selectedTab = tabs[aIndex];

      if (aEvent) {
__L_V__3({
    lN: 4317,tT:'if',pr:'aEvent',eT:{},fN:''
  });'__L_V__3';
        aEvent.preventDefault();
        aEvent.stopPropagation();
      }
    },

    /**
     * Moves a tab to a new browser window, unless it's already the only tab
     * in the current window, in which case this will do nothing.
     */
    replaceTabWithWindow(aTab, aOptions) {
__L_V__3({
    lN: 4327,tT:'func',pr:'',eT:{'aTab':aTab,'aOptions':aOptions},fN:'replaceTabWithWindow'
  });'__L_V__3';
      if (this.tabs.length == 1) {
__L_V__3({
    lN: 4328,tT:'if',pr:'this.tabs.length == 1',eT:{},fN:''
  });'__L_V__3';
        return null;
      }

      var options = "chrome,dialog=no,all";
      for (var name in aOptions) {
        options += "," + name + "=" + aOptions[name];
      }

      // Play the tab closing animation to give immediate feedback while
      // waiting for the new window to appear.
      // content area when the docshells are swapped.
      if (this.animationsEnabled) {
__L_V__3({
    lN: 4340,tT:'if',pr:'this.animationsEnabled',eT:{},fN:''
  });'__L_V__3';
        aTab.style.maxWidth = ""; // ensure that fade-out transition happens
        aTab.removeAttribute("fadein");
      }

      // tell a new window to take the "dropped" tab
      return window.openDialog(
        AppConstants.BROWSER_CHROME_URL,
        "_blank",
        options,
        aTab
      );
    },

    /**
     * Move contextTab (or selected tabs in a mutli-select context)
     * to a new browser window, unless it is (they are) already the only tab(s)
     * in the current window, in which case this will do nothing.
     */
    replaceTabsWithWindow(contextTab, aOptions) {
__L_V__3({
    lN: 4359,tT:'func',pr:'',eT:{'contextTab':contextTab,'aOptions':aOptions},fN:'replaceTabsWithWindow'
  });'__L_V__3';
      let tabs;
      if (contextTab.multiselected) {
__L_V__3({
    lN: 4361,tT:'if',pr:'contextTab.multiselected',eT:{},fN:''
  });'__L_V__3';
        tabs = this.selectedTabs;
      } else {
        tabs = [contextTab];
      }

      if (this.tabs.length == tabs.length) {
__L_V__3({
    lN: 4367,tT:'if',pr:'this.tabs.length == tabs.length',eT:{},fN:''
  });'__L_V__3';
        return null;
      }

      if (tabs.length == 1) {
__L_V__3({
    lN: 4371,tT:'if',pr:'tabs.length == 1',eT:{},fN:''
  });'__L_V__3';
        return this.replaceTabWithWindow(tabs[0], aOptions);
      }

      // Play the closing animation for all selected tabs to give
      // immediate feedback while waiting for the new window to appear.
      if (this.animationsEnabled) {
__L_V__3({
    lN: 4377,tT:'if',pr:'this.animationsEnabled',eT:{},fN:''
  });'__L_V__3';
        for (let tab of tabs) {
          tab.style.maxWidth = ""; // ensure that fade-out transition happens
          tab.removeAttribute("fadein");
        }
      }

      // Create a new window and make it adopt the tabs, preserving their relative order.
      // The initial tab of the new window will be selected, so it should adopt the
      // selected tab of the original window, if applicable, or else the first moving tab.
      // This avoids tab-switches in the new window, preserving tab laziness.
      // However, to avoid multiple tab-switches in the original window, the other tabs
      // should be adopted before the selected one.
      let selectedTabIndex = Math.max(0, tabs.indexOf(gBrowser.selectedTab));
      let selectedTab = tabs[selectedTabIndex];
      let win = this.replaceTabWithWindow(selectedTab, aOptions);
      win.addEventListener(
        "before-initial-tab-adopted",
        () => {
          for (let i = 0; i < tabs.length; ++i) {
            if (i != selectedTabIndex) {
__L_V__3({
    lN: 4397,tT:'if',pr:'i != selectedTabIndex',eT:{},fN:''
  });'__L_V__3';
              win.gBrowser.adoptTab(tabs[i], i);
            }
          }
          // Restore tab selection
          let winVisibleTabs = win.gBrowser.visibleTabs;
          let winTabLength = winVisibleTabs.length;
          win.gBrowser.addRangeToMultiSelectedTabs(
            winVisibleTabs[0],
            winVisibleTabs[winTabLength - 1]
          );
          win.gBrowser.lockClearMultiSelectionOnce();
        },
        { once: true }
      );
      return win;
    },

    _updateTabsAfterInsert() {
__L_V__3({
    lN: 4415,tT:'func',pr:'',eT:{},fN:'_updateTabsAfterInsert'
  });'__L_V__3';
      for (let i = 0; i < this.tabs.length; i++) {
        this.tabs[i]._tPos = i;
        this.tabs[i]._selected = false;
      }

      // If we're in the midst of an async tab switch while calling
      // moveTabTo, we can get into a case where _visuallySelected
      // is set to true on two different tabs.
      //
      // What we want to do in moveTabTo is to remove logical selection
      // from all tabs, and then re-add logical selection to selectedTab
      // (and visual selection as well if we're not running with e10s, which
      // setting _selected will do automatically).
      //
      // If we're running with e10s, then the visual selection will not
      // be changed, which is fine, since if we weren't in the midst of a
      // tab switch, the previously visually selected tab should still be
      // correct, and if we are in the midst of a tab switch, then the async
      // tab switcher will set the visually selected tab once the tab switch
      // has completed.
      this.selectedTab._selected = true;
    },

    moveTabTo(aTab, aIndex, aKeepRelatedTabs) {
__L_V__3({
    lN: 4439,tT:'func',pr:'',eT:{'aTab':aTab,'aIndex':aIndex,'aKeepRelatedTabs':aKeepRelatedTabs},fN:'moveTabTo'
  });'__L_V__3';
      var oldPosition = aTab._tPos;
      if (oldPosition == aIndex) {
__L_V__3({
    lN: 4441,tT:'if',pr:'oldPosition == aIndex',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      // Don't allow mixing pinned and unpinned tabs.
      if (aTab.pinned) {
__L_V__3({
    lN: 4446,tT:'if',pr:'aTab.pinned',eT:{},fN:''
  });'__L_V__3';
        aIndex = Math.min(aIndex, this._numPinnedTabs - 1);
      } else {
        aIndex = Math.max(aIndex, this._numPinnedTabs);
      }
      if (oldPosition == aIndex) {
__L_V__3({
    lN: 4451,tT:'if',pr:'oldPosition == aIndex',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      if (!aKeepRelatedTabs) {
__L_V__3({
    lN: 4455,tT:'if',pr:'!aKeepRelatedTabs',eT:{},fN:''
  });'__L_V__3';
        this._lastRelatedTabMap = new WeakMap();
      }

      let wasFocused = document.activeElement == this.selectedTab;

      aIndex = aIndex < aTab._tPos ? aIndex : aIndex + 1;

      let neighbor = this.tabs[aIndex] || null;
      this._invalidateCachedTabs();
      this.tabContainer.insertBefore(aTab, neighbor);
      this._updateTabsAfterInsert();

      if (wasFocused) {
__L_V__3({
    lN: 4468,tT:'if',pr:'wasFocused',eT:{},fN:''
  });'__L_V__3';
        this.selectedTab.focus();
      }

      this.tabContainer._handleTabSelect(true);

      if (aTab.pinned) {
__L_V__3({
    lN: 4474,tT:'if',pr:'aTab.pinned',eT:{},fN:''
  });'__L_V__3';
        this.tabContainer._positionPinnedTabs();
      }

      this.tabContainer._setPositionalAttributes();

      var evt = document.createEvent("UIEvents");
      evt.initUIEvent("TabMove", true, false, window, oldPosition);
      aTab.dispatchEvent(evt);
    },

    moveTabForward() {
__L_V__3({
    lN: 4485,tT:'func',pr:'',eT:{},fN:'moveTabForward'
  });'__L_V__3';
      let nextTab = this.tabContainer.findNextTab(this.selectedTab, {
        direction: 1,
        filter: tab => !tab.hidden,
      });

      if (nextTab) {
__L_V__3({
    lN: 4491,tT:'if',pr:'nextTab',eT:{},fN:''
  });'__L_V__3';
        this.moveTabTo(this.selectedTab, nextTab._tPos);
      } else if (this.arrowKeysShouldWrap) {
__L_V__3({
    lN: 4493,tT:'if',pr:'this.arrowKeysShouldWrap',eT:{},fN:''
  });'__L_V__3';
        this.moveTabToStart();
      }
    },

    /**
     * Adopts a tab from another browser window, and inserts it at aIndex
     *
     * @returns {object}
     *    The new tab in the current window, null if the tab couldn't be adopted.
     */
    adoptTab(aTab, aIndex, aSelectTab) {
__L_V__3({
    lN: 4504,tT:'func',pr:'',eT:{'aTab':aTab,'aIndex':aIndex,'aSelectTab':aSelectTab},fN:'adoptTab'
  });'__L_V__3';
      // Swap the dropped tab with a new one we create and then close
      // it in the other window (making it seem to have moved between
      // windows). We also ensure that the tab we create to swap into has
      // the same remote type and process as the one we're swapping in.
      // This makes sure we don't get a short-lived process for the new tab.
      let linkedBrowser = aTab.linkedBrowser;
      let createLazyBrowser = !aTab.linkedPanel;
      let params = {
        eventDetail: { adoptedTab: aTab },
        preferredRemoteType: linkedBrowser.remoteType,
        sameProcessAsFrameLoader: linkedBrowser.frameLoader,
        skipAnimation: true,
        index: aIndex,
        createLazyBrowser,
        allowInheritPrincipal: createLazyBrowser,
      };

      let numPinned = this._numPinnedTabs;
      if (aIndex < numPinned || (aTab.pinned && aIndex == numPinned)) {
__L_V__3({
    lN: 4523,tT:'if',pr:'aIndex < numPinned || (aTab.pinned && aIndex == numPinned)',eT:{},fN:''
  });'__L_V__3';
        params.pinned = true;
      }

      if (aTab.hasAttribute("usercontextid")) {
__L_V__3({
    lN: 4527,tT:'if',pr:'aTab.hasAttribute(usercontextid)',eT:{},fN:''
  });'__L_V__3';
        // new tab must have the same usercontextid as the old one
        params.userContextId = aTab.getAttribute("usercontextid");
      }
      let newTab = this.addWebTab("about:blank", params);
      let newBrowser = this.getBrowserForTab(newTab);

      aTab.container._finishAnimateTabMove();

      if (!createLazyBrowser) {
__L_V__3({
    lN: 4536,tT:'if',pr:'!createLazyBrowser',eT:{},fN:''
  });'__L_V__3';
        // Stop the about:blank load.
        newBrowser.stop();
        // Make sure it has a docshell.
        newBrowser.docShell;
      }

      if (!this.swapBrowsersAndCloseOther(newTab, aTab)) {
__L_V__3({
    lN: 4543,tT:'if',pr:'!this.swapBrowsersAndCloseOther(newTab, aTab)',eT:{},fN:''
  });'__L_V__3';
        // Swapping wasn't permitted. Bail out.
        this.removeTab(newTab);
        return null;
      }

      if (aSelectTab) {
__L_V__3({
    lN: 4549,tT:'if',pr:'aSelectTab',eT:{},fN:''
  });'__L_V__3';
        this.selectedTab = newTab;
      }

      return newTab;
    },

    moveTabBackward() {
__L_V__3({
    lN: 4556,tT:'func',pr:'',eT:{},fN:'moveTabBackward'
  });'__L_V__3';
      let previousTab = this.tabContainer.findNextTab(this.selectedTab, {
        direction: -1,
        filter: tab => !tab.hidden,
      });

      if (previousTab) {
__L_V__3({
    lN: 4562,tT:'if',pr:'previousTab',eT:{},fN:''
  });'__L_V__3';
        this.moveTabTo(this.selectedTab, previousTab._tPos);
      } else if (this.arrowKeysShouldWrap) {
__L_V__3({
    lN: 4564,tT:'if',pr:'this.arrowKeysShouldWrap',eT:{},fN:''
  });'__L_V__3';
        this.moveTabToEnd();
      }
    },

    moveTabToStart() {
__L_V__3({
    lN: 4569,tT:'func',pr:'',eT:{},fN:'moveTabToStart'
  });'__L_V__3';
      let tabPos = this.selectedTab._tPos;
      if (tabPos > 0) {
__L_V__3({
    lN: 4571,tT:'if',pr:'tabPos > 0',eT:{},fN:''
  });'__L_V__3';
        this.moveTabTo(this.selectedTab, 0);
      }
    },

    moveTabToEnd() {
__L_V__3({
    lN: 4576,tT:'func',pr:'',eT:{},fN:'moveTabToEnd'
  });'__L_V__3';
      let tabPos = this.selectedTab._tPos;
      if (tabPos < this.browsers.length - 1) {
__L_V__3({
    lN: 4578,tT:'if',pr:'tabPos < this.browsers.length - 1',eT:{},fN:''
  });'__L_V__3';
        this.moveTabTo(this.selectedTab, this.browsers.length - 1);
      }
    },

    moveTabOver(aEvent) {
__L_V__3({
    lN: 4583,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'moveTabOver'
  });'__L_V__3';
      if (
        (!RTL_UI && aEvent.keyCode == KeyEvent.DOM_VK_RIGHT) ||
        (RTL_UI && aEvent.keyCode == KeyEvent.DOM_VK_LEFT)
      ) {
__L_V__3({
    lN: 4587,tT:'if',pr:' (!RTL_UI && aEvent.keyCode == KeyEvent.DOM_VK_RIGHT) || (RTL_UI && aEvent.keyCode == KeyEvent.DOM_VK_LEFT) ',eT:{},fN:''
  });'__L_V__3';
        this.moveTabForward();
      } else {
        this.moveTabBackward();
      }
    },

    /**
     * @param   aTab
     *          Can be from a different window as well
     * @param   aRestoreTabImmediately
     *          Can defer loading of the tab contents
     */
    duplicateTab(aTab, aRestoreTabImmediately) {
__L_V__3({
    lN: 4600,tT:'func',pr:'',eT:{'aTab':aTab,'aRestoreTabImmediately':aRestoreTabImmediately},fN:'duplicateTab'
  });'__L_V__3';
      return SessionStore.duplicateTab(window, aTab, 0, aRestoreTabImmediately);
    },

    addToMultiSelectedTabs(aTab, { isLastMultiSelectChange = false } = {}) {
__L_V__3({
    lN: 4604,tT:'func',pr:'',eT:{'aTab':aTab,'isLastMultiSelectChange':isLastMultiSelectChange},fN:'addToMultiSelectedTabs'
  });'__L_V__3';
      if (aTab.multiselected) {
__L_V__3({
    lN: 4605,tT:'if',pr:'aTab.multiselected',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      aTab.setAttribute("multiselected", "true");
      aTab.setAttribute("aria-selected", "true");
      this._multiSelectedTabsSet.add(aTab);
      this._startMultiSelectChange();
      if (this._multiSelectChangeRemovals.has(aTab)) {
__L_V__3({
    lN: 4613,tT:'if',pr:'this._multiSelectChangeRemovals.has(aTab)',eT:{},fN:''
  });'__L_V__3';
        this._multiSelectChangeRemovals.delete(aTab);
      } else {
        this._multiSelectChangeAdditions.add(aTab);
      }

      if (isLastMultiSelectChange) {
__L_V__3({
    lN: 4619,tT:'if',pr:'isLastMultiSelectChange',eT:{},fN:''
  });'__L_V__3';
        let { selectedTab } = this;
        if (!selectedTab.multiselected) {
__L_V__3({
    lN: 4621,tT:'if',pr:'!selectedTab.multiselected',eT:{},fN:''
  });'__L_V__3';
          this.addToMultiSelectedTabs(selectedTab, {
            isLastMultiSelectChange: false,
          });
        }
        this.tabContainer._setPositionalAttributes();
      }
    },

    /**
     * Adds two given tabs and all tabs between them into the (multi) selected tabs collection
     */
    addRangeToMultiSelectedTabs(aTab1, aTab2) {
__L_V__3({
    lN: 4633,tT:'func',pr:'',eT:{'aTab1':aTab1,'aTab2':aTab2},fN:'addRangeToMultiSelectedTabs'
  });'__L_V__3';
      if (aTab1 == aTab2) {
__L_V__3({
    lN: 4634,tT:'if',pr:'aTab1 == aTab2',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      const tabs = this.visibleTabs;
      const indexOfTab1 = tabs.indexOf(aTab1);
      const indexOfTab2 = tabs.indexOf(aTab2);

      const [lowerIndex, higherIndex] =
        indexOfTab1 < indexOfTab2
          ? [indexOfTab1, indexOfTab2]
          : [indexOfTab2, indexOfTab1];

      for (let i = lowerIndex; i <= higherIndex; i++) {
        this.addToMultiSelectedTabs(tabs[i], {
          isLastMultiSelectChange: false,
        });
      }
      this.tabContainer._setPositionalAttributes();
    },

    removeFromMultiSelectedTabs(
      aTab,
      { isLastMultiSelectChange = false } = {}
    ) {
__L_V__3({
    lN: 4658,tT:'func',pr:'',eT:{'aTab':aTab,'isLastMultiSelectChange':isLastMultiSelectChange},fN:'removeFromMultiSelectedTabs'
  });'__L_V__3';
      if (!aTab.multiselected) {
__L_V__3({
    lN: 4659,tT:'if',pr:'!aTab.multiselected',eT:{},fN:''
  });'__L_V__3';
        return;
      }
      aTab.removeAttribute("multiselected");
      aTab.removeAttribute("aria-selected");
      this._multiSelectedTabsSet.delete(aTab);
      this._startMultiSelectChange();
      if (this._multiSelectChangeAdditions.has(aTab)) {
__L_V__3({
    lN: 4666,tT:'if',pr:'this._multiSelectChangeAdditions.has(aTab)',eT:{},fN:''
  });'__L_V__3';
        this._multiSelectChangeAdditions.delete(aTab);
      } else {
        this._multiSelectChangeRemovals.add(aTab);
      }
      if (isLastMultiSelectChange) {
__L_V__3({
    lN: 4671,tT:'if',pr:'isLastMultiSelectChange',eT:{},fN:''
  });'__L_V__3';
        if (aTab.selected) {
__L_V__3({
    lN: 4672,tT:'if',pr:'aTab.selected',eT:{},fN:''
  });'__L_V__3';
          this.switchToNextMultiSelectedTab();
        }
        this.avoidSingleSelectedTab();
        this.tabContainer._setPositionalAttributes();
      }
    },

    clearMultiSelectedTabs({ isLastMultiSelectChange = false } = {}) {
__L_V__3({
    lN: 4680,tT:'func',pr:'',eT:{'isLastMultiSelectChange':isLastMultiSelectChange},fN:'clearMultiSelectedTabs'
  });'__L_V__3';
      if (this._clearMultiSelectionLocked) {
__L_V__3({
    lN: 4681,tT:'if',pr:'this._clearMultiSelectionLocked',eT:{},fN:''
  });'__L_V__3';
        if (this._clearMultiSelectionLockedOnce) {
__L_V__3({
    lN: 4682,tT:'if',pr:'this._clearMultiSelectionLockedOnce',eT:{},fN:''
  });'__L_V__3';
          this._clearMultiSelectionLockedOnce = false;
          this._clearMultiSelectionLocked = false;
        }
        return;
      }

      if (this.multiSelectedTabsCount < 1) {
__L_V__3({
    lN: 4689,tT:'if',pr:'this.multiSelectedTabsCount < 1',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      for (let tab of this.selectedTabs) {
        this.removeFromMultiSelectedTabs(tab, {
          isLastMultiSelectChange: false,
        });
      }
      this._lastMultiSelectedTabRef = null;
      if (isLastMultiSelectChange) {
__L_V__3({
    lN: 4699,tT:'if',pr:'isLastMultiSelectChange',eT:{},fN:''
  });'__L_V__3';
        this.tabContainer._setPositionalAttributes();
      }
    },

    selectAllTabs() {
__L_V__3({
    lN: 4704,tT:'func',pr:'',eT:{},fN:'selectAllTabs'
  });'__L_V__3';
      let visibleTabs = this.visibleTabs;
      gBrowser.addRangeToMultiSelectedTabs(
        visibleTabs[0],
        visibleTabs[visibleTabs.length - 1]
      );
    },

    allTabsSelected() {
__L_V__3({
    lN: 4712,tT:'func',pr:'',eT:{},fN:'allTabsSelected'
  });'__L_V__3';
      return (
        this.visibleTabs.length == 1 ||
        this.visibleTabs.every(t => t.multiselected)
      );
    },

    lockClearMultiSelectionOnce() {
__L_V__3({
    lN: 4719,tT:'func',pr:'',eT:{},fN:'lockClearMultiSelectionOnce'
  });'__L_V__3';
      this._clearMultiSelectionLockedOnce = true;
      this._clearMultiSelectionLocked = true;
    },

    unlockClearMultiSelection() {
__L_V__3({
    lN: 4724,tT:'func',pr:'',eT:{},fN:'unlockClearMultiSelection'
  });'__L_V__3';
      this._clearMultiSelectionLockedOnce = false;
      this._clearMultiSelectionLocked = false;
    },

    /**
     * Remove a tab from the multiselection if it's the only one left there.
     *
     * In fact, some scenario may lead to only one single tab multi-selected,
     * this is something to avoid (Chrome does the same)
     * Consider 4 tabs A,B,C,D with A having the focus
     * 1. select C with Ctrl
     * 2. Right-click on B and "Close Tabs to The Right"
     *
     * Expected result
     * C and D closing
     * A being the only multi-selected tab, selection should be cleared
     *
     *
     * Single selected tab could even happen with a none-focused tab.
     * For exemple with the menu "Close other tabs", it could happen
     * with a multi-selected pinned tab.
     * For illustration, consider 4 tabs A,B,C,D with B active
     * 1. pin A and Ctrl-select it
     * 2. Ctrl-select C
     * 3. right-click on D and click "Close Other Tabs"
     *
     * Expected result
     * B and C closing
     * A[pinned] being the only multi-selected tab, selection should be cleared.
     */
    avoidSingleSelectedTab() {
__L_V__3({
    lN: 4755,tT:'func',pr:'',eT:{},fN:'avoidSingleSelectedTab'
  });'__L_V__3';
      if (this.multiSelectedTabsCount == 1) {
__L_V__3({
    lN: 4756,tT:'if',pr:'this.multiSelectedTabsCount == 1',eT:{},fN:''
  });'__L_V__3';
        this.clearMultiSelectedTabs({ isLastMultiSelectChange: false });
      }
    },

    switchToNextMultiSelectedTab() {
__L_V__3({
    lN: 4761,tT:'func',pr:'',eT:{},fN:'switchToNextMultiSelectedTab'
  });'__L_V__3';
      this._clearMultiSelectionLocked = true;

      // Guarantee that _clearMultiSelectionLocked lock gets released.
      try {
        let lastMultiSelectedTab = gBrowser.lastMultiSelectedTab;
        if (lastMultiSelectedTab != gBrowser.selectedTab) {
__L_V__3({
    lN: 4767,tT:'if',pr:'lastMultiSelectedTab != gBrowser.selectedTab',eT:{},fN:''
  });'__L_V__3';
          gBrowser.selectedTab = lastMultiSelectedTab;
        } else {
          let selectedTabs = ChromeUtils.nondeterministicGetWeakSetKeys(
            this._multiSelectedTabsSet
          ).filter(tab => tab.isConnected && !tab.closing);
          let length = selectedTabs.length;
          gBrowser.selectedTab = selectedTabs[length - 1];
        }
      } catch (e) {
        Cu.reportError(e);
      }

      this._clearMultiSelectionLocked = false;
    },

    set selectedTabs(tabs) {
__L_V__3({
    lN: 4783,tT:'func',pr:'',eT:{'tabs':tabs},fN:'selectedTabs'
  });'__L_V__3';
      this.clearMultiSelectedTabs({ isLastMultiSelectChange: false });
      this.selectedTab = tabs[0];
      if (tabs.length > 1) {
__L_V__3({
    lN: 4786,tT:'if',pr:'tabs.length > 1',eT:{},fN:''
  });'__L_V__3';
        for (let tab of tabs) {
          this.addToMultiSelectedTabs(tab, {
            isLastMultiSelectChange: false,
          });
        }
      }
      this.tabContainer._setPositionalAttributes();
    },

    get selectedTabs() {
__L_V__3({
    lN: 4796,tT:'func',pr:'',eT:{},fN:'selectedTabs'
  });'__L_V__3';
      let { selectedTab, _multiSelectedTabsSet } = this;
      let tabs = ChromeUtils.nondeterministicGetWeakSetKeys(
        _multiSelectedTabsSet
      ).filter(tab => tab.isConnected && !tab.closing);
      if (!_multiSelectedTabsSet.has(selectedTab)) {
__L_V__3({
    lN: 4801,tT:'if',pr:'!_multiSelectedTabsSet.has(selectedTab)',eT:{},fN:''
  });'__L_V__3';
        tabs.push(selectedTab);
      }
      return tabs.sort((a, b) => a._tPos > b._tPos);
    },

    get multiSelectedTabsCount() {
__L_V__3({
    lN: 4807,tT:'func',pr:'',eT:{},fN:'multiSelectedTabsCount'
  });'__L_V__3';
      return ChromeUtils.nondeterministicGetWeakSetKeys(
        this._multiSelectedTabsSet
      ).filter(tab => tab.isConnected && !tab.closing).length;
    },

    get lastMultiSelectedTab() {
__L_V__3({
    lN: 4813,tT:'func',pr:'',eT:{},fN:'lastMultiSelectedTab'
  });'__L_V__3';
      let tab = this._lastMultiSelectedTabRef
        ? this._lastMultiSelectedTabRef.get()
        : null;
      if (tab && tab.isConnected && this._multiSelectedTabsSet.has(tab)) {
__L_V__3({
    lN: 4817,tT:'if',pr:'tab && tab.isConnected && this._multiSelectedTabsSet.has(tab)',eT:{},fN:''
  });'__L_V__3';
        return tab;
      }
      let selectedTab = gBrowser.selectedTab;
      this.lastMultiSelectedTab = selectedTab;
      return selectedTab;
    },

    set lastMultiSelectedTab(aTab) {
__L_V__3({
    lN: 4825,tT:'func',pr:'',eT:{'aTab':aTab},fN:'lastMultiSelectedTab'
  });'__L_V__3';
      this._lastMultiSelectedTabRef = Cu.getWeakReference(aTab);
    },

    _startMultiSelectChange() {
__L_V__3({
    lN: 4829,tT:'func',pr:'',eT:{},fN:'_startMultiSelectChange'
  });'__L_V__3';
      if (!this._multiSelectChangeStarted) {
__L_V__3({
    lN: 4830,tT:'if',pr:'!this._multiSelectChangeStarted',eT:{},fN:''
  });'__L_V__3';
        this._multiSelectChangeStarted = true;
        Promise.resolve().then(() => this._endMultiSelectChange());
      }
    },

    _endMultiSelectChange() {
__L_V__3({
    lN: 4836,tT:'func',pr:'',eT:{},fN:'_endMultiSelectChange'
  });'__L_V__3';
      this._multiSelectChangeStarted = false;
      let noticeable =
        this._multiSelectChangeSelected ||
        this._multiSelectChangeAdditions.size ||
        this._multiSelectChangeRemovals.size;
      if (noticeable) {
__L_V__3({
    lN: 4842,tT:'if',pr:'noticeable',eT:{},fN:''
  });'__L_V__3';
        this._multiSelectChangeSelected = false;
        this._multiSelectChangeAdditions.clear();
        this._multiSelectChangeRemovals.clear();
        this.dispatchEvent(
          new CustomEvent("TabMultiSelect", { bubbles: true })
        );
      }
    },

    toggleMuteAudioOnMultiSelectedTabs(aTab) {
__L_V__3({
    lN: 4852,tT:'func',pr:'',eT:{'aTab':aTab},fN:'toggleMuteAudioOnMultiSelectedTabs'
  });'__L_V__3';
      let tabsToToggle;
      if (aTab.activeMediaBlocked) {
__L_V__3({
    lN: 4854,tT:'if',pr:'aTab.activeMediaBlocked',eT:{},fN:''
  });'__L_V__3';
        tabsToToggle = this.selectedTabs.filter(
          tab => tab.activeMediaBlocked || tab.linkedBrowser.audioMuted
        );
      } else {
        let tabMuted = aTab.linkedBrowser.audioMuted;
        tabsToToggle = this.selectedTabs.filter(
          tab =>
            // When a user is looking to mute selected tabs, then media-blocked tabs
            // should not be toggled. Otherwise those media-blocked tabs are going into a
            // playing and unmuted state.
            (tab.linkedBrowser.audioMuted == tabMuted &&
              !tab.activeMediaBlocked) ||
            (tab.activeMediaBlocked && tabMuted)
        );
      }
      for (let tab of tabsToToggle) {
        tab.toggleMuteAudio();
      }
    },

    pinMultiSelectedTabs() {
__L_V__3({
    lN: 4875,tT:'func',pr:'',eT:{},fN:'pinMultiSelectedTabs'
  });'__L_V__3';
      for (let tab of this.selectedTabs) {
        this.pinTab(tab);
      }
    },

    unpinMultiSelectedTabs() {
__L_V__3({
    lN: 4881,tT:'func',pr:'',eT:{},fN:'unpinMultiSelectedTabs'
  });'__L_V__3';
      // The selectedTabs getter returns the tabs
      // in visual order. We need to unpin in reverse
      // order to maintain visual order.
      let selectedTabs = this.selectedTabs;
      for (let i = selectedTabs.length - 1; i >= 0; i--) {
        let tab = selectedTabs[i];
        this.unpinTab(tab);
      }
    },

    activateBrowserForPrintPreview(aBrowser) {
__L_V__3({
    lN: 4892,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'activateBrowserForPrintPreview'
  });'__L_V__3';
      this._printPreviewBrowsers.add(aBrowser);
      if (this._switcher) {
__L_V__3({
    lN: 4894,tT:'if',pr:'this._switcher',eT:{},fN:''
  });'__L_V__3';
        this._switcher.activateBrowserForPrintPreview(aBrowser);
      }
      aBrowser.docShellIsActive = true;
    },

    deactivatePrintPreviewBrowsers() {
__L_V__3({
    lN: 4900,tT:'func',pr:'',eT:{},fN:'deactivatePrintPreviewBrowsers'
  });'__L_V__3';
      let browsers = this._printPreviewBrowsers;
      this._printPreviewBrowsers = new Set();
      for (let browser of browsers) {
        browser.docShellIsActive = this.shouldActivateDocShell(browser);
      }
    },

    /**
     * Returns true if a given browser's docshell should be active.
     */
    shouldActivateDocShell(aBrowser) {
__L_V__3({
    lN: 4911,tT:'func',pr:'',eT:{'aBrowser':aBrowser},fN:'shouldActivateDocShell'
  });'__L_V__3';
      if (this._switcher) {
__L_V__3({
    lN: 4912,tT:'if',pr:'this._switcher',eT:{},fN:''
  });'__L_V__3';
        return this._switcher.shouldActivateDocShell(aBrowser);
      }
      return (
        (aBrowser == this.selectedBrowser &&
          window.windowState != window.STATE_MINIMIZED &&
          !window.isFullyOccluded) ||
        this._printPreviewBrowsers.has(aBrowser)
      );
    },

    _getSwitcher() {
__L_V__3({
    lN: 4923,tT:'func',pr:'',eT:{},fN:'_getSwitcher'
  });'__L_V__3';
      if (!this._switcher) {
__L_V__3({
    lN: 4924,tT:'if',pr:'!this._switcher',eT:{},fN:''
  });'__L_V__3';
        this._switcher = new this.AsyncTabSwitcher(this);
      }
      return this._switcher;
    },

    warmupTab(aTab) {
__L_V__3({
    lN: 4930,tT:'func',pr:'',eT:{'aTab':aTab},fN:'warmupTab'
  });'__L_V__3';
      if (gMultiProcessBrowser) {
__L_V__3({
    lN: 4931,tT:'if',pr:'gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        this._getSwitcher().warmupTab(aTab);
      }
    },

    _handleKeyDownEvent(aEvent) {
__L_V__3({
    lN: 4936,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_handleKeyDownEvent'
  });'__L_V__3';
      if (!aEvent.isTrusted) {
__L_V__3({
    lN: 4937,tT:'if',pr:'!aEvent.isTrusted',eT:{},fN:''
  });'__L_V__3';
        // Don't let untrusted events mess with tabs.
        return;
      }

      // Skip this only if something has explicitly cancelled it.
      if (aEvent.defaultCancelled) {
__L_V__3({
    lN: 4943,tT:'if',pr:'aEvent.defaultCancelled',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      // Don't check if the event was already consumed because tab
      // navigation should always work for better user experience.
__L_V__3({
    lN: 4949,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';

      switch (ShortcutUtils.getSystemActionForEvent(aEvent)) {
        case ShortcutUtils.MOVE_TAB_BACKWARD:
          this.moveTabBackward();
          aEvent.preventDefault();
          return;
        case ShortcutUtils.MOVE_TAB_FORWARD:
          this.moveTabForward();
          aEvent.preventDefault();
          return;
        case ShortcutUtils.CLOSE_TAB:
          if (gBrowser.multiSelectedTabsCount) {
__L_V__3({
    lN: 4960,tT:'if',pr:'gBrowser.multiSelectedTabsCount',eT:{},fN:''
  });'__L_V__3';
            gBrowser.removeMultiSelectedTabs();
          } else if (!this.selectedTab.pinned) {
__L_V__3({
    lN: 4962,tT:'if',pr:'!this.selectedTab.pinned',eT:{},fN:''
  });'__L_V__3';
            this.removeCurrentTab({ animate: true });
          }
          aEvent.preventDefault();
      }
    },

    _handleKeyPressEventMac(aEvent) {
__L_V__3({
    lN: 4969,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'_handleKeyPressEventMac'
  });'__L_V__3';
      if (!aEvent.isTrusted) {
__L_V__3({
    lN: 4970,tT:'if',pr:'!aEvent.isTrusted',eT:{},fN:''
  });'__L_V__3';
        // Don't let untrusted events mess with tabs.
        return;
      }

      // Skip this only if something has explicitly cancelled it.
      if (aEvent.defaultCancelled) {
__L_V__3({
    lN: 4976,tT:'if',pr:'aEvent.defaultCancelled',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      if (AppConstants.platform == "macosx") {
__L_V__3({
    lN: 4980,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__3';
__L_V__3({
    lN: 4981,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';
        switch (
          ShortcutUtils.getSystemActionForEvent(aEvent, { rtl: RTL_UI })
        ) {
          case ShortcutUtils.NEXT_TAB:
            this.tabContainer.advanceSelectedTab(1, true);
            aEvent.preventDefault();
            break;
          case ShortcutUtils.PREVIOUS_TAB:
            this.tabContainer.advanceSelectedTab(-1, true);
            aEvent.preventDefault();
            break;
        }
      }
    },

    getTabTooltip(tab, includeLabel = true) {
__L_V__3({
    lN: 4996,tT:'func',pr:'',eT:{'tab':tab,'includeLabel':includeLabel},fN:'getTabTooltip'
  });'__L_V__3';
      let label = "";
      if (includeLabel) {
__L_V__3({
    lN: 4998,tT:'if',pr:'includeLabel',eT:{},fN:''
  });'__L_V__3';
        label = tab._fullLabel || tab.getAttribute("label");
      }
      if (AppConstants.NIGHTLY_BUILD) {
__L_V__3({
    lN: 5001,tT:'if',pr:'AppConstants.NIGHTLY_BUILD',eT:{},fN:''
  });'__L_V__3';
        if (tab.linkedBrowser) {
__L_V__3({
    lN: 5002,tT:'if',pr:'tab.linkedBrowser',eT:{},fN:''
  });'__L_V__3';
          // On Nightly builds, show the PID of the content process, and if
          // we're running with fission enabled, try to include PIDs for
          // every remote subframe.
          let [contentPid, ...framePids] = E10SUtils.getBrowserPids(
            tab.linkedBrowser,
            gFissionBrowser
          );
          if (contentPid) {
__L_V__3({
    lN: 5010,tT:'if',pr:'contentPid',eT:{},fN:''
  });'__L_V__3';
            label += " (pid " + contentPid + ")";
            if (gFissionBrowser) {
__L_V__3({
    lN: 5012,tT:'if',pr:'gFissionBrowser',eT:{},fN:''
  });'__L_V__3';
              label += " [F " + framePids.join(", ") + "]";
            }
          }
        }
      }
      if (tab.userContextId) {
__L_V__3({
    lN: 5018,tT:'if',pr:'tab.userContextId',eT:{},fN:''
  });'__L_V__3';
        label = gTabBrowserBundle.formatStringFromName(
          "tabs.containers.tooltip",
          [
            label,
            ContextualIdentityService.getUserContextLabel(tab.userContextId),
          ]
        );
      }
      return label;
    },

    createTooltip(event) {
__L_V__3({
    lN: 5030,tT:'func',pr:'',eT:{'event':event},fN:'createTooltip'
  });'__L_V__3';
      event.stopPropagation();
      let tab = document.tooltipNode
        ? document.tooltipNode.closest("tab")
        : null;
      if (!tab) {
__L_V__3({
    lN: 5035,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
        event.preventDefault();
        return;
      }

      let stringWithShortcut = (stringId, keyElemId, pluralCount) => {
        let keyElem = document.getElementById(keyElemId);
        let shortcut = ShortcutUtils.prettifyShortcut(keyElem);
        return PluralForm.get(
          pluralCount,
          gTabBrowserBundle.GetStringFromName(stringId)
        )
          .replace("%S", shortcut)
          .replace("#1", pluralCount);
      };

      let label;
      const selectedTabs = this.selectedTabs;
      const contextTabInSelection = selectedTabs.includes(tab);
      const affectedTabsLength = contextTabInSelection
        ? selectedTabs.length
        : 1;
      if (tab.mOverCloseButton) {
__L_V__3({
    lN: 5057,tT:'if',pr:'tab.mOverCloseButton',eT:{},fN:''
  });'__L_V__3';
        label = tab.selected
          ? stringWithShortcut(
              "tabs.closeTabs.tooltip",
              "key_close",
              affectedTabsLength
            )
          : PluralForm.get(
              affectedTabsLength,
              gTabBrowserBundle.GetStringFromName("tabs.closeTabs.tooltip")
            ).replace("#1", affectedTabsLength);
      } else if (tab._overPlayingIcon) {
__L_V__3({
    lN: 5068,tT:'if',pr:'tab._overPlayingIcon',eT:{},fN:''
  });'__L_V__3';
        let stringID;
        if (tab.selected) {
__L_V__3({
    lN: 5070,tT:'if',pr:'tab.selected',eT:{},fN:''
  });'__L_V__3';
          stringID = tab.linkedBrowser.audioMuted
            ? "tabs.unmuteAudio2.tooltip"
            : "tabs.muteAudio2.tooltip";
          label = stringWithShortcut(
            stringID,
            "key_toggleMute",
            affectedTabsLength
          );
        } else {
          if (tab.hasAttribute("activemedia-blocked")) {
__L_V__3({
    lN: 5080,tT:'if',pr:'tab.hasAttribute(activemedia-blocked)',eT:{},fN:''
  });'__L_V__3';
            stringID = "tabs.unblockAudio2.tooltip";
          } else {
            stringID = tab.linkedBrowser.audioMuted
              ? "tabs.unmuteAudio2.background.tooltip"
              : "tabs.muteAudio2.background.tooltip";
          }

          label = PluralForm.get(
            affectedTabsLength,
            gTabBrowserBundle.GetStringFromName(stringID)
          ).replace("#1", affectedTabsLength);
        }
      } else {
        label = this.getTabTooltip(tab);
      }

      event.target.setAttribute("label", label);
    },

    handleEvent(aEvent) {
__L_V__3({
    lN: 5100,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'handleEvent'
  });'__L_V__3';
__L_V__3({
    lN: 5101,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';
      switch (aEvent.type) {
        case "keydown":
          this._handleKeyDownEvent(aEvent);
          break;
        case "keypress":
          this._handleKeyPressEventMac(aEvent);
          break;
        case "framefocusrequested": {
          let tab = this.getTabForBrowser(aEvent.target);
          if (!tab || tab == this.selectedTab) {
__L_V__3({
    lN: 5110,tT:'if',pr:'!tab || tab == this.selectedTab',eT:{},fN:''
  });'__L_V__3';
            // Let the focus manager try to do its thing by not calling
            // preventDefault(). It will still raise the window if appropriate.
            break;
          }
          this.selectedTab = tab;
          window.focus();
          aEvent.preventDefault();
          break;
        }
        case "sizemodechange":
        case "occlusionstatechange":
          if (aEvent.target == window && !this._switcher) {
__L_V__3({
    lN: 5122,tT:'if',pr:'aEvent.target == window && !this._switcher',eT:{},fN:''
  });'__L_V__3';
            this.selectedBrowser.preserveLayers(
              window.windowState == window.STATE_MINIMIZED ||
                window.isFullyOccluded
            );
            this.selectedBrowser.docShellIsActive = this.shouldActivateDocShell(
              this.selectedBrowser
            );
          }
          break;
      }
    },

    receiveMessage(aMessage) {
__L_V__3({
    lN: 5135,tT:'func',pr:'',eT:{'aMessage':aMessage},fN:'receiveMessage'
  });'__L_V__3';
      let data = aMessage.data;
      let browser = aMessage.target;
__L_V__3({
    lN: 5138,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';

      switch (aMessage.name) {
        case "DOMTitleChanged": {
          let tab = this.getTabForBrowser(browser);
          if (!tab || tab.hasAttribute("pending")) {
__L_V__3({
    lN: 5142,tT:'if',pr:'!tab || tab.hasAttribute(pending)',eT:{},fN:''
  });'__L_V__3';
            return undefined;
          }
          let titleChanged = this.setTabTitle(tab);
          if (titleChanged && !tab.selected && !tab.hasAttribute("busy")) {
__L_V__3({
    lN: 5146,tT:'if',pr:'titleChanged && !tab.selected && !tab.hasAttribute(busy)',eT:{},fN:''
  });'__L_V__3';
            tab.setAttribute("titlechanged", "true");
          }
          break;
        }
        case "contextmenu": {
          openContextMenu(aMessage);
          break;
        }
        case "Browser:Init": {
          let tab = this.getTabForBrowser(browser);
          if (!tab) {
__L_V__3({
    lN: 5157,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
            return undefined;
          }

          this._outerWindowIDBrowserMap.set(browser.outerWindowID, browser);
          browser.sendMessageToActor(
            "Browser:AppTab",
            { isAppTab: tab.pinned },
            "BrowserTab"
          );
          break;
        }
        case "RefreshBlocker:Blocked": {
          // The data object is expected to contain the following properties:
          //  - URI (string)
          //     The URI that a page is attempting to refresh or redirect to.
          //  - delay (int)
          //     The delay (in milliseconds) before the page was going to
          //     reload or redirect.
          //  - sameURI (bool)
          //     true if we're refreshing the page. false if we're redirecting.
          //  - outerWindowID (int)
          //     The outerWindowID of the frame that requested the refresh or
          //     redirect.

          let brandBundle = document.getElementById("bundle_brand");
          let brandShortName = brandBundle.getString("brandShortName");
          let message = gNavigatorBundle.getFormattedString(
            "refreshBlocked." +
              (data.sameURI ? "refreshLabel" : "redirectLabel"),
            [brandShortName]
          );

          let notificationBox = this.getNotificationBox(browser);
          let notification = notificationBox.getNotificationWithValue(
            "refresh-blocked"
          );

          if (notification) {
__L_V__3({
    lN: 5195,tT:'if',pr:'notification',eT:{},fN:''
  });'__L_V__3';
            notification.label = message;
          } else {
            let refreshButtonText = gNavigatorBundle.getString(
              "refreshBlocked.goButton"
            );
            let refreshButtonAccesskey = gNavigatorBundle.getString(
              "refreshBlocked.goButton.accesskey"
            );

            let buttons = [
              {
                label: refreshButtonText,
                accessKey: refreshButtonAccesskey,
                callback() {
__L_V__3({
    lN: 5209,tT:'func',pr:'',eT:{},fN:'callback'
  });'__L_V__3';
                  if (browser.messageManager) {
__L_V__3({
    lN: 5210,tT:'if',pr:'browser.messageManager',eT:{},fN:''
  });'__L_V__3';
                    browser.messageManager.sendAsyncMessage(
                      "RefreshBlocker:Refresh",
                      data
                    );
                  }
                },
              },
            ];

            notificationBox.appendNotification(
              message,
              "refresh-blocked",
              "chrome://browser/skin/notification-icons/popup.svg",
              notificationBox.PRIORITY_INFO_MEDIUM,
              buttons
            );
          }
          break;
        }
      }
      return undefined;
    },

    observe(aSubject, aTopic, aData) {
__L_V__3({
    lN: 5234,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'observe'
  });'__L_V__3';
__L_V__3({
    lN: 5235,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';
      switch (aTopic) {
        case "contextual-identity-updated": {
          for (let tab of this.tabs) {
            if (tab.getAttribute("usercontextid") == aData) {
__L_V__3({
    lN: 5238,tT:'if',pr:'tab.getAttribute(usercontextid) == aData',eT:{},fN:''
  });'__L_V__3';
              ContextualIdentityService.setTabStyle(tab);
            }
          }
          break;
        }
      }
    },

    _generateUniquePanelID() {
__L_V__3({
    lN: 5247,tT:'func',pr:'',eT:{},fN:'_generateUniquePanelID'
  });'__L_V__3';
      if (!this._uniquePanelIDCounter) {
__L_V__3({
    lN: 5248,tT:'if',pr:'!this._uniquePanelIDCounter',eT:{},fN:''
  });'__L_V__3';
        this._uniquePanelIDCounter = 0;
      }

      let outerID = window.windowUtils.outerWindowID;

      // We want panel IDs to be globally unique, that's why we include the
      // window ID. We switched to a monotonic counter as Date.now() lead
      // to random failures because of colliding IDs.
      return "panel-" + outerID + "-" + ++this._uniquePanelIDCounter;
    },

    destroy() {
__L_V__3({
    lN: 5260,tT:'func',pr:'',eT:{},fN:'destroy'
  });'__L_V__3';
      this.tabContainer.destroy();
      Services.obs.removeObserver(this, "contextual-identity-updated");

      for (let tab of this.tabs) {
        let browser = tab.linkedBrowser;
        if (browser.registeredOpenURI) {
__L_V__3({
    lN: 5266,tT:'if',pr:'browser.registeredOpenURI',eT:{},fN:''
  });'__L_V__3';
          let userContextId = browser.getAttribute("usercontextid") || 0;
          this.UrlbarProviderOpenTabs.unregisterOpenTab(
            browser.registeredOpenURI.spec,
            userContextId
          );
          delete browser.registeredOpenURI;
        }

        let filter = this._tabFilters.get(tab);
        if (filter) {
__L_V__3({
    lN: 5276,tT:'if',pr:'filter',eT:{},fN:''
  });'__L_V__3';
          browser.webProgress.removeProgressListener(filter);

          let listener = this._tabListeners.get(tab);
          if (listener) {
__L_V__3({
    lN: 5280,tT:'if',pr:'listener',eT:{},fN:''
  });'__L_V__3';
            filter.removeProgressListener(listener);
            listener.destroy();
          }

          this._tabFilters.delete(tab);
          this._tabListeners.delete(tab);
        }
      }

      Services.els.removeSystemEventListener(document, "keydown", this, false);
      if (AppConstants.platform == "macosx") {
__L_V__3({
    lN: 5291,tT:'if',pr:'AppConstants.platform == macosx',eT:{},fN:''
  });'__L_V__3';
        Services.els.removeSystemEventListener(
          document,
          "keypress",
          this,
          false
        );
      }
      window.removeEventListener("sizemodechange", this);
      window.removeEventListener("occlusionstatechange", this);
      window.removeEventListener("framefocusrequested", this);

      if (gMultiProcessBrowser) {
__L_V__3({
    lN: 5303,tT:'if',pr:'gMultiProcessBrowser',eT:{},fN:''
  });'__L_V__3';
        let messageManager = window.getGroupMessageManager("browsers");
        messageManager.removeMessageListener("DOMTitleChanged", this);
        window.messageManager.removeMessageListener("contextmenu", this);

        if (this._switcher) {
__L_V__3({
    lN: 5308,tT:'if',pr:'this._switcher',eT:{},fN:''
  });'__L_V__3';
          this._switcher.destroy();
        }
      }
    },

    _setupEventListeners() {
__L_V__3({
    lN: 5314,tT:'func',pr:'',eT:{},fN:'_setupEventListeners'
  });'__L_V__3';
      this.tabpanels.addEventListener("select", event => {
        if (event.target == this.tabpanels) {
__L_V__3({
    lN: 5316,tT:'if',pr:'event.target == this.tabpanels',eT:{},fN:''
  });'__L_V__3';
          this.updateCurrentBrowser();
        }
      });

      this.addEventListener("DOMWindowClose", event => {
        let browser = event.target;
        if (!browser.isRemoteBrowser) {
__L_V__3({
    lN: 5323,tT:'if',pr:'!browser.isRemoteBrowser',eT:{},fN:''
  });'__L_V__3';
          if (!event.isTrusted) {
__L_V__3({
    lN: 5324,tT:'if',pr:'!event.isTrusted',eT:{},fN:''
  });'__L_V__3';
            // If the browser is not remote, then we expect the event to be trusted.
            // In the remote case, the DOMWindowClose event is captured in content,
            // a message is sent to the parent, and another DOMWindowClose event
            // is re-dispatched on the actual browser node. In that case, the event
            // won't  be marked as trusted, since it's synthesized by JavaScript.
            return;
          }
          // In the parent-process browser case, it's possible that the browser
          // that fired DOMWindowClose is actually a child of another browser. We
          // want to find the top-most browser to determine whether or not this is
          // for a tab or not. The chromeEventHandler will be the top-most browser.
          browser = event.target.docShell.chromeEventHandler;
        }

        if (this.tabs.length == 1) {
__L_V__3({
    lN: 5339,tT:'if',pr:'this.tabs.length == 1',eT:{},fN:''
  });'__L_V__3';
          // We already did PermitUnload in the content process
          // for this tab (the only one in the window). So we don't
          // need to do it again for any tabs.
          window.skipNextCanClose = true;
          // In the parent-process browser case, the nsCloseEvent will actually take
          // care of tearing down the window, but we need to do this ourselves in the
          // content-process browser case. Doing so in both cases doesn't appear to
          // hurt.
          window.close();
          return;
        }

        let tab = this.getTabForBrowser(browser);
        if (tab) {
__L_V__3({
    lN: 5353,tT:'if',pr:'tab',eT:{},fN:''
  });'__L_V__3';
          // Skip running PermitUnload since it already happened in
          // the content process.
          this.removeTab(tab, { skipPermitUnload: true });
          // If we don't preventDefault on the DOMWindowClose event, then
          // in the parent-process browser case, we're telling the platform
          // to close the entire window. Calling preventDefault is our way of
          // saying we took care of this close request by closing the tab.
          event.preventDefault();
        }
      });

      this.addEventListener(
        "DOMWillOpenModalDialog",
        event => {
          if (!event.isTrusted) {
__L_V__3({
    lN: 5368,tT:'if',pr:'!event.isTrusted',eT:{},fN:''
  });'__L_V__3';
            return;
          }

          let targetIsWindow = event.target instanceof Window;

          // We're about to open a modal dialog, so figure out for which tab:
          // If this is a same-process modal dialog, then we're given its DOM
          // window as the event's target. For remote dialogs, we're given the
          // browser, but that's in the originalTarget and not the target,
          // because it's across the tabbrowser's XBL boundary.
          let tabForEvent = targetIsWindow
            ? this.getTabForBrowser(event.target.docShell.chromeEventHandler)
            : this.getTabForBrowser(event.originalTarget);

          // Focus window for beforeunload dialog so it is seen but don't
          // steal focus from other applications.
          if (
            event.detail &&
            event.detail.tabPrompt &&
            event.detail.inPermitUnload &&
            Services.focus.activeWindow
          ) {
__L_V__3({
    lN: 5390,tT:'if',pr:' event.detail && event.detail.tabPrompt && event.detail.inPermitUnload && Services.focus.activeWindow ',eT:{},fN:''
  });'__L_V__3';
            window.focus();
          }

          // Don't need to act if the tab is already selected or if there isn't
          // a tab for the event (e.g. for the webextensions options_ui remote
          // browsers embedded in the "about:addons" page):
          if (!tabForEvent || tabForEvent.selected) {
__L_V__3({
    lN: 5397,tT:'if',pr:'!tabForEvent || tabForEvent.selected',eT:{},fN:''
  });'__L_V__3';
            return;
          }

          // We always switch tabs for beforeunload tab-modal prompts.
          if (
            event.detail &&
            event.detail.tabPrompt &&
            !event.detail.inPermitUnload
          ) {
__L_V__3({
    lN: 5406,tT:'if',pr:' event.detail && event.detail.tabPrompt && !event.detail.inPermitUnload ',eT:{},fN:''
  });'__L_V__3';
            let docPrincipal = targetIsWindow
              ? event.target.document.nodePrincipal
              : null;
            // At least one of these should/will be non-null:
            let promptPrincipal =
              event.detail.promptPrincipal ||
              docPrincipal ||
              tabForEvent.linkedBrowser.contentPrincipal;

            // For null principals, we bail immediately and don't show the checkbox:
            if (!promptPrincipal || promptPrincipal.isNullPrincipal) {
__L_V__3({
    lN: 5417,tT:'if',pr:'!promptPrincipal || promptPrincipal.isNullPrincipal',eT:{},fN:''
  });'__L_V__3';
              tabForEvent.setAttribute("attention", "true");
              this._tabAttrModified(tabForEvent, ["attention"]);
              return;
            }

            // For non-system/expanded principals, we bail and show the checkbox
            if (promptPrincipal.URI && !promptPrincipal.isSystemPrincipal) {
__L_V__3({
    lN: 5424,tT:'if',pr:'promptPrincipal.URI && !promptPrincipal.isSystemPrincipal',eT:{},fN:''
  });'__L_V__3';
              let permission = Services.perms.testPermissionFromPrincipal(
                promptPrincipal,
                "focus-tab-by-prompt"
              );
              if (permission != Services.perms.ALLOW_ACTION) {
__L_V__3({
    lN: 5429,tT:'if',pr:'permission != Services.perms.ALLOW_ACTION',eT:{},fN:''
  });'__L_V__3';
                // Tell the prompt box we want to show the user a checkbox:
                let tabPrompt = this.getTabModalPromptBox(
                  tabForEvent.linkedBrowser
                );
                tabPrompt.onNextPromptShowAllowFocusCheckboxFor(
                  promptPrincipal
                );
                tabForEvent.setAttribute("attention", "true");
                this._tabAttrModified(tabForEvent, ["attention"]);
                return;
              }
            }
            // ... so system and expanded principals, as well as permitted "normal"
            // URI-based principals, always get to steal focus for the tab when prompting.
          }

          // If permissions/origins dictate so, bring tab to the front.
          this.selectedTab = tabForEvent;
        },
        true
      );

      this.addEventListener("DOMTitleChanged", event => {
        if (!event.isTrusted) {
__L_V__3({
    lN: 5453,tT:'if',pr:'!event.isTrusted',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        var contentWin = event.target.defaultView;
        if (contentWin != contentWin.top) {
__L_V__3({
    lN: 5458,tT:'if',pr:'contentWin != contentWin.top',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        let browser = contentWin.docShell.chromeEventHandler;
        var tab = this.getTabForBrowser(browser);
        if (!tab || tab.hasAttribute("pending")) {
__L_V__3({
    lN: 5464,tT:'if',pr:'!tab || tab.hasAttribute(pending)',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        if (!browser.docShell) {
__L_V__3({
    lN: 5468,tT:'if',pr:'!browser.docShell',eT:{},fN:''
  });'__L_V__3';
          return;
        }
        // Ensure `docShell.document` (an nsIWebNavigation idl prop) is there:
        browser.docShell.QueryInterface(Ci.nsIWebNavigation);
        if (event.target != browser.docShell.document) {
__L_V__3({
    lN: 5473,tT:'if',pr:'event.target != browser.docShell.document',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        // Ignore empty title changes on internal pages. This prevents the title
        // from changing while Fluent is populating the (initially-empty) title
        // element.
        if (
          !browser.contentTitle &&
          browser.contentPrincipal.isSystemPrincipal
        ) {
__L_V__3({
    lN: 5483,tT:'if',pr:' !browser.contentTitle && browser.contentPrincipal.isSystemPrincipal ',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        var titleChanged = this.setTabTitle(tab);
        if (titleChanged && !tab.selected && !tab.hasAttribute("busy")) {
__L_V__3({
    lN: 5488,tT:'if',pr:'titleChanged && !tab.selected && !tab.hasAttribute(busy)',eT:{},fN:''
  });'__L_V__3';
          tab.setAttribute("titlechanged", "true");
        }
      });

      let onTabCrashed = event => {
        if (!event.isTrusted || !event.isTopFrame) {
__L_V__3({
    lN: 5494,tT:'if',pr:'!event.isTrusted || !event.isTopFrame',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        let browser = event.originalTarget;

        // Preloaded browsers do not actually have any tabs. If one crashes,
        // it should be released and removed.
        if (browser === this.preloadedBrowser) {
__L_V__3({
    lN: 5502,tT:'if',pr:'browser === this.preloadedBrowser',eT:{},fN:''
  });'__L_V__3';
          NewTabPagePreloading.removePreloadedBrowser(window);
          return;
        }

        let isRestartRequiredCrash =
          event.type == "oop-browser-buildid-mismatch";

        let icon = browser.mIconURL;
        let tab = this.getTabForBrowser(browser);

        if (this.selectedBrowser == browser) {
__L_V__3({
    lN: 5513,tT:'if',pr:'this.selectedBrowser == browser',eT:{},fN:''
  });'__L_V__3';
          TabCrashHandler.onSelectedBrowserCrash(
            browser,
            isRestartRequiredCrash
          );
        } else {
          TabCrashHandler.onBackgroundBrowserCrash(
            browser,
            isRestartRequiredCrash
          );
        }

        tab.removeAttribute("soundplaying");
        this.setIcon(tab, icon);
      };

      this.addEventListener("oop-browser-crashed", onTabCrashed);
      this.addEventListener("oop-browser-buildid-mismatch", onTabCrashed);

      this.addEventListener("DOMAudioPlaybackStarted", event => {
        var tab = this.getTabFromAudioEvent(event);
        if (!tab) {
__L_V__3({
    lN: 5534,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        clearTimeout(tab._soundPlayingAttrRemovalTimer);
        tab._soundPlayingAttrRemovalTimer = 0;

        let modifiedAttrs = [];
        if (tab.hasAttribute("soundplaying-scheduledremoval")) {
__L_V__3({
    lN: 5542,tT:'if',pr:'tab.hasAttribute(soundplaying-scheduledremoval)',eT:{},fN:''
  });'__L_V__3';
          tab.removeAttribute("soundplaying-scheduledremoval");
          modifiedAttrs.push("soundplaying-scheduledremoval");
        }

        if (!tab.hasAttribute("soundplaying")) {
__L_V__3({
    lN: 5547,tT:'if',pr:'!tab.hasAttribute(soundplaying)',eT:{},fN:''
  });'__L_V__3';
          tab.setAttribute("soundplaying", true);
          modifiedAttrs.push("soundplaying");
        }

        if (modifiedAttrs.length) {
__L_V__3({
    lN: 5552,tT:'if',pr:'modifiedAttrs.length',eT:{},fN:''
  });'__L_V__3';
          // Flush style so that the opacity takes effect immediately, in
          // case the media is stopped before the style flushes naturally.
          getComputedStyle(tab).opacity;
        }

        this._tabAttrModified(tab, modifiedAttrs);
      });

      this.addEventListener("DOMAudioPlaybackStopped", event => {
        var tab = this.getTabFromAudioEvent(event);
        if (!tab) {
__L_V__3({
    lN: 5563,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        if (tab.hasAttribute("soundplaying")) {
__L_V__3({
    lN: 5567,tT:'if',pr:'tab.hasAttribute(soundplaying)',eT:{},fN:''
  });'__L_V__3';
          let removalDelay = Services.prefs.getIntPref(
            "browser.tabs.delayHidingAudioPlayingIconMS"
          );

          tab.style.setProperty(
            "--soundplaying-removal-delay",
            `${removalDelay - 300}ms`
          );
          tab.setAttribute("soundplaying-scheduledremoval", "true");
          this._tabAttrModified(tab, ["soundplaying-scheduledremoval"]);

          tab._soundPlayingAttrRemovalTimer = setTimeout(() => {
            tab.removeAttribute("soundplaying-scheduledremoval");
            tab.removeAttribute("soundplaying");
            this._tabAttrModified(tab, [
              "soundplaying",
              "soundplaying-scheduledremoval",
            ]);
          }, removalDelay);
        }
      });

      this.addEventListener("DOMAudioPlaybackBlockStarted", event => {
        var tab = this.getTabFromAudioEvent(event);
        if (!tab) {
__L_V__3({
    lN: 5592,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        if (!tab.hasAttribute("activemedia-blocked")) {
__L_V__3({
    lN: 5596,tT:'if',pr:'!tab.hasAttribute(activemedia-blocked)',eT:{},fN:''
  });'__L_V__3';
          tab.setAttribute("activemedia-blocked", true);
          this._tabAttrModified(tab, ["activemedia-blocked"]);
        }
      });

      this.addEventListener("DOMAudioPlaybackBlockStopped", event => {
        var tab = this.getTabFromAudioEvent(event);
        if (!tab) {
__L_V__3({
    lN: 5604,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        if (tab.hasAttribute("activemedia-blocked")) {
__L_V__3({
    lN: 5608,tT:'if',pr:'tab.hasAttribute(activemedia-blocked)',eT:{},fN:''
  });'__L_V__3';
          tab.removeAttribute("activemedia-blocked");
          this._tabAttrModified(tab, ["activemedia-blocked"]);
          let hist = Services.telemetry.getHistogramById(
            "TAB_AUDIO_INDICATOR_USED"
          );
          hist.add(2 /* unblockByVisitingTab */);
        }
      });

      this.addEventListener("GloballyAutoplayBlocked", event => {
        let browser = event.originalTarget;
        let tab = this.getTabForBrowser(browser);
        if (!tab) {
__L_V__3({
    lN: 5621,tT:'if',pr:'!tab',eT:{},fN:''
  });'__L_V__3';
          return;
        }

        SitePermissions.setForPrincipal(
          browser.contentPrincipal,
          "autoplay-media",
          SitePermissions.BLOCK,
          SitePermissions.SCOPE_GLOBAL,
          browser
        );
      });

      let tabContextFTLInserter = () => {
        MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
        // Un-lazify the l10n-ids now that the FTL file has been inserted.
        document
          .getElementById("tabContextMenu")
          .querySelectorAll("[data-lazy-l10n-id]")
          .forEach(el => {
            el.setAttribute(
              "data-l10n-id",
              el.getAttribute("data-lazy-l10n-id")
            );
            el.removeAttribute("data-lazy-l10n-id");
          });
        this.tabContainer.removeEventListener(
          "contextmenu",
          tabContextFTLInserter,
          true
        );
        this.tabContainer.removeEventListener(
          "mouseover",
          tabContextFTLInserter
        );
        this.tabContainer.removeEventListener(
          "focus",
          tabContextFTLInserter,
          true
        );
      };
      this.tabContainer.addEventListener(
        "contextmenu",
        tabContextFTLInserter,
        true
      );
      this.tabContainer.addEventListener("mouseover", tabContextFTLInserter);
      this.tabContainer.addEventListener("focus", tabContextFTLInserter, true);
    },

    setSuccessor(aTab, successorTab) {
__L_V__3({
    lN: 5671,tT:'func',pr:'',eT:{'aTab':aTab,'successorTab':successorTab},fN:'setSuccessor'
  });'__L_V__3';
      if (aTab.ownerGlobal != window) {
__L_V__3({
    lN: 5672,tT:'if',pr:'aTab.ownerGlobal != window',eT:{},fN:''
  });'__L_V__3';
        throw new Error("Cannot set the successor of another window's tab");
      }
      if (successorTab == aTab) {
__L_V__3({
    lN: 5675,tT:'if',pr:'successorTab == aTab',eT:{},fN:''
  });'__L_V__3';
        successorTab = null;
      }
      if (successorTab && successorTab.ownerGlobal != window) {
__L_V__3({
    lN: 5678,tT:'if',pr:'successorTab && successorTab.ownerGlobal != window',eT:{},fN:''
  });'__L_V__3';
        throw new Error("Cannot set the successor to another window's tab");
      }
      if (aTab.successor) {
__L_V__3({
    lN: 5681,tT:'if',pr:'aTab.successor',eT:{},fN:''
  });'__L_V__3';
        aTab.successor.predecessors.delete(aTab);
      }
      aTab.successor = successorTab;
      if (successorTab) {
__L_V__3({
    lN: 5685,tT:'if',pr:'successorTab',eT:{},fN:''
  });'__L_V__3';
        if (!successorTab.predecessors) {
__L_V__3({
    lN: 5686,tT:'if',pr:'!successorTab.predecessors',eT:{},fN:''
  });'__L_V__3';
          successorTab.predecessors = new Set();
        }
        successorTab.predecessors.add(aTab);
      }
    },

    /**
     * For all tabs with aTab as a successor, set the successor to aOtherTab
     * instead.
     */
    replaceInSuccession(aTab, aOtherTab) {
__L_V__3({
    lN: 5697,tT:'func',pr:'',eT:{'aTab':aTab,'aOtherTab':aOtherTab},fN:'replaceInSuccession'
  });'__L_V__3';
      if (aTab.predecessors) {
__L_V__3({
    lN: 5698,tT:'if',pr:'aTab.predecessors',eT:{},fN:''
  });'__L_V__3';
        for (const predecessor of Array.from(aTab.predecessors)) {
          this.setSuccessor(predecessor, aOtherTab);
        }
      }
    },
  };

  /**
   * A web progress listener object definition for a given tab.
   */
  class TabProgressListener {
    constructor(
      aTab,
      aBrowser,
      aStartsBlank,
      aWasPreloadedBrowser,
      aOrigStateFlags
    ) {
__L_V__3({
    lN: 5716,tT:'func',pr:'',eT:{'aTab':aTab,'aBrowser':aBrowser,'aStartsBlank':aStartsBlank,'aWasPreloadedBrowser':aWasPreloadedBrowser,'aOrigStateFlags':aOrigStateFlags},fN:'constructor'
  });'__L_V__3';
      let stateFlags = aOrigStateFlags || 0;
      // Initialize mStateFlags to non-zero e.g. when creating a progress
      // listener for preloaded browsers as there was no progress listener
      // around when the content started loading. If the content didn't
      // quite finish loading yet, mStateFlags will very soon be overridden
      // with the correct value and end up at STATE_STOP again.
      if (aWasPreloadedBrowser) {
__L_V__3({
    lN: 5723,tT:'if',pr:'aWasPreloadedBrowser',eT:{},fN:''
  });'__L_V__3';
        stateFlags =
          Ci.nsIWebProgressListener.STATE_STOP |
          Ci.nsIWebProgressListener.STATE_IS_REQUEST;
      }

      this.mTab = aTab;
      this.mBrowser = aBrowser;
      this.mBlank = aStartsBlank;

      // cache flags for correct status UI update after tab switching
      this.mStateFlags = stateFlags;
      this.mStatus = 0;
      this.mMessage = "";
      this.mTotalProgress = 0;

      // count of open requests (should always be 0 or 1)
      this.mRequestCount = 0;
    }

    destroy() {
__L_V__3({
    lN: 5743,tT:'func',pr:'',eT:{},fN:'destroy'
  });'__L_V__3';
      delete this.mTab;
      delete this.mBrowser;
    }

    _callProgressListeners(...args) {
__L_V__3({
    lN: 5748,tT:'func',pr:'',eT:{'args':args},fN:'_callProgressListeners'
  });'__L_V__3';
      args.unshift(this.mBrowser);
      return gBrowser._callProgressListeners.apply(gBrowser, args);
    }

    _shouldShowProgress(aRequest) {
__L_V__3({
    lN: 5753,tT:'func',pr:'',eT:{'aRequest':aRequest},fN:'_shouldShowProgress'
  });'__L_V__3';
      if (this.mBlank) {
__L_V__3({
    lN: 5754,tT:'if',pr:'this.mBlank',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      // Don't show progress indicators in tabs for about: URIs
      // pointing to local resources.
      if (
        aRequest instanceof Ci.nsIChannel &&
        aRequest.originalURI.schemeIs("about")
      ) {
__L_V__3({
    lN: 5763,tT:'if',pr:' aRequest instanceof Ci.nsIChannel && aRequest.originalURI.schemeIs(about) ',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      return true;
    }

    _isForInitialAboutBlank(aWebProgress, aStateFlags, aLocation) {
__L_V__3({
    lN: 5770,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aStateFlags':aStateFlags,'aLocation':aLocation},fN:'_isForInitialAboutBlank'
  });'__L_V__3';
      if (!this.mBlank || !aWebProgress.isTopLevel) {
__L_V__3({
    lN: 5771,tT:'if',pr:'!this.mBlank || !aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__3';
        return false;
      }

      // If the state has STATE_STOP, and no requests were in flight, then this
      // must be the initial "stop" for the initial about:blank document.
      if (
        aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
        this.mRequestCount == 0 &&
        !aLocation
      ) {
__L_V__3({
    lN: 5781,tT:'if',pr:' aStateFlags & Ci.nsIWebProgressListener.STATE_STOP && this.mRequestCount == 0 && !aLocation ',eT:{},fN:''
  });'__L_V__3';
        return true;
      }

      let location = aLocation ? aLocation.spec : "";
      return location == "about:blank";
    }

    onProgressChange(
      aWebProgress,
      aRequest,
      aCurSelfProgress,
      aMaxSelfProgress,
      aCurTotalProgress,
      aMaxTotalProgress
    ) {
__L_V__3({
    lN: 5796,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aCurSelfProgress':aCurSelfProgress,'aMaxSelfProgress':aMaxSelfProgress,'aCurTotalProgress':aCurTotalProgress,'aMaxTotalProgress':aMaxTotalProgress},fN:'onProgressChange'
  });'__L_V__3';
      this.mTotalProgress = aMaxTotalProgress
        ? aCurTotalProgress / aMaxTotalProgress
        : 0;

      if (!this._shouldShowProgress(aRequest)) {
__L_V__3({
    lN: 5801,tT:'if',pr:'!this._shouldShowProgress(aRequest)',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      if (this.mTotalProgress && this.mTab.hasAttribute("busy")) {
__L_V__3({
    lN: 5805,tT:'if',pr:'this.mTotalProgress && this.mTab.hasAttribute(busy)',eT:{},fN:''
  });'__L_V__3';
        this.mTab.setAttribute("progress", "true");
        gBrowser._tabAttrModified(this.mTab, ["progress"]);
      }

      this._callProgressListeners("onProgressChange", [
        aWebProgress,
        aRequest,
        aCurSelfProgress,
        aMaxSelfProgress,
        aCurTotalProgress,
        aMaxTotalProgress,
      ]);
    }

    onProgressChange64(
      aWebProgress,
      aRequest,
      aCurSelfProgress,
      aMaxSelfProgress,
      aCurTotalProgress,
      aMaxTotalProgress
    ) {
__L_V__3({
    lN: 5827,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aCurSelfProgress':aCurSelfProgress,'aMaxSelfProgress':aMaxSelfProgress,'aCurTotalProgress':aCurTotalProgress,'aMaxTotalProgress':aMaxTotalProgress},fN:'onProgressChange64'
  });'__L_V__3';
      return this.onProgressChange(
        aWebProgress,
        aRequest,
        aCurSelfProgress,
        aMaxSelfProgress,
        aCurTotalProgress,
        aMaxTotalProgress
      );
    }

    /* eslint-disable complexity */
    onStateChange(aWebProgress, aRequest, aStateFlags, aStatus) {
__L_V__3({
    lN: 5839,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aStateFlags':aStateFlags,'aStatus':aStatus},fN:'onStateChange'
  });'__L_V__3';
      if (!aRequest) {
__L_V__3({
    lN: 5840,tT:'if',pr:'!aRequest',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      let location, originalLocation;
      try {
        aRequest.QueryInterface(Ci.nsIChannel);
        location = aRequest.URI;
        originalLocation = aRequest.originalURI;
      } catch (ex) {}

      let ignoreBlank = this._isForInitialAboutBlank(
        aWebProgress,
        aStateFlags,
        location
      );

      const {
        STATE_START,
        STATE_STOP,
        STATE_IS_NETWORK,
      } = Ci.nsIWebProgressListener;

      // If we were ignoring some messages about the initial about:blank, and we
      // got the STATE_STOP for it, we'll want to pay attention to those messages
      // from here forward. Similarly, if we conclude that this state change
      // is one that we shouldn't be ignoring, then stop ignoring.
      if (
        (ignoreBlank &&
          aStateFlags & STATE_STOP &&
          aStateFlags & STATE_IS_NETWORK) ||
        (!ignoreBlank && this.mBlank)
      ) {
__L_V__3({
    lN: 5872,tT:'if',pr:' (ignoreBlank && aStateFlags & STATE_STOP && aStateFlags & STATE_IS_NETWORK) || (!ignoreBlank && this.mBlank) ',eT:{},fN:''
  });'__L_V__3';
        this.mBlank = false;
      }

      if (aStateFlags & STATE_START && aStateFlags & STATE_IS_NETWORK) {
__L_V__3({
    lN: 5876,tT:'if',pr:'aStateFlags & STATE_START && aStateFlags & STATE_IS_NETWORK',eT:{},fN:''
  });'__L_V__3';
        this.mRequestCount++;

        if (aWebProgress.isTopLevel) {
__L_V__3({
    lN: 5879,tT:'if',pr:'aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__3';
          // Need to use originalLocation rather than location because things
          // like about:home and about:privatebrowsing arrive with nsIRequest
          // pointing to their resolved jar: or file: URIs.
          if (
            !(
              originalLocation &&
              gInitialPages.includes(originalLocation.spec) &&
              originalLocation != "about:blank" &&
              this.mBrowser.initialPageLoadedFromUserAction !=
                originalLocation.spec &&
              this.mBrowser.currentURI &&
              this.mBrowser.currentURI.spec == "about:blank"
            )
          ) {
__L_V__3({
    lN: 5893,tT:'if',pr:' !( originalLocation && gInitialPages.includes(originalLocation.spec) && originalLocation != about:blank && this.mBrowser.initialPageLoadedFromUserAction != originalLocation.spec && this.mBrowser.currentURI && this.mBrowser.currentURI.spec == about:blank ) ',eT:{},fN:''
  });'__L_V__3';
            // Indicating that we started a load will allow the location
            // bar to be cleared when the load finishes.
            // In order to not overwrite user-typed content, we avoid it
            // (see if condition above) in a very specific case:
            // If the load is of an 'initial' page (e.g. about:privatebrowsing,
            // about:newtab, etc.), was not explicitly typed in the location
            // bar by the user, is not about:blank (because about:blank can be
            // loaded by websites under their principal), and the current
            // page in the browser is about:blank (indicating it is a newly
            // created or re-created browser, e.g. because it just switched
            // remoteness or is a new tab/window).
            this.mBrowser.urlbarChangeTracker.startedLoad();
          }
          delete this.mBrowser.initialPageLoadedFromUserAction;
          // If the browser is loading it must not be crashed anymore
          this.mTab.removeAttribute("crashed");
        }

        if (this._shouldShowProgress(aRequest)) {
__L_V__3({
    lN: 5912,tT:'if',pr:'this._shouldShowProgress(aRequest)',eT:{},fN:''
  });'__L_V__3';
          if (
            !(aStateFlags & Ci.nsIWebProgressListener.STATE_RESTORING) &&
            aWebProgress &&
            aWebProgress.isTopLevel
          ) {
__L_V__3({
    lN: 5917,tT:'if',pr:' !(aStateFlags & Ci.nsIWebProgressListener.STATE_RESTORING) && aWebProgress && aWebProgress.isTopLevel ',eT:{},fN:''
  });'__L_V__3';
            this.mTab.setAttribute("busy", "true");
            gBrowser._tabAttrModified(this.mTab, ["busy"]);
            this.mTab._notselectedsinceload = !this.mTab.selected;
            gBrowser.syncThrobberAnimations(this.mTab);
          }

          if (this.mTab.selected) {
__L_V__3({
    lN: 5924,tT:'if',pr:'this.mTab.selected',eT:{},fN:''
  });'__L_V__3';
            gBrowser._isBusy = true;
          }
        }
      } else if (aStateFlags & STATE_STOP && aStateFlags & STATE_IS_NETWORK) {
__L_V__3({
    lN: 5928,tT:'if',pr:'aStateFlags & STATE_STOP && aStateFlags & STATE_IS_NETWORK',eT:{},fN:''
  });'__L_V__3';
        if (--this.mRequestCount > 0 && aStatus == Cr.NS_ERROR_UNKNOWN_HOST) {
__L_V__3({
    lN: 5929,tT:'if',pr:'--this.mRequestCount > 0 && aStatus == Cr.NS_ERROR_UNKNOWN_HOST',eT:{},fN:''
  });'__L_V__3';
          // to prevent bug 235825: wait for the request handled
          // by the automatic keyword resolver
          return;
        }
        // since we (try to) only handle STATE_STOP of the last request,
        // the count of open requests should now be 0
        this.mRequestCount = 0;

        let modifiedAttrs = [];
        if (this.mTab.hasAttribute("busy")) {
__L_V__3({
    lN: 5939,tT:'if',pr:'this.mTab.hasAttribute(busy)',eT:{},fN:''
  });'__L_V__3';
          this.mTab.removeAttribute("busy");
          modifiedAttrs.push("busy");

          // Only animate the "burst" indicating the page has loaded if
          // the top-level page is the one that finished loading.
          if (
            aWebProgress.isTopLevel &&
            !aWebProgress.isLoadingDocument &&
            Components.isSuccessCode(aStatus) &&
            !gBrowser.tabAnimationsInProgress &&
            Services.prefs.getBoolPref("toolkit.cosmeticAnimations.enabled")
          ) {
__L_V__3({
    lN: 5951,tT:'if',pr:' aWebProgress.isTopLevel && !aWebProgress.isLoadingDocument && Components.isSuccessCode(aStatus) && !gBrowser.tabAnimationsInProgress && Services.prefs.getBoolPref(toolkit.cosmeticAnimations.enabled) ',eT:{},fN:''
  });'__L_V__3';
            if (this.mTab._notselectedsinceload) {
__L_V__3({
    lN: 5952,tT:'if',pr:'this.mTab._notselectedsinceload',eT:{},fN:''
  });'__L_V__3';
              this.mTab.setAttribute("notselectedsinceload", "true");
            } else {
              this.mTab.removeAttribute("notselectedsinceload");
            }

            this.mTab.setAttribute("bursting", "true");
          }
        }

        if (this.mTab.hasAttribute("progress")) {
__L_V__3({
    lN: 5962,tT:'if',pr:'this.mTab.hasAttribute(progress)',eT:{},fN:''
  });'__L_V__3';
          this.mTab.removeAttribute("progress");
          modifiedAttrs.push("progress");
        }

        if (modifiedAttrs.length) {
__L_V__3({
    lN: 5967,tT:'if',pr:'modifiedAttrs.length',eT:{},fN:''
  });'__L_V__3';
          gBrowser._tabAttrModified(this.mTab, modifiedAttrs);
        }

        if (aWebProgress.isTopLevel) {
__L_V__3({
    lN: 5971,tT:'if',pr:'aWebProgress.isTopLevel',eT:{},fN:''
  });'__L_V__3';
          let isSuccessful = Components.isSuccessCode(aStatus);
          if (!isSuccessful && !this.mTab.isEmpty) {
__L_V__3({
    lN: 5973,tT:'if',pr:'!isSuccessful && !this.mTab.isEmpty',eT:{},fN:''
  });'__L_V__3';
            // Restore the current document's location in case the
            // request was stopped (possibly from a content script)
            // before the location changed.

            this.mBrowser.userTypedValue = null;

            let isNavigating = this.mBrowser.isNavigating;
            if (this.mTab.selected && !isNavigating) {
__L_V__3({
    lN: 5981,tT:'if',pr:'this.mTab.selected && !isNavigating',eT:{},fN:''
  });'__L_V__3';
              gURLBar.setURI();
            }
          } else if (isSuccessful) {
__L_V__3({
    lN: 5984,tT:'if',pr:'isSuccessful',eT:{},fN:''
  });'__L_V__3';
            this.mBrowser.urlbarChangeTracker.finishedLoad();
          }
        }

        // If we don't already have an icon for this tab then clear the tab's
        // icon. Don't do this on the initial about:blank load to prevent
        // flickering. Don't clear the icon if we already set it from one of the
        // known defaults. Note we use the original URL since about:newtab
        // redirects to a prerendered page.
        if (
          !this.mBrowser.mIconURL &&
          !ignoreBlank &&
          !(originalLocation.spec in FAVICON_DEFAULTS)
        ) {
__L_V__3({
    lN: 5998,tT:'if',pr:' !this.mBrowser.mIconURL && !ignoreBlank && !(originalLocation.spec in FAVICON_DEFAULTS) ',eT:{},fN:''
  });'__L_V__3';
          this.mTab.removeAttribute("image");
        }

        // For keyword URIs clear the user typed value since they will be changed into real URIs
        if (location.scheme == "keyword") {
__L_V__3({
    lN: 6003,tT:'if',pr:'location.scheme == keyword',eT:{},fN:''
  });'__L_V__3';
          this.mBrowser.userTypedValue = null;
        }

        if (this.mTab.selected) {
__L_V__3({
    lN: 6007,tT:'if',pr:'this.mTab.selected',eT:{},fN:''
  });'__L_V__3';
          gBrowser._isBusy = false;
        }
      }

      if (ignoreBlank) {
__L_V__3({
    lN: 6012,tT:'if',pr:'ignoreBlank',eT:{},fN:''
  });'__L_V__3';
        this._callProgressListeners(
          "onUpdateCurrentBrowser",
          [aStateFlags, aStatus, "", 0],
          true,
          false
        );
      } else {
        this._callProgressListeners(
          "onStateChange",
          [aWebProgress, aRequest, aStateFlags, aStatus],
          true,
          false
        );
      }

      this._callProgressListeners(
        "onStateChange",
        [aWebProgress, aRequest, aStateFlags, aStatus],
        false
      );

      if (aStateFlags & (STATE_START | STATE_STOP)) {
__L_V__3({
    lN: 6034,tT:'if',pr:'aStateFlags & (STATE_START | STATE_STOP)',eT:{},fN:''
  });'__L_V__3';
        // reset cached temporary values at beginning and end
        this.mMessage = "";
        this.mTotalProgress = 0;
      }
      this.mStateFlags = aStateFlags;
      this.mStatus = aStatus;
    }
    /* eslint-enable complexity */

    onLocationChange(aWebProgress, aRequest, aLocation, aFlags) {
__L_V__3({
    lN: 6044,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aLocation':aLocation,'aFlags':aFlags},fN:'onLocationChange'
  });'__L_V__3';
      // OnLocationChange is called for both the top-level content
      // and the subframes.
      let topLevel = aWebProgress.isTopLevel;

      let isSameDocument = !!(
        aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT
      );
      if (topLevel) {
__L_V__3({
    lN: 6052,tT:'if',pr:'topLevel',eT:{},fN:''
  });'__L_V__3';
        let isReload = !!(
          aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_RELOAD
        );
        let isErrorPage = !!(
          aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_ERROR_PAGE
        );

        // We need to clear the typed value
        // if the document failed to load, to make sure the urlbar reflects the
        // failed URI (particularly for SSL errors). However, don't clear the value
        // if the error page's URI is about:blank, because that causes complete
        // loss of urlbar contents for invalid URI errors (see bug 867957).
        // Another reason to clear the userTypedValue is if this was an anchor
        // navigation initiated by the user.
        // Finally, we do insert the URL if this is a same-document navigation
        // and the user cleared the URL manually.
        if (
          this.mBrowser.didStartLoadSinceLastUserTyping() ||
          (isErrorPage && aLocation.spec != "about:blank") ||
          (isSameDocument && this.mBrowser.isNavigating) ||
          (isSameDocument && !this.mBrowser.userTypedValue)
        ) {
__L_V__3({
    lN: 6074,tT:'if',pr:' this.mBrowser.didStartLoadSinceLastUserTyping() || (isErrorPage && aLocation.spec != about:blank) || (isSameDocument && this.mBrowser.isNavigating) || (isSameDocument && !this.mBrowser.userTypedValue) ',eT:{},fN:''
  });'__L_V__3';
          this.mBrowser.userTypedValue = null;
        }

        // If the tab has been set to "busy" outside the stateChange
        // handler below (e.g. by sessionStore.navigateAndRestore), and
        // the load results in an error page, it's possible that there
        // isn't any (STATE_IS_NETWORK & STATE_STOP) state to cause busy
        // attribute being removed. In this case we should remove the
        // attribute here.
        if (isErrorPage && this.mTab.hasAttribute("busy")) {
__L_V__3({
    lN: 6084,tT:'if',pr:'isErrorPage && this.mTab.hasAttribute(busy)',eT:{},fN:''
  });'__L_V__3';
          this.mTab.removeAttribute("busy");
          gBrowser._tabAttrModified(this.mTab, ["busy"]);
        }

        if (!isSameDocument) {
__L_V__3({
    lN: 6089,tT:'if',pr:'!isSameDocument',eT:{},fN:''
  });'__L_V__3';
          // If the browser was playing audio, we should remove the playing state.
          if (this.mTab.hasAttribute("soundplaying")) {
__L_V__3({
    lN: 6091,tT:'if',pr:'this.mTab.hasAttribute(soundplaying)',eT:{},fN:''
  });'__L_V__3';
            clearTimeout(this.mTab._soundPlayingAttrRemovalTimer);
            this.mTab._soundPlayingAttrRemovalTimer = 0;
            this.mTab.removeAttribute("soundplaying");
            gBrowser._tabAttrModified(this.mTab, ["soundplaying"]);
          }

          // If the browser was previously muted, we should restore the muted state.
          if (this.mTab.hasAttribute("muted")) {
__L_V__3({
    lN: 6099,tT:'if',pr:'this.mTab.hasAttribute(muted)',eT:{},fN:''
  });'__L_V__3';
            this.mTab.linkedBrowser.mute();
          }

          if (gBrowser.isFindBarInitialized(this.mTab)) {
__L_V__3({
    lN: 6103,tT:'if',pr:'gBrowser.isFindBarInitialized(this.mTab)',eT:{},fN:''
  });'__L_V__3';
            let findBar = gBrowser.getCachedFindBar(this.mTab);

            // Close the Find toolbar if we're in old-style TAF mode
            if (findBar.findMode != findBar.FIND_NORMAL) {
__L_V__3({
    lN: 6107,tT:'if',pr:'findBar.findMode != findBar.FIND_NORMAL',eT:{},fN:''
  });'__L_V__3';
              findBar.close();
            }
          }

          // Note that we're not updating for same-document loads, despite
          // the `title` argument to `history.pushState/replaceState`. For
          // context, see https://bugzilla.mozilla.org/show_bug.cgi?id=585653
          // and https://github.com/whatwg/html/issues/2174
          if (!isReload) {
__L_V__3({
    lN: 6116,tT:'if',pr:'!isReload',eT:{},fN:''
  });'__L_V__3';
            gBrowser.setTabTitle(this.mTab);
          }

          // Don't clear the favicon if this tab is in the pending
          // state, as SessionStore will have set the icon for us even
          // though we're pointed at an about:blank. Also don't clear it
          // if onLocationChange was triggered by a pushState or a
          // replaceState (bug 550565) or a hash change (bug 408415).
          if (
            !this.mTab.hasAttribute("pending") &&
            aWebProgress.isLoadingDocument
          ) {
__L_V__3({
    lN: 6128,tT:'if',pr:' !this.mTab.hasAttribute(pending) && aWebProgress.isLoadingDocument ',eT:{},fN:''
  });'__L_V__3';
            // Removing the tab's image here causes flickering, wait until the
            // load is complete.
            this.mBrowser.mIconURL = null;
          }
        }

        let userContextId = this.mBrowser.getAttribute("usercontextid") || 0;
        if (this.mBrowser.registeredOpenURI) {
__L_V__3({
    lN: 6136,tT:'if',pr:'this.mBrowser.registeredOpenURI',eT:{},fN:''
  });'__L_V__3';
          let uri = this.mBrowser.registeredOpenURI;
          gBrowser.UrlbarProviderOpenTabs.unregisterOpenTab(
            uri.spec,
            userContextId
          );
          delete this.mBrowser.registeredOpenURI;
        }
        // Tabs in private windows aren't registered as "Open" so
        // that they don't appear as switch-to-tab candidates.
        if (
          !isBlankPageURL(aLocation.spec) &&
          (!PrivateBrowsingUtils.isWindowPrivate(window) ||
            PrivateBrowsingUtils.permanentPrivateBrowsing)
        ) {
__L_V__3({
    lN: 6150,tT:'if',pr:' !isBlankPageURL(aLocation.spec) && (!PrivateBrowsingUtils.isWindowPrivate(window) || PrivateBrowsingUtils.permanentPrivateBrowsing) ',eT:{},fN:''
  });'__L_V__3';
          gBrowser.UrlbarProviderOpenTabs.registerOpenTab(
            aLocation.spec,
            userContextId
          );
          this.mBrowser.registeredOpenURI = aLocation;
        }

        if (this.mTab != gBrowser.selectedTab) {
__L_V__3({
    lN: 6158,tT:'if',pr:'this.mTab != gBrowser.selectedTab',eT:{},fN:''
  });'__L_V__3';
          let tabCacheIndex = gBrowser._tabLayerCache.indexOf(this.mTab);
          if (tabCacheIndex != -1) {
__L_V__3({
    lN: 6160,tT:'if',pr:'tabCacheIndex != -1',eT:{},fN:''
  });'__L_V__3';
            gBrowser._tabLayerCache.splice(tabCacheIndex, 1);
            gBrowser._getSwitcher().cleanUpTabAfterEviction(this.mTab);
          }
        }
      }

      if (!this.mBlank || this.mBrowser.hasContentOpener) {
__L_V__3({
    lN: 6167,tT:'if',pr:'!this.mBlank || this.mBrowser.hasContentOpener',eT:{},fN:''
  });'__L_V__3';
        this._callProgressListeners("onLocationChange", [
          aWebProgress,
          aRequest,
          aLocation,
          aFlags,
        ]);
        if (topLevel && !isSameDocument) {
__L_V__3({
    lN: 6174,tT:'if',pr:'topLevel && !isSameDocument',eT:{},fN:''
  });'__L_V__3';
          // Include the true final argument to indicate that this event is
          // simulated (instead of being observed by the webProgressListener).
          this._callProgressListeners("onContentBlockingEvent", [
            aWebProgress,
            null,
            0,
            true,
          ]);
        }
      }

      if (topLevel) {
__L_V__3({
    lN: 6186,tT:'if',pr:'topLevel',eT:{},fN:''
  });'__L_V__3';
        this.mBrowser.lastURI = aLocation;
        this.mBrowser.lastLocationChange = Date.now();
      }
    }

    onStatusChange(aWebProgress, aRequest, aStatus, aMessage) {
__L_V__3({
    lN: 6192,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aStatus':aStatus,'aMessage':aMessage},fN:'onStatusChange'
  });'__L_V__3';
      if (this.mBlank) {
__L_V__3({
    lN: 6193,tT:'if',pr:'this.mBlank',eT:{},fN:''
  });'__L_V__3';
        return;
      }

      this._callProgressListeners("onStatusChange", [
        aWebProgress,
        aRequest,
        aStatus,
        aMessage,
      ]);

      this.mMessage = aMessage;
    }

    onSecurityChange(aWebProgress, aRequest, aState) {
__L_V__3({
    lN: 6207,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aState':aState},fN:'onSecurityChange'
  });'__L_V__3';
      this._callProgressListeners("onSecurityChange", [
        aWebProgress,
        aRequest,
        aState,
      ]);
    }

    onContentBlockingEvent(aWebProgress, aRequest, aEvent) {
__L_V__3({
    lN: 6215,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aRequest':aRequest,'aEvent':aEvent},fN:'onContentBlockingEvent'
  });'__L_V__3';
      this._callProgressListeners("onContentBlockingEvent", [
        aWebProgress,
        aRequest,
        aEvent,
      ]);
    }

    onRefreshAttempted(aWebProgress, aURI, aDelay, aSameURI) {
__L_V__3({
    lN: 6223,tT:'func',pr:'',eT:{'aWebProgress':aWebProgress,'aURI':aURI,'aDelay':aDelay,'aSameURI':aSameURI},fN:'onRefreshAttempted'
  });'__L_V__3';
      return this._callProgressListeners("onRefreshAttempted", [
        aWebProgress,
        aURI,
        aDelay,
        aSameURI,
      ]);
    }
  }
  TabProgressListener.prototype.QueryInterface = ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsIWebProgressListener2",
    "nsISupportsWeakReference",
  ]);
} // end private scope for gBrowser

var StatusPanel = {
  get panel() {
__L_V__3({
    lN: 6240,tT:'func',pr:'',eT:{},fN:'panel'
  });'__L_V__3';
    delete this.panel;
    return (this.panel = document.getElementById("statuspanel"));
  },

  get isVisible() {
__L_V__3({
    lN: 6245,tT:'func',pr:'',eT:{},fN:'isVisible'
  });'__L_V__3';
    return !this.panel.hasAttribute("inactive");
  },

  update() {
__L_V__3({
    lN: 6249,tT:'func',pr:'',eT:{},fN:'update'
  });'__L_V__3';
    if (BrowserHandler.kiosk) {
__L_V__3({
    lN: 6250,tT:'if',pr:'BrowserHandler.kiosk',eT:{},fN:''
  });'__L_V__3';
      return;
    }
    let text;
    let type;
    let types = ["overLink"];
    if (XULBrowserWindow.busyUI) {
__L_V__3({
    lN: 6256,tT:'if',pr:'XULBrowserWindow.busyUI',eT:{},fN:''
  });'__L_V__3';
      types.push("status");
    }
    types.push("defaultStatus");
    for (type of types) {
      if ((text = XULBrowserWindow[type])) {
__L_V__3({
    lN: 6261,tT:'if',pr:'(text = XULBrowserWindow[type])',eT:{},fN:''
  });'__L_V__3';
        break;
      }
    }

    // If it's a long data: URI that uses base64 encoding, truncate to
    // a reasonable length rather than trying to display the entire thing.
    // We can't shorten arbitrary URIs like this, as bidi etc might mean
    // we need the trailing characters for display. But a base64-encoded
    // data-URI is plain ASCII, so this is OK for status panel display.
    // (See bug 1484071.)
    let textCropped = false;
    if (text.length > 500 && text.match(/^data:[^,]+;base64,/)) {
__L_V__3({
    lN: 6273,tT:'if',pr:'text.length > 500 && text.match(/^data:[^,]+;base64,/)',eT:{},fN:''
  });'__L_V__3';
      text = text.substring(0, 500) + "\u2026";
      textCropped = true;
    }

    if (this._labelElement.value != text || (text && !this.isVisible)) {
__L_V__3({
    lN: 6278,tT:'if',pr:'this._labelElement.value != text || (text && !this.isVisible)',eT:{},fN:''
  });'__L_V__3';
      this.panel.setAttribute("previoustype", this.panel.getAttribute("type"));
      this.panel.setAttribute("type", type);
      this._label = text;
      this._labelElement.setAttribute(
        "crop",
        type == "overLink" && !textCropped ? "center" : "end"
      );
    }
  },

  get _labelElement() {
__L_V__3({
    lN: 6289,tT:'func',pr:'',eT:{},fN:'_labelElement'
  });'__L_V__3';
    delete this._labelElement;
    return (this._labelElement = document.getElementById("statuspanel-label"));
  },

  set _label(val) {
__L_V__3({
    lN: 6294,tT:'func',pr:'',eT:{'val':val},fN:'_label'
  });'__L_V__3';
    if (!this.isVisible) {
__L_V__3({
    lN: 6295,tT:'if',pr:'!this.isVisible',eT:{},fN:''
  });'__L_V__3';
      this.panel.removeAttribute("mirror");
      this.panel.removeAttribute("sizelimit");
    }

    if (
      this.panel.getAttribute("type") == "status" &&
      this.panel.getAttribute("previoustype") == "status"
    ) {
__L_V__3({
    lN: 6303,tT:'if',pr:' this.panel.getAttribute(type) == status && this.panel.getAttribute(previoustype) == status ',eT:{},fN:''
  });'__L_V__3';
      // Before updating the label, set the panel's current width as its
      // min-width to let the panel grow but not shrink and prevent
      // unnecessary flicker while loading pages. We only care about the
      // panel's width once it has been painted, so we can do this
      // without flushing layout.
      this.panel.style.minWidth =
        window.windowUtils.getBoundsWithoutFlushing(this.panel).width + "px";
    } else {
      this.panel.style.minWidth = "";
    }

    if (val) {
__L_V__3({
    lN: 6315,tT:'if',pr:'val',eT:{},fN:''
  });'__L_V__3';
      this._labelElement.value = val;
      this.panel.removeAttribute("inactive");
      MousePosTracker.addListener(this);
    } else {
      this.panel.setAttribute("inactive", "true");
      MousePosTracker.removeListener(this);
    }

    return val;
  },

  getMouseTargetRect() {
__L_V__3({
    lN: 6327,tT:'func',pr:'',eT:{},fN:'getMouseTargetRect'
  });'__L_V__3';
    let container = this.panel.parentNode;
    let panelRect = window.windowUtils.getBoundsWithoutFlushing(this.panel);
    let containerRect = window.windowUtils.getBoundsWithoutFlushing(container);

    return {
      top: panelRect.top,
      bottom: panelRect.bottom,
      left: RTL_UI ? containerRect.right - panelRect.width : containerRect.left,
      right: RTL_UI
        ? containerRect.right
        : containerRect.left + panelRect.width,
    };
  },

  onMouseEnter() {
__L_V__3({
    lN: 6342,tT:'func',pr:'',eT:{},fN:'onMouseEnter'
  });'__L_V__3';
    this._mirror();
  },

  onMouseLeave() {
__L_V__3({
    lN: 6346,tT:'func',pr:'',eT:{},fN:'onMouseLeave'
  });'__L_V__3';
    this._mirror();
  },

  _mirror() {
__L_V__3({
    lN: 6350,tT:'func',pr:'',eT:{},fN:'_mirror'
  });'__L_V__3';
    if (this.panel.hasAttribute("mirror")) {
__L_V__3({
    lN: 6351,tT:'if',pr:'this.panel.hasAttribute(mirror)',eT:{},fN:''
  });'__L_V__3';
      this.panel.removeAttribute("mirror");
    } else {
      this.panel.setAttribute("mirror", "true");
    }

    if (!this.panel.hasAttribute("sizelimit")) {
__L_V__3({
    lN: 6357,tT:'if',pr:'!this.panel.hasAttribute(sizelimit)',eT:{},fN:''
  });'__L_V__3';
      this.panel.setAttribute("sizelimit", "true");
    }
  },
};

var TabBarVisibility = {
  _initialUpdateDone: false,

  update() {
__L_V__3({
    lN: 6366,tT:'func',pr:'',eT:{},fN:'update'
  });'__L_V__3';
    let toolbar = document.getElementById("TabsToolbar");
    let collapse = false;
    if (
      !gBrowser /* gBrowser isn't initialized yet */ ||
      gBrowser.tabs.length - gBrowser._removingTabs.length == 1
    ) {
__L_V__3({
    lN: 6372,tT:'if',pr:' !gBrowser /* gBrowser isnt initialized yet */ || gBrowser.tabs.length - gBrowser._removingTabs.length == 1 ',eT:{},fN:''
  });'__L_V__3';
      collapse = !window.toolbar.visible;
    }

    if (collapse == toolbar.collapsed && this._initialUpdateDone) {
__L_V__3({
    lN: 6376,tT:'if',pr:'collapse == toolbar.collapsed && this._initialUpdateDone',eT:{},fN:''
  });'__L_V__3';
      return;
    }
    this._initialUpdateDone = true;

    toolbar.collapsed = collapse;
    let navbar = document.getElementById("nav-bar");
    navbar.setAttribute("tabs-hidden", collapse);

    document.getElementById("menu_closeWindow").hidden = collapse;
    document
      .getElementById("menu_close")
      .setAttribute(
        "label",
        gTabBrowserBundle.GetStringFromName(
          collapse ? "tabs.close" : "tabs.closeTab"
        )
      );

    TabsInTitlebar.allowedBy("tabs-visible", !collapse);
  },
};

var TabContextMenu = {
  contextTab: null,
  _updateToggleMuteMenuItems(aTab, aConditionFn) {
__L_V__3({
    lN: 6401,tT:'func',pr:'',eT:{'aTab':aTab,'aConditionFn':aConditionFn},fN:'_updateToggleMuteMenuItems'
  });'__L_V__3';
    ["muted", "soundplaying"].forEach(attr => {
      if (!aConditionFn || aConditionFn(attr)) {
__L_V__3({
    lN: 6403,tT:'if',pr:'!aConditionFn || aConditionFn(attr)',eT:{},fN:''
  });'__L_V__3';
        if (aTab.hasAttribute(attr)) {
__L_V__3({
    lN: 6404,tT:'if',pr:'aTab.hasAttribute(attr)',eT:{},fN:''
  });'__L_V__3';
          aTab.toggleMuteMenuItem.setAttribute(attr, "true");
          aTab.toggleMultiSelectMuteMenuItem.setAttribute(attr, "true");
        } else {
          aTab.toggleMuteMenuItem.removeAttribute(attr);
          aTab.toggleMultiSelectMuteMenuItem.removeAttribute(attr);
        }
      }
    });
  },
  updateContextMenu(aPopupMenu) {
__L_V__3({
    lN: 6414,tT:'func',pr:'',eT:{'aPopupMenu':aPopupMenu},fN:'updateContextMenu'
  });'__L_V__3';
    let tab =
      aPopupMenu.triggerNode &&
      (aPopupMenu.triggerNode.tab || aPopupMenu.triggerNode.closest("tab"));

    this.contextTab = tab || gBrowser.selectedTab;

    let disabled = gBrowser.tabs.length == 1;
    let multiselectionContext = this.contextTab.multiselected;

    var menuItems = aPopupMenu.getElementsByAttribute(
      "tbattr",
      "tabbrowser-multiple"
    );
    for (let menuItem of menuItems) {
      menuItem.disabled = disabled;
    }

    if (this.contextTab.hasAttribute("customizemode")) {
__L_V__3({
    lN: 6432,tT:'if',pr:'this.contextTab.hasAttribute(customizemode)',eT:{},fN:''
  });'__L_V__3';
      document.getElementById("context_openTabInWindow").disabled = true;
    }

    disabled = gBrowser.visibleTabs.length == 1;
    menuItems = aPopupMenu.getElementsByAttribute(
      "tbattr",
      "tabbrowser-multiple-visible"
    );
    for (let menuItem of menuItems) {
      menuItem.disabled = disabled;
    }

    // Session store
    document.getElementById("context_undoCloseTab").disabled =
      SessionStore.getClosedTabCount(window) == 0;

    // Only one of Reload_Tab/Reload_Selected_Tabs should be visible.
    document.getElementById("context_reloadTab").hidden = multiselectionContext;
    document.getElementById(
      "context_reloadSelectedTabs"
    ).hidden = !multiselectionContext;

    // Only one of pin/unpin/multiselect-pin/multiselect-unpin should be visible
    let contextPinTab = document.getElementById("context_pinTab");
    contextPinTab.hidden = this.contextTab.pinned || multiselectionContext;
    let contextUnpinTab = document.getElementById("context_unpinTab");
    contextUnpinTab.hidden = !this.contextTab.pinned || multiselectionContext;
    let contextPinSelectedTabs = document.getElementById(
      "context_pinSelectedTabs"
    );
    contextPinSelectedTabs.hidden =
      this.contextTab.pinned || !multiselectionContext;
    let contextUnpinSelectedTabs = document.getElementById(
      "context_unpinSelectedTabs"
    );
    contextUnpinSelectedTabs.hidden =
      !this.contextTab.pinned || !multiselectionContext;

#if 0
    let contextMoveTabOptions = document.getElementById(
      "context_moveTabOptions"
    );
    contextMoveTabOptions.disabled = gBrowser.allTabsSelected();
    document.l10n.setAttributes(
      contextMoveTabOptions,
      multiselectionContext ? "move-tabs" : "move-tab"
    );
    let selectedTabs = gBrowser.selectedTabs;
    let contextMoveTabToEnd = document.getElementById("context_moveToEnd");
    let allSelectedTabsAdjacent = selectedTabs.every(
      (element, index, array) => {
        return array.length > index + 1
          ? element._tPos + 1 == array[index + 1]._tPos
          : true;
      }
    );
    let contextTabIsSelected = this.contextTab.multiselected;
    let visibleTabs = gBrowser.visibleTabs;
    let lastVisibleTab = visibleTabs[visibleTabs.length - 1];
    let tabsToMove = contextTabIsSelected ? selectedTabs : [this.contextTab];
    let lastTabToMove = tabsToMove[tabsToMove.length - 1];

    let isLastPinnedTab = false;
    if (lastTabToMove.pinned) {
__L_V__3({
    lN: 6496,tT:'if',pr:'lastTabToMove.pinned',eT:{},fN:''
  });'__L_V__3';
      let sibling = gBrowser.tabContainer.findNextTab(lastTabToMove);
      isLastPinnedTab = !sibling || !sibling.pinned;
    }
    contextMoveTabToEnd.disabled =
      (lastTabToMove == lastVisibleTab || isLastPinnedTab) &&
      allSelectedTabsAdjacent;
    let contextMoveTabToStart = document.getElementById("context_moveToStart");
    let isFirstTab =
      tabsToMove[0] == visibleTabs[0] ||
      tabsToMove[0] == visibleTabs[gBrowser._numPinnedTabs];
    contextMoveTabToStart.disabled = isFirstTab && allSelectedTabsAdjacent;
#endif

    // Only one of "Duplicate Tab"/"Duplicate Tabs" should be visible.
    document.getElementById(
      "context_duplicateTab"
    ).hidden = multiselectionContext;
    document.getElementById(
      "context_duplicateTabs"
    ).hidden = !multiselectionContext;

    // Disable "Close Tabs to the Right" if there are no tabs
    // following it.
    document.getElementById(
      "context_closeTabsToTheEnd"
    ).disabled = !gBrowser.getTabsToTheEndFrom(this.contextTab).length;

    // Disable "Close other Tabs" if there are no unpinned tabs.
    let unpinnedTabsToClose = multiselectionContext
      ? gBrowser.visibleTabs.filter(t => !t.multiselected && !t.pinned).length
      : gBrowser.visibleTabs.filter(t => t != this.contextTab && !t.pinned)
          .length;
    document.getElementById("context_closeOtherTabs").disabled =
      unpinnedTabsToClose < 1;

    // Only one of close_tab/close_selected_tabs should be visible
    document.getElementById("context_closeTab").hidden = multiselectionContext;
    document.getElementById(
      "context_closeSelectedTabs"
    ).hidden = !multiselectionContext;

    // Hide "Bookmark Tab" for multiselection.
    // Update its state if visible.
    let bookmarkTab = document.getElementById("context_bookmarkTab");
    bookmarkTab.hidden = multiselectionContext;

    // Show "Bookmark Selected Tabs" in a multiselect context and hide it otherwise.
    let bookmarkMultiSelectedTabs = document.getElementById(
      "context_bookmarkSelectedTabs"
    );
    bookmarkMultiSelectedTabs.hidden = !multiselectionContext;

    let toggleMute = document.getElementById("context_toggleMuteTab");
    let toggleMultiSelectMute = document.getElementById(
      "context_toggleMuteSelectedTabs"
    );

    // Only one of mute_unmute_tab/mute_unmute_selected_tabs should be visible
    toggleMute.hidden = multiselectionContext;
    toggleMultiSelectMute.hidden = !multiselectionContext;

    // Adjust the state of the toggle mute menu item.
    if (this.contextTab.hasAttribute("activemedia-blocked")) {
__L_V__3({
    lN: 6559,tT:'if',pr:'this.contextTab.hasAttribute(activemedia-blocked)',eT:{},fN:''
  });'__L_V__3';
      toggleMute.label = gNavigatorBundle.getString("playTab.label");
      toggleMute.accessKey = gNavigatorBundle.getString("playTab.accesskey");
    } else if (this.contextTab.hasAttribute("muted")) {
__L_V__3({
    lN: 6562,tT:'if',pr:'this.contextTab.hasAttribute(muted)',eT:{},fN:''
  });'__L_V__3';
      toggleMute.label = gNavigatorBundle.getString("unmuteTab.label");
      toggleMute.accessKey = gNavigatorBundle.getString("unmuteTab.accesskey");
    } else {
      toggleMute.label = gNavigatorBundle.getString("muteTab.label");
      toggleMute.accessKey = gNavigatorBundle.getString("muteTab.accesskey");
    }

    // Adjust the state of the toggle mute menu item for multi-selected tabs.
    if (this.contextTab.hasAttribute("activemedia-blocked")) {
__L_V__3({
    lN: 6571,tT:'if',pr:'this.contextTab.hasAttribute(activemedia-blocked)',eT:{},fN:''
  });'__L_V__3';
      toggleMultiSelectMute.label = gNavigatorBundle.getString(
        "playTabs.label"
      );
      toggleMultiSelectMute.accessKey = gNavigatorBundle.getString(
        "playTabs.accesskey"
      );
    } else if (this.contextTab.hasAttribute("muted")) {
__L_V__3({
    lN: 6578,tT:'if',pr:'this.contextTab.hasAttribute(muted)',eT:{},fN:''
  });'__L_V__3';
      toggleMultiSelectMute.label = gNavigatorBundle.getString(
        "unmuteSelectedTabs2.label"
      );
      toggleMultiSelectMute.accessKey = gNavigatorBundle.getString(
        "unmuteSelectedTabs2.accesskey"
      );
    } else {
      toggleMultiSelectMute.label = gNavigatorBundle.getString(
        "muteSelectedTabs2.label"
      );
      toggleMultiSelectMute.accessKey = gNavigatorBundle.getString(
        "muteSelectedTabs2.accesskey"
      );
    }

    this.contextTab.toggleMuteMenuItem = toggleMute;
    this.contextTab.toggleMultiSelectMuteMenuItem = toggleMultiSelectMute;
    this._updateToggleMuteMenuItems(this.contextTab);

    // Privateness related menu items.
    const windowIsPrivate = PrivateBrowsingUtils.isWindowPrivate(window);
    const whiteListToggle =
      document.getElementById("context_togglePrivatePinUnpin");
    // CLIQZ-SPECIAL: DB-2322; we show this menu option only for private window and if
    // Enable automatic forget mode is on.
    whiteListToggle.hidden = !windowIsPrivate || !autoForgetTabs.isActive();
    if (!whiteListToggle.hidden) {
__L_V__3({
    lN: 6605,tT:'if',pr:'!whiteListToggle.hidden',eT:{},fN:''
  });'__L_V__3';
      const { spec: currentUrl} = this.contextTab.linkedBrowser.currentURI;
      const isAdult = autoForgetTabs.blacklisted(currentUrl, true);
      whiteListToggle.label = gNavigatorBundle
        .getString(isAdult ? "afw.tabContext.unpinToFW" : "afw.tabContext.pinToFW");
    }

    let selectAllTabs = document.getElementById("context_selectAllTabs");
    selectAllTabs.disabled = gBrowser.allTabsSelected();

    this.contextTab.addEventListener("TabAttrModified", this);
    aPopupMenu.addEventListener("popuphiding", this);

#ifdef MOZ_SERVICES_SYNC
    gSync.updateTabContextMenu(aPopupMenu, this.contextTab);
#endif

    document.getElementById("context_reopenInContainer").hidden =
      !Services.prefs.getBoolPref("privacy.userContext.enabled", false) ||
      PrivateBrowsingUtils.isWindowPrivate(window);
  },

  togglePrivatePinUnpin: function() {
__L_V__3({
    lN: 6627,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__3';
    const { spec: currentUrl} = this.contextTab.linkedBrowser.currentURI;
    const isAdult = autoForgetTabs.blacklisted(currentUrl, true);
    if (isAdult) {
__L_V__3({
    lN: 6630,tT:'if',pr:'isAdult',eT:{},fN:''
  });'__L_V__3';
      autoForgetTabs.whitelistDomain(currentUrl, true);
    } else {
      autoForgetTabs.blacklistDomain(currentUrl, true);
    }
  },

  handleEvent(aEvent) {
__L_V__3({
    lN: 6637,tT:'func',pr:'',eT:{'aEvent':aEvent},fN:'handleEvent'
  });'__L_V__3';
__L_V__3({
    lN: 6638,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__3';
    switch (aEvent.type) {
      case "popuphiding":
        gBrowser.removeEventListener("TabAttrModified", this);
        aEvent.target.removeEventListener("popuphiding", this);
        break;
      case "TabAttrModified":
        let tab = aEvent.target;
        this._updateToggleMuteMenuItems(tab, attr =>
          aEvent.detail.changed.includes(attr)
        );
        break;
    }
  },
  createReopenInContainerMenu(event) {
__L_V__3({
    lN: 6651,tT:'func',pr:'',eT:{'event':event},fN:'createReopenInContainerMenu'
  });'__L_V__3';
    createUserContextMenu(event, {
      isContextMenu: true,
      excludeUserContextId: this.contextTab.getAttribute("usercontextid"),
    });
  },
  duplicateSelectedTabs() {
__L_V__3({
    lN: 6657,tT:'func',pr:'',eT:{},fN:'duplicateSelectedTabs'
  });'__L_V__3';
    let tabsToDuplicate = gBrowser.selectedTabs;
    let newIndex = tabsToDuplicate[tabsToDuplicate.length - 1]._tPos + 1;
    for (let tab of tabsToDuplicate) {
      let newTab = SessionStore.duplicateTab(window, tab);
      gBrowser.moveTabTo(newTab, newIndex++);
    }
  },
  reopenInContainer(event) {
__L_V__3({
    lN: 6665,tT:'func',pr:'',eT:{'event':event},fN:'reopenInContainer'
  });'__L_V__3';
    let userContextId = parseInt(
      event.target.getAttribute("data-usercontextid")
    );
    let reopenedTabs = this.contextTab.multiselected
      ? gBrowser.selectedTabs
      : [this.contextTab];

    for (let tab of reopenedTabs) {
      if (tab.getAttribute("usercontextid") == userContextId) {
__L_V__3({
    lN: 6674,tT:'if',pr:'tab.getAttribute(usercontextid) == userContextId',eT:{},fN:''
  });'__L_V__3';
        continue;
      }

      /* Create a triggering principal that is able to load the new tab
         For content principals that are about: chrome: or resource: we need system to load them.
         Anything other than system principal needs to have the new userContextId.
      */
      let triggeringPrincipal;

      if (tab.linkedPanel) {
__L_V__3({
    lN: 6684,tT:'if',pr:'tab.linkedPanel',eT:{},fN:''
  });'__L_V__3';
        triggeringPrincipal = tab.linkedBrowser.contentPrincipal;
      } else {
        // For lazy tab browsers, get the original principal
        // from SessionStore
        let tabState = JSON.parse(SessionStore.getTabState(tab));
        try {
          triggeringPrincipal = E10SUtils.deserializePrincipal(
            tabState.triggeringPrincipal_base64
          );
        } catch (ex) {
          continue;
        }
      }

      if (!triggeringPrincipal || triggeringPrincipal.isNullPrincipal) {
__L_V__3({
    lN: 6699,tT:'if',pr:'!triggeringPrincipal || triggeringPrincipal.isNullPrincipal',eT:{},fN:''
  });'__L_V__3';
        // Ensure that we have a null principal if we couldn't
        // deserialize it (for lazy tab browsers) ...
        // This won't always work however is safe to use.
        triggeringPrincipal = Services.scriptSecurityManager.createNullPrincipal(
          { userContextId }
        );
      } else if (triggeringPrincipal.isContentPrincipal) {
__L_V__3({
    lN: 6706,tT:'if',pr:'triggeringPrincipal.isContentPrincipal',eT:{},fN:''
  });'__L_V__3';
        triggeringPrincipal = Services.scriptSecurityManager.createContentPrincipal(
          triggeringPrincipal.URI,
          { userContextId }
        );
      }

      let newTab = gBrowser.addTab(tab.linkedBrowser.currentURI.spec, {
        userContextId,
        pinned: tab.pinned,
        index: tab._tPos + 1,
        triggeringPrincipal,
      });

      if (gBrowser.selectedTab == tab) {
__L_V__3({
    lN: 6720,tT:'if',pr:'gBrowser.selectedTab == tab',eT:{},fN:''
  });'__L_V__3';
        gBrowser.selectedTab = newTab;
      }
      if (tab.muted && !newTab.muted) {
__L_V__3({
    lN: 6723,tT:'if',pr:'tab.muted && !newTab.muted',eT:{},fN:''
  });'__L_V__3';
        newTab.toggleMuteAudio(tab.muteReason);
      }
    }
  },
};
