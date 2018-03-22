/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Disables security checking our updates which haven't been signed
Services.prefs.setBoolPref("extensions.checkUpdateSecurity", false);

// Get the HTTP server.
Components.utils.import("resource://testing-common/httpd.js");
var testserver;

var ADDON = {
  id: "bug299716-2@tests.mozilla.org",
  addon: "test_bug299716_2"
};

function run_test() {
  do_test_pending();

  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "2", "1.9");

  const dataDir = do_get_file("data");
  const addonsDir = do_get_addon(ADDON.addon).parent;

  // Create and configure the HTTP server.
  testserver = new HttpServer();
  testserver.registerDirectory("/addons/", addonsDir);
  testserver.registerDirectory("/data/", dataDir);
  testserver.start(4444);

  startupManager();

  installAllFiles([do_get_addon(ADDON.addon)], function() {
    restartManager();

    AddonManager.getAddonByID(ADDON.id, function(item) {
      Assert.equal(item.version, 0.1);
      Assert.ok(!item.isCompatible);

      item.findUpdates({
        onUpdateFinished(addon) {
          Assert.ok(!item.isCompatible);

          testserver.stop(do_test_finished);
        }
      }, AddonManager.UPDATE_WHEN_USER_REQUESTED);
    });
  });
}
