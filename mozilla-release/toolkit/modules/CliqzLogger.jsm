/* global ChromeUtils */
"use strict";

var { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
);
var { AsyncShutdown } = ChromeUtils.import(
  "resource://gre/modules/AsyncShutdown.jsm"
);
var { setTimeout, clearTimeout } = ChromeUtils.import(
  "resource://gre/modules/Timer.jsm"
);
var { FileUtils } = ChromeUtils.import(
  "resource://gre/modules/FileUtils.jsm"
);

const EXPORTED_SYMBOLS = ["CliqzLogger"];

const CliqzLogger = (function() {
  // 0 - do not log any information;
  // 1 - display it on a screen;
  // 2 - write down to the file;
  const LEVEL_PREF = "app.log.enabled.level";
  const IGNORED_MODULES_PREF = "app.log.enabled.ignored_modules";
  const IGNORED_METHODS_PREF = "app.log.enabled.ignored_methods";
  const EXEC_TOKENS_PREF = "app.log.enabled.exec_tokens";
  const KEY_PROFILE_DIR = "ProfD";
  const MAX_LOG_FILE_SIZE = 25 * 1024 * 1024; // 25MB for each of 2 files;

  const DEBOUNCE_TIMEOUT = 100;
  const SHOULD_NOT_LOG = 0;
  const SHOULD_LOG_TO_CONSOLE = 1;
  const SHOULD_LOG_TO_FILE = 2;

  // Those methods are called to often.
  // So we can prevent from showing them in logs by default.
  // But still it is possible to turn them on later via prefs.
  const DEFAULT_IGNORED_METHODS = [
    "getTabSharingState",
    "getBrowserForTab",
    "isRemoteBrowser",
    "getTabToAdopt",
    "isAdoptingTab",
    "selectedTab",
    "getIcon"
  ];
  // execTokens is a hashTable which has a function arguments at runtime.
  // Use the following example.
  // Let's suppose there is a function foo(numberArgName, stringArgName, objArgName) {...}
  // defined in the browser sources.
  // When the function gets called execTokens will contain the following hash.
  // {"numberArgName": numberArgName, "stringArgName": stringArgName, "objArgName": objArgName}
  //
  // Obtaining this information allows us to apply some rules for those key-value pairs
  // before putting that info to logs.
  // To apply in that case means to write some browser preferences rules in a JSON format.
  // Let's suppose that we want to get "id" property of "objArgName" from the example above.
  // A rule in preferences could look like this.
  // {"objArgName":"id"}
  //
  // collectExecTokens is run for every function log.
  // In our example during "foo" function execution "objArgName" argument will be retrieved and
  // the value of "objArgName.id" invocation will be pushed onto the messages array.
  // If by any reasons "objArgName.id" does not exist on the object then "void 0" will be pushed.
  // Object preferences chaining can be as long as you want since collectExecTokens
  // takes care of properties which might not exist on "objArgName" and no exception will be thrown.
  //
  // To log at runtime argument itself directly (for example, "stringArgName" value) we can use
  // preferences rules as follows (empty string as a value)
  // {"stringArgName":""}
  // In that case the value of "stringArgName" will be pushed onto messages unless the former
  // is not either null or undefined.
  // Otherwise "void 0" will be pushed.
  const collectExecTokens = function(messages, config, execTokens) {
    messages = Array.isArray(messages) ? messages : [];
    config = Object(config) === config ? config : {};
    execTokens = Object(execTokens) === execTokens ? execTokens : {};

    for (const prop in config) {
      if (execTokens[prop] == null) {
        continue;
      }

      const configValue = typeof config[prop] === "string" ? config[prop] : "";
      const rules = configValue !== "" ? configValue.split(".") : [];

      let ctxValue = execTokens[prop];
      let ctxKey = [prop];
      for (let i = 0, l = rules.length; i < l; i++) {
        if (ctxValue != null) {
          ctxValue = ctxValue[rules[i]];
          ctxKey.push(rules[i]);
        } else {
          break;
        }
      }

      ctxValue = ctxValue != null ? ctxValue : "void 0";
      messages.push(`${ctxKey.join(".")}=>${ctxValue.toString()}`);
    }
  };

  const module = {
    _levelPrefObserver: null,
    _ignoredModulesPrefObserver: null,
    _ignoredMethodsPrefObserver: null,
    _execTokensObserver: null,
    _level: null,
    _logFile: null,
    _outStream: null,
    _buffer: null,
    _timerId: null,
    _logFileNames: null,
    _ignoredModules: null,
    _ignoredMethods: null,
    _execTokens: null,

    _getLogFile: function() {
      if (module._logFile != null) {
        return module._logFile;
      }
      module._logFile = FileUtils.getFile(KEY_PROFILE_DIR, [module._logFileNames[0]], true);
      return module._logFile;
    },

    _cancelWritingLogs: function() {
      clearTimeout(module._timerId);
      module._timerId = null;
      module._logFile = null;

      if (module._outStream != null) {
        module._outStream.close();
      }
      module._outStream = null;
    },

    _getOutStream: function() {
      if (module._outStream != null) {
        return module._outStream;
      }

      module._outStream = FileUtils.openFileOutputStream(module._getLogFile(),
        (FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_APPEND));
      return module._outStream;
    },

    _handleWritingLogs: function(messages) {
      const message = messages.join("\r\n") + "\r\n";

      const logFile = module._getLogFile();
      let outStream = module._getOutStream();

      if (!logFile.exists()) {
        module._cancelWritingLogs();
        outStream = module._getOutStream();
      } else if (logFile.fileSize >= MAX_LOG_FILE_SIZE) {
        module._cancelWritingLogs();

        module._logFileNames.unshift(module._logFileNames.pop());
        module._clearLogFile(module._logFileNames[0]);

        outStream = module._getOutStream();
      }

      outStream.write(message, message.length);
    },

    _clearLogFile: function(logFileName) {
      const file = FileUtils.getFile(KEY_PROFILE_DIR, [logFileName], true);
      if (!file.exists()) {
        return;
      }

      const outStream = FileUtils.openFileOutputStream(file);
      outStream.write("", 0);
      outStream.close();
    },

    init: function(modulePath, moduleName) {
      module._level = module._level == null ? SHOULD_NOT_LOG : module._level;
      module._buffer = module._buffer == null ? [] : module._buffer;
      module._logFileNames = module._logFileNames == null ? [
        "cliqz_logging_messages_prev.log",
        "cliqz_logging_messages_next.log"
      ] : module._logFileNames;
      module._ignoredModules = module._ignoredModules == null ? [] : module._ignoredModules;
      module._ignoredMethods = module._ignoredMethods == null ? {} : module._ignoredMethods;
      module._execTokens = module._execTokens == null ? {} : module._execTokens;

      if (module._ignoredMethodsPrefObserver == null) {
        module._ignoredMethodsPrefObserver = {
          observe: function(subject, topic, prefName) {
            const ignoredMethods = Services.prefs.getStringPref(prefName, "").split(",");
            module._ignoredMethods = {};

            ignoredMethods.forEach(function(item) {
              module._ignoredMethods[item] = 1;
            });
          }
        };
        Services.prefs.addObserver(IGNORED_METHODS_PREF, module._ignoredMethodsPrefObserver);
        if (Services.prefs.prefHasUserValue(IGNORED_METHODS_PREF)) {
          module._ignoredMethodsPrefObserver.observe(null, null, IGNORED_METHODS_PREF);
        } else {
          Services.prefs.setStringPref(IGNORED_METHODS_PREF, DEFAULT_IGNORED_METHODS.join(","));
        }
      }
      if (module._ignoredModulesPrefObserver == null) {
        module._ignoredModulesPrefObserver = {
          observe: function(subject, topic, prefName) {
            module._ignoredModules = Services.prefs.getStringPref(prefName, "").split(",");
          }
        };
        Services.prefs.addObserver(IGNORED_MODULES_PREF, module._ignoredModulesPrefObserver);
        if (Services.prefs.prefHasUserValue(IGNORED_MODULES_PREF)) {
          module._ignoredModulesPrefObserver.observe(null, null, IGNORED_MODULES_PREF);
        }
      }
      if (module._levelPrefObserver == null) {
        module._levelPrefObserver = {
          observe: function(subject, topic, prefName) {
            module._level = Services.prefs.getIntPref(prefName, SHOULD_NOT_LOG);
            if (module._level !== SHOULD_LOG_TO_FILE) {
              module._cancelWritingLogs();
            }
          }
        };
        Services.prefs.addObserver(LEVEL_PREF, module._levelPrefObserver);
      }
      if (module._execTokensObserver == null) {
        module._execTokensObserver = {
          observe: function(subject, topic, prefName) {
            try {
              module._execTokens = JSON.parse(
                Services.prefs.getStringPref(prefName, "{}")
              );
            } catch (e) {
              module._execTokens = {};
            }
          }
        };
        Services.prefs.addObserver(EXEC_TOKENS_PREF, module._execTokensObserver);
        if (Services.prefs.prefHasUserValue(EXEC_TOKENS_PREF)) {
          module._execTokensObserver.observe(null, null, EXEC_TOKENS_PREF);
        }
      }

      return function CliqzSaveLog(params) {
        if (params.tT === "switch") {
          // Ignore switch clauses for now.
          return;
        }

        for (let i = 0, l = module._ignoredModules.length; i < l; i++) {
          if (modulePath.indexOf(module._ignoredModules[i]) !== -1) {
            return;
          }
        }

        const messages = [modulePath, params.lN, params.tT];

        if (params.fN) {
          if (module._ignoredMethods[params.fN] != null) {
            return;
          }
          messages.push(params.fN);
          messages.push(Object.keys(params.eT));

          collectExecTokens(messages, module._execTokens, params.eT);
        }

        if (params.pr) {
          messages.push(params.pr);
        }

        if (module._level === SHOULD_LOG_TO_CONSOLE) {
          console.log(messages.join(" | "));
        } else if (module._level === SHOULD_LOG_TO_FILE) {
          module._buffer.push(messages.join(" | "));

          clearTimeout(module._timerId);
          module._timerId = setTimeout(function() {
            let messages = module._buffer.splice(0, module._buffer.length);
            module._handleWritingLogs(messages);
          }, DEBOUNCE_TIMEOUT);
        }
      };
    },
    destroy: function() {
      Services.prefs.removeObserver(LEVEL_PREF, module._levelPrefObserver);
      Services.prefs.removeObserver(IGNORED_MODULES_PREF, module._ignoredModulesPrefObserver);
      Services.prefs.removeObserver(IGNORED_METHODS_PREF, module._ignoredMethodsPrefObserver);
      Services.prefs.removeObserver(EXEC_TOKENS_PREF, module._execTokensObserver);
      module._levelPrefObserver = null;
      module._ignoredModulesPrefObserver = null;
      module._ignoredMethodsPrefObserver = null;
      module._execTokensObserver = null;
      module._level = null;
      module._buffer = null;
      module._logFileNames = null;
      module._ignoredModules = null;
      module._ignoredMethods = null;
      module._execTokens = null;

      module._cancelWritingLogs();
    }
  };

  if (Services.prefs.prefHasUserValue(LEVEL_PREF)) {
    module._level = Services.prefs.getIntPref(LEVEL_PREF);
  } else {
    Services.prefs.setIntPref(LEVEL_PREF, module._level);
  }

  const blockerCondition = function() {
    if (module._level === SHOULD_LOG_TO_FILE && module._buffer != null) {
      module._handleWritingLogs(module._buffer);
      module.destroy();
    }

    AsyncShutdown.profileBeforeChange.removeBlocker(blockerCondition);
  };
  AsyncShutdown.profileBeforeChange != null && AsyncShutdown.profileBeforeChange.addBlocker(
    "CliqzLogger: write to cliqz_logging_messages",
    blockerCondition
  );

  return module;
})();
