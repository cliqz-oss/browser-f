/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */

/* FIXME: ESlint globals workaround should be removed once bug 1395426 gets fixed */
/* globals DownloadUtils, LoadContextInfo */

Components.utils.import("resource://gre/modules/AppConstants.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PluralForm",
  "resource://gre/modules/PluralForm.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "LoginHelper",
  "resource://gre/modules/LoginHelper.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "SiteDataManager",
  "resource:///modules/SiteDataManager.jsm");

Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

const PREF_UPLOAD_ENABLED = "datareporting.healthreport.uploadEnabled";

var gStrings = Services.strings.createBundle("chrome://mozapps/locale/extensions/extensions.properties");

XPCOMUtils.defineLazyGetter(this, "AlertsServiceDND", function() {
  try {
    let alertsService = Cc["@mozilla.org/alerts-service;1"]
      .getService(Ci.nsIAlertsService)
      .QueryInterface(Ci.nsIAlertsDoNotDisturb);
    // This will throw if manualDoNotDisturb isn't implemented.
    alertsService.manualDoNotDisturb;
    return alertsService;
  } catch (ex) {
    return undefined;
  }
});

var gPrivacyPane = {
  _pane: null,

  /**
   * Whether the use has selected the auto-start private browsing mode in the UI.
   */
  _autoStartPrivateBrowsing: false,

  /**
   * Whether the prompt to restart Firefox should appear when changing the autostart pref.
   */
  _shouldPromptForRestart: true,

#if 0
  /**
   * Show the Tracking Protection UI depending on the
   * privacy.trackingprotection.ui.enabled pref, and linkify its Learn More link
   */
  _initTrackingProtection() {
    if (!Services.prefs.getBoolPref("privacy.trackingprotection.ui.enabled")) {
      return;
    }

    let link = document.getElementById("trackingProtectionLearnMore");
    let url = Services.urlFormatter.formatURLPref("app.support.baseURL") + "tracking-protection";
    link.setAttribute("href", url);

    this.trackingProtectionReadPrefs();

    document.getElementById("trackingProtectionExceptions").hidden = false;
    document.getElementById("trackingProtectionBox").hidden = false;
    document.getElementById("trackingProtectionPBMBox").hidden = true;
  },

  /**
   * Linkify the Learn More link of the Private Browsing Mode Tracking
   * Protection UI.
   */
  _initTrackingProtectionPBM() {
    let link = document.getElementById("trackingProtectionPBMLearnMore");
    let url = Services.urlFormatter.formatURLPref("app.support.baseURL") + "tracking-protection-pbm";
    link.setAttribute("href", url);
  },
#endif

  /**
   * Initialize autocomplete to ensure prefs are in sync.
   */
  _initAutocomplete() {
    Components.classes["@mozilla.org/autocomplete/search;1?name=unifiedcomplete"]
      .getService(Components.interfaces.mozIPlacesAutoComplete);
  },

  /**
   * Handles HttpsEverywhere integration
   */
  _initHttpsEverywhere() {
    const ADDON_ID = "https-everywhere@cliqz.com";
    const PREF = "extensions.https_everywhere.globalEnabled";
    const versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                             .getService(Components.interfaces.nsIVersionComparator);
    const FIRST_WEB_EXTENSION_VERSION = "2017.10.30";

    AddonManager.getAddonByID(ADDON_ID, function(addon) {
      if (!addon) {
        return;
      }
      var stateCheckbox = document.getElementById("httpsEverywhereEnable");

      if (versionChecker.compare(addon.version, FIRST_WEB_EXTENSION_VERSION) >= 0) {
        // HTTPS Everywhere is an web extension
        stateCheckbox.checked = !addon.userDisabled;
      }
      else if (addon && addon.isActive) {
        // HTTPS Everywhere is bootstraped
        stateCheckbox.checked = Services.prefs.getBoolPref(PREF);
      }
    });

    this.toggleHttpsEverywhere = function() {
      AddonManager.getAddonByID(ADDON_ID, function(addon) {
        if (versionChecker.compare(addon.version, FIRST_WEB_EXTENSION_VERSION) >= 0) {
          // HTTPS_Everywhere version 2017.10.30 and above is an WebExtension
          // and we control it by its userDisabled state
          addon.userDisabled = !addon.userDisabled;
        } else {
          // HTTPS_Everywhere version below 2017.10.30 is using bootstrap technology
          // and we control it by the globalEnabled pref
          Services.prefs.setBoolPref(PREF, !Services.prefs.getBoolPref(PREF));
        }
      })
    };
  },

  /**
   * Sets up the UI for the number of days of history to keep, and updates the
   * label of the "Clear Now..." button.
   */
  init() {
    function setEventListener(aId, aEventType, aCallback) {
      document.getElementById(aId)
        .addEventListener(aEventType, aCallback.bind(gPrivacyPane));
    }

    this._updateSanitizeSettingsButton();
    this.initializeHistoryMode();
    this.updateHistoryModePane();
    this.updatePrivacyMicroControls();
    this.initAutoStartPrivateBrowsingReverter();
#if 0
    this._initTrackingProtection();
    this._initTrackingProtectionPBM();
#endif
    this._initAutocomplete();

    this._initHttpsEverywhere();
#if CQZ_AUTO_PRIVATE_TAB
    const autoForgetTabs = Cc["@cliqz.com/browser/auto_forget_tabs_service;1"].
        getService(Ci.nsISupports).wrappedJSObject;
    document.getElementById("forgetMode").hidden = !autoForgetTabs.hasDatabase;
#endif

    setEventListener("privacy.sanitize.sanitizeOnShutdown", "change",
      gPrivacyPane._updateSanitizeSettingsButton);
    setEventListener("browser.privatebrowsing.autostart", "change",
      gPrivacyPane.updatePrivacyMicroControls);
    setEventListener("historyMode", "command", function() {
      gPrivacyPane.updateHistoryModePane();
      gPrivacyPane.updateHistoryModePrefs();
      gPrivacyPane.updatePrivacyMicroControls();
      gPrivacyPane.updateAutostart();
    });
    setEventListener("historyRememberClear", "click", function() {
      gPrivacyPane.clearPrivateDataNow(false);
      return false;
    });
    setEventListener("historyRememberCookies", "click", function() {
      gPrivacyPane.showCookies();
      return false;
    });
    setEventListener("historyDontRememberClear", "click", function() {
      gPrivacyPane.clearPrivateDataNow(true);
      return false;
    });
    setEventListener("privateBrowsingAutoStart", "command",
      gPrivacyPane.updateAutostart);
    setEventListener("cookieExceptions", "command",
      gPrivacyPane.showCookieExceptions);
    setEventListener("showCookiesButton", "command",
      gPrivacyPane.showCookies);
    setEventListener("clearDataSettings", "command",
      gPrivacyPane.showClearPrivateDataSettings);
#if 0
    setEventListener("trackingProtectionRadioGroup", "command",
      gPrivacyPane.trackingProtectionWritePrefs);
    setEventListener("trackingProtectionExceptions", "command",
      gPrivacyPane.showTrackingProtectionExceptions);
    setEventListener("changeBlockList", "command",
      gPrivacyPane.showBlockLists);
#endif
    setEventListener("passwordExceptions", "command",
      gPrivacyPane.showPasswordExceptions);
    setEventListener("useMasterPassword", "command",
      gPrivacyPane.updateMasterPasswordButton);
    setEventListener("changeMasterPassword", "command",
      gPrivacyPane.changeMasterPassword);
    setEventListener("showPasswords", "command",
      gPrivacyPane.showPasswords);
#if 0
    setEventListener("addonExceptions", "command",
      gPrivacyPane.showAddonExceptions);
#endif
    setEventListener("viewCertificatesButton", "command",
      gPrivacyPane.showCertificates);
    setEventListener("viewSecurityDevicesButton", "command",
      gPrivacyPane.showSecurityDevices);
    setEventListener("clearCacheButton", "command",
      gPrivacyPane.clearCache);

    this._pane = document.getElementById("panePrivacy");
    this._initMasterPasswordUI();
    this._initSafeBrowsing();
    this.updateCacheSizeInputField();
    this.updateActualCacheSize();
    this._initGhosteryUI();

    setEventListener("notificationSettingsButton", "command",
      gPrivacyPane.showNotificationExceptions);
    setEventListener("locationSettingsButton", "command",
      gPrivacyPane.showLocationExceptions);
    setEventListener("cameraSettingsButton", "command",
      gPrivacyPane.showCameraExceptions);
    setEventListener("microphoneSettingsButton", "command",
      gPrivacyPane.showMicrophoneExceptions);
    setEventListener("popupPolicyButton", "command",
      gPrivacyPane.showPopupExceptions);
    setEventListener("notificationsDoNotDisturb", "command",
      gPrivacyPane.toggleDoNotDisturbNotifications);

    let bundlePrefs = document.getElementById("bundlePreferences");

    if (AlertsServiceDND) {
      let notificationsDoNotDisturbBox =
        document.getElementById("notificationsDoNotDisturbBox");
      notificationsDoNotDisturbBox.removeAttribute("hidden");
      let checkbox = document.getElementById("notificationsDoNotDisturb");
      let brandName = document.getElementById("bundleBrand")
        .getString("brandShortName");
      checkbox.setAttribute("label",
        bundlePrefs.getFormattedString("pauseNotifications.label",
          [brandName]));
      checkbox.setAttribute("accesskey", bundlePrefs.getString("pauseNotifications.accesskey"));
      if (AlertsServiceDND.manualDoNotDisturb) {
        let notificationsDoNotDisturb =
          document.getElementById("notificationsDoNotDisturb");
        notificationsDoNotDisturb.setAttribute("checked", true);
      }
    }

    setEventListener("cacheSize", "change",
      gPrivacyPane.updateCacheSizePref);

    if (Services.prefs.getBoolPref("browser.storageManager.enabled")) {
      Services.obs.addObserver(this, "sitedatamanager:sites-updated");
      Services.obs.addObserver(this, "sitedatamanager:updating-sites");
      let unload = () => {
        window.removeEventListener("unload", unload);
        Services.obs.removeObserver(this, "sitedatamanager:sites-updated");
        Services.obs.removeObserver(this, "sitedatamanager:updating-sites");
      };
      window.addEventListener("unload", unload);
      SiteDataManager.updateSites();
      setEventListener("clearSiteDataButton", "command",
        gPrivacyPane.clearSiteData);
      setEventListener("siteDataSettings", "command",
        gPrivacyPane.showSiteDataSettings);
      let url = Services.urlFormatter.formatURLPref("app.support.baseURL") + "storage-permissions";
      document.getElementById("siteDataLearnMoreLink").setAttribute("href", url);
      let siteDataGroup = document.getElementById("siteDataGroup");
      siteDataGroup.removeAttribute("data-hidden-from-search");
    }

    let notificationInfoURL =
      Services.urlFormatter.formatURLPref("app.support.baseURL") + "push";
    document.getElementById("notificationPermissionsLearnMore").setAttribute("href",
      notificationInfoURL);
    let drmInfoURL =
      Services.urlFormatter.formatURLPref("app.support.baseURL") + "drm-content";
    document.getElementById("playDRMContentLink").setAttribute("href", drmInfoURL);
    let emeUIEnabled = Services.prefs.getBoolPref("browser.eme.ui.enabled");
    // Force-disable/hide on WinXP:
    if (navigator.platform.toLowerCase().startsWith("win")) {
      emeUIEnabled = emeUIEnabled && parseFloat(Services.sysinfo.get("version")) >= 6;
    }
    if (!emeUIEnabled) {
      // Don't want to rely on .hidden for the toplevel groupbox because
      // of the pane hiding/showing code potentially interfering:
      document.getElementById("drmGroup").setAttribute("style", "display: none !important");
    }

    this.initDataCollection();
    if (AppConstants.MOZ_CRASHREPORTER) {
      this.initSubmitCrashes();
    }
    this.initSubmitHealthReport();
    setEventListener("submitHealthReportBox", "command",
      gPrivacyPane.updateSubmitHealthReport);
    this._initA11yState();
    let signonBundle = document.getElementById("signonBundle");
    let pkiBundle = document.getElementById("pkiBundle");
    appendSearchKeywords("passwordExceptions", [
      bundlePrefs.getString("savedLoginsExceptions_title"),
      bundlePrefs.getString("savedLoginsExceptions_desc3"),
    ]);
    appendSearchKeywords("showPasswords", [
      signonBundle.getString("loginsDescriptionAll2"),
    ]);
    appendSearchKeywords("cookieExceptions", [
      bundlePrefs.getString("cookiepermissionstext"),
    ]);
    appendSearchKeywords("showCookiesButton", [
      bundlePrefs.getString("cookiesAll"),
      bundlePrefs.getString("removeAllCookies.label"),
      bundlePrefs.getString("removeAllShownCookies.label"),
      bundlePrefs.getString("removeSelectedCookies.label"),
    ]);
#if 0
    appendSearchKeywords("trackingProtectionExceptions", [
      bundlePrefs.getString("trackingprotectionpermissionstitle"),
      bundlePrefs.getString("trackingprotectionpermissionstext2"),
    ]);
    appendSearchKeywords("changeBlockList", [
      bundlePrefs.getString("blockliststitle"),
      bundlePrefs.getString("blockliststext"),
    ]);
#endif
    appendSearchKeywords("popupPolicyButton", [
      bundlePrefs.getString("popuppermissionstitle2"),
      bundlePrefs.getString("popuppermissionstext"),
    ]);
    appendSearchKeywords("notificationSettingsButton", [
      bundlePrefs.getString("notificationspermissionstitle2"),
      bundlePrefs.getString("notificationspermissionstext5"),
    ]);
    appendSearchKeywords("locationSettingsButton", [
      bundlePrefs.getString("locationpermissionstitle"),
      bundlePrefs.getString("locationpermissionstext"),
    ]);
    appendSearchKeywords("cameraSettingsButton", [
      bundlePrefs.getString("camerapermissionstitle"),
      bundlePrefs.getString("camerapermissionstext"),
    ]);
    appendSearchKeywords("microphoneSettingsButton", [
      bundlePrefs.getString("microphonepermissionstitle"),
      bundlePrefs.getString("microphonepermissionstext"),
    ]);
#if 0
    appendSearchKeywords("addonExceptions", [
      bundlePrefs.getString("addons_permissions_title2"),
      bundlePrefs.getString("addonspermissionstext"),
    ]);
#endif
    appendSearchKeywords("viewSecurityDevicesButton", [
      pkiBundle.getString("enable_fips"),
    ]);
    appendSearchKeywords("siteDataSettings", [
      bundlePrefs.getString("siteDataSettings2.description"),
      bundlePrefs.getString("removeAllCookies.label"),
      bundlePrefs.getString("removeSelectedCookies.label"),
    ]);

    // Notify observers that the UI is now ready
    Services.obs.notifyObservers(window, "privacy-pane-loaded");
  },

  // TRACKING PROTECTION MODE

  /**
   * Selects the right item of the Tracking Protection radiogroup.
   */
  trackingProtectionReadPrefs() {
    let enabledPref = document.getElementById("privacy.trackingprotection.enabled");
    let pbmPref = document.getElementById("privacy.trackingprotection.pbmode.enabled");
    let radiogroup = document.getElementById("trackingProtectionRadioGroup");

    // Global enable takes precedence over enabled in Private Browsing.
    if (enabledPref.value) {
      radiogroup.value = "always";
    } else if (pbmPref.value) {
      radiogroup.value = "private";
    } else {
      radiogroup.value = "never";
    }
  },

  /**
   * Sets the pref values based on the selected item of the radiogroup.
   */
  trackingProtectionWritePrefs() {
    let enabledPref = document.getElementById("privacy.trackingprotection.enabled");
    let pbmPref = document.getElementById("privacy.trackingprotection.pbmode.enabled");
    let radiogroup = document.getElementById("trackingProtectionRadioGroup");

    switch (radiogroup.value) {
      case "always":
        enabledPref.value = true;
        pbmPref.value = true;
        break;
      case "private":
        enabledPref.value = false;
        pbmPref.value = true;
        break;
      case "never":
        enabledPref.value = false;
        pbmPref.value = false;
        break;
    }
  },

  // HISTORY MODE

  /**
   * The list of preferences which affect the initial history mode settings.
   * If the auto start private browsing mode pref is active, the initial
   * history mode would be set to "Don't remember anything".
   * If ALL of these preferences are set to the values that correspond
   * to keeping some part of history, and the auto-start
   * private browsing mode is not active, the initial history mode would be
   * set to "Remember everything".
   * Otherwise, the initial history mode would be set to "Custom".
   *
   * Extensions adding their own preferences can set values here if needed.
   */
  prefsForKeepingHistory: {
    "places.history.enabled": true, // History is enabled
    "browser.formfill.enable": true, // Form information is saved
    "network.cookie.cookieBehavior": 0, // All cookies are enabled
    "network.cookie.lifetimePolicy": 0, // Cookies use supplied lifetime
    "privacy.sanitize.sanitizeOnShutdown": false, // Private date is NOT cleared on shutdown
  },

  /**
   * The list of control IDs which are dependent on the auto-start private
   * browsing setting, such that in "Custom" mode they would be disabled if
   * the auto-start private browsing checkbox is checked, and enabled otherwise.
   *
   * Extensions adding their own controls can append their IDs to this array if needed.
   */
  dependentControls: [
    "rememberHistory",
    "rememberForms",
    "keepUntil",
    "keepCookiesUntil",
    "alwaysClear",
    "clearDataSettings"
  ],

  /**
   * Check whether preferences values are set to keep history
   *
   * @param aPrefs an array of pref names to check for
   * @returns boolean true if all of the prefs are set to keep history,
   *                  false otherwise
   */
  _checkHistoryValues(aPrefs) {
    for (let pref of Object.keys(aPrefs)) {
      if (document.getElementById(pref).value != aPrefs[pref])
        return false;
    }
    return true;
  },

  /**
   * Initialize the history mode menulist based on the privacy preferences
   */
  initializeHistoryMode() {
    let mode;
    let getVal = aPref => document.getElementById(aPref).value;

    if (getVal("privacy.history.custom"))
      mode = "custom";
    else if (this._checkHistoryValues(this.prefsForKeepingHistory)) {
      if (getVal("browser.privatebrowsing.autostart"))
        mode = "dontremember";
      else
        mode = "remember";
    } else
      mode = "custom";

    document.getElementById("historyMode").value = mode;
  },

  /**
   * Update the selected pane based on the history mode menulist
   */
  updateHistoryModePane() {
    let selectedIndex = -1;
    switch (document.getElementById("historyMode").value) {
      case "remember":
        selectedIndex = 0;
        break;
      case "dontremember":
        selectedIndex = 1;
        break;
      case "custom":
        selectedIndex = 2;
        break;
    }
    document.getElementById("historyPane").selectedIndex = selectedIndex;
    document.getElementById("privacy.history.custom").value = selectedIndex == 2;
  },

  /**
   * Update the private browsing auto-start pref and the history mode
   * micro-management prefs based on the history mode menulist
   */
  updateHistoryModePrefs() {
    let pref = document.getElementById("browser.privatebrowsing.autostart");
    switch (document.getElementById("historyMode").value) {
      case "remember":
        if (pref.value)
          pref.value = false;

        // select the remember history option if needed
        document.getElementById("places.history.enabled").value = true;

        // select the remember forms history option
        document.getElementById("browser.formfill.enable").value = true;

        // select the allow cookies option
        document.getElementById("network.cookie.cookieBehavior").value = 0;
        // select the cookie lifetime policy option
        document.getElementById("network.cookie.lifetimePolicy").value = 0;

        // select the clear on close option
        document.getElementById("privacy.sanitize.sanitizeOnShutdown").value = false;
        break;
      case "dontremember":
        if (!pref.value)
          pref.value = true;
        break;
    }
  },

  /**
   * Update the privacy micro-management controls based on the
   * value of the private browsing auto-start checkbox.
   */
  updatePrivacyMicroControls() {
    if (document.getElementById("historyMode").value == "custom") {
      let disabled = this._autoStartPrivateBrowsing =
        document.getElementById("privateBrowsingAutoStart").checked;
      this.dependentControls.forEach(function(aElement) {
        let control = document.getElementById(aElement);
        let preferenceId = control.getAttribute("preference");
        if (!preferenceId) {
          let dependentControlId = control.getAttribute("control");
          if (dependentControlId) {
            let dependentControl = document.getElementById(dependentControlId);
            preferenceId = dependentControl.getAttribute("preference");
          }
        }

        let preference = preferenceId ? document.getElementById(preferenceId) : {};
        control.disabled = disabled || preference.locked;
      });

      // adjust the cookie controls status
      this.readAcceptCookies();
      let lifetimePolicy = document.getElementById("network.cookie.lifetimePolicy").value;
      if (lifetimePolicy != Ci.nsICookieService.ACCEPT_NORMALLY &&
        lifetimePolicy != Ci.nsICookieService.ACCEPT_SESSION &&
        lifetimePolicy != Ci.nsICookieService.ACCEPT_FOR_N_DAYS) {
        lifetimePolicy = Ci.nsICookieService.ACCEPT_NORMALLY;
      }
      document.getElementById("keepCookiesUntil").value = disabled ? 2 : lifetimePolicy;

      // adjust the checked state of the sanitizeOnShutdown checkbox
      document.getElementById("alwaysClear").checked = disabled ? false :
        document.getElementById("privacy.sanitize.sanitizeOnShutdown").value;

      // adjust the checked state of the remember history checkboxes
      document.getElementById("rememberHistory").checked = disabled ? false :
        document.getElementById("places.history.enabled").value;
      document.getElementById("rememberForms").checked = disabled ? false :
        document.getElementById("browser.formfill.enable").value;

      if (!disabled) {
        // adjust the Settings button for sanitizeOnShutdown
        this._updateSanitizeSettingsButton();
      }
    }
  },

  // PRIVATE BROWSING

  /**
   * Initialize the starting state for the auto-start private browsing mode pref reverter.
   */
  initAutoStartPrivateBrowsingReverter() {
    let mode = document.getElementById("historyMode");
    let autoStart = document.getElementById("privateBrowsingAutoStart");
    this._lastMode = mode.selectedIndex;
    this._lastCheckState = autoStart.hasAttribute("checked");
  },

  _lastMode: null,
  _lastCheckState: null,
  updateAutostart() {
    let mode = document.getElementById("historyMode");
    let autoStart = document.getElementById("privateBrowsingAutoStart");
    let pref = document.getElementById("browser.privatebrowsing.autostart");
    if ((mode.value == "custom" && this._lastCheckState == autoStart.checked) ||
      (mode.value == "remember" && !this._lastCheckState) ||
      (mode.value == "dontremember" && this._lastCheckState)) {
      // These are all no-op changes, so we don't need to prompt.
      this._lastMode = mode.selectedIndex;
      this._lastCheckState = autoStart.hasAttribute("checked");
      return;
    }

    if (!this._shouldPromptForRestart) {
      // We're performing a revert. Just let it happen.
      return;
    }

    let buttonIndex = confirmRestartPrompt(autoStart.checked, 1,
      true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      pref.value = autoStart.hasAttribute("checked");
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
      return;
    }

    this._shouldPromptForRestart = false;

    if (this._lastCheckState) {
      autoStart.checked = "checked";
    } else {
      autoStart.removeAttribute("checked");
    }
    pref.value = autoStart.hasAttribute("checked");
    mode.selectedIndex = this._lastMode;
    mode.doCommand();

    this._shouldPromptForRestart = true;
  },

#if 0
  /**
   * Displays fine-grained, per-site preferences for tracking protection.
   */
  showTrackingProtectionExceptions() {
    let bundlePreferences = document.getElementById("bundlePreferences");
    let params = {
      permissionType: "trackingprotection",
      hideStatusColumn: true,
      windowTitle: bundlePreferences.getString("trackingprotectionpermissionstitle"),
      introText: bundlePreferences.getString("trackingprotectionpermissionstext2"),
    };
    gSubDialog.open("chrome://browser/content/preferences/permissions.xul",
      null, params);
  },

  /**
   * Displays the available block lists for tracking protection.
   */
  showBlockLists() {
    var bundlePreferences = document.getElementById("bundlePreferences");
    let brandName = document.getElementById("bundleBrand")
      .getString("brandShortName");
    var params = {
      brandShortName: brandName,
      windowTitle: bundlePreferences.getString("blockliststitle"),
      introText: bundlePreferences.getString("blockliststext")
    };
    gSubDialog.open("chrome://browser/content/preferences/blocklists.xul",
      null, params);
  },
#endif

  /**
   * Displays container panel for customising and adding containers.
   */
  showContainerSettings() {
    gotoPref("containers");
  },

  /**
   * Displays the Do Not Track settings dialog.
   */
  showDoNotTrackSettings() {
    gSubDialog.open("chrome://browser/content/preferences/donottrack.xul",
      "resizable=no");
  },

  // HISTORY

  /*
   * Preferences:
   *
   * places.history.enabled
   * - whether history is enabled or not
   * browser.formfill.enable
   * - true if entries in forms and the search bar should be saved, false
   *   otherwise
   */

  // COOKIES

  /*
   * Preferences:
   *
   * network.cookie.cookieBehavior
   * - determines how the browser should handle cookies:
   *     0   means enable all cookies
   *     1   means reject all third party cookies
   *     2   means disable all cookies
   *     3   means reject third party cookies unless at least one is already set for the eTLD
   *         see netwerk/cookie/src/nsCookieService.cpp for details
   * network.cookie.lifetimePolicy
   * - determines how long cookies are stored:
   *     0   means keep cookies until they expire
   *     2   means keep cookies until the browser is closed
   */

  /**
   * Reads the network.cookie.cookieBehavior preference value and
   * enables/disables the rest of the cookie UI accordingly, returning true
   * if cookies are enabled.
   */
  readAcceptCookies() {
    var pref = document.getElementById("network.cookie.cookieBehavior");
    var acceptThirdPartyLabel = document.getElementById("acceptThirdPartyLabel");
    var acceptThirdPartyMenu = document.getElementById("acceptThirdPartyMenu");
    var keepUntil = document.getElementById("keepUntil");
    var menu = document.getElementById("keepCookiesUntil");

    // enable the rest of the UI for anything other than "disable all cookies"
    var acceptCookies = (pref.value != 2);

    acceptThirdPartyLabel.disabled = acceptThirdPartyMenu.disabled = !acceptCookies;
    keepUntil.disabled = menu.disabled = this._autoStartPrivateBrowsing || !acceptCookies;

    return acceptCookies;
  },

  /**
   * Enables/disables the "keep until" label and menulist in response to the
   * "accept cookies" checkbox being checked or unchecked.
   */
  writeAcceptCookies() {
    var accept = document.getElementById("acceptCookies");
    var acceptThirdPartyMenu = document.getElementById("acceptThirdPartyMenu");

    // if we're enabling cookies, automatically select 'accept third party always'
    if (accept.checked)
      acceptThirdPartyMenu.selectedIndex = 0;

    return accept.checked ? 0 : 2;
  },

  /**
   * Converts between network.cookie.cookieBehavior and the third-party cookie UI
   */
  readAcceptThirdPartyCookies() {
    var pref = document.getElementById("network.cookie.cookieBehavior");
    switch (pref.value) {
      case 0:
        return "always";
      case 1:
        return "never";
      case 2:
        return "never";
      case 3:
        return "visited";
      default:
        return undefined;
    }
  },

  writeAcceptThirdPartyCookies() {
    var accept = document.getElementById("acceptThirdPartyMenu").selectedItem;
    switch (accept.value) {
      case "always":
        return 0;
      case "visited":
        return 3;
      case "never":
        return 1;
      default:
        return undefined;
    }
  },

  /**
   * Displays fine-grained, per-site preferences for cookies.
   */
  showCookieExceptions() {
    var bundlePreferences = document.getElementById("bundlePreferences");
    var params = {
      blockVisible: true,
      sessionVisible: true,
      allowVisible: true,
      prefilledHost: "",
      permissionType: "cookie",
      windowTitle: bundlePreferences.getString("cookiepermissionstitle"),
      introText: bundlePreferences.getString("cookiepermissionstext")
    };
    gSubDialog.open("chrome://browser/content/preferences/permissions.xul",
      null, params);
  },

  /**
   * Displays all the user's cookies in a dialog.
   */
  showCookies(aCategory) {
    gSubDialog.open("chrome://browser/content/preferences/cookies.xul");
  },

  // CLEAR PRIVATE DATA

  /*
   * Preferences:
   *
   * privacy.sanitize.sanitizeOnShutdown
   * - true if the user's private data is cleared on startup according to the
   *   Clear Private Data settings, false otherwise
   */

  /**
   * Displays the Clear Private Data settings dialog.
   */
  showClearPrivateDataSettings() {
    gSubDialog.open("chrome://browser/content/preferences/sanitize.xul", "resizable=no");
  },


  /**
   * Displays a dialog from which individual parts of private data may be
   * cleared.
   */
  clearPrivateDataNow(aClearEverything) {
    var ts = document.getElementById("privacy.sanitize.timeSpan");
    var timeSpanOrig = ts.value;

    if (aClearEverything) {
      ts.value = 0;
    }

    gSubDialog.open("chrome://browser/content/sanitize.xul", "resizable=no", null, () => {
      // reset the timeSpan pref
      if (aClearEverything) {
        ts.value = timeSpanOrig;
      }

      Services.obs.notifyObservers(null, "clear-private-data");
    });
  },

  /**
   * Enables or disables the "Settings..." button depending
   * on the privacy.sanitize.sanitizeOnShutdown preference value
   */
  _updateSanitizeSettingsButton() {
    var settingsButton = document.getElementById("clearDataSettings");
    var sanitizeOnShutdownPref = document.getElementById("privacy.sanitize.sanitizeOnShutdown");

    settingsButton.disabled = !sanitizeOnShutdownPref.value;
  },

  toggleDoNotDisturbNotifications(event) {
    AlertsServiceDND.manualDoNotDisturb = event.target.checked;
  },

  // GEOLOCATION

  /**
   * Displays the location exceptions dialog where specific site location
   * preferences can be set.
   */
  showLocationExceptions() {
    let bundlePreferences = document.getElementById("bundlePreferences");
    let params = { permissionType: "geo" };
    params.windowTitle = bundlePreferences.getString("locationpermissionstitle");
    params.introText = bundlePreferences.getString("locationpermissionstext");

    gSubDialog.open("chrome://browser/content/preferences/sitePermissions.xul",
      "resizable=yes", params);
  },

  // CAMERA

  /**
   * Displays the camera exceptions dialog where specific site camera
   * preferences can be set.
   */
  showCameraExceptions() {
    let bundlePreferences = document.getElementById("bundlePreferences");
    let params = { permissionType: "camera" };
    params.windowTitle = bundlePreferences.getString("camerapermissionstitle");
    params.introText = bundlePreferences.getString("camerapermissionstext");

    gSubDialog.open("chrome://browser/content/preferences/sitePermissions.xul",
      "resizable=yes", params);
  },

  // MICROPHONE

  /**
   * Displays the microphone exceptions dialog where specific site microphone
   * preferences can be set.
   */
  showMicrophoneExceptions() {
    let bundlePreferences = document.getElementById("bundlePreferences");
    let params = { permissionType: "microphone" };
    params.windowTitle = bundlePreferences.getString("microphonepermissionstitle");
    params.introText = bundlePreferences.getString("microphonepermissionstext");

    gSubDialog.open("chrome://browser/content/preferences/sitePermissions.xul",
      "resizable=yes", params);
  },

  // NOTIFICATIONS

  /**
   * Displays the notifications exceptions dialog where specific site notification
   * preferences can be set.
   */
  showNotificationExceptions() {
    let bundlePreferences = document.getElementById("bundlePreferences");
    let params = { permissionType: "desktop-notification" };
    params.windowTitle = bundlePreferences.getString("notificationspermissionstitle2");
    params.introText = bundlePreferences.getString("notificationspermissionstext5");

    gSubDialog.open("chrome://browser/content/preferences/sitePermissions.xul",
      "resizable=yes", params);

    try {
      Services.telemetry
        .getHistogramById("WEB_NOTIFICATION_EXCEPTIONS_OPENED").add();
    } catch (e) { }
  },


  // POP-UPS

  /**
   * Displays the popup exceptions dialog where specific site popup preferences
   * can be set.
   */
  showPopupExceptions() {
    var bundlePreferences = document.getElementById("bundlePreferences");
    var params = {
      blockVisible: false, sessionVisible: false, allowVisible: true,
      prefilledHost: "", permissionType: "popup"
    };
    params.windowTitle = bundlePreferences.getString("popuppermissionstitle2");
    params.introText = bundlePreferences.getString("popuppermissionstext");

    gSubDialog.open("chrome://browser/content/preferences/permissions.xul",
      "resizable=yes", params);
  },

  // UTILITY FUNCTIONS

  /**
   * Utility function to enable/disable the button specified by aButtonID based
   * on the value of the Boolean preference specified by aPreferenceID.
   */
  updateButtons(aButtonID, aPreferenceID) {
    var button = document.getElementById(aButtonID);
    var preference = document.getElementById(aPreferenceID);
    button.disabled = preference.value != true;
    return undefined;
  },

  // BEGIN UI CODE

  /*
   * Preferences:
   *
   * dom.disable_open_during_load
   * - true if popups are blocked by default, false otherwise
   */

  // POP-UPS

  /**
   * Displays a dialog in which the user can view and modify the list of sites
   * where passwords are never saved.
   */
  showPasswordExceptions() {
    var bundlePrefs = document.getElementById("bundlePreferences");
    var params = {
      blockVisible: true,
      sessionVisible: false,
      allowVisible: false,
      hideStatusColumn: true,
      prefilledHost: "",
      permissionType: "login-saving",
      windowTitle: bundlePrefs.getString("savedLoginsExceptions_title"),
      introText: bundlePrefs.getString("savedLoginsExceptions_desc3")
    };

    gSubDialog.open("chrome://browser/content/preferences/permissions.xul",
      null, params);
  },

  /**
   * Initializes master password UI: the "use master password" checkbox, selects
   * the master password button to show, and enables/disables it as necessary.
   * The master password is controlled by various bits of NSS functionality, so
   * the UI for it can't be controlled by the normal preference bindings.
   */
  _initMasterPasswordUI() {
    var noMP = !LoginHelper.isMasterPasswordSet();

    var button = document.getElementById("changeMasterPassword");
    button.disabled = noMP;

    var checkbox = document.getElementById("useMasterPassword");
    checkbox.checked = !noMP;

    gPasswordManagers.init();
  },

  /**
   * Initialize Ghostery addon UI box
   */
  _initGhosteryUI() {
    gPrivacyManagers.init();
  },

  /**
   * Enables/disables the master password button depending on the state of the
   * "use master password" checkbox, and prompts for master password removal if
   * one is set.
   */
  updateMasterPasswordButton() {
    var checkbox = document.getElementById("useMasterPassword");
    var button = document.getElementById("changeMasterPassword");
    button.disabled = !checkbox.checked;

    // unchecking the checkbox should try to immediately remove the master
    // password, because it's impossible to non-destructively remove the master
    // password used to encrypt all the passwords without providing it (by
    // design), and it would be extremely odd to pop up that dialog when the
    // user closes the prefwindow and saves his settings
    if (!checkbox.checked)
      this._removeMasterPassword();
    else
      this.changeMasterPassword();

    this._initMasterPasswordUI();
  },

  /**
   * Displays the "remove master password" dialog to allow the user to remove
   * the current master password.  When the dialog is dismissed, master password
   * UI is automatically updated.
   */
  _removeMasterPassword() {
    var secmodDB = Cc["@mozilla.org/security/pkcs11moduledb;1"].
      getService(Ci.nsIPKCS11ModuleDB);
    if (secmodDB.isFIPSEnabled) {
      var bundle = document.getElementById("bundlePreferences");
      Services.prompt.alert(window,
        bundle.getString("pw_change_failed_title"),
        bundle.getString("pw_change2empty_in_fips_mode"));
      this._initMasterPasswordUI();
    } else {
      gSubDialog.open("chrome://mozapps/content/preferences/removemp.xul",
        null, null, this._initMasterPasswordUI.bind(this));
    }
  },

  /**
   * Displays a dialog in which the master password may be changed.
   */
  changeMasterPassword() {
    gSubDialog.open("chrome://mozapps/content/preferences/changemp.xul",
      "resizable=no", null, this._initMasterPasswordUI.bind(this));
  },

  /**
 * Shows the sites where the user has saved passwords and the associated login
 * information.
 */
  showPasswords() {
    gSubDialog.open("chrome://passwordmgr/content/passwordManager.xul");
  },

  /**
   * Enables/disables the Exceptions button used to configure sites where
   * passwords are never saved. When browser is set to start in Private
   * Browsing mode, the "Remember passwords" UI is useless, so we disable it.
   */
  readSavePasswords() {
    var pref = document.getElementById("signon.rememberSignons");
    var excepts = document.getElementById("passwordExceptions");

    if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
      document.getElementById("savePasswords").disabled = true;
      excepts.disabled = true;
      return false;
    }
    excepts.disabled = !pref.value;
    // don't override pref value in UI
    return undefined;
  },

  /**
   * Enables/disables the add-ons Exceptions button depending on whether
   * or not add-on installation warnings are displayed.
   */
  readWarnAddonInstall() {
    var warn = document.getElementById("xpinstall.whitelist.required");
    var exceptions = document.getElementById("addonExceptions");

    exceptions.disabled = !warn.value;

    // don't override the preference value
    return undefined;
  },

  _initSafeBrowsing() {
    let enableSafeBrowsing = document.getElementById("enableSafeBrowsing");
    let blockDownloads = document.getElementById("blockDownloads");
    let blockUncommonUnwanted = document.getElementById("blockUncommonUnwanted");

    let safeBrowsingPhishingPref = document.getElementById("browser.safebrowsing.phishing.enabled");
    let safeBrowsingMalwarePref = document.getElementById("browser.safebrowsing.malware.enabled");

    let blockDownloadsPref = document.getElementById("browser.safebrowsing.downloads.enabled");
    let malwareTable = document.getElementById("urlclassifier.malwareTable");

    let blockUnwantedPref = document.getElementById("browser.safebrowsing.downloads.remote.block_potentially_unwanted");
    let blockUncommonPref = document.getElementById("browser.safebrowsing.downloads.remote.block_uncommon");

    let learnMoreLink = document.getElementById("enableSafeBrowsingLearnMore");
    let phishingUrl = Services.urlFormatter.formatURLPref("app.support.baseURL") + "phishing-malware";
    learnMoreLink.setAttribute("href", phishingUrl);

    enableSafeBrowsing.addEventListener("command", function() {
      safeBrowsingPhishingPref.value = enableSafeBrowsing.checked;
      safeBrowsingMalwarePref.value = enableSafeBrowsing.checked;

      if (enableSafeBrowsing.checked) {
        if (blockDownloads) {
          blockDownloads.removeAttribute("disabled");
          if (blockDownloads.checked) {
            blockUncommonUnwanted.removeAttribute("disabled");
          }
        } else {
          blockUncommonUnwanted.removeAttribute("disabled");
        }
      } else {
        if (blockDownloads) {
          blockDownloads.setAttribute("disabled", "true");
        }
        blockUncommonUnwanted.setAttribute("disabled", "true");
      }
    });

    if (blockDownloads) {
      blockDownloads.addEventListener("command", function() {
        blockDownloadsPref.value = blockDownloads.checked;
        if (blockDownloads.checked) {
          blockUncommonUnwanted.removeAttribute("disabled");
        } else {
          blockUncommonUnwanted.setAttribute("disabled", "true");
        }
      });
    }

    blockUncommonUnwanted.addEventListener("command", function() {
      blockUnwantedPref.value = blockUncommonUnwanted.checked;
      blockUncommonPref.value = blockUncommonUnwanted.checked;

      let malware = malwareTable.value
        .split(",")
        .filter(x => x !== "goog-unwanted-proto" &&
                     x !== "goog-unwanted-shavar" &&
                     x !== "test-unwanted-simple");

      if (blockUncommonUnwanted.checked) {
        if (malware.indexOf("goog-malware-shavar") != -1) {
          malware.push("goog-unwanted-shavar");
        } else {
          malware.push("goog-unwanted-proto");
        }

        malware.push("test-unwanted-simple");
      }

      // sort alphabetically to keep the pref consistent
      malware.sort();

      malwareTable.value = malware.join(",");
    });

    // set initial values

    enableSafeBrowsing.checked = safeBrowsingPhishingPref.value && safeBrowsingMalwarePref.value;
    if (!enableSafeBrowsing.checked) {
      if (blockDownloads) {
        blockDownloads.setAttribute("disabled", "true");
      }

      blockUncommonUnwanted.setAttribute("disabled", "true");
    }

    if (blockDownloads) {
      blockDownloads.checked = blockDownloadsPref.value;
      if (!blockDownloadsPref.value) {
        blockUncommonUnwanted.setAttribute("disabled", "true");
      }
    }

    blockUncommonUnwanted.checked = blockUnwantedPref.value && blockUncommonPref.value;
  },

