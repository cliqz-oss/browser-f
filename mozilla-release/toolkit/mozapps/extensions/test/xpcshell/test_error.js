/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Tests that various error conditions are handled correctly

ChromeUtils.import("resource://gre/modules/Services.jsm");

const profileDir = gProfD.clone();
profileDir.append("extensions");

const ADDONS = {
  test_bug567173: {
    "install.rdf": {
      "id": "bug567173",
    }
  },
};

async function run_test() {
  do_test_pending();
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

  await promiseStartupManager();

  run_test_1();
}

// Checks that a local file validates ok
async function run_test_1() {
  let install = await AddonManager.getInstallForFile(do_get_file("data/unsigned.xpi"));
  Assert.notEqual(install, null);
  Assert.equal(install.state, AddonManager.STATE_DOWNLOADED);
  Assert.equal(install.error, 0);

  install.cancel();

  run_test_2();
}

// Checks that a corrupt file shows an error
async function run_test_2() {
  let install = await AddonManager.getInstallForFile(do_get_file("data/corrupt.xpi"));
  Assert.notEqual(install, null);
  Assert.equal(install.state, AddonManager.STATE_DOWNLOAD_FAILED);
  Assert.equal(install.error, AddonManager.ERROR_CORRUPT_FILE);

  run_test_3();
}

// Checks that an empty file shows an error
async function run_test_3() {
  let install = await AddonManager.getInstallForFile(do_get_file("data/empty.xpi"));
  Assert.notEqual(install, null);
  Assert.equal(install.state, AddonManager.STATE_DOWNLOAD_FAILED);
  Assert.equal(install.error, AddonManager.ERROR_CORRUPT_FILE);

  run_test_4();
}

// Checks that a file that doesn't match its hash shows an error
async function run_test_4() {
  let url = Services.io.newFileURI(do_get_file("data/unsigned.xpi")).spec;
  let install = await AddonManager.getInstallForURL(url, "application/x-xpinstall", "sha1:foo");
  Assert.notEqual(install, null);
  Assert.equal(install.state, AddonManager.STATE_DOWNLOAD_FAILED);
  Assert.equal(install.error, AddonManager.ERROR_INCORRECT_HASH);

  run_test_5();
}

// Checks that a file that doesn't exist shows an error
async function run_test_5() {
  let file = do_get_file("data");
  file.append("missing.xpi");
  let install = await AddonManager.getInstallForFile(file);
  Assert.notEqual(install, null);
  Assert.equal(install.state, AddonManager.STATE_DOWNLOAD_FAILED);
  Assert.equal(install.error, AddonManager.ERROR_NETWORK_FAILURE);

  run_test_6();
}

// Checks that an add-on with an illegal ID shows an error
async function run_test_6() {
  let xpi = await AddonTestUtils.createTempXPIFile(ADDONS.test_bug567173);
  let install = await AddonManager.getInstallForFile(xpi);
  Assert.notEqual(install, null);
  Assert.equal(install.state, AddonManager.STATE_DOWNLOAD_FAILED);
  Assert.equal(install.error, AddonManager.ERROR_CORRUPT_FILE);

  executeSoon(do_test_finished);
}
