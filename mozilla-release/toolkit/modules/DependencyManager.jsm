/* global ChromeUtils */
"use strict";

const EXPORTED_SYMBOLS = ["DependencyManager"];

const deps = {};
var DependencyManager = {
  get: function(depName, depPath) {
    if (Object(deps[depPath]) === deps[depPath] && deps[depPath][depName] != null) {
      return deps[depPath][depName];
    }

    let depValue;
    try {
      depValue = ChromeUtils.import(depPath, {})[depName];
    } catch (e) {
      throw new Error(`DependencyManager#get: can not find module at ${depPath}`);
    }

    return this.inject(depName, depPath, depValue);
  },
  inject: function(depName, depPath, depValue) {
    if (depValue == null) {
      throw new Error(`DependencyManager#inject:
        can not set ${depValue} as a dependency (null and undefined are not allowed)`);
    }

    if (deps[depPath] == null) {
      deps[depPath] = {};
    }

    deps[depPath][depName] = depValue;
    return depValue;
  }
};
