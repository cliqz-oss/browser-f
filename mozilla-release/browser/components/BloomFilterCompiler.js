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

const argDefs = {
  "-i": {type: String, mandatory: true,  name: "inFileName"},
  "-o": {type: String, mandatory: true,  name: "outFileName"},
  "-v": {type: Number, mandatory: true,  name: "dbVersion"},
  "-t": {type: Number, mandatory: false, name: "topN"},
  "-s": {type: Number, mandatory: false, name: "explicitSize"},
  "-h": {type: Number, mandatory: false, name: "explicitHashes"},
};

function parseArgs(args, argDefs) {
  function parseVal(val, argDef) {
    switch (argDef.type) {
      case String:
        return String(val);
      case Number: {
        const int = parseInt(val);
        if (isNaN(int))
          throw new Error("Could not parse integer from: " + val);
        return int;
      }
      default:
        throw new Error("Strange arguments definition type: " + argDef.type);
    }
  }

  // Parse specified values.
  let i = 0;
  const vals = {};
  while (i < args.length) {
    const argKey = args[i];
    const argDef = argDefs[argKey];
    if (!argDef)
      throw new Error("Unknown argument: " + argKey);
    const val = args[i + 1];
    if (val === undefined)
      throw new Error("Missing value for argument: " + argKey);
    vals[argKey] = parseVal(val, argDef);

    i += 2;
  }

  // Check for unspecified mandatory arguments.
  for (let argKey of Object.keys(argDefs)) {
    const argDef = argDefs[argKey];
    if (argDef.mandatory && !(argKey in vals))
      throw new Error("Mandatory argument unspecified: " + argKey);
  }

  // Prepare final arguments map.
  const result = {};
  for (let argKey of Object.keys(vals)) {
    const argName = argDefs[argKey].name;
    result[argName] = vals[argKey];
  }

  return Object.freeze(result);
}

const args = parseArgs(arguments, argDefs);
const FALSE_RATE = 0.0001;
const SIZE_INC_STEP_BLOCKS = 1024;  // 4kB
const withFreqPattern = /\"(.+)\"\t(\d+)/i;

function linesIntoBloomFilter(lines) {
  let [size, nHashes] = calculateFilterProperties(lines.length, FALSE_RATE);
  print("BloomFilter optimal parameters: " + [size, nHashes]);
  if ((args.explicitSize !== undefined) &&
      (args.explicitHashes !== undefined)) {
    size = args.explicitSize;
    nHashes = args.explicitHashes;
    print("Explicit parameters " + [size, nHashes]);
  }
  else {
    size = Math.ceil(size / SIZE_INC_STEP_BLOCKS) * SIZE_INC_STEP_BLOCKS;
    print("Rounded size up to " + size);
  }
  const filter = new BloomFilter(size, nHashes);

  if (!lines.length)
    return filter;

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
        .map((line) => (withFreqPattern.test(line) ? line.match(withFreqPattern)[1] : line))
        .filter((line) => (line.length > 0));
  }
  finally {
    inStream.close();
  }
}

const lines = readTextLines(args.inFileName).slice(0, args.topN);
print("Input lines count: " + lines.length);

let filter = linesIntoBloomFilter(lines);
print("Filled filter.")

const outFile = FileUtils.getFile("XCurProcD", args.outFileName.split("/"));
print("Saving filter data into: " + outFile.path);
BloomFilterUtils.saveToFile(filter, args.dbVersion, outFile);

print("Successfully saved filter data!");

print("Checking...");
let [testFilter, testVersion] = BloomFilterUtils.loadFromFile(outFile);
print("===========");
if (args.dbVersion != testVersion)
  print("Versions don't match", args.dbVersion, testVersion);
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
