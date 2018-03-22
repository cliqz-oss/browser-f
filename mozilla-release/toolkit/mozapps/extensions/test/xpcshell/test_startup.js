/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// This verifies startup detection of added/removed/changed items and install
// location priorities

// Enable loading extensions from the user and system scopes
Services.prefs.setIntPref("extensions.enabledScopes",
                          AddonManager.SCOPE_PROFILE + AddonManager.SCOPE_USER +
                          AddonManager.SCOPE_SYSTEM);

var addon1 = {
  id: "addon1@tests.mozilla.org",
  version: "1.0",
  name: "Test 1",
  targetApplications: [{
    id: "xpcshell@tests.mozilla.org",
    minVersion: "1",
    maxVersion: "1"
  }, {                 // Repeated target application entries should be ignored
    id: "xpcshell@tests.mozilla.org",
    minVersion: "2",
    maxVersion: "2"
  }]
};

var addon2 = {
  id: "addon2@tests.mozilla.org",
  version: "2.0",
  name: "Test 2",
  targetApplications: [{  // Bad target application entries should be ignored
    minVersion: "3",
    maxVersion: "4"
  }, {
    id: "xpcshell@tests.mozilla.org",
    minVersion: "1",
    maxVersion: "2"
  }]
};

var addon3 = {
  id: "addon3@tests.mozilla.org",
  version: "3.0",
  name: "Test 3",
  targetApplications: [{
    id: "toolkit@mozilla.org",
    minVersion: "1.9.2",
    maxVersion: "1.9.2.*"
  }]
};

// Should be ignored because it has no ID
var addon4 = {
  version: "4.0",
  name: "Test 4",
  targetApplications: [{
    id: "xpcshell@tests.mozilla.org",
    minVersion: "1",
    maxVersion: "1"
  }]
};

// Should be ignored because it has no version
var addon5 = {
  id: "addon5@tests.mozilla.org",
  name: "Test 5",
  targetApplications: [{
    id: "xpcshell@tests.mozilla.org",
    minVersion: "1",
    maxVersion: "1"
  }]
};

// Should be ignored because it has an invalid type
var addon6 = {
  id: "addon6@tests.mozilla.org",
  version: "3.0",
  name: "Test 6",
  type: 5,
  targetApplications: [{
    id: "toolkit@mozilla.org",
    minVersion: "1.9.2",
    maxVersion: "1.9.2.*"
  }]
};

// Should be ignored because it has an invalid type
var addon7 = {
  id: "addon7@tests.mozilla.org",
  version: "3.0",
  name: "Test 3",
  type: "extension",
  targetApplications: [{
    id: "toolkit@mozilla.org",
    minVersion: "1.9.2",
    maxVersion: "1.9.2.*"
  }]
};

createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

const globalDir = gProfD.clone();
globalDir.append("extensions2");
globalDir.append(gAppInfo.ID);
registerDirectory("XRESysSExtPD", globalDir.parent);
const userDir = gProfD.clone();
userDir.append("extensions3");
userDir.append(gAppInfo.ID);
registerDirectory("XREUSysExt", userDir.parent);
const profileDir = gProfD.clone();
profileDir.append("extensions");

var gCachePurged = false;

// Set up the profile
function run_test() {
  do_test_pending("test_startup main");

  Services.obs.addObserver({
    observe(aSubject, aTopic, aData) {
      gCachePurged = true;
    }
  }, "startupcache-invalidate");

  startupManager();
  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);

  Assert.ok(!gExtensionsJSON.exists());

  Assert.ok(!gAddonStartup.exists());

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org",
                               "addon6@tests.mozilla.org",
                               "addon7@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5, a6, a7]) {

    Assert.equal(a1, null);
    do_check_not_in_crash_annotation(addon1.id, addon1.version);
    Assert.equal(a2, null);
    do_check_not_in_crash_annotation(addon2.id, addon2.version);
    Assert.equal(a3, null);
    do_check_not_in_crash_annotation(addon3.id, addon3.version);
    Assert.equal(a4, null);
    Assert.equal(a5, null);

    executeSoon(run_test_1);
  });
}

