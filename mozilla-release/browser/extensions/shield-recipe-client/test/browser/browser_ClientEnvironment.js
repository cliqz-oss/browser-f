"use strict";

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/TelemetryController.jsm", this);
Cu.import("resource://gre/modules/AddonManager.jsm", this);
Cu.import("resource://testing-common/AddonTestUtils.jsm", this);
Cu.import("resource://shield-recipe-client/lib/ClientEnvironment.jsm", this);
Cu.import("resource://shield-recipe-client/lib/PreferenceExperiments.jsm", this);


add_task(async function testTelemetry() {
  await SpecialPowers.pushPrefEnv({set: [["privacy.reduceTimerPrecision", true]]});

  // setup
  await TelemetryController.submitExternalPing("testfoo", {foo: 1});
  await TelemetryController.submitExternalPing("testbar", {bar: 2});
  await TelemetryController.submitExternalPing("testfoo", {foo: 3});
  const environment = ClientEnvironment.getEnvironment();

  // Test it can access telemetry
  const telemetry = await environment.telemetry;
  is(typeof telemetry, "object", "Telemetry is accesible");

  // Test it reads different types of telemetry
  is(telemetry.testfoo.payload.foo, 3, "telemetry filters pull the latest ping from a type");
  is(telemetry.testbar.payload.bar, 2, "telemetry filters pull from submitted telemetry pings");
});

add_task(async function testUserId() {
  let environment = ClientEnvironment.getEnvironment();

  // Test that userId is available
  ok(UUID_REGEX.test(environment.userId), "userId available");

  // test that it pulls from the right preference
  await SpecialPowers.pushPrefEnv({set: [["extensions.shield-recipe-client.user_id", "fake id"]]});
  environment = ClientEnvironment.getEnvironment();
  is(environment.userId, "fake id", "userId is pulled from preferences");
});

add_task(async function testDistribution() {
  let environment = ClientEnvironment.getEnvironment();

  // distribution id defaults to "default"
  is(environment.distribution, "default", "distribution has a default value");

  // distribution id is read from a preference
  await SpecialPowers.pushPrefEnv({set: [["distribution.id", "funnelcake"]]});
  environment = ClientEnvironment.getEnvironment();
  is(environment.distribution, "funnelcake", "distribution is read from preferences");
});

const mockClassify = {country: "FR", request_time: new Date(2017, 1, 1)};
add_task(ClientEnvironment.withMockClassify(mockClassify, async function testCountryRequestTime() {
  const environment = ClientEnvironment.getEnvironment();

  // Test that country and request_time pull their data from the server.
  is(await environment.country, mockClassify.country, "country is read from the server API");
  is(
    await environment.request_time, mockClassify.request_time,
    "request_time is read from the server API"
  );
}));

add_task(async function testSync() {
  let environment = ClientEnvironment.getEnvironment();
  is(environment.syncMobileDevices, 0, "syncMobileDevices defaults to zero");
  is(environment.syncDesktopDevices, 0, "syncDesktopDevices defaults to zero");
  is(environment.syncTotalDevices, 0, "syncTotalDevices defaults to zero");
  await SpecialPowers.pushPrefEnv({
    set: [
      ["services.sync.clients.devices.mobile", 5],
      ["services.sync.clients.devices.desktop", 4],
    ],
  });
  environment = ClientEnvironment.getEnvironment();
  is(environment.syncMobileDevices, 5, "syncMobileDevices is read when set");
  is(environment.syncDesktopDevices, 4, "syncDesktopDevices is read when set");
  is(environment.syncTotalDevices, 9, "syncTotalDevices is read when set");
});

add_task(async function testDoNotTrack() {
  let environment = ClientEnvironment.getEnvironment();

  // doNotTrack defaults to false
  ok(!environment.doNotTrack, "doNotTrack has a default value");

  // doNotTrack is read from a preference
  await SpecialPowers.pushPrefEnv({set: [["privacy.donottrackheader.enabled", true]]});
  environment = ClientEnvironment.getEnvironment();
  ok(environment.doNotTrack, "doNotTrack is read from preferences");
});

add_task(async function testExperiments() {
  const active = {name: "active", expired: false};
  const expired = {name: "expired", expired: true};
  const getAll = sinon.stub(PreferenceExperiments, "getAll", async () => [active, expired]);

  const environment = ClientEnvironment.getEnvironment();
  const experiments = await environment.experiments;
  Assert.deepEqual(
    experiments.all,
    ["active", "expired"],
    "experiments.all returns all stored experiment names",
  );
  Assert.deepEqual(
    experiments.active,
    ["active"],
    "experiments.active returns all active experiment names",
  );
  Assert.deepEqual(
    experiments.expired,
    ["expired"],
    "experiments.expired returns all expired experiment names",
  );

  getAll.restore();
});

add_task(withDriver(Assert, async function testAddonsInContext(driver) {
  // Create before install so that the listener is added before startup completes.
  const startupPromise = AddonTestUtils.promiseWebExtensionStartup("normandydriver@example.com");
  const addonId = await driver.addons.install(TEST_XPI_URL);
  await startupPromise;

  const environment = ClientEnvironment.getEnvironment();
  const addons = await environment.addons;
  Assert.deepEqual(addons[addonId], {
    id: [addonId],
    name: "normandy_fixture",
    version: "1.0",
    installDate: addons[addonId].installDate,
    isActive: true,
    type: "extension",
  }, "addons should be available in context");

  await driver.addons.uninstall(addonId);
}));

add_task(async function isFirstRun() {
  await SpecialPowers.pushPrefEnv({set: [["extensions.shield-recipe-client.first_run", true]]});
  const environment = ClientEnvironment.getEnvironment();
  ok(environment.isFirstRun, "isFirstRun is read from preferences");
});
