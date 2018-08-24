/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sw=2 ts=2 sts=2 et */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*
 * Migrates from a Firefox profile in a lossy manner in order to clean up a
 * user's profile.  Data is only migrated where the benefits outweigh the
 * potential problems caused by importing undesired/invalid configurations
 * from the source profile.
 */


ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource:///modules/MigrationUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/Task.jsm");
ChromeUtils.import("resource://gre/modules/NetUtil.jsm");

ChromeUtils.defineModuleGetter(this, "PlacesBackups",
                               "resource://gre/modules/PlacesBackups.jsm");
ChromeUtils.defineModuleGetter(this, "SessionMigration",
                               "resource:///modules/sessionstore/SessionMigration.jsm");
ChromeUtils.defineModuleGetter(this, "OS",
                               "resource://gre/modules/osfile.jsm");
ChromeUtils.defineModuleGetter(this, "FileUtils",
                               "resource://gre/modules/FileUtils.jsm");
ChromeUtils.defineModuleGetter(this, "ProfileAge",
                               "resource://gre/modules/ProfileAge.jsm");
ChromeUtils.defineModuleGetter(this, "PlacesUtils",
                               "resource://gre/modules/PlacesUtils.jsm");
ChromeUtils.defineModuleGetter(this, "Sqlite",
                               "resource://gre/modules/Sqlite.jsm");
ChromeUtils.defineModuleGetter(this, "FormHistory",
                               "resource://gre/modules/FormHistory.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "INIParserFactory",
    "@mozilla.org/xpcom/ini-processor-factory;1", "nsIINIParserFactory");

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

/*
 * Ghostery
 * Getting profile paths for both cliqz and Firefox
 */

let plat = '';
#if defined(XP_WIN)
  plat = 'win';
#elif defined(XP_MACOSX)
  plat = 'mac';
#else
  plat = ''
#endif

let fxProductDir = '';
let cqProductDir = '';
if(plat == 'win') {
  fxProductDir = FileUtils.getDir("AppData", ["Mozilla", "Firefox"], false);
  cqProductDir = FileUtils.getDir("AppData", ["Cliqz"], false);
} else if (plat === 'mac') {
  fxProductDir = FileUtils.getDir("ULibDir", ["Application Support", "Firefox"], false);
  cqProductDir = FileUtils.getDir("ULibDir", ["Application Support", "Cliqz"], false);
} else {
  fxProductDir = FileUtils.getDir("Home", [".mozilla", "firefox"], false);
  cqProductDir = FileUtils.getDir("Home", [".cliqz", "cliqz"], false);
}

function getFile(path) {
  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  return file;
}

function* insertWholeBookmarkFolder(db, aId, aGuid) {
  let query = `SELECT b.id, h.url, COALESCE(b.title, h.title) AS title,
    b.type, k.keyword, b.dateAdded, b.lastModified
    FROM moz_bookmarks b
    LEFT JOIN moz_places h ON b.fk = h.id
    LEFT JOIN moz_keywords k ON k.id = b.keyword_id
    WHERE b.type IN (1,2) AND b.parent = ${aId}
    ORDER BY b.position;`;
  let rows = yield db.execute(query);
  let yieldCounter = 0;
  for (let row of rows) {
    let type = row.getResultByName("type");
    let title = row.getResultByName("title");
    let id = row.getResultByName("id");

    switch (type) {
      case PlacesUtils.bookmarks.TYPE_BOOKMARK: // Bookmark Url - Handle keyword and favicon
        let url = row.getResultByName("url");
        if (isValidUrl(url)) {
          yield PlacesUtils.bookmarks.insert({ parentGuid: aGuid,
                                               url,
                                               title,
                                             });
        }
        break;
      case PlacesUtils.bookmarks.TYPE_FOLDER: // Bookmark Folder - Handle Tag and Livemark (later)
        let newFolderGuid = (yield PlacesUtils.bookmarks.insert({
          parentGuid: aGuid,
          type: PlacesUtils.bookmarks.TYPE_FOLDER,
          title,
        })).guid;
        yield insertWholeBookmarkFolder(db, id, newFolderGuid); // Recursive insert bookmarks
        break;
    }

    // With many bookmarks we end up stealing the CPU - even with yielding!
    // So we let everyone else have a go every few items (bug 1186714).
    if (++yieldCounter % 50 == 0) {
      yield new Promise(resolve => {
        Services.tm.currentThread.dispatch(resolve, Ci.nsIThread.DISPATCH_NORMAL);
      });
    }
  }
}

