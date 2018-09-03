"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getScope = getScope;

var _devtoolsReps = require("devtools/client/shared/components/reps/reps.js");

var _getVariables = require("./getVariables");

var _utils = require("./utils");

var _frames = require("../../pause/frames/index");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function getScopeTitle(type, scope) {
  if (type === "block" && scope.block && scope.block.displayName) {
    return scope.block.displayName;
  }

  if (type === "function" && scope.function) {
    return scope.function.displayName ? (0, _frames.simplifyDisplayName)(scope.function.displayName) : L10N.getStr("anonymous");
  }

  return L10N.getStr("scopes.block");
}

function getScope(scope, selectedFrame, frameScopes, why, scopeIndex) {
  const {
    type,
    actor
  } = scope;
  const isLocalScope = scope.actor === frameScopes.actor;
  const key = `${actor}-${scopeIndex}`;

  if (type === "function" || type === "block") {
    const bindings = scope.bindings;
    let vars = (0, _getVariables.getBindingVariables)(bindings, key); // show exception, return, and this variables in innermost scope

    if (isLocalScope) {
      vars = vars.concat((0, _utils.getFramePopVariables)(why, key));
      let thisDesc_ = selectedFrame.this;

      if ("this" in bindings) {
        // The presence of "this" means we're rendering a "this" binding
        // generated from mapScopes and this can override the binding
        // provided by the current frame.
        thisDesc_ = bindings.this ? bindings.this.value : null;
      }

      const this_ = (0, _utils.getThisVariable)(thisDesc_, key);

      if (this_) {
        vars.push(this_);
      }
    }

    if (vars && vars.length) {
      const title = getScopeTitle(type, scope);
      vars.sort((a, b) => a.name.localeCompare(b.name));
      return {
        name: title,
        path: key,
        contents: vars,
        type: _devtoolsReps.ObjectInspectorUtils.node.NODE_TYPES.BLOCK
      };
    }
  } else if (type === "object" && scope.object) {
    let value = scope.object; // If this is the global window scope, mark it as such so that it will
    // preview Window: Global instead of Window: Window

    if (value.class === "Window") {
      value = _objectSpread({}, scope.object, {
        displayClass: "Global"
      });
    }

    return {
      name: scope.object.class,
      path: key,
      contents: {
        value
      }
    };
  }

  return null;
}