/* - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this file,
   - You can obtain one at http://mozilla.org/MPL/2.0/. */

// Import globals from the files imported by the .xul files.
/* import-globals-from subdialogs.js */
/* import-globals-from main.js */
/* import-globals-from search.js */
/* import-globals-from containers.js */
/* import-globals-from privacy.js */
/* import-globals-from sync.js */
/* import-globals-from findInPage.js */
/* import-globals-from ../../../base/content/utilityOverlay.js */

"use strict";

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionSettingsStore",
                                  "resource://gre/modules/ExtensionSettingsStore.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AddonManager",
                                  "resource://gre/modules/AddonManager.jsm");

var gLastHash = "";

var gCategoryInits = new Map();
function init_category_if_required(category) {
  let categoryInfo = gCategoryInits.get(category);
  if (!categoryInfo) {
    throw "Unknown in-content prefs category! Can't init " + category;
  }
  if (categoryInfo.inited) {
    return;
  }
  categoryInfo.init();
}

function register_module(categoryName, categoryObject) {
  gCategoryInits.set(categoryName, {
    inited: false,
    init() {
      categoryObject.init();
      this.inited = true;
    }
  });
}

document.addEventListener("DOMContentLoaded", init_all, {once: true});

function init_all() {
  document.documentElement.instantApply = true;

  gSubDialog.init();
  register_module("paneGeneral", gMainPane);
  register_module("paneSearch", gSearchPane);
  register_module("panePrivacy", gPrivacyPane);
  register_module("paneContainers", gContainersPane);
#if MOZ_SERVICES_SYNC
  register_module("paneSync", gSyncPane);
#endif
  register_module("paneConnect", gConnectPane);
  // Cliqz. DB-1230: Display the rich list item when connect module is available
  try {
    fetch('chrome://cliqz/content/pairing/index.html').then( function(res) {
      if(res.status === 200) {
        document.getElementById('category-connect').hidden = false;
      }
    });
  } catch (e) {
    Cu.reportError(e);
  }
  register_module("paneSearchResults", gSearchResultsPane);
  gSearchResultsPane.init();
  gMainPane.preInit();

  let categories = document.getElementById("categories");
  categories.addEventListener("select", event => gotoPref(event.target.value));

  document.documentElement.addEventListener("keydown", function(event) {
    if (event.keyCode == KeyEvent.DOM_VK_TAB) {
      categories.setAttribute("keyboard-navigation", "true");
    }
  });
  categories.addEventListener("mousedown", function() {
    this.removeAttribute("keyboard-navigation");
  });

  window.addEventListener("hashchange", onHashChange);
  gotoPref();

  let helpButton = document.querySelector(".help-button > .text-link");
  let helpUrl = Services.urlFormatter.formatURLPref("app.support.baseURL") + "preferences";
  helpButton.setAttribute("href", helpUrl);

  document.dispatchEvent(new CustomEvent("Initialized", {
    "bubbles": true,
    "cancelable": true
  }));
}

function telemetryBucketForCategory(category) {
  category = category.toLowerCase();
  switch (category) {
    case "containers":
    case "general":
    case "privacy":
    case "search":
    case "sync":
    case "connect":
    case "searchresults":
      return category;
    default:
      return "unknown";
  }
}

function onHashChange() {
  gotoPref();
}

function gotoPref(aCategory) {
  let categories = document.getElementById("categories");
  const kDefaultCategoryInternalName = "paneGeneral";
  const kDefaultCategory = "general";
  let hash = document.location.hash;

  let category = aCategory || hash.substr(1) || kDefaultCategoryInternalName;
  let breakIndex = category.indexOf("-");
  // Subcategories allow for selecting smaller sections of the preferences
  // until proper search support is enabled (bug 1353954).
  let subcategory = breakIndex != -1 && category.substring(breakIndex + 1);
  if (subcategory) {
    category = category.substring(0, breakIndex);
  }
  category = friendlyPrefCategoryNameToInternalName(category);
  if (category != "paneSearchResults") {
    gSearchResultsPane.query = null;
    gSearchResultsPane.searchInput.value = "";
    gSearchResultsPane.getFindSelection(window).removeAllRanges();
    gSearchResultsPane.removeAllSearchTooltips();
    gSearchResultsPane.removeAllSearchMenuitemIndicators();
  } else if (!gSearchResultsPane.searchInput.value) {
    // Something tried to send us to the search results pane without
    // a query string. Default to the General pane instead.
    category = kDefaultCategoryInternalName;
    document.location.hash = kDefaultCategory;
    gSearchResultsPane.query = null;
  }

  // Updating the hash (below) or changing the selected category
  // will re-enter gotoPref.
  if (gLastHash == category && !subcategory)
    return;

  let item;
  if (category != "paneSearchResults") {
    item = categories.querySelector(".category[value=" + category + "]");
    if (!item) {
      category = kDefaultCategoryInternalName;
      item = categories.querySelector(".category[value=" + category + "]");
    }
  }

  try {
    init_category_if_required(category);
  } catch (ex) {
    Cu.reportError("Error initializing preference category " + category + ": " + ex);
    throw ex;
  }

  let friendlyName = internalPrefCategoryNameToFriendlyName(category);
  if (gLastHash || category != kDefaultCategoryInternalName || subcategory) {
    document.location.hash = friendlyName;
  }
  // Need to set the gLastHash before setting categories.selectedItem since
  // the categories 'select' event will re-enter the gotoPref codepath.
  gLastHash = category;
  if (item) {
    categories.selectedItem = item;
  } else {
    categories.clearSelection();
  }
  window.history.replaceState(category, document.title);
  search(category, "data-category", subcategory, "data-subcategory");

  let mainContent = document.querySelector(".main-content");
  mainContent.scrollTop = 0;

  Services.telemetry
          .getHistogramById("FX_PREFERENCES_CATEGORY_OPENED_V2")
          .add(telemetryBucketForCategory(friendlyName));
}

