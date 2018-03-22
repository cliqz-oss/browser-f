/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */

const TEST_FILE = "dummy_page.html";

// Test for bug 1321020.
add_task(async function() {
  let dir = getChromeDir(getResolvedURI(gTestPath));
  dir.append(TEST_FILE);

  // The file can be a symbolic link on local build.  Normalize it to make sure
  // the path matches to the actual URI opened in the new tab.
  dir.normalize();

  const uriString = Services.io.newFileURI(dir).spec;
  const openedUriString = uriString + "?opened";

  // Open first file:// page.
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, uriString);
  registerCleanupFunction(async function() {
    await BrowserTestUtils.removeTab(tab);
  });

  // Open new file:// tab from JavaScript in first file:// page.
  let promiseTabOpened = BrowserTestUtils.waitForNewTab(gBrowser, openedUriString, true);
  await ContentTask.spawn(tab.linkedBrowser, openedUriString, uri => {
    content.open(uri, "_blank");
  });

  let openedTab = await promiseTabOpened;
  registerCleanupFunction(async function() {
    await BrowserTestUtils.removeTab(openedTab);
  });

  let openedBrowser = openedTab.linkedBrowser;

  // Ensure that new file:// tab can be navigated to web content.
  openedBrowser.loadURI("http://example.org/");
  let href = await BrowserTestUtils.browserLoaded(openedBrowser);
  is(href, "http://example.org/",
     "Check that new file:// page has navigated successfully to web content");
});
