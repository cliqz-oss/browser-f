'use strict';

var EXPORTED_SYMBOLS = ["CliqzResources"];

const {NetUtil} = ChromeUtils.import("resource://gre/modules/NetUtil.jsm", {});
const {UUIDMap} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});
const EXTENSION_ID = UUIDMap.get('cliqz@cliqz.com');
const FRESHTAB_URL =
  'moz-extension://' + EXTENSION_ID + '/modules/freshtab/home.html';
const WELCOME_URL =
  'moz-extension://' + EXTENSION_ID + '/modules/onboarding-v3/index.html';

let WEB_EXTENSION_API = false;
const OLD_EXTENSION_APP_BUNDLE_URI = 'chrome://cliqz/content/core/app.bundle.js';

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
    if (WEB_EXTENSION_API === true) {
      return true;
    }

    let stream;
    try {
      // CLIQZ-SPECIAL:
      // Legacy Extension can be served at uri OLD_EXTENSION_APP_BUNDLE_URI;
      // We can try to obtain it until an error starting with
      // 'error opening input stream' appears which means that a user has updated a legacy extension
      // to the one based on WebExtension API.
      // Then we can save this informaion in WEB_EXTENSION_API variable.
      // When there are no users left who would have legacy exts we can remove this module at once.
      let extensionURI = Services.io.newURI(OLD_EXTENSION_APP_BUNDLE_URI);
      let channel = NetUtil.newChannel({
        uri: extensionURI,
        loadingPrincipal: Services.scriptSecurityManager.createCodebasePrincipal(extensionURI, {}),
        securityFlags: Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL,
        contentPolicyType: Ci.nsIContentPolicy.TYPE_INTERNAL_XMLHTTPREQUEST
      });
      stream = channel.open();
    }
    catch(e) {
      WEB_EXTENSION_API = true;
      return true;
    }

    return false;
  },
};
