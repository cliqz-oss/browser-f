const TEST_DOMAIN = "http://example.net/";
const TEST_3RD_PARTY_DOMAIN = "https://tracking.example.com/";

const TEST_PATH = "browser/toolkit/components/antitracking/test/browser/";

const TEST_TOP_PAGE = TEST_DOMAIN + TEST_PATH + "page.html";
const TEST_3RD_PARTY_PAGE = TEST_3RD_PARTY_DOMAIN + TEST_PATH + "3rdParty.html";

let {UrlClassifierTestUtils} = ChromeUtils.import("resource://testing-common/UrlClassifierTestUtils.jsm", {});

this.AntiTracking = {
  runTest(name, callbackTracking, callbackNonTracking, extraPrefs) {
    this._createTask(name, true, callbackTracking, extraPrefs);
    if (callbackNonTracking) {
      this._createTask(name, false, callbackNonTracking);
    }
  },

  _createTask(name, blocking, callback, extraPrefs) {
    add_task(async function() {
      info("Starting " + (blocking ? "blocking" : "non-blocking") + " test " + name);

      await SpecialPowers.flushPrefEnv();
      await SpecialPowers.pushPrefEnv({"set": [
        ["privacy.trackingprotection.storagerestriction.enabled", blocking],
        ["privacy.trackingprotection.enabled", false],
        ["privacy.trackingprotection.pbmode.enabled", false],
        ["privacy.trackingprotection.annotate_channels", blocking],
      ]});

      if (extraPrefs && Array.isArray(extraPrefs) && extraPrefs.length) {
       await SpecialPowers.pushPrefEnv({"set": extraPrefs });
      }

      await UrlClassifierTestUtils.addTestTrackers();

      info("Creating a new tab");
      let tab = BrowserTestUtils.addTab(gBrowser, TEST_TOP_PAGE);
      gBrowser.selectedTab = tab;

      let browser = gBrowser.getBrowserForTab(tab);
      await BrowserTestUtils.browserLoaded(browser);

      info("Creating a 3rd party content");
      await ContentTask.spawn(browser,
                              { page: TEST_3RD_PARTY_PAGE,
                                callback: callback.toString() },
                              async function(obj) {
        await new content.Promise(resolve => {
          let ifr = content.document.createElement("iframe");
          ifr.onload = function() {
            info("Sending code to the 3rd party content");
            ifr.contentWindow.postMessage(obj.callback, "*");
          };

          content.addEventListener("message", function msg(event) {
            if (event.data.type == "finish") {
              content.removeEventListener("message", msg);
              resolve();
              return;
            }

            if (event.data.type == "ok") {
              ok(event.data.what, event.data.msg);
              return;
            }

            if (event.data.type == "info") {
              info(event.data.msg);
              return;
            }

            ok(false, "Unknown message");
          });

          content.document.body.appendChild(ifr);
          ifr.src = obj.page;
        });
      });

      info("Removing the tab");
      BrowserTestUtils.removeTab(tab);

      UrlClassifierTestUtils.cleanupTestTrackers();
    });
  }
};