function isValidUrl(aUrl) {
  let url = NetUtil.newURI(aUrl);
  // Filter out the URLs with unsupported schemes.
  const invalidSchemes = ["wyciwyg", "place", "about", "chrome"];
  if (invalidSchemes.indexOf(url.scheme) >= 0) return false;
  return true;
}

function FirefoxProfileMigrator() {
  this.wrappedJSObject = this; // for testing...
}

// For CLIQZ migrator
function CliqzProfileMigrator() {
  this.wrappedJSObject = this; // for testing...
}

// This Ghostery migrator is used for profile refresh.
function GhosteryProfileMigrator() {
  FirefoxProfileMigrator.apply(this);
}

FirefoxProfileMigrator.prototype = Object.create(MigratorPrototype);
CliqzProfileMigrator.prototype = Object.create(MigratorPrototype);

GhosteryProfileMigrator.prototype =
    Object.create(FirefoxProfileMigrator.prototype);

GhosteryProfileMigrator.prototype._getAllProfiles = function() {
  let allProfiles = new Map();
  let profiles =
    Cc["@mozilla.org/toolkit/profile-service;1"]
      .getService(Ci.nsIToolkitProfileService)
      .profiles;
  while (profiles.hasMoreElements()) {
    let profile = profiles.getNext().QueryInterface(Ci.nsIToolkitProfile);
    let rootDir = profile.rootDir;

    if (rootDir.exists() && rootDir.isReadable() &&
        !rootDir.equals(MigrationUtils.profileStartup.directory)) {
      allProfiles.set(profile.name, rootDir);
    }
  }
  return allProfiles;
};

FirefoxProfileMigrator.prototype._getAllProfiles = function() {
  const profiles = new Map();

  const dirPath = this instanceof CliqzProfileMigrator ? cqProductDir : fxProductDir;
  const profilesIni = dirPath.clone();
  profilesIni.append("profiles.ini");
  if (!(profilesIni.exists() &&
        profilesIni.isFile() &&
        profilesIni.isReadable()))
    return profiles;
  const iniParser = INIParserFactory.createINIParser(profilesIni);

  const sections = iniParser.getSections();
  const profileSectionNameRE = /^Profile\d+$/;
  while (sections.hasMore()) {
    const section = sections.getNext();
    if (!profileSectionNameRE.test(section))
      continue;
    try {
      // The following code tries to replicate one in
      // toolkit/profile/nsToolkitProfileService.cpp, Init() method.
      const path = iniParser.getString(section, "Path");
      const isRelative = iniParser.getString(section, "IsRelative") == "1";
      let profileDir = dirPath.clone();
      if (isRelative) {
        profileDir.setRelativeDescriptor(dirPath, path);
      }
      else {
        // TODO: Never saw absolute paths and never tested this.
        profileDir.persistentDescriptor = path;
      }

      profiles.set(iniParser.getString(section, "Name"), profileDir);
    }
    catch (e) {
      dump("Profiles.ini section: '" + section + "', error: " + e + "\n");
    }
  }

  return profiles;
};

function sorter(a, b) {
  return a.id.toLocaleLowerCase().localeCompare(b.id.toLocaleLowerCase());
}

