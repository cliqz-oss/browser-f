// Copyright Cliqz GmbH, 2016.

"use strict";

this.EXPORTED_SYMBOLS = ["BloomFilterUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/BloomFilter.jsm");
const HEAD_SIG = 0x43514246;  // ASCII "CQBF" - CliQz Bloom Filter
const FORMAT_VERSION = 1;
const FILE_MAX_SIZE = 20 * 1024 * 1024;  // 20MB.
const ERRORS = {
  WRONG_FORMAT: "Unrecognized filter data format",
  FILE_TOO_BIG: "File is too big",
  BUFF_UNDERFLOW: "Buffer underflow"
};

const BloomFilterUtils = {

/**
 * @param {nsIInputStream} stream - pointer to input stream with BF data.
 *    Calling side responcible for closing the stream.
 * @return {BloomFilter} filter with a given file.
 */
loadFromStream: function(stream) {
  const binStream = Cc["@mozilla.org/binaryinputstream;1"]
      .createInstance(Ci.nsIBinaryInputStream);
  binStream.setInputStream(stream);
  if (binStream.available() > FILE_MAX_SIZE)
    throw new Error(ERRORS.FILE_TOO_BIG);

  // Check header:
  const typeSig = binStream.read32();
  if (typeSig != HEAD_SIG)
    throw new Error(ERRORS.WRONG_FORMAT);
  const version = binStream.read8();
  if (version != FORMAT_VERSION)
    throw new Error(ERRORS.WRONG_FORMAT);
  const dbVersion = binStream.read16();
  const nHashes = binStream.read8();

  // Read the rest of it into a buffer:
  const buffer = new ArrayBuffer(binStream.available());
  const read = binStream.readArrayBuffer(buffer.byteLength, buffer);
  if (read != buffer.byteLength)
    throw new Error(ERRORS.BUFF_UNDERFLOW);

  // Construct filter from buffer:
  return [new BloomFilter(buffer, nHashes), dbVersion];
},

/**
 * @param {BloomFilter} filter - bloom filter to save to file.
 * @param {int} version - database version.
 * @param {nsIFile} file - pointer to the bloom filter data file.
 */
saveToFile: function(filter, version, file) {
  var foStream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
  const openFlags = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE |
      FileUtils.MODE_TRUNCATE;
  const permFlags = parseInt("0666", 8);
  foStream.init(file, openFlags, permFlags, 0);
  try {
    var binStream = Cc["@mozilla.org/binaryoutputstream;1"]
        .createInstance(Ci.nsIBinaryOutputStream);
    binStream.setOutputStream(foStream);

    // Write header:
    binStream.write32(HEAD_SIG);
    binStream.write8(FORMAT_VERSION);
    binStream.write16(version);
    binStream.write8(filter.nHashes);

    // Write filter data:
    const buffer = new Uint8Array(filter.rawData);
    binStream.writeByteArray(buffer, buffer.byteLength);
  }
  finally {
    foStream.close();
  }
}

};  // BloomFilterUtils

const OPEN_FLAGS = {
  RDONLY: parseInt("0x01"),
  WRONLY: parseInt("0x02"),
  CREATE_FILE: parseInt("0x08"),
  APPEND: parseInt("0x10"),
  TRUNCATE: parseInt("0x20"),
  EXCL: parseInt("0x80")
};

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
