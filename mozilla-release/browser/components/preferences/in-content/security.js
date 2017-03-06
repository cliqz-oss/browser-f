/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

XPCOMUtils.defineLazyModuleGetter(this, "LoginHelper",
 "resource://gre/modules/LoginHelper.jsm");

Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
var gStrings = Services.strings.createBundle("chrome://mozapps/locale/extensions/extensions.properties");

var gSecurityPane = {
  _pane: null,

  /**
   * Initializes security related UI content (master password, safe browsing, ghostery, etc.)
   */
  init: function ()
  {
    function setEventListener(aId, aEventType, aCallback)
    {
      document.getElementById(aId)
              .addEventListener(aEventType, aCallback.bind(gSecurityPane));
    }

    this._pane = document.getElementById("paneSecurity");
    this._initMasterPasswordUI();
    this._initSafeBrowsing();
    this._initGhosteryUI();

    AddonManager.getAddonByID("https-everywhere@cliqz.com", function(addon){
      if(addon && addon.isActive){
        var HTTPS_EVERYWHERE_PREF = "extensions.https_everywhere.globalEnabled";

        document.getElementById("httpsEverywhereGroup").hidden = false;
        document.getElementById("httpsEverywhereEnable").checked = Services.prefs.getBoolPref(HTTPS_EVERYWHERE_PREF);
      }
    })

#if 0
    setEventListener("addonExceptions", "command",
      gSecurityPane.showAddonExceptions);
#endif
    setEventListener("passwordExceptions", "command",
      gSecurityPane.showPasswordExceptions);
    setEventListener("useMasterPassword", "command",
      gSecurityPane.updateMasterPasswordButton);
    setEventListener("changeMasterPassword", "command",
      gSecurityPane.changeMasterPassword);
    setEventListener("showPasswords", "command",
      gSecurityPane.showPasswords);
  },

  toggleHttpsEverywhere: function(){
    var HTTPSEverywhere = Components.classes["@eff.org/https-everywhere;1"]
                      .getService(Components.interfaces.nsISupports)
                      .wrappedJSObject;
    HTTPSEverywhere.toggleEnabledState();
  },

  // ADD-ONS

#if 0
  /*
   * Preferences:
   *
   * xpinstall.whitelist.required
   * - true if a site must be added to a site whitelist before extensions
   *   provided by the site may be installed from it, false if the extension
   *   may be directly installed after a confirmation dialog
   */

  /**
   * Enables/disables the add-ons Exceptions button depending on whether
   * or not add-on installation warnings are displayed.
   */
  readWarnAddonInstall: function ()
  {
    var warn = document.getElementById("xpinstall.whitelist.required");
    var exceptions = document.getElementById("addonExceptions");

    exceptions.disabled = !warn.value;

    // don't override the preference value
    return undefined;
  },

  /**
   * Displays the exceptions lists for add-on installation warnings.
   */
  showAddonExceptions: function ()
  {
    var bundlePrefs = document.getElementById("bundlePreferences");

    var params = this._addonParams;
    if (!params.windowTitle || !params.introText) {
      params.windowTitle = bundlePrefs.getString("addons_permissions_title");
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

  // PASSWORDS

  /*
   * Preferences:
   *
   * signon.rememberSignons
   * - true if passwords are remembered, false otherwise
   */

  /**
   * Enables/disables the Exceptions button used to configure sites where
   * passwords are never saved. When browser is set to start in Private
   * Browsing mode, the "Remember passwords" UI is useless, so we disable it.
   */
  readSavePasswords: function ()
  {
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
   * Displays a dialog in which the user can view and modify the list of sites
   * where passwords are never saved.
   */
  showPasswordExceptions: function ()
  {
    var bundlePrefs = document.getElementById("bundlePreferences");
    var params = {
      blockVisible: true,
      sessionVisible: false,
      allowVisible: false,
      hideStatusColumn: true,
      prefilledHost: "",
      permissionType: "login-saving",
      windowTitle: bundlePrefs.getString("savedLoginsExceptions_title"),
      introText: bundlePrefs.getString("savedLoginsExceptions_desc")
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
  _initMasterPasswordUI: function ()
  {
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
  _initGhosteryUI: function ()
  {
    gPrivacyManagers.init();
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

    enableSafeBrowsing.addEventListener("command", function() {
      safeBrowsingPhishingPref.value = enableSafeBrowsing.checked;
      safeBrowsingMalwarePref.value = enableSafeBrowsing.checked;

      if (enableSafeBrowsing.checked) {
        blockDownloads.removeAttribute("disabled");
        if (blockDownloads.checked) {
          blockUncommonUnwanted.removeAttribute("disabled");
        }
      } else {
        blockDownloads.setAttribute("disabled", "true");
        blockUncommonUnwanted.setAttribute("disabled", "true");
      }
    });

    blockDownloads.addEventListener("command", function() {
      blockDownloadsPref.value = blockDownloads.checked;
      if (blockDownloads.checked) {
        blockUncommonUnwanted.removeAttribute("disabled");
      } else {
        blockUncommonUnwanted.setAttribute("disabled", "true");
      }
    });

    blockUncommonUnwanted.addEventListener("command", function() {
      blockUnwantedPref.value = blockUncommonUnwanted.checked;
      blockUncommonPref.value = blockUncommonUnwanted.checked;

      let malware = malwareTable.value
        .split(",")
        .filter(x => x !== "goog-unwanted-shavar" && x !== "test-unwanted-simple");

      if (blockUncommonUnwanted.checked) {
        malware.push("goog-unwanted-shavar");
        malware.push("test-unwanted-simple");
      }

      // sort alphabetically to keep the pref consistent
      malware.sort();

      malwareTable.value = malware.join(",");
    });

    // set initial values

    enableSafeBrowsing.checked = safeBrowsingPhishingPref.value && safeBrowsingMalwarePref.value;
    if (!enableSafeBrowsing.checked) {
      blockDownloads.setAttribute("disabled", "true");
      blockUncommonUnwanted.setAttribute("disabled", "true");
    }

    blockDownloads.checked = blockDownloadsPref.value;
    if (!blockDownloadsPref.value) {
      blockUncommonUnwanted.setAttribute("disabled", "true");
    }

    blockUncommonUnwanted.checked = blockUnwantedPref.value && blockUncommonPref.value;
  },

  /**
   * Enables/disables the master password button depending on the state of the
   * "use master password" checkbox, and prompts for master password removal if
   * one is set.
   */
  updateMasterPasswordButton: function ()
  {
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
  _removeMasterPassword: function ()
  {
    var secmodDB = Cc["@mozilla.org/security/pkcs11moduledb;1"].
                   getService(Ci.nsIPKCS11ModuleDB);
    if (secmodDB.isFIPSEnabled) {
      var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                          getService(Ci.nsIPromptService);
      var bundle = document.getElementById("bundlePreferences");
      promptService.alert(window,
                          bundle.getString("pw_change_failed_title"),
                          bundle.getString("pw_change2empty_in_fips_mode"));
      this._initMasterPasswordUI();
    }
    else {
      gSubDialog.open("chrome://mozapps/content/preferences/removemp.xul",
                      null, null, this._initMasterPasswordUI.bind(this));
    }
  },

  /**
   * Displays a dialog in which the master password may be changed.
   */
  changeMasterPassword: function ()
  {
    gSubDialog.open("chrome://mozapps/content/preferences/changemp.xul",
                    "resizable=no", null, this._initMasterPasswordUI.bind(this));
  },

  /**
   * Shows the sites where the user has saved passwords and the associated login
   * information.
   */
  showPasswords: function ()
  {
    gSubDialog.open("chrome://passwordmgr/content/passwordManager.xul");
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
      "sourceURI": "https://s3.amazonaws.com/cdncliqz/update/browser/support@lastpass.com/latest.xpi",
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