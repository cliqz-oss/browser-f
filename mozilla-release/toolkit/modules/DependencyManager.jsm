/* global ChromeUtils */
"use strict";

const EXPORTED_SYMBOLS = ["DependencyManager"];

const deps = {};
var DependencyManager = {
  get: function(depName, depPath) {
    if (Object(deps[depPath]) === deps[depPath] && deps[depPath][depName] != null) {
      return deps[depPath][depName];
    }

    let dependency;
    try {
      dependency = ChromeUtils.import(depPath, {});
    } catch (e) {
      throw new Error(`DependencyManager#get: can not find dependency at ${depPath}`);
    }

    return this.inject(depName, depPath, dependency[depName]);
  },
  inject: function(depName, depPath, depValue) {
    if (depValue == null) {
      throw new Error(`DependencyManager#inject:
        can not import ${depName} from ${depPath} as a dependency (${depValue} is not allowed)`);
    }

    if (deps[depPath] == null) {
      deps[depPath] = {};
    }

    deps[depPath][depName] = depValue;
    return depValue;
  }
};
