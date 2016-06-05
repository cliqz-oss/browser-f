// Copyright Cliqz GmbH, 2016.

// This script is meant to be run from xpcshell.
// It reads input file line by line, puts each line into a BloomFilter, and then
// serializes it into a binary file.
// Arguments:
// |inFile| - RELATIVE path to input file, containing text records, one per line
// |outFile| - RELATIVE path to output file with filter data.

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

function fail(str) {
  print(str);
  throw new Error(str);
}

// Because if you use xpcshell, you're obviously so cool, you don't need error
// messages by default.
try {

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/BloomFilter.jsm");
Cu.import("resource://gre/modules/BloomFilterUtils.jsm");

if (arguments.length < 3)
  fail("Three arguments expected, but " + arguments.length + " given");

const inFileName = arguments[0];
const outFileName = arguments[1];
const dbVersion = parseInt(arguments[2]);
const explicitSize = parseInt(arguments[3]);
const explicitHashes = parseInt(arguments[4]);
const FALSE_RATE = 0.0001;
const SIZE_INC_STEP_BLOCKS = 1024;  // 4kB

function linesIntoBloomFilter(lines) {
  let [size, nHashes] = calculateFilterProperties(lines.length, FALSE_RATE);
  print("BloomFilter optimal parameters: " + [size, nHashes]);
  if (!Number.isNaN(explicitSize) && !Number.isNaN(explicitHashes)) {
    size = explicitSize;
    nHashes = explicitHashes;
    print("Explicit parameters " + [size, nHashes]);
  }
  else {
    size = Math.ceil(size / SIZE_INC_STEP_BLOCKS) * SIZE_INC_STEP_BLOCKS;
    print("Rounded size up to " + size);
  }
  const filter = new BloomFilter(size, nHashes);

  for (let line of lines) {
    filter.add(line);
  }

  return filter;
}

function readTextLines(fileName, encoding = "UTF-8") {
  const file = FileUtils.getFile("XCurProcD", fileName.split("/"));
  let inStream = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
  inStream.init(file, FileUtils.MODE_RDONLY, 0, inStream.CLOSE_ON_EOF);
  try {
    const streamSize = inStream.available();
    const convStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
        .createInstance(Ci.nsIConverterInputStream);
    convStream.init(inStream, encoding, streamSize,
        convStream.DEFAULT_REPLACEMENT_CHARACTER);

    const data = {};
    convStream.readString(streamSize, data);
    return data.value.split("\n")
        .map((line) => line.trim())
        .filter((line) => (line.length > 0));
  }
  finally {
    inStream.close();
  }
}

const lines = readTextLines(inFileName);
print("Input lines count: " + lines.length);

let filter = linesIntoBloomFilter(lines);
print("Filled filter.")

const outFile = FileUtils.getFile("XCurProcD", outFileName.split("/"));
print("Saving filter data into: " + outFile.path);
BloomFilterUtils.saveToFile(filter, dbVersion, outFile);

print("Successfully saved filter data!");

print("Checking...");
let [testFilter, testVersion] = BloomFilterUtils.loadFromFile(outFile);
print("===========");
if (dbVersion != testVersion)
  print("Versions don't match", dbVersion, testVersion);
let ok = true;
for (let line of lines) {
  const check = testFilter.test(line);
  ok = ok && check;
  if (!check)
    print(line, check);
}
print("===========");
print(ok ? "OK" : "Checks for some lines failed!");

}
catch (e) {
  fail(e);
}