#if 0
  /**
   * Displays the exceptions lists for add-on installation warnings.
   */
  showAddonExceptions() {
    var bundlePrefs = document.getElementById("bundlePreferences");

    var params = this._addonParams;
    if (!params.windowTitle || !params.introText) {
      params.windowTitle = bundlePrefs.getString("addons_permissions_title2");
      params.introText = bundlePrefs.getString("addonspermissionstext");
    }

    gSubDialog.open("chrome://browser/content/preferences/permissions.xul",
      null, params);
  },
#endif

  /**
   * Parameters for the add-on install permissions dialog.
   */
  _addonParams:
  {
    blockVisible: false,
    sessionVisible: false,
    allowVisible: true,
    prefilledHost: "",
    permissionType: "install"
  },

  /**
   * readEnableOCSP is used by the preferences UI to determine whether or not
   * the checkbox for OCSP fetching should be checked (it returns true if it
   * should be checked and false otherwise). The about:config preference
   * "security.OCSP.enabled" is an integer rather than a boolean, so it can't be
   * directly mapped from {true,false} to {checked,unchecked}. The possible
   * values for "security.OCSP.enabled" are:
   * 0: fetching is disabled
   * 1: fetch for all certificates
   * 2: fetch only for EV certificates
   * Hence, if "security.OCSP.enabled" is non-zero, the checkbox should be
   * checked. Otherwise, it should be unchecked.
   */
  readEnableOCSP() {
    var preference = document.getElementById("security.OCSP.enabled");
    // This is the case if the preference is the default value.
    if (preference.value === undefined) {
      return true;
    }
    return preference.value != 0;
  },

  /**
   * writeEnableOCSP is used by the preferences UI to map the checked/unchecked
   * state of the OCSP fetching checkbox to the value that the preference
   * "security.OCSP.enabled" should be set to (it returns that value). See the
   * readEnableOCSP documentation for more background. We unfortunately don't
   * have enough information to map from {true,false} to all possible values for
   * "security.OCSP.enabled", but a reasonable alternative is to map from
   * {true,false} to {<the default value>,0}. That is, if the box is checked,
   * "security.OCSP.enabled" will be set to whatever default it should be, given
   * the platform and channel. If the box is unchecked, the preference will be
   * set to 0. Obviously this won't work if the default is 0, so we will have to
   * revisit this if we ever set it to 0.
   */
  writeEnableOCSP() {
    var checkbox = document.getElementById("enableOCSP");
    var defaults = Services.prefs.getDefaultBranch(null);
    var defaultValue = defaults.getIntPref("security.OCSP.enabled");
    return checkbox.checked ? defaultValue : 0;
  },

  /**
   * Displays the user's certificates and associated options.
   */
  showCertificates() {
    gSubDialog.open("chrome://pippki/content/certManager.xul");
  },

  /**
   * Displays a dialog from which the user can manage his security devices.
   */
  showSecurityDevices() {
    gSubDialog.open("chrome://pippki/content/device_manager.xul");
  },

  /**
   * Clears the cache.
   */
  clearCache() {
    try {
      Services.cache2.clear();
    } catch (ex) { }
    this.updateActualCacheSize();
  },

  showSiteDataSettings() {
    gSubDialog.open("chrome://browser/content/preferences/siteDataSettings.xul");
  },

  toggleSiteData(shouldShow) {
    let clearButton = document.getElementById("clearSiteDataButton");
    let settingsButton = document.getElementById("siteDataSettings");
    clearButton.disabled = !shouldShow;
    settingsButton.disabled = !shouldShow;
  },

  updateTotalDataSizeLabel(usage) {
    let prefStrBundle = document.getElementById("bundlePreferences");
    let totalSiteDataSizeLabel = document.getElementById("totalSiteDataSize");
    if (usage < 0) {
      totalSiteDataSizeLabel.textContent = prefStrBundle.getString("loadingSiteDataSize");
    } else {
      let size = DownloadUtils.convertByteUnits(usage);
      totalSiteDataSizeLabel.textContent = prefStrBundle.getFormattedString("totalSiteDataSize", size);
    }
  },

  // Retrieves the amount of space currently used by disk cache
  updateActualCacheSize() {
    var actualSizeLabel = document.getElementById("actualDiskCacheSize");
    var prefStrBundle = document.getElementById("bundlePreferences");

    // Needs to root the observer since cache service keeps only a weak reference.
    this.observer = {
      onNetworkCacheDiskConsumption(consumption) {
        var size = DownloadUtils.convertByteUnits(consumption);
        // The XBL binding for the string bundle may have been destroyed if
        // the page was closed before this callback was executed.
        if (!prefStrBundle.getFormattedString) {
          return;
        }
        actualSizeLabel.textContent = prefStrBundle.getFormattedString("actualDiskCacheSize", size);
      },

      QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsICacheStorageConsumptionObserver,
        Components.interfaces.nsISupportsWeakReference
      ])
    };

    actualSizeLabel.textContent = prefStrBundle.getString("actualDiskCacheSizeCalculated");

    try {
      Services.cache2.asyncGetDiskConsumption(this.observer);
    } catch (e) { }
  },

  updateCacheSizeUI(smartSizeEnabled) {
    document.getElementById("useCacheBefore").disabled = smartSizeEnabled;
    document.getElementById("cacheSize").disabled = smartSizeEnabled;
    document.getElementById("useCacheAfter").disabled = smartSizeEnabled;
  },

  readSmartSizeEnabled() {
    // The smart_size.enabled preference element is inverted="true", so its
    // value is the opposite of the actual pref value
    var disabled = document.getElementById("browser.cache.disk.smart_size.enabled").value;
    this.updateCacheSizeUI(!disabled);
  },

  /**
   * Converts the cache size from units of KB to units of MB and stores it in
   * the textbox element.
   *
   * Preferences:
   *
   * browser.cache.disk.capacity
   * - the size of the browser cache in KB
   * - Only used if browser.cache.disk.smart_size.enabled is disabled
   */
  updateCacheSizeInputField() {
    let cacheSizeElem = document.getElementById("cacheSize");
    let cachePref = document.getElementById("browser.cache.disk.capacity");
    cacheSizeElem.value = cachePref.value / 1024;
    if (cachePref.locked)
      cacheSizeElem.disabled = true;
  },

  /**
   * Updates the cache size preference once user enters a new value.
   * We intentionally do not set preference="browser.cache.disk.capacity"
   * onto the textbox directly, as that would update the pref at each keypress
   * not only after the final value is entered.
   */
  updateCacheSizePref() {
    let cacheSizeElem = document.getElementById("cacheSize");
    let cachePref = document.getElementById("browser.cache.disk.capacity");
    // Converts the cache size as specified in UI (in MB) to KB.
    let intValue = parseInt(cacheSizeElem.value, 10);
    cachePref.value = isNaN(intValue) ? 0 : intValue * 1024;
  },

  clearSiteData() {
    let flags =
      Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0 +
      Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1 +
      Services.prompt.BUTTON_POS_0_DEFAULT;
    let prefStrBundle = document.getElementById("bundlePreferences");
    let title = prefStrBundle.getString("clearSiteDataPromptTitle");
    let text = prefStrBundle.getString("clearSiteDataPromptText");
    let btn0Label = prefStrBundle.getString("clearSiteDataNow");

    let result = Services.prompt.confirmEx(
      window, title, text, flags, btn0Label, null, null, null, {});
    if (result == 0) {
      SiteDataManager.removeAll();
    }
  },

  initDataCollection() {
#if 0
    this._setupLearnMoreLink("toolkit.datacollection.infoURL",
      "dataCollectionPrivacyNotice");
#endif
  },

  initSubmitCrashes() {
#if 0
    this._setupLearnMoreLink("toolkit.crashreporter.infoURL",
      "crashReporterLearnMore");
#endif
  },

  /**
   * Set up or hide the Learn More links for various data collection options
   */
  _setupLearnMoreLink(pref, element) {
    // set up the Learn More link with the correct URL
    let url = Services.prefs.getCharPref(pref);
    let el = document.getElementById(element);

    if (url) {
      el.setAttribute("href", url);
    } else {
      el.setAttribute("hidden", "true");
    }
  },

  /**
   * Initialize the health report service reference and checkbox.
   */
  initSubmitHealthReport() {
#if 0
    this._setupLearnMoreLink("datareporting.healthreport.infoURL", "FHRLearnMore");
#endif
    let checkbox = document.getElementById("submitHealthReportBox");

    // Telemetry is only sending data if MOZ_TELEMETRY_REPORTING is defined.
    // We still want to display the preferences panel if that's not the case, but
    // we want it to be disabled and unchecked.
    if (Services.prefs.prefIsLocked(PREF_UPLOAD_ENABLED) ||
      !AppConstants.MOZ_TELEMETRY_REPORTING) {
      checkbox.setAttribute("disabled", "true");
      return;
    }

    checkbox.checked = Services.prefs.getBoolPref(PREF_UPLOAD_ENABLED) &&
      AppConstants.MOZ_TELEMETRY_REPORTING;
  },

  /**
   * Update the health report preference with state from checkbox.
   */
  updateSubmitHealthReport() {
    let checkbox = document.getElementById("submitHealthReportBox");
    Services.prefs.setBoolPref(PREF_UPLOAD_ENABLED, checkbox.checked);
  },

  observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "sitedatamanager:updating-sites":
        // While updating, we want to disable this section and display loading message until updated
        this.toggleSiteData(false);
        this.updateTotalDataSizeLabel(-1);
        break;

      case "sitedatamanager:sites-updated":
        this.toggleSiteData(true);
        SiteDataManager.getTotalUsage()
          .then(this.updateTotalDataSizeLabel.bind(this));
        break;
    }
  },

  // Accessibility checkbox helpers
  _initA11yState() {
    this._initA11yString();
    let checkbox = document.getElementById("a11yPrivacyCheckbox");
    switch (Services.prefs.getIntPref("accessibility.force_disabled")) {
      case 1: // access blocked
        checkbox.checked = true;
        break;
      case -1: // a11y is forced on for testing
      case 0: // access allowed
        checkbox.checked = false;
        break;
    }
  },

  _initA11yString() {
    let a11yLearnMoreLink =
      Services.urlFormatter.formatURLPref("accessibility.support.url");
    document.getElementById("a11yLearnMoreLink")
      .setAttribute("href", a11yLearnMoreLink);
  },

  updateA11yPrefs(checked) {
    let buttonIndex = confirmRestartPrompt(checked, 0, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      Services.prefs.setIntPref("accessibility.force_disabled", checked ? 1 : 0);
      Services.telemetry.scalarSet("preferences.prevent_accessibility_services", true);
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    }

    // Revert the checkbox in case we didn't quit
    document.getElementById("a11yPrivacyCheckbox").checked = !checked;
  }
};

