// HOME PAGE
/*
 * Preferences:
 *
 * - what page(s) to show when the user starts the application, as an integer:
 *
 *  0: a blank page (DEPRECATED - this can be set via browser.startup.homepage)
 *  1: the home page (as set by the browser.startup.homepage pref)
 *  2: the last page the user visited (DEPRECATED)
 *  3: windows and tabs from the last session (a.k.a. session restore)
 */

ChromeUtils.import("resource:///modules/HomePage.jsm");
ChromeUtils.import("resource:///modules/CliqzResources.jsm");

const STARTUP_PREF_BLANK = 0;
const STARTUP_PREF_HOMEPAGE = 1;

const ABOUT_BLANK_URL = 'about:blank';
let gHomePane = {
  HOME_MODE_CLIQZ_HOME: '0',
  HOME_MODE_CUSTOM: '1',
  HOME_MODE_BLANK: '2',

  /**
   * onMenuChange: triggered whatever a menulist item is changed
   * @param {obj} event Event which is fired by changing menulist item.
   * */
  onMenuChange(event) {
    const {value} = event.target;
    const homePref = HomePage.getAsString();
    const homePrefDefault = HomePage.getAsString(true);

    switch (value) {
      case this.HOME_MODE_CLIQZ_HOME:
        if (homePref !== homePrefDefault) {
          HomePage.set(homePrefDefault);
        } else {
          this._renderCustomSettings({shouldShow: false});
        }
        break;
      case this.HOME_MODE_BLANK:
        if (homePref !== ABOUT_BLANK_URL) {
          HomePage.set(ABOUT_BLANK_URL);
        } else {
          this._renderCustomSettings({shouldShow: false});
        }
        break;
      case this.HOME_MODE_CUSTOM:
        this._renderCustomSettings({shouldShow: true});
        break;
    }
  },

  /**
   * onCustomHomePageChange: triggered whatever a home page url is changed
   * @param {obj} event Event which is fired by changing a home page url value.
   * */
  onCustomHomePageChange(event) {
    const value = event.target.value || HomePage.getAsString(true);
    HomePage.set(value);
  },

  /**
   * Switches the "Use Current Page" button between its singular and plural
   * forms.
   */
  async _updateUseCurrentButton() {
    let useCurrent = document.getElementById("useCurrent");
    let tabs = this._getTabsForHomePage();

    const tabCount = tabs.length;

    document.l10n.setAttributes(useCurrent, "use-current-pages", { tabCount });

    // In this case, the button's disabled state is set by preferences.xml.
    let prefName = "pref.browser.homepage.disable_button.current_page";
    if (Preferences.get(prefName).locked)
      return;

    useCurrent.disabled = tabCount < 1;
  },

  /**
  * _isTabAboutPreferences: Is a given tab set to about:preferences?
  * @param {Element} aTab A tab element
  * @returns {bool} Is the linkedBrowser of aElement set to about:preferences?
  */
  _isTabAboutPreferences(aTab) {
    return aTab.linkedBrowser.currentURI.spec.startsWith("about:preferences");
  },

  /**
  * _getTabsForHomePage
  * @returns {Array} An array of current tabs
  */
  _getTabsForHomePage() {
    var tabs = [];
    var win = Services.wm.getMostRecentWindow("navigator:browser");

    if (win && win.document.documentElement
      .getAttribute("windowtype") == "navigator:browser") {
      // We should only include visible & non-pinned tabs

      tabs = win.gBrowser.visibleTabs.slice(win.gBrowser._numPinnedTabs);
      tabs = tabs.filter(tab => !this._isTabAboutPreferences(tab));
      // XXX: Bug 1441637 - Fix tabbrowser to report tab.closing before it blurs it
      tabs = tabs.filter(tab => !tab.closing);
    }

    return tabs;
  },

  /**
  * Sets the home page to the URL(s) of any currently opened tab(s),
  * updating about:preferences#general (Home section) UI to reflect this.
  */
  setHomePageToCurrent() {
    let tabs = this._getTabsForHomePage();
    function getTabURI(t) {
      return t.linkedBrowser.currentURI.spec;
    }

    // FIXME Bug 244192: using dangerous "|" joiner!
    if (tabs.length) {
      HomePage.set(tabs.map(getTabURI).join("|"));
    }

    Services.telemetry.scalarAdd("preferences.use_current_page", 1);
  },

  _setHomePageToBookmarkClosed(rv, aEvent) {
    if (aEvent.detail.button != "accept")
      return;
    if (rv.urls && rv.names) {
      // XXX still using dangerous "|" joiner!
      HomePage.set(rv.urls.join("|"));
    }
  },

   /**
   * Displays a dialog in which the user can select a bookmark to use as home
   * page.  If the user selects a bookmark, that bookmark's name is displayed in
   * UI and the bookmark's address is stored to the home page preference.
   */
  setHomePageToBookmark() {
    const rv = { urls: null, names: null };
    gSubDialog.open("chrome://browser/content/preferences/selectBookmark.xhtml",
      "resizable=yes, modal=yes", rv,
      this._setHomePageToBookmarkClosed.bind(this, rv));
    Services.telemetry.scalarAdd("preferences.use_bookmark", 1);
  },

  restoreDefaultHomePage() {
    HomePage.set(HomePage.getAsString(true));
  },

  onCustomHomePageInput(event) {
    if (this._telemetryHomePageTimer) {
      clearTimeout(this._telemetryHomePageTimer);
    }
    let browserHomePage = event.target.value;
    // The length of the home page URL string should be more then four,
    // and it should contain at least one ".", for example, "https://mozilla.org".
    if (browserHomePage.length > 4 && browserHomePage.includes(".")) {
      this._telemetryHomePageTimer = setTimeout(() => {
        let homePageNumber = browserHomePage.split("|").length;
        Services.telemetry.scalarAdd("preferences.browser_home_page_change", 1);
        Services.telemetry.keyedScalarAdd("preferences.browser_home_page_count", homePageNumber, 1);
      }, 3000);
    }
  },

  _renderHomepageMode(isControlled) {
    const isDefault = this._isHomePageDefaultValue();
    const isBlank = this.isHomePageBlank();
    const el = document.getElementById("homeMode");
    let newValue;

    if (isControlled) {
      newValue = this.HOME_MODE_CUSTOM;
    } else if (isDefault) {
      newValue = this.HOME_MODE_CLIQZ_HOME;
    } else if (isBlank) {
      newValue = this.HOME_MODE_BLANK;
    } else {
      newValue = this.HOME_MODE_CUSTOM;
    }
    if (el.value !== newValue) {
      el.value = newValue;
    }
  },

  syncFromHomePref() {
    this._updateUseCurrentButton();
    this._renderCustomSettings();
    this._renderHomepageMode();
  },

  /**
   * _renderCustomSettings: Hides or shows the UI for setting a custom
   * homepage URL
   * @param {obj} options
   * @param {bool} options.shouldShow Should the custom UI be shown?
   * @param {bool} options.isControlled Is an extension controlling the home page?
   */
  _renderCustomSettings(options = {}) {
    let {shouldShow, isControlled} = options;
    const customSettingsContainerEl = document.getElementById("customSettings");
    const customUrlEl = customSettingsContainerEl.querySelector("#homePageUrl");
    const homePref = HomePage.getAsString();

    const isHomePageCustom = isControlled || (!this._isHomePageDefaultValue() && !this.isHomePageBlank());
    if (shouldShow == null) {
      // CLIQZ-SPECIAL:
      // DB-2079:
      // We need to show `Set Custom URL` if isHomePageCustom equals true OR
      // if the textfield itself is empty AND is not hidden at the time (meaning it was opened before that).
      // The last check here is for making sure this function was not called for very first time.
      shouldShow = isHomePageCustom || !customUrlEl.value.trim() && !customSettingsContainerEl.hidden;
    }
    customSettingsContainerEl.hidden = !shouldShow;

    let newValue;
    if (!this._isHomePageDefaultValue() && homePref !== ABOUT_BLANK_URL) {
      newValue = homePref;
    } else {
      newValue = "";
    }
    if (customUrlEl.value !== newValue) {
      customUrlEl.value = newValue;
    }
  },

  /**
   * _isHomePageDefaultValue
   * @returns {bool} Is the homepage set to the default pref value?
   */
  _isHomePageDefaultValue() {
    const homePref = HomePage.getAsString();
    // CLIQZ-SPECIAL: DB-2454,
    // moz-extension freshtab is considered a default value as well.
    return homePref === HomePage.getAsString(true) ||
      CliqzResources.isCliqzPage(homePref);
  },

  /**
   * isHomePageBlank
   * @returns {bool} Is the homepage set to about:blank?
   */
  isHomePageBlank() {
    const homePref = HomePage.getAsString();
    return homePref === ABOUT_BLANK_URL || homePref === "";
  },

  init() {
    document.getElementById('homeMode').addEventListener('command', this.onMenuChange.bind(this));
    document.getElementById('homePageUrl').addEventListener('change', this.onCustomHomePageChange.bind(this));
    document.getElementById("homePageUrl").addEventListener('input', this.onCustomHomePageInput.bind(this));
    document.getElementById('useCurrent').addEventListener('command', this.setHomePageToCurrent.bind(this));
    document.getElementById('useBookmark').addEventListener('command', this.setHomePageToBookmark.bind(this));
    document.getElementById("restoreDefaultHomePage").addEventListener("command", this.restoreDefaultHomePage.bind(this));

    // set up the "use current page" label-changing listener
    this._updateUseCurrentButton();
    window.addEventListener("focus", this._updateUseCurrentButton.bind(this));
  }
};

