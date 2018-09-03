"use strict";

const server = createHttpServer();
server.registerDirectory("/data/", do_get_file("data"));

const BASE_URL = `http://localhost:${server.identity.primaryPort}/data`;

// ExtensionContent.jsm needs to know when it's running from xpcshell,
// to use the right timeout for content scripts executed at document_idle.
ExtensionTestUtils.mockAppInfo();

// Each of these tests do the following:
// 1. Load document to create an extension context (instance of BaseContext).
// 2. Get weak reference to that context.
// 3. Unload the document.
// 4. Force GC and check that the weak reference has been invalidated.

async function reloadTopContext(contentPage) {
  await contentPage.spawn(null, async () => {
    let {TestUtils} = ChromeUtils.import("resource://testing-common/TestUtils.jsm", {});
    let windowNukeObserved = TestUtils.topicObserved("inner-window-nuked");
    info(`Reloading top-level document`);
    this.content.location.reload();
    await windowNukeObserved;
    info(`Reloaded top-level document`);
  });
}

async function assertContextReleased(contentPage, description) {
  await contentPage.spawn(description, async assertionDescription => {
    // Force GC, see https://searchfox.org/mozilla-central/rev/b0275bc977ad7fda615ef34b822bba938f2b16fd/testing/talos/talos/tests/devtools/addon/content/damp.js#84-98
    let gcCount = 0;
    while (gcCount < 30 && this.contextWeakRef.get() !== null) {
      ++gcCount;
      Cu.forceGC();
      Cu.forceCC();
      Cu.forceGC();
      await new Promise(resolve => this.content.setTimeout(resolve, 0));
    }

    // The above loop needs to be repeated at most 3 times according to MinimizeMemoryUsage:
    // https://searchfox.org/mozilla-central/rev/6f86cc3479f80ace97f62634e2c82a483d1ede40/xpcom/base/nsMemoryReporterManager.cpp#2644-2647
    Assert.lessOrEqual(gcCount, 3, `Context should have been GCd within a few GC attempts.`);

    // Each test will set this.contextWeakRef before unloading the document.
    Assert.ok(!this.contextWeakRef.get(), assertionDescription);
  });
}

add_task(async function test_ContentScriptContextChild_in_child_frame() {
  let extensionData = {
    manifest: {
      content_scripts: [
        {
          matches: ["http://*/*/file_iframe.html"],
          js: ["content_script.js"],
          all_frames: true,
        },
      ],
    },

    files: {
      "content_script.js": "browser.test.sendMessage('contentScriptLoaded');",
    },
  };

  let extension = ExtensionTestUtils.loadExtension(extensionData);
  await extension.startup();

  let contentPage = await ExtensionTestUtils.loadContentPage(`${BASE_URL}/file_toplevel.html`);
  await extension.awaitMessage("contentScriptLoaded");

  await contentPage.spawn(extension.id, async extensionId => {
    let {DocumentManager} = ChromeUtils.import("resource://gre/modules/ExtensionContent.jsm", {});
    let frame = this.content.document.querySelector("iframe[src*='file_iframe.html']");
    let context = DocumentManager.getContext(extensionId, frame.contentWindow);

    Assert.ok(context, "Got content script context");

    this.contextWeakRef = Cu.getWeakReference(context);
    frame.remove();
  });

  await assertContextReleased(contentPage, "ContentScriptContextChild should have been released");

  await contentPage.close();
  await extension.unload();
});

add_task(async function test_ContentScriptContextChild_in_toplevel() {
  let extensionData = {
    manifest: {
      content_scripts: [
        {
          matches: ["http://*/*/file_sample.html"],
          js: ["content_script.js"],
          all_frames: true,
        },
      ],
    },

    files: {
      "content_script.js": "browser.test.sendMessage('contentScriptLoaded');",
    },
  };

  let extension = ExtensionTestUtils.loadExtension(extensionData);
  await extension.startup();

  let contentPage = await ExtensionTestUtils.loadContentPage(`${BASE_URL}/file_sample.html`);
  await extension.awaitMessage("contentScriptLoaded");

  await contentPage.spawn(extension.id, async extensionId => {
    let {DocumentManager} = ChromeUtils.import("resource://gre/modules/ExtensionContent.jsm", {});
    let context = DocumentManager.getContext(extensionId, this.content);

    Assert.ok(context, "Got content script context");

    this.contextWeakRef = Cu.getWeakReference(context);
  });

  await reloadTopContext(contentPage);
  await extension.awaitMessage("contentScriptLoaded");
  await assertContextReleased(contentPage, "ContentScriptContextChild should have been released");

  await contentPage.close();
  await extension.unload();
});
