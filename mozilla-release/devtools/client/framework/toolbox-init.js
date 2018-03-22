/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env browser */
/* global XPCNativeWrapper */

"use strict";

// URL constructor doesn't support about: scheme
let href = window.location.href.replace("about:", "http://");
let url = new window.URL(href);

// Only use this method to attach the toolbox if some query parameters are given
if (url.search.length > 1) {
  const Cu = Components.utils;
  const Ci = Components.interfaces;
  const { require } = Cu.import("resource://devtools/shared/Loader.jsm", {});
  const { gDevTools } = require("devtools/client/framework/devtools");
  const { targetFromURL } = require("devtools/client/framework/target-from-url");
  const { Toolbox } = require("devtools/client/framework/toolbox");
  const { TargetFactory } = require("devtools/client/framework/target");
  const { DebuggerServer } = require("devtools/server/main");
  const { DebuggerClient } = require("devtools/shared/client/debugger-client");
  const { Task } = require("devtools/shared/task");

  // `host` is the frame element loading the toolbox.
  let host = window.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIDOMWindowUtils)
                   .containerElement;

  // If there's no containerElement (which happens when loading about:devtools-toolbox as
  // a top level document), use the current window.
  if (!host) {
    host = {
      contentWindow: window,
      contentDocument: document,
      // toolbox-host-manager.js wants to set attributes on the frame that contains it,
      // but that is fine to skip and doesn't make sense when using the current window.
      setAttribute() {},
      ownerDocument: document,
      // toolbox-host-manager.js wants to listen for unload events from outside the frame,
      // but this is fine to skip since the toolbox code listens inside the frame as well,
      // and there is no outer document in this case.
      addEventListener() {},
    };
  }

  // Specify the default tool to open
  let tool = url.searchParams.get("tool");

  Task.spawn(function* () {
    let target;
    if (url.searchParams.has("target")) {
      // Attach toolbox to a given browser iframe (<xul:browser> or <html:iframe
      // mozbrowser>) whose reference is set on the host iframe.

      // `iframe` is the targeted document to debug
      let iframe = host.wrappedJSObject ? host.wrappedJSObject.target
                                        : host.target;
      if (!iframe) {
        throw new Error("Unable to find the targeted iframe to debug");
      }

      // Need to use a xray to have attributes and behavior expected by
      // devtools codebase
      iframe = XPCNativeWrapper(iframe);

      // Fake a xul:tab object as we don't have one.
      // linkedBrowser is the only one attribute being queried by client.getTab
      let tab = { linkedBrowser: iframe };

      DebuggerServer.init();
      DebuggerServer.registerAllActors();
      let client = new DebuggerClient(DebuggerServer.connectPipe());

      yield client.connect();
      // Creates a target for a given browser iframe.
      let response = yield client.getTab({ tab });
      let form = response.tab;
      target = yield TargetFactory.forRemoteTab({client, form, chrome: false});
    } else {
      target = yield targetFromURL(url);
    }
    let options = { customIframe: host };
    yield gDevTools.showToolbox(target, tool, Toolbox.HostType.CUSTOM, options);
  }).catch(error => {
    console.error("Exception while loading the toolbox", error);
  });
}
