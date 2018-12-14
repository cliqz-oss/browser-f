'use strict';

var EXPORTED_SYMBOLS = ["CliqzResources"];

const {UUIDMap} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});
const EXTENSION_ID = UUIDMap.get('cliqz@cliqz.com');
const FRESHTAB_URL =
  'moz-extension://' + EXTENSION_ID + '/modules/freshtab/home.html';
const WELCOME_URL =
  'moz-extension://' + EXTENSION_ID + '/modules/onboarding-v3/index.html';

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
  isWebExtensionAPI: function() {
    // A user has cliqz-extension's version >= 1.33
    return typeof CLIQZ == 'undefined';
  },
};
