/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
"use strict";

const {AddonTestUtils} = Cu.import("resource://testing-common/AddonTestUtils.jsm", {});
const {ExtensionParent} = Cu.import("resource://gre/modules/ExtensionParent.jsm", {});

// This test function helps to detect when an addon options browser have been inserted
// in the about:addons page.
function waitOptionsBrowserInserted() {
  return new Promise(resolve => {
    async function listener(eventName, browser) {
      // wait for a webextension XUL browser element that is owned by the "about:addons" page.
      if (browser.ownerDocument.location.href == "about:addons") {
        ExtensionParent.apiManager.off("extension-browser-inserted", listener);

        resolve(browser);
      }
    }
    ExtensionParent.apiManager.on("extension-browser-inserted", listener);
  });
}

add_task(async function test_options_on_addon_reload() {
  const ID = "@test-options-on-addon-reload";

  function backgroundScript() {
    const {browser} = window;
    browser.runtime.openOptionsPage();
  }

  let extensionDefinition = {
    useAddonManager: "temporary",

    manifest: {
      "options_ui": {
        "page": "options.html",
      },
      "applications": {
        "gecko": {
          "id": ID,
        },
      },
    },
    files: {
      "options.html": `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body>
            Extension Options UI
          </body>
        </html>`,
    },
    background: backgroundScript,
  };

  await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:addons");

  const extension = ExtensionTestUtils.loadExtension(extensionDefinition);

  const onceOptionsBrowserInserted = waitOptionsBrowserInserted();

  await extension.startup();

  info("Wait the options_ui page XUL browser to be created");
  await onceOptionsBrowserInserted;

  const aboutAddonsDocument = gBrowser.selectedBrowser.contentDocument;

  Assert.equal(aboutAddonsDocument.location.href, "about:addons",
               "The about:addons page is the currently selected tab");

  const optionsBrowsers = aboutAddonsDocument.querySelectorAll("#addon-options");
  Assert.equal(optionsBrowsers.length, 1, "Got a single XUL browser for the addon options_ui page");

  // Reload the addon five times in a row, and then check that there is still one addon options browser.

  let addon = await AddonManager.getAddonByID(ID);

  for (let i = 0; i < 5; i++) {
    const onceOptionsReloaded = Promise.all([
      // Reloading the addon currently prevents the extension.awaitMessage test helper to be able
      // to receive test messages from the reloaded extension, this test function helps to wait
      // the extension has been restarted on addon reload.
      AddonTestUtils.promiseWebExtensionStartup(),
      TestUtils.topicObserved(AddonManager.OPTIONS_NOTIFICATION_DISPLAYED,
                              (subject, data) => data == extension.id),
    ]);

    await addon.reload();

    info("Wait the new options_ui page XUL browser to be created");
    await onceOptionsReloaded;

    let optionsBrowsers = aboutAddonsDocument.querySelectorAll("#addon-options");

    Assert.equal(optionsBrowsers.length, 1, "Got a single XUL browser for the addon options_ui page");
  }

  await BrowserTestUtils.removeTab(gBrowser.selectedTab);

  await extension.unload();
});