function end_test() {
  do_test_finished("test_startup main");
}

// Try to install all the items into the profile
async function run_test_1() {
  writeInstallRDFForExtension(addon1, profileDir);
  var dest = writeInstallRDFForExtension(addon2, profileDir);
  // Attempt to make this look like it was added some time in the past so
  // the change in run_test_2 makes the last modified time change.
  setExtensionModifiedTime(dest, dest.lastModifiedTime - 5000);

  writeInstallRDFForExtension(addon3, profileDir);
  writeInstallRDFForExtension(addon4, profileDir, "addon4@tests.mozilla.org");
  writeInstallRDFForExtension(addon5, profileDir);
  writeInstallRDFForExtension(addon6, profileDir);
  writeInstallRDFForExtension(addon7, profileDir);

  gCachePurged = false;
  await promiseRestartManager();
  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, ["addon1@tests.mozilla.org",
                                      "addon2@tests.mozilla.org",
                                      "addon3@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  info("Checking for " + gAddonStartup.path);
  Assert.ok(gAddonStartup.exists());

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org",
                               "addon6@tests.mozilla.org",
                               "addon7@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5, a6, a7]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.notEqual(a1.syncGUID, null);
    Assert.ok(a1.syncGUID.length >= 9);
    Assert.equal(a1.version, "1.0");
    Assert.equal(a1.name, "Test 1");
    Assert.ok(isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, addon1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_PROFILE);
    Assert.equal(a1.sourceURI, null);
    Assert.ok(a1.foreignInstall);
    Assert.ok(!a1.userDisabled);
    Assert.ok(a1.seen);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.notEqual(a2.syncGUID, null);
    Assert.ok(a2.syncGUID.length >= 9);
    Assert.equal(a2.version, "2.0");
    Assert.equal(a2.name, "Test 2");
    Assert.ok(isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, addon2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_PROFILE);
    Assert.equal(a2.sourceURI, null);
    Assert.ok(a2.foreignInstall);
    Assert.ok(!a1.userDisabled);
    Assert.ok(a1.seen);

    Assert.notEqual(a3, null);
    Assert.equal(a3.id, "addon3@tests.mozilla.org");
    Assert.notEqual(a3.syncGUID, null);
    Assert.ok(a3.syncGUID.length >= 9);
    Assert.equal(a3.version, "3.0");
    Assert.equal(a3.name, "Test 3");
    Assert.ok(isExtensionInAddonsList(profileDir, a3.id));
    Assert.ok(hasFlag(a3.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a3.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon3.id, addon3.version);
    Assert.equal(a3.scope, AddonManager.SCOPE_PROFILE);
    Assert.equal(a3.sourceURI, null);
    Assert.ok(a3.foreignInstall);
    Assert.ok(!a1.userDisabled);
    Assert.ok(a1.seen);

    Assert.equal(a4, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));
    dest = profileDir.clone();
    dest.append(do_get_expected_addon_name("addon4@tests.mozilla.org"));
    Assert.ok(!dest.exists());

    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));
    dest = profileDir.clone();
    dest.append(do_get_expected_addon_name("addon5@tests.mozilla.org"));
    Assert.ok(!dest.exists());

    Assert.equal(a6, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon6@tests.mozilla.org"));
    dest = profileDir.clone();
    dest.append(do_get_expected_addon_name("addon6@tests.mozilla.org"));
    Assert.ok(!dest.exists());

    Assert.equal(a7, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon7@tests.mozilla.org"));
    dest = profileDir.clone();
    dest.append(do_get_expected_addon_name("addon7@tests.mozilla.org"));
    Assert.ok(!dest.exists());

    AddonManager.getAddonsByTypes(["extension"], function(extensionAddons) {
      Assert.equal(extensionAddons.length, 3);

      executeSoon(run_test_2);
    });
  });
}

