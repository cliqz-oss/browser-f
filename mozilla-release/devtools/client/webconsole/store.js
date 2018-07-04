/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {FilterState} = require("devtools/client/webconsole/reducers/filters");
const {PrefState} = require("devtools/client/webconsole/reducers/prefs");
const {UiState} = require("devtools/client/webconsole/reducers/ui");
const {
  applyMiddleware,
  compose,
  createStore
} = require("devtools/client/shared/vendor/redux");
const {
  BATCH_ACTIONS
} = require("devtools/client/shared/redux/middleware/debounce");
const {
  MESSAGE_OPEN,
  MESSAGES_ADD,
  MESSAGES_CLEAR,
  PRIVATE_MESSAGES_CLEAR,
  REMOVED_ACTORS_CLEAR,
  NETWORK_MESSAGE_UPDATE,
  PREFS,
  INITIALIZE,
  FILTER_TOGGLE,
} = require("devtools/client/webconsole/constants");
const { reducers } = require("./reducers/index");
const {
  getMessage,
  getAllMessagesUiById,
} = require("devtools/client/webconsole/selectors/messages");
const DataProvider = require("devtools/client/netmonitor/src/connector/firefox-data-provider");
const {
  getAllNetworkMessagesUpdateById,
} = require("devtools/client/webconsole/selectors/messages");
const {getPrefsService} = require("devtools/client/webconsole/utils/prefs");

/**
 * Create and configure store for the Console panel. This is the place
 * where various enhancers and middleware can be registered.
 */
function configureStore(hud, options = {}) {
  const prefsService = getPrefsService(hud);
  const {
    getBoolPref,
    getIntPref,
  } = prefsService;

  const logLimit = options.logLimit
    || Math.max(getIntPref("devtools.hud.loglimit"), 1);
  const sidebarToggle = getBoolPref(PREFS.UI.SIDEBAR_TOGGLE);

  const initialState = {
    prefs: PrefState({ logLimit, sidebarToggle }),
    filters: FilterState({
      error: getBoolPref(PREFS.FILTER.ERROR),
      warn: getBoolPref(PREFS.FILTER.WARN),
      info: getBoolPref(PREFS.FILTER.INFO),
      debug: getBoolPref(PREFS.FILTER.DEBUG),
      log: getBoolPref(PREFS.FILTER.LOG),
      css: getBoolPref(PREFS.FILTER.CSS),
      net: getBoolPref(PREFS.FILTER.NET),
      netxhr: getBoolPref(PREFS.FILTER.NETXHR),
    }),
    ui: UiState({
      filterBarVisible: getBoolPref(PREFS.UI.FILTER_BAR),
      networkMessageActiveTabId: "headers",
      persistLogs: getBoolPref(PREFS.UI.PERSIST),
    })
  };

  return createStore(
    createRootReducer(),
    initialState,
    compose(
      applyMiddleware(thunk.bind(null, {prefsService})),
      enableActorReleaser(hud),
      enableBatching(),
      enableNetProvider(hud),
      enableMessagesCacheClearing(hud),
      ensureCSSErrorReportingEnabled(hud),
    )
  );
}

function thunk(options = {}, { dispatch, getState }) {
  return next => action => {
    return (typeof action === "function")
      ? action(dispatch, getState, options)
      : next(action);
  };
}

function createRootReducer() {
  return function rootReducer(state, action) {
    // We want to compute the new state for all properties except "messages".
    const newState = [...Object.entries(reducers)].reduce((res, [key, reducer]) => {
      if (key !== "messages") {
        res[key] = reducer(state[key], action);
      }
      return res;
    }, {});

    return Object.assign(newState, {
      // specifically pass the updated filters and prefs state as additional arguments.
      messages: reducers.messages(
        state.messages,
        action,
        newState.filters,
        newState.prefs,
      ),
    });
  };
}

/**
 * A enhancer for the store to handle batched actions.
 */
function enableBatching() {
  return next => (reducer, initialState, enhancer) => {
    function batchingReducer(state, action) {
      switch (action.type) {
        case BATCH_ACTIONS:
          return action.actions.reduce(batchingReducer, state);
        default:
          return reducer(state, action);
      }
    }

    if (typeof initialState === "function" && typeof enhancer === "undefined") {
      enhancer = initialState;
      initialState = undefined;
    }

    return next(batchingReducer, initialState, enhancer);
  };
}

/**
 * This enhancer is responsible for releasing actors on the backend.
 * When messages with arguments are removed from the store we should also
 * clean up the backend.
 */
function enableActorReleaser(hud) {
  return next => (reducer, initialState, enhancer) => {
    function releaseActorsEnhancer(state, action) {
      state = reducer(state, action);

      let type = action.type;
      let proxy = hud ? hud.proxy : null;
      if (
        proxy &&
        ([MESSAGES_ADD, MESSAGES_CLEAR, PRIVATE_MESSAGES_CLEAR].includes(type))
      ) {
        releaseActors(state.messages.removedActors, proxy);

        // Reset `removedActors` in message reducer.
        state = reducer(state, {
          type: REMOVED_ACTORS_CLEAR
        });
      }

      return state;
    }

    return next(releaseActorsEnhancer, initialState, enhancer);
  };
}