FirefoxProfileMigrator.prototype.getSourceProfiles = function() {
  return [...this._getAllProfiles().keys()].map(x => ({id: x, name: x})).sort(sorter);
};

FirefoxProfileMigrator.prototype._getFileObject = function(dir, fileName) {
  let file = dir.clone();
  file.append(fileName);

  // File resources are monolithic.  We don't make partial copies since
  // they are not expected to work alone. Return null to avoid trying to
  // copy non-existing files.
  return file.exists() ? file : null;
};

FirefoxProfileMigrator.prototype.getResources = function(aProfile) {
  let sourceProfileDir = aProfile ? this._getAllProfiles().get(aProfile.id) :
    Cc["@mozilla.org/toolkit/profile-service;1"]
      .getService(Ci.nsIToolkitProfileService)
      .selectedProfile.rootDir;
  if (!sourceProfileDir || !sourceProfileDir.exists() ||
      !sourceProfileDir.isReadable())
    return null;

  // Being a startup-only migrator, we can rely on
  // MigrationUtils.profileStartup being set.
  let currentProfileDir = null;
  if (!this.startupOnlyMigrator && !MigrationUtils.isStartupMigration) {
    currentProfileDir = FileUtils.getDir("ProfD","");
  }
  else {
    currentProfileDir = MigrationUtils.profileStartup.directory;
  }

  // Surely data cannot be imported from the current profile.
  if (sourceProfileDir.equals(currentProfileDir))
    return null;

  return this._getResourcesInternal(sourceProfileDir, currentProfileDir);
};

FirefoxProfileMigrator.prototype.getLastUsedDate = function() {
  // We always pretend we're really old, so that we don't mess
  // up the determination of which browser is the most 'recent'
  // to import from.
  return Promise.resolve(new Date(0));
};