// Test that modified items are detected and items in other install locations
// are ignored
async function run_test_2() {
  addon1.version = "1.1";
  writeInstallRDFForExtension(addon1, userDir);
  addon2.version = "2.1";
  writeInstallRDFForExtension(addon2, profileDir);
  addon2.version = "2.2";
  writeInstallRDFForExtension(addon2, globalDir);
  addon2.version = "2.3";
  writeInstallRDFForExtension(addon2, userDir);
  var dest = profileDir.clone();
  dest.append(do_get_expected_addon_name("addon3@tests.mozilla.org"));
  dest.remove(true);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, ["addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, ["addon3@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  Assert.ok(gAddonStartup.exists());

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.0");
    Assert.ok(isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, a1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_PROFILE);
    Assert.ok(a1.foreignInstall);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.1");
    Assert.ok(isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, a2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_PROFILE);
    Assert.ok(a2.foreignInstall);

    Assert.equal(a3, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon3@tests.mozilla.org"));
    do_check_not_in_crash_annotation(addon3.id, addon3.version);

    Assert.equal(a4, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));

    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));

    executeSoon(run_test_3);
  });
}

// Check that removing items from the profile reveals their hidden versions.
async function run_test_3() {
  var dest = profileDir.clone();
  dest.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
  dest.remove(true);
  dest = profileDir.clone();
  dest.append(do_get_expected_addon_name("addon2@tests.mozilla.org"));
  dest.remove(true);
  writeInstallRDFForExtension(addon3, profileDir, "addon4@tests.mozilla.org");

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, ["addon1@tests.mozilla.org",
                                    "addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.1");
    Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, a1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_USER);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.3");
    Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, a2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_USER);

    Assert.equal(a3, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon3@tests.mozilla.org"));

    Assert.equal(a4, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));

    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));

    dest = profileDir.clone();
    dest.append(do_get_expected_addon_name("addon4@tests.mozilla.org"));
    Assert.ok(!dest.exists());

    executeSoon(run_test_4);
  });
}

// Test that disabling an install location works
async function run_test_4() {
  Services.prefs.setIntPref("extensions.enabledScopes", AddonManager.SCOPE_SYSTEM);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, ["addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, ["addon1@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.equal(a1, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon1@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon1@tests.mozilla.org"));

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.2");
    Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, a2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_SYSTEM);

    executeSoon(run_test_5);
  });
}

// Switching disabled locations works
async function run_test_5() {
  Services.prefs.setIntPref("extensions.enabledScopes", AddonManager.SCOPE_USER);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, ["addon1@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, ["addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.1");
    Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, a1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_USER);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.3");
    Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, a2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_USER);

    executeSoon(run_test_6);
  });
}

// Resetting the pref makes everything visible again
async function run_test_6() {
  Services.prefs.clearUserPref("extensions.enabledScopes");

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.1");
    Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, a1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_USER);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.3");
    Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, a2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_USER);

    executeSoon(run_test_7);
  });
}

// Check that items in the profile hide the others again.
async function run_test_7() {
  addon1.version = "1.2";
  writeInstallRDFForExtension(addon1, profileDir);
  var dest = userDir.clone();
  dest.append(do_get_expected_addon_name("addon2@tests.mozilla.org"));
  dest.remove(true);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, ["addon1@tests.mozilla.org",
                                    "addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.2");
    Assert.ok(isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, a1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_PROFILE);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.2");
    Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon2.id, a2.version);
    Assert.equal(a2.scope, AddonManager.SCOPE_SYSTEM);

    Assert.equal(a3, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon3@tests.mozilla.org"));

    Assert.equal(a4, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));

    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));

    executeSoon(run_test_8);
  });
}

// Disabling all locations still leaves the profile working
async function run_test_8() {
  Services.prefs.setIntPref("extensions.enabledScopes", 0);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, ["addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.2");
    Assert.ok(isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    do_check_in_crash_annotation(addon1.id, a1.version);
    Assert.equal(a1.scope, AddonManager.SCOPE_PROFILE);

    Assert.equal(a2, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon2@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon2@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(globalDir, "addon2@tests.mozilla.org"));

    executeSoon(run_test_9);
  });
}

