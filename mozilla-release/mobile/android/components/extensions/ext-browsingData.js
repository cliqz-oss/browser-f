/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
"use strict";

ChromeUtils.import("resource://gre/modules/Task.jsm");

ChromeUtils.defineModuleGetter(this, "Sanitizer",
                               "resource://gre/modules/Sanitizer.jsm");
ChromeUtils.defineModuleGetter(this, "Services",
                               "resource://gre/modules/Services.jsm");
ChromeUtils.defineModuleGetter(this, "SharedPreferences",
                               "resource://gre/modules/SharedPreferences.jsm");

const clearCache = () => {
  // Clearing the cache does not support timestamps.
  return Sanitizer.clearItem("cache");
};

const clearCookies = async function(options) {
  let cookieMgr = Services.cookies;
  let yieldCounter = 0;
  const YIELD_PERIOD = 10;

  if (options.since) {
    // Convert it to microseconds
    let since =  options.since * 1000;
    // Iterate through the cookies and delete any created after our cutoff.
    let cookiesEnum = cookieMgr.enumerator;
    while (cookiesEnum.hasMoreElements()) {
      let cookie = cookiesEnum.getNext().QueryInterface(Ci.nsICookie2);

      if (cookie.creationTime >= since) {
        // This cookie was created after our cutoff, clear it.
        cookieMgr.remove(cookie.host, cookie.name, cookie.path,
                         false, cookie.originAttributes);

        if (++yieldCounter % YIELD_PERIOD == 0) {
          await new Promise(resolve => setTimeout(resolve, 0)); // Don't block the main thread too long.
        }
      }
    }
  } else {
    // Remove everything.
    cookieMgr.removeAll();
  }
};

const clearDownloads = options => {
  return Sanitizer.clearItem("downloadHistory", options.since);
};

const clearFormData = options => {
  return Sanitizer.clearItem("formdata", options.since);
};

const doRemoval = (options, dataToRemove, extension) => {
  if (options.originTypes &&
      (options.originTypes.protectedWeb || options.originTypes.extension)) {
    return Promise.reject(
      {message: "Firefox does not support protectedWeb or extension as originTypes."});
  }

  let removalPromises = [];
  let invalidDataTypes = [];
  for (let dataType in dataToRemove) {
    if (dataToRemove[dataType]) {
      switch (dataType) {
        case "cache":
          removalPromises.push(clearCache());
          break;
        case "cookies":
          removalPromises.push(clearCookies(options));
          break;
        case "downloads":
          removalPromises.push(clearDownloads(options));
          break;
        case "formData":
          removalPromises.push(clearFormData(options));
          break;
        default:
          invalidDataTypes.push(dataType);
      }
    }
  }
  if (extension && invalidDataTypes.length) {
    extension.logger.warn(
      `Firefox does not support dataTypes: ${invalidDataTypes.toString()}.`);
  }
  return Promise.all(removalPromises);
};

this.browsingData = class extends ExtensionAPI {
  getAPI(context) {
    let {extension} = context;
    return {
      browsingData: {
        settings() {
          const PREF_DOMAIN = "android.not_a_preference.privacy.clear";
          const PREF_KEY_PREFIX = "private.data.";
          // The following prefs are the only ones in Firefox that match corresponding
          // values used by Chrome when returning settings.
          const PREF_LIST = ["cache", "history", "formdata", "cookies_sessions", "downloadFiles"];

          let dataTrue = SharedPreferences.forProfile().getSetPref(PREF_DOMAIN);
          let name;

          let dataToRemove = {};
          let dataRemovalPermitted = {};

          for (let item of PREF_LIST) {
            // The property formData needs a different case than the
            // formdata preference.
            switch (item) {
              case "formdata":
                name = "formData";
                break;
              case "cookies_sessions":
                name = "cookies";
                break;
              case "downloadFiles":
                name = "downloads";
                break;
              default:
                name = item;
            }
            dataToRemove[name] = dataTrue.includes(`${PREF_KEY_PREFIX}${item}`);
            // Firefox doesn't have the same concept of dataRemovalPermitted
            // as Chrome, so it will always be true.
            dataRemovalPermitted[name] = true;
          }
          // We do not provide option to delete history by time
          // so, since value is given 0, which means Everything
          return Promise.resolve({options: {since: 0}, dataToRemove, dataRemovalPermitted});
        },
        remove(options, dataToRemove) {
          return doRemoval(options, dataToRemove, extension);
        },
        removeCache(options) {
          return doRemoval(options, {cache: true});
        },
        removeCookies(options) {
          return doRemoval(options, {cookies: true});
        },
        removeDownloads(options) {
          return doRemoval(options, {downloads: true});
        },
        removeFormData(options) {
          return doRemoval(options, {formData: true});
        },
      },
    };
  }
};
