/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

_("Test that node reassignment happens correctly using the FxA identity mgr.");
// The node-reassignment logic is quite different for FxA than for the legacy
// provider.  In particular, there's no special request necessary for
// reassignment - it comes from the token server - so we need to ensure the
// Fxa cluster manager grabs a new token.

Cu.import("resource://gre/modules/Log.jsm");
Cu.import("resource://services-common/rest.js");
Cu.import("resource://services-sync/constants.js");
Cu.import("resource://services-sync/service.js");
Cu.import("resource://services-sync/status.js");
Cu.import("resource://services-sync/util.js");
Cu.import("resource://testing-common/services/sync/rotaryengine.js");
Cu.import("resource://services-sync/browserid_identity.js");
Cu.import("resource://testing-common/services/sync/utils.js");

Service.engineManager.clear();

function run_test() {
  Log.repository.getLogger("Sync.AsyncResource").level = Log.Level.Trace;
  Log.repository.getLogger("Sync.ErrorHandler").level  = Log.Level.Trace;
  Log.repository.getLogger("Sync.Resource").level      = Log.Level.Trace;
  Log.repository.getLogger("Sync.RESTRequest").level   = Log.Level.Trace;
  Log.repository.getLogger("Sync.Service").level       = Log.Level.Trace;
  Log.repository.getLogger("Sync.SyncScheduler").level = Log.Level.Trace;
  initTestLogging();

  Service.engineManager.register(RotaryEngine);

  // Setup the FxA identity manager and cluster manager.
  Status.__authManager = Service.identity = new BrowserIDManager();
  Service._clusterManager = Service.identity.createClusterManager(Service);

  // None of the failures in this file should result in a UI error.
  function onUIError() {
    do_throw("Errors should not be presented in the UI.");
  }
  Svc.Obs.add("weave:ui:login:error", onUIError);
  Svc.Obs.add("weave:ui:sync:error", onUIError);

  run_next_test();
}


// API-compatible with SyncServer handler. Bind `handler` to something to use
// as a ServerCollection handler.
function handleReassign(handler, req, resp) {
  resp.setStatusLine(req.httpVersion, 401, "Node reassignment");
  resp.setHeader("Content-Type", "application/json");
  let reassignBody = JSON.stringify({error: "401inator in place"});
  resp.bodyOutputStream.write(reassignBody, reassignBody.length);
}

var numTokenRequests = 0;

function prepareServer(cbAfterTokenFetch) {
  let config = makeIdentityConfig({username: "johndoe"});
  let server = new SyncServer();
  server.registerUser("johndoe");
  server.start();

  // Set the token endpoint for the initial token request that's done implicitly
  // via configureIdentity.
  config.fxaccount.token.endpoint = server.baseURI + "1.1/johndoe";
  // And future token fetches will do magic around numReassigns.
  let numReassigns = 0;
  return configureIdentity(config).then(() => {
    Service.identity._tokenServerClient = {
      getTokenFromBrowserIDAssertion: function(uri, assertion, cb) {
        // Build a new URL with trailing zeros for the SYNC_VERSION part - this
        // will still be seen as equivalent by the test server, but different
        // by sync itself.
        numReassigns += 1;
        let trailingZeros = new Array(numReassigns + 1).join('0');
        let token = config.fxaccount.token;
        token.endpoint = server.baseURI + "1.1" + trailingZeros + "/johndoe";
        token.uid = config.username;
        numTokenRequests += 1;
        cb(null, token);
        if (cbAfterTokenFetch) {
          cbAfterTokenFetch();
        }
      },
    };
    Service.clusterURL = config.fxaccount.token.endpoint;
    return server;
  });
}

function getReassigned() {
  try {
    return Services.prefs.getBoolPref("services.sync.lastSyncReassigned");
  } catch (ex if (ex.result == Cr.NS_ERROR_UNEXPECTED)) {
    return false;
  } catch (ex) {
    do_throw("Got exception retrieving lastSyncReassigned: " +
             Utils.exceptionStr(ex));
  }
}

/**
 * Make a test request to `url`, then watch the result of two syncs
 * to ensure that a node request was made.
 * Runs `between` between the two. This can be used to undo deliberate failure
 * setup, detach observers, etc.
 */
function syncAndExpectNodeReassignment(server, firstNotification, between,
                                       secondNotification, url) {
  _("Starting syncAndExpectNodeReassignment\n");
  let deferred = Promise.defer();
  function onwards() {
    let numTokenRequestsBefore;
    function onFirstSync() {
      _("First sync completed.");
      Svc.Obs.remove(firstNotification, onFirstSync);
      Svc.Obs.add(secondNotification, onSecondSync);

      do_check_eq(Service.clusterURL, "");

      // Track whether we fetched a new token.
      numTokenRequestsBefore = numTokenRequests;

      // Allow for tests to clean up error conditions.
      between();
    }
    function onSecondSync() {
      _("Second sync completed.");
      Svc.Obs.remove(secondNotification, onSecondSync);
      Service.scheduler.clearSyncTriggers();

      // Make absolutely sure that any event listeners are done with their work
      // before we proceed.
      waitForZeroTimer(function () {
        _("Second sync nextTick.");
        do_check_eq(numTokenRequests, numTokenRequestsBefore + 1, "fetched a new token");
        Service.startOver();
        server.stop(deferred.resolve);
      });
    }

    Svc.Obs.add(firstNotification, onFirstSync);
    Service.sync();
  }

  // Make sure that it works!
  _("Making request to " + url + " which should 401");
  let request = new RESTRequest(url);
  request.get(function () {
    do_check_eq(request.response.status, 401);
    Utils.nextTick(onwards);
  });
  yield deferred.promise;
}