// More hiding and revealing
async function run_test_9() {
  Services.prefs.clearUserPref("extensions.enabledScopes");

  var dest = userDir.clone();
  dest.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
  dest.remove(true);
  dest = globalDir.clone();
  dest.append(do_get_expected_addon_name("addon2@tests.mozilla.org"));
  dest.remove(true);
  addon2.version = "2.4";
  writeInstallRDFForExtension(addon2, profileDir);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, ["addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.2");
    Assert.ok(isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    Assert.equal(a1.scope, AddonManager.SCOPE_PROFILE);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.4");
    Assert.ok(isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    Assert.equal(a2.scope, AddonManager.SCOPE_PROFILE);

    Assert.equal(a3, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon3@tests.mozilla.org"));

    Assert.equal(a4, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));

    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));

    executeSoon(run_test_10);
  });
}

// Checks that a removal from one location and an addition in another location
// for the same item is handled
async function run_test_10() {
  var dest = profileDir.clone();
  dest.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
  dest.remove(true);
  addon1.version = "1.3";
  writeInstallRDFForExtension(addon1, userDir);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, ["addon1@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.notEqual(a1, null);
    Assert.equal(a1.id, "addon1@tests.mozilla.org");
    Assert.equal(a1.version, "1.3");
    Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));
    Assert.ok(isExtensionInAddonsList(userDir, a1.id));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(!hasFlag(a1.permissions, AddonManager.PERM_CAN_UPGRADE));
    Assert.equal(a1.scope, AddonManager.SCOPE_USER);

    Assert.notEqual(a2, null);
    Assert.equal(a2.id, "addon2@tests.mozilla.org");
    Assert.equal(a2.version, "2.4");
    Assert.ok(isExtensionInAddonsList(profileDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(userDir, a2.id));
    Assert.ok(!isExtensionInAddonsList(globalDir, a2.id));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UNINSTALL));
    Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_UPGRADE));
    Assert.equal(a2.scope, AddonManager.SCOPE_PROFILE);

    Assert.equal(a3, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon3@tests.mozilla.org"));

    Assert.equal(a4, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));

    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));

    executeSoon(run_test_11);
  });
}

