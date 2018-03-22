/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Check that inspecting an optimized out variable works when execution is
// paused.

"use strict";

const TEST_URI = "http://example.com/browser/devtools/client/webconsole/" +
                 "new-console-output/test/mochitest/test-closure-optimized-out.html";

add_task(async function () {
  // Force the old debugger UI since it's directly used (see Bug 1301705)
  await pushPref("devtools.debugger.new-debugger-frontend", false);

  let hud = await openNewTabAndConsole(TEST_URI);
  let { toolbox, panel: debuggerPanel } = await openDebugger();

  let sources = debuggerPanel.panelWin.DebuggerView.Sources;
  await debuggerPanel.addBreakpoint({ actor: sources.values[0], line: 18 });
  await ensureThreadClientState(debuggerPanel, "resumed");

  let { FETCHED_SCOPES } = debuggerPanel.panelWin.EVENTS;
  let fetchedScopes = debuggerPanel.panelWin.once(FETCHED_SCOPES);

  // Cause the debuggee to pause
  ContentTask.spawn(gBrowser.selectedBrowser, {}, function* () {
    let button = content.document.querySelector("button");
    button.click();
  });

  await fetchedScopes;
  ok(true, "Scopes were fetched");

  await toolbox.selectTool("webconsole");

  // This is the meat of the test: evaluate the optimized out variable.
  let onMessage = waitForMessage(hud, "optimized out");
  hud.jsterm.execute("upvar");

  info("Waiting for optimized out message");
  await onMessage;

  ok(true, "Optimized out message logged");
});

// Debugger helper functions adapted from devtools/client/debugger/test/head.js.

async function ensureThreadClientState(debuggerPanel, state) {
  let thread = debuggerPanel.panelWin.gThreadClient;
  info(`Thread is: '${thread.state}'.`);
  if (thread.state != state) {
    info("Waiting for thread event: '${state}'.");
    await thread.addOneTimeListener(state);
  }
}