FirefoxProfileMigrator.prototype._getResourcesInternal = function(sourceProfileDir, currentProfileDir) {
  const isCliqz = this instanceof CliqzProfileMigrator;
  let getFileResource = (aMigrationType, aFileNames) => {
    let files = [];
    for (let fileName of aFileNames) {
      let file = this._getFileObject(sourceProfileDir, fileName);
      if (file)
        files.push(file);
    }
    if (!files.length) {
      return null;
    }
    return {
      type: aMigrationType,
      migrate(aCallback) {
        for (let file of files) {
          file.copyTo(currentProfileDir, "");
        }
        aCallback(true);
      },
    };
  };

  let getHistoryAndBookmarksResource = function(aFileName) {
    let placesFile = this._getFileObject(sourceProfileDir, aFileName);
    if (!placesFile)
      return null;

    return {
      type: MigrationUtils.resourceTypes.HISTORY,

      migrate(aCallback) {
        return Task.spawn(function* () {
          let db = yield Sqlite.openConnection({
            path: placesFile.path
          });

          try {
            // IMPORT BOOKMARKS
            const topBookmarkFolderGuids = [
                                            "menu________",
                                            "toolbar_____",
                                            "unfiled_____"
                                            ];
            let parentGuid = PlacesUtils.bookmarks.menuGuid;
            // Create Firefox bookmarks folder on Bookmarks Menu
            parentGuid = (yield PlacesUtils.bookmarks.insert({
              parentGuid,
              type: PlacesUtils.bookmarks.TYPE_FOLDER,
              title: isCliqz ? 'Cliqz' : 'Firefox',
            })).guid;
            // Create top bookmarks folders on Firefox bookmarks folder and recursively insert child bookmarks
            for (let guid of topBookmarkFolderGuids) {
              let query = `SELECT b.id, b.title
                          FROM moz_bookmarks b
                          WHERE b.type = 2 AND b.guid = '${guid}'
                          ORDER BY b.position`;
              let rows = yield db.execute(query);
              if (rows.length > 0) {
                let title = rows[0].getResultByName("title");
                let id = rows[0].getResultByName("id");
                let folderGuid = (yield PlacesUtils.bookmarks.insert({
                  parentGuid,
                  type: PlacesUtils.bookmarks.TYPE_FOLDER,
                  title,
                })).guid;
                yield insertWholeBookmarkFolder(db, id, folderGuid);
              }
            }

            // IMPORT HISTORY
            let rows = yield db.execute(`SELECT h.url, h.title, v.visit_type, v.visit_date
                                        FROM moz_places h JOIN moz_historyvisits v
                                        ON h.id = v.place_id
                                        WHERE v.visit_type <= 3;`);
            let places = [];
            for (let row of rows) {
              try {
                places.push({
                  uri: NetUtil.newURI(row.getResultByName("url")),
                  title: row.getResultByName("title"),
                  visits: [{
                    transitionType: row.getResultByName("visit_type"),
                    visitDate: row.getResultByName("visit_date"),
                  }],
                });
              } catch (e) {
                Cu.reportError(e);
              }
            }

            if (places.length > 0) {
              yield new Promise((resolve, reject) => {
                PlacesUtils.asyncHistory.updatePlaces(places, {
                  _success: false,
                  handleResult: function() {
                    // Importing any entry is considered a successful import.
                    this._success = true;
                  },
                  handleError: function() {},
                  handleCompletion: function() {
                    if (this._success) {
                      resolve();
                    } else {
                      reject(new Error("Couldn't add visits"));
                    }
                  }
                });
              });
            }
          } finally {
            yield db.close();
          }
        }).then(() => { aCallback(true); },
                ex => {
                  Cu.reportError(ex);
                  aCallback(false);
                });
      }
    };
  }.bind(this);

  let getPasswordsResource = function(aFileName) {
    let passwordsFile = this._getFileObject(sourceProfileDir, aFileName);
    if (!passwordsFile)
      return null;

    return {
      type: MigrationUtils.resourceTypes.PASSWORDS,

      migrate(aCallback) {
        return Task.spawn(function* () {
          let jsonStream = yield new Promise(resolve =>
            NetUtil.asyncFetch({ uri: NetUtil.newURI(passwordsFile),
                                 loadUsingSystemPrincipal: true
                               },
                               (inputStream, resultCode) => {
                                 if (Components.isSuccessCode(resultCode)) {
                                   resolve(inputStream);
                                 } else {
                                   reject(new Error("Could not read Passwords file"));
                                 }
                               }
            )
          );

          // Parse password file that is JSON format
          let passwordJSON = NetUtil.readInputStreamToString(
            jsonStream, jsonStream.available(), { charset : "UTF-8" });
          let logins = JSON.parse(passwordJSON).logins;
          const crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].
                      getService(Ci.nsILoginManagerCrypto);
          try {
            // Importing password items
            if (logins && logins.length > 0) {
              for(let loginInfo of logins) {
                let login = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);
                login.init(loginInfo.hostname, loginInfo.formSubmitURL, loginInfo.httpRealm,
                           crypto.decrypt(loginInfo.encryptedUsername),
                           crypto.decrypt(loginInfo.encryptedPassword),
                           loginInfo.usernameField,
                           loginInfo.passwordField);
                login.QueryInterface(Ci.nsILoginMetaInfo);
                login.timeCreated = loginInfo.timeCreated;
                login.timeLastUsed = loginInfo.timeLastUsed;
                login.timePasswordChanged = loginInfo.timePasswordChanged;
                login.timesUsed = loginInfo.timesUsed;
                //login.encType will be automatic generated;

                // Add the login only if there's not an existing entry
                let logins = Services.logins.findLogins({}, login.hostname,
                                                        login.formSubmitURL,
                                                        login.httpRealm);

                // Bug 1187190: Password changes should be propagated depending on timestamps.
                if (!logins.some(l => login.matches(l, true))) {
                  Services.logins.addLogin(login);
                }
              }
            }
          } finally {
            yield jsonStream.close(); // Re-Check if it's necessary to close or not
          }
        }).then(() => aCallback(true),
        e => { Cu.reportError(e); aCallback(false) });
      }
    };
  }.bind(this);

  let getCookiesResource = function(aFileName) {
    let cookiesFile = this._getFileObject(sourceProfileDir, aFileName);
    if (!cookiesFile)
      return null;

    return {
      type: MigrationUtils.resourceTypes.COOKIES,

      migrate(aCallback) {
        return Task.spawn(function* () {
          let db = yield Sqlite.openConnection({
            path: cookiesFile.path
          });

          try {
            let rows = yield db.execute(`SELECT name, value,
                                                host, path,
                                                expiry, isSecure,
                                                isHttpOnly
                                          FROM moz_cookies`);
            for(let row of rows) {
              Services.cookies.add(row.getResultByName("host"),
                                   row.getResultByName("path"),
                                   row.getResultByName("name"),
                                   row.getResultByName("value"),
                                   row.getResultByName("isSecure"),
                                   row.getResultByName("isHttpOnly"),
                                   false,
                                   row.getResultByName("expiry"),
                                   {});
            }
          } finally {
            yield db.close();
          }
        }).then(() => aCallback(true),
        e => { Cu.reportError(e); aCallback(false) });
      }
    };
  }.bind(this);

  let getFormDataResource = function(aFileName) {
    let formDataFile = this._getFileObject(sourceProfileDir, aFileName);
    if (!formDataFile)
      return null;

    return {
      type: MigrationUtils.resourceTypes.FORMDATA,

      migrate(aCallback) {
        return Task.spawn(function* () {
          let db = yield Sqlite.openConnection({
            path: formDataFile.path
          });

          try {
            let rows = yield db.execute(`SELECT fieldname,
                                                value,
                                                timesUsed,
                                                firstUsed,
                                                lastUsed
                                        FROM moz_formhistory`);
            let changes = [];
            for(let row of rows) {
              changes.push({
                            op: "add",
                            fieldname: row.getResultByName("fieldname"),
                            value:     row.getResultByName("value"),
                            timesUsed: row.getResultByName("timesUsed"),
                            firstUsed: row.getResultByName("firstUsed"),
                            lastUsed:  row.getResultByName("lastUsed"),
                          });
            }
            FormHistory.update(changes);
          } finally {
            yield db.close();
          }
        }).then(() => aCallback(true),
        e => { Cu.reportError(e); aCallback(false) });
      }
    };
  }.bind(this);

  function savePrefs() {
    // If we've used the pref service to write prefs for the new profile, it's too
    // early in startup for the service to have a profile directory, so we have to
    // manually tell it where to save the prefs file.
    let newPrefsFile = currentProfileDir.clone();
    newPrefsFile.append("prefs.js");
    Services.prefs.savePrefFile(newPrefsFile);
  }

  let types = MigrationUtils.resourceTypes;
  if (!this.startupOnlyMigrator && !MigrationUtils.isStartupMigration) {
    let places = getHistoryAndBookmarksResource("places.sqlite");
    let cookies = getCookiesResource("cookies.sqlite");
    let formData = getFormDataResource("formhistory.sqlite");
    return [places, cookies, formData].filter(r => r);
  }
  let places = getFileResource(types.HISTORY, ["places.sqlite"]);
  let favicons = getFileResource(types.HISTORY, ["favicons.sqlite"]);
  let cookies = getFileResource(types.COOKIES, ["cookies.sqlite"]);
