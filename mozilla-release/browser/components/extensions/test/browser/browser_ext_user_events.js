"use strict";

/**
 * Wait for the given PopupNotification to display
 *
 * @param {string} name
 *        The name of the notification to wait for.
 *
 * @returns {Promise}
 *          Resolves with the notification window.
 */
function promisePopupNotificationShown(name) {
  return new Promise(resolve => {
    function popupshown() {
      let notification = PopupNotifications.getNotification(name);
      if (!notification) { return; }

      ok(notification, `${name} notification shown`);
      ok(PopupNotifications.isPanelOpen, "notification panel open");

      PopupNotifications.panel.removeEventListener("popupshown", popupshown);
      resolve(PopupNotifications.panel.firstChild);
    }

    PopupNotifications.panel.addEventListener("popupshown", popupshown);
  });
}

// Test that different types of events are all considered
// "handling user input".
add_task(async function testSources() {
  let extension = ExtensionTestUtils.loadExtension({
    async background() {
      async function request(perm) {
        try {
          let result = await browser.permissions.request({
            permissions: [perm],
          });
          browser.test.sendMessage("request", {success: true, result});
        } catch (err) {
          browser.test.sendMessage("request", {success: false, errmsg: err.message});
        }
      }

      let tabs = await browser.tabs.query({active: true, currentWindow: true});
      await browser.pageAction.show(tabs[0].id);

      browser.pageAction.onClicked.addListener(() => request("bookmarks"));
      browser.browserAction.onClicked.addListener(() => request("tabs"));

      browser.test.onMessage.addListener(msg => {
        if (msg === "contextMenus.update") {
          browser.contextMenus.onClicked.addListener(() => request("webNavigation"));
          browser.contextMenus.update("menu", {
            title: "test user events in onClicked",
            onclick: null,
          }, () => browser.test.sendMessage("contextMenus.update-done"));
        }
        if (msg === "openOptionsPage") {
          browser.runtime.openOptionsPage();
        }
      });

      browser.contextMenus.create({
        id: "menu",
        title: "test user events in onclick",
        contexts: ["page"],
        onclick() {
          request("cookies");
        },
      }, () => {
        browser.test.sendMessage("actions-ready");
      });
    },

    files: {
      "options.html": `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <script src="options.js"></script>
          <script src="https://example.com/tests/SimpleTest/EventUtils.js"></script>
        </head>
        <body>
          <a id="link" href="#">Link</a>
        </body>
        </html>`,

      "options.js"() {
        addEventListener("load", async () => {
          let link = document.getElementById("link");
          link.onclick = async event => {
            link.onclick = null;
            event.preventDefault();

            browser.test.log("Calling permission.request from options page.");

            try {
              let result = await browser.permissions.request({
                permissions: ["webRequest"],
              });
              browser.test.sendMessage("request", {success: true, result});
            } catch (err) {
              browser.test.sendMessage("request", {success: false, errmsg: err.message});
            }
          };

          // Make a few trips through the event loop to make sure the
          // options browser is fully visible. This is a bit dodgy, but
          // we don't really have a reliable way to detect this from the
          // options page side, and synthetic click events won't work
          // until it is.
          do {
            browser.test.log("Waiting for the options browser to be visible...");
            await new Promise(resolve => setTimeout(resolve, 0));
            synthesizeMouseAtCenter(link, {});
          } while (link.onclick !== null);
        });
      },
    },

    manifest: {
      browser_action: {default_title: "test"},
      page_action: {default_title: "test"},
      permissions: ["contextMenus"],
      optional_permissions: ["bookmarks", "tabs", "webNavigation", "webRequest", "cookies"],
      options_ui: {page: "options.html"},
      content_security_policy: "script-src 'self' https://example.com; object-src 'none';",
    },

    useAddonManager: "temporary",
  });

  async function check(what) {
    let result = await extension.awaitMessage("request");
    ok(result.success, `request() did not throw when called from ${what}`);
    is(result.result, true, `request() succeeded when called from ${what}`);
  }

  // Remove Sidebar button to prevent pushing extension button to overflow menu
  CustomizableUI.removeWidgetFromArea("sidebar-button");

  await extension.startup();
  await extension.awaitMessage("actions-ready");

  promisePopupNotificationShown("addon-webext-permissions").then(panel => {
    panel.button.click();
  });

  clickPageAction(extension);
  await check("page action click");

  promisePopupNotificationShown("addon-webext-permissions").then(panel => {
    panel.button.click();
  });

  clickBrowserAction(extension);
  await check("browser action click");

  promisePopupNotificationShown("addon-webext-permissions").then(panel => {
    panel.button.click();
  });

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
  gBrowser.selectedTab = tab;

  let menu = await openContextMenu("body");
  let items = menu.getElementsByAttribute("label", "test user events in onclick");
  is(items.length, 1, "Found context menu item");
  EventUtils.synthesizeMouseAtCenter(items[0], {});
  await check("context menu in onclick");

  extension.sendMessage("contextMenus.update");
  await extension.awaitMessage("contextMenus.update-done");
  menu = await openContextMenu("body");
  items = menu.getElementsByAttribute("label", "test user events in onClicked");
  is(items.length, 1, "Found context menu item again");
  EventUtils.synthesizeMouseAtCenter(items[0], {});
  await check("context menu in onClicked");

  promisePopupNotificationShown("addon-webext-permissions").then(panel => {
    panel.button.click();
  });
  extension.sendMessage("openOptionsPage");
  await check("options page link click");

  await BrowserTestUtils.removeTab(gBrowser.selectedTab);
  await BrowserTestUtils.removeTab(tab);

  await extension.unload();

  registerCleanupFunction(() => CustomizableUI.reset());
});


