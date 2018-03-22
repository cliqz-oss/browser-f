/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const actionTypes = {
  BATCH_ACTIONS: "BATCH_ACTIONS",
  DEFAULT_FILTERS_RESET: "DEFAULT_FILTERS_RESET",
  FILTER_BAR_TOGGLE: "FILTER_BAR_TOGGLE",
  FILTER_TEXT_SET: "FILTER_TEXT_SET",
  FILTER_TOGGLE: "FILTER_TOGGLE",
  FILTERS_CLEAR: "FILTERS_CLEAR",
  INITIALIZE: "INITIALIZE",
  MESSAGE_CLOSE: "MESSAGE_CLOSE",
  MESSAGE_OPEN: "MESSAGE_OPEN",
  MESSAGE_TABLE_RECEIVE: "MESSAGE_TABLE_RECEIVE",
  MESSAGES_ADD: "MESSAGES_ADD",
  MESSAGES_CLEAR: "MESSAGES_CLEAR",
  NETWORK_MESSAGE_UPDATE: "NETWORK_MESSAGE_UPDATE",
  NETWORK_UPDATE_REQUEST: "NETWORK_UPDATE_REQUEST",
  PERSIST_TOGGLE: "PERSIST_TOGGLE",
  REMOVED_ACTORS_CLEAR: "REMOVED_ACTORS_CLEAR",
  SELECT_NETWORK_MESSAGE_TAB: "SELECT_NETWORK_MESSAGE_TAB",
  SIDEBAR_CLOSE: "SIDEBAR_CLOSE",
  SHOW_OBJECT_IN_SIDEBAR: "SHOW_OBJECT_IN_SIDEBAR",
  TIMESTAMPS_TOGGLE: "TIMESTAMPS_TOGGLE",
};

const prefs = {
  PREFS: {
    FILTER: {
      ERROR: "devtools.webconsole.filter.error",
      WARN: "devtools.webconsole.filter.warn",
      INFO: "devtools.webconsole.filter.info",
      LOG: "devtools.webconsole.filter.log",
      DEBUG: "devtools.webconsole.filter.debug",
      CSS: "devtools.webconsole.filter.css",
      NET: "devtools.webconsole.filter.net",
      NETXHR: "devtools.webconsole.filter.netxhr",
    },
    UI: {
      FILTER_BAR: "devtools.webconsole.ui.filterbar",
      PERSIST: "devtools.webconsole.persistlog",
      SIDEBAR_TOGGLE: "devtools.webconsole.sidebarToggle",
    }
  }
};

const FILTERS = {
  CSS: "css",
  DEBUG: "debug",
  ERROR: "error",
  INFO: "info",
  LOG: "log",
  NET: "net",
  NETXHR: "netxhr",
  TEXT: "text",
  WARN: "warn",
};

const DEFAULT_FILTERS_VALUES = {
  [FILTERS.TEXT]: "",
  [FILTERS.ERROR]: true,
  [FILTERS.WARN]: true,
  [FILTERS.LOG]: true,
  [FILTERS.INFO]: true,
  [FILTERS.DEBUG]: true,
  [FILTERS.CSS]: false,
  [FILTERS.NET]: false,
  [FILTERS.NETXHR]: false,
};

const DEFAULT_FILTERS = Object.keys(DEFAULT_FILTERS_VALUES)
  .filter(filter => DEFAULT_FILTERS_VALUES[filter] !== false);

const chromeRDPEnums = {
  MESSAGE_SOURCE: {
    XML: "xml",
    CSS: "css",
    JAVASCRIPT: "javascript",
    NETWORK: "network",
    CONSOLE_API: "console-api",
    STORAGE: "storage",
    APPCACHE: "appcache",
    RENDERING: "rendering",
    SECURITY: "security",
    OTHER: "other",
    DEPRECATION: "deprecation"
  },
  MESSAGE_TYPE: {
    LOG: "log",
    DIR: "dir",
    TABLE: "table",
    TRACE: "trace",
    CLEAR: "clear",
    START_GROUP: "startGroup",
    START_GROUP_COLLAPSED: "startGroupCollapsed",
    END_GROUP: "endGroup",
    ASSERT: "assert",
    DEBUG: "debug",
    PROFILE: "profile",
    PROFILE_END: "profileEnd",
    // Undocumented in Chrome RDP, but is used for evaluation results.
    RESULT: "result",
    // Undocumented in Chrome RDP, but is used for input.
    COMMAND: "command",
    // Undocumented in Chrome RDP, but is used for messages that should not
    // output anything (e.g. `console.time()` calls).
    NULL_MESSAGE: "nullMessage",
  },
  MESSAGE_LEVEL: {
    LOG: "log",
    ERROR: "error",
    WARN: "warn",
    DEBUG: "debug",
    INFO: "info"
  }
};

const jstermCommands = {
  JSTERM_COMMANDS: {
    INSPECT: "inspectObject"
  }
};

// Combine into a single constants object
module.exports = Object.assign({
  FILTERS,
  DEFAULT_FILTERS,
  DEFAULT_FILTERS_VALUES,
},
  actionTypes,
  chromeRDPEnums,
  jstermCommands,
  prefs,
);
