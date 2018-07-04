/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Ci, CC } = require("chrome");
const Services = require("Services");
const l10n = require("gcli/l10n");

function showFolder(path) {
  let NSLocalFile = CC("@mozilla.org/file/local;1", "nsIFile",
                        "initWithPath");

  try {
    let file = new NSLocalFile(path);

    if (file.exists()) {
      file.reveal();
      return l10n.lookupFormat("folderOpenDirResult", [path]);
    }
    return l10n.lookup("folderInvalidPath");
  } catch (e) {
    return l10n.lookup("folderInvalidPath");
  }
}

exports.items = [
  {
    name: "folder",
    description: l10n.lookup("folderDesc")
  },
  {
    item: "command",
    runAt: "client",
    name: "folder open",
    description: l10n.lookup("folderOpenDesc"),
    params: [
      {
        name: "path",
        type: { name: "string", allowBlank: true },
        defaultValue: "~",
        description: l10n.lookup("folderOpenDir")
      }
    ],
    returnType: "string",
    exec: function(args, context) {
      let dirName = args.path;

      // replaces ~ with the home directory path in unix and windows
      if (dirName.indexOf("~") == 0) {
        let homeDirFile = Services.dirsvc.get("Home", Ci.nsIFile);
        let homeDir = homeDirFile.path;
        dirName = dirName.substr(1);
        dirName = homeDir + dirName;
      }

      return showFolder(dirName);
    }
  },
  {
    item: "command",
    runAt: "client",
    name: "folder openprofile",
    description: l10n.lookup("folderOpenProfileDesc"),
    returnType: "string",
    exec: function(args, context) {
      // Get the profile directory.
      let currProfD = Services.dirsvc.get("ProfD", Ci.nsIFile);
      let profileDir = currProfD.path;
      return showFolder(profileDir);
    }
  }
];
