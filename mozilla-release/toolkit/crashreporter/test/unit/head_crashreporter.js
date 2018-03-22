var {utils: Cu, classes: Cc, interfaces: Ci} = Components;

Cu.import("resource://gre/modules/osfile.jsm");
Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://testing-common/AppData.jsm", this);
Cu.import("resource://gre/modules/AppConstants.jsm");

function getEventDir() {
  return OS.Path.join(do_get_tempdir().path, "crash-events");
}

/*
 * Run an xpcshell subprocess and crash it.
 *
 * @param setup
 *        A string of JavaScript code to execute in the subprocess
 *        before crashing. If this is a function and not a string,
 *        it will have .toSource() called on it, and turned into
 *        a call to itself. (for programmer convenience)
 *        This code will be evaluted between crasher_subprocess_head.js
 *        and crasher_subprocess_tail.js, so it will have access
 *        to everything defined in crasher_subprocess_head.js,
 *        which includes "crashReporter", a variable holding
 *        the crash reporter service.
 *
 * @param callback
 *        A JavaScript function to be called after the subprocess
 *        crashes. It will be passed (minidump, extra, extrafile), where
 *         - minidump is an nsIFile of the minidump file produced,
 *         - extra is an object containing the key,value pairs from
 *           the .extra file.
 *         - extrafile is an nsIFile of the extra file
 *
 * @param canReturnZero
 *       If true, the subprocess may return with a zero exit code.
 *       Certain types of crashes may not cause the process to
 *       exit with an error.
 *
 */
function do_crash(setup, callback, canReturnZero) {
  // get current process filename (xpcshell)
  let bin = Services.dirsvc.get("XREExeF", Components.interfaces.nsIFile);
  if (!bin.exists()) {
    // weird, can't find xpcshell binary?
    do_throw("Can't find xpcshell binary!");
  }
  // get Gre dir (GreD)
  let greD = Services.dirsvc.get("GreD", Components.interfaces.nsIFile);
  let headfile = do_get_file("crasher_subprocess_head.js");
  let tailfile = do_get_file("crasher_subprocess_tail.js");
  // run xpcshell -g GreD -f head -e "some setup code" -f tail
  let process = Components.classes["@mozilla.org/process/util;1"]
                  .createInstance(Components.interfaces.nsIProcess);
  process.init(bin);
  let args = ["-g", greD.path,
              "-f", headfile.path];
  if (setup) {
    if (typeof(setup) == "function")
      // funky, but convenient
      setup = "(" + setup.toSource() + ")();";
    args.push("-e", setup);
  }
  args.push("-f", tailfile.path);

  let env = Components.classes["@mozilla.org/process/environment;1"]
                              .getService(Components.interfaces.nsIEnvironment);

  let crashD = do_get_tempdir();
  crashD.append("crash-events");
  if (!crashD.exists()) {
    crashD.create(crashD.DIRECTORY_TYPE, 0o700);
  }

  env.set("CRASHES_EVENTS_DIR", crashD.path);

  try {
      process.run(true, args, args.length);
  } catch (ex) {
    // on Windows we exit with a -1 status when crashing.
  } finally {
    env.set("CRASHES_EVENTS_DIR", "");
  }

  if (!canReturnZero) {
    // should exit with an error (should have crashed)
    Assert.notEqual(process.exitValue, 0);
  }

  handleMinidump(callback);
}

function getMinidump() {
  let en = do_get_tempdir().directoryEntries;
  while (en.hasMoreElements()) {
    let f = en.getNext().QueryInterface(Components.interfaces.nsIFile);
    if (f.leafName.substr(-4) == ".dmp") {
      return f;
    }
  }

  return null;
}

function runMinidumpAnalyzer(dumpFile, additionalArgs) {
  if (AppConstants.platform !== "win") {
    return;
  }

  // find minidump-analyzer executable.
  let bin = Services.dirsvc.get("XREExeF", Ci.nsIFile);
  ok(bin && bin.exists());
  bin = bin.parent;
  ok(bin && bin.exists());
  bin.append("minidump-analyzer.exe");
  ok(bin.exists());

  let process = Cc["@mozilla.org/process/util;1"]
                  .createInstance(Ci.nsIProcess);
  process.init(bin);
  let args = [];
  if (additionalArgs) {
    args = args.concat(additionalArgs);
  }
  args.push(dumpFile.path);
  process.run(true /* blocking */, args, args.length);
}