var gPasswordManagers = {
  init: function() {
    this._listBox = document.getElementById("password-managers-list");

    Promise.all([this.getAvailable(), this.getExisting()]).then((function(results) {
      var available = results[0],
          existing  = results[1],
          existingIDs = [];

      //clean the view
      while (this._listBox.firstChild && this._listBox.firstChild.localName == "richlistitem")
        this._listBox.removeChild(this._listBox.firstChild);

      // add already installed password managers
      for (let addonObj of existing) {
        let addonDescriptor = available.filter(function(addon){ return addon.id == addonObj.id })[0];
        let _installed_addon = new ItemHandler(this._listBox, addonDescriptor, addonObj, 'installed');
        this._listBox.appendChild(_installed_addon.listItem);
        existingIDs.push(addonObj.id);
      }

      //remove the ones already installed
      var available = available.filter(function(addon) { return existingIDs.indexOf(addon.id) == -1 });
      for (let addonObjDesc of available) {
        let _available_addon = new ItemHandler(this._listBox, addonObjDesc, undefined, 'new');
        this._listBox.appendChild(_available_addon.listItem);
      }

    }).bind(this));
  },

  getExisting: function() {
    let KNOWN_PW_MANAGERS = ["support@lastpass.com"];

    return new Promise(function(resolve, reject) {
      AddonManager.getAllAddons(function(all) {
        // filter only installed extensions
        var extensions = all.filter(function(addon) {
          return addon.type == "extension" && addon.hidden == false && KNOWN_PW_MANAGERS.indexOf(addon.id) != -1;
        });

        resolve(extensions);
      });
    });
  },
  // can be a promise if we decide to move the list to backend
  getAvailable: function(){
    return [{
      "id": "support@lastpass.com",
      "icons": {
       "64": "https://addons.cdn.mozilla.net/user-media/addon_icons/8/8542-64.png?modified=1457436015"
      },
      "name": "LastPass",
      "homepageURL": "https://lastpass.com/",
      "sourceURI": "https://s3.amazonaws.com/cdncliqz/update/browser_pre/support%40lastpass.com/support%40lastpass.com-4.2.1.21-browser-signed.xpi",
      "afterInstall" : function() {
        const timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
        const doc = Services.wm.getMostRecentWindow("navigator:browser").document;
        const nIframe = doc.getElementsByTagName('iframe').length;
        var nTry = 10;

        timer.initWithCallback(openPopup, 1500, Ci.nsITimer.TYPE_ONE_SHOT);

        function openPopup() {
          var lpBtn = doc.getElementById("toggle-button--supportlastpasscom-lastpass-button");
          if(lpBtn) {
            lpBtn.click();
            if(doc.getElementsByTagName('iframe').length > nIframe) {
              return;
            }
          }
          nTry--;
          if (nTry > 0) {
            timer.initWithCallback(openPopup, 500, Ci.nsITimer.TYPE_ONE_SHOT);
          }
        }
      }
    }];
  }
}

