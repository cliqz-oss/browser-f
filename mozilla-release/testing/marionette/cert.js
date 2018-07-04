/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.import("resource://gre/modules/Preferences.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

this.EXPORTED_SYMBOLS = [
  "CertificateOverrideManager",
  "InsecureSweepingOverride",
];

const registrar =
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
const sss = Cc["@mozilla.org/ssservice;1"]
    .getService(Ci.nsISiteSecurityService);

const CERT_PINNING_ENFORCEMENT_PREF = "security.cert_pinning.enforcement_level";
const CID = Components.ID("{4b67cce0-a51c-11e6-9598-0800200c9a66}");
const CONTRACT_ID = "@mozilla.org/security/certoverride;1";
const DESC = "All-encompassing cert service that matches on a bitflag";
const HSTS_PRELOAD_LIST_PREF = "network.stricttransportsecurity.preloadlist";

const Error = {
  Untrusted: 1,
  Mismatch: 2,
  Time: 4,
};

let currentOverride = null;

/** TLS certificate service override management for Marionette. */
class CertificateOverrideManager {
  /**
   * Installs a TLS certificate service override.
   *
   * The provided `service` must implement the `register` and `unregister`
   * functions that causes a new `nsICertOverrideService` interface
   * implementation to be registered with the `nsIComponentRegistrar`.
   *
   * After `service` is registered, `nsICertOverrideService` is
   * reinitialised to cause all Gecko components to pick up the
   * new service.
   *
   * If an override is already installed this functions acts as a no-op.
   *
   * @param {cert.Override} service
   *     Service generator that registers and unregisters the XPCOM service.
   *
   * @throws {Components.Exception}
   *     If unable to register or initialise `service`.
   */
  static install(service) {
    if (currentOverride) {
      return;
    }

    service.register();
    currentOverride = service;
  }

  /**
   * Uninstall a TLS certificate service override.
   *
   * If there is no current override installed this function acts
   * as a no-op.
   */
  static uninstall() {
    if (!currentOverride) {
      return;
    }
    currentOverride.unregister();
    currentOverride = null;
  }
}
this.CertificateOverrideManager = CertificateOverrideManager;

/**
 * Certificate override service that acts in an all-inclusive manner
 * on TLS certificates.
 *
 * @throws {Components.Exception}
 *     If there are any problems registering the service.
 */
function InsecureSweepingOverride() {
  // This needs to be an old-style class with a function constructor
  // and prototype assignment because... XPCOM.  Any attempt at
  // modernisation will be met with cryptic error messages which will
  // make your life miserable.
  let service = function() {};
  service.prototype = {
    hasMatchingOverride(
        aHostName, aPort, aCert, aOverrideBits, aIsTemporary) {
      aIsTemporary.value = false;
      aOverrideBits.value = Error.Untrusted | Error.Mismatch | Error.Time;

      return true;
    },

    QueryInterface: ChromeUtils.generateQI([Ci.nsICertOverrideService]),
  };
  let factory = XPCOMUtils.generateSingletonFactory(service);

  return {
    register() {
      // make it possible to register certificate overrides for domains
      // that use HSTS or HPKP
      Preferences.set(HSTS_PRELOAD_LIST_PREF, false);
      Preferences.set(CERT_PINNING_ENFORCEMENT_PREF, 0);

      registrar.registerFactory(CID, DESC, CONTRACT_ID, factory);
    },

    unregister() {
      registrar.unregisterFactory(CID, factory);

      Preferences.reset(HSTS_PRELOAD_LIST_PREF);
      Preferences.reset(CERT_PINNING_ENFORCEMENT_PREF);

      // clear collected HSTS and HPKP state
      // through the site security service
      sss.clearAll();
      sss.clearPreloads();
    },
  };
}
this.InsecureSweepingOverride = InsecureSweepingOverride;
