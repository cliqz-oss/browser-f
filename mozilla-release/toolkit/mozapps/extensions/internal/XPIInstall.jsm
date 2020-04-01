
/*LS-862780*/var { CliqzLogger } = ChromeUtils.import('resource://gre/modules/CliqzLogger.jsm');
var __L_V__7 = CliqzLogger.init('mozilla-release/toolkit/mozapps/extensions/internal/XPIInstall.jsm','XPIInstall');/*LE-862780*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * This file contains most of the logic required to install extensions.
 * In general, we try to avoid loading it until extension installation
 * or update is required. Please keep that in mind when deciding whether
 * to add code here or elsewhere.
 */

/**
 * @typedef {number} integer
 */

/* eslint "valid-jsdoc": [2, {requireReturn: false, requireReturnDescription: false, prefer: {return: "returns"}}] */

var EXPORTED_SYMBOLS = [
  "UpdateChecker",
  "XPIInstall",
  "verifyBundleSignedState",
];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { AddonManager, AddonManagerPrivate } = ChromeUtils.import(
  "resource://gre/modules/AddonManager.jsm"
);

XPCOMUtils.defineLazyGlobalGetters(this, [
  "TextDecoder",
  "TextEncoder",
  "fetch",
]);

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonRepository: "resource://gre/modules/addons/AddonRepository.jsm",
  AddonSettings: "resource://gre/modules/addons/AddonSettings.jsm",
  AppConstants: "resource://gre/modules/AppConstants.jsm",
  CertUtils: "resource://gre/modules/CertUtils.jsm",
  ExtensionData: "resource://gre/modules/Extension.jsm",
  FileUtils: "resource://gre/modules/FileUtils.jsm",
  NetUtil: "resource://gre/modules/NetUtil.jsm",
  OS: "resource://gre/modules/osfile.jsm",
  ProductAddonChecker: "resource://gre/modules/addons/ProductAddonChecker.jsm",
  UpdateUtils: "resource://gre/modules/UpdateUtils.jsm",

  AddonInternal: "resource://gre/modules/addons/XPIDatabase.jsm",
  XPIDatabase: "resource://gre/modules/addons/XPIDatabase.jsm",
  XPIInternal: "resource://gre/modules/addons/XPIProvider.jsm",
});

XPCOMUtils.defineLazyServiceGetter(
  this,
  "uuidGen",
  "@mozilla.org/uuid-generator;1",
  "nsIUUIDGenerator"
);

XPCOMUtils.defineLazyGetter(this, "IconDetails", () => {
  return ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm", {})
    .ExtensionParent.IconDetails;
});

const { nsIBlocklistService } = Ci;

const nsIFile = Components.Constructor(
  "@mozilla.org/file/local;1",
  "nsIFile",
  "initWithPath"
);

const BinaryOutputStream = Components.Constructor(
  "@mozilla.org/binaryoutputstream;1",
  "nsIBinaryOutputStream",
  "setOutputStream"
);
const CryptoHash = Components.Constructor(
  "@mozilla.org/security/hash;1",
  "nsICryptoHash",
  "initWithString"
);
const FileInputStream = Components.Constructor(
  "@mozilla.org/network/file-input-stream;1",
  "nsIFileInputStream",
  "init"
);
const FileOutputStream = Components.Constructor(
  "@mozilla.org/network/file-output-stream;1",
  "nsIFileOutputStream",
  "init"
);
const ZipReader = Components.Constructor(
  "@mozilla.org/libjar/zip-reader;1",
  "nsIZipReader",
  "open"
);

XPCOMUtils.defineLazyServiceGetters(this, {
  gCertDB: ["@mozilla.org/security/x509certdb;1", "nsIX509CertDB"],
});

const PREF_INSTALL_REQUIRESECUREORIGIN =
  "extensions.install.requireSecureOrigin";
const PREF_PENDING_OPERATIONS = "extensions.pendingOperations";
const PREF_SYSTEM_ADDON_UPDATE_URL = "extensions.systemAddon.update.url";
const PREF_XPI_ENABLED = "xpinstall.enabled";
const PREF_XPI_DIRECT_WHITELISTED = "xpinstall.whitelist.directRequest";
const PREF_XPI_FILE_WHITELISTED = "xpinstall.whitelist.fileRequest";
const PREF_XPI_WHITELIST_REQUIRED = "xpinstall.whitelist.required";

const PREF_SELECTED_LWT = "lightweightThemes.selectedThemeID";

const TOOLKIT_ID = "toolkit@mozilla.org";

/* globals BOOTSTRAP_REASONS, KEY_APP_SYSTEM_ADDONS, KEY_APP_SYSTEM_DEFAULTS, PREF_BRANCH_INSTALLED_ADDON, PREF_SYSTEM_ADDON_SET, TEMPORARY_ADDON_SUFFIX, XPI_PERMISSION, XPIStates, getURIForResourceInFile, iterDirectory */
const XPI_INTERNAL_SYMBOLS = [
  "BOOTSTRAP_REASONS",
  "KEY_APP_SYSTEM_ADDONS",
  "KEY_APP_SYSTEM_DEFAULTS",
  "PREF_BRANCH_INSTALLED_ADDON",
  "PREF_SYSTEM_ADDON_SET",
  "TEMPORARY_ADDON_SUFFIX",
  "XPI_PERMISSION",
  "XPIStates",
  "getURIForResourceInFile",
  "iterDirectory",
];

for (let name of XPI_INTERNAL_SYMBOLS) {
  XPCOMUtils.defineLazyGetter(this, name, () => XPIInternal[name]);
}

/**
 * Returns a nsIFile instance for the given path, relative to the given
 * base file, if provided.
 *
 * @param {string} path
 *        The (possibly relative) path of the file.
 * @param {nsIFile} [base]
 *        An optional file to use as a base path if `path` is relative.
 * @returns {nsIFile}
 */
function getFile(path, base = null) {
__L_V__7({
    lN: 151,tT:'func',pr:'',eT:{'path':path,'base':base},fN:'getFile'
  });'__L_V__7';
  // First try for an absolute path, as we get in the case of proxy
  // files. Ideally we would try a relative path first, but on Windows,
  // paths which begin with a drive letter are valid as relative paths,
  // and treated as such.
  try {
    return new nsIFile(path);
  } catch (e) {
    // Ignore invalid relative paths. The only other error we should see
    // here is EOM, and either way, any errors that we care about should
    // be re-thrown below.
  }

  // If the path isn't absolute, we must have a base path.
  let file = base.clone();
  file.appendRelativePath(path);
  return file;
}

/**
 * Sends local and remote notifications to flush a JAR file cache entry
 *
 * @param {nsIFile} aJarFile
 *        The ZIP/XPI/JAR file as a nsIFile
 */
function flushJarCache(aJarFile) {
__L_V__7({
    lN: 176,tT:'func',pr:'',eT:{'aJarFile':aJarFile},fN:'flushJarCache'
  });'__L_V__7';
  Services.obs.notifyObservers(aJarFile, "flush-cache-entry");
  Services.mm.broadcastAsyncMessage(MSG_JAR_FLUSH, aJarFile.path);
}

const PREF_EM_UPDATE_BACKGROUND_URL = "extensions.update.background.url";
const PREF_EM_UPDATE_URL = "extensions.update.url";
const PREF_XPI_SIGNATURES_DEV_ROOT = "xpinstall.signatures.dev-root";
const PREF_INSTALL_REQUIREBUILTINCERTS =
  "extensions.install.requireBuiltInCerts";

const KEY_PROFILEDIR = "ProfD";
const KEY_TEMPDIR = "TmpD";

const KEY_APP_PROFILE = "app-profile";

const DIR_STAGE = "staged";
const DIR_TRASH = "trash";

// This is a random number array that can be used as "salt" when generating
// an automatic ID based on the directory path of an add-on. It will prevent
// someone from creating an ID for a permanent add-on that could be replaced
// by a temporary add-on (because that would be confusing, I guess).
const TEMP_INSTALL_ID_GEN_SESSION = new Uint8Array(
  Float64Array.of(Math.random()).buffer
);

const MSG_JAR_FLUSH = "AddonJarFlush";

/**
 * Valid IDs fit this pattern.
 */
var gIDTest = /^(\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}|[a-z0-9-\._]*\@[a-z0-9-\._]+)$/i;

const { Log } = ChromeUtils.import("resource://gre/modules/Log.jsm");
const LOGGER_ID = "addons.xpi";

// Create a new logger for use by all objects in this Addons XPI Provider module
// (Requires AddonManager.jsm)
var logger = Log.repository.getLogger(LOGGER_ID);

// Stores the ID of the lightweight theme which was selected during the
// last session, if any. When installing a new built-in theme with this
// ID, it will be automatically enabled.
let lastLightweightTheme = null;

function getJarURI(file, path = "") {
__L_V__7({
    lN: 222,tT:'func',pr:'',eT:{'file':file,'path':path},fN:'getJarURI'
  });'__L_V__7';
  if (file instanceof Ci.nsIFile) {
__L_V__7({
    lN: 223,tT:'if',pr:'file instanceof Ci.nsIFile',eT:{},fN:''
  });'__L_V__7';
    file = Services.io.newFileURI(file);
  }
  if (file instanceof Ci.nsIURI) {
__L_V__7({
    lN: 226,tT:'if',pr:'file instanceof Ci.nsIURI',eT:{},fN:''
  });'__L_V__7';
    file = file.spec;
  }
  return Services.io.newURI(`jar:${file}!/${path}`);
}

let DirPackage;
let XPIPackage;
class Package {
  static get(file) {
__L_V__7({
    lN: 235,tT:'func',pr:'',eT:{'file':file},fN:'get'
  });'__L_V__7';
    if (file.isFile()) {
__L_V__7({
    lN: 236,tT:'if',pr:'file.isFile()',eT:{},fN:''
  });'__L_V__7';
      return new XPIPackage(file);
    }
    return new DirPackage(file);
  }

  constructor(file, rootURI) {
__L_V__7({
    lN: 242,tT:'func',pr:'',eT:{'file':file,'rootURI':rootURI},fN:'constructor'
  });'__L_V__7';
    this.file = file;
    this.filePath = file.path;
    this.rootURI = rootURI;
  }

  close() {
__L_V__7({
    lN: 248,tT:'func',pr:'',eT:{},fN:'close'
  });'__L_V__7';}

  async readString(...path) {
__L_V__7({
    lN: 250,tT:'func',pr:'',eT:{'path':path},fN:'readString'
  });'__L_V__7';
    let buffer = await this.readBinary(...path);
    return new TextDecoder().decode(buffer);
  }

  async verifySignedState(addon) {
__L_V__7({
    lN: 255,tT:'func',pr:'',eT:{'addon':addon},fN:'verifySignedState'
  });'__L_V__7';
    if (!shouldVerifySignedState(addon)) {
__L_V__7({
    lN: 256,tT:'if',pr:'!shouldVerifySignedState(addon)',eT:{},fN:''
  });'__L_V__7';
      return {
        signedState: AddonManager.SIGNEDSTATE_NOT_REQUIRED,
        cert: null,
      };
    }

    /*
     * CLIQZ - allow both Firefox and Cliqz certificate for installing addons
     * Prevent pre integrated addons from installing - Cliqz/Ghostery/HttpsEverywhere
     */

    const rootCliqz = Ci.nsIX509CertDB.CliqzAddonsRoot;
    let rootFirefox = Ci.nsIX509CertDB.AddonsPublicRoot;

    if (!AppConstants.MOZ_REQUIRE_SIGNING &&
        Services.prefs.getBoolPref(PREF_XPI_SIGNATURES_DEV_ROOT, false)) {
__L_V__7({
    lN: 272,tT:'if',pr:'!AppConstants.MOZ_REQUIRE_SIGNING && Services.prefs.getBoolPref(PREF_XPI_SIGNATURES_DEV_ROOT, false)',eT:{},fN:''
  });'__L_V__7';
      rootFirefox = Ci.nsIX509CertDB.AddonsStageRoot;
    }

    const CliqzSigned = await this.verifySignedStateForRoot(addon, rootCliqz);
    const {signedState: isCliqzSigned} = CliqzSigned;

    if (isCliqzSigned > 0)
      return CliqzSigned;

    const PREF_CLIQZ_ADDONS = 'browser.cliqz.integrated';
    if (Services.prefs.getPrefType(PREF_CLIQZ_ADDONS) == Services.prefs.PREF_STRING) {
__L_V__7({
    lN: 283,tT:'if',pr:'Services.prefs.getPrefType(PREF_CLIQZ_ADDONS) == Services.prefs.PREF_STRING',eT:{},fN:''
  });'__L_V__7';
      const integratedAddons = Services.prefs.getCharPref(PREF_CLIQZ_ADDONS) || '';
      if (integratedAddons.includes(addon.id)) {
__L_V__7({
    lN: 285,tT:'if',pr:'integratedAddons.includes(addon.id)',eT:{},fN:''
  });'__L_V__7';
        return {
          signedState: AddonManager.SIGNEDSTATE_CLIQZ,
          cert: null
        };
      }
    }

    return this.verifySignedStateForRoot(addon, rootFirefox)
  }

  flushCache() {
__L_V__7({
    lN: 296,tT:'func',pr:'',eT:{},fN:'flushCache'
  });'__L_V__7';}
}

DirPackage = class DirPackage extends Package {
  constructor(file) {
__L_V__7({
    lN: 300,tT:'func',pr:'',eT:{'file':file},fN:'constructor'
  });'__L_V__7';
    super(file, Services.io.newFileURI(file));
  }

  hasResource(...path) {
__L_V__7({
    lN: 304,tT:'func',pr:'',eT:{'path':path},fN:'hasResource'
  });'__L_V__7';
    return OS.File.exists(OS.Path.join(this.filePath, ...path));
  }

  async iterDirectory(path, callback) {
__L_V__7({
    lN: 308,tT:'func',pr:'',eT:{'path':path,'callback':callback},fN:'iterDirectory'
  });'__L_V__7';
    let fullPath = OS.Path.join(this.filePath, ...path);

    let iter = new OS.File.DirectoryIterator(fullPath);
    await iter.forEach(callback);
    iter.close();
  }

  iterFiles(callback, path = []) {
__L_V__7({
    lN: 316,tT:'func',pr:'',eT:{'callback':callback,'path':path},fN:'iterFiles'
  });'__L_V__7';
    return this.iterDirectory(path, async entry => {
      let entryPath = [...path, entry.name];
      if (entry.isDir) {
__L_V__7({
    lN: 319,tT:'if',pr:'entry.isDir',eT:{},fN:''
  });'__L_V__7';
        callback({
          path: entryPath.join("/"),
          isDir: true,
        });
        await this.iterFiles(callback, entryPath);
      } else {
        callback({
          path: entryPath.join("/"),
          isDir: false,
        });
      }
    });
  }

  readBinary(...path) {
__L_V__7({
    lN: 334,tT:'func',pr:'',eT:{'path':path},fN:'readBinary'
  });'__L_V__7';
    return OS.File.read(OS.Path.join(this.filePath, ...path));
  }

  async verifySignedStateForRoot(addon, root) {
__L_V__7({
    lN: 338,tT:'func',pr:'',eT:{'addon':addon,'root':root},fN:'verifySignedStateForRoot'
  });'__L_V__7';
    return { signedState: AddonManager.SIGNEDSTATE_UNKNOWN, cert: null };
  }
};

XPIPackage = class XPIPackage extends Package {
  constructor(file) {
__L_V__7({
    lN: 344,tT:'func',pr:'',eT:{'file':file},fN:'constructor'
  });'__L_V__7';
    super(file, getJarURI(file));

    this.zipReader = new ZipReader(file);
  }

  close() {
__L_V__7({
    lN: 350,tT:'func',pr:'',eT:{},fN:'close'
  });'__L_V__7';
    this.zipReader.close();
    this.zipReader = null;
    this.flushCache();
  }

  async hasResource(...path) {
__L_V__7({
    lN: 356,tT:'func',pr:'',eT:{'path':path},fN:'hasResource'
  });'__L_V__7';
    return this.zipReader.hasEntry(path.join("/"));
  }

  async iterFiles(callback) {
__L_V__7({
    lN: 360,tT:'func',pr:'',eT:{'callback':callback},fN:'iterFiles'
  });'__L_V__7';
    for (let path of this.zipReader.findEntries("*")) {
      let entry = this.zipReader.getEntry(path);
      callback({
        path,
        isDir: entry.isDirectory,
      });
    }
  }

  async readBinary(...path) {
__L_V__7({
    lN: 370,tT:'func',pr:'',eT:{'path':path},fN:'readBinary'
  });'__L_V__7';
    let response = await fetch(this.rootURI.resolve(path.join("/")));
    return response.arrayBuffer();
  }

  verifySignedStateForRoot(addon, root) {
__L_V__7({
    lN: 375,tT:'func',pr:'',eT:{'addon':addon,'root':root},fN:'verifySignedStateForRoot'
  });'__L_V__7';
    return new Promise(resolve => {
      let callback = {
        openSignedAppFileFinished(aRv, aZipReader, aCert) {
__L_V__7({
    lN: 378,tT:'func',pr:'',eT:{'aRv':aRv,'aZipReader':aZipReader,'aCert':aCert},fN:'openSignedAppFileFinished'
  });'__L_V__7';
          if (aZipReader) {
__L_V__7({
    lN: 379,tT:'if',pr:'aZipReader',eT:{},fN:''
  });'__L_V__7';
            aZipReader.close();
          }
          resolve({
            signedState: getSignedStatus(aRv, aCert, addon.id),
            cert: aCert,
          });
        },
      };
      // This allows the certificate DB to get the raw JS callback object so the
      // test code can pass through objects that XPConnect would reject.
      callback.wrappedJSObject = callback;

      gCertDB.openSignedAppFileAsync(root, this.file, callback);
    });
  }

  flushCache() {
__L_V__7({
    lN: 396,tT:'func',pr:'',eT:{},fN:'flushCache'
  });'__L_V__7';
    flushJarCache(this.file);
  }
};

/**
 * Return an object that implements enough of the Package interface
 * to allow loadManifest() to work for a built-in addon (ie, one loaded
 * from a resource: url)
 *
 * @param {nsIURL} baseURL The URL for the root of the add-on.
 * @returns {object}
 */
function builtinPackage(baseURL) {
__L_V__7({
    lN: 409,tT:'func',pr:'',eT:{'baseURL':baseURL},fN:'builtinPackage'
  });'__L_V__7';
  return {
    rootURI: baseURL,
    filePath: baseURL.spec,
    file: null,
    verifySignedState() {
__L_V__7({
    lN: 414,tT:'func',pr:'',eT:{},fN:'verifySignedState'
  });'__L_V__7';
      return {
        signedState: AddonManager.SIGNEDSTATE_NOT_REQUIRED,
        cert: null,
      };
    },
    async hasResource(path) {
__L_V__7({
    lN: 420,tT:'func',pr:'',eT:{'path':path},fN:'hasResource'
  });'__L_V__7';
      try {
        let response = await fetch(this.rootURI.resolve(path));
        return response.ok;
      } catch (e) {
        return false;
      }
    },
  };
}

/**
 * Determine the reason to pass to an extension's bootstrap methods when
 * switch between versions.
 *
 * @param {string} oldVersion The version of the existing extension instance.
 * @param {string} newVersion The version of the extension being installed.
 *
 * @returns {integer}
 *        BOOSTRAP_REASONS.ADDON_UPGRADE or BOOSTRAP_REASONS.ADDON_DOWNGRADE
 */
function newVersionReason(oldVersion, newVersion) {
__L_V__7({
    lN: 441,tT:'func',pr:'',eT:{'oldVersion':oldVersion,'newVersion':newVersion},fN:'newVersionReason'
  });'__L_V__7';
  return Services.vc.compare(oldVersion, newVersion) <= 0
    ? BOOTSTRAP_REASONS.ADDON_UPGRADE
    : BOOTSTRAP_REASONS.ADDON_DOWNGRADE;
}

// Behaves like Promise.all except waits for all promises to resolve/reject
// before resolving/rejecting itself
function waitForAllPromises(promises) {
__L_V__7({
    lN: 449,tT:'func',pr:'',eT:{'promises':promises},fN:'waitForAllPromises'
  });'__L_V__7';
  return new Promise((resolve, reject) => {
    let shouldReject = false;
    let rejectValue = null;

    let newPromises = promises.map(p =>
      p.catch(value => {
        shouldReject = true;
        rejectValue = value;
      })
    );
    Promise.all(newPromises).then(results =>
      shouldReject ? reject(rejectValue) : resolve(results)
    );
  });
}

/**
 * Reads an AddonInternal object from a webextension manifest.json
 *
 * @param {Package} aPackage
 *        The install package for the add-on
 * @returns {AddonInternal}
 * @throws if the install manifest in the stream is corrupt or could not
 *         be read
 */
async function loadManifestFromWebManifest(aPackage) {
__L_V__7({
    lN: 475,tT:'func',pr:'',eT:{'aPackage':aPackage},fN:'loadManifestFromWebManifest'
  });'__L_V__7';
  let extension = new ExtensionData(
    XPIInternal.maybeResolveURI(aPackage.rootURI)
  );

  let manifest = await extension.loadManifest();

  // Read the list of available locales, and pre-load messages for
  // all locales.
  let locales = !extension.errors.length
    ? await extension.initAllLocales()
    : null;

  if (extension.errors.length) {
__L_V__7({
    lN: 488,tT:'if',pr:'extension.errors.length',eT:{},fN:''
  });'__L_V__7';
    let error = new Error("Extension is invalid");
    // Add detailed errors on the error object so that the front end can display them
    // if needed (eg in about:debugging).
    error.additionalErrors = extension.errors;
    throw error;
  }

  let bss =
    (manifest.browser_specific_settings &&
      manifest.browser_specific_settings.gecko) ||
    (manifest.applications && manifest.applications.gecko) ||
    {};
  if (manifest.browser_specific_settings && manifest.applications) {
__L_V__7({
    lN: 501,tT:'if',pr:'manifest.browser_specific_settings && manifest.applications',eT:{},fN:''
  });'__L_V__7';
    logger.warn("Ignoring applications property in manifest");
  }

  // A * is illegal in strict_min_version
  if (
    bss.strict_min_version &&
    bss.strict_min_version.split(".").some(part => part == "*")
  ) {
__L_V__7({
    lN: 509,tT:'if',pr:' bss.strict_min_version && bss.strict_min_version.split(.).some(part => part == *) ',eT:{},fN:''
  });'__L_V__7';
    throw new Error("The use of '*' in strict_min_version is invalid");
  }

  let addon = new AddonInternal();
  addon.id = bss.id;
  addon.version = manifest.version;
  addon.type = extension.type === "langpack" ? "locale" : extension.type;
  addon.loader = null;
  addon.strictCompatibility = true;
  addon.internalName = null;
  addon.updateURL = bss.update_url;
  addon.optionsBrowserStyle = true;
  addon.optionsURL = null;
  addon.optionsType = null;
  addon.aboutURL = null;
  addon.dependencies = Object.freeze(Array.from(extension.dependencies));
  addon.startupData = extension.startupData;
  addon.hidden = manifest.hidden;
  addon.incognito = manifest.incognito;

  if (addon.type === "theme" && (await aPackage.hasResource("preview.png"))) {
__L_V__7({
    lN: 530,tT:'if',pr:'addon.type === theme && (await aPackage.hasResource(preview.png))',eT:{},fN:''
  });'__L_V__7';
    addon.previewImage = "preview.png";
  }

  if (manifest.options_ui) {
__L_V__7({
    lN: 534,tT:'if',pr:'manifest.options_ui',eT:{},fN:''
  });'__L_V__7';
    // Store just the relative path here, the AddonWrapper getURL
    // wrapper maps this to a full URL.
    addon.optionsURL = manifest.options_ui.page;
    if (manifest.options_ui.open_in_tab) {
__L_V__7({
    lN: 538,tT:'if',pr:'manifest.options_ui.open_in_tab',eT:{},fN:''
  });'__L_V__7';
      addon.optionsType = AddonManager.OPTIONS_TYPE_TAB;
    } else {
      addon.optionsType = AddonManager.OPTIONS_TYPE_INLINE_BROWSER;
    }

    addon.optionsBrowserStyle = manifest.options_ui.browser_style;
  }

  // CLIQZ-SPECIAL: Do not install theme and locale addons
  if (['locale', 'theme'].includes(addon.type)) {
__L_V__7({
    lN: 548,tT:'if',pr:'[locale, theme].includes(addon.type)',eT:{},fN:''
  });'__L_V__7';
    addon.doNotInstall = true;
  }

  // CLIQZ: Check if extension has newtab/home page changes, so as to show message in permissions popup
  if ((manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab) ||
      (manifest.chrome_settings_overrides && manifest.chrome_settings_overrides.homepage)) {
__L_V__7({
    lN: 554,tT:'if',pr:'(manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab) || (manifest.chrome_settings_overrides && manifest.chrome_settings_overrides.homepage)',eT:{},fN:''
  });'__L_V__7';
    addon.changesNewTab = true;
  }

  // WebExtensions don't use iconURLs
  addon.iconURL = null;
  addon.icons = manifest.icons || {};
  addon.userPermissions = extension.manifestPermissions;
  addon.optionalPermissions = extension.manifestOptionalPermissions;
  addon.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DEFAULT;

  function getLocale(aLocale) {
__L_V__7({
    lN: 565,tT:'func',pr:'',eT:{'aLocale':aLocale},fN:'getLocale'
  });'__L_V__7';
    // Use the raw manifest, here, since we need values with their
    // localization placeholders still in place.
    let rawManifest = extension.rawManifest;

    // As a convenience, allow author to be set if its a string bug 1313567.
    let creator =
      typeof rawManifest.author === "string" ? rawManifest.author : null;
    let homepageURL = rawManifest.homepage_url;

    // Allow developer to override creator and homepage_url.
    if (rawManifest.developer) {
__L_V__7({
    lN: 576,tT:'if',pr:'rawManifest.developer',eT:{},fN:''
  });'__L_V__7';
      if (rawManifest.developer.name) {
__L_V__7({
    lN: 577,tT:'if',pr:'rawManifest.developer.name',eT:{},fN:''
  });'__L_V__7';
        creator = rawManifest.developer.name;
      }
      if (rawManifest.developer.url) {
__L_V__7({
    lN: 580,tT:'if',pr:'rawManifest.developer.url',eT:{},fN:''
  });'__L_V__7';
        homepageURL = rawManifest.developer.url;
      }
    }

    let result = {
      name: extension.localize(rawManifest.name, aLocale),
      description: extension.localize(rawManifest.description, aLocale),
      creator: extension.localize(creator, aLocale),
      homepageURL: extension.localize(homepageURL, aLocale),

      developers: null,
      translators: null,
      contributors: null,
      locales: [aLocale],
    };
    return result;
  }

  addon.defaultLocale = getLocale(extension.defaultLocale);
  addon.locales = Array.from(locales.keys(), getLocale);

  delete addon.defaultLocale.locales;

  addon.targetApplications = [
    {
      id: TOOLKIT_ID,
      minVersion: bss.strict_min_version,
      maxVersion: bss.strict_max_version,
    },
  ];

  addon.targetPlatforms = [];
  // Themes are disabled by default, except when they're installed from a web page.
  addon.userDisabled = extension.type === "theme";
  addon.softDisabled =
    addon.blocklistState == nsIBlocklistService.STATE_SOFTBLOCKED;

  return addon;
}