var gPrivacyManagers = {
  init: function() {
    this._listBox = document.getElementById("privacy-managers-list");

    Promise.all([this.getAvailable(), this.getExisting()]).then((function(results) {
      var available = results[0],
          existing  = results[1],
          existingIDs = [];

      //clean the view
      while (this._listBox.firstChild && this._listBox.firstChild.localName == "richlistitem")
        this._listBox.removeChild(this._listBox.firstChild);

      // add already installed privacy managers
      for (let addonObj of existing) {
        let addonDescriptor = available.filter(function(addon){ return addon.id == addonObj.id })[0];
        let _installed_addon = new ItemHandler(this._listBox, addonDescriptor, addonObj, 'installed');
        this._listBox.appendChild(_installed_addon.listItem);
        existingIDs.push(addonObj.id);
      }

      //remove the ones already installed
      var available = available.filter(function(addon){ return existingIDs.indexOf(addon.id) == -1 });
      for (let addonObjDesc of available) {
        let _available_addon = new ItemHandler(this._listBox, addonObjDesc, undefined, 'new');
        this._listBox.appendChild(_available_addon.listItem);
      }

    }).bind(this));
  },

  getExisting: function() {
    let KNOWN_PW_MANAGERS = ["firefox@ghostery.com"];

    return new Promise(function(resolve, reject) {
      AddonManager.getAllAddons(function(all) {
        // filter only installed extensions
        var extensions = all.filter(function(addon) {
          return addon.type == "extension" && addon.hidden == false && KNOWN_PW_MANAGERS.indexOf(addon.id) != -1;
        });

        resolve(extensions);
      });
    });
  },
  // can be a promise if we decide to move the list to backend
  getAvailable: function() {
    return [{
      "id": "firefox@ghostery.com",
      "icons": {
       "64": "https://addons.cdn.mozilla.net/user-media/addon_icons/9/9609-64.png?modified=1480432819"
      },
      "name": "Ghostery",
      "homepageURL": "https://www.ghostery.com",
      "sourceURI": "https://s3.amazonaws.com/cdncliqz/update/browser/firefox@ghostery.com/latest.xpi"
    }];
  },
}

