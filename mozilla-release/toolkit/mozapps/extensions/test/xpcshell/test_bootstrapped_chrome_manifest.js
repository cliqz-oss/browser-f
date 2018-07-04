/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

const ADDON = {
  "install.rdf": {
    "id": "bug675371@tests.mozilla.org",
    "version": "1.0",
    "bootstrap": "true",
    "name": "Bug 675371 Test",
    "description": "Test Description",
    "targetApplications": [
      {
        "id": "xpcshell@tests.mozilla.org",
        "minVersion": "1",
        "maxVersion": "1"
      }
    ]
  },
  "chrome.manifest": `content bug675371 .`,
  "test.js": `var active = true;`,
};

add_task(async function run_test() {
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");
  await promiseStartupManager();
});

function checkActive(expected) {
  let target = { active: false };
  let load = () => {
    Services.scriptloader.loadSubScript("chrome://bug675371/content/test.js", target);
  };

  if (expected) {
    load();
  } else {
    Assert.throws(load);
  }
  equal(target.active, expected, "Manifest is active?");
}

add_task(async function test() {
  let {addon} = await AddonTestUtils.promiseInstallXPI(ADDON);

  Assert.ok(addon.isActive);

  // Tests that chrome.manifest is registered when the addon is installed.
  checkActive(true);

  addon.userDisabled = true;
  checkActive(false);

  addon.userDisabled = false;
  checkActive(true);

  await promiseShutdownManager();

  // Tests that chrome.manifest remains registered at app shutdown.
  checkActive(true);
});
