/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
Cu.import("resource://gre/modules/Services.jsm");

var gProtocols = [];
var gContainer;
window.onload = function() {
  gContainer = document.getElementById("abouts");
  findAbouts();
};

function findAbouts() {
  for (var cid in Cc) {
    var result = cid.match(/@mozilla.org\/network\/protocol\/about;1\?what\=(.*)$/);
    if (result) {
      var aboutType = result[1];
      var contract = "@mozilla.org/network/protocol/about;1?what=" + aboutType;
      try {
        var am = Cc[contract].getService(Ci.nsIAboutModule);
        var uri = Services.io.newURI("about:" + aboutType);
        var flags = am.getURIFlags(uri);
        if (!(flags & Ci.nsIAboutModule.HIDE_FROM_ABOUTABOUT)) {
          gProtocols.push(aboutType);
        }
      } catch (e) {
        // getService might have thrown if the component doesn't actually
        // implement nsIAboutModule
      }
    }
  }
  gProtocols.sort().forEach(createProtocolListing);
}

function createProtocolListing(aProtocol) {
  var uri = "about:" + aProtocol;
  var li = document.createElement("li");
  var link = document.createElement("a");
  var text = document.createTextNode(uri);

  link.href = uri;
  link.appendChild(text);
  li.appendChild(link);
  gContainer.appendChild(li);
}
