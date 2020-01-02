'use strict';

var EXPORTED_SYMBOLS = ["CliqzResources"];

const DependencyManager = ChromeUtils.import(
  "resource://gre/modules/DependencyManager.jsm", {}).DependencyManager;

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
const DEFAULT_EXTENSION_ID = "cliqz@cliqz.com"

const getWebExtId = function(extensionId = DEFAULT_EXTENSION_ID) {
  const getExtensionUUID = DependencyManager.get("getExtensionUUID", "resource://gre/modules/Extension.jsm");
  return getExtensionUUID(extensionId);
};

const getWebExtPrefix = function(extensionId = DEFAULT_EXTENSION_ID) {
  return `moz-extension://${getWebExtId(extensionId)}`;
};

const CliqzResources = {
  matchUrlByString: function(key) {
    switch (key) {
      case 'about:cliqz':
      case 'about:home':
      case 'about:newtab':
      case 'resource://cliqz/freshtab/home.html':
      case 'about:welcome':
        return this.getFreshTabUrl();

      case 'chrome://cliqz/content/onboarding-v3/index.html':
        return this.getWelcomeUrl();

      default:
        return key;
    }
  },
  // CLIQZ-SPECIAL: we do not need BROWSER_NEW_TAB_URL check as we never change it
  // return gInitialPages.includes(url) || url == BROWSER_NEW_TAB_URL;
  isInitialPage: function(url) {
    const Services = DependencyManager.get("Services",
      "resource://gre/modules/Services.jsm");

    if (!(url instanceof Ci.nsIURI)) {
      try {
        url = Services.io.newURI(url);
      } catch (ex) {
        return false;
      }
    }

    let nonQuery = url.prePath + url.filePath;
    return this.isCliqzPage(nonQuery) || INITIAL_PAGES.includes(nonQuery);
  },
  isCliqzPage: function(uri) {
    return typeof uri == 'string' && uri.indexOf(getWebExtPrefix()) === 0;
  },
  whatIstheURL: (u) => `${getWebExtPrefix()}/modules/${u}`,
  getExtensionURL: (path, extensionId = DEFAULT_EXTENSION_ID) => `${getWebExtPrefix(extensionId)}${path}`,
  getFreshTabUrl: () => `${getWebExtPrefix()}/modules/freshtab/home.html`,
  getWelcomeUrl: () => `${getWebExtPrefix()}/modules/onboarding-v3/index.html`,
  getUrlWithProperExtentionId: function(url = '') {
    if (!url || typeof url != 'string') {
      return url;
    }

    if (url.indexOf('moz-extension://') !== 0) {
      return url;
    }

    let outerParts = url.split('moz-extension://');
    let innerParts = outerParts[1].split('/');
    innerParts[0] = getWebExtId();

    outerParts[1] = innerParts.join('/');
    return outerParts.join('moz-extension://');
  },
};
