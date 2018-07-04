/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {require} = ChromeUtils.import("resource://devtools/shared/Loader.jsm", {});
const RuntimeList = require("devtools/client/webide/modules/runtime-list");

var runtimeList = new RuntimeList(window, window.parent);

window.addEventListener("load", function() {
  document.getElementById("runtime-screenshot").onclick = TakeScreenshot;
  document.getElementById("runtime-details").onclick = ShowRuntimeDetails;
  document.getElementById("runtime-disconnect").onclick = DisconnectRuntime;
  document.getElementById("runtime-preferences").onclick = ShowDevicePreferences;
  document.getElementById("runtime-settings").onclick = ShowSettings;
  document.getElementById("runtime-panel-noadbhelper").onclick = ShowAddons;
  document.getElementById("runtime-panel-nousbdevice").onclick = ShowTroubleShooting;
  document.getElementById("refresh-devices").onclick = RefreshScanners;
  runtimeList.update();
  runtimeList.updateCommands();
}, {capture: true, once: true});

window.addEventListener("unload", function() {
  runtimeList.destroy();
}, {once: true});

function TakeScreenshot() {
  runtimeList.takeScreenshot();
}

function ShowRuntimeDetails() {
  runtimeList.showRuntimeDetails();
}

function ShowDevicePreferences() {
  runtimeList.showDevicePreferences();
}

function ShowSettings() {
  runtimeList.showSettings();
}

function RefreshScanners() {
  runtimeList.refreshScanners();
}

function DisconnectRuntime() {
  window.parent.Cmds.disconnectRuntime();
}

function ShowAddons() {
  runtimeList.showAddons();
}

function ShowTroubleShooting() {
  runtimeList.showTroubleShooting();
}
