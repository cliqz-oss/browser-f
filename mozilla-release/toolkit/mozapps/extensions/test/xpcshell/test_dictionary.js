/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// This verifies that bootstrappable add-ons can be used without restarts.
ChromeUtils.import("resource://gre/modules/Services.jsm");

Cu.importGlobalProperties(["XMLHttpRequest"]);

// Our stub hunspell engine makes things a bit flaky.
PromiseTestUtils.whitelistRejectionsGlobally(/spellCheck is undefined/);

// Enable loading extensions from the user scopes
Services.prefs.setIntPref("extensions.enabledScopes",
                          AddonManager.SCOPE_PROFILE + AddonManager.SCOPE_USER);

// The test extension uses an insecure update url.
Services.prefs.setBoolPref(PREF_EM_CHECK_UPDATE_SECURITY, false);

createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

const profileDir = gProfD.clone();
profileDir.append("extensions");

const userExtDir = gProfD.clone();
userExtDir.append("extensions2");
userExtDir.append(gAppInfo.ID);

registerDirectory("XREUSysExt", userExtDir.parent);

// Create and configure the HTTP server.
var testserver = AddonTestUtils.createHttpServer({hosts: ["example.com"]});

// register files with server
testserver.registerDirectory("/data/", do_get_file("data"));

const ADDONS = {
  test_dictionary: {
    "install.rdf": {
      "id": "ab-CD@dictionaries.addons.mozilla.org",
      "type": "64",
      "name": "Test Dictionary",
    },
    "dictionaries/ab-CD.dic": "1\ntest1\n",
    "chrome.manifest": "content dict ./\n"
  },
  test_dictionary_3: {
    "install.rdf": {
      "id": "ab-CD@dictionaries.addons.mozilla.org",
      "version": "2.0",
      "type": "64",
      "name": "Test Dictionary",
    }
  },
  test_dictionary_4: {
    "install.rdf": {
      "id": "ef@dictionaries.addons.mozilla.org",
      "version": "2.0",
      "name": "Test Dictionary ef",
    }
  },
  test_dictionary_5: {
    "install.rdf": {
      "id": "gh@dictionaries.addons.mozilla.org",
      "version": "2.0",
      "type": "64",
      "name": "Test Dictionary gh",
    }
  },
};

const ID_DICT = "ab-CD@dictionaries.addons.mozilla.org";
const XPI_DICT = AddonTestUtils.createTempXPIFile(ADDONS.test_dictionary);

const XPIS = {};
for (let [name, files] of Object.entries(ADDONS)) {
  XPIS[name] = AddonTestUtils.createTempXPIFile(files);
  testserver.registerFile(`/addons/${name}.xpi`, XPIS[name]);
}

/**
 * This object is both a factory and an mozISpellCheckingEngine implementation (so, it
 * is de-facto a service). It's also an interface requestor that gives out
 * itself when asked for mozISpellCheckingEngine.
 */
