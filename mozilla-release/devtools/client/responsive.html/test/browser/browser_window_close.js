/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function () {
  let newWindowPromise = BrowserTestUtils.waitForNewWindow();
  window.open("data:text/html;charset=utf-8,", "_blank");
  let newWindow = await newWindowPromise;

  newWindow.focus();
  await BrowserTestUtils.browserLoaded(newWindow.gBrowser.selectedBrowser);

  let tab = newWindow.gBrowser.selectedTab;
  await openRDM(tab);

  // Close the window on a tab with an active responsive design UI and
  // wait for the UI to gracefully shutdown.  This has leaked the window
  // in the past.
  ok(ResponsiveUIManager.isActiveForTab(tab),
     "ResponsiveUI should be active for tab when the window is closed");
  let offPromise = once(ResponsiveUIManager, "off");
  await BrowserTestUtils.closeWindow(newWindow);
  await offPromise;
});