add_task(function test_momentary_401_engine() {
  _("Test a failure for engine URLs that's resolved by reassignment.");
  let server = yield prepareServer();
  let john   = server.user("johndoe");

  _("Enabling the Rotary engine.");
  let engine = Service.engineManager.get("rotary");
  engine.enabled = true;

  // We need the server to be correctly set up prior to experimenting. Do this
  // through a sync.
  let global = {syncID: Service.syncID,
                storageVersion: STORAGE_VERSION,
                rotary: {version: engine.version,
                         syncID:  engine.syncID}}
  john.createCollection("meta").insert("global", global);

  _("First sync to prepare server contents.");
  Service.sync();

  _("Setting up Rotary collection to 401.");
  let rotary = john.createCollection("rotary");
  let oldHandler = rotary.collectionHandler;
  rotary.collectionHandler = handleReassign.bind(this, undefined);

  // We want to verify that the clusterURL pref has been cleared after a 401
  // inside a sync. Flag the Rotary engine to need syncing.
  john.collection("rotary").timestamp += 1000;

  function between() {
    _("Undoing test changes.");
    rotary.collectionHandler = oldHandler;

    function onLoginStart() {
      // lastSyncReassigned shouldn't be cleared until a sync has succeeded.
      _("Ensuring that lastSyncReassigned is still set at next sync start.");
      Svc.Obs.remove("weave:service:login:start", onLoginStart);
      do_check_true(getReassigned());
    }

    _("Adding observer that lastSyncReassigned is still set on login.");
    Svc.Obs.add("weave:service:login:start", onLoginStart);
  }

  yield syncAndExpectNodeReassignment(server,
                                      "weave:service:sync:finish",
                                      between,
                                      "weave:service:sync:finish",
                                      Service.storageURL + "rotary");
});

// This test ends up being a failing info fetch *after we're already logged in*.
add_task(function test_momentary_401_info_collections_loggedin() {
  _("Test a failure for info/collections after login that's resolved by reassignment.");
  let server = yield prepareServer();

  _("First sync to prepare server contents.");
  Service.sync();

  _("Arrange for info/collections to return a 401.");
  let oldHandler = server.toplevelHandlers.info;
  server.toplevelHandlers.info = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.info = oldHandler;
  }

  do_check_true(Service.isLoggedIn, "already logged in");

  yield syncAndExpectNodeReassignment(server,
                                      "weave:service:sync:error",
                                      undo,
                                      "weave:service:sync:finish",
                                      Service.infoURL);
});

// This test ends up being a failing info fetch *before we're logged in*.
// In this case we expect to recover during the login phase - so the first
// sync succeeds.
add_task(function test_momentary_401_info_collections_loggedout() {
  _("Test a failure for info/collections before login that's resolved by reassignment.");

  let oldHandler;
  let sawTokenFetch = false;

  function afterTokenFetch() {
    // After a single token fetch, we undo our evil handleReassign hack, so
    // the next /info request returns the collection instead of a 401
    server.toplevelHandlers.info = oldHandler;
    sawTokenFetch = true;
  }

  let server = yield prepareServer(afterTokenFetch);

  // Return a 401 for the next /info request - it will be reset immediately
  // after a new token is fetched.
  oldHandler = server.toplevelHandlers.info
  server.toplevelHandlers.info = handleReassign;

  do_check_false(Service.isLoggedIn, "not already logged in");

  Service.sync();
  do_check_eq(Status.sync, SYNC_SUCCEEDED, "sync succeeded");
  // sync was successful - check we grabbed a new token.
  do_check_true(sawTokenFetch, "a new token was fetched by this test.")
  // and we are done.
  Service.startOver();
  let deferred = Promise.defer();
  server.stop(deferred.resolve);
  yield deferred.promise;
});

// This test ends up being a failing meta/global fetch *after we're already logged in*.
add_task(function test_momentary_401_storage_loggedin() {
  _("Test a failure for any storage URL after login that's resolved by" +
    "reassignment.");
  let server = yield prepareServer();

  _("First sync to prepare server contents.");
  Service.sync();

  _("Arrange for meta/global to return a 401.");
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.storage = oldHandler;
  }

  do_check_true(Service.isLoggedIn, "already logged in");

  yield syncAndExpectNodeReassignment(server,
                                      "weave:service:sync:error",
                                      undo,
                                      "weave:service:sync:finish",
                                      Service.storageURL + "meta/global");
});

// This test ends up being a failing meta/global fetch *before we've logged in*.
add_task(function test_momentary_401_storage_loggedout() {
  _("Test a failure for any storage URL before login, not just engine parts. " +
    "Resolved by reassignment.");
  let server = yield prepareServer();

  // Return a 401 for all storage requests.
  let oldHandler = server.toplevelHandlers.storage;
  server.toplevelHandlers.storage = handleReassign;

  function undo() {
    _("Undoing test changes.");
    server.toplevelHandlers.storage = oldHandler;
  }

  do_check_false(Service.isLoggedIn, "already logged in");

  yield syncAndExpectNodeReassignment(server,
                                      "weave:service:login:error",
                                      undo,
                                      "weave:service:sync:finish",
                                      Service.storageURL + "meta/global");
});

