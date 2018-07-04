/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */
"use strict";

add_task(async function setup() {
  await setupPolicyEngineWithJson({
                                    "policies": {
                                      "BlockAboutAddons": true
                                    }
                                  });
});

add_task(async function test_about_addons() {
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:addons", false);

  await ContentTask.spawn(tab.linkedBrowser, null, async function() {
    ok(content.document.documentURI.startsWith("about:neterror"),
       "about:addons should display the net error page");

    // There is currently a testing-specific race condition that causes this test
    // to fail, but it is not a problem if we test after the first page load.
    // Until the race condition is fixed, just make sure to test this *after*
    // testing the page load.
    is(Services.policies.isAllowed("about:addons"), false,
       "Policy Engine should report about:addons as not allowed");
  });

  BrowserTestUtils.removeTab(tab);
});
