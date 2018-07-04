/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 /* global BrowserLoader */

"use strict";

const { BrowserLoader } = ChromeUtils.import("resource://devtools/client/shared/browser-loader.js", {});

this.NewConsoleOutput = function(parentNode, jsterm, toolbox, owner, serviceContainer) {
  // Initialize module loader and load all modules of the new inline
  // preview feature. The entire code-base doesn't need any extra
  // privileges and runs entirely in content scope.
  let NewConsoleOutputWrapper = BrowserLoader({
    baseURI: "resource://devtools/client/webconsole/",
    window
  }).require("./new-console-output-wrapper");

  return new NewConsoleOutputWrapper(
    parentNode, jsterm, toolbox, owner, serviceContainer);
};
