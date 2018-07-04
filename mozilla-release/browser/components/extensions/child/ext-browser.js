"use strict";

extensions.registerModules({
  devtools: {
    url: "chrome://browser/content/child/ext-devtools.js",
    scopes: ["devtools_child"],
    paths: [
      ["devtools"],
    ],
  },
  devtools_inspectedWindow: {
    url: "chrome://browser/content/child/ext-devtools-inspectedWindow.js",
    scopes: ["devtools_child"],
    paths: [
      ["devtools", "inspectedWindow"],
    ],
  },
  devtools_panels: {
    url: "chrome://browser/content/child/ext-devtools-panels.js",
    scopes: ["devtools_child"],
    paths: [
      ["devtools", "panels"],
    ],
  },
  devtools_network: {
    url: "chrome://browser/content/child/ext-devtools-network.js",
    scopes: ["devtools_child"],
    paths: [
      ["devtools", "network"],
    ],
  },
  // Because of permissions, the module name must differ from both namespaces.
  menusInternal: {
    url: "chrome://browser/content/child/ext-menus.js",
    scopes: ["addon_child"],
    paths: [
      ["contextMenus"],
      ["menus"],
    ],
  },
  omnibox: {
    url: "chrome://browser/content/child/ext-omnibox.js",
    scopes: ["addon_child"],
    paths: [
      ["omnibox"],
    ],
  },
  tabs: {
    url: "chrome://browser/content/child/ext-tabs.js",
    scopes: ["addon_child"],
    paths: [
      ["tabs"],
    ],
  },
});
