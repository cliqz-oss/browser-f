'use strict';

var EXPORTED_SYMBOLS = ["CliqzResources"];

const {UUIDMap} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});
const EXTENSION_ID = UUIDMap.get('cliqz@cliqz.com');
const webextPrefix = `moz-extension://${EXTENSION_ID}/modules/`;
const FRESHTAB_URL = `${webextPrefix}freshtab/home.html`;
const WELCOME_URL = `${webextPrefix}onboarding-v3/index.html`;

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
  whatIstheURL: u => `${webextPrefix}${u}`,
  freshTab: FRESHTAB_URL,
  onboarding: WELCOME_URL
};
