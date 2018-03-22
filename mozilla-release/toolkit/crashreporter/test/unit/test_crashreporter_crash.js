function run_test() {
  var is_win7_or_newer = false;
  var is_windows = false;
  var ph = Components.classes["@mozilla.org/network/protocol;1?name=http"]
             .getService(Components.interfaces.nsIHttpProtocolHandler);
  var match = ph.userAgent.match(/Windows NT (\d+).(\d+)/);
  if (match) {
      is_windows = true;
  }
  if (match && (parseInt(match[1]) > 6 ||
                parseInt(match[1]) == 6 && parseInt(match[2]) >= 1)) {
      is_win7_or_newer = true;
  }

  // try a basic crash
  do_crash(null, function(mdump, extra) {
             Assert.ok(mdump.exists());
             Assert.ok(mdump.fileSize > 0);
             Assert.ok("StartupTime" in extra);
             Assert.ok("CrashTime" in extra);
             Assert.ok(CrashTestUtils.dumpHasStream(mdump.path, CrashTestUtils.MD_THREAD_LIST_STREAM));
             Assert.ok(CrashTestUtils.dumpHasInstructionPointerMemory(mdump.path));
             if (is_windows) {
               ["SystemMemoryUsePercentage", "TotalVirtualMemory", "AvailableVirtualMemory",
                "AvailablePageFile", "AvailablePhysicalMemory"].forEach(function(prop) {
                  Assert.ok(/^\d+$/.test(extra[prop].toString()));
               });
             }
             if (is_win7_or_newer)
               Assert.ok(CrashTestUtils.dumpHasStream(mdump.path, CrashTestUtils.MD_MEMORY_INFO_LIST_STREAM));
           });

  // check setting some basic data
  do_crash(function() {
             // Add various annotations
             crashReporter.annotateCrashReport("TestKey", "TestValue");
             crashReporter.annotateCrashReport("\u2665", "\u{1F4A9}");
             crashReporter.appendAppNotesToCrashReport("Junk");
             crashReporter.appendAppNotesToCrashReport("MoreJunk");

             // TelemetrySession setup will trigger the session annotation
             let scope = {};
             Components.utils.import("resource://gre/modules/TelemetryController.jsm", scope);
             scope.TelemetryController.testSetup();
           },
           function(mdump, extra) {
             Assert.equal(extra.TestKey, "TestValue");
             Assert.equal(extra["\u2665"], "\u{1F4A9}");
             Assert.equal(extra.Notes, "JunkMoreJunk");
             const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
             Assert.ok("TelemetrySessionId" in extra,
                       "The TelemetrySessionId field is present in the extra file");
             Assert.ok(UUID_REGEX.test(extra.TelemetrySessionId),
                       "The TelemetrySessionId is a UUID");
             Assert.ok(!("TelemetryClientId" in extra),
                       "The TelemetryClientId field is omitted by default");
             Assert.ok(!("TelemetryServerURL" in extra),
                       "The TelemetryServerURL field is omitted by default");
           });

  do_crash(function() {
    // Enable the FHR, official policy bypass (since we're in a test) and
    // specify a telemetry server & client ID.
    Services.prefs.setBoolPref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
    Services.prefs.setBoolPref("datareporting.healthreport.uploadEnabled", true);
    Services.prefs.setCharPref("toolkit.telemetry.server", "http://a.telemetry.server");
    Services.prefs.setCharPref("toolkit.telemetry.cachedClientID",
                      "f3582dee-22b9-4d73-96d1-79ef5bf2fc24");

    // TelemetrySession setup will trigger the session annotation
    let scope = {};
    Components.utils.import("resource://gre/modules/TelemetryController.jsm", scope);
    Components.utils.import("resource://gre/modules/TelemetrySend.jsm", scope);
    scope.TelemetrySend.setTestModeEnabled(true);
    scope.TelemetryController.testSetup();
  }, function(mdump, extra) {
    Assert.ok("TelemetryClientId" in extra,
              "The TelemetryClientId field is present when the FHR is on");
    Assert.equal(extra.TelemetryClientId,
                 "f3582dee-22b9-4d73-96d1-79ef5bf2fc24",
                 "The TelemetryClientId matches the expected value");
    Assert.ok("TelemetryServerURL" in extra,
              "The TelemetryServerURL field is present when the FHR is on");
    Assert.equal(extra.TelemetryServerURL, "http://a.telemetry.server",
                 "The TelemetryServerURL matches the expected value");
  });

  do_crash(function() {
    // Disable the FHR upload, no telemetry annotations should be present.
    Services.prefs.setBoolPref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
    Services.prefs.setBoolPref("datareporting.healthreport.uploadEnabled", false);

    // TelemetrySession setup will trigger the session annotation
    let scope = {};
    Components.utils.import("resource://gre/modules/TelemetryController.jsm", scope);
    Components.utils.import("resource://gre/modules/TelemetrySend.jsm", scope);
    scope.TelemetrySend.setTestModeEnabled(true);
    scope.TelemetryController.testSetup();
  }, function(mdump, extra) {
    Assert.ok(!("TelemetryClientId" in extra),
              "The TelemetryClientId field is omitted when FHR upload is disabled");
    Assert.ok(!("TelemetryServerURL" in extra),
              "The TelemetryServerURL field is omitted when FHR upload is disabled");
  });

  do_crash(function() {
    // No telemetry annotations should be present if the user has not been
    // notified yet
    Services.prefs.setBoolPref("datareporting.policy.dataSubmissionPolicyBypassNotification", false);
    Services.prefs.setBoolPref("datareporting.healthreport.uploadEnabled", true);

    // TelemetrySession setup will trigger the session annotation
    let scope = {};
    Components.utils.import("resource://gre/modules/TelemetryController.jsm", scope);
    Components.utils.import("resource://gre/modules/TelemetrySend.jsm", scope);
    scope.TelemetrySend.setTestModeEnabled(true);
    scope.TelemetryController.testSetup();
  }, function(mdump, extra) {
    Assert.ok(!("TelemetryClientId" in extra),
              "The TelemetryClientId field is omitted when FHR upload is disabled");
    Assert.ok(!("TelemetryServerURL" in extra),
              "The TelemetryServerURL field is omitted when FHR upload is disabled");
  });
}
