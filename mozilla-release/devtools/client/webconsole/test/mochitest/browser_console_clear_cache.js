/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Check that clearing the browser console output also clears the console cache.

"use strict";

const TEST_URI = "data:text/html;charset=utf8,Test browser console clear cache";

add_task(async function() {
  await addTab(TEST_URI);
  let hud = await HUDService.toggleBrowserConsole();
  const CACHED_MESSAGE = "CACHED_MESSAGE";
  await logTextToConsole(hud, CACHED_MESSAGE);

  info("Click the clear output button");
  const onBrowserConsoleOutputCleared = waitFor(
    () => !findMessage(hud, CACHED_MESSAGE)
  );
  hud.ui.window.document.querySelector(".devtools-clear-icon").click();
  await onBrowserConsoleOutputCleared;

  info("Close and re-open the browser console");
  await HUDService.toggleBrowserConsole();
  hud = await HUDService.toggleBrowserConsole();

  info("Log a smoke message in order to know that the console is ready");
  await logTextToConsole(hud, "Smoke message");
  is(findMessage(hud, CACHED_MESSAGE), null, "The cached message is not visible anymore");
});

function logTextToConsole(hud, text) {
  const onMessage = waitForMessage(hud, text);
  ContentTask.spawn(gBrowser.selectedBrowser, text, function(str) {
    content.wrappedJSObject.console.log(str);
  });
  return onMessage;
}
