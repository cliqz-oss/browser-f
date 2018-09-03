"use strict";

ChromeUtils.import("resource://gre/modules/ExtensionStorageIDB.jsm");

async function test_multiple_pages() {
  let extension = ExtensionTestUtils.loadExtension({
    async background() {
      function awaitMessage(expectedMsg, api = "test") {
        return new Promise(resolve => {
          browser[api].onMessage.addListener(function listener(msg) {
            if (msg === expectedMsg) {
              browser[api].onMessage.removeListener(listener);
              resolve();
            }
          });
        });
      }

      let tabReady = awaitMessage("tab-ready", "runtime");

      try {
        let storage = browser.storage.local;

        browser.test.sendMessage("load-page", browser.runtime.getURL("tab.html"));
        await awaitMessage("page-loaded");
        await tabReady;

        let result = await storage.get("key");
        browser.test.assertEq(undefined, result.key, "Key should be undefined");

        await browser.runtime.sendMessage("tab-set-key");

        result = await storage.get("key");
        browser.test.assertEq(JSON.stringify({foo: {bar: "baz"}}),
                              JSON.stringify(result.key),
                              "Key should be set to the value from the tab");

        browser.test.sendMessage("remove-page");
        await awaitMessage("page-removed");

        result = await storage.get("key");
        browser.test.assertEq(JSON.stringify({foo: {bar: "baz"}}),
                              JSON.stringify(result.key),
                              "Key should still be set to the value from the tab");

        browser.test.notifyPass("storage-multiple");
      } catch (e) {
        browser.test.fail(`Error: ${e} :: ${e.stack}`);
        browser.test.notifyFail("storage-multiple");
      }
    },

    files: {
      "tab.html": `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <script src="tab.js"></script>
          </head>
        </html>`,

      "tab.js"() {
        browser.test.log("tab");
        browser.runtime.onMessage.addListener(msg => {
          if (msg == "tab-set-key") {
            return browser.storage.local.set({key: {foo: {bar: "baz"}}});
          }
        });

        browser.runtime.sendMessage("tab-ready");
      },
    },

    manifest: {
      permissions: ["storage"],
    },
  });

  let contentPage;
  extension.onMessage("load-page", async url => {
    contentPage = await ExtensionTestUtils.loadContentPage(url, {extension});
    extension.sendMessage("page-loaded");
  });
  extension.onMessage("remove-page", async url => {
    await contentPage.close();
    extension.sendMessage("page-removed");
  });

  await extension.startup();
  await extension.awaitFinish("storage-multiple");
  await extension.unload();
}

add_task(async function test_storage_local_file_backend_from_tab() {
  return runWithPrefs([[ExtensionStorageIDB.BACKEND_ENABLED_PREF, false]],
                      test_multiple_pages);
});

add_task(async function test_storage_local_idb_backend_from_tab() {
  return runWithPrefs([[ExtensionStorageIDB.BACKEND_ENABLED_PREF, true]],
                      test_multiple_pages);
});

async function test_storage_local_call_from_destroying_context() {
  let extension = ExtensionTestUtils.loadExtension({
    async background() {
      let numberOfChanges = 0;
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") {
          browser.test.fail(`Received unexpected storage changes for "${areaName}"`);
        }

        numberOfChanges++;
      });

      browser.test.onMessage.addListener(async ({msg, values}) => {
        switch (msg) {
          case "storage-set": {
            await browser.storage.local.set(values);
            browser.test.sendMessage("storage-set:done");
            break;
          }
          case "storage-get": {
            const res = await browser.storage.local.get();
            browser.test.sendMessage("storage-get:done", res);
            break;
          }
          case "storage-changes": {
            browser.test.sendMessage("storage-changes-count", numberOfChanges);
            break;
          }
          default:
            browser.test.fail(`Received unexpected message: ${msg}`);
        }
      });

      browser.test.sendMessage("ext-page-url", browser.runtime.getURL("tab.html"));
    },
    files: {
      "tab.html": `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <script src="tab.js"></script>
          </head>
        </html>`,

      "tab.js"() {
        browser.test.log("Extension tab - calling storage.local API method");
        // Call the storage.local API from a tab that is going to be quickly closed.
        browser.storage.local.set({
          "test-key-from-destroying-context": "testvalue2",
        });
        // Navigate away from the extension page, so that the storage.local API call will be unable
        // to send the call to the caller context (because it has been destroyed in the meantime).
        window.location = "about:blank";
      },
    },
    manifest: {
      permissions: ["storage"],
    },
  });

  await extension.startup();
  const url = await extension.awaitMessage("ext-page-url");

  let contentPage = await ExtensionTestUtils.loadContentPage(url, {extension});
  let expectedBackgroundPageData = {"test-key-from-background-page": "test-value"};
  let expectedTabData = {"test-key-from-destroying-context": "testvalue2"};

  info("Call storage.local.set from the background page and wait it to be completed");
  extension.sendMessage({msg: "storage-set", values: expectedBackgroundPageData});
  await extension.awaitMessage("storage-set:done");

  info("Call storage.local.get from the background page and wait it to be completed");
  extension.sendMessage({msg: "storage-get"});
  let res = await extension.awaitMessage("storage-get:done");

  if (!ExtensionStorageIDB.isBackendEnabled) {
    // When the JSONFile backend is enabled, the data stored from the destroying context
    // is expected to be stored.
    Assert.deepEqual(res, {
      ...expectedBackgroundPageData,
      ...expectedTabData,
    }, "Got the expected data set in the storage.local backend");

    extension.sendMessage({msg: "storage-changes"});
    equal(await extension.awaitMessage("storage-changes-count"), 2,
          "Got the expected number of storage.onChanged event received");
  } else {
    // When the IndexedDb backend is enabled, the data stored from the destroying context
    // will not be stored.
    Assert.deepEqual(res, {
      ...expectedBackgroundPageData,
    }, "Got the expected data set in the storage.local backend");

    extension.sendMessage({msg: "storage-changes"});
    equal(await extension.awaitMessage("storage-changes-count"), 1,
          "Got the expected number of storage.onChanged event received");
  }

  contentPage.close();

  await extension.unload();
}

