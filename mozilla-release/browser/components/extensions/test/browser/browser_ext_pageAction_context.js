/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
"use strict";

Services.scriptloader.loadSubScript(new URL("head_pageAction.js", gTestPath).href,
                                    this);

add_task(async function testTabSwitchContext() {
  await runTests({
    manifest: {
      "name": "Foo Extension",

      "page_action": {
        "default_icon": "default.png",
        "default_popup": "__MSG_popup__",
        "default_title": "Default __MSG_title__ \u263a",
      },

      "default_locale": "en",

      "permissions": ["tabs"],
    },

    "files": {
      "_locales/en/messages.json": {
        "popup": {
          "message": "default.html",
          "description": "Popup",
        },

        "title": {
          "message": "Title",
          "description": "Title",
        },
      },

      "_locales/es_ES/messages.json": {
        "popup": {
          "message": "default.html",
          "description": "Popup",
        },

        "title": {
          "message": "T\u00edtulo",
          "description": "Title",
        },
      },

      "default.png": imageBuffer,
      "1.png": imageBuffer,
      "2.png": imageBuffer,
    },

    getTests: function(tabs) {
      let defaultIcon = "chrome://browser/content/extension.svg";
      let details = [
        {"icon": browser.runtime.getURL("default.png"),
         "popup": browser.runtime.getURL("default.html"),
         "title": "Default T\u00edtulo \u263a"},
        {"icon": browser.runtime.getURL("1.png"),
         "popup": browser.runtime.getURL("default.html"),
         "title": "Default T\u00edtulo \u263a"},
        {"icon": browser.runtime.getURL("2.png"),
         "popup": browser.runtime.getURL("2.html"),
         "title": "Title 2"},
        {"icon": defaultIcon,
         "popup": "",
         "title": ""},
      ];

      let promiseTabLoad = details => {
        return new Promise(resolve => {
          browser.tabs.onUpdated.addListener(function listener(tabId, changed) {
            if (tabId == details.id && changed.url == details.url) {
              browser.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });
      };

      return [
        expect => {
          browser.test.log("Initial state. No icon visible.");
          expect(null);
        },
        async expect => {
          browser.test.log("Show the icon on the first tab, expect default properties.");
          await browser.pageAction.show(tabs[0]);
          expect(details[0]);
        },
        expect => {
          browser.test.log("Change the icon. Expect default properties excluding the icon.");
          browser.pageAction.setIcon({tabId: tabs[0], path: "1.png"});
          expect(details[1]);
        },
        async expect => {
          browser.test.log("Create a new tab. No icon visible.");
          let tab = await browser.tabs.create({active: true, url: "about:blank?0"});
          tabs.push(tab.id);
          expect(null);
        },
        async expect => {
          browser.test.log("Await tab load. No icon visible.");
          let promise = promiseTabLoad({id: tabs[1], url: "about:blank?0"});
          let {url} = await browser.tabs.get(tabs[1]);
          if (url === "about:blank") {
            await promise;
          }
          expect(null);
        },
        async expect => {
          browser.test.log("Change properties. Expect new properties.");
          let tabId = tabs[1];
          await browser.pageAction.show(tabId);

          browser.pageAction.setIcon({tabId, path: "2.png"});
          browser.pageAction.setPopup({tabId, popup: "2.html"});
          browser.pageAction.setTitle({tabId, title: "Title 2"});

          expect(details[2]);
        },
        async expect => {
          browser.test.log("Change the hash. Expect same properties.");

          let promise = promiseTabLoad({id: tabs[1], url: "about:blank?0#ref"});
          browser.tabs.update(tabs[1], {url: "about:blank?0#ref"});
          await promise;

          expect(details[2]);
        },
        expect => {
          browser.test.log("Set empty string values. Expect empty strings but default icon.");
          browser.pageAction.setIcon({tabId: tabs[1], path: ""});
          browser.pageAction.setPopup({tabId: tabs[1], popup: ""});
          browser.pageAction.setTitle({tabId: tabs[1], title: ""});

          expect(details[3]);
        },
        expect => {
          browser.test.log("Clear the values. Expect default ones.");
          browser.pageAction.setIcon({tabId: tabs[1], path: null});
          browser.pageAction.setPopup({tabId: tabs[1], popup: null});
          browser.pageAction.setTitle({tabId: tabs[1], title: null});

          expect(details[0]);
        },
        async expect => {
          browser.test.log("Navigate to a new page. Expect icon hidden.");

          // TODO: This listener should not be necessary, but the |tabs.update|
          // callback currently fires too early in e10s windows.
          let promise = promiseTabLoad({id: tabs[1], url: "about:blank?1"});

          browser.tabs.update(tabs[1], {url: "about:blank?1"});

          await promise;
          expect(null);
        },
        async expect => {
          browser.test.log("Show the icon. Expect default properties again.");

          await browser.pageAction.show(tabs[1]);
          expect(details[0]);
        },
        async expect => {
          browser.test.log("Switch back to the first tab. Expect previously set properties.");
          await browser.tabs.update(tabs[0], {active: true});
          expect(details[1]);
        },
        async expect => {
          browser.test.log("Hide the icon on tab 2. Switch back, expect hidden.");
          await browser.pageAction.hide(tabs[1]);

          await browser.tabs.update(tabs[1], {active: true});
          expect(null);
        },
        async expect => {
          browser.test.log("Switch back to tab 1. Expect previous results again.");
          await browser.tabs.remove(tabs[1]);
          expect(details[1]);
        },
        async expect => {
          browser.test.log("Hide the icon. Expect hidden.");

          await browser.pageAction.hide(tabs[0]);
          expect(null);
        },
        async expect => {
          browser.test.assertRejects(
            browser.pageAction.setPopup({tabId: tabs[0], popup: "about:addons"}),
            /Access denied for URL about:addons/,
            "unable to set popup to about:addons");

          expect(null);
        },
      ];
    },
  });
});

add_task(async function testNavigationClearsData() {
  let url = "http://example.com/";
  let default_title = "Default title";
  let tab_title = "Tab title";

  let {Management: {global: {tabTracker}}} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});
  let extension, tab, tabId, tabs = [];
  async function addTab(...args) {
    tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, ...args);
    tabId = tabTracker.getId(tab);
    tabs.push(tab);
  }
  async function locationChange(url, task) {
    let locationChanged = BrowserTestUtils.waitForLocationChange(gBrowser, url);
    await ContentTask.spawn(tab.linkedBrowser, url, task);
    await locationChanged;
  }
  function setUrl(url) {
    return locationChange(url, (url) => { content.location.href = url; });
  }
  function historyPushState(url) {
    return locationChange(url, (url) => { content.history.pushState(null, null, url); });
  }
  async function sendMessage(method, param, expect, msg) {
    extension.sendMessage({method, param, expect, msg});
    await extension.awaitMessage("done");
  }
  async function expectTabSpecificData(msg) {
    await sendMessage("isShown", {tabId}, true, msg);
    await sendMessage("getTitle", {tabId}, tab_title, msg);
  }
  async function expectDefaultData(msg) {
    await sendMessage("isShown", {tabId}, false, msg);
    await sendMessage("getTitle", {tabId}, default_title, msg);
  }
  async function setTabSpecificData() {
    await expectDefaultData("Expect default data before setting tab-specific data.");
    await sendMessage("show", tabId);
    await sendMessage("setTitle", {tabId, title: tab_title});
    await expectTabSpecificData("Expect tab-specific data after setting it.");
  }

  info("Load a tab before installing the extension");
  await addTab(url, true, true);

  extension = ExtensionTestUtils.loadExtension({
    manifest: {
      page_action: {default_title},
    },
    background: function() {
      browser.test.onMessage.addListener(async ({method, param, expect, msg}) => {
        let result = await browser.pageAction[method](param);
        if (expect !== undefined) {
          browser.test.assertEq(expect, result, msg);
        }
        browser.test.sendMessage("done");
      });
    },
  });
  await extension.startup();

  info("Set tab-specific data to the existing tab.");
  await setTabSpecificData();

  info("Add a hash. Does not cause navigation.");
  await setUrl(url + "#hash");
  await expectTabSpecificData("Adding a hash does not clear tab-specific data");

  info("Remove the hash. Causes navigation.");
  await setUrl(url);
  await expectDefaultData("Removing hash clears tab-specific data");

  info("Open a new tab, set tab-specific data to it.");
  await addTab("about:newtab", false, false);
  await setTabSpecificData();

  info("Load a page in that tab.");
  await setUrl(url);
  await expectDefaultData("Loading a page clears tab-specific data.");

  info("Set tab-specific data.");
  await setTabSpecificData();

  info("Push history state. Does not cause navigation.");
  await historyPushState(url + "/path");
  await expectTabSpecificData("history.pushState() does not clear tab-specific data");

  for (let tab of tabs) {
    await BrowserTestUtils.removeTab(tab);
  }
  await extension.unload();
});