function handleMinidump(callback) {
  // find minidump
  let minidump = getMinidump();

  if (minidump == null) {
    do_throw("No minidump found!");
  }

  let extrafile = minidump.clone();
  extrafile.leafName = extrafile.leafName.slice(0, -4) + ".extra";

  let memoryfile = minidump.clone();
  memoryfile.leafName = memoryfile.leafName.slice(0, -4) + ".memory.json.gz";

  // Just in case, don't let these files linger.
  registerCleanupFunction(function() {
    if (minidump.exists()) {
      minidump.remove(false);
    }
    if (extrafile.exists()) {
      extrafile.remove(false);
    }
    if (memoryfile.exists()) {
      memoryfile.remove(false);
    }
  });

  Assert.ok(extrafile.exists());
  let extra = parseKeyValuePairsFromFile(extrafile);

  if (callback) {
    callback(minidump, extra, extrafile);
  }

  if (minidump.exists()) {
    minidump.remove(false);
  }
  if (extrafile.exists()) {
    extrafile.remove(false);
  }
  if (memoryfile.exists()) {
    memoryfile.remove(false);
  }
}

/**
 * Helper for testing a content process crash.
 *
 * This variant accepts a setup function which runs in the content process
 * to set data as needed _before_ the crash.  The tail file triggers a generic
 * crash after setup.
 */
function do_content_crash(setup, callback) {
  do_load_child_test_harness();
  do_test_pending();

  // Setting the minidump path won't work in the child, so we need to do
  // that here.
  let crashReporter =
      Components.classes["@mozilla.org/toolkit/crash-reporter;1"]
                .getService(Components.interfaces.nsICrashReporter);
  crashReporter.minidumpPath = do_get_tempdir();

  /* import-globals-from ../unit/crasher_subprocess_head.js */
  /* import-globals-from ../unit/crasher_subprocess_tail.js */

  let headfile = do_get_file("../unit/crasher_subprocess_head.js");
  let tailfile = do_get_file("../unit/crasher_subprocess_tail.js");
  if (setup) {
    if (typeof(setup) == "function") {
      // funky, but convenient
      setup = "(" + setup.toSource() + ")();";
    }
  }

  let handleCrash = function() {
    let id = getMinidump().leafName.slice(0, -4);
    Services.crashmanager.ensureCrashIsPresent(id).then(() => {
      try {
        handleMinidump(callback);
      } catch (x) {
        do_report_unexpected_exception(x);
      }
      do_test_finished();
    });
  };

  do_get_profile();
  makeFakeAppDir().then(() => {
    sendCommand("load(\"" + headfile.path.replace(/\\/g, "/") + "\");", () =>
      sendCommand(setup, () =>
        sendCommand("load(\"" + tailfile.path.replace(/\\/g, "/") + "\");", () =>
          executeSoon(handleCrash)
        )
      )
    );
  });
}

/**
 * Helper for testing a content process crash.
 *
 * This variant accepts a trigger function which runs in the content process
 * and does something to _trigger_ the crash.
 */
function do_triggered_content_crash(trigger, callback) {
  do_load_child_test_harness();
  do_test_pending();

  // Setting the minidump path won't work in the child, so we need to do
  // that here.
  let crashReporter =
      Components.classes["@mozilla.org/toolkit/crash-reporter;1"]
                .getService(Components.interfaces.nsICrashReporter);
  crashReporter.minidumpPath = do_get_tempdir();

  /* import-globals-from ../unit/crasher_subprocess_head.js */

  let headfile = do_get_file("../unit/crasher_subprocess_head.js");
  if (trigger) {
    if (typeof(trigger) == "function") {
      // funky, but convenient
      trigger = "(" + trigger.toSource() + ")();";
    }
  }

  let handleCrash = function() {
    let id = getMinidump().leafName.slice(0, -4);
    Services.crashmanager.ensureCrashIsPresent(id).then(() => {
      try {
        handleMinidump(callback);
      } catch (x) {
        do_report_unexpected_exception(x);
      }
      do_test_finished();
    });
  };

  do_get_profile();
  makeFakeAppDir().then(() => {
    sendCommand("load(\"" + headfile.path.replace(/\\/g, "/") + "\");", () =>
      sendCommand(trigger, () =>
        executeSoon(handleCrash)
      )
    );
  });
}

// Import binary APIs via js-ctypes.
Components.utils.import("resource://test/CrashTestUtils.jsm");
Components.utils.import("resource://gre/modules/KeyValueParser.jsm");
