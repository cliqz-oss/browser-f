/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test showing/hiding columns.
 */
add_task(async function() {
  const { monitor, tab } = await initNetMonitor(SIMPLE_URL);
  info("Starting test... ");

  const { document, store, parent, connector, windowRequire } = monitor.panelWin;
  const { requestData } = connector;
  const {
    getSortedRequests,
  } = windowRequire("devtools/client/netmonitor/src/selectors/index");

  const wait = waitForNetworkEvents(monitor, 1);
  tab.linkedBrowser.loadURI(SIMPLE_URL);
  await wait;

  const item = getSortedRequests(store.getState()).get(0);
  ok(item.responseHeadersAvailable, "headers are available for lazily fetching");

  if (item.responseHeadersAvailable && !item.responseHeaders) {
    await requestData(item.id, "responseHeaders");
  }

  const requestsContainer = document.querySelector(".requests-list-contents");
  ok(requestsContainer, "Container element exists as expected.");
  const headers = document.querySelector(".requests-list-headers");

  let columns = store.getState().ui.columns;
  for (const column in columns) {
    if (columns[column]) {
      await testVisibleColumnContextMenuItem(column, document, parent);
      testColumnsAlignment(headers, requestsContainer);
      await testHiddenColumnContextMenuItem(column, document, parent);
    } else {
      await testHiddenColumnContextMenuItem(column, document, parent);
      testColumnsAlignment(headers, requestsContainer);
      await testVisibleColumnContextMenuItem(column, document, parent);
    }
  }

  columns = store.getState().ui.columns;
  for (const column in columns) {
    if (columns[column]) {
      await testVisibleColumnContextMenuItem(column, document, parent);
      // Right click on the white-space for the context menu to appear
      // and toggle column visibility
      await testWhiteSpaceContextMenuItem(column, document, parent);
    }
  }
});

async function testWhiteSpaceContextMenuItem(column, document, parent) {
  ok(!document.querySelector(`#requests-list-${column}-button`),
     `Column ${column} should be hidden`);

  info(`Right clicking on white-space in the header to get the context menu`);
  EventUtils.sendMouseEvent({ type: "contextmenu" },
    document.querySelector(".devtools-toolbar.requests-list-headers"));

  // Wait for next tick to do stuff async and force repaint.
  await waitForTick();
  await toggleAndCheckColumnVisibility(column, document, parent);
}

async function testVisibleColumnContextMenuItem(column, document, parent) {
  ok(document.querySelector(`#requests-list-${column}-button`),
     `Column ${column} should be visible`);

  info(`Clicking context-menu item for ${column}`);
  EventUtils.sendMouseEvent({ type: "contextmenu" },
    document.querySelector("#requests-list-status-button") ||
    document.querySelector("#requests-list-waterfall-button"));

  await waitForTick();

  const menuItem = parent.document.querySelector(`#request-list-header-${column}-toggle`);

  is(menuItem.getAttribute("type"), "checkbox",
     `${column} menu item should have type="checkbox" attribute`);
  is(menuItem.getAttribute("checked"), "true",
     `checked state of ${column} menu item should be correct`);
  ok(!menuItem.disabled, `disabled state of ${column} menu item should be correct`);

  const onHeaderRemoved = waitForDOM(document, `#requests-list-${column}-button`, 0);
  menuItem.click();

  await onHeaderRemoved;
  await waitForTick();

  ok(!document.querySelector(`#requests-list-${column}-button`),
     `Column ${column} should be hidden`);
}

async function testHiddenColumnContextMenuItem(column, document, parent) {
  ok(!document.querySelector(`#requests-list-${column}-button`),
     `Column ${column} should be hidden`);

  info(`Clicking context-menu item for ${column}`);
  EventUtils.sendMouseEvent({ type: "contextmenu" },
    document.querySelector("#requests-list-status-button") ||
    document.querySelector("#requests-list-waterfall-button"));

  await waitForTick();
  await toggleAndCheckColumnVisibility(column, document, parent);
}

async function toggleAndCheckColumnVisibility(column, document, parent) {
  const menuItem = parent.document.querySelector(`#request-list-header-${column}-toggle`);

  is(menuItem.getAttribute("type"), "checkbox",
     `${column} menu item should have type="checkbox" attribute`);
  ok(!menuItem.getAttribute("checked"),
     `checked state of ${column} menu item should be correct`);
  ok(!menuItem.disabled, `disabled state of ${column} menu item should be correct`);

  const onHeaderAdded = waitForDOM(document, `#requests-list-${column}-button`, 1);
  menuItem.click();

  await onHeaderAdded;
  await waitForTick();

  ok(document.querySelector(`#requests-list-${column}-button`),
     `Column ${column} should be visible`);
}
