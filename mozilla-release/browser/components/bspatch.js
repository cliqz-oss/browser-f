"use strict"
// Copyright Cliqz GmbH, 2015.

// This script is meant to be run from xpcshell.

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

function fail(str) {
  print(str);
  throw new Error(str);
}

function debug(obj, label) {
  if (label !== undefined)
    print(label + ":");
  for (let p in obj) {
    print(p, obj[p]);
  }
  print("");
}

function findFile(fileName) {
  return FileUtils.getFile("XCurProcD", fileName.split("/"));
}

try {

Cu.import("resource://gre/modules/BSPatch.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

if (arguments.length < 3)
  fail("Three arguments expected, but " + arguments.length + " given");

const inFile = findFile(arguments[0]);
const patchFile = findFile(arguments[1]);
const outFile = findFile(arguments[2]);

BSPatchFile(inFile, patchFile, outFile);
print("Done!");
}
catch (e) {
  fail(e);
  fail(e.stack);
}