function search(aQuery, aAttribute, aSubquery, aSubAttribute) {
  let mainPrefPane = document.getElementById("mainPrefPane");
  let elements = mainPrefPane.children;
  for (let element of elements) {
    // If the "data-hidden-from-search" is "true", the
    // element will not get considered during search. This
    // should only be used when an element is still under
    // development and should not be shown for any reason.
    if (element.getAttribute("data-hidden-from-search") != "true" ||
        element.getAttribute("data-subpanel") == "true") {
      let attributeValue = element.getAttribute(aAttribute);
      if (attributeValue == aQuery) {
        if (!element.classList.contains("header") &&
            element.localName !== "preferences" &&
            aSubquery && aSubAttribute) {
          let subAttributeValue = element.getAttribute(aSubAttribute);
          element.hidden = subAttributeValue != aSubquery;
        } else {
          element.hidden = false;
        }
      } else {
        element.hidden = true;
      }
    }
    element.classList.remove("visually-hidden");
  }

  let keysets = mainPrefPane.getElementsByTagName("keyset");
  for (let element of keysets) {
    let attributeValue = element.getAttribute(aAttribute);
    if (attributeValue == aQuery)
      element.removeAttribute("disabled");
    else
      element.setAttribute("disabled", true);
  }
}

function helpButtonCommand() {
  let pane = history.state;
  let categories = document.getElementById("categories");
  let helpTopic = categories.querySelector(".category[value=" + pane + "]")
                            .getAttribute("helpTopic");
  openHelpLink(helpTopic);
}

function friendlyPrefCategoryNameToInternalName(aName) {
  if (aName.startsWith("pane"))
    return aName;
  return "pane" + aName.substring(0, 1).toUpperCase() + aName.substr(1);
}

// This function is duplicated inside of utilityOverlay.js's openPreferences.
function internalPrefCategoryNameToFriendlyName(aName) {
  return (aName || "").replace(/^pane./, function(toReplace) { return toReplace[4].toLowerCase(); });
}

// Put up a confirm dialog with "ok to restart", "revert without restarting"
// and "restart later" buttons and returns the index of the button chosen.
// We can choose not to display the "restart later", or "revert" buttons,
// altough the later still lets us revert by using the escape key.
//
// The constants are useful to interpret the return value of the function.
const CONFIRM_RESTART_PROMPT_RESTART_NOW = 0;
const CONFIRM_RESTART_PROMPT_CANCEL = 1;
const CONFIRM_RESTART_PROMPT_RESTART_LATER = 2;
function confirmRestartPrompt(aRestartToEnable, aDefaultButtonIndex,
                              aWantRevertAsCancelButton,
                              aWantRestartLaterButton) {
  let brandName = document.getElementById("bundleBrand").getString("brandShortName");
  let bundle = document.getElementById("bundlePreferences");
  let msg = bundle.getFormattedString(aRestartToEnable ?
                                      "featureEnableRequiresRestart" :
                                      "featureDisableRequiresRestart",
                                      [brandName]);
  let title = bundle.getFormattedString("shouldRestartTitle", [brandName]);

  // Set up the first (index 0) button:
  let button0Text = bundle.getFormattedString("okToRestartButton", [brandName]);
  let buttonFlags = (Services.prompt.BUTTON_POS_0 *
                     Services.prompt.BUTTON_TITLE_IS_STRING);


  // Set up the second (index 1) button:
  let button1Text = null;
  if (aWantRevertAsCancelButton) {
    button1Text = bundle.getString("revertNoRestartButton");
    buttonFlags += (Services.prompt.BUTTON_POS_1 *
                    Services.prompt.BUTTON_TITLE_IS_STRING);
  } else {
    buttonFlags += (Services.prompt.BUTTON_POS_1 *
                    Services.prompt.BUTTON_TITLE_CANCEL);
  }

  // Set up the third (index 2) button:
  let button2Text = null;
  if (aWantRestartLaterButton) {
    button2Text = bundle.getString("restartLater");
    buttonFlags += (Services.prompt.BUTTON_POS_2 *
                    Services.prompt.BUTTON_TITLE_IS_STRING);
  }

  switch (aDefaultButtonIndex) {
    case 0:
      buttonFlags += Services.prompt.BUTTON_POS_0_DEFAULT;
      break;
    case 1:
      buttonFlags += Services.prompt.BUTTON_POS_1_DEFAULT;
      break;
    case 2:
      buttonFlags += Services.prompt.BUTTON_POS_2_DEFAULT;
      break;
    default:
      break;
  }

  let buttonIndex = Services.prompt.confirmEx(window, title, msg, buttonFlags,
                                              button0Text, button1Text, button2Text,
                                              null, {});

  // If we have the second confirmation dialog for restart, see if the user
  // cancels out at that point.
  if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
    let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                       .createInstance(Ci.nsISupportsPRBool);
    Services.obs.notifyObservers(cancelQuit, "quit-application-requested",
                                  "restart");
    if (cancelQuit.data) {
      buttonIndex = CONFIRM_RESTART_PROMPT_CANCEL;
    }
  }
  return buttonIndex;
}

