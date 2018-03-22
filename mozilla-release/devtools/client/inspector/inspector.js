/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global window, BrowserLoader */

"use strict";

const Services = require("Services");
const promise = require("promise");
const EventEmitter = require("devtools/shared/old-event-emitter");
const {executeSoon} = require("devtools/shared/DevToolsUtils");
const {Task} = require("devtools/shared/task");
const {PrefObserver} = require("devtools/client/shared/prefs");
const Telemetry = require("devtools/client/shared/telemetry");
const HighlightersOverlay = require("devtools/client/inspector/shared/highlighters-overlay");
const ReflowTracker = require("devtools/client/inspector/shared/reflow-tracker");
const Store = require("devtools/client/inspector/store");

// Use privileged promise in panel documents to prevent having them to freeze
// during toolbox destruction. See bug 1402779.
const Promise = require("Promise");

loader.lazyRequireGetter(this, "initCssProperties", "devtools/shared/fronts/css-properties", true);
loader.lazyRequireGetter(this, "HTMLBreadcrumbs", "devtools/client/inspector/breadcrumbs", true);
loader.lazyRequireGetter(this, "KeyShortcuts", "devtools/client/shared/key-shortcuts");
loader.lazyRequireGetter(this, "InspectorSearch", "devtools/client/inspector/inspector-search", true);
loader.lazyRequireGetter(this, "ToolSidebar", "devtools/client/inspector/toolsidebar", true);
loader.lazyRequireGetter(this, "MarkupView", "devtools/client/inspector/markup/markup");
loader.lazyRequireGetter(this, "nodeConstants", "devtools/shared/dom-node-constants");
loader.lazyRequireGetter(this, "Menu", "devtools/client/framework/menu");
loader.lazyRequireGetter(this, "MenuItem", "devtools/client/framework/menu-item");
loader.lazyRequireGetter(this, "ExtensionSidebar", "devtools/client/inspector/extensions/extension-sidebar");
loader.lazyRequireGetter(this, "CommandUtils", "devtools/client/shared/developer-toolbar", true);
loader.lazyRequireGetter(this, "clipboardHelper", "devtools/shared/platform/clipboard");

const {LocalizationHelper, localizeMarkup} = require("devtools/shared/l10n");
const INSPECTOR_L10N =
      new LocalizationHelper("devtools/client/locales/inspector.properties");
loader.lazyGetter(this, "TOOLBOX_L10N", function () {
  return new LocalizationHelper("devtools/client/locales/toolbox.properties");
});

// Sidebar dimensions
const INITIAL_SIDEBAR_SIZE = 350;

// If the toolbox width is smaller than given amount of pixels,
// the sidebar automatically switches from 'landscape' to 'portrait' mode.
const PORTRAIT_MODE_WIDTH = 700;

const SHOW_SPLIT_SIDEBAR_TOGGLE_PREF = "devtools.inspector.split-sidebar-toggle";
const SPLIT_RULE_VIEW_PREF = "devtools.inspector.split-rule-enabled";

/**
 * Represents an open instance of the Inspector for a tab.
 * The inspector controls the breadcrumbs, the markup view, and the sidebar
 * (computed view, rule view, font view and animation inspector).
 *
 * Events:
 * - ready
 *      Fired when the inspector panel is opened for the first time and ready to
 *      use
 * - new-root
 *      Fired after a new root (navigation to a new page) event was fired by
 *      the walker, and taken into account by the inspector (after the markup
 *      view has been reloaded)
 * - markuploaded
 *      Fired when the markup-view frame has loaded
 * - breadcrumbs-updated
 *      Fired when the breadcrumb widget updates to a new node
 * - boxmodel-view-updated
 *      Fired when the box model updates to a new node
 * - markupmutation
 *      Fired after markup mutations have been processed by the markup-view
 * - computed-view-refreshed
 *      Fired when the computed rules view updates to a new node
 * - computed-view-property-expanded
 *      Fired when a property is expanded in the computed rules view
 * - computed-view-property-collapsed
 *      Fired when a property is collapsed in the computed rules view
 * - computed-view-sourcelinks-updated
 *      Fired when the stylesheet source links have been updated (when switching
 *      to source-mapped files)
 * - rule-view-refreshed
 *      Fired when the rule view updates to a new node
 * - rule-view-sourcelinks-updated
 *      Fired when the stylesheet source links have been updated (when switching
 *      to source-mapped files)
 */
function Inspector(toolbox) {
  EventEmitter.decorate(this);

  this._toolbox = toolbox;
  this._target = toolbox.target;
  this.panelDoc = window.document;
  this.panelWin = window;
  this.panelWin.inspector = this;

  // Map [panel id => panel instance]
  // Stores all the instances of sidebar panels like rule view, computed view, ...
  this._panels = new Map();

  this.highlighters = new HighlightersOverlay(this);
  this.prefsObserver = new PrefObserver("devtools.");
  this.reflowTracker = new ReflowTracker(this._target);
  this.store = Store();
  this.telemetry = new Telemetry();

  // Store the URL of the target page prior to navigation in order to ensure
  // telemetry counts in the Grid Inspector are not double counted on reload.
  this.previousURL = this.target.url;

  this.showSplitSidebarToggle = Services.prefs.getBoolPref(
    SHOW_SPLIT_SIDEBAR_TOGGLE_PREF);
  this.isSplitRuleViewEnabled = Services.prefs.getBoolPref(SPLIT_RULE_VIEW_PREF);

  this.nodeMenuTriggerInfo = null;

  this._handleRejectionIfNotDestroyed = this._handleRejectionIfNotDestroyed.bind(this);
  this._onContextMenu = this._onContextMenu.bind(this);
  this._onBeforeNavigate = this._onBeforeNavigate.bind(this);
  this._onMarkupFrameLoad = this._onMarkupFrameLoad.bind(this);
  this._updateSearchResultsLabel = this._updateSearchResultsLabel.bind(this);

  this.onDetached = this.onDetached.bind(this);
  this.onMarkupLoaded = this.onMarkupLoaded.bind(this);
  this.onNewSelection = this.onNewSelection.bind(this);
  this.onNewRoot = this.onNewRoot.bind(this);
  this.onPanelWindowResize = this.onPanelWindowResize.bind(this);
  this.onShowBoxModelHighlighterForNode =
    this.onShowBoxModelHighlighterForNode.bind(this);
  this.onSidebarHidden = this.onSidebarHidden.bind(this);
  this.onSidebarResized = this.onSidebarResized.bind(this);
  this.onSidebarSelect = this.onSidebarSelect.bind(this);
  this.onSidebarShown = this.onSidebarShown.bind(this);
  this.onSidebarToggle = this.onSidebarToggle.bind(this);
  this.onSplitRuleViewPrefChanged = this.onSplitRuleViewPrefChanged.bind(this);

  this._target.on("will-navigate", this._onBeforeNavigate);
  this.prefsObserver.on(SPLIT_RULE_VIEW_PREF, this.onSplitRuleViewPrefChanged);
}

