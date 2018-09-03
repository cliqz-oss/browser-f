/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Enables compacttheme.css when needed.
 */
var CompactTheme = {
  get styleSheet() {
    delete this.styleSheet;
    for (let styleSheet of document.styleSheets) {
      if (styleSheet.href == "chrome://browser/skin/compacttheme.css") {
        this.styleSheet = styleSheet;
        break;
      }
    }
    return this.styleSheet;
  },

  get isStyleSheetEnabled() {
    return this.styleSheet && !this.styleSheet.disabled;
  },

  get isThemeCurrentlyApplied() {
    let theme = LightweightThemeManager.currentThemeForDisplay;
    return theme && (
           theme.id == "firefox-compact-dark@mozilla.org" ||
           theme.id == "firefox-compact-light@mozilla.org");
  },

  init() {
    Services.obs.addObserver(this, "lightweight-theme-styling-update");

    if (this.isThemeCurrentlyApplied) {
      this._toggleStyleSheet(true);
    }
  },

  createCliqzStyleSheet() {
    const url = "chrome://browser/skin/cliqz/theme.css";
    let styleSheetAttr = `href="${url}" type="text/css"`;
    this.cliqzStyleSheet = document.createProcessingInstruction(
      "xml-stylesheet", styleSheetAttr);
    document.insertBefore(this.cliqzStyleSheet, document.documentElement);
  },

  observe(subject, topic, data) {
    if (topic == "lightweight-theme-styling-update") {
      let newTheme = JSON.parse(data);
      if (newTheme && (
          newTheme.id == "firefox-compact-light@mozilla.org" ||
          newTheme.id == "firefox-compact-dark@mozilla.org")) {
        // We are using the theme ID on this object instead of always referencing
        // LightweightThemeManager.currentTheme in case this is a preview
        this._toggleStyleSheet(true);
      } else {
        this._toggleStyleSheet(false);
      }

    }
  },

  _toggleStyleSheet(enabled) {
    let wasEnabled = this.isStyleSheetEnabled;
    if (enabled) {
      // The stylesheet may not have been created yet if it wasn't
      // needed on initial load.  Make it now.
      if (!this.styleSheet) {
        this.createCliqzStyleSheet();
      }
      this.styleSheet.disabled = false;
    } else if (!enabled && wasEnabled) {
      this.styleSheet.disabled = true;
    }
  },

  uninit() {
    Services.obs.removeObserver(this, "lightweight-theme-styling-update");
    this.styleSheet = null;
  }
};

// If the compact theme is going to be applied in gBrowserInit.onLoad,
// then preload it now.  This prevents a flash of unstyled content where the
// normal theme is applied while the compact theme stylesheet is loading.
if (this != Services.appShell.hiddenDOMWindow && CompactTheme.isThemeCurrentlyApplied) {
  CompactTheme.createCliqzStyleSheet();
}
