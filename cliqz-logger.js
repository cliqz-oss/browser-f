// First two arguments represent absolute path to node executable itself and
// to cliqz-logger.js file.
// So we are interested in arguments from the 3rd one;
const inputArgs = Array.prototype.slice.call(process.argv, 2);

const writeToConsole = function() {
  let messages = Array.prototype.slice.call(arguments);
  console.log('**********************************************');
  console.log.apply(console, messages);
  console.log('**********************************************');
};

const os = require('os');
const EOL = os.EOL;
const PWD = process.cwd();
const UNIX_PLATFORM = EOL === '\n';

// If there are no arguments then inform the user how to run the commands.
if (!inputArgs.length) {
  writeToConsole(
    `${EOL}Use: node ${process.argv[1]} [--clear] --config <json-config-path>`,
    `${EOL}Terminated.${EOL}`
  );
  process.exit();
  return;
}

const LOGGER_VAR_NAME_PATTERN = '__L_V__';
// EOL - optional;
// /*LS-<random number A>*/<greedy matched sources>/*LE-<random number A>*/
// EOL - optional;
const IMPORT_PATTERN = new RegExp(
  `(?:${EOL})?\\/\\*LS-\\d+\\*\\/(?:.|\\s)*?\\/\\*LE-\\d+\\*\\/(?:${EOL})?`);
// EOL
// __L_V__12("3466", "win != maybeAnotherWin");'__L_V__12';
// EOL
const LOG_FUNCTION_CALL_PATTERN = new RegExp(
  `${EOL}${LOGGER_VAR_NAME_PATTERN}\\d+\\((?:.|\\s)*?\\);'${LOGGER_VAR_NAME_PATTERN}\\d+';`);
const fs = require('fs');
const systemPath = require('path');

////////////////////////////////////////////////////////////////////
// Main method is the starting point.
// It recieves inputArgs as the only argument.
const main = function(inputArgs) {
  let i = 0;
  // Initial state is 'INJECT' meaning we want to log by default;
  let state = 'INJECT';
  // Since we have not gotten any config file path yet
  // let it be empty string by default;
  let configPath = '';

  // Default name for logging provider module.
  // The module should be responsible for what to do with actual logs.
  // It also has to implement 'init' method which recieves the only
  // argument as a path to the whole module being logged.
  // The name will be injected into sources on the first line and then
  // the next line will call its' 'init' method.
  let loggerName = 'CliqzLogger';
  // Default path for logging provider.
  let loggerPath = 'resource://gre/modules/CliqzLogger.jsm';
  // Places is an array of file paths which we want to log.
  // Each path is appended to PWD directory path and read afterwards.
  // So please fill in places with paths relative to PWD in your system;
  let places = [];
  // importAs tells how to import a logging provider.
  // There might be 2 values: 'browser' and 'es6';
  // The former is default one and says to import using ChromeUtils;
  // When the second one is used then a logging provider is imported as an
  // EcmaScript6 module using 'import' directive;
  let importAs = 'browser'; // possible values: browser, es6;

  while(inputArgs[i] != null) {
    if (inputArgs[i] == '--clear') {
      state = 'CLEAR';
    } else if (inputArgs[i] == '--config') {
      // --config option requires a file path afterwards.
      // If there is not any then we show the error and terminate;
      if (inputArgs[i + 1] == null) {
        writeToConsole(
          `${EOL}Use: node ${process.argv[1]} [--clear] --config <json-config-path>`,
          `${EOL}${inputArgs[i + 1]} is not defined.`,
          `${EOL}Terminated.${EOL}`
        );
        process.exit();
        return;
      }

      // Otherwise we can replace our default config path value with a custom one.
      configPath = inputArgs[i + 1];
    } else {
      // Places also can be augmented through the command line terminal;
      places.push(inputArgs[i]);
    }

    i += 1;
  }

  new Promise(function(resolve, reject) {
    // If --config option was provided then we read the data from
    // the config path 'configPath';
    // That config file is supposed to be a json file with 4 fields in it.
    // Every field is optional. Those fields are described below;
    if (configPath) {
      configPath = systemPath.resolve(PWD, configPath);
      readDataFromPath(configPath, function(error, buffer) {
        // In case some error arised while reading we notify about it and reject;
        if (error != null) {
          const message = `${EOL}Some error happened while reading the path '${configPath}'${EOL}` +
            `${error}${EOL}`;

          return reject({message: message});
        }

        try {
          // JSON file might be corrupted or just invalid;
          // Also reject in such cases and notify about that;
          buffer = JSON.parse(buffer.join(''));
        } catch (e) {
          const message = `${EOL}${configPath} expected to be a valid json file.${EOL}` +
            `${e}${EOL}`

          return reject({message: message});
        }

        // Replace default values with ones read from the config above;
        // Since all fields in the config are optional we use default value
        // in case the config lacks its' own.
        loggerPath = buffer.loggerPath || loggerPath;
        // <logger-name> to import for environment, should implement 'init' method
        loggerName = buffer.loggerName || loggerName;
        // [<file-path1>, <file-path2>, ... ,<file-pathN>]
        places = Array.isArray(buffer.places) ? buffer.places : places;
        // browser, es6;
        importAs = buffer.importAs || importAs;

        // Successfully read and resolve the promise;
        resolve({
          loggerPath: loggerPath,
          loggerName: loggerName,
          places: places,
          importAs: importAs,
          state: state
        });
      });
    } else {
      resolve({
        loggerPath: loggerPath,
        loggerName: loggerName,
        places: places,
        importAs: importAs,
        state: state
      });
    }
  }).then(function(config) {
    const logFunctionAction = state == 'INJECT' ? injectLogFunction : clearLogFunction;

    for (let i = 0, l = config.places.length; i < l; i++) {
      let path = config.places[i];
      let loggerVarName = `${LOGGER_VAR_NAME_PATTERN}${i}`;

      // Depending on a state above we run a proper action;
      // Either cover sources with logs or remove them;
      logFunctionAction(path, config, loggerVarName);
    }
  }, function(error) {
    // The promise above was rejected so we need to handle it here;
    // And then terminate;
    writeToConsole(error.message);
    process.exit();
  });
};

