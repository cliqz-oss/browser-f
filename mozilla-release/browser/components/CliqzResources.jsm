'use strict';

var EXPORTED_SYMBOLS = ["CliqzResources"];

const {UUIDMap} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});
const EXTENSION_ID = UUIDMap.get('cliqz@cliqz.com');
const FRESHTAB_URL =
  'moz-extension://' + EXTENSION_ID + '/modules/freshtab/home.html';
const WELCOME_URL =
  'moz-extension://' + EXTENSION_ID + '/modules/onboarding-v3/index.html';

// CLIQZ-TODO: we need to remove this EXTENSION_VERSION from this module after
// we have made sure that no users with cliqz@cliqz.com version < 1.33.xxxx are there.
// This decision is made because AddonManager.getAddonByID works asynchronously.
// We need to avoid this behaviour every time when we need to get a version of extention.
let EXTENSION_VERSION = '';

const CliqzResources = {
  // CLIQZ-TODO: remove this property after 1.32.xxxx is no longer in use;
  WEB_EXTENSION_VERSION: '1.33',
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
  // CLIQZ-TODO: Those two methods should NOT be here;
  // Remove them completely after no users with cliqz extension version < 1.33.xxxx left.
  setExtensionVersion: function(nextVersion) {
    if (typeof nextVersion == 'string') {
      EXTENSION_VERSION = nextVersion;
    }
  },
  getExtensionVersion: function() {
    return EXTENSION_VERSION;
  },
};
