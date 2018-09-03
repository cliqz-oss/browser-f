ChromeUtils.import("resource://gre/modules/Services.jsm");

AntiTracking.runTest("Set/Get Cookies",
  async _ => {
    is(document.cookie, "", "No cookies for me");

    await fetch("server.sjs").then(r => r.text()).then(text => {
      is(text, "cookie-not-present", "We should not have cookies");
    });
    // Let's do it twice.
    await fetch("server.sjs").then(r => r.text()).then(text => {
      is(text, "cookie-not-present", "We should not have cookies");
    });

    is(document.cookie, "", "Still no cookies for me");
  },
  async _ => {
    is(document.cookie, "", "No cookies for me");

    await fetch("server.sjs").then(r => r.text()).then(text => {
      is(text, "cookie-not-present", "We should not have cookies");
    });
    await fetch("server.sjs").then(r => r.text()).then(text => {
      is(text, "cookie-present", "We should have cookies");
    });

    ok(document.cookie.length, "Some Cookies for me");
  });

registerCleanupFunction(async _ => {
  // cache removed.
  await new Promise(resolve => {
    Services.clearData.deleteData(Ci.nsIClearDataService.CLEAR_ALL, value => resolve());
  });
});