/**
 * This is responsible for ensuring that error reporting is enabled if the CSS
 * filter is toggled on.
 */
function ensureCSSErrorReportingEnabled(hud) {
  return next => (reducer, initialState, enhancer) => {
    function ensureErrorReportingEnhancer(state, action) {
      let proxy = hud ? hud.proxy : null;
      if (!proxy) {
        return reducer(state, action);
      }

      state = reducer(state, action);
      if (!state.filters.css) {
        return state;
      }

      let cssFilterToggled =
        action.type == FILTER_TOGGLE && action.filter == "css";
      if (cssFilterToggled || action.type == INITIALIZE) {
        proxy.target.activeTab.ensureCSSErrorReportingEnabled();
      }
      return state;
    }
    return next(ensureErrorReportingEnhancer, initialState, enhancer);
  };
}

/**
 * This enhancer is responsible for fetching HTTP details data
 * collected by the backend. The fetch happens on-demand
 * when the user expands network log in order to inspect it.
 *
 * This way we don't slow down the Console logging by fetching.
 * unnecessary data over RDP.
 */
function enableNetProvider(hud) {
  let dataProvider;
  return next => (reducer, initialState, enhancer) => {
    function netProviderEnhancer(state, action) {
      let proxy = hud ? hud.proxy : null;
      if (!proxy) {
        return reducer(state, action);
      }

      let actions = {
        updateRequest: (id, data, batch) => {
          proxy.dispatchRequestUpdate(id, data);
        }
      };

      // Data provider implements async logic for fetching
      // data from the backend. It's created the first
      // time it's needed.
      if (!dataProvider) {
        dataProvider = new DataProvider({
          actions,
          webConsoleClient: proxy.webConsoleClient
        });

        // /!\ This is terrible, but it allows ResponsePanel to be able to call
        // `dataProvider.requestData` to fetch response content lazily.
        // `proxy.networkDataProvider` is put by NewConsoleOutputWrapper on
        // `serviceContainer` which allow NetworkEventMessage to expose requestData on
        // the fake `connector` object it hands over to ResponsePanel.
        proxy.networkDataProvider = dataProvider;
      }

      let type = action.type;
      let newState = reducer(state, action);

      // If network message has been opened, fetch all HTTP details
      // from the backend. It can happen (especially in test) that
      // the message is opened before all network event updates are
      // received. The rest of updates will be handled below, see:
      // NETWORK_MESSAGE_UPDATE action handler.
      if (type == MESSAGE_OPEN) {
        let updates = getAllNetworkMessagesUpdateById(newState);
        let message = updates[action.id];
        if (message && !message.openedOnce && message.source == "network") {
          dataProvider.onNetworkEvent(message);
          message.updates.forEach(updateType => {
            dataProvider.onNetworkEventUpdate({
              packet: { updateType: updateType },
              networkInfo: message,
            });
          });
        }
      }

      // Process all incoming HTTP details packets. Note that
      // Network event update packets are sent in batches from:
      // `NewConsoleOutputWrapper.dispatchMessageUpdate` using
      // NETWORK_MESSAGE_UPDATE action.
      // Make sure to call `dataProvider.onNetworkEventUpdate`
      // to fetch data from the backend.
      if (type == NETWORK_MESSAGE_UPDATE) {
        let actor = action.response.networkInfo.actor;
        let open = getAllMessagesUiById(state).includes(actor);
        if (open) {
          let message = getMessage(state, actor);
          message.updates.forEach(updateType => {
            dataProvider.onNetworkEventUpdate({
              packet: { updateType },
              networkInfo: message,
            });
          });
        }
      }

      return newState;
    }

    return next(netProviderEnhancer, initialState, enhancer);
  };
}

/**
 * This enhancer is responsible for clearing the messages caches using the
 * webconsoleClient when the user clear the messages (either by direct UI action, or via
 * `console.clear()`).
 */
function enableMessagesCacheClearing(hud) {
  return next => (reducer, initialState, enhancer) => {
    function messagesCacheClearingEnhancer(state, action) {
      state = reducer(state, action);

      let webConsoleClient = hud && hud.proxy ? hud.proxy.webConsoleClient : null;
      if (webConsoleClient && action.type === MESSAGES_CLEAR) {
        webConsoleClient.clearNetworkRequests();
        webConsoleClient.clearMessagesCache();
      }
      return state;
    }

    return next(messagesCacheClearingEnhancer, initialState, enhancer);
  };
}

/**
 * Helper function for releasing backend actors.
 */
function releaseActors(removedActors, proxy) {
  if (!proxy) {
    return;
  }

  removedActors.forEach(actor => proxy.releaseActor(actor));
}

// Provide the store factory for test code so that each test is working with
// its own instance.
module.exports.configureStore = configureStore;

