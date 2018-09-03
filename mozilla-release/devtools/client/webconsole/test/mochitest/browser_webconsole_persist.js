/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Check that message persistence works - bug 705921 / bug 1307881

"use strict";

const TEST_URI = "http://example.com/browser/devtools/client/webconsole/" +
                 "test/mochitest/test-console.html";

registerCleanupFunction(() => {
  Services.prefs.clearUserPref("devtools.webconsole.persistlog");
});

add_task(async function() {
  info("Testing that messages disappear on a refresh if logs aren't persisted");
  const hud = await openNewTabAndConsole(TEST_URI);

  const INITIAL_LOGS_NUMBER = 5;
  await ContentTask.spawn(gBrowser.selectedBrowser, INITIAL_LOGS_NUMBER, (count) => {
    content.wrappedJSObject.doLogs(count);
  });
  await waitFor(() => findMessages(hud, "").length === INITIAL_LOGS_NUMBER);
  ok(true, "Messages showed up initially");

  await refreshTab();
  await waitFor(() => findMessages(hud, "").length === 0);
  ok(true, "Messages disappeared");

  await closeToolbox();
});

add_task(async function() {
  info("Testing that messages persist on a refresh if logs are persisted");

  const hud = await openNewTabAndConsole(TEST_URI);

  hud.ui.outputNode.querySelector(".webconsole-filterbar-primary .filter-checkbox")
    .click();

  const INITIAL_LOGS_NUMBER = 5;
  await ContentTask.spawn(gBrowser.selectedBrowser, INITIAL_LOGS_NUMBER, (count) => {
    content.wrappedJSObject.doLogs(count);
  });
  await waitFor(() => findMessages(hud, "").length === INITIAL_LOGS_NUMBER);
  ok(true, "Messages showed up initially");

  const onNavigatedMessage = waitForMessage(hud, "Navigated to");
  refreshTab();
  await onNavigatedMessage;

  ok(true, "Navigation message appeared as expected");
  is(findMessages(hud, "").length, INITIAL_LOGS_NUMBER + 1,
    "Messages logged before navigation are still visible");
});
