/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Tests for cookies.
 */

"use strict";

ChromeUtils.import("resource://gre/modules/Services.jsm");

add_task(async function test_all_cookies() {
  const expiry = Date.now() + 24 * 60 * 60;
  Services.cookies.add("example.net", "path", "name", "value", true /* secure */,
                       true /* http only */, false /* session */,
                       expiry, {});
  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 1);

  await new Promise(aResolve => {
    Services.clearData.deleteData(Ci.nsIClearDataService.CLEAR_COOKIES, value => {
      Assert.equal(value, 0);
      aResolve();
    });
  });

  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 0);
});

add_task(async function test_range_cookies() {
  const expiry = Date.now() + 24 * 60 * 60;
  Services.cookies.add("example.net", "path", "name", "value", true /* secure */,
                       true /* http only */, false /* session */,
                       expiry, {});
  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 1);

  // The cookie is out of time range here.
  let from = Date.now() + 60 * 60;
  await new Promise(aResolve => {
    Services.clearData.deleteDataInTimeRange(from * 1000, expiry * 2000, true /* user request */,
                                             Ci.nsIClearDataService.CLEAR_COOKIES, value => {
      Assert.equal(value, 0);
      aResolve();
    });
  });

  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 1);

  // Now we delete all.
  from = Date.now() - 60 * 60;
  await new Promise(aResolve => {
    Services.clearData.deleteDataInTimeRange(from * 1000, expiry * 2000, true /* user request */,
                                             Ci.nsIClearDataService.CLEAR_COOKIES, value => {
      Assert.equal(value, 0);
      aResolve();
    });
  });

  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 0);
});

add_task(async function test_principal_cookies() {
  const expiry = Date.now() + 24 * 60 * 60;
  Services.cookies.add("example.net", "path", "name", "value", true /* secure */,
                       true /* http only */, false /* session */,
                       expiry, {});
  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 1);

  let uri = Services.io.newURI("http://example.com");
  let principal = Services.scriptSecurityManager.createCodebasePrincipal(uri, {});
  await new Promise(aResolve => {
    Services.clearData.deleteDataFromPrincipal(principal, true /* user request */,
                                               Ci.nsIClearDataService.CLEAR_COOKIES, value => {
      Assert.equal(value, 0);
      aResolve();
    });
  });

  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 1);

  // Now we delete all.
  uri = Services.io.newURI("http://example.net");
  principal = Services.scriptSecurityManager.createCodebasePrincipal(uri, {});
  await new Promise(aResolve => {
    Services.clearData.deleteDataFromPrincipal(principal, true /* user request */,
                                               Ci.nsIClearDataService.CLEAR_COOKIES, value => {
      Assert.equal(value, 0);
      aResolve();
    });
  });

  Assert.equal(Services.cookies.countCookiesFromHost("example.net"), 0);
});