var HunspellEngine = {
  dictionaryURIs: new Map(),
  listener: null,

  QueryInterface: ChromeUtils.generateQI(["nsIFactory", "mozISpellCheckingEngine"]),
  createInstance: function hunspell_ci(outer, iid) {
    if (outer)
      throw Cr.NS_ERROR_NO_AGGREGATION;
    return this.QueryInterface(iid);
  },
  lockFactory: function hunspell_lockf(lock) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  addDictionary(lang, uri) {
    this.dictionaryURIs.set(lang, uri);
    if (this.listener)
      this.listener("addDictionary");
  },

  removeDictionary(lang, uri) {
    this.dictionaryURIs.delete(lang);
    if (this.listener)
      this.listener("removeDictionary");
  },

  getInterface: function hunspell_gi(iid) {
    if (iid.equals(Ci.mozISpellCheckingEngine))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  contractID: "@mozilla.org/spellchecker/engine;1",
  classID: Components.ID("{6f3c63bc-a4fd-449b-9a58-a2d9bd972cce}"),

  activate: function hunspell_activate() {
    this.origClassID = Components.manager.nsIComponentRegistrar
      .contractIDToCID(this.contractID);
    this.origFactory = Components.manager
      .getClassObject(Cc[this.contractID],
                      Ci.nsIFactory);

    Components.manager.nsIComponentRegistrar
      .unregisterFactory(this.origClassID, this.origFactory);
    Components.manager.nsIComponentRegistrar.registerFactory(this.classID,
      "Test hunspell", this.contractID, this);
  },

  deactivate: function hunspell_deactivate() {
    Components.manager.nsIComponentRegistrar.unregisterFactory(this.classID, this);
    Components.manager.nsIComponentRegistrar.registerFactory(this.origClassID,
      "Hunspell", this.contractID, this.origFactory);
  },

  isDictionaryEnabled: function hunspell_isDictionaryEnabled(name) {
    let uri = this.dictionaryURIs.get(name.replace(/\.dic$/, ""));
    if (!uri) {
      return false;
    }
    try {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", uri.spec.replace(/\.aff$/, ".dic"), false);
      xhr.send();
      return true;
    } catch (e) {
      Cu.reportError(e);
    }
    return false;
  }
};

add_task(async function setup() {
  await promiseStartupManager();
});

// Tests that installing doesn't require a restart
add_task(async function test_1() {
  prepare_test({ }, [
    "onNewInstall"
  ]);

  HunspellEngine.activate();

  let install = await AddonManager.getInstallForFile(XPI_DICT);
  ensure_test_completed();

  notEqual(install, null);
  equal(install.type, "dictionary");
  equal(install.version, "1.0");
  equal(install.name, "Test Dictionary");
  equal(install.state, AddonManager.STATE_DOWNLOADED);
  equal(install.addon.operationsRequiringRestart &
               AddonManager.OP_NEEDS_RESTART_INSTALL, 0);
  do_check_not_in_crash_annotation(ID_DICT, "1.0");

  await new Promise(resolve => {
    prepare_test({
      [ID_DICT]: [
        ["onInstalling", false],
        "onInstalled"
      ]
    }, [
      "onInstallStarted",
      "onInstallEnded",
    ], function() {
      HunspellEngine.listener = function(aEvent) {
        HunspellEngine.listener = null;
        equal(aEvent, "addDictionary");
        resolve();
      };
    });
    install.install();
  });

  let installs = await AddonManager.getAllInstalls();
  // There should be no active installs now since the install completed and
  // doesn't require a restart.
  equal(installs.length, 0);

  let addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_in_crash_annotation(ID_DICT, "1.0");

  let chromeReg = Cc["@mozilla.org/chrome/chrome-registry;1"].
                  getService(Ci.nsIChromeRegistry);
  try {
    chromeReg.convertChromeURL(NetUtil.newURI("chrome://dict/content/dict.xul"));
    do_throw("Chrome manifest should not have been registered");
  } catch (e) {
    // Expected the chrome url to not be registered
  }
});

// Tests that disabling doesn't require a restart
add_task(async function test_2() {
  let addon = await AddonManager.getAddonByID(ID_DICT);
  prepare_test({
    [ID_DICT]: [
      ["onDisabling", false],
      "onDisabled"
    ]
  });

  equal(addon.operationsRequiringRestart &
               AddonManager.OP_NEEDS_RESTART_DISABLE, 0);
  await addon.disable();
  ensure_test_completed();

  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(addon.userDisabled);
  ok(!addon.isActive);
  ok(!HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_not_in_crash_annotation(ID_DICT, "1.0");

  addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(addon.userDisabled);
  ok(!addon.isActive);
});

// Test that restarting doesn't accidentally re-enable
add_task(async function test_3() {
  await promiseShutdownManager();
  ok(!HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  await promiseStartupManager();

  ok(!HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_not_in_crash_annotation(ID_DICT, "1.0");

  let addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(addon.userDisabled);
  ok(!addon.isActive);
});

// Tests that enabling doesn't require a restart
add_task(async function test_4() {
  let addon = await AddonManager.getAddonByID(ID_DICT);
  prepare_test({
    [ID_DICT]: [
      ["onEnabling", false],
      "onEnabled"
    ]
  });

  equal(addon.operationsRequiringRestart &
               AddonManager.OP_NEEDS_RESTART_ENABLE, 0);
  await addon.enable();
  ensure_test_completed();

  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_in_crash_annotation(ID_DICT, "1.0");

  addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
});

// Tests that a restart shuts down and restarts the add-on
add_task(async function test_5() {
  await promiseShutdownManager();

  // We don't unregister dictionaries at app shutdown, so the dictionary
  // will still be registered at this point.
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_not_in_crash_annotation(ID_DICT, "1.0");

  await promiseStartupManager();

  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_in_crash_annotation(ID_DICT, "1.0");

  let addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
});

// Tests that uninstalling doesn't require a restart
add_task(async function test_7() {
  let addon = await AddonManager.getAddonByID(ID_DICT);
  prepare_test({
    [ID_DICT]: [
      ["onUninstalling", false],
      "onUninstalled"
    ]
  });

  equal(addon.operationsRequiringRestart &
               AddonManager.OP_NEEDS_RESTART_UNINSTALL, 0);
  await addon.uninstall();

  ensure_test_completed();

  ok(!HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_not_in_crash_annotation(ID_DICT, "1.0");

  addon = await AddonManager.getAddonByID(ID_DICT);
  equal(addon, null);

  await promiseRestartManager();

  addon = await AddonManager.getAddonByID(ID_DICT);
  equal(addon, null);
});

// Test that a bootstrapped extension dropped into the profile loads properly
// on startup and doesn't cause an EM restart
add_task(async function test_8() {
  await promiseShutdownManager();
  await AddonTestUtils.manuallyInstall(XPI_DICT);
  await promiseStartupManager();

  let addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_in_crash_annotation(ID_DICT, "1.0");
});

// Test that items detected as removed during startup get removed properly
add_task(async function test_9() {
  await promiseShutdownManager();
  await AddonTestUtils.manuallyUninstall(profileDir, ID_DICT);
  await promiseStartupManager();

  let addon = await AddonManager.getAddonByID(ID_DICT);
  equal(addon, null);
  do_check_not_in_crash_annotation(ID_DICT, "1.0");
});


// Tests that bootstrapped extensions are correctly loaded even if the app is
// upgraded at the same time
add_task(async function test_12() {
  await promiseShutdownManager();
  await AddonTestUtils.manuallyInstall(XPI_DICT);
  await promiseStartupManager();

  let addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_in_crash_annotation(ID_DICT, "1.0");

  await addon.uninstall();
});


// Tests that bootstrapped extensions don't get loaded when in safe mode
add_task(async function test_16() {
  await promiseRestartManager();
  await promiseInstallFile(XPI_DICT);

  let addon = await AddonManager.getAddonByID(ID_DICT);
  // Should have installed and started
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));

  await promiseShutdownManager();

  // We don't unregister dictionaries at app shutdown, so the dictionary
  // will still be registered at this point.
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));

  HunspellEngine.dictionaryURIs.delete("ab-CD");

  gAppInfo.inSafeMode = true;
  await promiseStartupManager();

  addon = await AddonManager.getAddonByID(ID_DICT);
  // Should still be stopped
  ok(!HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  ok(!addon.isActive);

  await promiseShutdownManager();
  gAppInfo.inSafeMode = false;
  await promiseStartupManager();

  // Should have started
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));

  addon = await AddonManager.getAddonByID(ID_DICT);
  await addon.uninstall();
});