Inspector.prototype = {
  /**
   * open is effectively an asynchronous constructor
   */
  init: Task.async(function* () {
    // Localize all the nodes containing a data-localization attribute.
    localizeMarkup(this.panelDoc);

    this._cssPropertiesLoaded = initCssProperties(this.toolbox);
    yield this._cssPropertiesLoaded;
    yield this.target.makeRemote();
    yield this._getPageStyle();

    // This may throw if the document is still loading and we are
    // refering to a dead about:blank document
    let defaultSelection = yield this._getDefaultNodeForSelection()
      .catch(this._handleRejectionIfNotDestroyed);

    return yield this._deferredOpen(defaultSelection);
  }),

  get toolbox() {
    return this._toolbox;
  },

  get inspector() {
    return this._toolbox.inspector;
  },

  get walker() {
    return this._toolbox.walker;
  },

  get selection() {
    return this._toolbox.selection;
  },

  get highlighter() {
    return this._toolbox.highlighter;
  },

  get isOuterHTMLEditable() {
    return this._target.client.traits.editOuterHTML;
  },

  get hasUrlToImageDataResolver() {
    return this._target.client.traits.urlToImageDataResolver;
  },

  get canGetUniqueSelector() {
    return this._target.client.traits.getUniqueSelector;
  },

  get canGetCssPath() {
    return this._target.client.traits.getCssPath;
  },

  get canGetXPath() {
    return this._target.client.traits.getXPath;
  },

  get canGetUsedFontFaces() {
    return this._target.client.traits.getUsedFontFaces;
  },

  get canPasteInnerOrAdjacentHTML() {
    return this._target.client.traits.pasteHTML;
  },

  /**
   * Handle promise rejections for various asynchronous actions, and only log errors if
   * the inspector panel still exists.
   * This is useful to silence useless errors that happen when the inspector is closed
   * while still initializing (and making protocol requests).
   */
  _handleRejectionIfNotDestroyed: function (e) {
    if (!this._panelDestroyer) {
      console.error(e);
    }
  },

  _deferredOpen: async function (defaultSelection) {
    this.breadcrumbs = new HTMLBreadcrumbs(this);

    this.walker.on("new-root", this.onNewRoot);

    this.selection.on("new-node-front", this.onNewSelection);
    this.selection.on("detached-front", this.onDetached);

    if (this.target.isLocalTab) {
      // Show a warning when the debugger is paused.
      // We show the warning only when the inspector
      // is selected.
      this.updateDebuggerPausedWarning = () => {
        let notificationBox = this._toolbox.getNotificationBox();
        let notification =
          notificationBox.getNotificationWithValue("inspector-script-paused");
        if (!notification && this._toolbox.currentToolId == "inspector" &&
            this._toolbox.threadClient.paused) {
          let message = INSPECTOR_L10N.getStr("debuggerPausedWarning.message");
          notificationBox.appendNotification(message,
            "inspector-script-paused", "", notificationBox.PRIORITY_WARNING_HIGH);
        }

        if (notification && this._toolbox.currentToolId != "inspector") {
          notificationBox.removeNotification(notification);
        }

        if (notification && !this._toolbox.threadClient.paused) {
          notificationBox.removeNotification(notification);
        }
      };
      this.target.on("thread-paused", this.updateDebuggerPausedWarning);
      this.target.on("thread-resumed", this.updateDebuggerPausedWarning);
      this._toolbox.on("select", this.updateDebuggerPausedWarning);
      this.updateDebuggerPausedWarning();
    }

    this._initMarkup();
    this.isReady = false;

    this.setupSearchBox();

    // Setup the splitter before the sidebar is displayed so,
    // we don't miss any events.
    this.setupSplitter();

    // We can display right panel with: tab bar, markup view and breadbrumb. Right after
    // the splitter set the right and left panel sizes, in order to avoid resizing it
    // during load of the inspector.
    this.panelDoc.getElementById("inspector-main-content").style.visibility = "visible";

    this.setupSidebar();
    this.setupExtensionSidebars();

    await this.once("markuploaded");
    this.isReady = true;

    // All the components are initialized. Let's select a node.
    if (defaultSelection) {
      let onAllPanelsUpdated = this.once("inspector-updated");
      this.selection.setNodeFront(defaultSelection, "inspector-open");
      await onAllPanelsUpdated;
      await this.markup.expandNode(this.selection.nodeFront);
    }

    // And setup the toolbar only now because it may depend on the document.
    await this.setupToolbar();
    this.emit("ready");
    return this;
  },

  _onBeforeNavigate: function () {
    this._defaultNode = null;
    this.selection.setNodeFront(null);
    this._destroyMarkup();
    this._pendingSelection = null;
  },

  _getPageStyle: function () {
    return this.inspector.getPageStyle().then(pageStyle => {
      this.pageStyle = pageStyle;
    }, this._handleRejectionIfNotDestroyed);
  },

  /**
   * Return a promise that will resolve to the default node for selection.
   */
  _getDefaultNodeForSelection: function () {
    if (this._defaultNode) {
      return this._defaultNode;
    }
    let walker = this.walker;
    let rootNode = null;
    let pendingSelection = this._pendingSelection;

    // A helper to tell if the target has or is about to navigate.
    // this._pendingSelection changes on "will-navigate" and "new-root" events.
    let hasNavigated = () => pendingSelection !== this._pendingSelection;

    // If available, set either the previously selected node or the body
    // as default selected, else set documentElement
    return walker.getRootNode().then(node => {
      if (hasNavigated()) {
        return promise.reject("navigated; resolution of _defaultNode aborted");
      }

      rootNode = node;
      if (this.selectionCssSelector) {
        return walker.querySelector(rootNode, this.selectionCssSelector);
      }
      return null;
    }).then(front => {
      if (hasNavigated()) {
        return promise.reject("navigated; resolution of _defaultNode aborted");
      }

      if (front) {
        return front;
      }
      return walker.querySelector(rootNode, "body");
    }).then(front => {
      if (hasNavigated()) {
        return promise.reject("navigated; resolution of _defaultNode aborted");
      }

      if (front) {
        return front;
      }
      return this.walker.documentElement();
    }).then(node => {
      if (hasNavigated()) {
        return promise.reject("navigated; resolution of _defaultNode aborted");
      }
      this._defaultNode = node;
      return node;
    });
  },

  /**
   * Target getter.
   */
  get target() {
    return this._target;
  },

  /**
   * Target setter.
   */
  set target(value) {
    this._target = value;
  },

  /**
   * Hooks the searchbar to show result and auto completion suggestions.
   */
  setupSearchBox: function () {
    this.searchBox = this.panelDoc.getElementById("inspector-searchbox");
    this.searchClearButton = this.panelDoc.getElementById("inspector-searchinput-clear");
    this.searchResultsLabel = this.panelDoc.getElementById("inspector-searchlabel");

    this.search = new InspectorSearch(this, this.searchBox, this.searchClearButton);
    this.search.on("search-cleared", this._updateSearchResultsLabel);
    this.search.on("search-result", this._updateSearchResultsLabel);

    let shortcuts = new KeyShortcuts({
      window: this.panelDoc.defaultView,
    });
    let key = INSPECTOR_L10N.getStr("inspector.searchHTML.key");
    shortcuts.on(key, (name, event) => {
      // Prevent overriding same shortcut from the computed/rule views
      if (event.target.closest("#sidebar-panel-ruleview") ||
          event.target.closest("#sidebar-panel-computedview")) {
        return;
      }
      event.preventDefault();
      this.searchBox.focus();
    });
  },

  get searchSuggestions() {
    return this.search.autocompleter;
  },

  _updateSearchResultsLabel: function (event, result) {
    let str = "";
    if (event !== "search-cleared") {
      if (result) {
        str = INSPECTOR_L10N.getFormatStr(
          "inspector.searchResultsCount2", result.resultsIndex + 1, result.resultsLength);
      } else {
        str = INSPECTOR_L10N.getStr("inspector.searchResultsNone");
      }
    }

    this.searchResultsLabel.textContent = str;
  },

  get React() {
    return this._toolbox.React;
  },

  get ReactDOM() {
    return this._toolbox.ReactDOM;
  },

  get ReactRedux() {
    return this._toolbox.ReactRedux;
  },

  get browserRequire() {
    return this._toolbox.browserRequire;
  },

  get InspectorTabPanel() {
    if (!this._InspectorTabPanel) {
      this._InspectorTabPanel =
        this.React.createFactory(this.browserRequire(
        "devtools/client/inspector/components/InspectorTabPanel"));
    }
    return this._InspectorTabPanel;
  },

  /**
   * Check if the inspector should use the landscape mode.
   *
   * @return {Boolean} true if the inspector should be in landscape mode.
   */
  useLandscapeMode: function () {
    let { clientWidth } = this.panelDoc.getElementById("inspector-splitter-box");
    return clientWidth > PORTRAIT_MODE_WIDTH;
  },

  /**
   * Build Splitter located between the main and side area of
   * the Inspector panel.
   */
  setupSplitter: function () {
    let SplitBox = this.React.createFactory(this.browserRequire(
      "devtools/client/shared/components/splitter/SplitBox"));
    let { width, height, splitSidebarWidth } = this.getSidebarSize();

    let splitter = SplitBox({
      className: "inspector-sidebar-splitter",
      initialWidth: width,
      initialHeight: height,
      minSize: "10%",
      maxSize: "80%",
      splitterSize: 1,
      endPanelControl: true,
      startPanel: this.InspectorTabPanel({
        id: "inspector-main-content"
      }),
      endPanel: SplitBox({
        initialWidth: splitSidebarWidth,
        minSize: 10,
        maxSize: "80%",
        splitterSize: this.isSplitRuleViewEnabled ? 1 : 0,
        endPanelControl: false,
        startPanel: this.InspectorTabPanel({
          id: "inspector-rules-container"
        }),
        endPanel: this.InspectorTabPanel({
          id: "inspector-sidebar-container"
        }),
        ref: splitbox => {
          this.sidebarSplitBox = splitbox;
        },
      }),
      vert: this.useLandscapeMode(),
      onControlledPanelResized: this.onSidebarResized,
    });

    this.splitBox = this.ReactDOM.render(splitter,
      this.panelDoc.getElementById("inspector-splitter-box"));

    this.panelWin.addEventListener("resize", this.onPanelWindowResize, true);
  },

  /**
   * Splitter clean up.
   */
  teardownSplitter: function () {
    this.panelWin.removeEventListener("resize", this.onPanelWindowResize, true);

    this.sidebar.off("show", this.onSidebarShown);
    this.sidebar.off("hide", this.onSidebarHidden);
    this.sidebar.off("destroy", this.onSidebarHidden);
  },

  /**
   * If Toolbox width is less than 600 px, the splitter changes its mode
   * to `horizontal` to support portrait view.
   */
  onPanelWindowResize: function () {
    this.splitBox.setState({
      vert: this.useLandscapeMode(),
    });
  },

  getSidebarSize: function () {
    let width;
    let height;
    let splitSidebarWidth;

    // Initialize splitter size from preferences.
    try {
      width = Services.prefs.getIntPref("devtools.toolsidebar-width.inspector");
      height = Services.prefs.getIntPref("devtools.toolsidebar-height.inspector");
      splitSidebarWidth = Services.prefs.getIntPref(
        "devtools.toolsidebar-width.inspector.splitsidebar");
    } catch (e) {
      // Set width and height of the splitter. Only one
      // value is really useful at a time depending on the current
      // orientation (vertical/horizontal).
      // Having both is supported by the splitter component.
      width = this.isSplitRuleViewEnabled ?
        INITIAL_SIDEBAR_SIZE * 2 : INITIAL_SIDEBAR_SIZE;
      height = INITIAL_SIDEBAR_SIZE;
      splitSidebarWidth = INITIAL_SIDEBAR_SIZE;
    }

    return { width, height, splitSidebarWidth };
  },

  onSidebarHidden: function () {
    // Store the current splitter size to preferences.
    let state = this.splitBox.state;
    Services.prefs.setIntPref("devtools.toolsidebar-width.inspector", state.width);
    Services.prefs.setIntPref("devtools.toolsidebar-height.inspector", state.height);
    Services.prefs.setIntPref("devtools.toolsidebar-width.inspector.splitsidebar",
      this.sidebarSplitBox.state.width);
  },

  onSidebarResized: function (width, height) {
    this.toolbox.emit("inspector-sidebar-resized", { width, height });
  },

  onSidebarSelect: function (event, toolId) {
    // Save the currently selected sidebar panel
    Services.prefs.setCharPref("devtools.inspector.activeSidebar", toolId);

    // Then forces the panel creation by calling getPanel
    // (This allows lazy loading the panels only once we select them)
    this.getPanel(toolId);

    this.toolbox.emit("inspector-sidebar-select", toolId);
  },

  onSidebarShown: function () {
    let { width, height, splitSidebarWidth } = this.getSidebarSize();
    this.splitBox.setState({ width, height });
    this.sidebarSplitBox.setState({ width: splitSidebarWidth });
  },

  onSidebarToggle: function () {
    Services.prefs.setBoolPref(SPLIT_RULE_VIEW_PREF, !this.isSplitRuleViewEnabled);
  },

  async onSplitRuleViewPrefChanged() {
    // Update the stored value of the split rule view preference since it changed.
    this.isSplitRuleViewEnabled = Services.prefs.getBoolPref(SPLIT_RULE_VIEW_PREF);

    await this.setupToolbar();
    await this.addRuleView();
  },

  /**
   * Adds the rule view to the main or split sidebar depending on whether or not it is
   * split view mode. The default tab specifies whether or not the rule view should be
   * selected. The defaultTab defaults to the rule view when the rule view is being merged
   * back into the sidebar from the split sidebar. Otherwise, we specify the default tab
   * when handling the sidebar setup.
   *
   * @params {String} defaultTab
   *         Thie id of the default tab for the sidebar.
   */
  async addRuleView(defaultTab = "ruleview") {
    let ruleViewSidebar = this.sidebarSplitBox.startPanelContainer;

    if (this.isSplitRuleViewEnabled) {
      // Removes the rule view from the main sidebar and adds the rule view to the split
      // sidebar.
      ruleViewSidebar.style.display = "block";

      // The sidebar toggle might not be setup yet on the initial setup.
      if (this.sidebarToggle) {
        this.sidebarToggle.setState({ collapsed: false });
      }

      // Show the splitter inside the sidebar split box.
      this.sidebarSplitBox.setState({ splitterSize: 1 });

      // Force the rule view panel creation by calling getPanel
      this.getPanel("ruleview");

      await this.sidebar.removeTab("ruleview");

      this.ruleViewSideBar.addExistingTab(
        "ruleview",
        INSPECTOR_L10N.getStr("inspector.sidebar.ruleViewTitle"),
        true);

      this.ruleViewSideBar.show("ruleview");
    } else {
      // Removes the rule view from the split sidebar and adds the rule view to the main
      // sidebar.
      ruleViewSidebar.style.display = "none";

      // The sidebar toggle might not be setup yet on the initial setup.
      if (this.sidebarToggle) {
        this.sidebarToggle.setState({ collapsed: true });
      }

      // Hide the splitter to prevent any drag events in the sidebar split box.
      this.sidebarSplitBox.setState({ splitterSize: 0 });

      this.ruleViewSideBar.hide();
      await this.ruleViewSideBar.removeTab("ruleview");

      this.sidebar.addExistingTab(
        "ruleview",
        INSPECTOR_L10N.getStr("inspector.sidebar.ruleViewTitle"),
        defaultTab == "ruleview",
        0);
    }
  },

  /**
   * Lazily get and create panel instances displayed in the sidebar
   */
  getPanel: function (id) {
    if (this._panels.has(id)) {
      return this._panels.get(id);
    }
    let panel;
    switch (id) {
      case "computedview":
        const {ComputedViewTool} =
          this.browserRequire("devtools/client/inspector/computed/computed");
        panel = new ComputedViewTool(this, this.panelWin);
        break;
      case "ruleview":
        const {RuleViewTool} = require("devtools/client/inspector/rules/rules");
        panel = new RuleViewTool(this, this.panelWin);
        break;
      case "boxmodel":
        // box-model isn't a panel on its own, it used to, now it is being used by
        // computed view and layout which retrieves an instance via getPanel.
        const BoxModel = require("devtools/client/inspector/boxmodel/box-model");
        panel = new BoxModel(this, this.panelWin);
        break;
      default:
        // This is a custom panel or a non lazy-loaded one.
        return null;
    }
    this._panels.set(id, panel);
    return panel;
  },

  /**
   * Build the sidebar.
   */
  async setupSidebar() {
    let sidebar = this.panelDoc.getElementById("inspector-sidebar");
    this.sidebar = new ToolSidebar(sidebar, this, "inspector", {
      showAllTabsMenu: true
    });

    let ruleSideBar = this.panelDoc.getElementById("inspector-rules-sidebar");
    this.ruleViewSideBar = new ToolSidebar(ruleSideBar, this, "inspector", {
      hideTabstripe: true
    });

    this.sidebar.on("select", this.onSidebarSelect);

    let defaultTab = Services.prefs.getCharPref("devtools.inspector.activeSidebar");

    if (this.isSplitRuleViewEnabled && defaultTab === "ruleview") {
      defaultTab = "computedview";
    }

    // Append all side panels

    await this.addRuleView(defaultTab);

    this.sidebar.addExistingTab(
      "computedview",
      INSPECTOR_L10N.getStr("inspector.sidebar.computedViewTitle"),
      defaultTab == "computedview");

    // Inject a lazy loaded react tab by exposing a fake React object
    // with a lazy defined Tab thanks to `panel` being a function
    let layoutId = "layoutview";
    let layoutTitle = INSPECTOR_L10N.getStr("inspector.sidebar.layoutViewTitle2");
    this.sidebar.addTab(
      layoutId,
      layoutTitle,
      {
        props: {
          id: layoutId,
          title: layoutTitle
        },
        panel: () => {
          if (!this.layoutview) {
            const LayoutView =
              this.browserRequire("devtools/client/inspector/layout/layout");
            this.layoutview = new LayoutView(this, this.panelWin);
          }

          return this.layoutview.provider;
        }
      },
      defaultTab == layoutId);

    if (Services.prefs.getBoolPref("devtools.changesview.enabled")) {
      // Inject a lazy loaded react tab by exposing a fake React object
      // with a lazy defined Tab thanks to `panel` being a function
      let changesId = "changesview";
      let changesTitle = INSPECTOR_L10N.getStr("inspector.sidebar.changesViewTitle");
      this.sidebar.addTab(
        changesId,
        changesTitle,
        {
          props: {
            id: changesId,
            title: changesTitle
          },
          panel: () => {
            if (!this.changesview) {
              const ChangesView =
                this.browserRequire("devtools/client/inspector/changes/changes");
              this.changesview = new ChangesView(this, this.panelWin);
            }

            return this.changesview.provider;
          }
        },
        defaultTab == changesId);
    }

    if (Services.prefs.getBoolPref("devtools.eventsview.enabled")) {
      // Inject a lazy loaded react tab by exposing a fake React object
      // with a lazy defined Tab thanks to `panel` being a function
      let eventsId = "eventsview";
      let eventsTitle = INSPECTOR_L10N.getStr("inspector.sidebar.eventsViewTitle");
      this.sidebar.addTab(
        eventsId,
        eventsTitle,
        {
          props: {
            id: eventsId,
            title: eventsTitle
          },
          panel: () => {
            if (!this.eventview) {
              const EventsView =
                this.browserRequire("devtools/client/inspector/events/events");
              this.eventsview = new EventsView(this, this.panelWin);
            }

            return this.eventsview.provider;
          }
        },
        defaultTab == eventsId);
    }

    if (this.target.form.animationsActor) {
      const animationTitle =
        INSPECTOR_L10N.getStr("inspector.sidebar.animationInspectorTitle");

      if (Services.prefs.getBoolPref("devtools.new-animationinspector.enabled")) {
        const animationId = "newanimationinspector";

        this.sidebar.addTab(
          animationId,
          animationTitle,
          {
            props: {
              id: animationId,
              title: animationTitle
            },
            panel: () => {
              const AnimationInspector =
                this.browserRequire("devtools/client/inspector/animation/animation");
              this.animationinspector = new AnimationInspector(this, this.panelWin);
              return this.animationinspector.provider;
            }
          },
          defaultTab == animationId);
      } else {
        this.sidebar.addFrameTab(
          "animationinspector",
          animationTitle,
          "chrome://devtools/content/animationinspector/animation-inspector.xhtml",
          defaultTab == "animationinspector");
      }
    }

    if (this.canGetUsedFontFaces) {
      // Inject a lazy loaded react tab by exposing a fake React object
      // with a lazy defined Tab thanks to `panel` being a function
      let fontId = "fontinspector";
      let fontTitle = INSPECTOR_L10N.getStr("inspector.sidebar.fontInspectorTitle");
      this.sidebar.addTab(
        fontId,
        fontTitle,
        {
          props: {
            id: fontId,
            title: fontTitle
          },
          panel: () => {
            if (!this.fontinspector) {
              const FontInspector =
                this.browserRequire("devtools/client/inspector/fonts/fonts");
              this.fontinspector = new FontInspector(this, this.panelWin);
            }

            return this.fontinspector.provider;
          }
        },
        defaultTab == fontId);
    }

    // Persist splitter state in preferences.
    this.sidebar.on("show", this.onSidebarShown);
    this.sidebar.on("hide", this.onSidebarHidden);
    this.sidebar.on("destroy", this.onSidebarHidden);

    this.sidebar.show(defaultTab);
  },

  /**
   * Setup any extension sidebar already registered to the toolbox when the inspector.
   * has been created for the first time.
   */
  setupExtensionSidebars() {
    for (const [sidebarId, {title}] of this.toolbox.inspectorExtensionSidebars) {
      this.addExtensionSidebar(sidebarId, {title});
    }
  },

  /**
   * Create a side-panel tab controlled by an extension
   * using the devtools.panels.elements.createSidebarPane and sidebar object API
   *
   * @param {String} id
   *        An unique id for the sidebar tab.
   * @param {Object} options
   * @param {String} options.title
   *        The tab title
   */
  addExtensionSidebar: function (id, {title}) {
    if (this._panels.has(id)) {
      throw new Error(`Cannot create an extension sidebar for the existent id: ${id}`);
    }

    const extensionSidebar = new ExtensionSidebar(this, {id, title});

    // TODO(rpl): pass some extension metadata (e.g. extension name and icon) to customize
    // the render of the extension title (e.g. use the icon in the sidebar and show the
    // extension name in a tooltip).
    this.addSidebarTab(id, title, extensionSidebar.provider, false);

    this._panels.set(id, extensionSidebar);

    // Emit the created ExtensionSidebar instance to the listeners registered
    // on the toolbox by the "devtools.panels.elements" WebExtensions API.
    this.toolbox.emit(`extension-sidebar-created-${id}`, extensionSidebar);
  },

  /**
   * Remove and destroy a side-panel tab controlled by an extension (e.g. when the
   * extension has been disable/uninstalled while the toolbox and inspector were
   * still open).
   *
   * @param {String} id
   *        The id of the sidebar tab to destroy.
   */
  removeExtensionSidebar: function (id) {
    if (!this._panels.has(id)) {
      throw new Error(`Unable to find a sidebar panel with id "${id}"`);
    }

    const panel = this._panels.get(id);

    if (!(panel instanceof ExtensionSidebar)) {
      throw new Error(`The sidebar panel with id "${id}" is not an ExtensionSidebar`);
    }

    this._panels.delete(id);
    this.sidebar.removeTab(id);
    panel.destroy();
  },

  /**
   * Register a side-panel tab. This API can be used outside of
   * DevTools (e.g. from an extension) as well as by DevTools
   * code base.
   *
   * @param {string} tab uniq id
   * @param {string} title tab title
   * @param {React.Component} panel component. See `InspectorPanelTab` as an example.
   * @param {boolean} selected true if the panel should be selected
   */
  addSidebarTab: function (id, title, panel, selected) {
    this.sidebar.addTab(id, title, panel, selected);
  },

  /**
   * Method to check whether the document is a HTML document and
   * pickColorFromPage method is available or not.
   *
   * @return {Boolean} true if the eyedropper highlighter is supported by the current
   *         document.
   */
  supportsEyeDropper: Task.async(function* () {
    try {
      let hasSupportsHighlighters =
        yield this.target.actorHasMethod("inspector", "supportsHighlighters");

      let supportsHighlighters;
      if (hasSupportsHighlighters) {
        supportsHighlighters = yield this.inspector.supportsHighlighters();
      } else {
        // If the actor does not provide the supportsHighlighter method, fallback to
        // check if the selected node's document is a HTML document.
        let { nodeFront } = this.selection;
        supportsHighlighters = nodeFront && nodeFront.isInHTMLDocument;
      }

      return supportsHighlighters;
    } catch (e) {
      console.error(e);
      return false;
    }
  }),

  setupToolbar: Task.async(function* () {
    this.teardownToolbar();

    // Setup the add-node button.
    this.addNode = this.addNode.bind(this);
    this.addNodeButton = this.panelDoc.getElementById("inspector-element-add-button");
    this.addNodeButton.addEventListener("click", this.addNode);

    // Setup the eye-dropper icon if we're in an HTML document and we have actor support.
    let canShowEyeDropper = yield this.supportsEyeDropper();

    // Bail out if the inspector was destroyed in the meantime and panelDoc is no longer
    // available.
    if (!this.panelDoc) {
      return;
    }

    if (canShowEyeDropper) {
      this.onEyeDropperDone = this.onEyeDropperDone.bind(this);
      this.onEyeDropperButtonClicked = this.onEyeDropperButtonClicked.bind(this);
      this.eyeDropperButton = this.panelDoc
                                    .getElementById("inspector-eyedropper-toggle");
      this.eyeDropperButton.disabled = false;
      this.eyeDropperButton.title = INSPECTOR_L10N.getStr("inspector.eyedropper.label");
      this.eyeDropperButton.addEventListener("click", this.onEyeDropperButtonClicked);
    } else {
      let eyeDropperButton = this.panelDoc.getElementById("inspector-eyedropper-toggle");
      eyeDropperButton.disabled = true;
      eyeDropperButton.title = INSPECTOR_L10N.getStr("eyedropper.disabled.title");
    }

    // Setup the sidebar toggle button if the split rule view is enabled.
    if (this.showSplitSidebarToggle && !this.sidebarToggle) {
      let SidebarToggle = this.React.createFactory(this.browserRequire(
        "devtools/client/shared/components/SidebarToggle"));

      let sidebarToggle = SidebarToggle({
        collapsed: !this.isSplitRuleViewEnabled,
        collapsePaneTitle: INSPECTOR_L10N.getStr("inspector.hideSplitRulesView"),
        expandPaneTitle: INSPECTOR_L10N.getStr("inspector.showSplitRulesView"),
        onClick: this.onSidebarToggle
      });

      let parentBox = this.panelDoc.getElementById("inspector-sidebar-toggle-box");
      this.sidebarToggle = this.ReactDOM.render(sidebarToggle, parentBox);
    }
  }),

  teardownToolbar: function () {
    if (this.addNodeButton) {
      this.addNodeButton.removeEventListener("click", this.addNode);
      this.addNodeButton = null;
    }

    if (this.eyeDropperButton) {
      this.eyeDropperButton.removeEventListener("click", this.onEyeDropperButtonClicked);
      this.eyeDropperButton = null;
    }
  },

  /**
   * Reset the inspector on new root mutation.
   */
  onNewRoot: function () {
    // Record new-root timing for telemetry
    this._newRootStart = this.panelWin.performance.now();

    this._defaultNode = null;
    this.selection.setNodeFront(null);
    this._destroyMarkup();

    let onNodeSelected = defaultNode => {
      // Cancel this promise resolution as a new one had
      // been queued up.
      if (this._pendingSelection != onNodeSelected) {
        return;
      }
      this._pendingSelection = null;
      this.selection.setNodeFront(defaultNode, "navigateaway");

      this._initMarkup();
      this.once("markuploaded", this.onMarkupLoaded);

      // Setup the toolbar again, since its content may depend on the current document.
      this.setupToolbar();
    };
    this._pendingSelection = onNodeSelected;
    this._getDefaultNodeForSelection()
        .then(onNodeSelected, this._handleRejectionIfNotDestroyed);
  },

  /**
   * Handler for "markuploaded" event fired on a new root mutation and after the markup
   * view is initialized. Expands the current selected node and restores the saved
   * highlighter state.
   */
  onMarkupLoaded: Task.async(function* () {
    if (!this.markup) {
      return;
    }

    let onExpand = this.markup.expandNode(this.selection.nodeFront);

    // Restore the highlighter states prior to emitting "new-root".
    yield Promise.all([
      this.highlighters.restoreFlexboxState(),
      this.highlighters.restoreGridState(),
      this.highlighters.restoreShapeState()
    ]);

    this.emit("new-root");

    // Wait for full expand of the selected node in order to ensure
    // the markup view is fully emitted before firing 'reloaded'.
    // 'reloaded' is used to know when the panel is fully updated
    // after a page reload.
    yield onExpand;

    this.emit("reloaded");

    // Record the time between new-root event and inspector fully loaded.
    if (this._newRootStart) {
      // Only log the timing when inspector is not destroyed and is in foreground.
      if (this.toolbox && this.toolbox.currentToolId == "inspector") {
        let delay = this.panelWin.performance.now() - this._newRootStart;
        let telemetryKey = "DEVTOOLS_INSPECTOR_NEW_ROOT_TO_RELOAD_DELAY_MS";
        let histogram = Services.telemetry.getHistogramById(telemetryKey);
        histogram.add(delay);
      }
      delete this._newRootStart;
    }
  }),

  _selectionCssSelector: null,

  /**
   * Set the currently selected node unique css selector.
   * Will store the current target url along with it to allow pre-selection at
   * reload
   */
  set selectionCssSelector(cssSelector = null) {
    if (this._panelDestroyer) {
      return;
    }

    this._selectionCssSelector = {
      selector: cssSelector,
      url: this._target.url
    };
  },

  /**
   * Get the current selection unique css selector if any, that is, if a node
   * is actually selected and that node has been selected while on the same url
   */
  get selectionCssSelector() {
    if (this._selectionCssSelector &&
        this._selectionCssSelector.url === this._target.url) {
      return this._selectionCssSelector.selector;
    }
    return null;
  },

  /**
   * Can a new HTML element be inserted into the currently selected element?
   * @return {Boolean}
   */
  canAddHTMLChild: function () {
    let selection = this.selection;

    // Don't allow to insert an element into these elements. This should only
    // contain elements where walker.insertAdjacentHTML has no effect.
    let invalidTagNames = ["html", "iframe"];

    return selection.isHTMLNode() &&
           selection.isElementNode() &&
           !selection.isPseudoElementNode() &&
           !selection.isAnonymousNode() &&
           invalidTagNames.indexOf(
            selection.nodeFront.nodeName.toLowerCase()) === -1;
  },

  /**
   * When a new node is selected.
   */
  onNewSelection: function (event, value, reason) {
    if (reason === "selection-destroy") {
      return;
    }

    // Wait for all the known tools to finish updating and then let the
    // client know.
    let selection = this.selection.nodeFront;

    // Update the state of the add button in the toolbar depending on the
    // current selection.
    let btn = this.panelDoc.querySelector("#inspector-element-add-button");
    if (this.canAddHTMLChild()) {
      btn.removeAttribute("disabled");
    } else {
      btn.setAttribute("disabled", "true");
    }

    // On any new selection made by the user, store the unique css selector
    // of the selected node so it can be restored after reload of the same page
    if (this.canGetUniqueSelector &&
        this.selection.isElementNode()) {
      selection.getUniqueSelector().then(selector => {
        this.selectionCssSelector = selector;
      }, this._handleRejectionIfNotDestroyed);
    }

    let selfUpdate = this.updating("inspector-panel");
    executeSoon(() => {
      try {
        selfUpdate(selection);
      } catch (ex) {
        console.error(ex);
      }
    });
  },

  /**
   * Delay the "inspector-updated" notification while a tool
   * is updating itself.  Returns a function that must be
   * invoked when the tool is done updating with the node
   * that the tool is viewing.
   */
  updating: function (name) {
    if (this._updateProgress && this._updateProgress.node != this.selection.nodeFront) {
      this.cancelUpdate();
    }

    if (!this._updateProgress) {
      // Start an update in progress.
      let self = this;
      this._updateProgress = {
        node: this.selection.nodeFront,
        outstanding: new Set(),
        checkDone: function () {
          if (this !== self._updateProgress) {
            return;
          }
          // Cancel update if there is no `selection` anymore.
          // It can happen if the inspector panel is already destroyed.
          if (!self.selection || (this.node !== self.selection.nodeFront)) {
            self.cancelUpdate();
            return;
          }
          if (this.outstanding.size !== 0) {
            return;
          }

          self._updateProgress = null;
          self.emit("inspector-updated", name);
        },
      };
    }

    let progress = this._updateProgress;
    let done = function () {
      progress.outstanding.delete(done);
      progress.checkDone();
    };
    progress.outstanding.add(done);
    return done;
  },

  /**
   * Cancel notification of inspector updates.
   */
  cancelUpdate: function () {
    this._updateProgress = null;
  },

  /**
   * When a node is deleted, select its parent node or the defaultNode if no
   * parent is found (may happen when deleting an iframe inside which the
   * node was selected).
   */
  onDetached: function (event, parentNode) {
    this.breadcrumbs.cutAfter(this.breadcrumbs.indexOf(parentNode));
    this.selection.setNodeFront(parentNode ? parentNode : this._defaultNode, "detached");
  },

  /**
   * Destroy the inspector.
   */
  destroy: function () {
    if (this._panelDestroyer) {
      return this._panelDestroyer;
    }

    if (this.walker) {
      this.walker.off("new-root", this.onNewRoot);
      this.pageStyle = null;
    }

    this.cancelUpdate();

    this.prefsObserver.off(SPLIT_RULE_VIEW_PREF, this.onSplitRuleViewPrefChanged);
    this.target.off("will-navigate", this._onBeforeNavigate);
    this.target.off("thread-paused", this.updateDebuggerPausedWarning);
    this.target.off("thread-resumed", this.updateDebuggerPausedWarning);
    this._toolbox.off("select", this.updateDebuggerPausedWarning);

    for (let [, panel] of this._panels) {
      panel.destroy();
    }
    this._panels.clear();

    if (this.layoutview) {
      this.layoutview.destroy();
    }

    if (this.fontinspector) {
      this.fontinspector.destroy();
    }

    if (this.animationinspector) {
      this.animationinspector.destroy();
    }

    let cssPropertiesDestroyer = this._cssPropertiesLoaded.then(({front}) => {
      if (front) {
        front.destroy();
      }
    });

    this.sidebar.off("select", this.onSidebarSelect);
    let sidebarDestroyer = this.sidebar.destroy();

    let ruleViewSideBarDestroyer = this.ruleViewSideBar ?
      this.ruleViewSideBar.destroy() : null;

    this.teardownSplitter();

    this.teardownToolbar();
    this.breadcrumbs.destroy();
    this.selection.off("new-node-front", this.onNewSelection);
    this.selection.off("detached-front", this.onDetached);

    let markupDestroyer = this._destroyMarkup();

    this.highlighters.destroy();
    this.prefsObserver.destroy();
    this.reflowTracker.destroy();
    this.search.destroy();

    this._toolbox = null;
    this.breadcrumbs = null;
    this.highlighters = null;
    this.panelDoc = null;
    this.panelWin.inspector = null;
    this.panelWin = null;
    this.prefsObserver = null;
    this.resultsLength = null;
    this.search = null;
    this.searchBox = null;
    this.sidebar = null;
    this.store = null;
    this.target = null;

    this._panelDestroyer = promise.all([
      cssPropertiesDestroyer,
      markupDestroyer,
      sidebarDestroyer,
      ruleViewSideBarDestroyer
    ]);

    return this._panelDestroyer;
  },

  /**
   * Returns the clipboard content if it is appropriate for pasting
   * into the current node's outer HTML, otherwise returns null.
   */
  _getClipboardContentForPaste: function () {
    let content = clipboardHelper.getText();
    if (content && content.trim().length > 0) {
      return content;
    }
    return null;
  },

  _onContextMenu: function (e) {
    if (e.originalTarget.closest("input[type=text]") ||
        e.originalTarget.closest("input:not([type])") ||
        e.originalTarget.closest("textarea")) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    this._openMenu({
      screenX: e.screenX,
      screenY: e.screenY,
      target: e.target,
    });
  },

  _openMenu: function ({ target, screenX = 0, screenY = 0 } = { }) {
    let markupContainer = this.markup.getContainer(this.selection.nodeFront);

    this.contextMenuTarget = target;
    this.nodeMenuTriggerInfo = markupContainer &&
      markupContainer.editor.getInfoAtNode(target);

    let isSelectionElement = this.selection.isElementNode() &&
                             !this.selection.isPseudoElementNode();
    let isEditableElement = isSelectionElement &&
                            !this.selection.isAnonymousNode();
    let isDuplicatableElement = isSelectionElement &&
                                !this.selection.isAnonymousNode() &&
                                !this.selection.isRoot();
    let isScreenshotable = isSelectionElement &&
                           this.canGetUniqueSelector &&
                           this.selection.nodeFront.isTreeDisplayed;

    let menu = new Menu();
    menu.append(new MenuItem({
      id: "node-menu-edithtml",
      label: INSPECTOR_L10N.getStr("inspectorHTMLEdit.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorHTMLEdit.accesskey"),
      disabled: !isEditableElement || !this.isOuterHTMLEditable,
      click: () => this.editHTML(),
    }));
    menu.append(new MenuItem({
      id: "node-menu-add",
      label: INSPECTOR_L10N.getStr("inspectorAddNode.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorAddNode.accesskey"),
      disabled: !this.canAddHTMLChild(),
      click: () => this.addNode(),
    }));
    menu.append(new MenuItem({
      id: "node-menu-duplicatenode",
      label: INSPECTOR_L10N.getStr("inspectorDuplicateNode.label"),
      disabled: !isDuplicatableElement,
      click: () => this.duplicateNode(),
    }));
    menu.append(new MenuItem({
      id: "node-menu-delete",
      label: INSPECTOR_L10N.getStr("inspectorHTMLDelete.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorHTMLDelete.accesskey"),
      disabled: !this.isDeletable(this.selection.nodeFront),
      click: () => this.deleteNode(),
    }));

    menu.append(new MenuItem({
      label: INSPECTOR_L10N.getStr("inspectorAttributesSubmenu.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorAttributesSubmenu.accesskey"),
      submenu: this._getAttributesSubmenu(isEditableElement),
    }));

    menu.append(new MenuItem({
      type: "separator",
    }));

    // Set the pseudo classes
    for (let name of ["hover", "active", "focus"]) {
      let menuitem = new MenuItem({
        id: "node-menu-pseudo-" + name,
        label: name,
        type: "checkbox",
        click: this.togglePseudoClass.bind(this, ":" + name),
      });

      if (isSelectionElement) {
        let checked = this.selection.nodeFront.hasPseudoClassLock(":" + name);
        menuitem.checked = checked;
      } else {
        menuitem.disabled = true;
      }

      menu.append(menuitem);
    }

    menu.append(new MenuItem({
      type: "separator",
    }));

    menu.append(new MenuItem({
      label: INSPECTOR_L10N.getStr("inspectorCopyHTMLSubmenu.label"),
      submenu: this._getCopySubmenu(markupContainer, isSelectionElement),
    }));

    menu.append(new MenuItem({
      label: INSPECTOR_L10N.getStr("inspectorPasteHTMLSubmenu.label"),
      submenu: this._getPasteSubmenu(isEditableElement),
    }));

    menu.append(new MenuItem({
      type: "separator",
    }));

    let isNodeWithChildren = this.selection.isNode() &&
                             markupContainer.hasChildren;
    menu.append(new MenuItem({
      id: "node-menu-expand",
      label: INSPECTOR_L10N.getStr("inspectorExpandNode.label"),
      disabled: !isNodeWithChildren,
      click: () => this.expandNode(),
    }));
    menu.append(new MenuItem({
      id: "node-menu-collapse",
      label: INSPECTOR_L10N.getStr("inspectorCollapseAll.label"),
      disabled: !isNodeWithChildren || !markupContainer.expanded,
      click: () => this.collapseAll(),
    }));

    menu.append(new MenuItem({
      type: "separator",
    }));

    menu.append(new MenuItem({
      id: "node-menu-scrollnodeintoview",
      label: INSPECTOR_L10N.getStr("inspectorScrollNodeIntoView.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorScrollNodeIntoView.accesskey"),
      disabled: !isSelectionElement,
      click: () => this.scrollNodeIntoView(),
    }));
    menu.append(new MenuItem({
      id: "node-menu-screenshotnode",
      label: INSPECTOR_L10N.getStr("inspectorScreenshotNode.label"),
      disabled: !isScreenshotable,
      click: () => this.screenshotNode().catch(console.error),
    }));
    menu.append(new MenuItem({
      id: "node-menu-useinconsole",
      label: INSPECTOR_L10N.getStr("inspectorUseInConsole.label"),
      click: () => this.useInConsole(),
    }));
    menu.append(new MenuItem({
      id: "node-menu-showdomproperties",
      label: INSPECTOR_L10N.getStr("inspectorShowDOMProperties.label"),
      click: () => this.showDOMProperties(),
    }));

    let nodeLinkMenuItems = this._getNodeLinkMenuItems();
    if (nodeLinkMenuItems.filter(item => item.visible).length > 0) {
      menu.append(new MenuItem({
        id: "node-menu-link-separator",
        type: "separator",
      }));
    }

    for (let menuitem of nodeLinkMenuItems) {
      menu.append(menuitem);
    }

    menu.popup(screenX, screenY, this._toolbox);
    return menu;
  },

  _getCopySubmenu: function (markupContainer, isSelectionElement) {
    let copySubmenu = new Menu();
    copySubmenu.append(new MenuItem({
      id: "node-menu-copyinner",
      label: INSPECTOR_L10N.getStr("inspectorCopyInnerHTML.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorCopyInnerHTML.accesskey"),
      disabled: !isSelectionElement,
      click: () => this.copyInnerHTML(),
    }));
    copySubmenu.append(new MenuItem({
      id: "node-menu-copyouter",
      label: INSPECTOR_L10N.getStr("inspectorCopyOuterHTML.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorCopyOuterHTML.accesskey"),
      disabled: !isSelectionElement,
      click: () => this.copyOuterHTML(),
    }));
    copySubmenu.append(new MenuItem({
      id: "node-menu-copyuniqueselector",
      label: INSPECTOR_L10N.getStr("inspectorCopyCSSSelector.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorCopyCSSSelector.accesskey"),
      disabled: !isSelectionElement,
      hidden: !this.canGetUniqueSelector,
      click: () => this.copyUniqueSelector(),
    }));
    copySubmenu.append(new MenuItem({
      id: "node-menu-copycsspath",
      label: INSPECTOR_L10N.getStr("inspectorCopyCSSPath.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorCopyCSSPath.accesskey"),
      disabled: !isSelectionElement,
      hidden: !this.canGetCssPath,
      click: () => this.copyCssPath(),
    }));
    copySubmenu.append(new MenuItem({
      id: "node-menu-copyxpath",
      label: INSPECTOR_L10N.getStr("inspectorCopyXPath.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorCopyXPath.accesskey"),
      disabled: !isSelectionElement,
      hidden: !this.canGetXPath,
      click: () => this.copyXPath(),
    }));
    copySubmenu.append(new MenuItem({
      id: "node-menu-copyimagedatauri",
      label: INSPECTOR_L10N.getStr("inspectorImageDataUri.label"),
      disabled: !isSelectionElement || !markupContainer ||
                !markupContainer.isPreviewable(),
      click: () => this.copyImageDataUri(),
    }));

    return copySubmenu;
  },

  _getPasteSubmenu: function (isEditableElement) {
    let isPasteable = isEditableElement && this._getClipboardContentForPaste();
    let disableAdjacentPaste = !isPasteable ||
          !this.canPasteInnerOrAdjacentHTML || this.selection.isRoot() ||
          this.selection.isBodyNode() || this.selection.isHeadNode();
    let disableFirstLastPaste = !isPasteable ||
          !this.canPasteInnerOrAdjacentHTML || (this.selection.isHTMLNode() &&
          this.selection.isRoot());

    let pasteSubmenu = new Menu();
    pasteSubmenu.append(new MenuItem({
      id: "node-menu-pasteinnerhtml",
      label: INSPECTOR_L10N.getStr("inspectorPasteInnerHTML.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorPasteInnerHTML.accesskey"),
      disabled: !isPasteable || !this.canPasteInnerOrAdjacentHTML,
      click: () => this.pasteInnerHTML(),
    }));
    pasteSubmenu.append(new MenuItem({
      id: "node-menu-pasteouterhtml",
      label: INSPECTOR_L10N.getStr("inspectorPasteOuterHTML.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorPasteOuterHTML.accesskey"),
      disabled: !isPasteable || !this.isOuterHTMLEditable,
      click: () => this.pasteOuterHTML(),
    }));
    pasteSubmenu.append(new MenuItem({
      id: "node-menu-pastebefore",
      label: INSPECTOR_L10N.getStr("inspectorHTMLPasteBefore.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorHTMLPasteBefore.accesskey"),
      disabled: disableAdjacentPaste,
      click: () => this.pasteAdjacentHTML("beforeBegin"),
    }));
    pasteSubmenu.append(new MenuItem({
      id: "node-menu-pasteafter",
      label: INSPECTOR_L10N.getStr("inspectorHTMLPasteAfter.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorHTMLPasteAfter.accesskey"),
      disabled: disableAdjacentPaste,
      click: () => this.pasteAdjacentHTML("afterEnd"),
    }));
    pasteSubmenu.append(new MenuItem({
      id: "node-menu-pastefirstchild",
      label: INSPECTOR_L10N.getStr("inspectorHTMLPasteFirstChild.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorHTMLPasteFirstChild.accesskey"),
      disabled: disableFirstLastPaste,
      click: () => this.pasteAdjacentHTML("afterBegin"),
    }));
    pasteSubmenu.append(new MenuItem({
      id: "node-menu-pastelastchild",
      label: INSPECTOR_L10N.getStr("inspectorHTMLPasteLastChild.label"),
      accesskey:
        INSPECTOR_L10N.getStr("inspectorHTMLPasteLastChild.accesskey"),
      disabled: disableFirstLastPaste,
      click: () => this.pasteAdjacentHTML("beforeEnd"),
    }));

    return pasteSubmenu;
  },

  _getAttributesSubmenu: function (isEditableElement) {
    let attributesSubmenu = new Menu();
    let nodeInfo = this.nodeMenuTriggerInfo;
    let isAttributeClicked = isEditableElement && nodeInfo &&
                              nodeInfo.type === "attribute";

    attributesSubmenu.append(new MenuItem({
      id: "node-menu-add-attribute",
      label: INSPECTOR_L10N.getStr("inspectorAddAttribute.label"),
      accesskey: INSPECTOR_L10N.getStr("inspectorAddAttribute.accesskey"),
      disabled: !isEditableElement,
      click: () => this.onAddAttribute(),
    }));
    attributesSubmenu.append(new MenuItem({
      id: "node-menu-copy-attribute",
      label: INSPECTOR_L10N.getFormatStr("inspectorCopyAttributeValue.label",
                                        isAttributeClicked ? `${nodeInfo.value}` : ""),
      accesskey: INSPECTOR_L10N.getStr("inspectorCopyAttributeValue.accesskey"),
      disabled: !isAttributeClicked,
      click: () => this.onCopyAttributeValue(),
    }));
    attributesSubmenu.append(new MenuItem({
      id: "node-menu-edit-attribute",
      label: INSPECTOR_L10N.getFormatStr("inspectorEditAttribute.label",
                                        isAttributeClicked ? `${nodeInfo.name}` : ""),
      accesskey: INSPECTOR_L10N.getStr("inspectorEditAttribute.accesskey"),
      disabled: !isAttributeClicked,
      click: () => this.onEditAttribute(),
    }));
    attributesSubmenu.append(new MenuItem({
      id: "node-menu-remove-attribute",
      label: INSPECTOR_L10N.getFormatStr("inspectorRemoveAttribute.label",
                                        isAttributeClicked ? `${nodeInfo.name}` : ""),
      accesskey: INSPECTOR_L10N.getStr("inspectorRemoveAttribute.accesskey"),
      disabled: !isAttributeClicked,
      click: () => this.onRemoveAttribute(),
    }));

    return attributesSubmenu;
  },

  /**
   * Link menu items can be shown or hidden depending on the context and
   * selected node, and their labels can vary.
   *
   * @return {Array} list of visible menu items related to links.
   */
  _getNodeLinkMenuItems: function () {
    let linkFollow = new MenuItem({
      id: "node-menu-link-follow",
      visible: false,
      click: () => this.onFollowLink(),
    });
    let linkCopy = new MenuItem({
      id: "node-menu-link-copy",
      visible: false,
      click: () => this.onCopyLink(),
    });

    // Get information about the right-clicked node.
    let popupNode = this.contextMenuTarget;
    if (!popupNode || !popupNode.classList.contains("link")) {
      return [linkFollow, linkCopy];
    }

    let type = popupNode.dataset.type;
    if ((type === "uri" || type === "cssresource" || type === "jsresource")) {
      // Links can't be opened in new tabs in the browser toolbox.
      if (type === "uri" && !this.target.chrome) {
        linkFollow.visible = true;
        linkFollow.label = INSPECTOR_L10N.getStr(
          "inspector.menu.openUrlInNewTab.label");
      } else if (type === "cssresource") {
        linkFollow.visible = true;
        linkFollow.label = TOOLBOX_L10N.getStr(
          "toolbox.viewCssSourceInStyleEditor.label");
      } else if (type === "jsresource") {
        linkFollow.visible = true;
        linkFollow.label = TOOLBOX_L10N.getStr(
          "toolbox.viewJsSourceInDebugger.label");
      }

      linkCopy.visible = true;
      linkCopy.label = INSPECTOR_L10N.getStr(
        "inspector.menu.copyUrlToClipboard.label");
    } else if (type === "idref") {
      linkFollow.visible = true;
      linkFollow.label = INSPECTOR_L10N.getFormatStr(
        "inspector.menu.selectElement.label", popupNode.dataset.link);
    }

    return [linkFollow, linkCopy];
  },

  _initMarkup: function () {
    let doc = this.panelDoc;

    this._markupBox = doc.getElementById("markup-box");

    // create tool iframe
    this._markupFrame = doc.createElement("iframe");
    this._markupFrame.setAttribute("flex", "1");
    // This is needed to enable tooltips inside the iframe document.
    this._markupFrame.setAttribute("tooltip", "aHTMLTooltip");
    this._markupFrame.addEventListener("contextmenu", this._onContextMenu);

    this._markupBox.style.visibility = "hidden";
    this._markupBox.appendChild(this._markupFrame);

    this._markupFrame.addEventListener("load", this._onMarkupFrameLoad, true);
    this._markupFrame.setAttribute("src", "markup/markup.xhtml");
    this._markupFrame.setAttribute("aria-label",
      INSPECTOR_L10N.getStr("inspector.panelLabel.markupView"));
  },

  _onMarkupFrameLoad: function () {
    this._markupFrame.removeEventListener("load", this._onMarkupFrameLoad, true);

    this._markupFrame.contentWindow.focus();

    this.markup = new MarkupView(this, this._markupFrame, this._toolbox.win);

    this._markupBox.style.visibility = "visible";
    this.emit("markuploaded");
  },

  _destroyMarkup: function () {
    let destroyPromise;

    if (this._markupFrame) {
      this._markupFrame.removeEventListener("load", this._onMarkupFrameLoad, true);
      this._markupFrame.removeEventListener("contextmenu", this._onContextMenu);
    }

    if (this.markup) {
      destroyPromise = this.markup.destroy();
      this.markup = null;
    } else {
      destroyPromise = promise.resolve();
    }

    if (this._markupFrame) {
      this._markupFrame.remove();
      this._markupFrame = null;
    }

    this._markupBox = null;

    return destroyPromise;
  },

  onEyeDropperButtonClicked: function () {
    this.eyeDropperButton.classList.contains("checked")
      ? this.hideEyeDropper()
      : this.showEyeDropper();
  },

  startEyeDropperListeners: function () {
    this.inspector.once("color-pick-canceled", this.onEyeDropperDone);
    this.inspector.once("color-picked", this.onEyeDropperDone);
    this.walker.once("new-root", this.onEyeDropperDone);
  },

  stopEyeDropperListeners: function () {
    this.inspector.off("color-pick-canceled", this.onEyeDropperDone);
    this.inspector.off("color-picked", this.onEyeDropperDone);
    this.walker.off("new-root", this.onEyeDropperDone);
  },

  onEyeDropperDone: function () {
    this.eyeDropperButton.classList.remove("checked");
    this.stopEyeDropperListeners();
  },

  /**
   * Show the eyedropper on the page.
   * @return {Promise} resolves when the eyedropper is visible.
   */
  showEyeDropper: function () {
    // The eyedropper button doesn't exist, most probably because the actor doesn't
    // support the pickColorFromPage, or because the page isn't HTML.
    if (!this.eyeDropperButton) {
      return null;
    }

    this.telemetry.toolOpened("toolbareyedropper");
    this.eyeDropperButton.classList.add("checked");
    this.startEyeDropperListeners();
    return this.inspector.pickColorFromPage(this.toolbox, {copyOnSelect: true})
                         .catch(console.error);
  },

  /**
   * Hide the eyedropper.
   * @return {Promise} resolves when the eyedropper is hidden.
   */
  hideEyeDropper: function () {
    // The eyedropper button doesn't exist, most probably  because the page isn't HTML.
    if (!this.eyeDropperButton) {
      return null;
    }

    this.eyeDropperButton.classList.remove("checked");
    this.stopEyeDropperListeners();
    return this.inspector.cancelPickColorFromPage()
                         .catch(console.error);
  },

  /**
   * Create a new node as the last child of the current selection, expand the
   * parent and select the new node.
   */
  addNode: Task.async(function* () {
    if (!this.canAddHTMLChild()) {
      return;
    }

    let html = "<div></div>";

    // Insert the html and expect a childList markup mutation.
    let onMutations = this.once("markupmutation");
    yield this.walker.insertAdjacentHTML(this.selection.nodeFront, "beforeEnd", html);
    yield onMutations;

    // Expand the parent node.
    this.markup.expandNode(this.selection.nodeFront);
  }),

  /**
   * Toggle a pseudo class.
   */
  togglePseudoClass: function (pseudo) {
    if (this.selection.isElementNode()) {
      let node = this.selection.nodeFront;
      if (node.hasPseudoClassLock(pseudo)) {
        return this.walker.removePseudoClassLock(node, pseudo, {parents: true});
      }

      let hierarchical = pseudo == ":hover" || pseudo == ":active";
      return this.walker.addPseudoClassLock(node, pseudo, {parents: hierarchical});
    }
    return promise.resolve();
  },

  /**
   * Show DOM properties
   */
  showDOMProperties: function () {
    this._toolbox.openSplitConsole().then(() => {
      let panel = this._toolbox.getPanel("webconsole");
      let jsterm = panel.hud.jsterm;

      jsterm.execute("inspect($0)");
      jsterm.focus();
    });
  },

  /**
   * Use in Console.
   *
   * Takes the currently selected node in the inspector and assigns it to a
   * temp variable on the content window.  Also opens the split console and
   * autofills it with the temp variable.
   */
  useInConsole: function () {
    this._toolbox.openSplitConsole().then(() => {
      let panel = this._toolbox.getPanel("webconsole");
      let jsterm = panel.hud.jsterm;

      let evalString = `{ let i = 0;
        while (window.hasOwnProperty("temp" + i) && i < 1000) {
          i++;
        }
        window["temp" + i] = $0;
        "temp" + i;
      }`;

      let options = {
        selectedNodeActor: this.selection.nodeFront.actorID,
      };
      jsterm.requestEvaluation(evalString, options).then((res) => {
        jsterm.setInputValue(res.result);
        this.emit("console-var-ready");
      });
    });
  },

  /**
   * Edit the outerHTML of the selected Node.
   */
  editHTML: function () {
    if (!this.selection.isNode()) {
      return;
    }
    if (this.markup) {
      this.markup.beginEditingOuterHTML(this.selection.nodeFront);
    }
  },

  /**
   * Paste the contents of the clipboard into the selected Node's outer HTML.
   */
  pasteOuterHTML: function () {
    let content = this._getClipboardContentForPaste();
    if (!content) {
      return promise.reject("No clipboard content for paste");
    }

    let node = this.selection.nodeFront;
    return this.markup.getNodeOuterHTML(node).then(oldContent => {
      this.markup.updateNodeOuterHTML(node, content, oldContent);
    });
  },

  /**
   * Paste the contents of the clipboard into the selected Node's inner HTML.
   */
  pasteInnerHTML: function () {
    let content = this._getClipboardContentForPaste();
    if (!content) {
      return promise.reject("No clipboard content for paste");
    }

    let node = this.selection.nodeFront;
    return this.markup.getNodeInnerHTML(node).then(oldContent => {
      this.markup.updateNodeInnerHTML(node, content, oldContent);
    });
  },

  /**
   * Paste the contents of the clipboard as adjacent HTML to the selected Node.
   * @param position
   *        The position as specified for Element.insertAdjacentHTML
   *        (i.e. "beforeBegin", "afterBegin", "beforeEnd", "afterEnd").
   */
  pasteAdjacentHTML: function (position) {
    let content = this._getClipboardContentForPaste();
    if (!content) {
      return promise.reject("No clipboard content for paste");
    }

    let node = this.selection.nodeFront;
    return this.markup.insertAdjacentHTMLToNode(node, position, content);
  },

  /**
   * Copy the innerHTML of the selected Node to the clipboard.
   */
  copyInnerHTML: function () {
    if (!this.selection.isNode()) {
      return;
    }
    this._copyLongString(this.walker.innerHTML(this.selection.nodeFront));
  },

  /**
   * Copy the outerHTML of the selected Node to the clipboard.
   */
  copyOuterHTML: function () {
    if (!this.selection.isNode()) {
      return;
    }
    let node = this.selection.nodeFront;

    switch (node.nodeType) {
      case nodeConstants.ELEMENT_NODE :
        this._copyLongString(this.walker.outerHTML(node));
        break;
      case nodeConstants.COMMENT_NODE :
        this._getLongString(node.getNodeValue()).then(comment => {
          clipboardHelper.copyString("<!--" + comment + "-->");
        });
        break;
      case nodeConstants.DOCUMENT_TYPE_NODE :
        clipboardHelper.copyString(node.doctypeString);
        break;
    }
  },

  /**
   * Copy the data-uri for the currently selected image in the clipboard.
   */
  copyImageDataUri: function () {
    let container = this.markup.getContainer(this.selection.nodeFront);
    if (container && container.isPreviewable()) {
      container.copyImageDataUri();
    }
  },

  /**
   * Copy the content of a longString (via a promise resolving a
   * LongStringActor) to the clipboard
   * @param  {Promise} longStringActorPromise
   *         promise expected to resolve a LongStringActor instance
   * @return {Promise} promise resolving (with no argument) when the
   *         string is sent to the clipboard
   */
  _copyLongString: function (longStringActorPromise) {
    return this._getLongString(longStringActorPromise).then(string => {
      clipboardHelper.copyString(string);
    }).catch(console.error);
  },

  /**
   * Retrieve the content of a longString (via a promise resolving a LongStringActor)
   * @param  {Promise} longStringActorPromise
   *         promise expected to resolve a LongStringActor instance
   * @return {Promise} promise resolving with the retrieved string as argument
   */
  _getLongString: function (longStringActorPromise) {
    return longStringActorPromise.then(longStringActor => {
      return longStringActor.string().then(string => {
        longStringActor.release().catch(console.error);
        return string;
      });
    }).catch(console.error);
  },

  /**
   * Copy a unique selector of the selected Node to the clipboard.
   */
  copyUniqueSelector: function () {
    if (!this.selection.isNode()) {
      return;
    }

    this.telemetry.toolOpened("copyuniquecssselector");
    this.selection.nodeFront.getUniqueSelector().then(selector => {
      clipboardHelper.copyString(selector);
    }).catch(console.error);
  },

  /**
   * Copy the full CSS Path of the selected Node to the clipboard.
   */
  copyCssPath: function () {
    if (!this.selection.isNode()) {
      return;
    }

    this.telemetry.toolOpened("copyfullcssselector");
    this.selection.nodeFront.getCssPath().then(path => {
      clipboardHelper.copyString(path);
    }).catch(console.error);
  },

  /**
   * Copy the XPath of the selected Node to the clipboard.
   */
  copyXPath: function () {
    if (!this.selection.isNode()) {
      return;
    }

    this.telemetry.toolOpened("copyxpath");
    this.selection.nodeFront.getXPath().then(path => {
      clipboardHelper.copyString(path);
    }).catch(console.error);
  },

  /**
   * Initiate gcli screenshot command on selected node.
   */
  screenshotNode: Task.async(function* () {
    const command = Services.prefs.getBoolPref("devtools.screenshot.clipboard.enabled") ?
      "screenshot --file --clipboard --selector" :
      "screenshot --file --selector";

    // Bug 1332936 - it's possible to call `screenshotNode` while the BoxModel highlighter
    // is still visible, therefore showing it in the picture.
    // To avoid that, we have to hide it before taking the screenshot. The `hideBoxModel`
    // will do that, calling `hide` for the highlighter only if previously shown.
    yield this.highlighter.hideBoxModel();

    // Bug 1180314 -  CssSelector might contain white space so need to make sure it is
    // passed to screenshot as a single parameter.  More work *might* be needed if
    // CssSelector could contain escaped single- or double-quotes, backslashes, etc.
    CommandUtils.executeOnTarget(this._target,
      `${command} '${this.selectionCssSelector}'`);
  }),

  /**
   * Scroll the node into view.
   */
  scrollNodeIntoView: function () {
    if (!this.selection.isNode()) {
      return;
    }

    this.selection.nodeFront.scrollIntoView();
  },

  /**
   * Duplicate the selected node
   */
  duplicateNode: function () {
    let selection = this.selection;
    if (!selection.isElementNode() ||
        selection.isRoot() ||
        selection.isAnonymousNode() ||
        selection.isPseudoElementNode()) {
      return;
    }
    this.walker.duplicateNode(selection.nodeFront).catch(console.error);
  },

  /**
   * Delete the selected node.
   */
  deleteNode: function () {
    if (!this.selection.isNode() ||
         this.selection.isRoot()) {
      return;
    }

    // If the markup panel is active, use the markup panel to delete
    // the node, making this an undoable action.
    if (this.markup) {
      this.markup.deleteNode(this.selection.nodeFront);
    } else {
      // remove the node from content
      this.walker.removeNode(this.selection.nodeFront);
    }
  },

  /**
   * Add attribute to node.
   * Used for node context menu and shouldn't be called directly.
   */
  onAddAttribute: function () {
    let container = this.markup.getContainer(this.selection.nodeFront);
    container.addAttribute();
  },

  /**
   * Copy attribute value for node.
   * Used for node context menu and shouldn't be called directly.
   */
  onCopyAttributeValue: function () {
    clipboardHelper.copyString(this.nodeMenuTriggerInfo.value);
  },

  /**
   * Edit attribute for node.
   * Used for node context menu and shouldn't be called directly.
   */
  onEditAttribute: function () {
    let container = this.markup.getContainer(this.selection.nodeFront);
    container.editAttribute(this.nodeMenuTriggerInfo.name);
  },

  /**
   * Remove attribute from node.
   * Used for node context menu and shouldn't be called directly.
   */
  onRemoveAttribute: function () {
    let container = this.markup.getContainer(this.selection.nodeFront);
    container.removeAttribute(this.nodeMenuTriggerInfo.name);
  },

  expandNode: function () {
    this.markup.expandAll(this.selection.nodeFront);
  },

  collapseAll: function () {
    this.markup.collapseAll(this.selection.nodeFront);
  },

  /**
   * This method is here for the benefit of the node-menu-link-follow menu item
   * in the inspector contextual-menu.
   */
  onFollowLink: function () {
    let type = this.contextMenuTarget.dataset.type;
    let link = this.contextMenuTarget.dataset.link;

    this.followAttributeLink(type, link);
  },

  /**
   * Given a type and link found in a node's attribute in the markup-view,
   * attempt to follow that link (which may result in opening a new tab, the
   * style editor or debugger).
   */
  followAttributeLink: function (type, link) {
    if (!type || !link) {
      return;
    }

    if (type === "uri" || type === "cssresource" || type === "jsresource") {
      // Open link in a new tab.
      this.inspector.resolveRelativeURL(
        link, this.selection.nodeFront).then(url => {
          if (type === "uri") {
            let browserWin = this.target.tab.ownerDocument.defaultView;
            browserWin.openUILinkIn(url, "tab");
          } else if (type === "cssresource") {
            return this.toolbox.viewSourceInStyleEditor(url);
          } else if (type === "jsresource") {
            return this.toolbox.viewSourceInDebugger(url);
          }
          return null;
        }).catch(console.error);
    } else if (type == "idref") {
      // Select the node in the same document.
      this.walker.document(this.selection.nodeFront).then(doc => {
        return this.walker.querySelector(doc, "#" + CSS.escape(link)).then(node => {
          if (!node) {
            this.emit("idref-attribute-link-failed");
            return;
          }
          this.selection.setNodeFront(node);
        });
      }).catch(console.error);
    }
  },

  /**
   * This method is here for the benefit of the node-menu-link-copy menu item
   * in the inspector contextual-menu.
   */
  onCopyLink: function () {
    let link = this.contextMenuTarget.dataset.link;

    this.copyAttributeLink(link);
  },

  /**
   * This method is here for the benefit of copying links.
   */
  copyAttributeLink: function (link) {
    this.inspector.resolveRelativeURL(link, this.selection.nodeFront).then(url => {
      clipboardHelper.copyString(url);
    }, console.error);
  },

  /**
   * Returns an object containing the shared handler functions used in the box
   * model and grid React components.
   */
  getCommonComponentProps() {
    return {
      setSelectedNode: this.selection.setNodeFront,
      onShowBoxModelHighlighterForNode: this.onShowBoxModelHighlighterForNode,
    };
  },

  /**
   * Shows the box-model highlighter on the element corresponding to the provided
   * NodeFront.
   *
   * @param  {NodeFront} nodeFront
   *         The node to highlight.
   * @param  {Object} options
   *         Options passed to the highlighter actor.
   */
  onShowBoxModelHighlighterForNode(nodeFront, options) {
    let toolbox = this.toolbox;
    toolbox.highlighterUtils.highlightNodeFront(nodeFront, options);
  },

  /**
   * Returns a value indicating whether a node can be deleted.
   *
   * @param {NodeFront} nodeFront
   *        The node to test for deletion
   */
  isDeletable(nodeFront) {
    return !(nodeFront.isDocumentElement ||
           nodeFront.nodeType == nodeConstants.DOCUMENT_TYPE_NODE ||
           nodeFront.isAnonymous);
  },

  async inspectNodeActor(nodeActor, inspectFromAnnotation) {
    const nodeFront = await this.walker.getNodeActorFromObjectActor(nodeActor);
    if (!nodeFront) {
      console.error("The object cannot be linked to the inspector, the " +
                    "corresponding nodeFront could not be found.");
      return false;
    }

    let isAttached = await this.walker.isInDOMTree(nodeFront);
    if (!isAttached) {
      console.error("Selected DOMNode is not attached to the document tree.");
      return false;
    }

    await this.selection.setNodeFront(nodeFront, inspectFromAnnotation);
    return true;
  },
};

