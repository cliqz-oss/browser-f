'use strict';

var EXPORTED_SYMBOLS = ["CliqzResources"];

const {UUIDMap} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});
const {AddonManager} = ChromeUtils.import("resource://gre/modules/AddonManager.jsm", {});

const EXTENSION_ID = UUIDMap.get('cliqz@cliqz.com');
const webextPrefix = `moz-extension://${EXTENSION_ID}/modules/`;
const FRESHTAB_URL = `${webextPrefix}freshtab/home.html`;
const WELCOME_URL = `${webextPrefix}onboarding-v3/index.html`;

// CLIQZ-SPECIAL:
// This variable is a pretty magical thing.
// Not only it is used as a REAL global Array (is used in SessionStore.jsm, tabbrowser.js, etc.)
// but also it provides a feature for any url stored in it not to be displayed in a URL bar
// after it has been loaded.
// Other words if a user goes to about:newtab and that page exists and is loaded then
// literally the url will not be visible in a URL bar itself (it will not contain anything).
const INITIAL_PAGES = [
  "about:blank",
  "about:newtab",
  "about:home",
  "about:privatebrowsing",
  "about:welcomeback",
  "about:sessionrestore",
  "about:cliqz",
  "about:welcome",
];

const CliqzResources = {
  matchUrlByString: function(key) {
    switch (key) {
      case 'about:cliqz':
      case 'about:home':
      case 'about:newtab':
      case 'resource://cliqz/freshtab/home.html':
        return FRESHTAB_URL;

      case 'about:welcome':
      case 'chrome://cliqz/content/onboarding-v3/index.html':
        return WELCOME_URL;

      default:
        return key;
    }
  },
  addonIsReadyAsync: function(addonId = 'cliqz@cliqz.com') {
    return new Promise((resolve, reject) => {
      AddonManager.isReadyAsync().then(() => {
        AddonManager.getAddonByID(addonId).then(resolve, reject);
      }, reject);
    });
  },
  // CLIQZ-SPECIAL: we do not need BROWSER_NEW_TAB_URL check as we never change it
  // return gInitialPages.includes(url) || url == BROWSER_NEW_TAB_URL;
  isInitialPage: function(uri) {
    return this.isCliqzPage(uri) || INITIAL_PAGES.includes(uri);
  },
  isCliqzPage: function(uri) {
    return uri === this.freshTab || uri === this.onboarding;
  },
  whatIstheURL: u => `${webextPrefix}${u}`,
  freshTab: FRESHTAB_URL,
  onboarding: WELCOME_URL
};
