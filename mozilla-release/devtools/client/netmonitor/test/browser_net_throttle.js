/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Network throttling integration test.

"use strict";

add_task(function* () {
  yield throttleTest(true);
  yield throttleTest(false);
});

function* throttleTest(actuallyThrottle) {
  requestLongerTimeout(2);

  let { monitor } = yield initNetMonitor(SIMPLE_URL);
  let { store, windowRequire, connector } = monitor.panelWin;
  let { ACTIVITY_TYPE } = windowRequire("devtools/client/netmonitor/src/constants");
  let { setPreferences, triggerActivity } = connector;
  let {
    getSortedRequests,
  } = windowRequire("devtools/client/netmonitor/src/selectors/index");

  info("Starting test... (actuallyThrottle = " + actuallyThrottle + ")");

  // When throttling, must be smaller than the length of the content
  // of SIMPLE_URL in bytes.
  const size = actuallyThrottle ? 200 : 0;

  const request = {
    "NetworkMonitor.throttleData": {
      latencyMean: 0,
      latencyMax: 0,
      downloadBPSMean: size,
      downloadBPSMax: size,
      uploadBPSMean: 10000,
      uploadBPSMax: 10000,
    },
  };

  info("sending throttle request");
  yield new Promise((resolve) => {
    setPreferences(request, response => {
      resolve(response);
    });
  });

  let wait = waitForNetworkEvents(monitor, 1);
  yield triggerActivity(ACTIVITY_TYPE.RELOAD.WITH_CACHE_DISABLED);
  yield wait;

  yield waitUntil(() => {
    let requestItem = getSortedRequests(store.getState()).get(0);
    return requestItem && requestItem.eventTimings;
  });

  let requestItem = getSortedRequests(store.getState()).get(0);
  const reportedOneSecond = requestItem.eventTimings.timings.receive > 1000;
  if (actuallyThrottle) {
    ok(reportedOneSecond, "download reported as taking more than one second");
  } else {
    ok(!reportedOneSecond, "download reported as taking less than one second");
  }

  yield teardown(monitor);
}
