/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

/* exported sinon */
Services.scriptloader.loadSubScript("resource://testing-common/sinon-2.3.2.js");
registerCleanupFunction(function() {
  delete window.sinon;
});

const PREF_ENABLED = "browser.chrome.errorReporter.enabled";
const PREF_PROJECT_ID = "browser.chrome.errorReporter.projectId";
const PREF_PUBLIC_KEY = "browser.chrome.errorReporter.publicKey";
const PREF_SAMPLE_RATE = "browser.chrome.errorReporter.sampleRate";
const PREF_SUBMIT_URL = "browser.chrome.errorReporter.submitUrl";
const TELEMETRY_ERROR_COLLECTED = "browser.errors.collected_count";
const TELEMETRY_ERROR_COLLECTED_FILENAME = "browser.errors.collected_count_by_filename";
const TELEMETRY_ERROR_COLLECTED_STACK = "browser.errors.collected_with_stack_count";
const TELEMETRY_ERROR_REPORTED = "browser.errors.reported_success_count";
const TELEMETRY_ERROR_REPORTED_FAIL = "browser.errors.reported_failure_count";
const TELEMETRY_ERROR_SAMPLE_RATE = "browser.errors.sample_rate";

add_task(async function testSetup() {
  const canRecordExtended = Services.telemetry.canRecordExtended;
  Services.telemetry.canRecordExtended = true;
  registerCleanupFunction(() => Services.telemetry.canRecordExtended = canRecordExtended);
});

function createScriptError(options = {}) {
  const scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
  scriptError.init(
    options.message || "",
    "sourceName" in options ? options.sourceName : null,
    options.sourceLine || null,
    options.lineNumber || null,
    options.columnNumber || null,
    options.flags || Ci.nsIScriptError.errorFlag,
    options.category || "chrome javascript",
  );
  return scriptError;
}

function noop() {
  // Do nothing
}

// Clears the console of any previous messages. Should be called at the end of
// each test that logs to the console.
function resetConsole() {
  Services.console.logStringMessage("");
  Services.console.reset();
}

// Finds the fetch spy call for an error with a matching message.
function fetchCallForMessage(fetchSpy, message) {
  for (const call of fetchSpy.getCalls()) {
    const body = JSON.parse(call.args[1].body);
    if (body.exception.values[0].value.includes(message)) {
      return call;
    }
  }

  return null;
}

// Helper to test if a fetch spy was called with the given error message.
// Used in tests where unrelated JS errors from other code are logged.
function fetchPassedError(fetchSpy, message) {
  return fetchCallForMessage(fetchSpy, message) !== null;
}