// This should remove any remaining items
async function run_test_11() {
  var dest = userDir.clone();
  dest.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
  dest.remove(true);
  dest = profileDir.clone();
  dest.append(do_get_expected_addon_name("addon2@tests.mozilla.org"));
  dest.remove(true);

  gCachePurged = false;
  await promiseRestartManager();

  check_startup_changes(AddonManager.STARTUP_CHANGE_INSTALLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_CHANGED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_UNINSTALLED, ["addon1@tests.mozilla.org",
                                        "addon2@tests.mozilla.org"]);
  check_startup_changes(AddonManager.STARTUP_CHANGE_DISABLED, []);
  check_startup_changes(AddonManager.STARTUP_CHANGE_ENABLED, []);
  Assert.ok(gCachePurged);

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               function([a1, a2, a3, a4, a5]) {

    Assert.equal(a1, null);
    Assert.equal(a2, null);
    Assert.equal(a3, null);
    Assert.equal(a4, null);
    Assert.equal(a5, null);
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon1@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon2@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon3@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon4@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(profileDir, "addon5@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon1@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon2@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon3@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon4@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(userDir, "addon5@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(globalDir, "addon1@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(globalDir, "addon2@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(globalDir, "addon3@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(globalDir, "addon4@tests.mozilla.org"));
    Assert.ok(!isExtensionInAddonsList(globalDir, "addon5@tests.mozilla.org"));
    do_check_not_in_crash_annotation(addon1.id, addon1.version);
    do_check_not_in_crash_annotation(addon2.id, addon2.version);

    executeSoon(run_test_12);
  });
}

// Test that auto-disabling for specific scopes works
function run_test_12() {
  Services.prefs.setIntPref("extensions.autoDisableScopes", AddonManager.SCOPE_USER);

  writeInstallRDFForExtension(addon1, profileDir);
  writeInstallRDFForExtension(addon2, userDir);
  writeInstallRDFForExtension(addon3, globalDir);

  restartManager();

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org",
                               "addon3@tests.mozilla.org",
                               "addon4@tests.mozilla.org",
                               "addon5@tests.mozilla.org"],
                               callback_soon(function([a1, a2, a3, a4, a5]) {
    Assert.notEqual(a1, null);
    Assert.ok(!a1.userDisabled);
    Assert.ok(a1.seen);
    Assert.ok(a1.isActive);

    Assert.notEqual(a2, null);
    Assert.ok(a2.userDisabled);
    Assert.ok(!a2.seen);
    Assert.ok(!a2.isActive);

    Assert.notEqual(a3, null);
    Assert.ok(!a3.userDisabled);
    Assert.ok(a3.seen);
    Assert.ok(a3.isActive);

    var dest = profileDir.clone();
    dest.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
    dest.remove(true);
    dest = userDir.clone();
    dest.append(do_get_expected_addon_name("addon2@tests.mozilla.org"));
    dest.remove(true);
    dest = globalDir.clone();
    dest.append(do_get_expected_addon_name("addon3@tests.mozilla.org"));
    dest.remove(true);

    restartManager();

    Services.prefs.setIntPref("extensions.autoDisableScopes", AddonManager.SCOPE_SYSTEM);

    writeInstallRDFForExtension(addon1, profileDir);
    writeInstallRDFForExtension(addon2, userDir);
    writeInstallRDFForExtension(addon3, globalDir);

    restartManager();

    AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                                 "addon2@tests.mozilla.org",
                                 "addon3@tests.mozilla.org",
                                 "addon4@tests.mozilla.org",
                                 "addon5@tests.mozilla.org"],
                                 function([a1_2, a2_2, a3_2, a4_2, a5_2]) {
      Assert.notEqual(a1_2, null);
      Assert.ok(!a1_2.userDisabled);
      Assert.ok(a1_2.seen);
      Assert.ok(a1_2.isActive);

      Assert.notEqual(a2_2, null);
      Assert.ok(!a2_2.userDisabled);
      Assert.ok(a2_2.seen);
      Assert.ok(a2_2.isActive);

      Assert.notEqual(a3_2, null);
      Assert.ok(a3_2.userDisabled);
      Assert.ok(!a3_2.seen);
      Assert.ok(!a3_2.isActive);

      var dest2 = profileDir.clone();
      dest2.append(do_get_expected_addon_name("addon1@tests.mozilla.org"));
      dest2.remove(true);
      dest2 = userDir.clone();
      dest2.append(do_get_expected_addon_name("addon2@tests.mozilla.org"));
      dest2.remove(true);
      dest2 = globalDir.clone();
      dest2.append(do_get_expected_addon_name("addon3@tests.mozilla.org"));
      dest2.remove(true);

      restartManager();

      Services.prefs.setIntPref("extensions.autoDisableScopes", AddonManager.SCOPE_USER + AddonManager.SCOPE_SYSTEM);

      writeInstallRDFForExtension(addon1, profileDir);
      writeInstallRDFForExtension(addon2, userDir);
      writeInstallRDFForExtension(addon3, globalDir);

      restartManager();

      AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                                   "addon2@tests.mozilla.org",
                                   "addon3@tests.mozilla.org",
                                   "addon4@tests.mozilla.org",
                                   "addon5@tests.mozilla.org"],
                                   function([a1_3, a2_3, a3_3, a4_3, a5_3]) {
        Assert.notEqual(a1_3, null);
        Assert.ok(!a1_3.userDisabled);
        Assert.ok(a1_3.seen);
        Assert.ok(a1_3.isActive);

        Assert.notEqual(a2_3, null);
        Assert.ok(a2_3.userDisabled);
        Assert.ok(!a2_3.seen);
        Assert.ok(!a2_3.isActive);

        Assert.notEqual(a3_3, null);
        Assert.ok(a3_3.userDisabled);
        Assert.ok(!a3_3.seen);
        Assert.ok(!a3_3.isActive);

        executeSoon(end_test);
      });
    });
  }));
}
