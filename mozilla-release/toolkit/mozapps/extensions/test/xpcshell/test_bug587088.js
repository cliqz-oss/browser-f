/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Tests that trying to upgrade or uninstall an extension that has a file locked
// will roll back the upgrade or uninstall and retry at the next restart

const profileDir = gProfD.clone();
profileDir.append("extensions");

function run_test() {
  // This is only an issue on windows.
  if (!("nsIWindowsRegKey" in AM_Ci))
    return;

  do_test_pending();
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

  startupManager();
  run_test_1();
}

function check_addon(aAddon, aVersion) {
  Assert.notEqual(aAddon, null);
  Assert.equal(aAddon.version, aVersion);
  Assert.ok(aAddon.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, aAddon.id));

  Assert.ok(aAddon.hasResource("testfile"));
  if (aVersion == "1.0") {
    Assert.ok(aAddon.hasResource("testfile1"));
    Assert.ok(!aAddon.hasResource("testfile2"));
  } else {
    Assert.ok(!aAddon.hasResource("testfile1"));
    Assert.ok(aAddon.hasResource("testfile2"));
  }

  Assert.equal(aAddon.pendingOperations, AddonManager.PENDING_NONE);
}

function check_addon_upgrading(aAddon) {
  Assert.notEqual(aAddon, null);
  Assert.equal(aAddon.version, "1.0");
  Assert.ok(aAddon.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, aAddon.id));

  Assert.ok(aAddon.hasResource("testfile"));
  Assert.ok(aAddon.hasResource("testfile1"));
  Assert.ok(!aAddon.hasResource("testfile2"));

  Assert.equal(aAddon.pendingOperations, AddonManager.PENDING_UPGRADE);

  Assert.equal(aAddon.pendingUpgrade.version, "2.0");
}

function check_addon_uninstalling(aAddon, aAfterRestart) {
  Assert.notEqual(aAddon, null);
  Assert.equal(aAddon.version, "1.0");

  if (aAfterRestart) {
    Assert.ok(!aAddon.isActive);
    Assert.ok(!isExtensionInAddonsList(profileDir, aAddon.id));
  } else {
    Assert.ok(aAddon.isActive);
    Assert.ok(isExtensionInAddonsList(profileDir, aAddon.id));
  }

  Assert.ok(aAddon.hasResource("testfile"));
  Assert.ok(aAddon.hasResource("testfile1"));
  Assert.ok(!aAddon.hasResource("testfile2"));

  Assert.equal(aAddon.pendingOperations, AddonManager.PENDING_UNINSTALL);
}

function run_test_1() {
  installAllFiles([do_get_addon("test_bug587088_1")], function() {
    restartManager();

    AddonManager.getAddonByID("addon1@tests.mozilla.org", function(a1) {
      check_addon(a1, "1.0");

      // Lock either install.rdf for unpacked add-ons or the xpi for packed add-ons.
      let uri = a1.getResourceURI("install.rdf");
      if (uri.schemeIs("jar"))
        uri = a1.getResourceURI();

      let fstream = AM_Cc["@mozilla.org/network/file-input-stream;1"].
                    createInstance(AM_Ci.nsIFileInputStream);
      fstream.init(uri.QueryInterface(AM_Ci.nsIFileURL).file, -1, 0, 0);

      installAllFiles([do_get_addon("test_bug587088_2")], function() {

        check_addon_upgrading(a1);

        restartManager();

        AddonManager.getAddonByID("addon1@tests.mozilla.org", callback_soon(function(a1_2) {
          check_addon_upgrading(a1_2);

          restartManager();

          AddonManager.getAddonByID("addon1@tests.mozilla.org", callback_soon(function(a1_3) {
            check_addon_upgrading(a1_3);

            fstream.close();

            restartManager();

            AddonManager.getAddonByID("addon1@tests.mozilla.org", function(a1_4) {
              check_addon(a1_4, "2.0");

              a1_4.uninstall();
              executeSoon(run_test_2);
            });
          }));
        }));
      });
    });
  });
}

// Test that a failed uninstall gets rolled back
function run_test_2() {
  restartManager();

  installAllFiles([do_get_addon("test_bug587088_1")], async function() {
    await promiseRestartManager();

    AddonManager.getAddonByID("addon1@tests.mozilla.org", callback_soon(async function(a1) {
      check_addon(a1, "1.0");

      // Lock either install.rdf for unpacked add-ons or the xpi for packed add-ons.
      let uri = a1.getResourceURI("install.rdf");
      if (uri.schemeIs("jar"))
        uri = a1.getResourceURI();

      let fstream = AM_Cc["@mozilla.org/network/file-input-stream;1"].
                    createInstance(AM_Ci.nsIFileInputStream);
      fstream.init(uri.QueryInterface(AM_Ci.nsIFileURL).file, -1, 0, 0);

      a1.uninstall();

      check_addon_uninstalling(a1);

      await promiseRestartManager();

      AddonManager.getAddonByID("addon1@tests.mozilla.org", callback_soon(async function(a1_2) {
        check_addon_uninstalling(a1_2, true);

        await promiseRestartManager();

        AddonManager.getAddonByID("addon1@tests.mozilla.org", callback_soon(async function(a1_3) {
          check_addon_uninstalling(a1_3, true);

          fstream.close();

          await promiseRestartManager();

          AddonManager.getAddonByID("addon1@tests.mozilla.org", function(a1_4) {
            Assert.equal(a1_4, null);
            var dir = profileDir.clone();
            dir.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
            Assert.ok(!dir.exists());
            Assert.ok(!isExtensionInAddonsList(profileDir, "addon1@tests.mozilla.org"));

            executeSoon(do_test_finished);
          });
        }));
      }));
    }));
  });
}
