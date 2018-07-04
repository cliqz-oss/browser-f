"use strict";

// This test requires an XMLHttpRequest constructor which isn't
// associated with a window.
const {XMLHttpRequest} = Cu.Sandbox(window, {wantGlobalProperties: ["XMLHttpRequest"]});

var {WebRequest} = ChromeUtils.import("resource://gre/modules/WebRequest.jsm", {});
var {PromiseUtils} = ChromeUtils.import("resource://gre/modules/PromiseUtils.jsm", {});

add_task(async function test_ancestors_exist() {
  let deferred = PromiseUtils.defer();
  function onBeforeRequest(details) {
    info(`onBeforeRequest ${details.url}`);
    ok(typeof details.frameAncestors === "object", `ancestors exists [${typeof details.frameAncestors}]`);
    deferred.resolve();
  }

  WebRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: new MatchPatternSet(["http://mochi.test/test/*"])}, ["blocking"]);

  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, "http://mochi.test:8888/test/");
  await deferred.promise;
  BrowserTestUtils.removeTab(tab);

  WebRequest.onBeforeRequest.removeListener(onBeforeRequest);
});

add_task(async function test_ancestors_null() {
  let deferred = PromiseUtils.defer();
  function onBeforeRequest(details) {
    info(`onBeforeRequest ${details.url}`);
    ok(details.frameAncestors === undefined, "ancestors do not exist");
    deferred.resolve();
  }

  WebRequest.onBeforeRequest.addListener(onBeforeRequest, null, ["blocking"]);

  function fetch(url) {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.mozBackgroundRequest = true;
      xhr.open("GET", url);
      xhr.onload = () => { resolve(xhr.responseText); };
      xhr.onerror = () => { reject(xhr.status); };
      // use a different contextId to avoid auth cache.
      xhr.setOriginAttributes({userContextId: 1});
      xhr.send();
    });
  }

  await fetch("http://mochi.test:8888/test/");
  await deferred.promise;

  WebRequest.onBeforeRequest.removeListener(onBeforeRequest);
});
