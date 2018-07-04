// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

"use strict";

var EXPORTED_SYMBOLS = ["BrowserUITelemetry"];

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  CustomizableUI: "resource:///modules/CustomizableUI.jsm",
});
XPCOMUtils.defineLazyGetter(this, "Timer", function() {
  let timer = {};
  ChromeUtils.import("resource://gre/modules/Timer.jsm", timer);
  return timer;
});

const MS_SECOND = 1000;
const MS_MINUTE = MS_SECOND * 60;
const MS_HOUR = MS_MINUTE * 60;

const LEGACY_PANEL_PLACEMENTS = [
  "edit-controls",
  "zoom-controls",
  "new-window-button",
  "privatebrowsing-button",
  "save-page-button",
  "print-button",
  "history-panelmenu",
  "fullscreen-button",
  "find-button",
  "preferences-button",
  "add-ons-button",
  "sync-button",
  "developer-button"
];

XPCOMUtils.defineLazyGetter(this, "DEFAULT_AREA_PLACEMENTS", function() {
  let result = {
    "nav-bar": [
      "back-button",
      "forward-button",
      "stop-reload-button",
      "home-button",
      "urlbar-container",
      "downloads-button",
      "library-button",
      "sidebar-button",
    ],
    // It's true that toolbar-menubar is not visible
    // on OS X, but the XUL node is definitely present
    // in the document.
    "toolbar-menubar": [
      "menubar-items",
    ],
    "TabsToolbar": [
      "tabbrowser-tabs",
      "new-tab-button",
      "alltabs-button",
    ],
    "PersonalToolbar": [
      "personal-bookmarks",
    ],
    "widget-overflow-fixed-list": [
    ],
  };

  return result;
});

XPCOMUtils.defineLazyGetter(this, "DEFAULT_AREAS", function() {
  return Object.keys(DEFAULT_AREA_PLACEMENTS);
});

XPCOMUtils.defineLazyGetter(this, "PALETTE_ITEMS", function() {
  let result = [
    "bookmarks-menu-button",
    "search-container",
    "open-file-button",
    "developer-button",
    "feed-button",
    "email-link-button",
    ...LEGACY_PANEL_PLACEMENTS,
    "characterencoding-button",
  ];

  if (Services.prefs.getBoolPref("privacy.panicButton.enabled")) {
    result.push("panic-button");
  }

  return result;
});

XPCOMUtils.defineLazyGetter(this, "DEFAULT_ITEMS", function() {
  let result = [];
  for (let [, buttons] of Object.entries(DEFAULT_AREA_PLACEMENTS)) {
    result = result.concat(buttons);
  }
  return result;
});

XPCOMUtils.defineLazyGetter(this, "ALL_BUILTIN_ITEMS", function() {
  // These special cases are for click events on built-in items that are
  // contained within customizable items (like the navigation widget).
  const SPECIAL_CASES = [
    "back-button",
    "forward-button",
    "stop-button",
    "urlbar-go-button",
    "reload-button",
    "searchbar",
    "cut-button",
    "copy-button",
    "paste-button",
    "zoom-out-button",
    "zoom-reset-button",
    "zoom-in-button",
    "BMB_bookmarksPopup",
    "BMB_unsortedBookmarksPopup",
    "BMB_bookmarksToolbarPopup",
    "search-go-button",
    "soundplaying-icon",
  ];
  return DEFAULT_ITEMS.concat(PALETTE_ITEMS)
                      .concat(SPECIAL_CASES);
});

const OTHER_MOUSEUP_MONITORED_ITEMS = [
  "PlacesChevron",
  "PlacesToolbarItems",
  "menubar-items",
];

// Items that open arrow panels will often be overlapped by
// the panel that they're opening by the time the mouseup
// event is fired, so for these items, we monitor mousedown.
const MOUSEDOWN_MONITORED_ITEMS = [
  "PanelUI-menu-button",
];

// Weakly maps browser windows to objects whose keys are relative
// timestamps for when some kind of session started. For example,
// when a customization session started. That way, when the window
// exits customization mode, we can determine how long the session
// lasted.
const WINDOW_DURATION_MAP = new WeakMap();

