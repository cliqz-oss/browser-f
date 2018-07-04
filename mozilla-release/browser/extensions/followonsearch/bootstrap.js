/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global APP_SHUTDOWN:false */

"use strict";

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Timer.jsm");

// Preferences this add-on uses.
const kPrefPrefix = "extensions.followonsearch.";
const PREF_LOGGING = `${kPrefPrefix}logging`;

const kExtensionID = "followonsearch@mozilla.com";
const kSaveTelemetryMsg = `${kExtensionID}:save-telemetry`;
const kShutdownMsg = `${kExtensionID}:shutdown`;

const frameScript = `chrome://followonsearch/content/followonsearch-fs.js?q=${Math.random()}`;

const validSearchTypes = [
  // A search is a follow-on search from an SAP.
  "follow-on",
  // The search is a "search access point".
  "sap",
];

var gLoggingEnabled = false;
var gTelemetryActivated = false;

/**
 * Logs a message to the console if logging is enabled.
 *
 * @param {String} message The message to log.
 */
function log(message) {
  if (gLoggingEnabled) {
    console.log("Follow-On Search", message);
  }
}

/**
 * Handles receiving a message from the content process to save telemetry.
 *
 * @param {Object} message The message received.
 */
function handleSaveTelemetryMsg(message) {
  if (message.name != kSaveTelemetryMsg) {
    throw new Error(`Unexpected message received: ${message.name}`);
  }

  let info = message.data;

  if (!validSearchTypes.includes(info.type)) {
    throw new Error("Unexpected type!");
  }

  log(info);

  let histogram = Services.telemetry.getKeyedHistogramById("SEARCH_COUNTS");
  let payload = `${info.sap}.${info.type}:unknown:${info.code}`;
  if (info.extra) {
    payload += `:${info.extra}`
  }
  histogram.add(payload);
}

/**
 * Activates recording of telemetry if it isn't already activated.
 */
function activateTelemetry() {
  if (gTelemetryActivated) {
    return;
  }

  gTelemetryActivated = true;

  Services.mm.addMessageListener(kSaveTelemetryMsg, handleSaveTelemetryMsg);
  Services.mm.loadFrameScript(frameScript, true);
}

/**
 * Deactivites recording of telemetry if it isn't already deactivated.
 */
function deactivateTelemetry() {
  if (!gTelemetryActivated) {
    return;
  }

  Services.mm.removeMessageListener(kSaveTelemetryMsg, handleSaveTelemetryMsg);
  Services.mm.removeDelayedFrameScript(frameScript);
  Services.mm.broadcastAsyncMessage(kShutdownMsg);

  gTelemetryActivated = false;
}

/**
 * cohortManager is used to decide which users to enable the add-on for.
 */
var cohortManager = {
  // Indicates whether the telemetry should be enabled.
  enableForUser: false,

  // Records if we've already run init.
  _definedThisSession: false,

  /**
   * Initialises the manager, working out if telemetry should be enabled
   * for the user.
   */
  init() {
    if (this._definedThisSession) {
      return;
    }

    this._definedThisSession = true;
    this.enableForUser = false;

    try {
      let distId = Services.prefs.getCharPref("distribution.id", "");
      if (distId) {
        log("It is a distribution, not setting up nor enabling telemetry.");
        return;
      }
    } catch (e) {}

    log("Enabling telemetry for user");
    this.enableForUser = true;
  },
};

/**
 * Called when the add-on is installed.
 *
 * @param {Object} data Data about the add-on.
 * @param {Number} reason Indicates why the extension is being installed.
 */
function install(data, reason) {
  // Nothing specifically to do, startup will set everything up for us.
}

/**
 * Called when the add-on is uninstalled.
 *
 * @param {Object} data Data about the add-on.
 * @param {Number} reason Indicates why the extension is being uninstalled.
 */
function uninstall(data, reason) {
  // Nothing specifically to do, shutdown does what we need.
}

/**
 * Called when the add-on starts up.
 *
 * @param {Object} data Data about the add-on.
 * @param {Number} reason Indicates why the extension is being started.
 */
function startup(data, reason) {
  try {
    gLoggingEnabled = Services.prefs.getBoolPref(PREF_LOGGING, false);
  } catch (e) {
    // Needed until Firefox 54
  }

  cohortManager.init();

  if (cohortManager.enableForUser) {
    // Workaround for bug 1202125
    // We need to delay our loading so that when we are upgraded,
    // our new script doesn't get the shutdown message.
    setTimeout(() => {
      activateTelemetry();
    }, 1000);
  }
}

/**
 * Called when the add-on shuts down.
 *
 * @param {Object} data Data about the add-on.
 * @param {Number} reason Indicates why the extension is being shut down.
 */
function shutdown(data, reason) {
  // If we're shutting down, skip the cleanup to save time.
  if (reason === APP_SHUTDOWN) {
    return;
  }

  deactivateTelemetry();
}