async function readRecommendationStates(aPackage, aAddonID) {
__L_V__7({
    lN: 621,tT:'func',pr:'',eT:{'aPackage':aPackage,'aAddonID':aAddonID},fN:'readRecommendationStates'
  });'__L_V__7';
  let recommendationData;
  try {
    recommendationData = await aPackage.readString(
      "mozilla-recommendation.json"
    );
  } catch (e) {
    // Ignore I/O errors.
    return null;
  }

  try {
    recommendationData = JSON.parse(recommendationData);
  } catch (e) {
    logger.warn("Failed to parse recommendation", e);
  }

  if (recommendationData) {
__L_V__7({
    lN: 638,tT:'if',pr:'recommendationData',eT:{},fN:''
  });'__L_V__7';
    let { addon_id, states, validity } = recommendationData;

    if (addon_id === aAddonID && Array.isArray(states) && validity) {
__L_V__7({
    lN: 641,tT:'if',pr:'addon_id === aAddonID && Array.isArray(states) && validity',eT:{},fN:''
  });'__L_V__7';
      let validNotAfter = Date.parse(validity.not_after);
      let validNotBefore = Date.parse(validity.not_before);
      if (validNotAfter && validNotBefore) {
__L_V__7({
    lN: 644,tT:'if',pr:'validNotAfter && validNotBefore',eT:{},fN:''
  });'__L_V__7';
        return {
          validNotAfter,
          validNotBefore,
          states,
        };
      }
    }
    logger.warn(
      `Invalid recommendation for ${aAddonID}: ${JSON.stringify(
        recommendationData
      )}`
    );
  }

  return null;
}

function defineSyncGUID(aAddon) {
__L_V__7({
    lN: 662,tT:'func',pr:'',eT:{'aAddon':aAddon},fN:'defineSyncGUID'
  });'__L_V__7';
  // Define .syncGUID as a lazy property which is also settable
  Object.defineProperty(aAddon, "syncGUID", {
    get: () => {
      aAddon.syncGUID = uuidGen.generateUUID().toString();
      return aAddon.syncGUID;
    },
    set: val => {
      delete aAddon.syncGUID;
      aAddon.syncGUID = val;
    },
    configurable: true,
    enumerable: true,
  });
}

// Generate a unique ID based on the path to this temporary add-on location.
function generateTemporaryInstallID(aFile) {
__L_V__7({
    lN: 679,tT:'func',pr:'',eT:{'aFile':aFile},fN:'generateTemporaryInstallID'
  });'__L_V__7';
  const hasher = CryptoHash("sha1");
  const data = new TextEncoder().encode(aFile.path);
  // Make it so this ID cannot be guessed.
  const sess = TEMP_INSTALL_ID_GEN_SESSION;
  hasher.update(sess, sess.length);
  hasher.update(data, data.length);
  let id = `${getHashStringForCrypto(hasher)}${TEMPORARY_ADDON_SUFFIX}`;
  logger.info(`Generated temp id ${id} (${sess.join("")}) for ${aFile.path}`);
  return id;
}

var loadManifest = async function(aPackage, aLocation, aOldAddon) {
__L_V__7({
    lN: 691,tT:'func',pr:'',eT:{'aPackage':aPackage,'aLocation':aLocation,'aOldAddon':aOldAddon},fN:'function'
  });'__L_V__7';
  let addon;
  if (await aPackage.hasResource("manifest.json")) {
__L_V__7({
    lN: 693,tT:'if',pr:'await aPackage.hasResource(manifest.json)',eT:{},fN:''
  });'__L_V__7';
    addon = await loadManifestFromWebManifest(aPackage);
  } else {
    for (let loader of AddonManagerPrivate.externalExtensionLoaders.values()) {
      if (await aPackage.hasResource(loader.manifestFile)) {
__L_V__7({
    lN: 697,tT:'if',pr:'await aPackage.hasResource(loader.manifestFile)',eT:{},fN:''
  });'__L_V__7';
        addon = await loader.loadManifest(aPackage);
        addon.loader = loader.name;
        break;
      }
    }
  }

  if (!addon) {
__L_V__7({
    lN: 705,tT:'if',pr:'!addon',eT:{},fN:''
  });'__L_V__7';
    throw new Error(
      `File ${aPackage.filePath} does not contain a valid manifest`
    );
  }

  addon._sourceBundle = aPackage.file;
  addon.rootURI = aPackage.rootURI.spec;
  addon.location = aLocation;

  let { signedState, cert } = await aPackage.verifySignedState(addon);
  addon.signedState = signedState;
  if (!addon.isPrivileged) {
__L_V__7({
    lN: 717,tT:'if',pr:'!addon.isPrivileged',eT:{},fN:''
  });'__L_V__7';
    addon.hidden = false;
  }

  if (!addon.id) {
__L_V__7({
    lN: 721,tT:'if',pr:'!addon.id',eT:{},fN:''
  });'__L_V__7';
    if (cert) {
__L_V__7({
    lN: 722,tT:'if',pr:'cert',eT:{},fN:''
  });'__L_V__7';
      addon.id = cert.commonName;
      if (!gIDTest.test(addon.id)) {
__L_V__7({
    lN: 724,tT:'if',pr:'!gIDTest.test(addon.id)',eT:{},fN:''
  });'__L_V__7';
        throw new Error(`Extension is signed with an invalid id (${addon.id})`);
      }
    }
    if (!addon.id && aLocation.isTemporary) {
__L_V__7({
    lN: 728,tT:'if',pr:'!addon.id && aLocation.isTemporary',eT:{},fN:''
  });'__L_V__7';
      addon.id = generateTemporaryInstallID(aPackage.file);
    }
  }

  /* CLIQZ-SPECIAL: remove recommended status
  if (
    addon.type === "extension" &&
    !aLocation.isBuiltin &&
    !aLocation.isTemporary
  ) {
__L_V__7({
    lN: 738,tT:'if',pr:' addon.type === extension && !aLocation.isBuiltin && !aLocation.isTemporary ',eT:{},fN:''
  });'__L_V__7';
    addon.recommendationState = await readRecommendationStates(
      aPackage,
      addon.id
    );
  }
  */

  // CLIQZ-SPECIAL: enable/disable DAT extension.
  if (addon.id === 'dat@cliqz.com') {
__L_V__7({
    lN: 747,tT:'if',pr:'addon.id === dat@cliqz.com',eT:{},fN:''
  });'__L_V__7';
    const isDatEnabled = Services.prefs.getBoolPref("extension.cliqz.dat.enabled", false);
    if (!isDatEnabled && !addon.userDisabled) {
__L_V__7({
    lN: 749,tT:'if',pr:'!isDatEnabled && !addon.userDisabled',eT:{},fN:''
  });'__L_V__7';
      addon.userDisabled = true;
      addon.softDisabled = true;
    }
  }

  addon.propagateDisabledState(aOldAddon);
  await addon.updateBlocklistState();
  addon.appDisabled = !XPIDatabase.isUsableAddon(addon);

  defineSyncGUID(addon);

  return addon;
};

/**
 * Loads an add-on's manifest from the given file or directory.
 *
 * @param {nsIFile} aFile
 *        The file to load the manifest from.
 * @param {XPIStateLocation} aLocation
 *        The install location the add-on is installed in, or will be
 *        installed to.
 * @param {AddonInternal?} aOldAddon
 *        The currently-installed add-on with the same ID, if one exist.
 *        This is used to migrate user settings like the add-on's
 *        disabled state.
 * @returns {AddonInternal}
 *        The parsed Addon object for the file's manifest.
 */
var loadManifestFromFile = async function(aFile, aLocation, aOldAddon) {
__L_V__7({
    lN: 779,tT:'func',pr:'',eT:{'aFile':aFile,'aLocation':aLocation,'aOldAddon':aOldAddon},fN:'function'
  });'__L_V__7';
  let pkg = Package.get(aFile);
  try {
    let addon = await loadManifest(pkg, aLocation, aOldAddon);
    return addon;
  } finally {
    pkg.close();
  }
};

/*
 * A synchronous method for loading an add-on's manifest. Do not use
 * this.
 */
function syncLoadManifest(state, location, oldAddon) {
__L_V__7({
    lN: 793,tT:'func',pr:'',eT:{'state':state,'location':location,'oldAddon':oldAddon},fN:'syncLoadManifest'
  });'__L_V__7';
  if (location.name == "app-builtin") {
__L_V__7({
    lN: 794,tT:'if',pr:'location.name == app-builtin',eT:{},fN:''
  });'__L_V__7';
    let pkg = builtinPackage(Services.io.newURI(state.rootURI));
    return XPIInternal.awaitPromise(loadManifest(pkg, location, oldAddon));
  }

  let file = new nsIFile(state.path);
  let pkg = Package.get(file);
  return XPIInternal.awaitPromise(
    (async () => {
      try {
        let addon = await loadManifest(pkg, location, oldAddon);
        addon.rootURI = getURIForResourceInFile(file, "").spec;
        return addon;
      } finally {
        pkg.close();
      }
    })()
  );
}

/**
 * Creates and returns a new unique temporary file. The caller should delete
 * the file when it is no longer needed.
 *
 * @returns {nsIFile}
 *       An nsIFile that points to a randomly named, initially empty file in
 *       the OS temporary files directory
 */
function getTemporaryFile() {
__L_V__7({
    lN: 822,tT:'func',pr:'',eT:{},fN:'getTemporaryFile'
  });'__L_V__7';
  let file = FileUtils.getDir(KEY_TEMPDIR, []);
  let random = Math.round(Math.random() * 36 ** 3).toString(36);
  file.append(`tmp-${random}.xpi`);
  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
  return file;
}

/**
 * Returns the signedState for a given return code and certificate by verifying
 * it against the expected ID.
 *
 * @param {nsresult} aRv
 *        The result code returned by the signature checker for the
 *        signature check operation.
 * @param {nsIX509Cert?} aCert
 *        The certificate the add-on was signed with, if a valid
 *        certificate exists.
 * @param {string?} aAddonID
 *        The expected ID of the add-on. If passed, this must match the
 *        ID in the certificate's CN field.
 * @returns {number}
 *        A SIGNEDSTATE result code constant, as defined on the
 *        AddonManager class.
 */