// Default bucket name, when no other bucket is active.
const BUCKET_DEFAULT = "__DEFAULT__";
// Bucket prefix, for named buckets.
const BUCKET_PREFIX = "bucket_";
// Standard separator to use between different parts of a bucket name, such
// as primary name and the time step string.
const BUCKET_SEPARATOR = "|";

var BrowserUITelemetry = {
  init() {
    Services.obs.addObserver(this, "autocomplete-did-enter-text");
    CustomizableUI.addListener(this);

    // Register existing windows
    let browserEnum = Services.wm.getEnumerator("navigator:browser");
    while (browserEnum.hasMoreElements()) {
      this._registerWindow(browserEnum.getNext());
    }
    Services.obs.addObserver(this, "browser-delayed-startup-finished");

    this._gatherFirstWindowMeasurements();
  },

  observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "browser-delayed-startup-finished":
        this._registerWindow(aSubject);
        break;
      case "autocomplete-did-enter-text":
        let input = aSubject.QueryInterface(Ci.nsIAutoCompleteInput);
        if (input && input.id == "urlbar" && !input.inPrivateContext &&
            input.popup.selectedIndex != -1) {
          this._logAwesomeBarSearchResult(input.textValue);
        }
        break;
    }
  },

  /**
   * For the _countableEvents object, constructs a chain of
   * Javascript Objects with the keys in aKeys, with the final
   * key getting the value in aEndWith. If the final key already
   * exists in the final object, its value is not set. In either
   * case, a reference to the second last object in the chain is
   * returned.
   *
   * Example - suppose I want to store:
   * _countableEvents: {
   *   a: {
   *     b: {
   *       c: 0
   *     }
   *   }
   * }
   *
   * And then increment the "c" value by 1, you could call this
   * function like this:
   *
   * let example = this._ensureObjectChain([a, b, c], 0);
   * example["c"]++;
   *
   * Subsequent repetitions of these last two lines would
   * simply result in the c value being incremented again
   * and again.
   *
   * @param aKeys the Array of keys to chain Objects together with.
   * @param aEndWith the value to assign to the last key.
   * @param aRoot the root object onto which we create/get the object chain
   *              designated by aKeys.
   * @returns a reference to the second last object in the chain -
   *          so in our example, that'd be "b".
   */
  _ensureObjectChain(aKeys, aEndWith, aRoot) {
    let current = aRoot;
    let parent = null;
    aKeys.unshift(this._bucket);
    for (let [i, key] of aKeys.entries()) {
      if (!(key in current)) {
        if (i == aKeys.length - 1) {
          current[key] = aEndWith;
        } else {
          current[key] = {};
        }
      }
      parent = current;
      current = current[key];
    }
    return parent;
  },

  _countableEvents: {},
  _countEvent(aKeyArray, root = this._countableEvents) {
    let countObject = this._ensureObjectChain(aKeyArray, 0, root);
    let lastItemKey = aKeyArray[aKeyArray.length - 1];
    countObject[lastItemKey]++;
  },

  _countMouseUpEvent(aCategory, aAction, aButton) {
    const BUTTONS = ["left", "middle", "right"];
    let buttonKey = BUTTONS[aButton];
    if (buttonKey) {
      this._countEvent([aCategory, aAction, buttonKey]);
    }
  },

  _firstWindowMeasurements: null,
  _gatherFirstWindowMeasurements() {
    // We'll gather measurements as soon as the session has restored.
    // We do this here instead of waiting for UITelemetry to ask for
    // our measurements because at that point all browser windows have
    // probably been closed, since the vast majority of saved-session
    // pings are gathered during shutdown.
    Services.search.init(rv => {
      let win = BrowserWindowTracker.getTopWindow({
        private: false,
        allowPopups: false,
      });
      // If there are no such windows, we're out of luck. :(
      this._firstWindowMeasurements = win ? this._getWindowMeasurements(win, rv)
                                          : {};
    });
  },

  _registerWindow(aWindow) {
    aWindow.addEventListener("unload", this);
    let document = aWindow.document;

    for (let areaID of CustomizableUI.areas) {
      let areaNode = document.getElementById(areaID);
      if (areaNode) {
        (areaNode.customizationTarget || areaNode).addEventListener("mouseup", this);
      }
    }

    for (let itemID of OTHER_MOUSEUP_MONITORED_ITEMS) {
      let item = document.getElementById(itemID);
      if (item) {
        item.addEventListener("mouseup", this);
      }
    }

    for (let itemID of MOUSEDOWN_MONITORED_ITEMS) {
      let item = document.getElementById(itemID);
      if (item) {
        item.addEventListener("mousedown", this);
      }
    }

    WINDOW_DURATION_MAP.set(aWindow, {});
  },

  _unregisterWindow(aWindow) {
    aWindow.removeEventListener("unload", this);
    let document = aWindow.document;

    for (let areaID of CustomizableUI.areas) {
      let areaNode = document.getElementById(areaID);
      if (areaNode) {
        (areaNode.customizationTarget || areaNode).removeEventListener("mouseup", this);
      }
    }

    for (let itemID of OTHER_MOUSEUP_MONITORED_ITEMS) {
      let item = document.getElementById(itemID);
      if (item) {
        item.removeEventListener("mouseup", this);
      }
    }

    for (let itemID of MOUSEDOWN_MONITORED_ITEMS) {
      let item = document.getElementById(itemID);
      if (item) {
        item.removeEventListener("mousedown", this);
      }
    }
  },

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "unload":
        this._unregisterWindow(aEvent.currentTarget);
        break;
      case "mouseup":
        this._handleMouseUp(aEvent);
        break;
      case "mousedown":
        this._handleMouseDown(aEvent);
        break;
    }
  },

  _handleMouseUp(aEvent) {
    let targetID = aEvent.currentTarget.id;

    switch (targetID) {
      case "PlacesToolbarItems":
        this._PlacesToolbarItemsMouseUp(aEvent);
        break;
      case "PlacesChevron":
        this._PlacesChevronMouseUp(aEvent);
        break;
      case "menubar-items":
        this._menubarMouseUp(aEvent);
        break;
      default:
        this._checkForBuiltinItem(aEvent);
    }
  },

  _handleMouseDown(aEvent) {
    if (aEvent.currentTarget.id == "PanelUI-menu-button") {
      // _countMouseUpEvent expects a detail for the second argument,
      // but we don't really have any details to give. Just passing in
      // "button" is probably simpler than trying to modify
      // _countMouseUpEvent for this particular case.
      this._countMouseUpEvent("click-menu-button", "button", aEvent.button);
    }
  },

  _PlacesChevronMouseUp(aEvent) {
    let target = aEvent.originalTarget;
    let result = target.id == "PlacesChevron" ? "chevron" : "overflowed-item";
    this._countMouseUpEvent("click-bookmarks-bar", result, aEvent.button);
  },

  _PlacesToolbarItemsMouseUp(aEvent) {
    let target = aEvent.originalTarget;
    // If this isn't a bookmark-item, we don't care about it.
    if (!target.classList.contains("bookmark-item")) {
      return;
    }

    let result = target.hasAttribute("container") ? "container" : "item";
    this._countMouseUpEvent("click-bookmarks-bar", result, aEvent.button);
  },

  _menubarMouseUp(aEvent) {
    let target = aEvent.originalTarget;
    let tag = target.localName;
    let result = (tag == "menu" || tag == "menuitem") ? tag : "other";
    this._countMouseUpEvent("click-menubar", result, aEvent.button);
  },

  _bookmarksMenuButtonMouseUp(aEvent) {
    let bookmarksWidget = CustomizableUI.getWidget("bookmarks-menu-button");
    if (bookmarksWidget.areaType == CustomizableUI.TYPE_MENU_PANEL) {
      // In the menu panel, only the star is visible, and that opens up the
      // bookmarks subview.
      this._countMouseUpEvent("click-bookmarks-menu-button", "in-panel",
                              aEvent.button);
    } else {
      let clickedItem = aEvent.originalTarget;
      // Did we click on the star, or the dropmarker? The star
      // has an anonid of "button". If we don't find that, we'll
      // assume we clicked on the dropmarker.
      let action = "menu";
      if (clickedItem.getAttribute("anonid") == "button") {
        // We clicked on the star - now we just need to record
        // whether or not we're adding a bookmark or editing an
        // existing one.
        let bookmarksMenuNode =
          bookmarksWidget.forWindow(aEvent.target.ownerGlobal).node;
        action = bookmarksMenuNode.hasAttribute("starred") ? "edit" : "add";
      }
      this._countMouseUpEvent("click-bookmarks-menu-button", action,
                              aEvent.button);
    }
  },

  _checkForBuiltinItem(aEvent) {
    let item = aEvent.originalTarget;

    // We don't want to count clicks on the private browsing
    // button for privacy reasons. See bug 1176391.
    if (item.id == "privatebrowsing-button") {
      return;
    }

    // We special-case the bookmarks-menu-button, since we want to
    // monitor more than just clicks on it.
    if (item.id == "bookmarks-menu-button" ||
        getIDBasedOnFirstIDedAncestor(item) == "bookmarks-menu-button") {
      this._bookmarksMenuButtonMouseUp(aEvent);
      return;
    }

    // Perhaps we're seeing one of the default toolbar items
    // being clicked.
    if (ALL_BUILTIN_ITEMS.includes(item.id)) {
      // Base case - we clicked directly on one of our built-in items,
      // and we can go ahead and register that click.
      this._countMouseUpEvent("click-builtin-item", item.id, aEvent.button);
      return;
    }

    // If not, we need to check if the item's anonid is in our list
    // of built-in items to check.
    if (ALL_BUILTIN_ITEMS.includes(item.getAttribute("anonid"))) {
      this._countMouseUpEvent("click-builtin-item", item.getAttribute("anonid"), aEvent.button);
      return;
    }

    // If not, we need to check if one of the ancestors of the clicked
    // item is in our list of built-in items to check.
    let candidate = getIDBasedOnFirstIDedAncestor(item);
    if (ALL_BUILTIN_ITEMS.includes(candidate)) {
      this._countMouseUpEvent("click-builtin-item", candidate, aEvent.button);
    }
  },

  _getWindowMeasurements(aWindow, searchResult) {
    let document = aWindow.document;
    let result = {};

    // Determine if the window is in the maximized, normal or
    // fullscreen state.
    result.sizemode = document.documentElement.getAttribute("sizemode");

    // Determine if the Bookmarks bar is currently visible
    let bookmarksBar = document.getElementById("PersonalToolbar");
    result.bookmarksBarEnabled = bookmarksBar && !bookmarksBar.collapsed;

    // Determine if the menubar is currently visible. On OS X, the menubar
    // is never shown, despite not having the collapsed attribute set.
    let menuBar = document.getElementById("toolbar-menubar");
    result.menuBarEnabled =
      menuBar && Services.appinfo.OS != "Darwin"
              && menuBar.getAttribute("autohide") != "true";

    // Determine if the titlebar is currently visible.
    result.titleBarEnabled = !Services.prefs.getBoolPref("browser.tabs.drawInTitlebar");

    // Examine all customizable areas and see what default items
    // are present and missing.
    let defaultKept = [];
    let defaultMoved = [];
    let nondefaultAdded = [];

    for (let areaID of CustomizableUI.areas) {
      let items = CustomizableUI.getWidgetIdsInArea(areaID);
      for (let item of items) {
        // Is this a default item?
        if (DEFAULT_ITEMS.includes(item)) {
          // Ok, it's a default item - but is it in its default
          // toolbar? We use Array.isArray instead of checking for
          // toolbarID in DEFAULT_AREA_PLACEMENTS because an add-on might
          // be clever and give itself the id of "toString" or something.
          if (Array.isArray(DEFAULT_AREA_PLACEMENTS[areaID]) &&
              DEFAULT_AREA_PLACEMENTS[areaID].includes(item)) {
            // The item is in its default toolbar
            defaultKept.push(item);
          } else {
            defaultMoved.push(item);
          }
        } else if (PALETTE_ITEMS.includes(item)) {
          // It's a palette item that's been moved into a toolbar
          nondefaultAdded.push(item);
        }
        // else, it's provided by an add-on, and we won't record it.
      }
    }

    // Now go through the items in the palette to see what default
    // items are in there.
    let paletteItems =
      CustomizableUI.getUnusedWidgets(aWindow.gNavToolbox.palette);
    let defaultRemoved = [];
    for (let item of paletteItems) {
      if (DEFAULT_ITEMS.includes(item.id)) {
        defaultRemoved.push(item.id);
      }
    }

    result.defaultKept = defaultKept;
    result.defaultMoved = defaultMoved;
    result.nondefaultAdded = nondefaultAdded;
    result.defaultRemoved = defaultRemoved;

    // Next, determine how many add-on provided toolbars exist.
    let addonToolbars = 0;
    let toolbars = document.querySelectorAll("toolbar[customizable=true]");
    for (let toolbar of toolbars) {
      if (!DEFAULT_AREAS.includes(toolbar.id)) {
        addonToolbars++;
      }
    }
    result.addonToolbars = addonToolbars;

    // Find out how many open tabs we have in each window
    let winEnumerator = Services.wm.getEnumerator("navigator:browser");
    let visibleTabs = [];
    let hiddenTabs = [];
    while (winEnumerator.hasMoreElements()) {
      let someWin = winEnumerator.getNext();
      if (someWin.gBrowser) {
        let visibleTabsNum = someWin.gBrowser.visibleTabs.length;
        visibleTabs.push(visibleTabsNum);
        hiddenTabs.push(someWin.gBrowser.tabs.length - visibleTabsNum);
      }
    }
    result.visibleTabs = visibleTabs;
    result.hiddenTabs = hiddenTabs;

    if (Components.isSuccessCode(searchResult)) {
      result.currentSearchEngine = Services.search.currentEngine.name;
    }

    return result;
  },

  getToolbarMeasures() {
    let result = this._firstWindowMeasurements || {};
    result.countableEvents = this._countableEvents;
    result.durations = this._durations;
    return result;
  },

  getSyncState() {
    let result = {};
    for (let sub of ["desktop", "mobile"]) {
      let count = Services.prefs.getIntPref("services.sync.clients.devices." + sub, 0);
      result[sub] = count;
    }
    return result;
  },

  countCustomizationEvent(aEventType) {
    this._countEvent(["customize", aEventType]);
  },

  countSearchEvent(source, query, selection) {
    this._countEvent(["search", source]);
    if ((/^[a-zA-Z]+:[^\/\\]/).test(query)) {
      this._countEvent(["search", "urlbar-keyword"]);
    }
    if (selection) {
      this._countEvent(["search", "selection", source, selection.index, selection.kind]);
    }
  },

  countOneoffSearchEvent(id, type, where) {
    this._countEvent(["search-oneoff", id, type, where]);
  },

  countSearchSettingsEvent(source) {
    this._countEvent(["click-builtin-item", source, "search-settings"]);
  },

  countPanicEvent(timeId) {
    this._countEvent(["forget-button", timeId]);
  },

  countTabMutingEvent(action, reason) {
    this._countEvent(["tab-audio-control", action, reason || "no reason given"]);
  },

  countSyncedTabEvent(what, where) {
    // "what" will be, eg, "open"
    // "where" will be "toolbarbutton-subview" or "sidebar"
    this._countEvent(["synced-tabs", what, where]);
  },

  countSidebarEvent(sidebarID, action) {
    // sidebarID is the ID of the sidebar (duh!)
    // action will be "hide" or "show"
    this._countEvent(["sidebar", sidebarID, action]);
  },

  _logAwesomeBarSearchResult(url) {
    let spec = Services.search.parseSubmissionURL(url);
    if (spec.engine) {
      let matchedEngine = "default";
      if (spec.engine.name !== Services.search.currentEngine.name) {
        matchedEngine = "other";
      }
      this.countSearchEvent("autocomplete-" + matchedEngine);
    }
  },

  _durations: {
    customization: [],
  },

  onCustomizeStart(aWindow) {
    this._countEvent(["customize", "start"]);
    let durationMap = WINDOW_DURATION_MAP.get(aWindow);
    if (!durationMap) {
      durationMap = {};
      WINDOW_DURATION_MAP.set(aWindow, durationMap);
    }

    durationMap.customization = {
      start: aWindow.performance.now(),
      bucket: this._bucket,
    };
  },

  onCustomizeEnd(aWindow) {
    let durationMap = WINDOW_DURATION_MAP.get(aWindow);
    if (durationMap && "customization" in durationMap) {
      let duration = aWindow.performance.now() - durationMap.customization.start;
      this._durations.customization.push({
        duration,
        bucket: durationMap.customization.bucket,
      });
      delete durationMap.customization;
    }
  },

  _contextMenuItemWhitelist: new Set([
    "close-without-interaction", // for closing the menu without clicking it.
    "custom-page-item", // The ID we use for page-provided items
    "unknown", // The bucket for stuff with no id.
    // Everything we know of so far (which will exclude add-on items):
    "navigation", "back", "forward", "reload", "stop", "bookmarkpage",
    "spell-no-suggestions", "spell-add-to-dictionary",
    "spell-undo-add-to-dictionary", "openlinkincurrent", "openlinkintab",
    "openlink",
    // "openlinkprivate" intentionally omitted for privacy reasons. See bug 1176391.
    "bookmarklink", "savelink",
    "marklinkMenu", "copyemail", "copylink", "media-play", "media-pause",
    "media-mute", "media-unmute", "media-playbackrate",
    "media-playbackrate-050x", "media-playbackrate-100x",
    "media-playbackrate-125x", "media-playbackrate-150x", "media-playbackrate-200x",
    "media-showcontrols", "media-hidecontrols",
    "video-fullscreen", "leave-dom-fullscreen",
    "reloadimage", "viewimage", "viewvideo", "copyimage-contents", "copyimage",
    "copyvideourl", "copyaudiourl", "saveimage", "sendimage",
    "setDesktopBackground", "viewimageinfo", "viewimagedesc", "savevideo",
    "saveaudio", "video-saveimage", "sendvideo", "sendaudio",
    "ctp-play", "ctp-hide", "savepage", "pocket", "markpageMenu",
    "viewbgimage", "undo", "cut", "copy", "paste", "delete", "selectall",
    "keywordfield", "searchselect", "frame", "showonlythisframe",
    "openframeintab", "openframe", "reloadframe", "bookmarkframe", "saveframe",
    "printframe", "viewframesource", "viewframeinfo",
    "viewpartialsource-selection", "viewpartialsource-mathml",
    "viewsource", "viewinfo", "spell-check-enabled",
    "spell-add-dictionaries-main", "spell-dictionaries",
    "spell-dictionaries-menu", "spell-add-dictionaries",
    "bidi-text-direction-toggle", "bidi-page-direction-toggle", "inspect",
    "inspect-a11y", "media-eme-learn-more"
  ]),

  _contextMenuInteractions: {},

  registerContextMenuInteraction(keys, itemID) {
    if (itemID) {
      if (itemID == "openlinkprivate") {
        // Don't record anything, not even an other-item count
        // if the user chose to open in a private window. See
        // bug 1176391.
        return;
      }

      if (!this._contextMenuItemWhitelist.has(itemID)) {
        itemID = "other-item";
      }
      keys.push(itemID);
    }

    this._countEvent(keys, this._contextMenuInteractions);
  },

  getContextMenuInfo() {
    return this._contextMenuInteractions;
  },

  _bucket: BUCKET_DEFAULT,
  _bucketTimer: null,

  /**
   * Default bucket name, when no other bucket is active.
   */
  get BUCKET_DEFAULT() {
    return BUCKET_DEFAULT;
  },

  /**
   * Bucket prefix, for named buckets.
   */
  get BUCKET_PREFIX() {
    return BUCKET_PREFIX;
  },

  /**
   * Standard separator to use between different parts of a bucket name, such
   * as primary name and the time step string.
   */
  get BUCKET_SEPARATOR() {
    return BUCKET_SEPARATOR;
  },

  get currentBucket() {
    return this._bucket;
  },

  /**
   * Sets a named bucket for all countable events and select durections to be
   * put into.
   *
   * @param aName  Name of bucket, or null for default bucket name (__DEFAULT__)
   */
  setBucket(aName) {
    if (this._bucketTimer) {
      Timer.clearTimeout(this._bucketTimer);
      this._bucketTimer = null;
    }

    if (aName)
      this._bucket = BUCKET_PREFIX + aName;
    else
      this._bucket = BUCKET_DEFAULT;
  },

  /**
  * Sets a bucket that expires at the rate of a given series of time steps.
  * Once the bucket expires, the current bucket will automatically revert to
  * the default bucket. While the bucket is expiring, it's name is postfixed
  * by '|' followed by a short string representation of the time step it's
  * currently in.
  * If any other bucket (expiring or normal) is set while an expiring bucket is
  * still expiring, the old expiring bucket stops expiring and the new bucket
  * immediately takes over.
  *
  * @param aName       Name of bucket.
  * @param aTimeSteps  An array of times in milliseconds to count up to before
  *                    reverting back to the default bucket. The array of times
  *                    is expected to be pre-sorted in ascending order.
  *                    For example, given a bucket name of 'bucket', the times:
  *                      [60000, 300000, 600000]
  *                    will result in the following buckets:
  *                    * bucket|1m - for the first 1 minute
  *                    * bucket|5m - for the following 4 minutes
  *                                  (until 5 minutes after the start)
  *                    * bucket|10m - for the following 5 minutes
  *                                   (until 10 minutes after the start)
  *                    * __DEFAULT__ - until a new bucket is set
  * @param aTimeOffset Time offset, in milliseconds, from which to start
  *                    counting. For example, if the first time step is 1000ms,
  *                    and the time offset is 300ms, then the next time step
  *                    will become active after 700ms. This affects all
  *                    following time steps also, meaning they will also all be
  *                    timed as though they started expiring 300ms before
  *                    setExpiringBucket was called.
  */
  setExpiringBucket(aName, aTimeSteps, aTimeOffset = 0) {
    if (aTimeSteps.length === 0) {
      this.setBucket(null);
      return;
    }

    if (this._bucketTimer) {
      Timer.clearTimeout(this._bucketTimer);
      this._bucketTimer = null;
    }

    // Make a copy of the time steps array, so we can safely modify it without
    // modifying the original array that external code has passed to us.
    let steps = [...aTimeSteps];
    let msec = steps.shift();
    let postfix = this._toTimeStr(msec);
    this.setBucket(aName + BUCKET_SEPARATOR + postfix);

    this._bucketTimer = Timer.setTimeout(() => {
      this._bucketTimer = null;
      this.setExpiringBucket(aName, steps, aTimeOffset + msec);
    }, msec - aTimeOffset);
  },

  /**
   * Formats a time interval, in milliseconds, to a minimal non-localized string
   * representation. Format is: 'h' for hours, 'm' for minutes, 's' for seconds,
   * 'ms' for milliseconds.
   * Examples:
   *   65 => 65ms
   *   1000 => 1s
   *   60000 => 1m
   *   61000 => 1m01s
   *
   * @param aTimeMS  Time in milliseconds
   *
   * @return Minimal string representation.
   */
  _toTimeStr(aTimeMS) {
    let timeStr = "";

    function reduce(aUnitLength, aSymbol) {
      if (aTimeMS >= aUnitLength) {
        let units = Math.floor(aTimeMS / aUnitLength);
        aTimeMS = aTimeMS - (units * aUnitLength);
        timeStr += units + aSymbol;
      }
    }

    reduce(MS_HOUR, "h");
    reduce(MS_MINUTE, "m");
    reduce(MS_SECOND, "s");
    reduce(1, "ms");

    return timeStr;
  },
};

/**
 * Returns the id of the first ancestor of aNode that has an id. If aNode
 * has no parent, or no ancestor has an id, returns null.
 *
 * @param aNode the node to find the first ID'd ancestor of
 */
function getIDBasedOnFirstIDedAncestor(aNode) {
  while (!aNode.id) {
    aNode = aNode.parentNode;
    if (!aNode) {
      return null;
    }
  }

  return aNode.id;
}
