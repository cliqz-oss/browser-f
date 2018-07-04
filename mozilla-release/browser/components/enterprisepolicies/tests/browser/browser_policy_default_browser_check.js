/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
const { ShellService } = ChromeUtils.import("resource:///modules/ShellService.jsm", {});

add_task(async function test_default_browser_check() {
  ShellService._checkedThisSession = false;
  // On a normal profile, the default is true. However, this gets set to false on the
  // testing profile. Let's start with true for a sanity check.

  ShellService.shouldCheckDefaultBrowser = true;
  is(ShellService.shouldCheckDefaultBrowser, true, "Sanity check");

  await setupPolicyEngineWithJson({
    "policies": {
      "DontCheckDefaultBrowser": true
    }
  });

  is(ShellService.shouldCheckDefaultBrowser, false, "Policy changed it to not check");

  // Try to change it to true and check that it doesn't take effect
  ShellService.shouldCheckDefaultBrowser = true;

  is(ShellService.shouldCheckDefaultBrowser, false, "Policy is enforced");
});