// TODO more accurate merge
//  let places = getFileResource(types.HISTORY, ["places.sqlite", "places.sqlite-wal"]);
//  let favicons = getFileResource(types.HISTORY, ["favicons.sqlite", "favicons.sqlite-wal"]);
//  let cookies = getFileResource(types.COOKIES, ["cookies.sqlite", "cookies.sqlite-wal"]);
  let passwords = getFileResource(types.PASSWORDS,
    ["signons.sqlite", "logins.json", "key3.db", "key4.db"]);
  let formData = getFileResource(types.FORMDATA, [
    "formhistory.sqlite",
    "autofill-profiles.json",
  ]);
  let bookmarksBackups = getFileResource(types.OTHERDATA,
    [PlacesBackups.profileRelativeFolderPath]);
  let dictionary = getFileResource(types.OTHERDATA, ["persdict.dat"]);

  let session;
  let env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  if (env.get("MOZ_RESET_PROFILE_MIGRATE_SESSION")) {
    // We only want to restore the previous firefox session if the profile refresh was
    // triggered by user. The MOZ_RESET_PROFILE_MIGRATE_SESSION would be set when a user-triggered
    // profile refresh happened in nsAppRunner.cpp. Hence, we detect the MOZ_RESET_PROFILE_MIGRATE_SESSION
    // to see if session data migration is required.
    env.set("MOZ_RESET_PROFILE_MIGRATE_SESSION", "");
    let sessionCheckpoints = this._getFileObject(sourceProfileDir, "sessionCheckpoints.json");
    let sessionFile = this._getFileObject(sourceProfileDir, "sessionstore.jsonlz4");
    if (sessionFile) {
      let tabsRestoreURL = this.tabsRestoreURL;
      session = {
        type: types.SESSION,
        migrate(aCallback) {
          sessionCheckpoints.copyTo(currentProfileDir, "sessionCheckpoints.json");
          let newSessionFile = currentProfileDir.clone();
          newSessionFile.append("sessionstore.jsonlz4");
          let migrationPromise = SessionMigration.migrate(sessionFile.path,
              newSessionFile.path, tabsRestoreURL);
          migrationPromise.then(function() {
            let buildID = Services.appinfo.platformBuildID;
            let mstone = Services.appinfo.platformVersion;
            // Force the browser to one-off resume the session that we give it:
            Services.prefs.setBoolPref("browser.sessionstore.resume_session_once", true);
            // Reset the homepage_override prefs so that the browser doesn't override our
            // session with the "what's new" page:
            Services.prefs.setCharPref("browser.startup.homepage_override.mstone", mstone);
            Services.prefs.setCharPref("browser.startup.homepage_override.buildID", buildID);
            savePrefs();
            aCallback(true);
          }, function() {
            aCallback(false);
          });
        },
      };
    }
  }

  // Sync/FxA related data
  let sync = {
    name: "sync", // name is used only by tests.
    type: types.OTHERDATA,
    migrate: async aCallback => {
        // Try and parse a signedInUser.json file from the source directory and
        // if we can, copy it to the new profile and set sync's username pref
        // (which acts as a de-facto flag to indicate if sync is configured)
      try {
        let oldPath = OS.Path.join(sourceProfileDir.path, "signedInUser.json");
        let exists = await OS.File.exists(oldPath);
        if (exists) {
          let raw = await OS.File.read(oldPath, {encoding: "utf-8"});
          let data = JSON.parse(raw);
          if (data && data.accountData && data.accountData.email) {
            let username = data.accountData.email;
            // Write it to prefs.js and flush the file.
            Services.prefs.setStringPref("services.sync.username", username);
            savePrefs();
            // and copy the file itself.
            await OS.File.copy(oldPath, OS.Path.join(currentProfileDir.path, "signedInUser.json"));
          }
        }
      } catch (ex) {
        aCallback(false);
        return;
      }
      aCallback(true);
    },
  };

  // Telemetry related migrations.
  const doingProfileReset = this instanceof GhosteryProfileMigrator;
  let times = {
    name: "times", // name is used only by tests.
    type: types.OTHERDATA,
    migrate: aCallback => {
      let file = this._getFileObject(sourceProfileDir, "times.json");
      if (file) {
        file.copyTo(currentProfileDir, "");
      }

      // Don't record profile reset when just importing from Firefox.
      if (!doingProfileReset)
        return aCallback(true);

      // And record the fact a migration (ie, a reset) happened.
      let timesAccessor = new ProfileAge(currentProfileDir.path);
      timesAccessor.recordProfileReset().then(
        () => aCallback(true),
        () => aCallback(false)
      );
    },
  };
  let telemetry = {
    name: "telemetry", // name is used only by tests...
    type: types.OTHERDATA,
    migrate: aCallback => {
      let createSubDir = (name) => {
        let dir = currentProfileDir.clone();
        dir.append(name);
        dir.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
        return dir;
      };

      // If the 'datareporting' directory exists we migrate files from it.
      let dataReportingDir = this._getFileObject(sourceProfileDir, "datareporting");
      if (dataReportingDir && dataReportingDir.isDirectory()) {
        // Copy only specific files.
        let toCopy = ["state.json", "session-state.json"];

        let dest = createSubDir("datareporting");
        let enumerator = dataReportingDir.directoryEntries;
        while (enumerator.hasMoreElements()) {
          let file = enumerator.getNext().QueryInterface(Ci.nsIFile);
          if (file.isDirectory() || !toCopy.includes(file.leafName)) {
            continue;
          }
          file.copyTo(dest, "");
        }
      }

      aCallback(true);
    },
  };

  return [places, cookies, passwords, formData, dictionary, bookmarksBackups,
          session, sync, times, telemetry, favicons].filter(r => r);
};