add_task(async function test_storage_local_file_backend_destroyed_context_promise() {
  return runWithPrefs([[ExtensionStorageIDB.BACKEND_ENABLED_PREF, false]],
                      test_storage_local_call_from_destroying_context);
});

add_task(async function test_storage_local_idb_backend_destroyed_context_promise() {
  return runWithPrefs([[ExtensionStorageIDB.BACKEND_ENABLED_PREF, true]],
                      test_storage_local_call_from_destroying_context);
});

add_task(async function test_storage_local_should_not_cache_idb_open_rejections() {
  async function test_storage_local_on_idb_disk_full_rejection() {
    let extension = ExtensionTestUtils.loadExtension({
      async background() {
        browser.test.sendMessage("ext-page-url", browser.runtime.getURL("tab.html"));
      },
      files: {
        "tab.html": `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <script src="tab.js"></script>
          </head>
        </html>`,

        "tab.js"() {
          browser.test.onMessage.addListener(async ({msg, expectErrorOnSet}) => {
            if (msg !== "call-storage-local") {
              return;
            }

            const expectedValue = "newvalue";

            try {
              await browser.storage.local.set({"newkey": expectedValue});
            } catch (err) {
              if (expectErrorOnSet) {
                browser.test.sendMessage("storage-local-set-rejected");
                return;
              }

              browser.test.fail(`Got an unexpected exception on storage.local.get: ${err}`);
              throw err;
            }

            try {
              const res = await browser.storage.local.get("newvalue");
              browser.test.assertEq(expectedValue, res.newkey);
              browser.test.sendMessage("storage-local-get-resolved");
            } catch (err) {
              browser.test.fail(`Got an unexpected exception on storage.local.get: ${err}`);
              throw err;
            }
          });

          browser.test.sendMessage("extension-tab-ready");
        },
      },
      manifest: {
        permissions: ["storage"],
      },
    });

    await extension.startup();
    const url = await extension.awaitMessage("ext-page-url");

    let contentPage = await ExtensionTestUtils.loadContentPage(url, {extension});
    await extension.awaitMessage("extension-tab-ready");

    // Turn the low disk mode on (so that opening an IndexedDB connection raises a
    // QuotaExceededError).
    setLowDiskMode(true);

    extension.sendMessage({msg: "call-storage-local", expectErrorOnSet: true});
    info(`Wait the storage.local.set API call to reject while the disk is full`);
    await extension.awaitMessage("storage-local-set-rejected");
    info("Got the a rejection on storage.local.set while the disk is full as expected");

    setLowDiskMode(false);
    extension.sendMessage({msg: "call-storage-local", expectErrorOnSet: false});
    info(`Wait the storage.local API calls to resolve successfully once the disk is free again`);
    await extension.awaitMessage("storage-local-get-resolved");
    info("storage.local.set and storage.local.get resolve successfully once the disk is free again");

    contentPage.close();
    await extension.unload();
  }

  return runWithPrefs([[ExtensionStorageIDB.BACKEND_ENABLED_PREF, true]],
                      test_storage_local_on_idb_disk_full_rejection);
});

