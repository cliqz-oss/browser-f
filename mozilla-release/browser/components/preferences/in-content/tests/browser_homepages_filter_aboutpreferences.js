add_task(async function testSetHomepageUseCurrent() {
  is(gBrowser.currentURI.spec, "about:blank", "Test starts with about:blank open");
  await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:home");
  await openPreferencesViaOpenPreferencesAPI("paneHome", {leaveOpen: true});
  // eslint-disable-next-line mozilla/no-cpows-in-tests
  let doc = gBrowser.contentDocument;
  is(gBrowser.currentURI.spec, "about:preferences#home",
     "#home should be in the URI for about:preferences");
  let oldHomepagePref = Services.prefs.getCharPref("browser.startup.homepage");

  let useCurrent = doc.getElementById("useCurrentBtn");
  useCurrent.click();

  is(gBrowser.tabs.length, 3, "Three tabs should be open");
  is(Services.prefs.getCharPref("browser.startup.homepage"), "about:blank|about:home",
     "about:blank and about:home should be the only homepages set");

  Services.prefs.setCharPref("browser.startup.homepage", oldHomepagePref);
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
});