// This function is responsible for clearing the logs been added by
// the function 'injectLogFunction' previously;
const clearLogFunction = function(path) {
  // Since this script should be cross-platform (UNIX, Windows OS)
  // we have to make sure a path to a file is a platform compliant;
  // That's what nodejs module 'path' does for us here;
  // Note that the path is appended to the PWD path;
  const resolvedPath = systemPath.resolve(PWD, path);
  readDataFromPath(resolvedPath, function(error, buffer) {
    if (error != null) {
      writeToConsole(
        `${EOL}Some error happened while reading the path '${resolvedPath}'`,
        `${EOL}${error}${EOL}`
      );

      return;
    }

    let source = buffer.join('');
    // First we want to remove the part with an import of logging provider;
    // For that we split by the pattern described above (see the comments before it);
    // Then a use of join helps us to remove that import peace of code;
    // We do the same for every single place in source where a log function is triggered;
    // Join eventually removes those log function calls;
    source = source.split(IMPORT_PATTERN).join('')
      .split(LOG_FUNCTION_CALL_PATTERN).join('');

    // Write data back to the resolvedPath;
    writeDataToPath(resolvedPath, source);
  });
};

// This function is responsible for importing a logging provider in the beggiging of the file;
const injectLogger = function(buffer, config, path, pathObject, loggerVarName) {
  // We generate a random number to avoid potential collisions between similar comment blocks;
  const randomNumber = Math.ceil(Math.random() * (1000000));
  // importAs tells us which syntax to use for import the logging provider (browser, es6)
  const importAs = config.importAs;

  if (importAs == 'browser') {
    // For browser native compliant import we use ChromeUtils.import;
    // Here is an example of how the import might look like;
    // EOL/*LS-12345*/var { MyDefaultLogger } = ChromeUtils.import("resource://gre/modules/CliqzLogger.jsm");EOL
    // var __L_V__12 = MyDefaultLogger.init("<some-file-path>","<some-file-name>");/*LE-12345*/EOL
    buffer.unshift(
      `${EOL}/*LS-${randomNumber}*/` +
      `var { ${config.loggerName} } = ChromeUtils.import(` +
        `'${config.loggerPath}'` +
      `);${EOL}`,
      `var ${loggerVarName} = ${config.loggerName}.init('${path}','${pathObject.name}');` +
      `/*LE-${randomNumber}*/${EOL}`
    );
  } else if (importAs == 'es6') {
    // For EcmaScript6 compliant version we use its' standard import;
    // Here is an example of how the import might look like;
    // EOL/*LS-12345*/import { MyDefaultLogger } from "resource://gre/modules/CliqzLogger.jsm";EOL
    // var __L_V__12 = MyDefaultLogger.init("<some-file-path>","<some-file-name>");/*LE-12345*/EOL
    buffer.unshift(
      `${EOL}/*LS-${randomNumber}*/` +
      `import { ${config.loggerName} } from '${config.loggerPath}';${EOL}`,
      `var ${loggerVarName} = ${config.loggerName}.init('${path}','${pathObject.name}');` +
      `/*LE-${randomNumber}*/${EOL}`
    );
  }
};

