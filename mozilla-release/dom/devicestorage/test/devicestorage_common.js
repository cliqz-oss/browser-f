/**
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

var oldVal = false;
  
Object.defineProperty(Array.prototype, "remove", {
  enumerable: false,
  configurable: false,
  writable: false,
  value: function(from, to) {
    // Array Remove - By John Resig (MIT Licensed)
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
  }
});

function devicestorage_setup() {

  // ensure that the directory we are writing into is empty
  try {
    const Cc = SpecialPowers.Cc;
    const Ci = SpecialPowers.Ci;
    var directoryService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var f = directoryService.get("TmpD", Ci.nsIFile);
    f.appendRelativePath("device-storage-testing");
    f.remove(true);
  } catch(e) {}

  SimpleTest.waitForExplicitFinish();
  if (SpecialPowers.isMainProcess()) {
    try {
      oldVal = SpecialPowers.getBoolPref("device.storage.enabled");
    } catch(e) {}
    SpecialPowers.setBoolPref("device.storage.enabled", true);
    SpecialPowers.setBoolPref("device.storage.testing", true);
    SpecialPowers.setBoolPref("device.storage.prompt.testing", true);
  }
}

function devicestorage_cleanup() {
  if (SpecialPowers.isMainProcess()) {
    SpecialPowers.setBoolPref("device.storage.enabled", oldVal);
    SpecialPowers.setBoolPref("device.storage.testing", false);
    SpecialPowers.setBoolPref("device.storage.prompt.testing", false);
  }
  SimpleTest.finish();
}

function getRandomBuffer() {
  var size = 1024;
  var buffer = new ArrayBuffer(size);
  var view = new Uint8Array(buffer);
  for (var i = 0; i < size; i++) {
    view[i] = parseInt(Math.random() * 255);
  }
  return buffer;
}

function createRandomBlob(mime) {
  return blob = new Blob([getRandomBuffer()], {type: mime});
}

function randomFilename(l) {
  var set = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZ";
  var result = "";
  for (var i=0; i<l; i++) {
    var r = Math.floor(set.length * Math.random());
    result += set.substring(r, r + 1);
  }
  return result;
}

function reportErrorAndQuit(e) {
  ok(false, "handleError was called : " + e.target.error.name);
  devicestorage_cleanup();
}

function createTestFiles(storage, paths) {
  function createTestFile(path) {
    return new Promise(function(resolve, reject) {
      function addNamed() {
        var req = storage.addNamed(createRandomBlob("image/png"), path);

        req.onsuccess = function() {
          ok(true, path + " was created.");
          resolve();
        };

        req.onerror = function(e) {
          ok(false, "Failed to create " + path + ': ' + e.target.error.name);
          reject();
        };
      }

      // Bug 980136. Check if the file exists before we create.
      var req = storage.get(path);

      req.onsuccess = function() {
        ok(true, path + " exists. Do not need to create.");
        resolve();
      };

      req.onerror = function(e) {
        ok(true, path + " does not exists: " + e.target.error.name);
        addNamed();
      };
    });
  }

  var arr = [];

  paths.forEach(function(path) {
    arr.push(createTestFile(path));
  });

  return Promise.all(arr);
}
