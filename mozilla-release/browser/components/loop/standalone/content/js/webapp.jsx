/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var loop = loop || {};
loop.webapp = (function(_, OT, mozL10n) {
  "use strict";

  loop.config = loop.config || {};
  loop.config.serverUrl = loop.config.serverUrl || "http://localhost:5000";

  var sharedActions = loop.shared.actions;
  var sharedMixins = loop.shared.mixins;
  var sharedModels = loop.shared.models;
  var sharedViews = loop.shared.views;
  var sharedUtils = loop.shared.utils;
  var WEBSOCKET_REASONS = loop.shared.utils.WEBSOCKET_REASONS;

  /**
   * Homepage view.
   */
  var HomeView = React.createClass({
    render: function() {
      return (
        <p>{mozL10n.get("welcome", {clientShortname: mozL10n.get("clientShortname2")})}</p>
      );
    }
  });

  /**
   * Unsupported Browsers view.
   */
  var UnsupportedBrowserView = React.createClass({
    propTypes: {
      isFirefox: React.PropTypes.bool.isRequired
    },

    render: function() {
      return (
        <div className="highlight-issue-box">
          <div className="info-panel">
            <div className="firefox-logo" />
            <h1>{mozL10n.get("incompatible_browser_heading")}</h1>
            <h4>{mozL10n.get("incompatible_browser_message")}</h4>
          </div>
          <PromoteFirefoxView isFirefox={this.props.isFirefox}/>
        </div>
      );
    }
  });

  /**
   * Unsupported Device view.
   */
  var UnsupportedDeviceView = React.createClass({
    propTypes: {
      platform: React.PropTypes.string.isRequired
    },

    render: function() {
      var unsupportedDeviceParams = {
        clientShortname: mozL10n.get("clientShortname2"),
        platform: mozL10n.get("unsupported_platform_" + this.props.platform)
      };
      var unsupportedLearnMoreText = mozL10n.get("unsupported_platform_learn_more_link",
        {clientShortname: mozL10n.get("clientShortname2")});

      return (
        <div className="highlight-issue-box">
          <div className="info-panel">
            <div className="firefox-logo" />
            <h1>{mozL10n.get("unsupported_platform_heading")}</h1>
            <h4>{mozL10n.get("unsupported_platform_message", unsupportedDeviceParams)}</h4>
          </div>
          <p>
            <a className="btn btn-large btn-accept btn-unsupported-device"
               href={loop.config.unsupportedPlatformUrl}>{unsupportedLearnMoreText}</a></p>
        </div>
      );
    }
  });

  /**
   * Firefox promotion interstitial. Will display only to non-Firefox users.
   */
  var PromoteFirefoxView = React.createClass({
    propTypes: {
      isFirefox: React.PropTypes.bool.isRequired
    },

    render: function() {
      if (this.props.isFirefox) {
        return null;
      }
      return (
        <div className="promote-firefox">
          <h3>{mozL10n.get("promote_firefox_hello_heading", {brandShortname: mozL10n.get("brandShortname")})}</h3>
          <p>
            <a className="btn btn-large btn-accept"
               href={loop.config.downloadFirefoxUrl}>
              {mozL10n.get("get_firefox_button", {
                brandShortname: mozL10n.get("brandShortname")
              })}
            </a>
          </p>
        </div>
      );
    }
  });

  /**
   * Webapp Root View. This is the main, single, view that controls the display
   * of the webapp page.
   */
  var WebappRootView = React.createClass({

    mixins: [sharedMixins.UrlHashChangeMixin,
             sharedMixins.DocumentLocationMixin,
             Backbone.Events],

    propTypes: {
      activeRoomStore: React.PropTypes.instanceOf(loop.store.ActiveRoomStore).isRequired,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      standaloneAppStore: React.PropTypes.instanceOf(
        loop.store.StandaloneAppStore).isRequired
    },

    getInitialState: function() {
      return this.props.standaloneAppStore.getStoreState();
    },

    componentWillMount: function() {
      this.listenTo(this.props.standaloneAppStore, "change", function() {
        this.setState(this.props.standaloneAppStore.getStoreState());
      }, this);
    },

    componentWillUnmount: function() {
      this.stopListening(this.props.standaloneAppStore);
    },

    onUrlHashChange: function() {
      this.locationReload();
    },

    render: function() {
      switch (this.state.windowType) {
        case "unsupportedDevice": {
          return <UnsupportedDeviceView platform={this.state.unsupportedPlatform}/>;
        }
        case "unsupportedBrowser": {
          return <UnsupportedBrowserView isFirefox={this.state.isFirefox}/>;
        }
        case "room": {
          return (
            <loop.standaloneRoomViews.StandaloneRoomView
              activeRoomStore={this.props.activeRoomStore}
              dispatcher={this.props.dispatcher}
              isFirefox={this.state.isFirefox} />
          );
        }
        case "home": {
          return <HomeView />;
        }
        default: {
          // The state hasn't been initialised yet, so don't display
          // anything to avoid flicker.
          return null;
        }
      }
    }
  });

  /**
   * App initialization.
   */
  function init() {
    var standaloneMozLoop = new loop.StandaloneMozLoop({
      baseServerUrl: loop.config.serverUrl
    });

    // New flux items.
    var dispatcher = new loop.Dispatcher();
    var sdkDriver = new loop.OTSdkDriver({
      // For the standalone, always request data channels. If they aren't
      // implemented on the client, there won't be a similar message to us, and
      // we won't display the UI.
      useDataChannels: true,
      dispatcher: dispatcher,
      sdk: OT
    });

    var activeRoomStore = new loop.store.ActiveRoomStore(dispatcher, {
        mozLoop: standaloneMozLoop,
        sdkDriver: sdkDriver
    });

    // Stores
    var standaloneAppStore = new loop.store.StandaloneAppStore({
      dispatcher: dispatcher,
      sdk: OT
    });
    var standaloneMetricsStore = new loop.store.StandaloneMetricsStore(dispatcher, {
      activeRoomStore: activeRoomStore
    });
    var textChatStore = new loop.store.TextChatStore(dispatcher, {
      sdkDriver: sdkDriver
    });

    loop.store.StoreMixin.register({
      activeRoomStore: activeRoomStore,
      // This isn't used in any views, but is saved here to ensure it
      // is kept alive.
      standaloneMetricsStore: standaloneMetricsStore,
      textChatStore: textChatStore
    });

    window.addEventListener("unload", function() {
      dispatcher.dispatch(new sharedActions.WindowUnload());
    });

    React.render(<WebappRootView
      activeRoomStore={activeRoomStore}
      dispatcher={dispatcher}
      standaloneAppStore={standaloneAppStore} />, document.querySelector("#main"));

    // Set the 'lang' and 'dir' attributes to <html> when the page is translated
    document.documentElement.lang = mozL10n.language.code;
    document.documentElement.dir = mozL10n.language.direction;
    document.title = mozL10n.get("clientShortname2");

    var locationData = sharedUtils.locationData();

    dispatcher.dispatch(new sharedActions.ExtractTokenInfo({
      windowPath: locationData.pathname,
      windowHash: locationData.hash
    }));
  }

  return {
    HomeView: HomeView,
    UnsupportedBrowserView: UnsupportedBrowserView,
    UnsupportedDeviceView: UnsupportedDeviceView,
    init: init,
    PromoteFirefoxView: PromoteFirefoxView,
    WebappRootView: WebappRootView
  };
})(_, window.OT, navigator.mozL10n);
