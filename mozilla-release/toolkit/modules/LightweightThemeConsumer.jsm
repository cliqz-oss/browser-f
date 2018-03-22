/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["LightweightThemeConsumer"];

const {utils: Cu, interfaces: Ci, classes: Cc} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "LightweightThemeImageOptimizer",
  "resource://gre/modules/addons/LightweightThemeImageOptimizer.jsm");

const kCSSVarsMap = new Map([
  ["--lwt-background-alignment", "backgroundsAlignment"],
  ["--lwt-background-tiling", "backgroundsTiling"],
  ["--lwt-tab-text", "tab_text"],
  ["--toolbar-bgcolor", "toolbarColor"],
  ["--toolbar-color", "toolbar_text"],
  ["--url-and-searchbar-background-color", "toolbar_field"],
  ["--url-and-searchbar-color", "toolbar_field_text"],
  ["--lwt-toolbar-field-border-color", "toolbar_field_border"],
  ["--urlbar-separator-color", "toolbar_field_separator"],
  ["--tabs-border-color", "toolbar_top_separator"],
  ["--toolbox-border-bottom-color", "toolbar_bottom_separator"],
  ["--lwt-toolbar-vertical-separator", "toolbar_vertical_separator"],
]);

this.LightweightThemeConsumer =
 function LightweightThemeConsumer(aDocument) {
  this._doc = aDocument;
  this._win = aDocument.defaultView;

  let screen = this._win.screen;
  this._lastScreenWidth = screen.width;
  this._lastScreenHeight = screen.height;

  Services.obs.addObserver(this, "lightweight-theme-styling-update");

  var temp = {};
  Cu.import("resource://gre/modules/LightweightThemeManager.jsm", temp);
  this._update(temp.LightweightThemeManager.currentThemeForDisplay);
  this._win.addEventListener("resize", this);
};

LightweightThemeConsumer.prototype = {
  _lastData: null,
  _lastScreenWidth: null,
  _lastScreenHeight: null,
  // Whether the active lightweight theme should be shown on the window.
  _enabled: true,
  // Whether a lightweight theme is enabled.
  _active: false,

  enable() {
    this._enabled = true;
    this._update(this._lastData);
  },

  disable() {
    // Dance to keep the data, but reset the applied styles:
    let lastData = this._lastData;
    this._update(null);
    this._enabled = false;
    this._lastData = lastData;
  },

  getData() {
    return this._enabled ? Cu.cloneInto(this._lastData, this._win) : null;
  },

  observe(aSubject, aTopic, aData) {
    if (aTopic != "lightweight-theme-styling-update")
      return;

    const { outerWindowID } = this._win
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowUtils);

    const parsedData = JSON.parse(aData);
    if (parsedData && parsedData.window && parsedData.window !== outerWindowID) {
      return;
    }

    this._update(parsedData);
  },

  handleEvent(aEvent) {
    let {width, height} = this._win.screen;

    if (this._lastScreenWidth != width || this._lastScreenHeight != height) {
      this._lastScreenWidth = width;
      this._lastScreenHeight = height;
      if (!this._active)
        return;
      this._update(this._lastData);
      Services.obs.notifyObservers(this._win, "lightweight-theme-optimized",
                                   JSON.stringify(this._lastData));
    }
  },

  destroy() {
    Services.obs.removeObserver(this, "lightweight-theme-styling-update");

    this._win.removeEventListener("resize", this);

    this._win = this._doc = null;
  },

  _update(aData) {
    if (!aData) {
      aData = { headerURL: "", footerURL: "", textcolor: "", accentcolor: "" };
      this._lastData = aData;
    } else {
      this._lastData = aData;
      aData = LightweightThemeImageOptimizer.optimize(aData, this._win.screen);
    }
    if (!this._enabled)
      return;

    let root = this._doc.documentElement;
    let active = !!aData.headerURL;

    // We need to clear these either way: either because the theme is being removed,
    // or because we are applying a new theme and the data might be bogus CSS,
    // so if we don't reset first, it'll keep the old value.
    root.style.removeProperty("--lwt-text-color");
    root.style.removeProperty("--lwt-accent-color");
    let textcolor = aData.textcolor || "black";
    _setProperty(root, active, "--lwt-text-color", textcolor);
    _setProperty(root, active, "--lwt-accent-color", this._sanitizeCSSColor(aData.accentcolor) || "white");

    if (active) {
      let dummy = this._doc.createElement("dummy");
      dummy.style.color = textcolor;
      let [r, g, b] = _parseRGB(this._win.getComputedStyle(dummy).color);
      let luminance = 0.2125 * r + 0.7154 * g + 0.0721 * b;
      root.setAttribute("lwthemetextcolor", luminance <= 110 ? "dark" : "bright");
      root.setAttribute("lwtheme", "true");
    } else {
      root.removeAttribute("lwthemetextcolor");
      root.removeAttribute("lwtheme");
    }

    this._active = active;

    if (aData.icons) {
      let activeIcons = active ? Object.keys(aData.icons).join(" ") : "";
      root.setAttribute("lwthemeicons", activeIcons);
      for (let [name, value] of Object.entries(aData.icons)) {
        _setImage(root, active, name, value);
      }
    } else {
      root.removeAttribute("lwthemeicons");
    }

    _setImage(root, active, "--lwt-header-image", aData.headerURL);
    _setImage(root, active, "--lwt-footer-image", aData.footerURL);
    _setImage(root, active, "--lwt-additional-images", aData.additionalBackgrounds);
    _setProperties(root, active, aData);

    if (active && aData.footerURL)
      root.setAttribute("lwthemefooter", "true");
    else
      root.removeAttribute("lwthemefooter");

    Services.obs.notifyObservers(this._win, "lightweight-theme-window-updated",
                                 JSON.stringify(aData));
  },

  _sanitizeCSSColor(cssColor) {
    // style.color normalizes color values and rejects invalid ones, so a
    // simple round trip gets us a sanitized color value.
    let span = this._doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
    span.style.color = cssColor;
    cssColor = this._win.getComputedStyle(span).color;
    if (cssColor == "rgba(0, 0, 0, 0)" ||
        !cssColor) {
      return "";
    }
    // Remove alpha channel from color
    return `rgb(${_parseRGB(cssColor).join(", ")})`;
  }
};

function _setImage(aRoot, aActive, aVariableName, aURLs) {
  if (aURLs && !Array.isArray(aURLs)) {
    aURLs = [aURLs];
  }
  _setProperty(aRoot, aActive, aVariableName, aURLs && aURLs.map(v => `url("${v.replace(/"/g, '\\"')}")`).join(","));
}

function _setProperty(root, active, variableName, value) {
  if (active && value) {
    root.style.setProperty(variableName, value);
  } else {
    root.style.removeProperty(variableName);
  }
}

function _setProperties(root, active, vars) {
  for (let [cssVarName, varsKey] of kCSSVarsMap) {
    _setProperty(root, active, cssVarName, vars[varsKey]);
  }
}

function _parseRGB(aColorString) {
  var rgb = aColorString.match(/^rgba?\((\d+), (\d+), (\d+)/);
  rgb.shift();
  return rgb.map(x => parseInt(x));
}