function ItemHandler(container, addonDescriptor, addonObj, status) {
  this._container = container;
  this._desc = addonDescriptor;
  this._addon = addonObj;
  if (status == 'new') {
    this._listItem = this.createItem(addonDescriptor, status);
  } else { // installed
    this._listItem = this.createItem(addonObj, status);
  }
  this._listItem.addEventListener("installClicked", this.onInstallClick.bind(this));
  this._listItem.addEventListener("unInstallClicked", this.onUninstallClick.bind(this));
}

ItemHandler.prototype = {
  get listContainer() { return this._container; },
  get listItemDesc() { return this._desc; },
  get listItemAddon() { return this._addon; },
  get listItem() { return this._listItem; },


  createItem: function(aObj, status) {
    let item = document.createElement("richlistitem");

    item.setAttribute("class", "cliqz-feature");
    item.setAttribute("name", aObj.name);
    item.setAttribute("description", aObj.description);
    item.setAttribute("type", aObj.type);
    item.setAttribute("value", aObj.id);
    item.setAttribute("status", status);

    item.mAddon = aObj;
    return item;
  },

  onInstallClick: function() {
    let self = this;
    let reloadTimeout = 3000;

    AddonManager.getInstallForURL(this.listItemDesc.sourceURI,
      function(addon) {
        addon.addListener({
          onDownloadProgress: function(aInstall) {
            let percent = gStrings.GetStringFromName("installDownloading") + ' ' + parseInt(aInstall.progress / aInstall.maxProgress * 100) + "%";
            self.listItem.updateInstallationProgress(percent);
          },
          onDownloadFailed: function() {
            let showText = gStrings.GetStringFromName("installDownloadFailed");
            self.listItem.updateDownloadFailed(showText);
            self.onFaliure(self, reloadTimeout);
          },
          onInstallFailed: function() {
            let showText = gStrings.GetStringFromName("installFailed");
            self.listItem.updateInstallFailed(showText);
            self.onFaliure(self, reloadTimeout);
          },
          onInstallEnded: function(aInstall, aAddon) {
            // redrawing the listItem as *installed*
            AddonManager.getAddonByID(self.listItemDesc.id, (newlyInstalled) => {
              self.listContainer.removeChild(self.listItem);
              let installedItem = new ItemHandler(self.listContainer, self.listItemDesc, newlyInstalled, 'installed');
              self.listContainer.appendChild(installedItem.listItem);
              if (typeof(self.listItemDesc.afterInstall) == 'function') {
                self.listItemDesc.afterInstall();
              }
            });
          }
        });
        addon.install();
      },
      "application/x-xpinstall"
    )
  },

  onUninstallClick: function() {
    this.listItem.mAddon.uninstall();
    // redrawing the listItem as *new* item
    this.listContainer.removeChild(this.listItem);
    let newItem = new ItemHandler(this.listContainer, this.listItemDesc, undefined, 'new');
    this.listContainer.appendChild(newItem.listItem);
  },

  // reload the item in "new" state after reloadTimeout seconds
  onFaliure: function(failedItem, reloadTimeout) {
    setTimeout(function() {
      failedItem.listContainer.removeChild(failedItem.listItem);
      let renewItem = new ItemHandler(failedItem.listContainer, failedItem.listItemDesc, undefined, 'new');
      failedItem.listContainer.appendChild(renewItem.listItem);
    }, reloadTimeout);
  }
}
