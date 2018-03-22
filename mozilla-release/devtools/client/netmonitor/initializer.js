/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * This script is the entry point of Network monitor panel.
 * See README.md for more information.
 */
const { BrowserLoader } = Components.utils.import(
  "resource://devtools/client/shared/browser-loader.js", {});

const require = window.windowRequire = BrowserLoader({
  baseURI: "resource://devtools/client/netmonitor/",
  window,
}).require;

const EventEmitter = require("devtools/shared/old-event-emitter");
const { createFactory } = require("devtools/client/shared/vendor/react");
const { render, unmountComponentAtNode } = require("devtools/client/shared/vendor/react-dom");
const Provider = createFactory(require("devtools/client/shared/vendor/react-redux").Provider);
const { bindActionCreators } = require("devtools/client/shared/vendor/redux");
const { Connector } = require("./src/connector/index");
const { configureStore } = require("./src/utils/create-store");
const App = createFactory(require("./src/components/App"));
const { getDisplayedRequestById } = require("./src/selectors/index");
const { EVENTS } = require("./src/constants");

// Inject EventEmitter into global window.
EventEmitter.decorate(window);

// Configure store/state object.
let connector = new Connector();
const store = configureStore(connector);
const actions = bindActionCreators(require("./src/actions/index"), store.dispatch);

// Inject to global window for testing
window.store = store;
window.connector = connector;

/**
 * Global Netmonitor object in this panel. This object can be consumed
 * by other panels (e.g. Console is using inspectRequest), by the
 * Launchpad (bootstrap), etc.
 */
window.Netmonitor = {
  bootstrap({ toolbox, panel }) {
    this.mount = document.querySelector("#mount");

    const connection = {
      tabConnection: {
        tabTarget: toolbox.target,
      },
      toolbox,
      panel,
    };

    const openLink = (link) => {
      let parentDoc = toolbox.doc;
      let iframe = parentDoc.getElementById("toolbox-panel-iframe-netmonitor");
      let top = iframe.ownerDocument.defaultView.top;
      top.openUILinkIn(link, "tab");
    };

    // Render the root Application component.
    const sourceMapService = toolbox.sourceMapURLService;
    const app = App({ connector, openLink, sourceMapService });
    render(Provider({ store }, app), this.mount);

    // Connect to the Firefox backend by default.
    return connector.connectFirefox(connection, actions, store.getState);
  },

  destroy() {
    unmountComponentAtNode(this.mount);
    return connector.disconnect();
  },

  /**
   * Selects the specified request in the waterfall and opens the details view.
   * This is a firefox toolbox specific API, which providing an ability to inspect
   * a network request directly from other internal toolbox panel.
   *
   * @param {string} requestId The actor ID of the request to inspect.
   * @return {object} A promise resolved once the task finishes.
   */
  inspectRequest(requestId) {
    // Look for the request in the existing ones or wait for it to appear, if
    // the network monitor is still loading.
    return new Promise((resolve) => {
      let request = null;
      let inspector = () => {
        request = getDisplayedRequestById(store.getState(), requestId);
        if (!request) {
          // Reset filters so that the request is visible.
          actions.toggleRequestFilterType("all");
          request = getDisplayedRequestById(store.getState(), requestId);
        }

        // If the request was found, select it. Otherwise this function will be
        // called again once new requests arrive.
        if (request) {
          window.off(EVENTS.REQUEST_ADDED, inspector);
          actions.selectRequest(request.id);
          resolve();
        }
      };

      inspector();

      if (!request) {
        window.on(EVENTS.REQUEST_ADDED, inspector);
      }
    });
  }
};

// Implement support for:
// chrome://devtools/content/netmonitor/index.html?type=tab&id=1234 URLs
// where 1234 is the tab id, you can retrieve from about:debugging#tabs links.
// Simply copy the id from about:devtools-toolbox?type=tab&id=1234 URLs.

// URL constructor doesn't support chrome: scheme
let href = window.location.href.replace(/chrome:/, "http://");
let url = new window.URL(href);

// If query parameters are given in a chrome tab, the inspector
// is running in standalone.
if (window.location.protocol === "chrome:" && url.search.length > 1) {
  const { targetFromURL } = require("devtools/client/framework/target-from-url");

  (async function () {
    try {
      let target = await targetFromURL(url);

      // Start the network event listening as it is done in the toolbox code
      await target.activeConsole.startListeners([
        "NetworkActivity",
      ]);

      // Create a fake toolbox object
      let toolbox = {
        target,
        viewSourceInDebugger() {
          throw new Error("toolbox.viewSourceInDebugger is not implement from a tab");
        }
      };

      window.Netmonitor.bootstrap({ toolbox });
    } catch (err) {
      window.alert("Unable to start the network monitor:" + err);
    }
  })();
}
