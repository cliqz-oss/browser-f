/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  waitForExplicitFinish();

  // data: URI will only inherit principal only when the pref is false.
  Services.prefs.setBoolPref("security.data_uri.unique_opaque_origin", false);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref("security.data_uri.unique_opaque_origin");
  });

  executeSoon(startTest);
}

function startTest() {
  let tab = gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser);

  let browser = gBrowser.getBrowserForTab(tab);

  function loadURL(url, flags, func) {
    BrowserTestUtils.browserLoaded(browser, false, url).then(() => {
      func();
    });
    browser.loadURIWithFlags(url, flags, null, null, null);
  }

  // Load a normal http URL
  function testURL(url, func) {
    loadURL("http://example.com/", 0, function () {
      let pagePrincipal = browser.contentPrincipal;
      ok(pagePrincipal, "got principal for http:// page");

      // Now load the URL normally
      loadURL(url, 0, function () {
        ok(browser.contentPrincipal.equals(pagePrincipal), url + " should inherit principal");

        // Now load the URL and disallow inheriting the principal
        let webNav = Components.interfaces.nsIWebNavigation;
        loadURL(url, webNav.LOAD_FLAGS_DISALLOW_INHERIT_PRINCIPAL, function () {
          let newPrincipal = browser.contentPrincipal;
          ok(newPrincipal, "got inner principal");
          ok(!newPrincipal.equals(pagePrincipal),
             url + " should not inherit principal when loaded with DISALLOW_INHERIT_OWNER");

          func();
        });
      });
    });
  }

  let urls = [
    "data:text/html,<body>hi",
    // We used to test javascript: here as well, but now that we no longer run
    // javascript: in a sandbox, we end up not running it at all in the
    // DISALLOW_INHERIT_OWNER case, so never actually do a load for it at all.
  ];

  function nextTest() {
    let url = urls.shift();
    if (url) {
      testURL(url, nextTest);
    } else {
      gBrowser.removeTab(tab);
      finish();
    }
  }

  nextTest();
}