const injectLoggerVarCall = function(loggerVarCallParams) {
  const loggerVarName = loggerVarCallParams.loggerVarName;

  let execTokens = '{}';
  let predicate = loggerVarCallParams.predicate;

  const lineNumber = loggerVarCallParams.lineNumber;
  const tokenType = loggerVarCallParams.tokenType;
  const funcName = loggerVarCallParams.funcName != null ?
    loggerVarCallParams.funcName : ''

  if (tokenType == 'func' && predicate) {
    // predicate might have a form of hash as well;
    // {a: b, c: d}
    // In that case we also need to split every comma-separated
    // pair by colon to pick up a value rather than a key.
    let args = predicate.split(',');
    const regexp = /\w+/i;

    const hash = ['{'];
    args.forEach(function(arg) {
      const argValue = arg.split(':');
      if (argValue.length > 1) {
        arg = argValue[argValue.length - 1];
      }

      const r = arg.match(regexp);
      if (r != null) {
        hash.push(`'${r[0]}'` + ':' + r[0]);
        hash.push(',');
      }
    });
    hash[hash.length-1] = '}';

    execTokens = hash.join('');
    predicate = '';
  }

  const params = `{
    lN: ${lineNumber},tT:'${tokenType}',pr:'${predicate}',eT:${execTokens},fN:'${funcName}'
  }`;

  return `${EOL}${loggerVarName}(${params});'${loggerVarName}';`;
};

// This function is responsible for injecting log function invocations into the path;
const injectLogFunction = function(path, config, loggerVarName) {
  // First let it resolve path to make it cross-platform;
  const resolvedPath = systemPath.resolve(PWD, path);
  readDataFromPath(resolvedPath, function(error, buffer) {
    if (error != null) {
      writeToConsole(
        `${EOL}Some error happened while reading the path '${resolvedPath}'`,
        `${EOL}${error}${EOL}`
      );

      return;
    }

    // We parse the path with nodejs systemPath to retrieve the name out of it;
    const pathObject = systemPath.parse(path);
    // Import a logging provider module;
    injectLogger(buffer, config, path, pathObject, loggerVarName);

    let source = buffer.join('');
    let data = findTokenDefinitions(source);
    setLineNumbers(data, source);

    source = source.split('');
    for (let i = 0, l = data.length; i < l; i++) {
      const predicate = data[i].predicate;
      const lineNumber = data[i].lineNumber;
      const tokenType = data[i].tokenType;

      const loggerVarCallParams = {
        lineNumber: lineNumber,
        tokenType: tokenType,
        predicate: predicate,
        loggerVarName: loggerVarName
      };

      if (tokenType === 'if') {
        // Inject right after an opening curly brace for if-clause;
        const curly = source[data[i].startsAt];

        source[data[i].startsAt] = curly + injectLoggerVarCall(loggerVarCallParams);
      } else if (tokenType === 'switch') {
        // Inject right before "switch" clause token starts;
        let item = source[data[i].startsAt - 1];
        if (item == null) {
          item = '';
          source.unshift(item);
        }

        loggerVarCallParams.predicate = '';
        source[data[i].startsAt - 1] = item + injectLoggerVarCall(loggerVarCallParams);
      } else if (tokenType === 'func') {
        const curly = source[data[i].startsAt];

        loggerVarCallParams.funcName = data[i].funcName;
        source[data[i].startsAt] = curly + injectLoggerVarCall(loggerVarCallParams);
      }
    }
    source = source.join('');
    // After injection is completed we write sources back to resolvedPath;
    writeDataToPath(resolvedPath, source);
  });
};