// This function is used to append search keywords found
// in the related subdialog to the button that will activate the subdialog.
function appendSearchKeywords(aId, keywords) {
  let element = document.getElementById(aId);
  let searchKeywords = element.getAttribute("searchkeywords");
  if (searchKeywords) {
    keywords.push(searchKeywords);
  }
  element.setAttribute("searchkeywords", keywords.join(" "));
}

let extensionControlledContentIds = {
  "privacy.containers": "browserContainersExtensionContent",
  "homepage_override": "browserHomePageExtensionContent",
  "newTabURL": "browserNewTabExtensionContent",
  "defaultSearch": "browserDefaultSearchExtensionContent",
};

/**
  * Check if a pref is being managed by an extension.
  */
async function getControllingExtensionInfo(type, settingName) {
  await ExtensionSettingsStore.initialize();
  return ExtensionSettingsStore.getSetting(type, settingName);
}

function getControllingExtensionEl(settingName) {
  return document.getElementById(extensionControlledContentIds[settingName]);
}

async function handleControllingExtension(type, settingName) {
  let info = await getControllingExtensionInfo(type, settingName);
  let addon = info && info.id
    && await AddonManager.getAddonByID(info.id);

  // Sometimes the ExtensionSettingsStore gets in a bad state where it thinks
  // an extension is controlling a setting but the extension has been uninstalled
  // outside of the regular lifecycle. If the extension isn't currently installed
  // then we should treat the setting as not being controlled.
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=1411046 for an example.
  if (addon) {
    showControllingExtension(settingName, addon);
  } else {
    hideControllingExtension(settingName);
  }

  return !!addon;
}

async function showControllingExtension(settingName, addon) {
  // Tell the user what extension is controlling the setting.
  let extensionControlledContent = getControllingExtensionEl(settingName);
  extensionControlledContent.classList.remove("extension-controlled-disabled");
  const defaultIcon = "chrome://mozapps/skin/extensions/extensionGeneric.svg";
  let stringParts = document
    .getElementById("bundlePreferences")
    .getString(`extensionControlled.${settingName}`)
    .split("%S");
  let description = extensionControlledContent.querySelector("description");

  // Remove the old content from the description.
  while (description.firstChild) {
    description.firstChild.remove();
  }

  // Populate the description.
  description.appendChild(document.createTextNode(stringParts[0]));
  let image = document.createElement("image");
  image.setAttribute("src", addon.iconURL || defaultIcon);
  image.classList.add("extension-controlled-icon");
  description.appendChild(image);
  description.appendChild(document.createTextNode(` ${addon.name}`));
  description.appendChild(document.createTextNode(stringParts[1]));

  let disableButton = extensionControlledContent.querySelector("button");
  if (disableButton) {
    disableButton.hidden = false;
  }

  // Show the controlling extension row and hide the old label.
  extensionControlledContent.hidden = false;
}

function hideControllingExtension(settingName) {
  getControllingExtensionEl(settingName).hidden = true;
}


function makeDisableControllingExtension(type, settingName) {
  return async function disableExtension() {
    let {id} = await getControllingExtensionInfo(type, settingName);
    let addon = await AddonManager.getAddonByID(id);
    addon.userDisabled = true;
  };
}
