// Copyright Cliqz GmbH, 2016.

// This script is meant to be run from xpcshell.
// It reads input file line by line, puts each line into a BloomFilter, and then
// serializes it into a binary file.
// Arguments:
// -i : Path to input file. MUST BE RELATIVE.
// -o : Path to output file. MUST BE RELATIVE.
// -v : Database version number to write into the binary.
// -n : Take top N domains from the input file.
// -s : Manually set database size. If unspecified, picked automatically.
// -h : Number of hashes to use. If unspecified, picked automatically.
// -t : Test mode. Just check -i file against premade database in -o.

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
  "-i": {type: String,    mandatory: true,  name: "inFileName"},
  "-o": {type: String,    mandatory: true,  name: "outFileName"},
  "-v": {type: Number,    mandatory: true,  name: "dbVersion"},
  "-n": {type: Number,    mandatory: false, name: "topN"},
  "-s": {type: Number,    mandatory: false, name: "explicitSize"},
  "-h": {type: Number,    mandatory: false, name: "explicitHashes"},
  "-t": {type: undefined, mandatory: false, name: "testOnly"},
};

function parseArgs(args, argDefs) {
  function parseVal(val, argDef) {
    if (argDef.type !== undefined && val === undefined)
      throw new Error("Missing value for argument: " + argDef.name);
    switch (argDef.type) {
      case String:
        return String(val);
      case Number: {
        const int = parseInt(val);
        if (isNaN(int))
          throw new Error("Could not parse integer from: " + val);
        return int;
      }
      case undefined:
        return true;  // Just a flag argument.
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

    const hasValPart = argDef.type != undefined;
    vals[argKey] = parseVal(hasValPart ? args[i + 1] : undefined, argDef);

    i += hasValPart ? 2 : 1;
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

const outFile = FileUtils.getFile("XCurProcD", args.outFileName.split("/"));
const lines = readTextLines(args.inFileName).slice(0, args.topN);
print("Input lines count: " + lines.length);

if (!args.testOnly) {
  let filter = linesIntoBloomFilter(lines);
  print("Filled filter.")

  print("Saving filter data into: " + outFile.path);
  BloomFilterUtils.saveToFile(filter, args.dbVersion, outFile);
  print("Successfully saved filter data!");
}

print("Checking...");

let testFilter, testVersion;
if (outFile.exists() && outFile.isFile()) {
  let stream = FileUtils.openFileInputStream(outFile);
  if (stream) {
    try {
      [testFilter, testVersion] = BloomFilterUtils.loadFromStream(stream);
    }
    finally {
      stream.close();
    }
  }
}

if (args.dbVersion != testVersion) {
  print("Expected and actual version numbers don't match",
      args.dbVersion, testVersion);
}
let ok = true;
let foundCount = 0;
let notFound = [];
for (let line of lines) {
  const check = testFilter.test(line);
  if (check)
    foundCount++;
  if (!check)
    notFound.push(line);
}
print("Matches: " + foundCount + " of " + lines.length + ". Lines not found:");
notFound.forEach(v => print(v));

}
catch (e) {
  fail(e);
}
