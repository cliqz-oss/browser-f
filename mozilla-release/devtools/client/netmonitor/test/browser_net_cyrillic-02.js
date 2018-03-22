/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests if cyrillic text is rendered correctly in the source editor
 * when loaded directly from an HTML page.
 */

add_task(function* () {
  let { tab, monitor } = yield initNetMonitor(CYRILLIC_URL);
  info("Starting test... ");

  let { document, store, windowRequire } = monitor.panelWin;
  let {
    getDisplayedRequests,
    getSortedRequests,
  } = windowRequire("devtools/client/netmonitor/src/selectors/index");

  let wait = waitForNetworkEvents(monitor, 1);
  tab.linkedBrowser.reload();
  yield wait;

  let requestItem = document.querySelectorAll(".request-list-item")[0];
  let requestsListStatus = requestItem.querySelector(".requests-list-status");
  requestItem.scrollIntoView();
  EventUtils.sendMouseEvent({ type: "mouseover" }, requestsListStatus);
  yield waitUntil(() => requestsListStatus.title);

  verifyRequestItemTarget(
    document,
    getDisplayedRequests(store.getState()),
    getSortedRequests(store.getState()).get(0),
    "GET",
    CYRILLIC_URL,
    {
      status: 200,
      statusText: "OK"
    });

  wait = waitForDOM(document, "#headers-panel");
  EventUtils.sendMouseEvent({ type: "mousedown" },
    document.querySelectorAll(".request-list-item")[0]);
  yield wait;
  wait = waitForDOM(document, "#response-panel .CodeMirror-code");
  EventUtils.sendMouseEvent({ type: "click" },
    document.querySelector("#response-tab"));
  yield wait;

  // CodeMirror will only load lines currently in view to the DOM. getValue()
  // retrieves all lines pending render after a user begins scrolling.
  let text = document.querySelector(".CodeMirror").CodeMirror.getValue();

  ok(text.includes("\u0411\u0440\u0430\u0442\u0430\u043d"),
    "The text shown in the source editor is correct.");

  return teardown(monitor);
});