const readDataFromPath = function(path, cb) {
  let buffer = [];
  let streamReader = fs.createReadStream(path, {
    encoding: 'utf8',
    autoClose: true
  });
  streamReader.on('data', function(chunk) {
    buffer.push(chunk);
  });
  streamReader.on('end', function() {
    cb(null, buffer);
  });
  streamReader.on('error', cb);
};

const writeDataToPath = function(path, source) {
  const streamWriter = fs.createWriteStream(path, {
    flags: 'w',
    encoding: 'utf8',
    autoClose: true
  });
  streamWriter.write(source, function(error) {
    if (error != null) {
      writeToConsole(
        `${EOL}Some error happened while writing to the path '${path}'${EOL}`,
        `${error}${EOL}`
      );
      return;
    }

    writeToConsole(
      `${EOL}Successfully modified the file '${path}'${EOL}`
    );
  });
  streamWriter.on('error', function(error) {
    writeToConsole(
      `${EOL}Some error happened while writing to the path '${path}'${EOL}`,
      `${error}${EOL}`
    );
  });
};

const skipBlanks = function(str, pointer) {
  str = typeof str == 'string' ? str : '';
  let nextChar = str.charAt(pointer);

  while (/\s/.test(nextChar)) {
    pointer += 1;
    nextChar = str.charAt(pointer);
  }

  return pointer;
}

const findTokenDefinitions = function(str, pointer) {
  str = typeof str == 'string' ? str : '';
  pointer = pointer == null ? 0 : pointer;

  const regexp = /(?<!class|extends|implements)\s+(\w+)\s*?\(/ig;
  const matches = [];

  let result = null;
  while ((result = regexp.exec(str)) !== null) {
    if (result[1] === 'for' || result[1] === 'while' || result[1] === 'catch') {
      continue;
    }

    let openParens = 1;
    let predicate = [];

    let pointer = result.index + result[0].length - 1;
    let nextChar = str.charAt(pointer); // we will start with "(";

    while (nextChar) {
      pointer += 1;
      nextChar = str.charAt(pointer);

      if (nextChar == ')') {
        if (openParens === 1) {
          break;
        }

        predicate.push(')');
        openParens -= 1;
      } else if (nextChar == '(') {
        openParens += 1;
        predicate.push('(');
      } else if (nextChar != EOL && nextChar != '\n' && nextChar != '"' && nextChar != '\'') {
        if (nextChar === ' ') {
          if (predicate[predicate.length - 1] !== nextChar) {
            predicate.push(nextChar);
          }
        } else {
          predicate.push(nextChar);
        }
      }
    }

    pointer = skipBlanks(str, pointer + 1);
    nextChar = str.charAt(pointer);

    if (nextChar != '{') {
      continue;
    }

    let tokenType = '';
    if (result[1] === 'if') {
      tokenType = 'if';
    } else if (result[1] === 'switch') {
      pointer = result.index;
      tokenType = 'switch';
    } else {
      tokenType = 'func';
    }

    matches.push({
      startsAt: pointer,
      pointer: pointer + 1,
      funcName: result[1],
      tokenType: tokenType,
      predicate: predicate.join('')
    });
  }

  return matches;
};

const setLineNumbers = function(matches, str) {
  matches = Array.isArray(matches) ? matches : [];

  let lineNumber = 1;
  let linePointer = 0;

  for (let i = 0, l = matches.length; i < l; i++) {
    let pointer = matches[i].pointer;

    while (linePointer < pointer) {
      if (UNIX_PLATFORM && str[linePointer] == EOL) {
        lineNumber += 1;
      } else if (str[linePointer] == '\n') {
        lineNumber += 1;
      }
      linePointer += 1;
    }

    matches[i].lineNumber = lineNumber;
  }
};
////////////////////////////////////////////////////////////////////
main(inputArgs);
