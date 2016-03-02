// Copyright Cliqz GmbH, 2016.

"use strict";

this.EXPORTED_SYMBOLS = ["AutoPrivateTab"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");
const bf = {};
Cu.import("resource://gre/modules/BloomFilter.jsm", bf);
Cu.import("resource://gre/modules/Timer.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

const PORN_DATA_FILE_NAME = "porn-domains.bin";
const FILTER_N_HASHES = 14;

const OPEN_FLAGS = {
  RDONLY: parseInt("0x01"),
  WRONLY: parseInt("0x02"),
  CREATE_FILE: parseInt("0x08"),
  APPEND: parseInt("0x10"),
  TRUNCATE: parseInt("0x20"),
  EXCL: parseInt("0x80")
};

function openFile(file) {
  let inStream = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
  const MODE_RDONLY = 1;
  inStream.init(file, MODE_RDONLY, 0, inStream.CLOSE_ON_EOF);
  return inStream;
}

function stringFromStream(inStream, encoding) {
  const streamSize = inStream.available();
  const convStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
      .createInstance(Ci.nsIConverterInputStream);
  convStream.init(inStream, encoding || "UTF-8", streamSize,
      convStream.DEFAULT_REPLACEMENT_CHARACTER);
  try {
    const data = {};
    convStream.readString(streamSize, data);
    return data.value;
  } finally {
    convStream.close();
  }
}

function readBinary(file) {
  const fStream = openFile(file);
  try {
    const binStream = Cc["@mozilla.org/binaryinputstream;1"]
        .createInstance(Ci.nsIBinaryInputStream);
    binStream.setInputStream(fStream);

    const buffer = new ArrayBuffer(binStream.available());
    const read = binStream.readArrayBuffer(buffer.byteLength, buffer);
    if (read != buffer.byteLength)
      throw new Error("Buffer underflow");
    return buffer;
  }
  finally {
    fStream.close();
  }
}

var filter;
(function init() {
  var filterBinFile = FileUtils.getFile("XCurProcD", [PORN_DATA_FILE_NAME]);
  if (filterBinFile.exists()) {
    filter = new bf.BloomFilter(readBinary(filterBinFile), FILTER_N_HASHES);
    return;
  }
#if 0
  const profD = Services.dirsvc.get("ProfD", Ci.nsIFile);
  const filterBinFile = profD.clone();
  filterBinFile.append(PORN_DATA_FILE_NAME);
  if (filterBinFile.exists()) {
    // TODO: Check minimum and maximum size.
    filter = new bf.BloomFilter(readBinary(filterBinFile), FILTER_N_HASHES);
    return;
  }
  const filterJSONFile = profD.clone();
  filterJSONFile.append("porn-domains.json");
  if (!filterJSONFile.exists())
    return;
  const filterData = JSON.parse(stringFromStream(openFile(filterJSONFile)));
  filter = new bf.BloomFilter(filterData.bkt, filterData.k);

  // Resave as binary.
  var foStream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
  const openFlags = OPEN_FLAGS.WRONLY | OPEN_FLAGS.CREATE_FILE |
      OPEN_FLAGS.TRUNCATE;
  const permFlags = parseInt("0666", 8);
  foStream.init(filterBinFile, openFlags, permFlags, 0);
  try {
    var binStream = Cc["@mozilla.org/binaryoutputstream;1"]
        .createInstance(Ci.nsIBinaryOutputStream);
    binStream.setOutputStream(foStream);
    const buffer = new Uint8Array(filter._buckets.buffer);  // TODO: make public
    binStream.writeByteArray(buffer, buffer.byteLength);
  }
  catch (e) {
    Cu.reportError("Could not save binary filter data: " + e);
  }
  finally {
    foStream.close();
  }
#endif
})();

const AutoPrivateTab = {
  // Stores internal data to disk. Call before quitting application.
  persist: function APT_persist() {
    if (!this._dirty)
      return;
    // TODO: Write _whiteList to file.
  },

  handleTabNavigation: function APT_handleTabNavigation(uri, tab_browser) {
    const [pm, domain] = this._shouldLoadURIInPrivateMode(uri)
    if (!pm)
      return;
    const gBrowser = tab_browser.ownerGlobal.gBrowser;
    tab_browser.loadContext.usePrivateBrowsing = true;
    const tab = gBrowser.getTabForBrowser(tab_browser)
    if (tab)
      tab.private = true;
    // TODO: Navigation could happen in a background tab, not the current one.
    setTimeout(
      this._addOrUpdateNotification.bind(this, tab_browser, domain),
      1000);
  },

  /**
   * @param {nsIURI or string} uri - a URL to check.
   * @return {[boolean, string]} pair with the following values:
   *   whether a particular URL is unwelcome in normal mode,
   *   extracted domain name (may be absent).
   */
  _shouldLoadURIInPrivateMode: function APT__shouldLoadURIInPrivateMode(uri) {
    var spec;
    try {
      if (uri instanceof Ci.nsIURI) {
        spec = uri.spec;
      }
      else {
        spec = uri;
        uri = Services.uriFixup.createFixupURI(spec,
            Services.uriFixup.FIXUP_FLAG_NONE);
      }

      if (!uri.schemeIs("http") && !uri.schemeIs("https"))
        return [false, undefined];

      const host = uri.host.replace(/^www\./i, '');
      const pm = !this._whiteList.has(host) && filter.test(host);
      return [pm, host];
    }
    catch (e) {
      Cu.reportError("Could not check spec: " + spec);
      Cu.reportError(e);
      return [false, undefined];
    }
  },

  _addOrUpdateNotification: function APT__addOrUpdateNotification(
      tab_browser, domain) {
    const gBrowser = tab_browser.ownerGlobal.gBrowser;
    const notificationBox = gBrowser.getNotificationBox();
    const notification = notificationBox.getNotificationWithValue(
        this._consts.AUTO_PRIVATE_TAB_NOTIFICATION);
    if (notification) {
      notificationBox.removeNotification(notification);
    }
    const buttons = [
    {
      label: "Reload in normal mode",
      accessKey: "R",
      popup: null,
      callback: (notification, descr) => {
          this._reloadTabAsNormal(tab_browser);
      }
    },
    {
      label: "Always load in normal mode",
      accessKey: "A",
      popup: null,
      callback: (notification, descr) => {
        this._reloadTabAsNormal(tab_browser);
        this._whiteList.add(domain);
        this._dirty = true;
      }
    }];

    notificationBox.appendNotification(
        domain + " is better viewed in private mode",
        this._consts.AUTO_PRIVATE_TAB_NOTIFICATION,
        "chrome://browser/skin/privatebrowsing-mask.png",
        notificationBox.PRIORITY_INFO_HIGH,
        buttons);
  },

  _reloadTabAsNormal: function APT__reloadTabAsNormal(tab_browser) {
    tab_browser.loadContext.usePrivateBrowsing = false;
    const gBrowser = tab_browser.ownerGlobal.gBrowser;
    const tab = gBrowser.getTabForBrowser(tab_browser)
    if (tab)
      tab.private = false;
    tab_browser.reload();
  },

  _consts: {
    AUTO_PRIVATE_TAB_NOTIFICATION: "auto-private-tab"
  },
  // List of domains which should be loaded in normal mode.
  _whiteList: new Set(),
  _dirty: false
};
