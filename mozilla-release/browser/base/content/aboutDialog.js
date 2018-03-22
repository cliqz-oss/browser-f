/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* import-globals-from aboutDialog-appUpdater.js */

// Services = object with smart getters for common XPCOM services
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AppConstants.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

function init(aEvent) {
  if (aEvent.target != document)
    return;

  var distroId = Services.prefs.getCharPref("distribution.about", "");
  if (distroId) {
    var distroString = distroId;

    var distroVersion = Services.prefs.getCharPref("distribution.version", "");
    if (distroVersion) {
      distroString += " - " + distroVersion;
    }

    var distroIdField = document.getElementById("distributionId");
    distroIdField.value = distroString;
    distroIdField.style.display = "block";

    // DB-1148: Add platform and extension version to About dialog.
    let cliqzAddon = AddonManager.getAddonByID("cliqz@cliqz.com", cliqzAddon => {
      let componentsVersion = Services.appinfo.platformVersion;
      if (cliqzAddon) {
        componentsVersion += `+${cliqzAddon.version}`;
      }
      distroIdField.value += ` (${componentsVersion})`;

      // Append "(32-bit)" or "(64-bit)" build architecture to the version number:
      let bundle = Services.strings.createBundle("chrome://browser/locale/browser.properties");
      let archResource = Services.appinfo.is64Bit
                         ? "aboutDialog.architecture.sixtyFourBit"
                         : "aboutDialog.architecture.thirtyTwoBit";
      let arch = bundle.GetStringFromName(archResource);
      distroIdField.value += ` (${arch})`;
    });

#if 0
    var distroAbout = Services.prefs.getStringPref("distribution.about", "");
    if (distroAbout) {
      var distroField = document.getElementById("distribution");
      distroField.value = distroAbout;
      distroField.style.display = "block";
    }
#endif
  }

// Cliqz. We don't use "version" element in Cliqz browser at all
#if 0
  // Include the build ID and display warning if this is an "a#" (nightly or aurora) build
  let versionField = document.getElementById("version");
  let version = Services.appinfo.version;
  if (/a\d+$/.test(version)) {
    let buildID = Services.appinfo.appBuildID;
    let year = buildID.slice(0, 4);
    let month = buildID.slice(4, 6);
    let day = buildID.slice(6, 8);
    versionField.textContent += ` (${year}-${month}-${day})`;

    document.getElementById("experimental").hidden = false;
    document.getElementById("communityDesc").hidden = true;
  }
#endif

  // Show a release notes link if we have a URL.
  let relNotesLink = document.getElementById("releasenotes");
  let relNotesPrefType = Services.prefs.getPrefType("app.releaseNotesURL");
  if (relNotesPrefType != Services.prefs.PREF_INVALID) {
    let relNotesURL = Services.urlFormatter.formatURLPref("app.releaseNotesURL");
    if (relNotesURL != "about:blank") {
      relNotesLink.href = relNotesURL;
      relNotesLink.hidden = false;
    }
  }

  if (AppConstants.MOZ_UPDATER) {
    gAppUpdater = new appUpdater({ buttonAutoFocus: true });

    let channelLabel = document.getElementById("currentChannel");
    let currentChannelText = document.getElementById("currentChannelText");
    channelLabel.value = UpdateUtils.UpdateChannel;
    if (/^release($|\-)/.test(channelLabel.value))
        currentChannelText.hidden = true;
  }

  if (AppConstants.platform == "macosx") {
    // it may not be sized at this point, and we need its width to calculate its position
    window.sizeToContent();
    window.moveTo((screen.availWidth / 2) - (window.outerWidth / 2), screen.availHeight / 5);
  }
}
