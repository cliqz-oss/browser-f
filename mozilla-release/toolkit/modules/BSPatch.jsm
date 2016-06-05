"use strict";
// Copyright Cliqz GmbH, 2015.

this.EXPORTED_SYMBOLS = ["BSPatch", "BSPatchFile"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/FileUtils.jsm");

const ERRORS = {
  WRONG_FORMAT: "Unrecognized filter data format",
  FILE_TOO_BIG: "File is too big",
  BUFF_UNDERFLOW: "Buffer underflow"
};

/**
 * All arguments are nsIFile.
 */
function BSPatchFile(origFile, patchFile, resultFile) {
  const origInStream = readFile(origFile);
  try {
    const patchInStream = readFile(patchFile);
    try {
      const resultFStream = writeFile(resultFile);
      try {
        var resultOutStream = Cc["@mozilla.org/binaryoutputstream;1"]
            .createInstance(Ci.nsIBinaryOutputStream);
        resultOutStream.setOutputStream(resultFStream);
        BSPatch(origInStream, patchInStream, resultOutStream);
      }
      finally {
        resultFStream.close();
      }
    }
    finally {
      patchInStream.close();
    }
  }
  finally {
    origInStream.close();
  }
}

/**
 * @param origInStream {nsIInputStream} original file input stream.
 * @param patchInStream {nsIInputStream} patch file input stream.
 * @param resultOutStream {nsIBinaryOutputStream} resulting file output stream.
 */
function BSPatch(origInStream, patchInStream, resultOutStream) {
  origInStream = makeBinInStream(origInStream);
  patchInStream = makeBinInStream(patchInStream);

  const header = readBSPatchHeader(patchInStream);
  const origBuffer = readStream(origInStream, header.patchedFileLen);
  const patchBuffer = readStream(patchInStream,
      header.controlBlockLen + header.diffBlockLen + header.extraBlockLen);

  // Control block starts right after the header.
  const ctrlBlock = new DataView(patchBuffer, 0, header.controlBlockLen);

  let origPos = 0;
  let diffPos = header.controlBlockLen;
  let extraPos = header.controlBlockLen + header.diffBlockLen;

  for (let ctrl of readPatchTriples(ctrlBlock)) {
    // Add bytes from original to bytes from the diff block.
    if (ctrl.addFromOrig > 0) {
      const patch = new Uint8Array(patchBuffer, diffPos, ctrl.addFromOrig);
      const orig = new Uint8Array(origBuffer, origPos, ctrl.addFromOrig);
      for (let bi = 0; bi < ctrl.addFromOrig; bi++) {
        patch[bi] += orig[bi];
      }
      resultOutStream.writeByteArray(patch, patch.byteLength);
      diffPos += ctrl.addFromOrig;
      origPos += ctrl.addFromOrig;
    }

    // Copy y bytes from the extra block.
    if (ctrl.copyFromExtra > 0) {
      const extra = new Uint8Array(patchBuffer, extraPos, ctrl.copyFromExtra);
      resultOutStream.writeByteArray(extra, extra.byteLength);
      extraPos += ctrl.copyFromExtra;
    }

    // Reposition the pointer to original file by z bytes.
    origPos += ctrl.seekFwd;
  }
}

// PRIVATE

function makeBinInStream(inStream) {
  const binStream = Cc["@mozilla.org/binaryinputstream;1"]
      .createInstance(Ci.nsIBinaryInputStream);
  binStream.setInputStream(inStream);
  return binStream;
}

function readFile(file) {
  let fStream = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream);
  fStream.init(file, FileUtils.MODE_RDONLY, 0, fStream.CLOSE_ON_EOF);
  return fStream;
}

function writeFile(file) {
  var foStream = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
  const openFlags = FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE |
      FileUtils.MODE_TRUNCATE;
  const permFlags = parseInt("0666", 8);
  foStream.init(file, openFlags, permFlags, 0);
  return foStream;
}

const HEAD_SIGN = [0x4d424449, 0x46463130];  // Hex "MBDIFF10"
const CONTROL_TRIPLE_SIZE = 3 * 4;  // Three 4-byte ints

function readBSPatchHeader(patchInStream) {
  for (let i of HEAD_SIGN) {
    if (patchInStream.read32() != i)
      throw new Error(ERRORS.WRONG_FORMAT);
  }
  return {
    patchedFileLen: patchInStream.read32(),
    patchedFileCRC32: patchInStream.read32(),
    resultFileLen: patchInStream.read32(),
    controlBlockLen: patchInStream.read32(),
    diffBlockLen: patchInStream.read32(),
    extraBlockLen: patchInStream.read32(),
  };
}

function readPatchTriples(ctrlBlock) {
  const nTriples = ctrlBlock.byteLength / CONTROL_TRIPLE_SIZE;
  for (let cbi = 0; cbi < nTriples; cbi++ ) {
    yield readPatchTriple(ctrlBlock, cbi);
  }
}

/**
 * @param ctrlBlock {DataView} control block
 * @param index {int} triple index to read
 */
function readPatchTriple(ctrlBlock, index) {
  const offset = index * CONTROL_TRIPLE_SIZE;
  return {
    addFromOrig: ctrlBlock.getUint32(offset),
    copyFromExtra: ctrlBlock.getUint32(offset + 4),
    seekFwd: ctrlBlock.getInt32(offset + 8)
  };
}

function readStream(stream, length) {
  const buffer = new ArrayBuffer(length);
  if (stream.readArrayBuffer(length, buffer) != length)
    throw new Error(ERRORS.BUFF_UNDERFLOW);
  return buffer;
}