/**
 * Create a fake toolbox when running the inspector standalone, either in a chrome tab or
 * in a content tab.
 *
 * @param {Target} target to debug
 * @param {Function} createThreadClient
 *        When supported the thread client needs a reference to the toolbox.
 *        This callback will be called right after the toolbox object is created.
 * @param {Object} dependencies
 *        - react
 *        - reactDOM
 *        - browserRequire
 */
const buildFakeToolbox = Task.async(function* (
  target, createThreadClient, {
    React,
    ReactDOM,
    browserRequire
  }) {
  const { InspectorFront } = require("devtools/shared/fronts/inspector");
  const { Selection } = require("devtools/client/framework/selection");
  const { getHighlighterUtils } = require("devtools/client/framework/toolbox-highlighter-utils");

  let notImplemented = function () {
    throw new Error("Not implemented in a tab");
  };
  let fakeToolbox = {
    target,
    hostType: "bottom",
    doc: window.document,
    win: window,
    on() {}, emit() {}, off() {},
    initInspector() {},
    browserRequire,
    React,
    ReactDOM,
    isToolRegistered() {
      return false;
    },
    currentToolId: "inspector",
    getCurrentPanel() {
      return "inspector";
    },
    get textboxContextMenuPopup() {
      notImplemented();
    },
    getPanel: notImplemented,
    openSplitConsole: notImplemented,
    viewCssSourceInStyleEditor: notImplemented,
    viewJsSourceInDebugger: notImplemented,
    viewSource: notImplemented,
    viewSourceInDebugger: notImplemented,
    viewSourceInStyleEditor: notImplemented,

    get inspectorExtensionSidebars() {
      notImplemented();
    },

    // For attachThread:
    highlightTool() {},
    unhighlightTool() {},
    selectTool() {},
    raise() {},
    getNotificationBox() {}
  };

  fakeToolbox.threadClient = yield createThreadClient(fakeToolbox);

  let inspector = InspectorFront(target.client, target.form);
  let showAllAnonymousContent =
    Services.prefs.getBoolPref("devtools.inspector.showAllAnonymousContent");
  let walker = yield inspector.getWalker({ showAllAnonymousContent });
  let selection = new Selection(walker);
  let highlighter = yield inspector.getHighlighter(false);
  fakeToolbox.highlighterUtils = getHighlighterUtils(fakeToolbox);

  fakeToolbox.inspector = inspector;
  fakeToolbox.walker = walker;
  fakeToolbox.selection = selection;
  fakeToolbox.highlighter = highlighter;
  return fakeToolbox;
});

// URL constructor doesn't support chrome: scheme
let href = window.location.href.replace(/chrome:/, "http://");
let url = new window.URL(href);

// If query parameters are given in a chrome tab, the inspector is running in standalone.
if (window.location.protocol === "chrome:" && url.search.length > 1) {
  const { targetFromURL } = require("devtools/client/framework/target-from-url");
  const { attachThread } = require("devtools/client/framework/attach-thread");

  const browserRequire = BrowserLoader({ window, useOnlyShared: true }).require;
  const React = browserRequire("devtools/client/shared/vendor/react");
  const ReactDOM = browserRequire("devtools/client/shared/vendor/react-dom");

  Task.spawn(function* () {
    let target = yield targetFromURL(url);
    let fakeToolbox = yield buildFakeToolbox(
      target,
      (toolbox) => attachThread(toolbox),
      { React, ReactDOM, browserRequire }
    );
    let inspectorUI = new Inspector(fakeToolbox);
    inspectorUI.init();
  }).catch(e => {
    window.alert("Unable to start the inspector:" + e.message + "\n" + e.stack);
  });
}

exports.Inspector = Inspector;
exports.buildFakeToolbox = buildFakeToolbox;
