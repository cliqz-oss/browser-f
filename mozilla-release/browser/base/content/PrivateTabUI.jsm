// Copyright Cliqz GmbH, 2016.

"use strict";

this.EXPORTED_SYMBOLS = ["PrivateTabUI"];

const TOOLBOX_PRIVATE_ATTR_NAME = "on_private_tab";

/**
 * Small utility handler which propagates current tab "privateness" property as
 * available to CSS selectors through #navigator-toolbox[on_private_tab].
 */
class PrivateTabUI {
  /**
   * @param {XULElement} browser - xul:tabbrowser.
   * @param {XULElement} navToolbox - xul:toolbox(navigator-toolbox).
   */
  constructor(browser, navToolbox) {
    if (!browser || !navToolbox)
      throw new Error("Browser and toolbox arguments must be present.");
    this._browser = browser;
    this._toolbox = navToolbox;
  }

  start() {
    this._updateNavToolbox();
    for (let eventName in tabContainerEvents) {
      this._browser.tabContainer.addEventListener(eventName, this);
    }
  }

  stop() {
    for (let eventName in tabContainerEvents) {
      this._browser.tabContainer.removeEventListener(eventName, this);
    }
    this._toolbox.removeAttribute(TOOLBOX_PRIVATE_ATTR_NAME);
  }

  handleEvent(event) {
    const handler = tabContainerEvents[event.type];
    if (handler)
      handler.call(this, event);
  }

  _updateNavToolbox() {
    this._toolbox.setAttribute(TOOLBOX_PRIVATE_ATTR_NAME,
        this._browser.selectedTab.private);
  }
}

const tabContainerEvents = {
  "TabSelect": function onTabSelect(event) {
    this._updateNavToolbox();
  },

  "TabPrivateModeChanged": function onTabPrivateModeChanged(event) {
    if (event.originalTarget !== this._browser.selectedTab)
      return;
    this._toolbox.setAttribute(TOOLBOX_PRIVATE_ATTR_NAME, event.detail.private);
  }
};