Object.defineProperty(FirefoxProfileMigrator.prototype, "isFirefoxMigrator", {
  // Cliqz
  // This is FF migrator (need to correct migration process in MigrationUtils.jsm)
  get: () => true,
});

Object.defineProperty(FirefoxProfileMigrator.prototype, "tabsRestoreURL", {
  get: () => "about:importedtabs"
});

Object.defineProperty(GhosteryProfileMigrator.prototype, "tabsRestoreURL", {
  get: () => "about:welcomeback"
});

Object.defineProperty(FirefoxProfileMigrator.prototype, "startupOnlyMigrator", {
  // Cliqz
  // Use not only as startup migrator, but as option to import from FF later
  get: () => false
});

Object.defineProperty(GhosteryProfileMigrator.prototype, "startupOnlyMigrator", {
  // Ghostery
  // Use not only as startup migrator, but as option to import from FF later
  get: () => true
});

/*
 * Extend all methods of Firefox Migrator
 * - inheriting same functionality for CLIQZ migration
 */

CliqzProfileMigrator.prototype = Object.create(FirefoxProfileMigrator.prototype);

FirefoxProfileMigrator.prototype.classDescription = "Firefox Profile Migrator";
FirefoxProfileMigrator.prototype.contractID = "@mozilla.org/profile/migrator;1?app=browser&type=firefox";
FirefoxProfileMigrator.prototype.classID = Components.ID("{91185366-ba97-4438-acba-48deaca63386}");

CliqzProfileMigrator.prototype.classDescription = "Cliqz Profile Migrator";
CliqzProfileMigrator.prototype.contractID = "@mozilla.org/profile/migrator;1?app=browser&type=cliqz";
CliqzProfileMigrator.prototype.classID = Components.ID("{f8cfe235-2127-4f42-894f-f8fdf2969233}");

/*
 * component ID from BrowserProfileMigrators.manifest
 */

GhosteryProfileMigrator.prototype.classDescription = "Ghostery Profile Migrator";
GhosteryProfileMigrator.prototype.contractID = "@mozilla.org/profile/migrator;1?app=browser&type=ghostery";
GhosteryProfileMigrator.prototype.classID = Components.ID("{a8cde235-2343-4d42-893f-a8adf2339233}");

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([
    FirefoxProfileMigrator,
    CliqzProfileMigrator,
    GhosteryProfileMigrator
]);
