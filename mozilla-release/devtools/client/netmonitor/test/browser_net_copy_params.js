/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests whether copying a request item's parameters works.
 */

add_task(async function() {
  const { tab, monitor } = await initNetMonitor(PARAMS_URL);
  info("Starting test... ");

  const { document, store, windowRequire } = monitor.panelWin;
  const Actions = windowRequire("devtools/client/netmonitor/src/actions/index");

  store.dispatch(Actions.batchEnable(false));

  // Execute requests.
  await performRequests(monitor, tab, 7);

  await testCopyUrlParamsHidden(0, false);
  await testCopyUrlParams(0, "a");
  await testCopyPostDataHidden(0, false);
  await testCopyPostData(0, "{ \"foo\": \"bar\" }");

  await testCopyUrlParamsHidden(1, false);
  await testCopyUrlParams(1, "a=b");
  await testCopyPostDataHidden(1, false);
  await testCopyPostData(1, "{ \"foo\": \"bar\" }");

  await testCopyUrlParamsHidden(2, false);
  await testCopyUrlParams(2, "a=b");
  await testCopyPostDataHidden(2, false);
  await testCopyPostData(2, "foo=bar");

  await testCopyUrlParamsHidden(3, false);
  await testCopyUrlParams(3, "a");
  await testCopyPostDataHidden(3, false);
  await testCopyPostData(3, "{ \"foo\": \"bar\" }");

  await testCopyUrlParamsHidden(4, false);
  await testCopyUrlParams(4, "a=b");
  await testCopyPostDataHidden(4, false);
  await testCopyPostData(4, "{ \"foo\": \"bar\" }");

  await testCopyUrlParamsHidden(5, false);
  await testCopyUrlParams(5, "a=b");
  await testCopyPostDataHidden(5, false);
  await testCopyPostData(5, "?foo=bar");

  await testCopyUrlParamsHidden(6, true);
  await testCopyPostDataHidden(6, true);

  return teardown(monitor);

  function testCopyUrlParamsHidden(index, hidden) {
    EventUtils.sendMouseEvent({ type: "mousedown" },
      document.querySelectorAll(".request-list-item")[index]);
    EventUtils.sendMouseEvent({ type: "contextmenu" },
      document.querySelectorAll(".request-list-item")[index]);
    const copyUrlParamsNode = monitor.panelWin.parent.document
      .querySelector("#request-list-context-copy-url-params");
    is(!!copyUrlParamsNode, !hidden,
      "The \"Copy URL Parameters\" context menu item should" + (hidden ? " " : " not ") +
        "be hidden.");
  }

  async function testCopyUrlParams(index, queryString) {
    EventUtils.sendMouseEvent({ type: "mousedown" },
      document.querySelectorAll(".request-list-item")[index]);
    EventUtils.sendMouseEvent({ type: "contextmenu" },
      document.querySelectorAll(".request-list-item")[index]);
    await waitForClipboardPromise(function setup() {
      monitor.panelWin.parent.document
        .querySelector("#request-list-context-copy-url-params").click();
    }, queryString);
    ok(true, "The url query string copied from the selected item is correct.");
  }

  function testCopyPostDataHidden(index, hidden) {
    EventUtils.sendMouseEvent({ type: "mousedown" },
      document.querySelectorAll(".request-list-item")[index]);
    EventUtils.sendMouseEvent({ type: "contextmenu" },
      document.querySelectorAll(".request-list-item")[index]);
    const copyPostDataNode = monitor.panelWin.parent.document
      .querySelector("#request-list-context-copy-post-data");
    is(!!copyPostDataNode, !hidden,
      "The \"Copy POST Data\" context menu item should" + (hidden ? " " : " not ") +
        "be hidden.");
  }

  async function testCopyPostData(index, postData) {
    // Wait for formDataSections and requestPostData state are ready in redux store
    // since copyPostData API needs to read these state.
    await waitUntil(() => {
      const { requests } = store.getState().requests;
      const actIDs = [...requests.keys()];
      const { formDataSections, requestPostData } = requests.get(actIDs[index]);
      return formDataSections && requestPostData;
    });
    EventUtils.sendMouseEvent({ type: "mousedown" },
      document.querySelectorAll(".request-list-item")[index]);
    EventUtils.sendMouseEvent({ type: "contextmenu" },
      document.querySelectorAll(".request-list-item")[index]);
    await waitForClipboardPromise(function setup() {
      monitor.panelWin.parent.document
        .querySelector("#request-list-context-copy-post-data").click();
    }, postData);
    ok(true, "The post data string copied from the selected item is correct.");
  }
});