function getSignedStatus(aRv, aCert, aAddonID) {
__L_V__7({
    lN: 847,tT:'func',pr:'',eT:{'aRv':aRv,'aCert':aCert,'aAddonID':aAddonID},fN:'getSignedStatus'
  });'__L_V__7';
  let expectedCommonName = aAddonID;
  if (aAddonID && aAddonID.length > 64) {
__L_V__7({
    lN: 849,tT:'if',pr:'aAddonID && aAddonID.length > 64',eT:{},fN:''
  });'__L_V__7';
    let data = new Uint8Array(new TextEncoder().encode(aAddonID));

    let crypto = CryptoHash("sha256");
    crypto.update(data, data.length);
    expectedCommonName = getHashStringForCrypto(crypto);
  }
__L_V__7({
    lN: 856,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';

  switch (aRv) {
    case Cr.NS_OK:
      if (expectedCommonName && expectedCommonName != aCert.commonName) {
__L_V__7({
    lN: 859,tT:'if',pr:'expectedCommonName && expectedCommonName != aCert.commonName',eT:{},fN:''
  });'__L_V__7';
        return AddonManager.SIGNEDSTATE_BROKEN;
      }

      if (aCert.organizationalUnit == "Cliqz Frontend" ||
          aCert.organizationalUnit == "Mozilla Components"
      ) {
__L_V__7({
    lN: 865,tT:'if',pr:'aCert.organizationalUnit == Cliqz Frontend || aCert.organizationalUnit == Mozilla Components ',eT:{},fN:''
  });'__L_V__7';
        return AddonManager.SIGNEDSTATE_SYSTEM;
      }

      if (aCert.organizationalUnit == "Mozilla Extensions") {
__L_V__7({
    lN: 869,tT:'if',pr:'aCert.organizationalUnit == Mozilla Extensions',eT:{},fN:''
  });'__L_V__7';
        return AddonManager.SIGNEDSTATE_PRIVILEGED;
      }

      return /preliminary/i.test(aCert.organizationalUnit)
        ? AddonManager.SIGNEDSTATE_PRELIMINARY
        : AddonManager.SIGNEDSTATE_SIGNED;
    case Cr.NS_ERROR_SIGNED_JAR_NOT_SIGNED:
      return AddonManager.SIGNEDSTATE_MISSING;
    case Cr.NS_ERROR_SIGNED_JAR_MANIFEST_INVALID:
    case Cr.NS_ERROR_SIGNED_JAR_ENTRY_INVALID:
    case Cr.NS_ERROR_SIGNED_JAR_ENTRY_MISSING:
    case Cr.NS_ERROR_SIGNED_JAR_ENTRY_TOO_LARGE:
    case Cr.NS_ERROR_SIGNED_JAR_UNSIGNED_ENTRY:
    case Cr.NS_ERROR_SIGNED_JAR_MODIFIED_ENTRY:
      return AddonManager.SIGNEDSTATE_BROKEN;
    default:
      // Any other error indicates that either the add-on isn't signed or it
      // is signed by a signature that doesn't chain to the trusted root.
      return AddonManager.SIGNEDSTATE_UNKNOWN;
  }
}

function shouldVerifySignedState(aAddon) {
__L_V__7({
    lN: 892,tT:'func',pr:'',eT:{'aAddon':aAddon},fN:'shouldVerifySignedState'
  });'__L_V__7';
  // Updated system add-ons should always have their signature checked
  if (aAddon.location.name == KEY_APP_SYSTEM_ADDONS) {
__L_V__7({
    lN: 894,tT:'if',pr:'aAddon.location.name == KEY_APP_SYSTEM_ADDONS',eT:{},fN:''
  });'__L_V__7';
    return true;
  }

  // We don't care about signatures for default system add-ons
  if (aAddon.location.name == KEY_APP_SYSTEM_DEFAULTS) {
__L_V__7({
    lN: 899,tT:'if',pr:'aAddon.location.name == KEY_APP_SYSTEM_DEFAULTS',eT:{},fN:''
  });'__L_V__7';
    return false;
  }

  if (aAddon.location.scope & AppConstants.MOZ_UNSIGNED_SCOPES) {
__L_V__7({
    lN: 903,tT:'if',pr:'aAddon.location.scope & AppConstants.MOZ_UNSIGNED_SCOPES',eT:{},fN:''
  });'__L_V__7';
    return false;
  }

  // Otherwise only check signatures if the add-on is one of the signed
  // types.
  return XPIDatabase.SIGNED_TYPES.has(aAddon.type);
}

/**
 * Verifies that a bundle's contents are all correctly signed by an
 * AMO-issued certificate
 *
 * @param {nsIFile} aBundle
 *        The nsIFile for the bundle to check, either a directory or zip file.
 * @param {AddonInternal} aAddon
 *        The add-on object to verify.
 * @returns {Promise<number>}
 *        A Promise that resolves to an AddonManager.SIGNEDSTATE_* constant.
 */
var verifyBundleSignedState = async function(aBundle, aAddon) {
__L_V__7({
    lN: 923,tT:'func',pr:'',eT:{'aBundle':aBundle,'aAddon':aAddon},fN:'function'
  });'__L_V__7';
  let pkg = Package.get(aBundle);
  try {
    let { signedState } = await pkg.verifySignedState(aAddon);
    return signedState;
  } finally {
    pkg.close();
  }
};

/**
 * Replaces %...% strings in an addon url (update and updateInfo) with
 * appropriate values.
 *
 * @param {AddonInternal} aAddon
 *        The AddonInternal representing the add-on
 * @param {string} aUri
 *        The URI to escape
 * @param {integer?} aUpdateType
 *        An optional number representing the type of update, only applicable
 *        when creating a url for retrieving an update manifest
 * @param {string?} aAppVersion
 *        The optional application version to use for %APP_VERSION%
 * @returns {string}
 *       The appropriately escaped URI.
 */
function escapeAddonURI(aAddon, aUri, aUpdateType, aAppVersion) {
__L_V__7({
    lN: 949,tT:'func',pr:'',eT:{'aAddon':aAddon,'aUri':aUri,'aUpdateType':aUpdateType,'aAppVersion':aAppVersion},fN:'escapeAddonURI'
  });'__L_V__7';
  let uri = AddonManager.escapeAddonURI(aAddon, aUri, aAppVersion);

  // If there is an updateType then replace the UPDATE_TYPE string
  if (aUpdateType) {
__L_V__7({
    lN: 953,tT:'if',pr:'aUpdateType',eT:{},fN:''
  });'__L_V__7';
    uri = uri.replace(/%UPDATE_TYPE%/g, aUpdateType);
  }

  // If this add-on has compatibility information for either the current
  // application or toolkit then replace the ITEM_MAXAPPVERSION with the
  // maxVersion
  let app = aAddon.matchingTargetApplication;
  if (app) {
__L_V__7({
    lN: 961,tT:'if',pr:'app',eT:{},fN:''
  });'__L_V__7';
    var maxVersion = app.maxVersion;
  } else {
    maxVersion = "";
  }
  uri = uri.replace(/%ITEM_MAXAPPVERSION%/g, maxVersion);

  let compatMode = "normal";
  if (!AddonManager.checkCompatibility) {
__L_V__7({
    lN: 969,tT:'if',pr:'!AddonManager.checkCompatibility',eT:{},fN:''
  });'__L_V__7';
    compatMode = "ignore";
  } else if (AddonManager.strictCompatibility) {
__L_V__7({
    lN: 971,tT:'if',pr:'AddonManager.strictCompatibility',eT:{},fN:''
  });'__L_V__7';
    compatMode = "strict";
  }
  uri = uri.replace(/%COMPATIBILITY_MODE%/g, compatMode);

  return uri;
}

/**
 * Converts an iterable of addon objects into a map with the add-on's ID as key.
 *
 * @param {sequence<AddonInternal>} addons
 *        A sequence of AddonInternal objects.
 *
 * @returns {Map<string, AddonInternal>}
 */
function addonMap(addons) {
__L_V__7({
    lN: 987,tT:'func',pr:'',eT:{'addons':addons},fN:'addonMap'
  });'__L_V__7';
  return new Map(addons.map(a => [a.id, a]));
}

async function removeAsync(aFile) {
__L_V__7({
    lN: 991,tT:'func',pr:'',eT:{'aFile':aFile},fN:'removeAsync'
  });'__L_V__7';
  let info = null;
  try {
    info = await OS.File.stat(aFile.path);
    if (info.isDir) {
__L_V__7({
    lN: 995,tT:'if',pr:'info.isDir',eT:{},fN:''
  });'__L_V__7';
      await OS.File.removeDir(aFile.path);
    } else {
      await OS.File.remove(aFile.path);
    }
  } catch (e) {
    if (!(e instanceof OS.File.Error) || !e.becauseNoSuchFile) {
__L_V__7({
    lN: 1001,tT:'if',pr:'!(e instanceof OS.File.Error) || !e.becauseNoSuchFile',eT:{},fN:''
  });'__L_V__7';
      throw e;
    }
    // The file has already gone away
  }
}

/**
 * Recursively removes a directory or file fixing permissions when necessary.
 *
 * @param {nsIFile} aFile
 *        The nsIFile to remove
 */
function recursiveRemove(aFile) {
__L_V__7({
    lN: 1014,tT:'func',pr:'',eT:{'aFile':aFile},fN:'recursiveRemove'
  });'__L_V__7';
  let isDir = null;

  try {
    isDir = aFile.isDirectory();
  } catch (e) {
    // If the file has already gone away then don't worry about it, this can
    // happen on OSX where the resource fork is automatically moved with the
    // data fork for the file. See bug 733436.
    if (e.result == Cr.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST) {
__L_V__7({
    lN: 1023,tT:'if',pr:'e.result == Cr.NS_ERROR_FILE_TARGET_DOES_NOT_EXIST',eT:{},fN:''
  });'__L_V__7';
      return;
    }
    if (e.result == Cr.NS_ERROR_FILE_NOT_FOUND) {
__L_V__7({
    lN: 1026,tT:'if',pr:'e.result == Cr.NS_ERROR_FILE_NOT_FOUND',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    throw e;
  }

  setFilePermissions(
    aFile,
    isDir ? FileUtils.PERMS_DIRECTORY : FileUtils.PERMS_FILE
  );

  try {
    aFile.remove(true);
    return;
  } catch (e) {
    if (!aFile.isDirectory() || aFile.isSymlink()) {
__L_V__7({
    lN: 1042,tT:'if',pr:'!aFile.isDirectory() || aFile.isSymlink()',eT:{},fN:''
  });'__L_V__7';
      logger.error("Failed to remove file " + aFile.path, e);
      throw e;
    }
  }

  // Use a snapshot of the directory contents to avoid possible issues with
  // iterating over a directory while removing files from it (the YAFFS2
  // embedded filesystem has this issue, see bug 772238), and to remove
  // normal files before their resource forks on OSX (see bug 733436).
  let entries = Array.from(iterDirectory(aFile));
  entries.forEach(recursiveRemove);

  try {
    aFile.remove(true);
  } catch (e) {
    logger.error("Failed to remove empty directory " + aFile.path, e);
    throw e;
  }
}

/**
 * Sets permissions on a file
 *
 * @param {nsIFile} aFile
 *        The file or directory to operate on.
 * @param {integer} aPermissions
 *        The permissions to set
 */
function setFilePermissions(aFile, aPermissions) {
__L_V__7({
    lN: 1071,tT:'func',pr:'',eT:{'aFile':aFile,'aPermissions':aPermissions},fN:'setFilePermissions'
  });'__L_V__7';
  try {
    aFile.permissions = aPermissions;
  } catch (e) {
    logger.warn(
      "Failed to set permissions " +
        aPermissions.toString(8) +
        " on " +
        aFile.path,
      e
    );
  }
}

/**
 * Write a given string to a file
 *
 * @param {nsIFile} file
 *        The nsIFile instance to write into
 * @param {string} string
 *        The string to write
 */
function writeStringToFile(file, string) {
__L_V__7({
    lN: 1093,tT:'func',pr:'',eT:{'file':file,'string':string},fN:'writeStringToFile'
  });'__L_V__7';
  let fileStream = new FileOutputStream(
    file,
    FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE,
    FileUtils.PERMS_FILE,
    0
  );

  try {
    let binStream = new BinaryOutputStream(fileStream);

    binStream.writeByteArray(new TextEncoder().encode(string));
  } finally {
    fileStream.close();
  }
}

/**
 * A safe way to install a file or the contents of a directory to a new
 * directory. The file or directory is moved or copied recursively and if
 * anything fails an attempt is made to rollback the entire operation. The
 * operation may also be rolled back to its original state after it has
 * completed by calling the rollback method.
 *
 * Operations can be chained. Calling move or copy multiple times will remember
 * the whole set and if one fails all of the operations will be rolled back.
 */
function SafeInstallOperation() {
__L_V__7({
    lN: 1120,tT:'func',pr:'',eT:{},fN:'SafeInstallOperation'
  });'__L_V__7';
  this._installedFiles = [];
  this._createdDirs = [];
}

SafeInstallOperation.prototype = {
  _installedFiles: null,
  _createdDirs: null,

  _installFile(aFile, aTargetDirectory, aCopy) {
__L_V__7({
    lN: 1129,tT:'func',pr:'',eT:{'aFile':aFile,'aTargetDirectory':aTargetDirectory,'aCopy':aCopy},fN:'_installFile'
  });'__L_V__7';
    let oldFile = aCopy ? null : aFile.clone();
    let newFile = aFile.clone();
    try {
      if (aCopy) {
__L_V__7({
    lN: 1133,tT:'if',pr:'aCopy',eT:{},fN:''
  });'__L_V__7';
        newFile.copyTo(aTargetDirectory, null);
        // copyTo does not update the nsIFile with the new.
        newFile = getFile(aFile.leafName, aTargetDirectory);
        // Windows roaming profiles won't properly sync directories if a new file
        // has an older lastModifiedTime than a previous file, so update.
        newFile.lastModifiedTime = Date.now();
      } else {
        newFile.moveTo(aTargetDirectory, null);
      }
    } catch (e) {
      logger.error(
        "Failed to " +
          (aCopy ? "copy" : "move") +
          " file " +
          aFile.path +
          " to " +
          aTargetDirectory.path,
        e
      );
      throw e;
    }
    this._installedFiles.push({ oldFile, newFile });
  },

  /**
   * Moves a file or directory into a new directory. If an error occurs then all
   * files that have been moved will be moved back to their original location.
   *
   * @param {nsIFile} aFile
   *        The file or directory to be moved.
   * @param {nsIFile} aTargetDirectory
   *        The directory to move into, this is expected to be an empty
   *        directory.
   */
  moveUnder(aFile, aTargetDirectory) {
__L_V__7({
    lN: 1168,tT:'func',pr:'',eT:{'aFile':aFile,'aTargetDirectory':aTargetDirectory},fN:'moveUnder'
  });'__L_V__7';
    try {
      this._installFile(aFile, aTargetDirectory, false);
    } catch (e) {
      this.rollback();
      throw e;
    }
  },

  /**
   * Renames a file to a new location.  If an error occurs then all
   * files that have been moved will be moved back to their original location.
   *
   * @param {nsIFile} aOldLocation
   *        The old location of the file.
   * @param {nsIFile} aNewLocation
   *        The new location of the file.
   */
  moveTo(aOldLocation, aNewLocation) {
__L_V__7({
    lN: 1186,tT:'func',pr:'',eT:{'aOldLocation':aOldLocation,'aNewLocation':aNewLocation},fN:'moveTo'
  });'__L_V__7';
    try {
      let oldFile = aOldLocation.clone(),
        newFile = aNewLocation.clone();
      oldFile.moveTo(newFile.parent, newFile.leafName);
      this._installedFiles.push({ oldFile, newFile, isMoveTo: true });
    } catch (e) {
      this.rollback();
      throw e;
    }
  },

  /**
   * Copies a file or directory into a new directory. If an error occurs then
   * all new files that have been created will be removed.
   *
   * @param {nsIFile} aFile
   *        The file or directory to be copied.
   * @param {nsIFile} aTargetDirectory
   *        The directory to copy into, this is expected to be an empty
   *        directory.
   */
  copy(aFile, aTargetDirectory) {
__L_V__7({
    lN: 1208,tT:'func',pr:'',eT:{'aFile':aFile,'aTargetDirectory':aTargetDirectory},fN:'copy'
  });'__L_V__7';
    try {
      this._installFile(aFile, aTargetDirectory, true);
    } catch (e) {
      this.rollback();
      throw e;
    }
  },

  /**
   * Rolls back all the moves that this operation performed. If an exception
   * occurs here then both old and new directories are left in an indeterminate
   * state
   */
  rollback() {
__L_V__7({
    lN: 1222,tT:'func',pr:'',eT:{},fN:'rollback'
  });'__L_V__7';
    while (this._installedFiles.length) {
      let move = this._installedFiles.pop();
      if (move.isMoveTo) {
__L_V__7({
    lN: 1225,tT:'if',pr:'move.isMoveTo',eT:{},fN:''
  });'__L_V__7';
        move.newFile.moveTo(move.oldDir.parent, move.oldDir.leafName);
      } else if (move.newFile.isDirectory() && !move.newFile.isSymlink()) {
__L_V__7({
    lN: 1227,tT:'if',pr:'move.newFile.isDirectory() && !move.newFile.isSymlink()',eT:{},fN:''
  });'__L_V__7';
        let oldDir = getFile(move.oldFile.leafName, move.oldFile.parent);
        oldDir.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
      } else if (!move.oldFile) {
__L_V__7({
    lN: 1230,tT:'if',pr:'!move.oldFile',eT:{},fN:''
  });'__L_V__7';
        // No old file means this was a copied file
        move.newFile.remove(true);
      } else {
        move.newFile.moveTo(move.oldFile.parent, null);
      }
    }

    while (this._createdDirs.length) {
      recursiveRemove(this._createdDirs.pop());
    }
  },
};

function getHashStringForCrypto(aCrypto) {
__L_V__7({
    lN: 1244,tT:'func',pr:'',eT:{'aCrypto':aCrypto},fN:'getHashStringForCrypto'
  });'__L_V__7';
  // return the two-digit hexadecimal code for a byte
  let toHexString = charCode => ("0" + charCode.toString(16)).slice(-2);

  // convert the binary hash data to a hex string.
  let binary = aCrypto.finish(false);
  let hash = Array.from(binary, c => toHexString(c.charCodeAt(0)));
  return hash.join("").toLowerCase();
}

/**
 * Base class for objects that manage the installation of an addon.
 * This class isn't instantiated directly, see the derived classes below.
 */
class AddonInstall {
  /**
   * Instantiates an AddonInstall.
   *
   * @param {XPIStateLocation} installLocation
   *        The install location the add-on will be installed into
   * @param {nsIURL} url
   *        The nsIURL to get the add-on from. If this is an nsIFileURL then
   *        the add-on will not need to be downloaded
   * @param {Object} [options = {}]
   *        Additional options for the install
   * @param {string} [options.hash]
   *        An optional hash for the add-on
   * @param {AddonInternal} [options.existingAddon]
   *        The add-on this install will update if known
   * @param {string} [options.name]
   *        An optional name for the add-on
   * @param {string} [options.type]
   *        An optional type for the add-on
   * @param {object} [options.icons]
   *        Optional icons for the add-on
   * @param {string} [options.version]
   *        An optional version for the add-on
   * @param {Object?} [options.telemetryInfo]
   *        An optional object which provides details about the installation source
   *        included in the addon manager telemetry events.
   * @param {boolean} [options.isUserRequestedUpdate]
   *        An optional boolean, true if the install object is related to a user triggered update.
   * @param {nsIURL} [options.releaseNotesURI]
   *        An optional nsIURL that release notes where release notes can be retrieved.
   * @param {function(string) : Promise<void>} [options.promptHandler]
   *        A callback to prompt the user before installing.
   */
  constructor(installLocation, url, options = {}) {
__L_V__7({
    lN: 1291,tT:'func',pr:'',eT:{'installLocation':installLocation,'url':url,'options':options},fN:'constructor'
  });'__L_V__7';
    this.wrapper = new AddonInstallWrapper(this);
    this.location = installLocation;
    this.sourceURI = url;

    if (options.hash) {
__L_V__7({
    lN: 1296,tT:'if',pr:'options.hash',eT:{},fN:''
  });'__L_V__7';
      let hashSplit = options.hash.toLowerCase().split(":");
      this.originalHash = {
        algorithm: hashSplit[0],
        data: hashSplit[1],
      };
    }
    this.hash = this.originalHash;
    this.existingAddon = options.existingAddon || null;
    this.promptHandler = options.promptHandler || (() => Promise.resolve());
    this.releaseNotesURI = options.releaseNotesURI || null;

    this._startupPromise = null;

    this._installPromise = new Promise(resolve => {
      this._resolveInstallPromise = resolve;
    });
    // Ignore uncaught rejections for this promise, since they're
    // handled by install listeners.
    this._installPromise.catch(() => {});

    this.listeners = [];
    this.icons = options.icons || {};
    this.error = 0;

    this.progress = 0;
    this.maxProgress = -1;

    // Giving each instance of AddonInstall a reference to the logger.
    this.logger = logger;

    this.name = options.name || null;
    this.type = options.type || null;
    this.version = options.version || null;
    this.isUserRequestedUpdate = options.isUserRequestedUpdate;
    this.installTelemetryInfo = null;

    if (options.telemetryInfo) {
__L_V__7({
    lN: 1333,tT:'if',pr:'options.telemetryInfo',eT:{},fN:''
  });'__L_V__7';
      this.installTelemetryInfo = options.telemetryInfo;
    } else if (this.existingAddon) {
__L_V__7({
    lN: 1335,tT:'if',pr:'this.existingAddon',eT:{},fN:''
  });'__L_V__7';
      // Inherits the installTelemetryInfo on updates (so that the source of the original
      // installation telemetry data is being preserved across the extension updates).
      this.installTelemetryInfo = this.existingAddon.installTelemetryInfo;
      this.existingAddon._updateInstall = this;
    }

    this.file = null;
    this.ownsTempFile = null;

    this.addon = null;
    this.state = null;

    XPIInstall.installs.add(this);
  }

  /**
   * Called when we are finished with this install and are ready to remove
   * any external references to it.
   */
  _cleanup() {
__L_V__7({
    lN: 1355,tT:'func',pr:'',eT:{},fN:'_cleanup'
  });'__L_V__7';
    XPIInstall.installs.delete(this);
    if (this.addon && this.addon._install) {
__L_V__7({
    lN: 1357,tT:'if',pr:'this.addon && this.addon._install',eT:{},fN:''
  });'__L_V__7';
      if (this.addon._install === this) {
__L_V__7({
    lN: 1358,tT:'if',pr:'this.addon._install === this',eT:{},fN:''
  });'__L_V__7';
        this.addon._install = null;
      } else {
        Cu.reportError(new Error("AddonInstall mismatch"));
      }
    }
    if (this.existingAddon && this.existingAddon._updateInstall) {
__L_V__7({
    lN: 1364,tT:'if',pr:'this.existingAddon && this.existingAddon._updateInstall',eT:{},fN:''
  });'__L_V__7';
      if (this.existingAddon._updateInstall === this) {
__L_V__7({
    lN: 1365,tT:'if',pr:'this.existingAddon._updateInstall === this',eT:{},fN:''
  });'__L_V__7';
        this.existingAddon._updateInstall = null;
      } else {
        Cu.reportError(new Error("AddonInstall existingAddon mismatch"));
      }
    }
  }

  /**
   * Starts installation of this add-on from whatever state it is currently at
   * if possible.
   *
   * Note this method is overridden to handle additional state in
   * the subclassses below.
   *
   * @returns {Promise<Addon>}
   * @throws if installation cannot proceed from the current state
   */
  install() {
__L_V__7({
    lN: 1383,tT:'func',pr:'',eT:{},fN:'install'
  });'__L_V__7';
__L_V__7({
    lN: 1384,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';
    switch (this.state) {
      case AddonManager.STATE_DOWNLOADED:
        this.checkPrompt();
        break;
      case AddonManager.STATE_PROMPTS_DONE:
        this.checkForBlockers();
        break;
      case AddonManager.STATE_READY:
        this.startInstall();
        break;
      case AddonManager.STATE_POSTPONED:
        logger.debug(`Postponing install of ${this.addon.id}`);
        break;
      case AddonManager.STATE_DOWNLOADING:
      case AddonManager.STATE_CHECKING:
      case AddonManager.STATE_INSTALLING:
        // Installation is already running
        break;
      default:
        throw new Error("Cannot start installing from this state");
    }
    return this._installPromise;
  }

  /**
   * Called during XPIProvider shutdown so that we can do any necessary
   * pre-shutdown cleanup.
   */
  onShutdown() {
__L_V__7({
    lN: 1412,tT:'func',pr:'',eT:{},fN:'onShutdown'
  });'__L_V__7';
__L_V__7({
    lN: 1413,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';
    switch (this.state) {
      case AddonManager.STATE_POSTPONED:
        this.removeTemporaryFile();
        break;
    }
  }

  /**
   * Cancels installation of this add-on.
   *
   * Note this method is overridden to handle additional state in
   * the subclass DownloadAddonInstall.
   *
   * @throws if installation cannot be cancelled from the current state
   */
  cancel() {
__L_V__7({
    lN: 1428,tT:'func',pr:'',eT:{},fN:'cancel'
  });'__L_V__7';
__L_V__7({
    lN: 1429,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';
    switch (this.state) {
      case AddonManager.STATE_AVAILABLE:
      case AddonManager.STATE_DOWNLOADED:
        logger.debug("Cancelling download of " + this.sourceURI.spec);
        this.state = AddonManager.STATE_CANCELLED;
        this._cleanup();
        this._callInstallListeners("onDownloadCancelled");
        this.removeTemporaryFile();
        break;
      case AddonManager.STATE_INSTALLED:
        logger.debug("Cancelling install of " + this.addon.id);
        let xpi = getFile(
          `${this.addon.id}.xpi`,
          this.location.installer.getStagingDir()
        );
        flushJarCache(xpi);
        this.location.installer.cleanStagingDir([`${this.addon.id}.xpi`]);
        this.state = AddonManager.STATE_CANCELLED;
        this._cleanup();

        if (this.existingAddon) {
__L_V__7({
    lN: 1449,tT:'if',pr:'this.existingAddon',eT:{},fN:''
  });'__L_V__7';
          delete this.existingAddon.pendingUpgrade;
          this.existingAddon.pendingUpgrade = null;
        }

        AddonManagerPrivate.callAddonListeners(
          "onOperationCancelled",
          this.addon.wrapper
        );

        this._callInstallListeners("onInstallCancelled");
        break;
      case AddonManager.STATE_POSTPONED:
        logger.debug(`Cancelling postponed install of ${this.addon.id}`);
        this.state = AddonManager.STATE_CANCELLED;
        this._cleanup();
        this._callInstallListeners("onInstallCancelled");
        this.removeTemporaryFile();

        let stagingDir = this.location.installer.getStagingDir();
        let stagedAddon = stagingDir.clone();

        this.unstageInstall(stagedAddon);
        break;
      default:
        throw new Error(
          "Cannot cancel install of " +
            this.sourceURI.spec +
            " from this state (" +
            this.state +
            ")"
        );
    }
  }

  /**
   * Adds an InstallListener for this instance if the listener is not already
   * registered.
   *
   * @param {InstallListener} aListener
   *        The InstallListener to add
   */
  addListener(aListener) {
__L_V__7({
    lN: 1491,tT:'func',pr:'',eT:{'aListener':aListener},fN:'addListener'
  });'__L_V__7';
    if (
      !this.listeners.some(function(i) {
        return i == aListener;
      })
    ) {
__L_V__7({
    lN: 1496,tT:'if',pr:' !this.listeners.some(function(i) { return i == aListener; }) ',eT:{},fN:''
  });'__L_V__7';
      this.listeners.push(aListener);
    }
  }

  /**
   * Removes an InstallListener for this instance if it is registered.
   *
   * @param {InstallListener} aListener
   *        The InstallListener to remove
   */
  removeListener(aListener) {
__L_V__7({
    lN: 1507,tT:'func',pr:'',eT:{'aListener':aListener},fN:'removeListener'
  });'__L_V__7';
    this.listeners = this.listeners.filter(function(i) {
      return i != aListener;
    });
  }

  /**
   * Removes the temporary file owned by this AddonInstall if there is one.
   */
  removeTemporaryFile() {
__L_V__7({
    lN: 1516,tT:'func',pr:'',eT:{},fN:'removeTemporaryFile'
  });'__L_V__7';
    // Only proceed if this AddonInstall owns its XPI file
    if (!this.ownsTempFile) {
__L_V__7({
    lN: 1518,tT:'if',pr:'!this.ownsTempFile',eT:{},fN:''
  });'__L_V__7';
      this.logger.debug(
        `removeTemporaryFile: ${this.sourceURI.spec} does not own temp file`
      );
      return;
    }

    try {
      this.logger.debug(
        `removeTemporaryFile: ${this.sourceURI.spec} removing temp file ` +
          this.file.path
      );
      flushJarCache(this.file);
      this.file.remove(true);
      this.ownsTempFile = false;
    } catch (e) {
      this.logger.warn(
        `Failed to remove temporary file ${this.file.path} for addon ` +
          this.sourceURI.spec,
        e
      );
    }
  }

  /**
   * Updates the addon metadata that has to be propagated across restarts.
   */
  updatePersistedMetadata() {
__L_V__7({
    lN: 1545,tT:'func',pr:'',eT:{},fN:'updatePersistedMetadata'
  });'__L_V__7';
    this.addon.sourceURI = this.sourceURI.spec;

    if (this.releaseNotesURI) {
__L_V__7({
    lN: 1548,tT:'if',pr:'this.releaseNotesURI',eT:{},fN:''
  });'__L_V__7';
      this.addon.releaseNotesURI = this.releaseNotesURI.spec;
    }

    if (this.installTelemetryInfo) {
__L_V__7({
    lN: 1552,tT:'if',pr:'this.installTelemetryInfo',eT:{},fN:''
  });'__L_V__7';
      this.addon.installTelemetryInfo = this.installTelemetryInfo;
    }
  }

  /**
   * Called after the add-on is a local file and the signature and install
   * manifest can be read.
   *
   * @param {nsIFile} file
   *        The file from which to load the manifest.
   * @returns {Promise<void>}
   */
  async loadManifest(file) {
__L_V__7({
    lN: 1565,tT:'func',pr:'',eT:{'file':file},fN:'loadManifest'
  });'__L_V__7';
    let pkg;
    try {
      pkg = Package.get(file);
    } catch (e) {
      return Promise.reject([AddonManager.ERROR_CORRUPT_FILE, e]);
    }

    try {
      try {
        this.addon = await loadManifest(pkg, this.location, this.existingAddon);
      } catch (e) {
        return Promise.reject([AddonManager.ERROR_CORRUPT_FILE, e]);
      }

      if (this.addon.doNotInstall) {
__L_V__7({
    lN: 1580,tT:'if',pr:'this.addon.doNotInstall',eT:{},fN:''
  });'__L_V__7';
        return Promise.reject([AddonManager.ERROR_UNSUPPORTED_API_CLIQZ,'unsupported Apis']);
      }

      if (!this.addon.id) {
__L_V__7({
    lN: 1584,tT:'if',pr:'!this.addon.id',eT:{},fN:''
  });'__L_V__7';
        let err = new Error(`Cannot find id for addon ${file.path}`);
        return Promise.reject([AddonManager.ERROR_CORRUPT_FILE, err]);
      }

      if (this.existingAddon) {
__L_V__7({
    lN: 1589,tT:'if',pr:'this.existingAddon',eT:{},fN:''
  });'__L_V__7';
        // Check various conditions related to upgrades
        if (this.addon.id != this.existingAddon.id) {
__L_V__7({
    lN: 1591,tT:'if',pr:'this.addon.id != this.existingAddon.id',eT:{},fN:''
  });'__L_V__7';
          return Promise.reject([
            AddonManager.ERROR_INCORRECT_ID,
            `Refusing to upgrade addon ${this.existingAddon.id} to different ID ${this.addon.id}`,
          ]);
        }

        if (this.existingAddon.isWebExtension && !this.addon.isWebExtension) {
__L_V__7({
    lN: 1598,tT:'if',pr:'this.existingAddon.isWebExtension && !this.addon.isWebExtension',eT:{},fN:''
  });'__L_V__7';
          return Promise.reject([
            AddonManager.ERROR_UNEXPECTED_ADDON_TYPE,
            "WebExtensions may not be updated to other extension types",
          ]);
        }
      }

      if (XPIDatabase.mustSign(this.addon.type)) {
__L_V__7({
    lN: 1606,tT:'if',pr:'XPIDatabase.mustSign(this.addon.type)',eT:{},fN:''
  });'__L_V__7';
        if (this.addon.signedState <= AddonManager.SIGNEDSTATE_MISSING) {
__L_V__7({
    lN: 1607,tT:'if',pr:'this.addon.signedState <= AddonManager.SIGNEDSTATE_MISSING',eT:{},fN:''
  });'__L_V__7';
          // This add-on isn't properly signed by a signature that chains to the
          // trusted root.
          let state = this.addon.signedState;
          const manifest = this.addon;
          this.addon = null;

          if (state == AddonManager.SIGNEDSTATE_MISSING ||
            state == AddonManager.SIGNEDSTATE_UNKNOWN) {
__L_V__7({
    lN: 1615,tT:'if',pr:'state == AddonManager.SIGNEDSTATE_MISSING || state == AddonManager.SIGNEDSTATE_UNKNOWN',eT:{},fN:''
  });'__L_V__7';
            return Promise.reject([
              AddonManager.ERROR_SIGNEDSTATE_REQUIRED,
              "signature is required but missing",
              manifest
            ]);
          }

          if (state == AddonManager.SIGNEDSTATE_CLIQZ) {
__L_V__7({
    lN: 1623,tT:'if',pr:'state == AddonManager.SIGNEDSTATE_CLIQZ',eT:{},fN:''
  });'__L_V__7';
            return Promise.reject([
              AddonManager.ERROR_SIGNEDSTATE_CLIQZ,
              "cliqz addon - already integrated",
              manifest
            ]);
          }

          return Promise.reject([
            AddonManager.ERROR_CORRUPT_FILE,
            "signature verification failed",
            manifest
          ]);
        }
      }
    } finally {
      pkg.close();
    }

    this.updatePersistedMetadata();

    this.addon._install = this;
    this.name = this.addon.selectedLocale.name;
    this.type = this.addon.type;
    this.version = this.addon.version;

    // Setting the iconURL to something inside the XPI locks the XPI and
    // makes it impossible to delete on Windows.

    // Try to load from the existing cache first
    let repoAddon = await AddonRepository.getCachedAddonByID(this.addon.id);

    // It wasn't there so try to re-download it
    if (!repoAddon) {
__L_V__7({
    lN: 1656,tT:'if',pr:'!repoAddon',eT:{},fN:''
  });'__L_V__7';
      try {
        [repoAddon] = await AddonRepository.cacheAddons([this.addon.id]);
      } catch (err) {
        logger.debug(
          `Error getting metadata for ${this.addon.id}: ${err.message}`
        );
      }
    }

    this.addon._repositoryAddon = repoAddon;
    this.name = this.name || this.addon._repositoryAddon.name;
    this.addon.appDisabled = !XPIDatabase.isUsableAddon(this.addon);
    return undefined;
  }

  getIcon(desiredSize = 64) {
__L_V__7({
    lN: 1672,tT:'func',pr:'',eT:{'desiredSize':desiredSize},fN:'getIcon'
  });'__L_V__7';
    if (!this.addon.icons || !this.file) {
__L_V__7({
    lN: 1673,tT:'if',pr:'!this.addon.icons || !this.file',eT:{},fN:''
  });'__L_V__7';
      return null;
    }

    let { icon } = IconDetails.getPreferredIcon(
      this.addon.icons,
      null,
      desiredSize
    );
    if (icon.startsWith("chrome://")) {
__L_V__7({
    lN: 1682,tT:'if',pr:'icon.startsWith(chrome://)',eT:{},fN:''
  });'__L_V__7';
      return icon;
    }
    return getJarURI(this.file, icon).spec;
  }

  /**
   * This method should be called when the XPI is ready to be installed,
   * i.e., when a download finishes or when a local file has been verified.
   * It should only be called from install() when the install is in
   * STATE_DOWNLOADED (which actually means that the file is available
   * and has been verified).
   */
  checkPrompt() {
__L_V__7({
    lN: 1695,tT:'func',pr:'',eT:{},fN:'checkPrompt'
  });'__L_V__7';
    (async () => {
      if (this.promptHandler) {
__L_V__7({
    lN: 1697,tT:'if',pr:'this.promptHandler',eT:{},fN:''
  });'__L_V__7';
        let info = {
          existingAddon: this.existingAddon ? this.existingAddon.wrapper : null,
          addon: this.addon.wrapper,
          // CLIQZ: checks if addon has newtab settings
          changesNewTab: this.addon.changesNewTab,
          icon: this.getIcon(),
          // Used in AMTelemetry to detect the install flow related to this prompt.
          install: this.wrapper,
        };

        try {
          await this.promptHandler(info);
        } catch (err) {
          logger.info(`Install of ${this.addon.id} cancelled by user`);
          this.state = AddonManager.STATE_CANCELLED;
          this._cleanup();
          this._callInstallListeners("onInstallCancelled");
          return;
        }
      }
      this.state = AddonManager.STATE_PROMPTS_DONE;
      this.install();
    })();
  }

  /**
   * This method should be called when we have the XPI and any needed
   * permissions prompts have been completed.  If there are any upgrade
   * listeners, they are invoked and the install moves into STATE_POSTPONED.
   * Otherwise, the install moves into STATE_INSTALLING
   */
  checkForBlockers() {
__L_V__7({
    lN: 1729,tT:'func',pr:'',eT:{},fN:'checkForBlockers'
  });'__L_V__7';
    // If an upgrade listener is registered for this add-on, pass control
    // over the upgrade to the add-on.
    if (AddonManagerPrivate.hasUpgradeListener(this.addon.id)) {
__L_V__7({
    lN: 1732,tT:'if',pr:'AddonManagerPrivate.hasUpgradeListener(this.addon.id)',eT:{},fN:''
  });'__L_V__7';
      logger.info(
        `add-on ${this.addon.id} has an upgrade listener, postponing upgrade until restart`
      );
      let resumeFn = () => {
        logger.info(
          `${this.addon.id} has resumed a previously postponed upgrade`
        );
        this.state = AddonManager.STATE_READY;
        this.install();
      };
      this.postpone(resumeFn);
      return;
    }

    this.state = AddonManager.STATE_READY;
    this.install();
  }

  // TODO This relies on the assumption that we are always installing into the
  // highest priority install location so the resulting add-on will be visible
  // overriding any existing copy in another install location (bug 557710).
  /**
   * Installs the add-on into the install location.
   */
  async startInstall() {
__L_V__7({
    lN: 1757,tT:'func',pr:'',eT:{},fN:'startInstall'
  });'__L_V__7';
    this.state = AddonManager.STATE_INSTALLING;
    if (!this._callInstallListeners("onInstallStarted")) {
__L_V__7({
    lN: 1759,tT:'if',pr:'!this._callInstallListeners(onInstallStarted)',eT:{},fN:''
  });'__L_V__7';
      this.state = AddonManager.STATE_DOWNLOADED;
      this.removeTemporaryFile();
      this._cleanup();
      this._callInstallListeners("onInstallCancelled");
      return;
    }

    // Find and cancel any pending installs for the same add-on in the same
    // install location
    for (let install of XPIInstall.installs) {
      if (
        install.state == AddonManager.STATE_INSTALLED &&
        install.location == this.location &&
        install.addon.id == this.addon.id
      ) {
__L_V__7({
    lN: 1774,tT:'if',pr:' install.state == AddonManager.STATE_INSTALLED && install.location == this.location && install.addon.id == this.addon.id ',eT:{},fN:''
  });'__L_V__7';
        logger.debug(
          `Cancelling previous pending install of ${install.addon.id}`
        );
        install.cancel();
      }
    }

    // Reinstall existing user-disabled addon (of the same installed version).
    // If addon is marked to be uninstalled - don't reinstall it.
    if (
      this.existingAddon &&
      this.existingAddon.location === this.location &&
      this.existingAddon.version === this.addon.version &&
      this.existingAddon.userDisabled &&
      !this.existingAddon.pendingUninstall
    ) {
__L_V__7({
    lN: 1790,tT:'if',pr:' this.existingAddon && this.existingAddon.location === this.location && this.existingAddon.version === this.addon.version && this.existingAddon.userDisabled && !this.existingAddon.pendingUninstall ',eT:{},fN:''
  });'__L_V__7';
      await XPIDatabase.updateAddonDisabledState(this.existingAddon, {
        userDisabled: false,
      });
      this.state = AddonManager.STATE_INSTALLED;
      this._callInstallListeners("onInstallEnded", this.existingAddon.wrapper);
      return;
    }

    let isUpgrade =
      this.existingAddon && this.existingAddon.location == this.location;

    logger.debug(
      "Starting install of " + this.addon.id + " from " + this.sourceURI.spec
    );
    AddonManagerPrivate.callAddonListeners(
      "onInstalling",
      this.addon.wrapper,
      false
    );

    let stagedAddon = this.location.installer.getStagingDir();

    try {
      await this.location.installer.requestStagingDir();

      // remove any previously staged files
      await this.unstageInstall(stagedAddon);

      stagedAddon.append(`${this.addon.id}.xpi`);

      await this.stageInstall(false, stagedAddon, isUpgrade);

      this._cleanup();

      let install = async () => {
        if (this.existingAddon && this.existingAddon.active && !isUpgrade) {
__L_V__7({
    lN: 1826,tT:'if',pr:'this.existingAddon && this.existingAddon.active && !isUpgrade',eT:{},fN:''
  });'__L_V__7';
          XPIDatabase.updateAddonActive(this.existingAddon, false);
        }

        // Install the new add-on into its final location
        let existingAddonID = this.existingAddon ? this.existingAddon.id : null;
        let file = await this.location.installer.installAddon({
          id: this.addon.id,
          source: stagedAddon,
          existingAddonID,
        });

        // Update the metadata in the database
        this.addon.sourceBundle = file;
        this.addon.visible = true;

        if (isUpgrade) {
__L_V__7({
    lN: 1842,tT:'if',pr:'isUpgrade',eT:{},fN:''
  });'__L_V__7';
          this.addon = XPIDatabase.updateAddonMetadata(
            this.existingAddon,
            this.addon,
            file.path
          );
          let state = this.location.get(this.addon.id);
          if (state) {
__L_V__7({
    lN: 1849,tT:'if',pr:'state',eT:{},fN:''
  });'__L_V__7';
            state.syncWithDB(this.addon, true);
          } else {
            logger.warn(
              "Unexpected missing XPI state for add-on ${id}",
              this.addon
            );
          }
        } else {
          this.addon.active = this.addon.visible && !this.addon.disabled;
          this.addon = XPIDatabase.addToDatabase(this.addon, file.path);
          XPIStates.addAddon(this.addon);
          this.addon.installDate = this.addon.updateDate;
          XPIDatabase.saveChanges();
        }
        XPIStates.save();

        AddonManagerPrivate.callAddonListeners(
          "onInstalled",
          this.addon.wrapper
        );

        logger.debug(`Install of ${this.sourceURI.spec} completed.`);
        this.state = AddonManager.STATE_INSTALLED;
        this._callInstallListeners("onInstallEnded", this.addon.wrapper);

        XPIDatabase.recordAddonTelemetry(this.addon);

        // Notify providers that a new theme has been enabled.
        if (this.addon.type === "theme" && this.addon.active) {
__L_V__7({
    lN: 1878,tT:'if',pr:'this.addon.type === theme && this.addon.active',eT:{},fN:''
  });'__L_V__7';
          AddonManagerPrivate.notifyAddonChanged(
            this.addon.id,
            this.addon.type
          );
        }
      };

      this._startupPromise = (async () => {
        if (this.existingAddon) {
__L_V__7({
    lN: 1887,tT:'if',pr:'this.existingAddon',eT:{},fN:''
  });'__L_V__7';
          await XPIInternal.BootstrapScope.get(this.existingAddon).update(
            this.addon,
            !this.addon.disabled,
            install
          );

          if (this.addon.disabled) {
__L_V__7({
    lN: 1894,tT:'if',pr:'this.addon.disabled',eT:{},fN:''
  });'__L_V__7';
            flushJarCache(this.file);
          }
        } else {
          await install();
          await XPIInternal.BootstrapScope.get(this.addon).install(
            undefined,
            true
          );
        }
      })();

      await this._startupPromise;
    } catch (e) {
      logger.warn(
        `Failed to install ${this.file.path} from ${this.sourceURI.spec} to ${stagedAddon.path}`,
        e
      );

      if (stagedAddon.exists()) {
__L_V__7({
    lN: 1913,tT:'if',pr:'stagedAddon.exists()',eT:{},fN:''
  });'__L_V__7';
        recursiveRemove(stagedAddon);
      }
      this.state = AddonManager.STATE_INSTALL_FAILED;
      this.error = AddonManager.ERROR_FILE_ACCESS;
      AddonManagerPrivate.callAddonListeners(
        "onOperationCancelled",
        this.addon.wrapper
      );
      this._callInstallListeners("onInstallFailed");
    } finally {
      this.removeTemporaryFile();
      this.location.installer.releaseStagingDir();
    }
  }

  /**
   * Stages an add-on for install.
   *
   * @param {boolean} restartRequired
   *        If true, the final installation will be deferred until the
   *        next app startup.
   * @param {AddonInternal} stagedAddon
   *        The AddonInternal object for the staged install.
   * @param {boolean} isUpgrade
   *        True if this installation is an upgrade for an existing
   *        add-on.
   */
  async stageInstall(restartRequired, stagedAddon, isUpgrade) {
__L_V__7({
    lN: 1941,tT:'func',pr:'',eT:{'restartRequired':restartRequired,'stagedAddon':stagedAddon,'isUpgrade':isUpgrade},fN:'stageInstall'
  });'__L_V__7';
    logger.debug(`Addon ${this.addon.id} will be installed as a packed xpi`);
    stagedAddon.leafName = `${this.addon.id}.xpi`;

    await OS.File.copy(this.file.path, stagedAddon.path);

    if (restartRequired) {
__L_V__7({
    lN: 1947,tT:'if',pr:'restartRequired',eT:{},fN:''
  });'__L_V__7';
      // Point the add-on to its extracted files as the xpi may get deleted
      this.addon.sourceBundle = stagedAddon;

      // Cache the AddonInternal as it may have updated compatibility info
      this.location.stageAddon(this.addon.id, this.addon.toJSON());

      logger.debug(
        `Staged install of ${this.addon.id} from ${this.sourceURI.spec} ready; waiting for restart.`
      );
      if (isUpgrade) {
__L_V__7({
    lN: 1957,tT:'if',pr:'isUpgrade',eT:{},fN:''
  });'__L_V__7';
        delete this.existingAddon.pendingUpgrade;
        this.existingAddon.pendingUpgrade = this.addon;
      }
    }
  }

  /**
   * Removes any previously staged upgrade.
   *
   * @param {nsIFile} stagingDir
   *        The staging directory from which to unstage the install.
   */
  async unstageInstall(stagingDir) {
__L_V__7({
    lN: 1970,tT:'func',pr:'',eT:{'stagingDir':stagingDir},fN:'unstageInstall'
  });'__L_V__7';
    this.location.unstageAddon(this.addon.id);

    await removeAsync(getFile(this.addon.id, stagingDir));

    await removeAsync(getFile(`${this.addon.id}.xpi`, stagingDir));
  }

  /**
   * Postone a pending update, until restart or until the add-on resumes.
   *
   * @param {function} resumeFn
   *        A function for the add-on to run when resuming.
   */
  async postpone(resumeFn) {
__L_V__7({
    lN: 1984,tT:'func',pr:'',eT:{'resumeFn':resumeFn},fN:'postpone'
  });'__L_V__7';
    this.state = AddonManager.STATE_POSTPONED;

    let stagingDir = this.location.installer.getStagingDir();

    await this.location.installer.requestStagingDir();
    await this.unstageInstall(stagingDir);

    let stagedAddon = getFile(`${this.addon.id}.xpi`, stagingDir);

    await this.stageInstall(true, stagedAddon, true);

    this._callInstallListeners("onInstallPostponed");

    // upgrade has been staged for restart, provide a way for it to call the
    // resume function.
    let callback = AddonManagerPrivate.getUpgradeListener(this.addon.id);
    if (callback) {
__L_V__7({
    lN: 2001,tT:'if',pr:'callback',eT:{},fN:''
  });'__L_V__7';
      callback({
        version: this.version,
        install: () => {
__L_V__7({
    lN: 2005,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';
          switch (this.state) {
            case AddonManager.STATE_POSTPONED:
              if (resumeFn) {
__L_V__7({
    lN: 2007,tT:'if',pr:'resumeFn',eT:{},fN:''
  });'__L_V__7';
                resumeFn();
              }
              break;
            default:
              logger.warn(
                `${this.addon.id} cannot resume postponed upgrade from state (${this.state})`
              );
              break;
          }
        },
      });
    }
    // Release the staging directory lock, but since the staging dir is populated
    // it will not be removed until resumed or installed by restart.
    // See also cleanStagingDir()
    this.location.installer.releaseStagingDir();
  }

  _callInstallListeners(event, ...args) {
__L_V__7({
    lN: 2026,tT:'func',pr:'',eT:{'event':event,'args':args},fN:'_callInstallListeners'
  });'__L_V__7';
__L_V__7({
    lN: 2027,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';
    switch (event) {
      case "onDownloadCancelled":
      case "onDownloadFailed":
      case "onInstallCancelled":
      case "onInstallFailed":
        let rej = Promise.reject(new Error(`Install failed: ${event}`));
        rej.catch(() => {});
        this._resolveInstallPromise(rej);
        break;
      case "onInstallEnded":
        this._resolveInstallPromise(
          Promise.resolve(this._startupPromise).then(() => args[0])
        );
        break;
    }
    return AddonManagerPrivate.callInstallListeners(
      event,
      this.listeners,
      this.wrapper,
      ...args
    );
  }
}

var LocalAddonInstall = class extends AddonInstall {
  /**
   * Initialises this install to be an install from a local file.
   */
  async init() {
__L_V__7({
    lN: 2055,tT:'func',pr:'',eT:{},fN:'init'
  });'__L_V__7';
    this.file = this.sourceURI.QueryInterface(Ci.nsIFileURL).file;

    if (!this.file.exists()) {
__L_V__7({
    lN: 2058,tT:'if',pr:'!this.file.exists()',eT:{},fN:''
  });'__L_V__7';
      logger.warn("XPI file " + this.file.path + " does not exist");
      this.state = AddonManager.STATE_DOWNLOAD_FAILED;
      this.error = AddonManager.ERROR_NETWORK_FAILURE;
      this._cleanup();
      return;
    }

    this.state = AddonManager.STATE_DOWNLOADED;
    this.progress = this.file.fileSize;
    this.maxProgress = this.file.fileSize;

    if (this.hash) {
__L_V__7({
    lN: 2070,tT:'if',pr:'this.hash',eT:{},fN:''
  });'__L_V__7';
      let crypto;
      try {
        crypto = CryptoHash(this.hash.algorithm);
      } catch (e) {
        logger.warn(
          "Unknown hash algorithm '" +
            this.hash.algorithm +
            "' for addon " +
            this.sourceURI.spec,
          e
        );
        this.state = AddonManager.STATE_DOWNLOAD_FAILED;
        this.error = AddonManager.ERROR_INCORRECT_HASH;
        this._cleanup();
        return;
      }

      let fis = new FileInputStream(this.file, -1, -1, false);
      crypto.updateFromStream(fis, this.file.fileSize);
      let calculatedHash = getHashStringForCrypto(crypto);
      if (calculatedHash != this.hash.data) {
__L_V__7({
    lN: 2091,tT:'if',pr:'calculatedHash != this.hash.data',eT:{},fN:''
  });'__L_V__7';
        logger.warn(
          "File hash (" +
            calculatedHash +
            ") did not match provided hash (" +
            this.hash.data +
            ")"
        );
        this.state = AddonManager.STATE_DOWNLOAD_FAILED;
        this.error = AddonManager.ERROR_INCORRECT_HASH;
        this._cleanup();
        return;
      }
    }

    try {
      await this.loadManifest(this.file);
    } catch ([error, message]) {
      logger.warn("Invalid XPI", message);
      this.state = AddonManager.STATE_DOWNLOAD_FAILED;
      this.error = error;
      this._cleanup();
      this._callInstallListeners("onNewInstall");
      flushJarCache(this.file);
      return;
    }

    let addon = await XPIDatabase.getVisibleAddonForID(this.addon.id);

    this.existingAddon = addon;
    this.addon.propagateDisabledState(this.existingAddon);
    await this.addon.updateBlocklistState();
    this.addon.updateDate = Date.now();
    this.addon.installDate = addon ? addon.installDate : this.addon.updateDate;

    if (!this.addon.isCompatible) {
__L_V__7({
    lN: 2126,tT:'if',pr:'!this.addon.isCompatible',eT:{},fN:''
  });'__L_V__7';
      this.state = AddonManager.STATE_CHECKING;

      await new Promise(resolve => {
        new UpdateChecker(
          this.addon,
          {
            onUpdateFinished: aAddon => {
              this.state = AddonManager.STATE_DOWNLOADED;
              this._callInstallListeners("onNewInstall");
              resolve();
            },
          },
          AddonManager.UPDATE_WHEN_ADDON_INSTALLED
        );
      });
    } else {
      this._callInstallListeners("onNewInstall");
    }
  }

  install() {
__L_V__7({
    lN: 2147,tT:'func',pr:'',eT:{},fN:'install'
  });'__L_V__7';
    if (this.state == AddonManager.STATE_DOWNLOAD_FAILED) {
__L_V__7({
    lN: 2148,tT:'if',pr:'this.state == AddonManager.STATE_DOWNLOAD_FAILED',eT:{},fN:''
  });'__L_V__7';
      // For a local install, this state means that verification of the
      // file failed (e.g., the hash or signature or manifest contents
      // were invalid).  It doesn't make sense to retry anything in this
      // case but we have callers who don't know if their AddonInstall
      // object is a local file or a download so accommodate them here.
      this._callInstallListeners("onDownloadFailed");
      return this._installPromise;
    }
    return super.install();
  }
};

var DownloadAddonInstall = class extends AddonInstall {
  /**
   * Instantiates a DownloadAddonInstall
   *
   * @param {XPIStateLocation} installLocation
   *        The XPIStateLocation the add-on will be installed into
   * @param {nsIURL} url
   *        The nsIURL to get the add-on from
   * @param {Object} [options = {}]
   *        Additional options for the install
   * @param {string} [options.hash]
   *        An optional hash for the add-on
   * @param {AddonInternal} [options.existingAddon]
   *        The add-on this install will update if known
   * @param {XULElement} [options.browser]
   *        The browser performing the install, used to display
   *        authentication prompts.
   * @param {nsIPrincipal} [options.principal]
   *        The principal to use. If not present, will default to browser.contentPrincipal.
   * @param {string} [options.name]
   *        An optional name for the add-on
   * @param {string} [options.type]
   *        An optional type for the add-on
   * @param {Object} [options.icons]
   *        Optional icons for the add-on
   * @param {string} [options.version]
   *        An optional version for the add-on
   * @param {function(string) : Promise<void>} [options.promptHandler]
   *        A callback to prompt the user before installing.
   * @param {boolean} [options.sendCookies]
   *        Whether cookies should be sent when downloading the add-on.
   */
  constructor(installLocation, url, options = {}) {
__L_V__7({
    lN: 2193,tT:'func',pr:'',eT:{'installLocation':installLocation,'url':url,'options':options},fN:'constructor'
  });'__L_V__7';
    super(installLocation, url, options);

    this.browser = options.browser;
    this.loadingPrincipal =
      options.triggeringPrincipal ||
      (this.browser && this.browser.contentPrincipal) ||
      Services.scriptSecurityManager.getSystemPrincipal();
    this.sendCookies = Boolean(options.sendCookies);

    this.state = AddonManager.STATE_AVAILABLE;

    this.stream = null;
    this.crypto = null;
    this.badCertHandler = null;
    this.restartDownload = false;
    this.downloadStartedAt = null;

    this._callInstallListeners("onNewInstall", this.listeners, this.wrapper);
  }

  install() {
__L_V__7({
    lN: 2214,tT:'func',pr:'',eT:{},fN:'install'
  });'__L_V__7';
__L_V__7({
    lN: 2215,tT:'switch',pr:'',eT:{},fN:''
  });'__L_V__7';
    switch (this.state) {
      case AddonManager.STATE_AVAILABLE:
        this.startDownload();
        break;
      case AddonManager.STATE_DOWNLOAD_FAILED:
      case AddonManager.STATE_INSTALL_FAILED:
      case AddonManager.STATE_CANCELLED:
        this.removeTemporaryFile();
        this.state = AddonManager.STATE_AVAILABLE;
        this.error = 0;
        this.progress = 0;
        this.maxProgress = -1;
        this.hash = this.originalHash;
        this.startDownload();
        break;
      default:
        return super.install();
    }
    return this._installPromise;
  }

  cancel() {
__L_V__7({
    lN: 2236,tT:'func',pr:'',eT:{},fN:'cancel'
  });'__L_V__7';
    if (this.state == AddonManager.STATE_DOWNLOADING) {
__L_V__7({
    lN: 2237,tT:'if',pr:'this.state == AddonManager.STATE_DOWNLOADING',eT:{},fN:''
  });'__L_V__7';
      if (this.channel) {
__L_V__7({
    lN: 2238,tT:'if',pr:'this.channel',eT:{},fN:''
  });'__L_V__7';
        logger.debug("Cancelling download of " + this.sourceURI.spec);
        this.channel.cancel(Cr.NS_BINDING_ABORTED);
      }
    } else {
      super.cancel();
    }
  }

  observe(aSubject, aTopic, aData) {
__L_V__7({
    lN: 2247,tT:'func',pr:'',eT:{'aSubject':aSubject,'aTopic':aTopic,'aData':aData},fN:'observe'
  });'__L_V__7';
    // Network is going offline
    this.cancel();
  }

  /**
   * Starts downloading the add-on's XPI file.
   */
  startDownload() {
__L_V__7({
    lN: 2255,tT:'func',pr:'',eT:{},fN:'startDownload'
  });'__L_V__7';
    this.downloadStartedAt = Cu.now();

    this.state = AddonManager.STATE_DOWNLOADING;
    if (!this._callInstallListeners("onDownloadStarted")) {
__L_V__7({
    lN: 2259,tT:'if',pr:'!this._callInstallListeners(onDownloadStarted)',eT:{},fN:''
  });'__L_V__7';
      logger.debug(
        "onDownloadStarted listeners cancelled installation of addon " +
          this.sourceURI.spec
      );
      this.state = AddonManager.STATE_CANCELLED;
      this._cleanup();
      this._callInstallListeners("onDownloadCancelled");
      return;
    }

    // If a listener changed our state then do not proceed with the download
    if (this.state != AddonManager.STATE_DOWNLOADING) {
__L_V__7({
    lN: 2271,tT:'if',pr:'this.state != AddonManager.STATE_DOWNLOADING',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    if (this.channel) {
__L_V__7({
    lN: 2275,tT:'if',pr:'this.channel',eT:{},fN:''
  });'__L_V__7';
      // A previous download attempt hasn't finished cleaning up yet, signal
      // that it should restart when complete
      logger.debug("Waiting for previous download to complete");
      this.restartDownload = true;
      return;
    }

    this.openChannel();
  }

  openChannel() {
__L_V__7({
    lN: 2286,tT:'func',pr:'',eT:{},fN:'openChannel'
  });'__L_V__7';
    this.restartDownload = false;

    try {
      this.file = getTemporaryFile();
      this.ownsTempFile = true;
      this.stream = new FileOutputStream(
        this.file,
        FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE,
        FileUtils.PERMS_FILE,
        0
      );
    } catch (e) {
      logger.warn(
        "Failed to start download for addon " + this.sourceURI.spec,
        e
      );
      this.state = AddonManager.STATE_DOWNLOAD_FAILED;
      this.error = AddonManager.ERROR_FILE_ACCESS;
      this._cleanup();
      this._callInstallListeners("onDownloadFailed");
      return;
    }

    let listener = Cc[
      "@mozilla.org/network/stream-listener-tee;1"
    ].createInstance(Ci.nsIStreamListenerTee);
    listener.init(this, this.stream);
    try {
      let requireBuiltIn = Services.prefs.getBoolPref(
        PREF_INSTALL_REQUIREBUILTINCERTS,
        true
      );
      this.badCertHandler = new CertUtils.BadCertHandler(!requireBuiltIn);

      this.channel = NetUtil.newChannel({
        uri: this.sourceURI,
        securityFlags: Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_INHERITS,
        contentPolicyType: Ci.nsIContentPolicy.TYPE_SAVEAS_DOWNLOAD,
        loadingPrincipal: this.loadingPrincipal,
      });
      this.channel.notificationCallbacks = this;
      if (this.sendCookies) {
__L_V__7({
    lN: 2328,tT:'if',pr:'this.sendCookies',eT:{},fN:''
  });'__L_V__7';
        if (this.channel instanceof Ci.nsIHttpChannelInternal) {
__L_V__7({
    lN: 2329,tT:'if',pr:'this.channel instanceof Ci.nsIHttpChannelInternal',eT:{},fN:''
  });'__L_V__7';
          this.channel.forceAllowThirdPartyCookie = true;
        }
      } else {
        this.channel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
      }
      this.channel.asyncOpen(listener);

      Services.obs.addObserver(this, "network:offline-about-to-go-offline");
    } catch (e) {
      logger.warn(
        "Failed to start download for addon " + this.sourceURI.spec,
        e
      );
      this.state = AddonManager.STATE_DOWNLOAD_FAILED;
      this.error = AddonManager.ERROR_NETWORK_FAILURE;
      this._cleanup();
      this._callInstallListeners("onDownloadFailed");
    }
  }

  /*
   * Update the crypto hasher with the new data and call the progress listeners.
   *
   * @see nsIStreamListener
   */
  onDataAvailable(aRequest, aInputstream, aOffset, aCount) {
__L_V__7({
    lN: 2355,tT:'func',pr:'',eT:{'aRequest':aRequest,'aInputstream':aInputstream,'aOffset':aOffset,'aCount':aCount},fN:'onDataAvailable'
  });'__L_V__7';
    this.crypto.updateFromStream(aInputstream, aCount);
    this.progress += aCount;
    if (!this._callInstallListeners("onDownloadProgress")) {
__L_V__7({
    lN: 2358,tT:'if',pr:'!this._callInstallListeners(onDownloadProgress)',eT:{},fN:''
  });'__L_V__7';
      // TODO cancel the download and make it available again (bug 553024)
    }
  }

  /*
   * Check the redirect response for a hash of the target XPI and verify that
   * we don't end up on an insecure channel.
   *
   * @see nsIChannelEventSink
   */
  asyncOnChannelRedirect(aOldChannel, aNewChannel, aFlags, aCallback) {
__L_V__7({
    lN: 2369,tT:'func',pr:'',eT:{'aOldChannel':aOldChannel,'aNewChannel':aNewChannel,'aFlags':aFlags,'aCallback':aCallback},fN:'asyncOnChannelRedirect'
  });'__L_V__7';
    if (
      !this.hash &&
      aOldChannel.originalURI.schemeIs("https") &&
      aOldChannel instanceof Ci.nsIHttpChannel
    ) {
__L_V__7({
    lN: 2374,tT:'if',pr:' !this.hash && aOldChannel.originalURI.schemeIs(https) && aOldChannel instanceof Ci.nsIHttpChannel ',eT:{},fN:''
  });'__L_V__7';
      try {
        let hashStr = aOldChannel.getResponseHeader("X-Target-Digest");
        let hashSplit = hashStr.toLowerCase().split(":");
        this.hash = {
          algorithm: hashSplit[0],
          data: hashSplit[1],
        };
      } catch (e) {}
    }

    // Verify that we don't end up on an insecure channel if we haven't got a
    // hash to verify with (see bug 537761 for discussion)
    if (!this.hash) {
__L_V__7({
    lN: 2387,tT:'if',pr:'!this.hash',eT:{},fN:''
  });'__L_V__7';
      this.badCertHandler.asyncOnChannelRedirect(
        aOldChannel,
        aNewChannel,
        aFlags,
        aCallback
      );
    } else {
      aCallback.onRedirectVerifyCallback(Cr.NS_OK);
    }

    this.channel = aNewChannel;
  }

  /*
   * This is the first chance to get at real headers on the channel.
   *
   * @see nsIStreamListener
   */
  onStartRequest(aRequest) {
__L_V__7({
    lN: 2406,tT:'func',pr:'',eT:{'aRequest':aRequest},fN:'onStartRequest'
  });'__L_V__7';
    if (this.hash) {
__L_V__7({
    lN: 2407,tT:'if',pr:'this.hash',eT:{},fN:''
  });'__L_V__7';
      try {
        this.crypto = CryptoHash(this.hash.algorithm);
      } catch (e) {
        logger.warn(
          "Unknown hash algorithm '" +
            this.hash.algorithm +
            "' for addon " +
            this.sourceURI.spec,
          e
        );
        this.state = AddonManager.STATE_DOWNLOAD_FAILED;
        this.error = AddonManager.ERROR_INCORRECT_HASH;
        this._cleanup();
        this._callInstallListeners("onDownloadFailed");
        aRequest.cancel(Cr.NS_BINDING_ABORTED);
        return;
      }
    } else {
      // We always need something to consume data from the inputstream passed
      // to onDataAvailable so just create a dummy cryptohasher to do that.
      this.crypto = CryptoHash("sha1");
    }

    this.progress = 0;
    if (aRequest instanceof Ci.nsIChannel) {
__L_V__7({
    lN: 2432,tT:'if',pr:'aRequest instanceof Ci.nsIChannel',eT:{},fN:''
  });'__L_V__7';
      try {
        this.maxProgress = aRequest.contentLength;
      } catch (e) {}
      logger.debug(
        "Download started for " +
          this.sourceURI.spec +
          " to file " +
          this.file.path
      );
    }
  }

  /*
   * The download is complete.
   *
   * @see nsIStreamListener
   */
  onStopRequest(aRequest, aStatus) {
__L_V__7({
    lN: 2450,tT:'func',pr:'',eT:{'aRequest':aRequest,'aStatus':aStatus},fN:'onStopRequest'
  });'__L_V__7';
    this.stream.close();
    this.channel = null;
    this.badCerthandler = null;
    Services.obs.removeObserver(this, "network:offline-about-to-go-offline");

    // If the download was cancelled then update the state and send events
    if (aStatus == Cr.NS_BINDING_ABORTED) {
__L_V__7({
    lN: 2457,tT:'if',pr:'aStatus == Cr.NS_BINDING_ABORTED',eT:{},fN:''
  });'__L_V__7';
      if (this.state == AddonManager.STATE_DOWNLOADING) {
__L_V__7({
    lN: 2458,tT:'if',pr:'this.state == AddonManager.STATE_DOWNLOADING',eT:{},fN:''
  });'__L_V__7';
        logger.debug("Cancelled download of " + this.sourceURI.spec);
        this.state = AddonManager.STATE_CANCELLED;
        this._cleanup();
        this._callInstallListeners("onDownloadCancelled");
        // If a listener restarted the download then there is no need to
        // remove the temporary file
        if (this.state != AddonManager.STATE_CANCELLED) {
__L_V__7({
    lN: 2465,tT:'if',pr:'this.state != AddonManager.STATE_CANCELLED',eT:{},fN:''
  });'__L_V__7';
          return;
        }
      }

      this.removeTemporaryFile();
      if (this.restartDownload) {
__L_V__7({
    lN: 2471,tT:'if',pr:'this.restartDownload',eT:{},fN:''
  });'__L_V__7';
        this.openChannel();
      }
      return;
    }

    logger.debug("Download of " + this.sourceURI.spec +
            " completed with satatus " + aStatus);

    if (Components.isSuccessCode(aStatus)) {
__L_V__7({
    lN: 2480,tT:'if',pr:'Components.isSuccessCode(aStatus)',eT:{},fN:''
  });'__L_V__7';
      if (
        !(aRequest instanceof Ci.nsIHttpChannel) ||
        aRequest.requestSucceeded
      ) {
__L_V__7({
    lN: 2484,tT:'if',pr:' !(aRequest instanceof Ci.nsIHttpChannel) || aRequest.requestSucceeded ',eT:{},fN:''
  });'__L_V__7';
        if (!this.hash && aRequest instanceof Ci.nsIChannel) {
__L_V__7({
    lN: 2485,tT:'if',pr:'!this.hash && aRequest instanceof Ci.nsIChannel',eT:{},fN:''
  });'__L_V__7';
          try {
            CertUtils.checkCert(
              aRequest,
              !Services.prefs.getBoolPref(
                PREF_INSTALL_REQUIREBUILTINCERTS,
                true
              )
            );
          } catch (e) {
            this.downloadFailed(AddonManager.ERROR_NETWORK_FAILURE, e);
            return;
          }
        }

        // convert the binary hash data to a hex string.
        let calculatedHash = getHashStringForCrypto(this.crypto);
        this.crypto = null;
        if (this.hash && calculatedHash != this.hash.data) {
__L_V__7({
    lN: 2503,tT:'if',pr:'this.hash && calculatedHash != this.hash.data',eT:{},fN:''
  });'__L_V__7';
          this.downloadFailed(
            AddonManager.ERROR_INCORRECT_HASH,
            "Downloaded file hash (" +
              calculatedHash +
              ") did not match provided hash (" +
              this.hash.data +
              ")"
          );
          return;
        }

        this.loadManifest(this.file).then(
          () => {
            if (this.addon.isCompatible) {
__L_V__7({
    lN: 2517,tT:'if',pr:'this.addon.isCompatible',eT:{},fN:''
  });'__L_V__7';
              this.downloadCompleted();
            } else {
              // TODO Should we send some event here (bug 557716)?
              this.state = AddonManager.STATE_CHECKING;
              new UpdateChecker(
                this.addon,
                {
                  onUpdateFinished: aAddon => this.downloadCompleted(),
                },
                AddonManager.UPDATE_WHEN_ADDON_INSTALLED
              );
            }
          },
          ([error, message, manifest]) => {
            manifest = manifest || this.addon;
            XPIDatabase.reportAddonInstallationAttempt(
              manifest.id,
              manifest.type,
              "download"
            );
            this.removeTemporaryFile();
            this.downloadFailed(error, message);
          });
      } else if (aRequest instanceof Ci.nsIHttpChannel) {
__L_V__7({
    lN: 2541,tT:'if',pr:'aRequest instanceof Ci.nsIHttpChannel',eT:{},fN:''
  });'__L_V__7';
        this.downloadFailed(
          AddonManager.ERROR_NETWORK_FAILURE,
          aRequest.responseStatus + " " + aRequest.responseStatusText
        );
      } else {
        this.downloadFailed(AddonManager.ERROR_NETWORK_FAILURE, aStatus);
      }
    } else {
      this.downloadFailed(AddonManager.ERROR_NETWORK_FAILURE, aStatus);
    }
  }

  /**
   * Notify listeners that the download failed.
   *
   * @param {string} aReason
   *        Something to log about the failure
   * @param {integer} aError
   *        The error code to pass to the listeners
   */
  downloadFailed(aReason, aError) {
__L_V__7({
    lN: 2562,tT:'func',pr:'',eT:{'aReason':aReason,'aError':aError},fN:'downloadFailed'
  });'__L_V__7';
    logger.warn("Download of " + this.sourceURI.spec + " failed", aError);
    this.state = AddonManager.STATE_DOWNLOAD_FAILED;
    this.error = aReason;
    this._cleanup();
    this._callInstallListeners("onDownloadFailed");

    // If the listener hasn't restarted the download then remove any temporary
    // file
    if (this.state == AddonManager.STATE_DOWNLOAD_FAILED) {
__L_V__7({
    lN: 2571,tT:'if',pr:'this.state == AddonManager.STATE_DOWNLOAD_FAILED',eT:{},fN:''
  });'__L_V__7';
      logger.debug(
        "downloadFailed: removing temp file for " + this.sourceURI.spec
      );
      this.removeTemporaryFile();
    } else {
      logger.debug(
        "downloadFailed: listener changed AddonInstall state for " +
          this.sourceURI.spec +
          " to " +
          this.state
      );
    }
  }

  /**
   * Notify listeners that the download completed.
   */
  async downloadCompleted() {
__L_V__7({
    lN: 2589,tT:'func',pr:'',eT:{},fN:'downloadCompleted'
  });'__L_V__7';
    let aAddon = await XPIDatabase.getVisibleAddonForID(this.addon.id);
    if (aAddon) {
__L_V__7({
    lN: 2591,tT:'if',pr:'aAddon',eT:{},fN:''
  });'__L_V__7';
      this.existingAddon = aAddon;
    }

    this.state = AddonManager.STATE_DOWNLOADED;
    this.addon.updateDate = Date.now();

    if (this.existingAddon) {
__L_V__7({
    lN: 2598,tT:'if',pr:'this.existingAddon',eT:{},fN:''
  });'__L_V__7';
      this.addon.existingAddonID = this.existingAddon.id;
      this.addon.installDate = this.existingAddon.installDate;
    } else {
      this.addon.installDate = this.addon.updateDate;
    }
    this.addon.propagateDisabledState(this.existingAddon);
    await this.addon.updateBlocklistState();

    if (this._callInstallListeners("onDownloadEnded")) {
__L_V__7({
    lN: 2607,tT:'if',pr:'this._callInstallListeners(onDownloadEnded)',eT:{},fN:''
  });'__L_V__7';
      // If a listener changed our state then do not proceed with the install
      if (this.state != AddonManager.STATE_DOWNLOADED) {
__L_V__7({
    lN: 2609,tT:'if',pr:'this.state != AddonManager.STATE_DOWNLOADED',eT:{},fN:''
  });'__L_V__7';
        return;
      }

      // proceed with the install state machine.
      this.install();
    }
  }

  getInterface(iid) {
__L_V__7({
    lN: 2618,tT:'func',pr:'',eT:{'iid':iid},fN:'getInterface'
  });'__L_V__7';
    if (iid.equals(Ci.nsIAuthPrompt2)) {
__L_V__7({
    lN: 2619,tT:'if',pr:'iid.equals(Ci.nsIAuthPrompt2)',eT:{},fN:''
  });'__L_V__7';
      let win = null;
      if (this.browser) {
__L_V__7({
    lN: 2621,tT:'if',pr:'this.browser',eT:{},fN:''
  });'__L_V__7';
        win = this.browser.contentWindow || this.browser.ownerGlobal;
      }

      let factory = Cc["@mozilla.org/prompter;1"].getService(
        Ci.nsIPromptFactory
      );
      let prompt = factory.getPrompt(win, Ci.nsIAuthPrompt2);

      if (this.browser && prompt instanceof Ci.nsILoginManagerAuthPrompter) {
__L_V__7({
    lN: 2630,tT:'if',pr:'this.browser && prompt instanceof Ci.nsILoginManagerAuthPrompter',eT:{},fN:''
  });'__L_V__7';
        prompt.browser = this.browser;
      }

      return prompt;
    } else if (iid.equals(Ci.nsIChannelEventSink)) {
__L_V__7({
    lN: 2635,tT:'if',pr:'iid.equals(Ci.nsIChannelEventSink)',eT:{},fN:''
  });'__L_V__7';
      return this;
    }

    return this.badCertHandler.getInterface(iid);
  }
};

/**
 * Creates a new AddonInstall for an update.
 *
 * @param {function} aCallback
 *        The callback to pass the new AddonInstall to
 * @param {AddonInternal} aAddon
 *        The add-on being updated
 * @param {Object} aUpdate
 *        The metadata about the new version from the update manifest
 * @param {boolean} isUserRequested
 *        An optional boolean, true if the install object is related to a user triggered update.
 */
function createUpdate(aCallback, aAddon, aUpdate, isUserRequested) {
__L_V__7({
    lN: 2655,tT:'func',pr:'',eT:{'aCallback':aCallback,'aAddon':aAddon,'aUpdate':aUpdate,'isUserRequested':isUserRequested},fN:'createUpdate'
  });'__L_V__7';
  let url = Services.io.newURI(aUpdate.updateURL);

  (async function() {
__L_V__7({
    lN: 2658,tT:'func',pr:'',eT:{},fN:'function'
  });'__L_V__7';
    let opts = {
      hash: aUpdate.updateHash,
      existingAddon: aAddon,
      name: aAddon.selectedLocale.name,
      type: aAddon.type,
      icons: aAddon.icons,
      version: aUpdate.version,
      isUserRequestedUpdate: isUserRequested,
    };

    try {
      if (aUpdate.updateInfoURL) {
__L_V__7({
    lN: 2670,tT:'if',pr:'aUpdate.updateInfoURL',eT:{},fN:''
  });'__L_V__7';
        opts.releaseNotesURI = Services.io.newURI(
          escapeAddonURI(aAddon, aUpdate.updateInfoURL)
        );
      }
    } catch (e) {
      // If the releaseNotesURI cannot be parsed then just ignore it.
    }

    let install;
    if (url instanceof Ci.nsIFileURL) {
__L_V__7({
    lN: 2680,tT:'if',pr:'url instanceof Ci.nsIFileURL',eT:{},fN:''
  });'__L_V__7';
      install = new LocalAddonInstall(aAddon.location, url, opts);
      await install.init();
    } else {
      install = new DownloadAddonInstall(aAddon.location, url, opts);
    }

    aCallback(install);
  })();
}

// Maps instances of AddonInstall to AddonInstallWrapper
const wrapperMap = new WeakMap();
let installFor = wrapper => wrapperMap.get(wrapper);

// Numeric id included in the install telemetry events to correlate multiple events related
// to the same install or update flow.
let nextInstallId = 0;

/**
 * Creates a wrapper for an AddonInstall that only exposes the public API
 *
 * @param {AddonInstall} aInstall
 *        The AddonInstall to create a wrapper for
 */
function AddonInstallWrapper(aInstall) {
__L_V__7({
    lN: 2705,tT:'func',pr:'',eT:{'aInstall':aInstall},fN:'AddonInstallWrapper'
  });'__L_V__7';
  wrapperMap.set(this, aInstall);
  this.installId = ++nextInstallId;
}

AddonInstallWrapper.prototype = {
  get __AddonInstallInternal__() {
__L_V__7({
    lN: 2711,tT:'func',pr:'',eT:{},fN:'__AddonInstallInternal__'
  });'__L_V__7';
    return AppConstants.DEBUG ? installFor(this) : undefined;
  },

  get type() {
__L_V__7({
    lN: 2715,tT:'func',pr:'',eT:{},fN:'type'
  });'__L_V__7';
    return installFor(this).type;
  },

  get iconURL() {
__L_V__7({
    lN: 2719,tT:'func',pr:'',eT:{},fN:'iconURL'
  });'__L_V__7';
    return installFor(this).icons[32];
  },

  get existingAddon() {
__L_V__7({
    lN: 2723,tT:'func',pr:'',eT:{},fN:'existingAddon'
  });'__L_V__7';
    let install = installFor(this);
    return install.existingAddon ? install.existingAddon.wrapper : null;
  },

  get addon() {
__L_V__7({
    lN: 2728,tT:'func',pr:'',eT:{},fN:'addon'
  });'__L_V__7';
    let install = installFor(this);
    return install.addon ? install.addon.wrapper : null;
  },

  get sourceURI() {
__L_V__7({
    lN: 2733,tT:'func',pr:'',eT:{},fN:'sourceURI'
  });'__L_V__7';
    return installFor(this).sourceURI;
  },

  set promptHandler(handler) {
__L_V__7({
    lN: 2737,tT:'func',pr:'',eT:{'handler':handler},fN:'promptHandler'
  });'__L_V__7';
    installFor(this).promptHandler = handler;
  },

  get installTelemetryInfo() {
__L_V__7({
    lN: 2741,tT:'func',pr:'',eT:{},fN:'installTelemetryInfo'
  });'__L_V__7';
    return installFor(this).installTelemetryInfo;
  },

  get isUserRequestedUpdate() {
__L_V__7({
    lN: 2745,tT:'func',pr:'',eT:{},fN:'isUserRequestedUpdate'
  });'__L_V__7';
    return Boolean(installFor(this).isUserRequestedUpdate);
  },

  get downloadStartedAt() {
__L_V__7({
    lN: 2749,tT:'func',pr:'',eT:{},fN:'downloadStartedAt'
  });'__L_V__7';
    return installFor(this).downloadStartedAt;
  },

  install() {
__L_V__7({
    lN: 2753,tT:'func',pr:'',eT:{},fN:'install'
  });'__L_V__7';
    return installFor(this).install();
  },

  cancel() {
__L_V__7({
    lN: 2757,tT:'func',pr:'',eT:{},fN:'cancel'
  });'__L_V__7';
    installFor(this).cancel();
  },

  addListener(listener) {
__L_V__7({
    lN: 2761,tT:'func',pr:'',eT:{'listener':listener},fN:'addListener'
  });'__L_V__7';
    installFor(this).addListener(listener);
  },

  removeListener(listener) {
__L_V__7({
    lN: 2765,tT:'func',pr:'',eT:{'listener':listener},fN:'removeListener'
  });'__L_V__7';
    installFor(this).removeListener(listener);
  },
};

[
  "name",
  "version",
  "icons",
  "releaseNotesURI",
  "file",
  "state",
  "error",
  "progress",
  "maxProgress",
].forEach(function(aProp) {
  Object.defineProperty(AddonInstallWrapper.prototype, aProp, {
    get() {
__L_V__7({
    lN: 2782,tT:'func',pr:'',eT:{},fN:'get'
  });'__L_V__7';
      return installFor(this)[aProp];
    },
    enumerable: true,
  });
});

/**
 * Creates a new update checker.
 *
 * @param {AddonInternal} aAddon
 *        The add-on to check for updates
 * @param {UpdateListener} aListener
 *        An UpdateListener to notify of updates
 * @param {integer} aReason
 *        The reason for the update check
 * @param {string} [aAppVersion]
 *        An optional application version to check for updates for
 * @param {string} [aPlatformVersion]
 *        An optional platform version to check for updates for
 * @throws if the aListener or aReason arguments are not valid
 */
var AddonUpdateChecker;
var UpdateChecker = function(
  aAddon,
  aListener,
  aReason,
  aAppVersion,
  aPlatformVersion
) {
__L_V__7({
    lN: 2811,tT:'func',pr:'',eT:{'aAddon':aAddon,'aListener':aListener,'aReason':aReason,'aAppVersion':aAppVersion,'aPlatformVersion':aPlatformVersion},fN:'function'
  });'__L_V__7';
  if (!aListener || !aReason) {
__L_V__7({
    lN: 2812,tT:'if',pr:'!aListener || !aReason',eT:{},fN:''
  });'__L_V__7';
    throw Cr.NS_ERROR_INVALID_ARG;
  }

  ({ AddonUpdateChecker } = ChromeUtils.import(
    "resource://gre/modules/addons/AddonUpdateChecker.jsm"
  ));

  this.addon = aAddon;
  aAddon._updateCheck = this;
  XPIInstall.doing(this);
  this.listener = aListener;
  this.appVersion = aAppVersion;
  this.platformVersion = aPlatformVersion;
  this.syncCompatibility =
    aReason == AddonManager.UPDATE_WHEN_NEW_APP_INSTALLED;
  this.isUserRequested = aReason == AddonManager.UPDATE_WHEN_USER_REQUESTED;

  let updateURL = aAddon.updateURL;
  if (!updateURL) {
__L_V__7({
    lN: 2831,tT:'if',pr:'!updateURL',eT:{},fN:''
  });'__L_V__7';
    if (
      aReason == AddonManager.UPDATE_WHEN_PERIODIC_UPDATE &&
      Services.prefs.getPrefType(PREF_EM_UPDATE_BACKGROUND_URL) ==
        Services.prefs.PREF_STRING
    ) {
__L_V__7({
    lN: 2836,tT:'if',pr:' aReason == AddonManager.UPDATE_WHEN_PERIODIC_UPDATE && Services.prefs.getPrefType(PREF_EM_UPDATE_BACKGROUND_URL) == Services.prefs.PREF_STRING ',eT:{},fN:''
  });'__L_V__7';
      updateURL = Services.prefs.getCharPref(PREF_EM_UPDATE_BACKGROUND_URL);
    } else {
      updateURL = Services.prefs.getCharPref(PREF_EM_UPDATE_URL);
    }
  }

  const UPDATE_TYPE_COMPATIBILITY = 32;
  const UPDATE_TYPE_NEWVERSION = 64;

  aReason |= UPDATE_TYPE_COMPATIBILITY;
  if ("onUpdateAvailable" in this.listener) {
__L_V__7({
    lN: 2847,tT:'if',pr:'onUpdateAvailable in this.listener',eT:{},fN:''
  });'__L_V__7';
    aReason |= UPDATE_TYPE_NEWVERSION;
  }

  let url = escapeAddonURI(aAddon, updateURL, aReason, aAppVersion);
  this._parser = AddonUpdateChecker.checkForUpdates(aAddon.id, url, this);
};

UpdateChecker.prototype = {
  addon: null,
  listener: null,
  appVersion: null,
  platformVersion: null,
  syncCompatibility: null,

  /**
   * Calls a method on the listener passing any number of arguments and
   * consuming any exceptions.
   *
   * @param {string} aMethod
   *        The method to call on the listener
   * @param {any[]} aArgs
   *        Additional arguments to pass to the listener.
   */
  callListener(aMethod, ...aArgs) {
__L_V__7({
    lN: 2871,tT:'func',pr:'',eT:{'aMethod':aMethod,'aArgs':aArgs},fN:'callListener'
  });'__L_V__7';
    if (!(aMethod in this.listener)) {
__L_V__7({
    lN: 2872,tT:'if',pr:'!(aMethod in this.listener)',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    try {
      this.listener[aMethod].apply(this.listener, aArgs);
    } catch (e) {
      logger.warn("Exception calling UpdateListener method " + aMethod, e);
    }
  },

  /**
   * Called when AddonUpdateChecker completes the update check
   *
   * @param {object[]} aUpdates
   *        The list of update details for the add-on
   */
  async onUpdateCheckComplete(aUpdates) {
__L_V__7({
    lN: 2889,tT:'func',pr:'',eT:{'aUpdates':aUpdates},fN:'onUpdateCheckComplete'
  });'__L_V__7';
    XPIInstall.done(this.addon._updateCheck);
    this.addon._updateCheck = null;
    let AUC = AddonUpdateChecker;
    let ignoreMaxVersion = false;
    // Ignore strict compatibility for dictionaries by default.
    let ignoreStrictCompat = this.addon.type == "dictionary";
    if (!AddonManager.checkCompatibility) {
__L_V__7({
    lN: 2896,tT:'if',pr:'!AddonManager.checkCompatibility',eT:{},fN:''
  });'__L_V__7';
      ignoreMaxVersion = true;
      ignoreStrictCompat = true;
    } else if (
      !AddonManager.strictCompatibility &&
      !this.addon.strictCompatibility
    ) {
__L_V__7({
    lN: 2902,tT:'if',pr:' !AddonManager.strictCompatibility && !this.addon.strictCompatibility ',eT:{},fN:''
  });'__L_V__7';
      ignoreMaxVersion = true;
    }

    // Always apply any compatibility update for the current version
    let compatUpdate = AUC.getCompatibilityUpdate(
      aUpdates,
      this.addon.version,
      this.syncCompatibility,
      null,
      null,
      ignoreMaxVersion,
      ignoreStrictCompat
    );
    // Apply the compatibility update to the database
    if (compatUpdate) {
__L_V__7({
    lN: 2917,tT:'if',pr:'compatUpdate',eT:{},fN:''
  });'__L_V__7';
      this.addon.applyCompatibilityUpdate(compatUpdate, this.syncCompatibility);
    }

    // If the request is for an application or platform version that is
    // different to the current application or platform version then look for a
    // compatibility update for those versions.
    if (
      (this.appVersion &&
        Services.vc.compare(this.appVersion, Services.appinfo.version) != 0) ||
      (this.platformVersion &&
        Services.vc.compare(
          this.platformVersion,
          Services.appinfo.platformVersion
        ) != 0)
    ) {
__L_V__7({
    lN: 2932,tT:'if',pr:' (this.appVersion && Services.vc.compare(this.appVersion, Services.appinfo.version) != 0) || (this.platformVersion && Services.vc.compare( this.platformVersion, Services.appinfo.platformVersion ) != 0) ',eT:{},fN:''
  });'__L_V__7';
      compatUpdate = AUC.getCompatibilityUpdate(
        aUpdates,
        this.addon.version,
        false,
        this.appVersion,
        this.platformVersion,
        ignoreMaxVersion,
        ignoreStrictCompat
      );
    }

    if (compatUpdate) {
__L_V__7({
    lN: 2944,tT:'if',pr:'compatUpdate',eT:{},fN:''
  });'__L_V__7';
      this.callListener("onCompatibilityUpdateAvailable", this.addon.wrapper);
    } else {
      this.callListener("onNoCompatibilityUpdateAvailable", this.addon.wrapper);
    }

    function sendUpdateAvailableMessages(aSelf, aInstall) {
__L_V__7({
    lN: 2950,tT:'func',pr:'',eT:{'aSelf':aSelf,'aInstall':aInstall},fN:'sendUpdateAvailableMessages'
  });'__L_V__7';
      if (aInstall) {
__L_V__7({
    lN: 2951,tT:'if',pr:'aInstall',eT:{},fN:''
  });'__L_V__7';
        aSelf.callListener(
          "onUpdateAvailable",
          aSelf.addon.wrapper,
          aInstall.wrapper
        );
      } else {
        aSelf.callListener("onNoUpdateAvailable", aSelf.addon.wrapper);
      }
      aSelf.callListener(
        "onUpdateFinished",
        aSelf.addon.wrapper,
        AddonManager.UPDATE_STATUS_NO_ERROR
      );
    }

    let update = await AUC.getNewestCompatibleUpdate(
      aUpdates,
      this.appVersion,
      this.platformVersion,
      ignoreMaxVersion,
      ignoreStrictCompat
    );

    if (
      update &&
      Services.vc.compare(this.addon.version, update.version) < 0 &&
      !this.addon.location.locked
    ) {
__L_V__7({
    lN: 2979,tT:'if',pr:' update && Services.vc.compare(this.addon.version, update.version) < 0 && !this.addon.location.locked ',eT:{},fN:''
  });'__L_V__7';
      for (let currentInstall of XPIInstall.installs) {
        // Skip installs that don't match the available update
        if (
          currentInstall.existingAddon != this.addon ||
          currentInstall.version != update.version
        ) {
__L_V__7({
    lN: 2985,tT:'if',pr:' currentInstall.existingAddon != this.addon || currentInstall.version != update.version ',eT:{},fN:''
  });'__L_V__7';
          continue;
        }

        // If the existing install has not yet started downloading then send an
        // available update notification. If it is already downloading then
        // don't send any available update notification
        if (currentInstall.state == AddonManager.STATE_AVAILABLE) {
__L_V__7({
    lN: 2992,tT:'if',pr:'currentInstall.state == AddonManager.STATE_AVAILABLE',eT:{},fN:''
  });'__L_V__7';
          logger.debug("Found an existing AddonInstall for " + this.addon.id);
          sendUpdateAvailableMessages(this, currentInstall);
        } else {
          sendUpdateAvailableMessages(this, null);
        }
        return;
      }

      createUpdate(
        aInstall => {
          sendUpdateAvailableMessages(this, aInstall);
        },
        this.addon,
        update,
        this.isUserRequested
      );
    } else {
      sendUpdateAvailableMessages(this, null);
    }
  },

  /**
   * Called when AddonUpdateChecker fails the update check
   *
   * @param {any} aError
   *        An error status
   */
  onUpdateCheckError(aError) {
__L_V__7({
    lN: 3020,tT:'func',pr:'',eT:{'aError':aError},fN:'onUpdateCheckError'
  });'__L_V__7';
    XPIInstall.done(this.addon._updateCheck);
    this.addon._updateCheck = null;
    this.callListener("onNoCompatibilityUpdateAvailable", this.addon.wrapper);
    this.callListener("onNoUpdateAvailable", this.addon.wrapper);
    this.callListener("onUpdateFinished", this.addon.wrapper, aError);
  },

  /**
   * Called to cancel an in-progress update check
   */
  cancel() {
__L_V__7({
    lN: 3031,tT:'func',pr:'',eT:{},fN:'cancel'
  });'__L_V__7';
    let parser = this._parser;
    if (parser) {
__L_V__7({
    lN: 3033,tT:'if',pr:'parser',eT:{},fN:''
  });'__L_V__7';
      this._parser = null;
      // This will call back to onUpdateCheckError with a CANCELLED error
      parser.cancel();
    }
  },
};

/**
 * Creates a new AddonInstall to install an add-on from a local file.
 *
 * @param {nsIFile} file
 *        The file to install
 * @param {XPIStateLocation} location
 *        The location to install to
 * @param {Object?} [telemetryInfo]
 *        An optional object which provides details about the installation source
 *        included in the addon manager telemetry events.
 * @returns {Promise<AddonInstall>}
 *        A Promise that resolves with the new install object.
 */
function createLocalInstall(file, location, telemetryInfo) {
__L_V__7({
    lN: 3054,tT:'func',pr:'',eT:{'file':file,'location':location,'telemetryInfo':telemetryInfo},fN:'createLocalInstall'
  });'__L_V__7';
  if (!location) {
__L_V__7({
    lN: 3055,tT:'if',pr:'!location',eT:{},fN:''
  });'__L_V__7';
    location = XPIStates.getLocation(KEY_APP_PROFILE);
  }
  let url = Services.io.newFileURI(file);

  try {
    let install = new LocalAddonInstall(location, url, { telemetryInfo });
    return install.init().then(() => install);
  } catch (e) {
    logger.error("Error creating install", e);
    return Promise.resolve(null);
  }
}

class DirectoryInstaller {
  constructor(location) {
__L_V__7({
    lN: 3070,tT:'func',pr:'',eT:{'location':location},fN:'constructor'
  });'__L_V__7';
    this.location = location;

    this._stagingDirLock = 0;
    this._stagingDirPromise = null;
  }

  get name() {
__L_V__7({
    lN: 3077,tT:'func',pr:'',eT:{},fN:'name'
  });'__L_V__7';
    return this.location.name;
  }

  get dir() {
__L_V__7({
    lN: 3081,tT:'func',pr:'',eT:{},fN:'dir'
  });'__L_V__7';
    return this.location.dir;
  }
  set dir(val) {
__L_V__7({
    lN: 3084,tT:'func',pr:'',eT:{'val':val},fN:'dir'
  });'__L_V__7';
    this.location.dir = val;
    this.location.path = val.path;
  }

  /**
   * Gets the staging directory to put add-ons that are pending install and
   * uninstall into.
   *
   * @returns {nsIFile}
   */
  getStagingDir() {
__L_V__7({
    lN: 3095,tT:'func',pr:'',eT:{},fN:'getStagingDir'
  });'__L_V__7';
    return getFile(DIR_STAGE, this.dir);
  }

  requestStagingDir() {
__L_V__7({
    lN: 3099,tT:'func',pr:'',eT:{},fN:'requestStagingDir'
  });'__L_V__7';
    this._stagingDirLock++;

    if (this._stagingDirPromise) {
__L_V__7({
    lN: 3102,tT:'if',pr:'this._stagingDirPromise',eT:{},fN:''
  });'__L_V__7';
      return this._stagingDirPromise;
    }

    OS.File.makeDir(this.dir.path);
    let stagepath = OS.Path.join(this.dir.path, DIR_STAGE);
    return (this._stagingDirPromise = OS.File.makeDir(stagepath).catch(e => {
      if (e instanceof OS.File.Error && e.becauseExists) {
__L_V__7({
    lN: 3109,tT:'if',pr:'e instanceof OS.File.Error && e.becauseExists',eT:{},fN:''
  });'__L_V__7';
        return;
      }
      logger.error("Failed to create staging directory", e);
      throw e;
    }));
  }

  releaseStagingDir() {
__L_V__7({
    lN: 3117,tT:'func',pr:'',eT:{},fN:'releaseStagingDir'
  });'__L_V__7';
    this._stagingDirLock--;

    if (this._stagingDirLock == 0) {
__L_V__7({
    lN: 3120,tT:'if',pr:'this._stagingDirLock == 0',eT:{},fN:''
  });'__L_V__7';
      this._stagingDirPromise = null;
      this.cleanStagingDir();
    }

    return Promise.resolve();
  }

  /**
   * Removes the specified files or directories in the staging directory and
   * then if the staging directory is empty attempts to remove it.
   *
   * @param {string[]} [aLeafNames = []]
   *        An array of file or directory to remove from the directory, the
   *        array may be empty
   */
  cleanStagingDir(aLeafNames = []) {
__L_V__7({
    lN: 3136,tT:'func',pr:'',eT:{'aLeafNames':aLeafNames},fN:'cleanStagingDir'
  });'__L_V__7';
    let dir = this.getStagingDir();

    for (let name of aLeafNames) {
      let file = getFile(name, dir);
      recursiveRemove(file);
    }

    if (this._stagingDirLock > 0) {
__L_V__7({
    lN: 3144,tT:'if',pr:'this._stagingDirLock > 0',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    // eslint-disable-next-line no-unused-vars
    for (let file of iterDirectory(dir)) {
      return;
    }

    try {
      setFilePermissions(dir, FileUtils.PERMS_DIRECTORY);
      dir.remove(false);
    } catch (e) {
      logger.warn("Failed to remove staging dir", e);
      // Failing to remove the staging directory is ignorable
    }
  }

  /**
   * Returns a directory that is normally on the same filesystem as the rest of
   * the install location and can be used for temporarily storing files during
   * safe move operations. Calling this method will delete the existing trash
   * directory and its contents.
   *
   * @returns {nsIFile}
   */
  getTrashDir() {
__L_V__7({
    lN: 3170,tT:'func',pr:'',eT:{},fN:'getTrashDir'
  });'__L_V__7';
    let trashDir = getFile(DIR_TRASH, this.dir);
    let trashDirExists = trashDir.exists();
    try {
      if (trashDirExists) {
__L_V__7({
    lN: 3174,tT:'if',pr:'trashDirExists',eT:{},fN:''
  });'__L_V__7';
        recursiveRemove(trashDir);
      }
      trashDirExists = false;
    } catch (e) {
      logger.warn("Failed to remove trash directory", e);
    }
    if (!trashDirExists) {
__L_V__7({
    lN: 3181,tT:'if',pr:'!trashDirExists',eT:{},fN:''
  });'__L_V__7';
      trashDir.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
    }

    return trashDir;
  }

  /**
   * Installs an add-on into the install location.
   *
   * @param {Object} options
   *        Installation options.
   * @param {string} options.id
   *        The ID of the add-on to install
   * @param {nsIFile} options.source
   *        The source nsIFile to install from
   * @param {string?} [options.existingAddonID]
   *        The ID of an existing add-on to uninstall at the same time
   * @param {string} options.action
   *        What to we do with the given source file:
   *          "move"
   *          Default action, the source files will be moved to the new
   *          location,
   *          "copy"
   *          The source files will be copied,
   *          "proxy"
   *          A "proxy file" is going to refer to the source file path
   * @returns {nsIFile}
   *        An nsIFile indicating where the add-on was installed to
   */
  installAddon({ id, source, existingAddonID, action = "move" }) {
__L_V__7({
    lN: 3211,tT:'func',pr:'',eT:{'id':id,'source':source,'existingAddonID':existingAddonID,'action':action},fN:'installAddon'
  });'__L_V__7';
    let trashDir = this.getTrashDir();

    let transaction = new SafeInstallOperation();

    let moveOldAddon = aId => {
      let file = getFile(aId, this.dir);
      if (file.exists()) {
__L_V__7({
    lN: 3218,tT:'if',pr:'file.exists()',eT:{},fN:''
  });'__L_V__7';
        transaction.moveUnder(file, trashDir);
      }

      file = getFile(`${aId}.xpi`, this.dir);
      if (file.exists()) {
__L_V__7({
    lN: 3223,tT:'if',pr:'file.exists()',eT:{},fN:''
  });'__L_V__7';
        flushJarCache(file);
        transaction.moveUnder(file, trashDir);
      }
    };

    // If any of these operations fails the finally block will clean up the
    // temporary directory
    try {
      moveOldAddon(id);
      if (existingAddonID && existingAddonID != id) {
__L_V__7({
    lN: 3233,tT:'if',pr:'existingAddonID && existingAddonID != id',eT:{},fN:''
  });'__L_V__7';
        moveOldAddon(existingAddonID);

        {
          // Move the data directories.
          /* XXX ajvincent We can't use OS.File:  installAddon isn't compatible
           * with Promises, nor is SafeInstallOperation.  Bug 945540 has been filed
           * for porting to OS.File.
           */
          let oldDataDir = FileUtils.getDir(
            KEY_PROFILEDIR,
            ["extension-data", existingAddonID],
            false,
            true
          );

          if (oldDataDir.exists()) {
__L_V__7({
    lN: 3249,tT:'if',pr:'oldDataDir.exists()',eT:{},fN:''
  });'__L_V__7';
            let newDataDir = FileUtils.getDir(
              KEY_PROFILEDIR,
              ["extension-data", id],
              false,
              true
            );
            if (newDataDir.exists()) {
__L_V__7({
    lN: 3256,tT:'if',pr:'newDataDir.exists()',eT:{},fN:''
  });'__L_V__7';
              let trashData = getFile("data-directory", trashDir);
              transaction.moveUnder(newDataDir, trashData);
            }

            transaction.moveTo(oldDataDir, newDataDir);
          }
        }
      }

      if (action == "copy") {
__L_V__7({
    lN: 3266,tT:'if',pr:'action == copy',eT:{},fN:''
  });'__L_V__7';
        transaction.copy(source, this.dir);
      } else if (action == "move") {
__L_V__7({
    lN: 3268,tT:'if',pr:'action == move',eT:{},fN:''
  });'__L_V__7';
        flushJarCache(source);
        transaction.moveUnder(source, this.dir);
      }
      // Do nothing for the proxy file as we sideload an addon permanently
    } finally {
      // It isn't ideal if this cleanup fails but it isn't worth rolling back
      // the install because of it.
      try {
        recursiveRemove(trashDir);
      } catch (e) {
        logger.warn(
          `Failed to remove trash directory when installing ${id}`,
          e
        );
      }
    }

    let newFile = this.dir.clone();

    if (action == "proxy") {
__L_V__7({
    lN: 3288,tT:'if',pr:'action == proxy',eT:{},fN:''
  });'__L_V__7';
      // When permanently installing sideloaded addon, we just put a proxy file
      // referring to the addon sources
      newFile.append(id);

      writeStringToFile(newFile, source.path);
    } else {
      newFile.append(source.leafName);
    }

    try {
      newFile.lastModifiedTime = Date.now();
    } catch (e) {
      logger.warn(`failed to set lastModifiedTime on ${newFile.path}`, e);
    }

    return newFile;
  }

  /**
   * Uninstalls an add-on from this location.
   *
   * @param {string} aId
   *        The ID of the add-on to uninstall
   * @throws if the ID does not match any of the add-ons installed
   */
  uninstallAddon(aId) {
__L_V__7({
    lN: 3314,tT:'func',pr:'',eT:{'aId':aId},fN:'uninstallAddon'
  });'__L_V__7';
    let file = getFile(aId, this.dir);
    if (!file.exists()) {
__L_V__7({
    lN: 3316,tT:'if',pr:'!file.exists()',eT:{},fN:''
  });'__L_V__7';
      file.leafName += ".xpi";
    }

    if (!file.exists()) {
__L_V__7({
    lN: 3320,tT:'if',pr:'!file.exists()',eT:{},fN:''
  });'__L_V__7';
      logger.warn(
        `Attempted to remove ${aId} from ${this.name} but it was already gone`
      );
      this.location.delete(aId);
      return;
    }

    if (file.leafName != aId) {
__L_V__7({
    lN: 3328,tT:'if',pr:'file.leafName != aId',eT:{},fN:''
  });'__L_V__7';
      logger.debug(
        `uninstallAddon: flushing jar cache ${file.path} for addon ${aId}`
      );
      flushJarCache(file);
    }

    // In case this is a foreignInstall we do not want to remove the file if
    // the location is locked.
    if (!this.location.locked) {
__L_V__7({
    lN: 3337,tT:'if',pr:'!this.location.locked',eT:{},fN:''
  });'__L_V__7';
      let trashDir = this.getTrashDir();
      let transaction = new SafeInstallOperation();

      try {
        transaction.moveUnder(file, trashDir);
      } finally {
        // It isn't ideal if this cleanup fails, but it is probably better than
        // rolling back the uninstall at this point
        try {
          recursiveRemove(trashDir);
        } catch (e) {
          logger.warn(
            `Failed to remove trash directory when uninstalling ${aId}`,
            e
          );
        }
      }
    }

    this.location.removeAddon(aId);
  }
}

class SystemAddonInstaller extends DirectoryInstaller {
  constructor(location) {
__L_V__7({
    lN: 3362,tT:'func',pr:'',eT:{'location':location},fN:'constructor'
  });'__L_V__7';
    super(location);

    this._baseDir = location._baseDir;
    this._nextDir = null;
  }

  get _addonSet() {
__L_V__7({
    lN: 3369,tT:'func',pr:'',eT:{},fN:'_addonSet'
  });'__L_V__7';
    return this.location._addonSet;
  }
  set _addonSet(val) {
__L_V__7({
    lN: 3372,tT:'func',pr:'',eT:{'val':val},fN:'_addonSet'
  });'__L_V__7';
    this.location._addonSet = val;
  }

  /**
   * Saves the current set of system add-ons
   *
   * @param {Object} aAddonSet - object containing schema, directory and set
   *                 of system add-on IDs and versions.
   */
  static _saveAddonSet(aAddonSet) {
__L_V__7({
    lN: 3382,tT:'func',pr:'',eT:{'aAddonSet':aAddonSet},fN:'_saveAddonSet'
  });'__L_V__7';
    Services.prefs.setStringPref(
      PREF_SYSTEM_ADDON_SET,
      JSON.stringify(aAddonSet)
    );
  }

  static _loadAddonSet() {
__L_V__7({
    lN: 3389,tT:'func',pr:'',eT:{},fN:'_loadAddonSet'
  });'__L_V__7';
    return XPIInternal.SystemAddonLocation._loadAddonSet();
  }

  /**
   * Gets the staging directory to put add-ons that are pending install and
   * uninstall into.
   *
   * @returns {nsIFile}
   *        Staging directory for system add-on upgrades.
   */
  getStagingDir() {
__L_V__7({
    lN: 3400,tT:'func',pr:'',eT:{},fN:'getStagingDir'
  });'__L_V__7';
    this._addonSet = SystemAddonInstaller._loadAddonSet();
    let dir = null;
    if (this._addonSet.directory) {
__L_V__7({
    lN: 3403,tT:'if',pr:'this._addonSet.directory',eT:{},fN:''
  });'__L_V__7';
      this.dir = getFile(this._addonSet.directory, this._baseDir);
      dir = getFile(DIR_STAGE, this.dir);
    } else {
      logger.info("SystemAddonInstaller directory is missing");
    }

    return dir;
  }

  requestStagingDir() {
__L_V__7({
    lN: 3413,tT:'func',pr:'',eT:{},fN:'requestStagingDir'
  });'__L_V__7';
    this._addonSet = SystemAddonInstaller._loadAddonSet();
    if (this._addonSet.directory) {
__L_V__7({
    lN: 3415,tT:'if',pr:'this._addonSet.directory',eT:{},fN:''
  });'__L_V__7';
      this.dir = getFile(this._addonSet.directory, this._baseDir);
    }
    return super.requestStagingDir();
  }

  isValidAddon(aAddon) {
__L_V__7({
    lN: 3421,tT:'func',pr:'',eT:{'aAddon':aAddon},fN:'isValidAddon'
  });'__L_V__7';
    if (aAddon.appDisabled) {
__L_V__7({
    lN: 3422,tT:'if',pr:'aAddon.appDisabled',eT:{},fN:''
  });'__L_V__7';
      logger.warn(
        `System add-on ${aAddon.id} isn't compatible with the application.`
      );
      return false;
    }

    return true;
  }

  /**
   * Tests whether the loaded add-on information matches what is expected.
   *
   * @param {Map<string, AddonInternal>} aAddons
   *        The set of add-ons to check.
   * @returns {boolean}
   *        True if all of the given add-ons are valid.
   */
  isValid(aAddons) {
__L_V__7({
    lN: 3440,tT:'func',pr:'',eT:{'aAddons':aAddons},fN:'isValid'
  });'__L_V__7';
    for (let id of Object.keys(this._addonSet.addons)) {
      if (!aAddons.has(id)) {
__L_V__7({
    lN: 3442,tT:'if',pr:'!aAddons.has(id)',eT:{},fN:''
  });'__L_V__7';
        logger.warn(
          `Expected add-on ${id} is missing from the system add-on location.`
        );
        return false;
      }

      let addon = aAddons.get(id);
      if (addon.version != this._addonSet.addons[id].version) {
__L_V__7({
    lN: 3450,tT:'if',pr:'addon.version != this._addonSet.addons[id].version',eT:{},fN:''
  });'__L_V__7';
        logger.warn(
          `Expected system add-on ${id} to be version ${this._addonSet.addons[id].version} but was ${addon.version}.`
        );
        return false;
      }

      if (!this.isValidAddon(addon)) {
__L_V__7({
    lN: 3457,tT:'if',pr:'!this.isValidAddon(addon)',eT:{},fN:''
  });'__L_V__7';
        return false;
      }
    }

    return true;
  }

  /**
   * Resets the add-on set so on the next startup the default set will be used.
   */
  async resetAddonSet() {
__L_V__7({
    lN: 3468,tT:'func',pr:'',eT:{},fN:'resetAddonSet'
  });'__L_V__7';
    logger.info("Removing all system add-on upgrades.");

    // remove everything from the pref first, if uninstall
    // fails then at least they will not be re-activated on
    // next restart.
    this._addonSet = { schema: 1, addons: {} };
    SystemAddonInstaller._saveAddonSet(this._addonSet);

    // If this is running at app startup, the pref being cleared
    // will cause later stages of startup to notice that the
    // old updates are now gone.
    //
    // Updates will only be explicitly uninstalled if they are
    // removed restartlessly, for instance if they are no longer
    // part of the latest update set.
    if (this._addonSet) {
__L_V__7({
    lN: 3484,tT:'if',pr:'this._addonSet',eT:{},fN:''
  });'__L_V__7';
      let ids = Object.keys(this._addonSet.addons);
      for (let addon of await AddonManager.getAddonsByIDs(ids)) {
        if (addon) {
__L_V__7({
    lN: 3487,tT:'if',pr:'addon',eT:{},fN:''
  });'__L_V__7';
          addon.uninstall();
        }
      }
    }
  }

  /**
   * Removes any directories not currently in use or pending use after a
   * restart. Any errors that happen here don't really matter as we'll attempt
   * to cleanup again next time.
   */
  async cleanDirectories() {
__L_V__7({
    lN: 3499,tT:'func',pr:'',eT:{},fN:'cleanDirectories'
  });'__L_V__7';
    // System add-ons directory does not exist
    if (!(await OS.File.exists(this._baseDir.path))) {
__L_V__7({
    lN: 3501,tT:'if',pr:'!(await OS.File.exists(this._baseDir.path))',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    let iterator;
    try {
      iterator = new OS.File.DirectoryIterator(this._baseDir.path);
    } catch (e) {
      logger.error("Failed to clean updated system add-ons directories.", e);
      return;
    }

    try {
      for (;;) {
        let { value: entry, done } = await iterator.next();
        if (done) {
__L_V__7({
    lN: 3516,tT:'if',pr:'done',eT:{},fN:''
  });'__L_V__7';
          break;
        }

        // Skip the directory currently in use
        if (this.dir && this.dir.path == entry.path) {
__L_V__7({
    lN: 3521,tT:'if',pr:'this.dir && this.dir.path == entry.path',eT:{},fN:''
  });'__L_V__7';
          continue;
        }

        // Skip the next directory
        if (this._nextDir && this._nextDir.path == entry.path) {
__L_V__7({
    lN: 3526,tT:'if',pr:'this._nextDir && this._nextDir.path == entry.path',eT:{},fN:''
  });'__L_V__7';
          continue;
        }

        if (entry.isDir) {
__L_V__7({
    lN: 3530,tT:'if',pr:'entry.isDir',eT:{},fN:''
  });'__L_V__7';
          await OS.File.removeDir(entry.path, {
            ignoreAbsent: true,
            ignorePermissions: true,
          });
        } else {
          await OS.File.remove(entry.path, {
            ignoreAbsent: true,
          });
        }
      }
    } catch (e) {
      logger.error("Failed to clean updated system add-ons directories.", e);
    } finally {
      iterator.close();
    }
  }

  /**
   * Installs a new set of system add-ons into the location and updates the
   * add-on set in prefs.
   *
   * @param {Array} aAddons - An array of addons to install.
   */
  async installAddonSet(aAddons) {
__L_V__7({
    lN: 3554,tT:'func',pr:'',eT:{'aAddons':aAddons},fN:'installAddonSet'
  });'__L_V__7';
    // Make sure the base dir exists
    await OS.File.makeDir(this._baseDir.path, { ignoreExisting: true });

    let addonSet = SystemAddonInstaller._loadAddonSet();

    // Remove any add-ons that are no longer part of the set.
    const ids = aAddons.map(a => a.id);
    for (let addonID of Object.keys(addonSet.addons)) {
      if (!ids.includes(addonID)) {
__L_V__7({
    lN: 3563,tT:'if',pr:'!ids.includes(addonID)',eT:{},fN:''
  });'__L_V__7';
        AddonManager.getAddonByID(addonID).then(a => a.uninstall());
      }
    }

    let newDir = this._baseDir.clone();
    newDir.append("blank");

    while (true) {
      newDir.leafName = uuidGen.generateUUID().toString();
      try {
        await OS.File.makeDir(newDir.path, { ignoreExisting: false });
        break;
      } catch (e) {
        logger.debug(
          "Could not create new system add-on updates dir, retrying",
          e
        );
      }
    }

    // Record the new upgrade directory.
    let state = { schema: 1, directory: newDir.leafName, addons: {} };
    SystemAddonInstaller._saveAddonSet(state);

    this._nextDir = newDir;

    let installs = [];
    for (let addon of aAddons) {
      let install = await createLocalInstall(
        addon._sourceBundle,
        this.location
      );
      installs.push(install);
    }

    async function installAddon(install) {
__L_V__7({
    lN: 3599,tT:'func',pr:'',eT:{'install':install},fN:'installAddon'
  });'__L_V__7';
      // Make the new install own its temporary file.
      install.ownsTempFile = true;
      install.install();
    }

    async function postponeAddon(install) {
__L_V__7({
    lN: 3605,tT:'func',pr:'',eT:{'install':install},fN:'postponeAddon'
  });'__L_V__7';
      let resumeFn;
      if (AddonManagerPrivate.hasUpgradeListener(install.addon.id)) {
__L_V__7({
    lN: 3607,tT:'if',pr:'AddonManagerPrivate.hasUpgradeListener(install.addon.id)',eT:{},fN:''
  });'__L_V__7';
        logger.info(
          `system add-on ${install.addon.id} has an upgrade listener, postponing upgrade set until restart`
        );
        resumeFn = () => {
          logger.info(
            `${install.addon.id} has resumed a previously postponed addon set`
          );
          install.location.installer.resumeAddonSet(installs);
        };
      }
      await install.postpone(resumeFn);
    }

    let previousState;

    try {
      // All add-ons in position, create the new state and store it in prefs
      state = { schema: 1, directory: newDir.leafName, addons: {} };
      for (let addon of aAddons) {
        state.addons[addon.id] = {
          version: addon.version,
        };
      }

      previousState = SystemAddonInstaller._loadAddonSet();
      SystemAddonInstaller._saveAddonSet(state);

      let blockers = aAddons.filter(addon =>
        AddonManagerPrivate.hasUpgradeListener(addon.id)
      );

      if (blockers.length) {
__L_V__7({
    lN: 3639,tT:'if',pr:'blockers.length',eT:{},fN:''
  });'__L_V__7';
        await waitForAllPromises(installs.map(postponeAddon));
      } else {
        await waitForAllPromises(installs.map(installAddon));
      }
    } catch (e) {
      // Roll back to previous upgrade set (if present) on restart.
      if (previousState) {
__L_V__7({
    lN: 3646,tT:'if',pr:'previousState',eT:{},fN:''
  });'__L_V__7';
        SystemAddonInstaller._saveAddonSet(previousState);
      }
      // Otherwise, roll back to built-in set on restart.
      // TODO try to do these restartlessly
      this.resetAddonSet();

      try {
        await OS.File.removeDir(newDir.path, { ignorePermissions: true });
      } catch (e) {
        logger.warn(
          `Failed to remove failed system add-on directory ${newDir.path}.`,
          e
        );
      }
      throw e;
    }
  }

  /**
   * Resumes upgrade of a previously-delayed add-on set.
   *
   * @param {AddonInstall[]} installs
   *        The set of installs to resume.
   */
  async resumeAddonSet(installs) {
__L_V__7({
    lN: 3671,tT:'func',pr:'',eT:{'installs':installs},fN:'resumeAddonSet'
  });'__L_V__7';
    async function resumeAddon(install) {
__L_V__7({
    lN: 3672,tT:'func',pr:'',eT:{'install':install},fN:'resumeAddon'
  });'__L_V__7';
      install.state = AddonManager.STATE_DOWNLOADED;
      install.location.installer.releaseStagingDir();
      install.install();
    }

    let blockers = installs.filter(install =>
      AddonManagerPrivate.hasUpgradeListener(install.addon.id)
    );

    if (blockers.length > 1) {
__L_V__7({
    lN: 3682,tT:'if',pr:'blockers.length > 1',eT:{},fN:''
  });'__L_V__7';
      logger.warn(
        "Attempted to resume system add-on install but upgrade blockers are still present"
      );
    } else {
      await waitForAllPromises(installs.map(resumeAddon));
    }
  }

  /**
   * Returns a directory that is normally on the same filesystem as the rest of
   * the install location and can be used for temporarily storing files during
   * safe move operations. Calling this method will delete the existing trash
   * directory and its contents.
   *
   * @returns {nsIFile}
   */
  getTrashDir() {
__L_V__7({
    lN: 3699,tT:'func',pr:'',eT:{},fN:'getTrashDir'
  });'__L_V__7';
    let trashDir = getFile(DIR_TRASH, this.dir);
    let trashDirExists = trashDir.exists();
    try {
      if (trashDirExists) {
__L_V__7({
    lN: 3703,tT:'if',pr:'trashDirExists',eT:{},fN:''
  });'__L_V__7';
        recursiveRemove(trashDir);
      }
      trashDirExists = false;
    } catch (e) {
      logger.warn("Failed to remove trash directory", e);
    }
    if (!trashDirExists) {
__L_V__7({
    lN: 3710,tT:'if',pr:'!trashDirExists',eT:{},fN:''
  });'__L_V__7';
      trashDir.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
    }

    return trashDir;
  }

  /**
   * Installs an add-on into the install location.
   *
   * @param {string} id
   *        The ID of the add-on to install
   * @param {nsIFile} source
   *        The source nsIFile to install from
   * @returns {nsIFile}
   *        An nsIFile indicating where the add-on was installed to
   */
  installAddon({ id, source }) {
__L_V__7({
    lN: 3727,tT:'func',pr:'',eT:{'id':id,'source':source},fN:'installAddon'
  });'__L_V__7';
    let trashDir = this.getTrashDir();
    let transaction = new SafeInstallOperation();

    // If any of these operations fails the finally block will clean up the
    // temporary directory
    try {
      flushJarCache(source);

      transaction.moveUnder(source, this.dir);
    } finally {
      // It isn't ideal if this cleanup fails but it isn't worth rolling back
      // the install because of it.
      try {
        recursiveRemove(trashDir);
      } catch (e) {
        logger.warn(
          `Failed to remove trash directory when installing ${id}`,
          e
        );
      }
    }

    let newFile = getFile(source.leafName, this.dir);

    try {
      newFile.lastModifiedTime = Date.now();
    } catch (e) {
      logger.warn("failed to set lastModifiedTime on " + newFile.path, e);
    }

    return newFile;
  }

  // old system add-on upgrade dirs get automatically removed
  uninstallAddon(aAddon) {
__L_V__7({
    lN: 3762,tT:'func',pr:'',eT:{'aAddon':aAddon},fN:'uninstallAddon'
  });'__L_V__7';}
}

var XPIInstall = {
  // An array of currently active AddonInstalls
  installs: new Set(),

  createLocalInstall,
  flushJarCache,
  newVersionReason,
  recursiveRemove,
  syncLoadManifest,
  loadManifestFromFile,

  // Keep track of in-progress operations that support cancel()
  _inProgress: [],

  doing(aCancellable) {
__L_V__7({
    lN: 3779,tT:'func',pr:'',eT:{'aCancellable':aCancellable},fN:'doing'
  });'__L_V__7';
    this._inProgress.push(aCancellable);
  },

  done(aCancellable) {
__L_V__7({
    lN: 3783,tT:'func',pr:'',eT:{'aCancellable':aCancellable},fN:'done'
  });'__L_V__7';
    let i = this._inProgress.indexOf(aCancellable);
    if (i != -1) {
__L_V__7({
    lN: 3785,tT:'if',pr:'i != -1',eT:{},fN:''
  });'__L_V__7';
      this._inProgress.splice(i, 1);
      return true;
    }
    return false;
  },

  cancelAll() {
__L_V__7({
    lN: 3792,tT:'func',pr:'',eT:{},fN:'cancelAll'
  });'__L_V__7';
    // Cancelling one may alter _inProgress, so don't use a simple iterator
    while (this._inProgress.length) {
      let c = this._inProgress.shift();
      try {
        c.cancel();
      } catch (e) {
        logger.warn("Cancel failed", e);
      }
    }
  },

  /**
   * @param {string} id
   *        The expected ID of the add-on.
   * @param {nsIFile} file
   *        The XPI file to install the add-on from.
   * @param {XPIStateLocation} location
   *        The install location to install the add-on to.
   * @param {string?} [oldAppVersion]
   *        The version of the application last run with this profile or null
   *        if it is a new profile or the version is unknown
   * @returns {AddonInternal}
   *        The installed Addon object, upon success.
   */
  async installDistributionAddon(id, file, location, oldAppVersion) {
__L_V__7({
    lN: 3817,tT:'func',pr:'',eT:{'id':id,'file':file,'location':location,'oldAppVersion':oldAppVersion},fN:'installDistributionAddon'
  });'__L_V__7';
    let addon = await loadManifestFromFile(file, location);
    addon.installTelemetryInfo = { source: "distribution" };

    if (addon.id != id) {
__L_V__7({
    lN: 3821,tT:'if',pr:'addon.id != id',eT:{},fN:''
  });'__L_V__7';
      throw new Error(
        `File file ${file.path} contains an add-on with an incorrect ID`
      );
    }

    let state = location.get(id);

    if (state) {
__L_V__7({
    lN: 3829,tT:'if',pr:'state',eT:{},fN:''
  });'__L_V__7';
      try {
        let existingAddon = await loadManifestFromFile(state.file, location);

        if (Services.vc.compare(addon.version, existingAddon.version) <= 0) {
__L_V__7({
    lN: 3833,tT:'if',pr:'Services.vc.compare(addon.version, existingAddon.version) <= 0',eT:{},fN:''
  });'__L_V__7';
          return null;
        }
      } catch (e) {
        // Bad add-on in the profile so just proceed and install over the top
        logger.warn(
          "Profile contains an add-on with a bad or missing install " +
            `manifest at ${state.path}, overwriting`,
          e
        );
      }
    } else if (
      addon.type === "locale" &&
      oldAppVersion &&
      Services.vc.compare(oldAppVersion, "67") < 0
    ) {
__L_V__7({
    lN: 3848,tT:'if',pr:' addon.type === locale && oldAppVersion && Services.vc.compare(oldAppVersion, 67) < 0 ',eT:{},fN:''
  });'__L_V__7';
      /* Distribution language packs didn't get installed due to the signing
           issues so we need to force them to be reinstalled. */
      Services.prefs.clearUserPref(PREF_BRANCH_INSTALLED_ADDON + id);
    } else if (
      Services.prefs.getBoolPref(PREF_BRANCH_INSTALLED_ADDON + id, false)
    ) {
__L_V__7({
    lN: 3854,tT:'if',pr:' Services.prefs.getBoolPref(PREF_BRANCH_INSTALLED_ADDON + id, false) ',eT:{},fN:''
  });'__L_V__7';
      return null;
    }

    // Install the add-on
    addon.sourceBundle = location.installer.installAddon({
      id,
      source: file,
      action: "copy",
    });

    XPIStates.addAddon(addon);
    logger.debug(`Installed distribution add-on ${id}`);

    Services.prefs.setBoolPref(PREF_BRANCH_INSTALLED_ADDON + id, true);

    return addon;
  },

  /**
   * Completes the install of an add-on which was staged during the last
   * session.
   *
   * @param {string} id
   *        The expected ID of the add-on.
   * @param {object} metadata
   *        The parsed metadata for the staged install.
   * @param {XPIStateLocation} location
   *        The install location to install the add-on to.
   * @returns {AddonInternal}
   *        The installed Addon object, upon success.
   */
  async installStagedAddon(id, metadata, location) {
__L_V__7({
    lN: 3886,tT:'func',pr:'',eT:{'id':id,'metadata':metadata,'location':location},fN:'installStagedAddon'
  });'__L_V__7';
    let source = getFile(`${id}.xpi`, location.installer.getStagingDir());

    // Check that the directory's name is a valid ID.
    if (!gIDTest.test(id) || !source.exists() || !source.isFile()) {
__L_V__7({
    lN: 3890,tT:'if',pr:'!gIDTest.test(id) || !source.exists() || !source.isFile()',eT:{},fN:''
  });'__L_V__7';
      throw new Error(`Ignoring invalid staging directory entry: ${id}`);
    }

    let addon = await loadManifestFromFile(source, location);

    if (
      XPIDatabase.mustSign(addon.type) &&
      addon.signedState <= AddonManager.SIGNEDSTATE_MISSING
    ) {
__L_V__7({
    lN: 3899,tT:'if',pr:' XPIDatabase.mustSign(addon.type) && addon.signedState <= AddonManager.SIGNEDSTATE_MISSING ',eT:{},fN:''
  });'__L_V__7';
      throw new Error(
        `Refusing to install staged add-on ${id} with signed state ${addon.signedState}`
      );
    }

    addon.importMetadata(metadata);

    logger.debug(`Processing install of ${id} in ${location.name}`);
    let existingAddon = XPIStates.findAddon(id);
    if (existingAddon) {
__L_V__7({
    lN: 3909,tT:'if',pr:'existingAddon',eT:{},fN:''
  });'__L_V__7';
      try {
        var file = existingAddon.file;
        if (file.exists()) {
__L_V__7({
    lN: 3912,tT:'if',pr:'file.exists()',eT:{},fN:''
  });'__L_V__7';
          let newVersion = existingAddon.version;
          let reason = newVersionReason(existingAddon.version, newVersion);

          XPIInternal.BootstrapScope.get(existingAddon).uninstall(reason, {
            newVersion,
          });
        }
      } catch (e) {
        Cu.reportError(e);
      }
    }

    try {
      addon.sourceBundle = location.installer.installAddon({
        id,
        source,
        existingAddonID: id,
      });
      XPIStates.addAddon(addon);
    } catch (e) {
      if (existingAddon) {
__L_V__7({
    lN: 3933,tT:'if',pr:'existingAddon',eT:{},fN:''
  });'__L_V__7';
        // Re-install the old add-on
        XPIInternal.get(existingAddon).install();
      }
      throw e;
    }

    return addon;
  },

  compareCliqzVersions(version1 = "", version2 = "") {
__L_V__7({
    lN: 3943,tT:'func',pr:'',eT:{'version1':version1,'version2':version2},fN:'compareCliqzVersions'
  });'__L_V__7';
    const newVersion = version1.split('.');
    const oldVersion = version2.split('.');

    for (let i=0; i < newVersion.length; i++) {
      const v1 = newVersion[i] * 1;
      const v2 = oldVersion[i] * 1;
      if (v1 == v2) {
__L_V__7({
    lN: 3950,tT:'if',pr:'v1 == v2',eT:{},fN:''
  });'__L_V__7';
        continue;
      } else {
        return v1 < v2 ? -1 : 1;
      }
    }

    return 0;
  },

  // CLIQZ-SPECIAL: disallow downgrade of any system addon
  checkDowngrade(wanted, existing) {
__L_V__7({
    lN: 3961,tT:'func',pr:'',eT:{'wanted':wanted,'existing':existing},fN:'checkDowngrade'
  });'__L_V__7';
    for (let [id, addon] of existing) {
      let wantedInfo = wanted.get(id);

      if (!wantedInfo || !wantedInfo.spec) {
__L_V__7({
    lN: 3965,tT:'if',pr:'!wantedInfo || !wantedInfo.spec',eT:{},fN:''
  });'__L_V__7';
        return false;
      }

      if (wantedInfo.spec.version == addon.version) continue;

      const newVersion = wantedInfo.spec.version;
      const oldVersion = addon.version;
      let shouldUpdate = this.compareCliqzVersions(newVersion, oldVersion) == 1;

      if (!shouldUpdate) {
__L_V__7({
    lN: 3975,tT:'if',pr:'!shouldUpdate',eT:{},fN:''
  });'__L_V__7';
        console.error('Rejecting add-on set: downgrade not allowed.')
        return true;
      }
    }
    return false;
  },

  async updateSystemAddons() {
__L_V__7({
    lN: 3983,tT:'func',pr:'',eT:{},fN:'updateSystemAddons'
  });'__L_V__7';
    const PREF_SYS_ADDON_UPDATE_ENABLED = "extensions.systemAddon.update.enabled";
    if (!Services.prefs.getBoolPref(PREF_SYS_ADDON_UPDATE_ENABLED, true)) {
__L_V__7({
    lN: 3985,tT:'if',pr:'!Services.prefs.getBoolPref(PREF_SYS_ADDON_UPDATE_ENABLED, true)',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    let systemAddonLocation = XPIStates.getLocation(KEY_APP_SYSTEM_ADDONS);
    if (!systemAddonLocation) {
__L_V__7({
    lN: 3990,tT:'if',pr:'!systemAddonLocation',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    let installer = systemAddonLocation.installer;

    // Don't do anything in safe mode
    if (Services.appinfo.inSafeMode) {
__L_V__7({
    lN: 3997,tT:'if',pr:'Services.appinfo.inSafeMode',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    // Download the list of system add-ons
    let url = Services.prefs.getStringPref(PREF_SYSTEM_ADDON_UPDATE_URL, null);
    if (!url) {
__L_V__7({
    lN: 4003,tT:'if',pr:'!url',eT:{},fN:''
  });'__L_V__7';
      await installer.cleanDirectories();
      return;
    }

    url = await UpdateUtils.formatUpdateURL(url);

    logger.info(`Starting system add-on update check from ${url}.`);
    let res = await ProductAddonChecker.getProductAddonList(url);

    // If there was no list then do nothing.
    if (!res || !res.gmpAddons) {
__L_V__7({
    lN: 4014,tT:'if',pr:'!res || !res.gmpAddons',eT:{},fN:''
  });'__L_V__7';
      logger.info("No system add-ons list was returned.");
      await installer.cleanDirectories();
      return;
    }

    let addonList = new Map(
      res.gmpAddons.map(spec => [spec.id, { spec, path: null, addon: null }])
    );

    let setMatches = (wanted, existing) => {
      if (wanted.size != existing.size) {
__L_V__7({
    lN: 4025,tT:'if',pr:'wanted.size != existing.size',eT:{},fN:''
  });'__L_V__7';
        return false;
      }

      for (let [id, addon] of existing) {
        let wantedInfo = wanted.get(id);

        if (!wantedInfo) {
__L_V__7({
    lN: 4032,tT:'if',pr:'!wantedInfo',eT:{},fN:''
  });'__L_V__7';
          return false;
        }
        if (wantedInfo.spec.version != addon.version) {
__L_V__7({
    lN: 4035,tT:'if',pr:'wantedInfo.spec.version != addon.version',eT:{},fN:''
  });'__L_V__7';
          return false;
        }
      }

      return true;
    };

    // If this matches the current set in the profile location then do nothing.
    let updatedAddons = addonMap(
      await XPIDatabase.getAddonsInLocation(KEY_APP_SYSTEM_ADDONS)
    );
    if (setMatches(addonList, updatedAddons)) {
__L_V__7({
    lN: 4047,tT:'if',pr:'setMatches(addonList, updatedAddons)',eT:{},fN:''
  });'__L_V__7';
      logger.info("Retaining existing updated system add-ons.");
      await installer.cleanDirectories();
      return;
    }

    // If this matches the current set in the default location then reset the
    // updated set.
    let defaultAddons = addonMap(
      await XPIDatabase.getAddonsInLocation(KEY_APP_SYSTEM_DEFAULTS)
    );
    if (setMatches(addonList, defaultAddons)) {
__L_V__7({
    lN: 4058,tT:'if',pr:'setMatches(addonList, defaultAddons)',eT:{},fN:''
  });'__L_V__7';
      logger.info("Resetting system add-ons.");
      installer.resetAddonSet();
      await installer.cleanDirectories();
      return;
    }

    if (this.checkDowngrade(addonList, defaultAddons)) {
__L_V__7({
    lN: 4065,tT:'if',pr:'this.checkDowngrade(addonList, defaultAddons)',eT:{},fN:''
  });'__L_V__7';
      logger.info("Rejecting downgraded system add-ons.");
      await installer.cleanDirectories();
      return;
    }

    // Download all the add-ons
    async function downloadAddon(item) {
__L_V__7({
    lN: 4072,tT:'func',pr:'',eT:{'item':item},fN:'downloadAddon'
  });'__L_V__7';
      try {
        let sourceAddon = updatedAddons.get(item.spec.id);
        if (sourceAddon && sourceAddon.version == item.spec.version) {
__L_V__7({
    lN: 4075,tT:'if',pr:'sourceAddon && sourceAddon.version == item.spec.version',eT:{},fN:''
  });'__L_V__7';
          // Copying the file to a temporary location has some benefits. If the
          // file is locked and cannot be read then we'll fall back to
          // downloading a fresh copy. It also means we don't have to remember
          // whether to delete the temporary copy later.
          try {
            let path = OS.Path.join(OS.Constants.Path.tmpDir, "tmpaddon");
            let unique = await OS.File.openUnique(path);
            unique.file.close();
            await OS.File.copy(sourceAddon._sourceBundle.path, unique.path);
            // Make sure to update file modification times so this is detected
            // as a new add-on.
            await OS.File.setDates(unique.path);
            item.path = unique.path;
          } catch (e) {
            logger.warn(
              `Failed make temporary copy of ${sourceAddon._sourceBundle.path}.`,
              e
            );
          }
        }
        if (!item.path) {
__L_V__7({
    lN: 4096,tT:'if',pr:'!item.path',eT:{},fN:''
  });'__L_V__7';
          item.path = await ProductAddonChecker.downloadAddon(item.spec);
        }
        item.addon = await loadManifestFromFile(
          nsIFile(item.path),
          systemAddonLocation
        );
      } catch (e) {
        logger.error(`Failed to download system add-on ${item.spec.id}`, e);
      }
    }
    await Promise.all(Array.from(addonList.values()).map(downloadAddon));

    // The download promises all resolve regardless, now check if they all
    // succeeded
    let validateAddon = item => {
      if (item.spec.id != item.addon.id) {
__L_V__7({
    lN: 4112,tT:'if',pr:'item.spec.id != item.addon.id',eT:{},fN:''
  });'__L_V__7';
        logger.warn(
          `Downloaded system add-on expected to be ${item.spec.id} but was ${item.addon.id}.`
        );
        return false;
      }

      if (item.spec.version != item.addon.version) {
__L_V__7({
    lN: 4119,tT:'if',pr:'item.spec.version != item.addon.version',eT:{},fN:''
  });'__L_V__7';
        logger.warn(
          `Expected system add-on ${item.spec.id} to be version ${item.spec.version} but was ${item.addon.version}.`
        );
        return false;
      }

      if (!installer.isValidAddon(item.addon)) {
__L_V__7({
    lN: 4126,tT:'if',pr:'!installer.isValidAddon(item.addon)',eT:{},fN:''
  });'__L_V__7';
        return false;
      }

      return true;
    };

    if (
      !Array.from(addonList.values()).every(
        item => item.path && item.addon && validateAddon(item)
      )
    ) {
__L_V__7({
    lN: 4137,tT:'if',pr:' !Array.from(addonList.values()).every( item => item.path && item.addon && validateAddon(item) ) ',eT:{},fN:''
  });'__L_V__7';
      throw new Error(
        "Rejecting updated system add-on set that either could not " +
          "be downloaded or contained unusable add-ons."
      );
    }

    // Install into the install location
    logger.info("Installing new system add-on set");
    await installer.installAddonSet(
      Array.from(addonList.values()).map(a => a.addon)
    );
  },

  /**
   * Called to test whether installing XPI add-ons is enabled.
   *
   * @returns {boolean}
   *        True if installing is enabled.
   */
  isInstallEnabled() {
__L_V__7({
    lN: 4157,tT:'func',pr:'',eT:{},fN:'isInstallEnabled'
  });'__L_V__7';
    // Default to enabled if the preference does not exist
    return Services.prefs.getBoolPref(PREF_XPI_ENABLED, true);
  },

  /**
   * Called to test whether installing XPI add-ons by direct URL requests is
   * whitelisted.
   *
   * @returns {boolean}
   *        True if installing by direct requests is whitelisted
   */
  isDirectRequestWhitelisted() {
__L_V__7({
    lN: 4169,tT:'func',pr:'',eT:{},fN:'isDirectRequestWhitelisted'
  });'__L_V__7';
    // Default to whitelisted if the preference does not exist.
    return Services.prefs.getBoolPref(PREF_XPI_DIRECT_WHITELISTED, true);
  },

  /**
   * Called to test whether installing XPI add-ons from file referrers is
   * whitelisted.
   *
   * @returns {boolean}
   *       True if installing from file referrers is whitelisted
   */
  isFileRequestWhitelisted() {
__L_V__7({
    lN: 4181,tT:'func',pr:'',eT:{},fN:'isFileRequestWhitelisted'
  });'__L_V__7';
    // Default to whitelisted if the preference does not exist.
    return Services.prefs.getBoolPref(PREF_XPI_FILE_WHITELISTED, true);
  },

  /**
   * Called to test whether installing XPI add-ons from a URI is allowed.
   *
   * @param {nsIPrincipal}  aInstallingPrincipal
   *        The nsIPrincipal that initiated the install
   * @returns {boolean}
   *        True if installing is allowed
   */
  isInstallAllowed(aInstallingPrincipal) {
__L_V__7({
    lN: 4194,tT:'func',pr:'',eT:{'aInstallingPrincipal':aInstallingPrincipal},fN:'isInstallAllowed'
  });'__L_V__7';
    if (!this.isInstallEnabled()) {
__L_V__7({
    lN: 4195,tT:'if',pr:'!this.isInstallEnabled()',eT:{},fN:''
  });'__L_V__7';
      return false;
    }

    let uri = aInstallingPrincipal.URI;

    // Direct requests without a referrer are either whitelisted or blocked.
    if (!uri) {
__L_V__7({
    lN: 4202,tT:'if',pr:'!uri',eT:{},fN:''
  });'__L_V__7';
      return this.isDirectRequestWhitelisted();
    }

    // Local referrers can be whitelisted.
    if (
      this.isFileRequestWhitelisted() &&
      (uri.schemeIs("chrome") || uri.schemeIs("file"))
    ) {
__L_V__7({
    lN: 4210,tT:'if',pr:' this.isFileRequestWhitelisted() && (uri.schemeIs(chrome) || uri.schemeIs(file)) ',eT:{},fN:''
  });'__L_V__7';
      return true;
    }

    XPIDatabase.importPermissions();

    let permission = Services.perms.testPermissionFromPrincipal(
      aInstallingPrincipal,
      XPI_PERMISSION
    );
    if (permission == Ci.nsIPermissionManager.DENY_ACTION) {
__L_V__7({
    lN: 4220,tT:'if',pr:'permission == Ci.nsIPermissionManager.DENY_ACTION',eT:{},fN:''
  });'__L_V__7';
      return false;
    }

    let requireWhitelist = Services.prefs.getBoolPref(
      PREF_XPI_WHITELIST_REQUIRED,
      true
    );
    if (
      requireWhitelist &&
      permission != Ci.nsIPermissionManager.ALLOW_ACTION
    ) {
__L_V__7({
    lN: 4231,tT:'if',pr:' requireWhitelist && permission != Ci.nsIPermissionManager.ALLOW_ACTION ',eT:{},fN:''
  });'__L_V__7';
      return false;
    }

    let requireSecureOrigin = Services.prefs.getBoolPref(
      PREF_INSTALL_REQUIRESECUREORIGIN,
      true
    );
    let safeSchemes = ["https", "chrome", "file"];
    if (requireSecureOrigin && !safeSchemes.includes(uri.scheme)) {
__L_V__7({
    lN: 4240,tT:'if',pr:'requireSecureOrigin && !safeSchemes.includes(uri.scheme)',eT:{},fN:''
  });'__L_V__7';
      return false;
    }

    return true;
  },

  /**
   * Called to get an AddonInstall to download and install an add-on from a URL.
   *
   * @param {nsIURI} aUrl
   *        The URL to be installed
   * @param {object} [aOptions]
   *        Additional options for this install.
   * @param {string?} [aOptions.hash]
   *        A hash for the install
   * @param {string} [aOptions.name]
   *        A name for the install
   * @param {Object} [aOptions.icons]
   *        Icon URLs for the install
   * @param {string} [aOptions.version]
   *        A version for the install
   * @param {XULElement} [aOptions.browser]
   *        The browser performing the install
   * @param {Object} [aOptions.telemetryInfo]
   *        An optional object which provides details about the installation source
   *        included in the addon manager telemetry events.
   * @param {boolean} [options.sendCookies = false]
   *        Whether cookies should be sent when downloading the add-on.
   * @returns {AddonInstall}
   */
  async getInstallForURL(aUrl, aOptions) {
__L_V__7({
    lN: 4271,tT:'func',pr:'',eT:{'aUrl':aUrl,'aOptions':aOptions},fN:'getInstallForURL'
  });'__L_V__7';
    let location = XPIStates.getLocation(KEY_APP_PROFILE);
    let url = Services.io.newURI(aUrl);

    if (url instanceof Ci.nsIFileURL) {
__L_V__7({
    lN: 4275,tT:'if',pr:'url instanceof Ci.nsIFileURL',eT:{},fN:''
  });'__L_V__7';
      let install = new LocalAddonInstall(location, url, aOptions);
      await install.init();
      return install.wrapper;
    }

    let install = new DownloadAddonInstall(location, url, aOptions);
    return install.wrapper;
  },

  /**
   * Called to get an AddonInstall to install an add-on from a local file.
   *
   * @param {nsIFile} aFile
   *        The file to be installed
   * @param {Object?} [aInstallTelemetryInfo]
   *        An optional object which provides details about the installation source
   *        included in the addon manager telemetry events.
   * @returns {AddonInstall?}
   */
  async getInstallForFile(aFile, aInstallTelemetryInfo) {
__L_V__7({
    lN: 4295,tT:'func',pr:'',eT:{'aFile':aFile,'aInstallTelemetryInfo':aInstallTelemetryInfo},fN:'getInstallForFile'
  });'__L_V__7';
    let install = await createLocalInstall(aFile, null, aInstallTelemetryInfo);
    return install ? install.wrapper : null;
  },

  /**
   * Called to get the current AddonInstalls, optionally limiting to a list of
   * types.
   *
   * @param {Array<string>?} aTypes
   *        An array of types or null to get all types
   * @returns {AddonInstall[]}
   */
  getInstallsByTypes(aTypes) {
__L_V__7({
    lN: 4308,tT:'func',pr:'',eT:{'aTypes':aTypes},fN:'getInstallsByTypes'
  });'__L_V__7';
    let results = [...this.installs];
    if (aTypes) {
__L_V__7({
    lN: 4310,tT:'if',pr:'aTypes',eT:{},fN:''
  });'__L_V__7';
      results = results.filter(install => {
        return aTypes.includes(install.type);
      });
    }

    return results.map(install => install.wrapper);
  },

  /**
   * Temporarily installs add-on from a local XPI file or directory.
   * As this is intended for development, the signature is not checked and
   * the add-on does not persist on application restart.
   *
   * @param {nsIFile} aFile
   *        An nsIFile for the unpacked add-on directory or XPI file.
   *
   * @returns {Promise<Addon>}
   *        A Promise that resolves to an Addon object on success, or rejects
   *        if the add-on is not a valid restartless add-on or if the
   *        same ID is already installed.
   */
  async installTemporaryAddon(aFile) {
__L_V__7({
    lN: 4332,tT:'func',pr:'',eT:{'aFile':aFile},fN:'installTemporaryAddon'
  });'__L_V__7';
    let installLocation = XPIInternal.TemporaryInstallLocation;

    if (XPIInternal.isXPI(aFile.leafName)) {
__L_V__7({
    lN: 4335,tT:'if',pr:'XPIInternal.isXPI(aFile.leafName)',eT:{},fN:''
  });'__L_V__7';
      flushJarCache(aFile);
    }
    let addon = await loadManifestFromFile(aFile, installLocation);
    addon.rootURI = getURIForResourceInFile(aFile, "").spec;

    await this._activateAddon(addon, { temporarilyInstalled: true });

    logger.debug(`Install of temporary addon in ${aFile.path} completed.`);
    return addon.wrapper;
  },

  /**
   * Installs an add-on from a built-in location
   *  (ie a resource: url referencing assets shipped with the application)
   *
   * @param  {string} base
   *         A string containing the base URL.  Must be a resource: URL.
   * @returns {Promise}
   *          A Promise that resolves when the addon is installed.
   */
  async installBuiltinAddon(base) {
__L_V__7({
    lN: 4356,tT:'func',pr:'',eT:{'base':base},fN:'installBuiltinAddon'
  });'__L_V__7';
    if (lastLightweightTheme === null) {
__L_V__7({
    lN: 4357,tT:'if',pr:'lastLightweightTheme === null',eT:{},fN:''
  });'__L_V__7';
      lastLightweightTheme = Services.prefs.getCharPref(PREF_SELECTED_LWT, "");
      Services.prefs.clearUserPref(PREF_SELECTED_LWT);
    }

    let baseURL = Services.io.newURI(base);

    // WebExtensions need to be able to iterate through the contents of
    // an extension (for localization).  It knows how to do this with
    // jar: and file: URLs, so translate the provided base URL to
    // something it can use.
    if (baseURL.scheme !== "resource") {
__L_V__7({
    lN: 4368,tT:'if',pr:'baseURL.scheme !== resource',eT:{},fN:''
  });'__L_V__7';
      throw new Error("Built-in addons must use resource: URLS");
    }

    let pkg = builtinPackage(baseURL);
    let addon = await loadManifest(pkg, XPIInternal.BuiltInLocation);
    addon.rootURI = base;

    // If this is a theme, decide whether to enable it. Themes are
    // disabled by default. However:
    //
    // If a lightweight theme was selected in the last session, and this
    // theme has the same ID, then we clearly want to enable it.
    //
    // If it is the default theme, more specialized behavior applies:
    //
    // We always want one theme to be active, falling back to the
    // default theme when the active theme is disabled. The first time
    // we install the default theme, though, there likely aren't any
    // other theme add-ons installed yet, in which case we want to
    // enable it immediately.
    if (addon.type === "theme") {
__L_V__7({
    lN: 4389,tT:'if',pr:'addon.type === theme',eT:{},fN:''
  });'__L_V__7';
      if (
        addon.id === lastLightweightTheme ||
        (!lastLightweightTheme.endsWith("@mozilla.org") &&
          addon.id === AddonSettings.DEFAULT_THEME_ID &&
          !XPIDatabase.getAddonsByType("theme").some(theme => !theme.disabled))
      ) {
__L_V__7({
    lN: 4395,tT:'if',pr:' addon.id === lastLightweightTheme || (!lastLightweightTheme.endsWith(@mozilla.org) && addon.id === AddonSettings.DEFAULT_THEME_ID && !XPIDatabase.getAddonsByType(theme).some(theme => !theme.disabled)) ',eT:{},fN:''
  });'__L_V__7';
        addon.userDisabled = false;
      }
    }
    await this._activateAddon(addon);
  },

  /**
   * Activate a newly installed addon.
   * This function handles all the bookkeeping related to a new addon
   * and invokes whatever bootstrap methods are necessary.
   * Note that this function is only used for temporary and built-in
   * installs, it is very similar to AddonInstall::startInstall().
   * It would be great to merge this function with that one some day.
   *
   * @param {AddonInternal} addon  The addon to activate
   * @param {object} [extraParams] Any extra parameters to pass to the
   *                               bootstrap install() method
   *
   * @returns {Promise<void>}
   */
  async _activateAddon(addon, extraParams = {}) {
__L_V__7({
    lN: 4416,tT:'func',pr:'',eT:{'addon':addon,'extraParams':extraParams},fN:'_activateAddon'
  });'__L_V__7';
    if (addon.appDisabled) {
__L_V__7({
    lN: 4417,tT:'if',pr:'addon.appDisabled',eT:{},fN:''
  });'__L_V__7';
      let message = `Add-on ${addon.id} is not compatible with application version.`;

      let app = addon.matchingTargetApplication;
      if (app) {
__L_V__7({
    lN: 4421,tT:'if',pr:'app',eT:{},fN:''
  });'__L_V__7';
        if (app.minVersion) {
__L_V__7({
    lN: 4422,tT:'if',pr:'app.minVersion',eT:{},fN:''
  });'__L_V__7';
          message += ` add-on minVersion: ${app.minVersion}.`;
        }
        if (app.maxVersion) {
__L_V__7({
    lN: 4425,tT:'if',pr:'app.maxVersion',eT:{},fN:''
  });'__L_V__7';
          message += ` add-on maxVersion: ${app.maxVersion}.`;
        }
      }
      throw new Error(message);
    }

    let oldAddon = await XPIDatabase.getVisibleAddonForID(addon.id);

    let install = () => {
      addon.visible = true;
      // Themes are generally not enabled by default at install time,
      // unless enabled by the front-end code. If they are meant to be
      // enabled, they will already have been enabled by this point.
      if (addon.type !== "theme" || addon.location.isTemporary) {
__L_V__7({
    lN: 4439,tT:'if',pr:'addon.type !== theme || addon.location.isTemporary',eT:{},fN:''
  });'__L_V__7';
        addon.userDisabled = false;
      }
      addon.active = !addon.disabled;

      addon = XPIDatabase.addToDatabase(
        addon,
        addon._sourceBundle ? addon._sourceBundle.path : null
      );

      XPIStates.addAddon(addon);
      XPIStates.save();
    };

    AddonManagerPrivate.callAddonListeners("onInstalling", addon.wrapper);

    if (oldAddon) {
__L_V__7({
    lN: 4455,tT:'if',pr:'oldAddon',eT:{},fN:''
  });'__L_V__7';
      logger.warn(
        `Addon with ID ${oldAddon.id} already installed, ` +
          "older version will be disabled"
      );

      addon.installDate = oldAddon.installDate;

      await XPIInternal.BootstrapScope.get(oldAddon).update(
        addon,
        true,
        install
      );
    } else {
      addon.installDate = Date.now();

      install();
      let bootstrap = XPIInternal.BootstrapScope.get(addon);
      await bootstrap.install(undefined, true, extraParams);
    }

    AddonManagerPrivate.callInstallListeners(
      "onExternalInstall",
      null,
      addon.wrapper,
      oldAddon ? oldAddon.wrapper : null,
      false
    );
    AddonManagerPrivate.callAddonListeners("onInstalled", addon.wrapper);

    // Notify providers that a new theme has been enabled.
    if (addon.type === "theme" && !addon.userDisabled) {
__L_V__7({
    lN: 4486,tT:'if',pr:'addon.type === theme && !addon.userDisabled',eT:{},fN:''
  });'__L_V__7';
      AddonManagerPrivate.notifyAddonChanged(addon.id, addon.type, false);
    }
  },

  /**
   * Uninstalls an add-on, immediately if possible or marks it as pending
   * uninstall if not.
   *
   * @param {DBAddonInternal} aAddon
   *        The DBAddonInternal to uninstall
   * @param {boolean} aForcePending
   *        Force this addon into the pending uninstall state (used
   *        e.g. while the add-on manager is open and offering an
   *        "undo" button)
   * @throws if the addon cannot be uninstalled because it is in an install
   *         location that does not allow it
   */
  async uninstallAddon(aAddon, aForcePending) {
__L_V__7({
    lN: 4504,tT:'func',pr:'',eT:{'aAddon':aAddon,'aForcePending':aForcePending},fN:'uninstallAddon'
  });'__L_V__7';
    if (!aAddon.inDatabase) {
__L_V__7({
    lN: 4505,tT:'if',pr:'!aAddon.inDatabase',eT:{},fN:''
  });'__L_V__7';
      throw new Error(
        `Cannot uninstall addon ${aAddon.id} because it is not installed`
      );
    }
    let { location } = aAddon;

    // If the addon is sideloaded into a location that does not allow
    // sideloads, it is a legacy sideload.  We allow those to be uninstalled.
    let isLegacySideload =
      aAddon.foreignInstall &&
      !(location.scope & AddonSettings.SCOPES_SIDELOAD);

    if (location.locked && !isLegacySideload) {
__L_V__7({
    lN: 4518,tT:'if',pr:'location.locked && !isLegacySideload',eT:{},fN:''
  });'__L_V__7';
      throw new Error(
        `Cannot uninstall addon ${aAddon.id} ` +
          `from locked install location ${location.name}`
      );
    }

    if (aForcePending && aAddon.pendingUninstall) {
__L_V__7({
    lN: 4525,tT:'if',pr:'aForcePending && aAddon.pendingUninstall',eT:{},fN:''
  });'__L_V__7';
      throw new Error("Add-on is already marked to be uninstalled");
    }

    if (aAddon._updateCheck) {
__L_V__7({
    lN: 4529,tT:'if',pr:'aAddon._updateCheck',eT:{},fN:''
  });'__L_V__7';
      logger.debug(`Cancel in-progress update check for ${aAddon.id}`);
      aAddon._updateCheck.cancel();
    }

    let wasActive = aAddon.active;
    let wasPending = aAddon.pendingUninstall;

    if (aForcePending) {
__L_V__7({
    lN: 4537,tT:'if',pr:'aForcePending',eT:{},fN:''
  });'__L_V__7';
      // We create an empty directory in the staging directory to indicate
      // that an uninstall is necessary on next startup. Temporary add-ons are
      // automatically uninstalled on shutdown anyway so there is no need to
      // do this for them.
      if (!aAddon.location.isTemporary && aAddon.location.installer) {
__L_V__7({
    lN: 4542,tT:'if',pr:'!aAddon.location.isTemporary && aAddon.location.installer',eT:{},fN:''
  });'__L_V__7';
        let stage = getFile(
          aAddon.id,
          aAddon.location.installer.getStagingDir()
        );
        if (!stage.exists()) {
__L_V__7({
    lN: 4547,tT:'if',pr:'!stage.exists()',eT:{},fN:''
  });'__L_V__7';
          stage.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
        }
      }

      XPIDatabase.setAddonProperties(aAddon, {
        pendingUninstall: true,
      });
      Services.prefs.setBoolPref(PREF_PENDING_OPERATIONS, true);
      let xpiState = aAddon.location.get(aAddon.id);
      if (xpiState) {
__L_V__7({
    lN: 4557,tT:'if',pr:'xpiState',eT:{},fN:''
  });'__L_V__7';
        xpiState.enabled = false;
        XPIStates.save();
      } else {
        logger.warn(
          "Can't find XPI state while uninstalling ${id} from ${location}",
          aAddon
        );
      }
    }

    // If the add-on is not visible then there is no need to notify listeners.
    if (!aAddon.visible) {
__L_V__7({
    lN: 4569,tT:'if',pr:'!aAddon.visible',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    let wrapper = aAddon.wrapper;

    // If the add-on wasn't already pending uninstall then notify listeners.
    if (!wasPending) {
__L_V__7({
    lN: 4576,tT:'if',pr:'!wasPending',eT:{},fN:''
  });'__L_V__7';
      AddonManagerPrivate.callAddonListeners(
        "onUninstalling",
        wrapper,
        !!aForcePending
      );
    }

    let existingAddon = XPIStates.findAddon(
      aAddon.id,
      loc => loc != aAddon.location
    );

    let bootstrap = XPIInternal.BootstrapScope.get(aAddon);
    if (!aForcePending) {
__L_V__7({
    lN: 4590,tT:'if',pr:'!aForcePending',eT:{},fN:''
  });'__L_V__7';
      let existing;
      if (existingAddon) {
__L_V__7({
    lN: 4592,tT:'if',pr:'existingAddon',eT:{},fN:''
  });'__L_V__7';
        existing = await XPIDatabase.getAddonInLocation(
          aAddon.id,
          existingAddon.location.name
        );
      }

      let uninstall = () => {
        XPIStates.disableAddon(aAddon.id);
        if (aAddon.location.installer) {
__L_V__7({
    lN: 4601,tT:'if',pr:'aAddon.location.installer',eT:{},fN:''
  });'__L_V__7';
          aAddon.location.installer.uninstallAddon(aAddon.id);
        }
        XPIDatabase.removeAddonMetadata(aAddon);
        aAddon.location.removeAddon(aAddon.id);
        AddonManagerPrivate.callAddonListeners("onUninstalled", wrapper);

        if (existing) {
__L_V__7({
    lN: 4608,tT:'if',pr:'existing',eT:{},fN:''
  });'__L_V__7';
          XPIDatabase.makeAddonVisible(existing);
          AddonManagerPrivate.callAddonListeners(
            "onInstalling",
            existing.wrapper,
            false
          );

          if (!existing.disabled) {
__L_V__7({
    lN: 4616,tT:'if',pr:'!existing.disabled',eT:{},fN:''
  });'__L_V__7';
            XPIDatabase.updateAddonActive(existing, true);
          }
        }
      };

      if (existing) {
__L_V__7({
    lN: 4622,tT:'if',pr:'existing',eT:{},fN:''
  });'__L_V__7';
        await bootstrap.update(existing, !existing.disabled, uninstall);

        AddonManagerPrivate.callAddonListeners("onInstalled", existing.wrapper);
      } else {
        aAddon.location.removeAddon(aAddon.id);
        await bootstrap.uninstall();
        uninstall();
      }
    } else if (aAddon.active) {
__L_V__7({
    lN: 4631,tT:'if',pr:'aAddon.active',eT:{},fN:''
  });'__L_V__7';
      XPIStates.disableAddon(aAddon.id);
      bootstrap.shutdown(BOOTSTRAP_REASONS.ADDON_UNINSTALL);
      XPIDatabase.updateAddonActive(aAddon, false);
    }

    // Notify any other providers that a new theme has been enabled
    // (when the active theme is uninstalled, the default theme is enabled).
    if (aAddon.type === "theme" && wasActive) {
__L_V__7({
    lN: 4639,tT:'if',pr:'aAddon.type === theme && wasActive',eT:{},fN:''
  });'__L_V__7';
      AddonManagerPrivate.notifyAddonChanged(null, aAddon.type);
    }
  },

  /**
   * Cancels the pending uninstall of an add-on.
   *
   * @param {DBAddonInternal} aAddon
   *        The DBAddonInternal to cancel uninstall for
   */
  cancelUninstallAddon(aAddon) {
__L_V__7({
    lN: 4650,tT:'func',pr:'',eT:{'aAddon':aAddon},fN:'cancelUninstallAddon'
  });'__L_V__7';
    if (!aAddon.inDatabase) {
__L_V__7({
    lN: 4651,tT:'if',pr:'!aAddon.inDatabase',eT:{},fN:''
  });'__L_V__7';
      throw new Error("Can only cancel uninstall for installed addons.");
    }
    if (!aAddon.pendingUninstall) {
__L_V__7({
    lN: 4654,tT:'if',pr:'!aAddon.pendingUninstall',eT:{},fN:''
  });'__L_V__7';
      throw new Error("Add-on is not marked to be uninstalled");
    }

    if (!aAddon.location.isTemporary && aAddon.location.installer) {
__L_V__7({
    lN: 4658,tT:'if',pr:'!aAddon.location.isTemporary && aAddon.location.installer',eT:{},fN:''
  });'__L_V__7';
      aAddon.location.installer.cleanStagingDir([aAddon.id]);
    }

    XPIDatabase.setAddonProperties(aAddon, {
      pendingUninstall: false,
    });

    if (!aAddon.visible) {
__L_V__7({
    lN: 4666,tT:'if',pr:'!aAddon.visible',eT:{},fN:''
  });'__L_V__7';
      return;
    }

    aAddon.location.get(aAddon.id).syncWithDB(aAddon);
    XPIStates.save();

    Services.prefs.setBoolPref(PREF_PENDING_OPERATIONS, true);

    if (!aAddon.disabled) {
__L_V__7({
    lN: 4675,tT:'if',pr:'!aAddon.disabled',eT:{},fN:''
  });'__L_V__7';
      XPIInternal.BootstrapScope.get(aAddon).startup(
        BOOTSTRAP_REASONS.ADDON_INSTALL
      );
      XPIDatabase.updateAddonActive(aAddon, true);
    }

    let wrapper = aAddon.wrapper;
    AddonManagerPrivate.callAddonListeners("onOperationCancelled", wrapper);

    // Notify any other providers that this theme is now enabled again.
    if (aAddon.type === "theme" && aAddon.active) {
__L_V__7({
    lN: 4686,tT:'if',pr:'aAddon.type === theme && aAddon.active',eT:{},fN:''
  });'__L_V__7';
      AddonManagerPrivate.notifyAddonChanged(aAddon.id, aAddon.type, false);
    }
  },

  DirectoryInstaller,
  SystemAddonInstaller,
};