// Check that a bootstrapped extension in a non-profile location is loaded
add_task(async function test_17() {
  await promiseShutdownManager();
  await AddonTestUtils.manuallyInstall(XPI_DICT, userExtDir);
  await promiseStartupManager();

  let addon = await AddonManager.getAddonByID(ID_DICT);
  // Should have installed and started
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(addon.isActive);

  await AddonTestUtils.manuallyUninstall(userExtDir, ID_DICT);
  await promiseRestartManager();
});

// Tests that installing from a URL doesn't require a restart
add_task(async function test_23() {
  prepare_test({ }, [
    "onNewInstall"
  ]);

  let url = "http://example.com/addons/test_dictionary.xpi";
  let install = await AddonManager.getInstallForURL(url, "application/x-xpinstall");
  ensure_test_completed();

  notEqual(install, null);

  await new Promise(resolve => {
    prepare_test({ }, [
      "onDownloadStarted",
      "onDownloadEnded"
    ], function() {
      equal(install.type, "dictionary");
      equal(install.version, "1.0");
      equal(install.name, "Test Dictionary");
      equal(install.state, AddonManager.STATE_DOWNLOADED);
      equal(install.addon.operationsRequiringRestart &
                   AddonManager.OP_NEEDS_RESTART_INSTALL, 0);
      do_check_not_in_crash_annotation(ID_DICT, "1.0");

      prepare_test({
        [ID_DICT]: [
          ["onInstalling", false],
          "onInstalled"
        ]
      }, [
        "onInstallStarted",
        "onInstallEnded",
      ], resolve);
    });
    install.install();
  });

  let installs = await AddonManager.getAllInstalls();
  // There should be no active installs now since the install completed and
  // doesn't require a restart.
  equal(installs.length, 0);

  let addon = await AddonManager.getAddonByID(ID_DICT);
  notEqual(addon, null);
  equal(addon.version, "1.0");
  ok(!addon.appDisabled);
  ok(!addon.userDisabled);
  ok(addon.isActive);
  ok(HunspellEngine.isDictionaryEnabled("ab-CD.dic"));
  do_check_in_crash_annotation(ID_DICT, "1.0");

  await promiseRestartManager();

  addon = await AddonManager.getAddonByID(ID_DICT);
  await addon.uninstall();
});

// Tests that an update check from a bootstrappable add-on to a bootstrappable add-on works
add_task(async function test_29() {
  await promiseRestartManager();

  await promiseWriteInstallRDFForExtension({
    id: "gh@dictionaries.addons.mozilla.org",
    version: "1.0",
    type: "64",
    updateURL: "http://example.com/data/test_dictionary.json",
    targetApplications: [{
      id: "xpcshell@tests.mozilla.org",
      minVersion: "1",
      maxVersion: "1"
    }],
    name: "Test Dictionary gh",
  }, profileDir);

  await promiseRestartManager();

  await new Promise(resolve => {
    prepare_test({
      "gh@dictionaries.addons.mozilla.org": [
        ["onInstalling", false /* = no restart */],
        ["onInstalled", false]
      ]
    }, [
      "onNewInstall",
      "onDownloadStarted",
      "onDownloadEnded",
      "onInstallStarted",
      "onInstallEnded"
    ], resolve);

    AddonManagerPrivate.backgroundUpdateCheck();
  });

  let addon = await AddonManager.getAddonByID("gh@dictionaries.addons.mozilla.org");
  notEqual(addon, null);
  equal(addon.version, "2.0");
  equal(addon.type, "dictionary");

  await new Promise(resolve => {
    prepare_test({
      "gh@dictionaries.addons.mozilla.org": [
        ["onUninstalling", false],
        ["onUninstalled", false],
      ]
    }, [
    ], resolve);

    addon.uninstall();
  });
});
