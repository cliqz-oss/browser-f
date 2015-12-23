/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var loop = loop || {};
loop.roomViews = (function(mozL10n) {
  "use strict";

  var ROOM_STATES = loop.store.ROOM_STATES;
  var SCREEN_SHARE_STATES = loop.shared.utils.SCREEN_SHARE_STATES;
  var sharedActions = loop.shared.actions;
  var sharedMixins = loop.shared.mixins;
  var sharedUtils = loop.shared.utils;
  var sharedViews = loop.shared.views;

  /**
   * ActiveRoomStore mixin.
   * @type {Object}
   */
  var ActiveRoomStoreMixin = {
    mixins: [Backbone.Events],

    propTypes: {
      roomStore: React.PropTypes.instanceOf(loop.store.RoomStore).isRequired
    },

    componentWillMount: function() {
      this.listenTo(this.props.roomStore, "change:activeRoom",
                    this._onActiveRoomStateChanged);
      this.listenTo(this.props.roomStore, "change:error",
                    this._onRoomError);
      this.listenTo(this.props.roomStore, "change:savingContext",
                    this._onRoomSavingContext);
    },

    componentWillUnmount: function() {
      this.stopListening(this.props.roomStore);
    },

    _onActiveRoomStateChanged: function() {
      // Only update the state if we're mounted, to avoid the problem where
      // stopListening doesn't nuke the active listeners during a event
      // processing.
      if (this.isMounted()) {
        this.setState(this.props.roomStore.getStoreState("activeRoom"));
      }
    },

    _onRoomError: function() {
      // Only update the state if we're mounted, to avoid the problem where
      // stopListening doesn't nuke the active listeners during a event
      // processing.
      if (this.isMounted()) {
        this.setState({error: this.props.roomStore.getStoreState("error")});
      }
    },

    _onRoomSavingContext: function() {
      // Only update the state if we're mounted, to avoid the problem where
      // stopListening doesn't nuke the active listeners during a event
      // processing.
      if (this.isMounted()) {
        this.setState({savingContext: this.props.roomStore.getStoreState("savingContext")});
      }
    },

    getInitialState: function() {
      var storeState = this.props.roomStore.getStoreState("activeRoom");
      return _.extend({
        // Used by the UI showcase.
        roomState: this.props.roomState || storeState.roomState,
        savingContext: false
      }, storeState);
    }
  };

  /**
   * Something went wrong view. Displayed when there's a big problem.
   */
  var RoomFailureView = React.createClass({displayName: "RoomFailureView",
    mixins: [ sharedMixins.AudioMixin ],

    propTypes: {
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      failureReason: React.PropTypes.string,
      mozLoop: React.PropTypes.object.isRequired
    },

    componentDidMount: function() {
      this.play("failure");
    },

    handleRejoinCall: function() {
      this.props.dispatcher.dispatch(new sharedActions.JoinRoom());
    },

    render: function() {
      var settingsMenuItems = [
        { id: "feedback" },
        { id: "help" }
      ];
      return (
        React.createElement("div", {className: "room-failure"}, 
          React.createElement(loop.conversationViews.FailureInfoView, {
            failureReason: this.props.failureReason}), 
          React.createElement("div", {className: "btn-group call-action-group"}, 
            React.createElement("button", {className: "btn btn-info btn-rejoin", 
                    onClick: this.handleRejoinCall}, 
              mozL10n.get("rejoin_button")
            )
          ), 
          React.createElement(loop.shared.views.SettingsControlButton, {
            menuBelow: true, 
            menuItems: settingsMenuItems, 
            mozLoop: this.props.mozLoop})
        )
      );
    }
  });

  var SocialShareDropdown = React.createClass({displayName: "SocialShareDropdown",
    propTypes: {
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      roomUrl: React.PropTypes.string,
      show: React.PropTypes.bool.isRequired,
      socialShareProviders: React.PropTypes.array
    },

    handleAddServiceClick: function(event) {
      event.preventDefault();

      this.props.dispatcher.dispatch(new sharedActions.AddSocialShareProvider());
    },

    handleProviderClick: function(event) {
      event.preventDefault();

      var origin = event.currentTarget.dataset.provider;
      var provider = this.props.socialShareProviders
                         .filter(function(socialProvider) {
                           return socialProvider.origin === origin;
                         })[0];

      this.props.dispatcher.dispatch(new sharedActions.ShareRoomUrl({
        provider: provider,
        roomUrl: this.props.roomUrl,
        previews: []
      }));
    },

    render: function() {
      // Don't render a thing when no data has been fetched yet.
      if (!this.props.socialShareProviders) {
        return null;
      }

      var cx = React.addons.classSet;
      var shareDropdown = cx({
        "share-service-dropdown": true,
        "dropdown-menu": true,
        "visually-hidden": true,
        "hide": !this.props.show
      });

      return (
        React.createElement("ul", {className: shareDropdown}, 
          React.createElement("li", {className: "dropdown-menu-item", onClick: this.handleAddServiceClick}, 
            React.createElement("i", {className: "icon icon-add-share-service"}), 
            React.createElement("span", null, mozL10n.get("share_add_service_button"))
          ), 
          this.props.socialShareProviders.length ? React.createElement("li", {className: "dropdown-menu-separator"}) : null, 
          
            this.props.socialShareProviders.map(function(provider, idx) {
              return (
                React.createElement("li", {className: "dropdown-menu-item", 
                    "data-provider": provider.origin, 
                    key: "provider-" + idx, 
                    onClick: this.handleProviderClick}, 
                  React.createElement("img", {className: "icon", src: provider.iconURL}), 
                  React.createElement("span", null, provider.name)
                )
              );
            }.bind(this))
          
        )
      );
    }
  });

  /**
   * Desktop room invitation view (overlay).
   */
  var DesktopRoomInvitationView = React.createClass({displayName: "DesktopRoomInvitationView",
    statics: {
      TRIGGERED_RESET_DELAY: 2000
    },

    mixins: [sharedMixins.DropdownMenuMixin(".room-invitation-overlay")],

    propTypes: {
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      error: React.PropTypes.object,
      mozLoop: React.PropTypes.object.isRequired,
      onAddContextClick: React.PropTypes.func,
      onEditContextClose: React.PropTypes.func,
      // This data is supplied by the activeRoomStore.
      roomData: React.PropTypes.object.isRequired,
      savingContext: React.PropTypes.bool,
      show: React.PropTypes.bool.isRequired,
      showEditContext: React.PropTypes.bool.isRequired,
      socialShareProviders: React.PropTypes.array
    },

    getInitialState: function() {
      return {
        copiedUrl: false,
        newRoomName: ""
      };
    },

    handleEmailButtonClick: function(event) {
      event.preventDefault();

      var roomData = this.props.roomData;
      var contextURL = roomData.roomContextUrls && roomData.roomContextUrls[0];
      this.props.dispatcher.dispatch(
        new sharedActions.EmailRoomUrl({
          roomUrl: roomData.roomUrl,
          roomDescription: contextURL && contextURL.description,
          from: "conversation"
        }));
    },

    handleCopyButtonClick: function(event) {
      event.preventDefault();

      this.props.dispatcher.dispatch(new sharedActions.CopyRoomUrl({
        roomUrl: this.props.roomData.roomUrl,
        from: "conversation"
      }));

      this.setState({copiedUrl: true});
      setTimeout(this.resetTriggeredButtons, this.constructor.TRIGGERED_RESET_DELAY);
    },

    /**
     * Reset state of triggered buttons if necessary
     */
    resetTriggeredButtons: function() {
      if (this.state.copiedUrl) {
        this.setState({copiedUrl: false});
      }
    },

    handleShareButtonClick: function(event) {
      event.preventDefault();

      var providers = this.props.socialShareProviders;
      // If there are no providers available currently, save a click by dispatching
      // the 'AddSocialShareProvider' right away.
      if (!providers || !providers.length) {
        this.props.dispatcher.dispatch(new sharedActions.AddSocialShareProvider());
        return;
      }

      this.toggleDropdownMenu();
    },

    handleEditContextClose: function() {
      if (this.props.onEditContextClose) {
        this.props.onEditContextClose();
      }
    },

    render: function() {
      if (!this.props.show) {
        return null;
      }

      var cx = React.addons.classSet;
      return (
        React.createElement("div", {className: "room-invitation-overlay"}, 
          React.createElement("div", {className: "room-invitation-content"}, 
            React.createElement("p", {className: cx({hide: this.props.showEditContext})}, 
              mozL10n.get("invite_header_text2")
            )
          ), 
          React.createElement("div", {className: cx({
            "btn-group": true,
            "call-action-group": true,
            hide: this.props.showEditContext
          })}, 
            React.createElement("div", {className: cx({
                "btn-copy": true,
                "invite-button": true,
                "triggered": this.state.copiedUrl
              }), 
              onClick: this.handleCopyButtonClick}, 
              React.createElement("img", {src: "loop/shared/img/svg/glyph-link-16x16.svg"}), 
              React.createElement("p", null, mozL10n.get("invite_copy_" +
                (this.state.copiedUrl ? "triggered" : "button")))
            ), 
            React.createElement("div", {className: "btn-email invite-button", 
              onClick: this.handleEmailButtonClick, 
              onMouseOver: this.resetTriggeredButtons}, 
              React.createElement("img", {src: "loop/shared/img/svg/glyph-email-16x16.svg"}), 
              React.createElement("p", null, mozL10n.get("invite_email_button"))
            )
          ), 
          React.createElement(SocialShareDropdown, {
            dispatcher: this.props.dispatcher, 
            ref: "menu", 
            roomUrl: this.props.roomData.roomUrl, 
            show: this.state.showMenu, 
            socialShareProviders: this.props.socialShareProviders}), 
          React.createElement(DesktopRoomEditContextView, {
            dispatcher: this.props.dispatcher, 
            error: this.props.error, 
            mozLoop: this.props.mozLoop, 
            onClose: this.handleEditContextClose, 
            roomData: this.props.roomData, 
            savingContext: this.props.savingContext, 
            show: this.props.showEditContext})
        )
      );
    }
  });

  var DesktopRoomEditContextView = React.createClass({displayName: "DesktopRoomEditContextView",
    mixins: [React.addons.LinkedStateMixin],
    maxRoomNameLength: 124,

    propTypes: {
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      error: React.PropTypes.object,
      mozLoop: React.PropTypes.object.isRequired,
      onClose: React.PropTypes.func,
      // This data is supplied by the activeRoomStore.
      roomData: React.PropTypes.object.isRequired,
      savingContext: React.PropTypes.bool.isRequired,
      show: React.PropTypes.bool.isRequired
    },

    componentWillMount: function() {
      this._fetchMetadata();
    },

    componentWillReceiveProps: function(nextProps) {
      var newState = {};
      // When the 'show' prop is changed from outside this component, we do need
      // to update the state.
      if (("show" in nextProps) && nextProps.show !== this.props.show) {
        newState.show = nextProps.show;
        if (nextProps.show) {
          this._fetchMetadata();
        }
      }
      // When we receive an update for the `roomData` property, make sure that
      // the current form fields reflect reality. This is necessary, because the
      // form state is maintained in the components' state.
      if (nextProps.roomData) {
        // Right now it's only necessary to update the form input states when
        // they contain no text yet.
        if (!this.state.newRoomName && nextProps.roomData.roomName) {
          newState.newRoomName = nextProps.roomData.roomName;
        }
        var url = this._getURL(nextProps.roomData);
        if (url) {
          if (!this.state.newRoomURL && url.location) {
            newState.newRoomURL = url.location;
          }
          if (!this.state.newRoomDescription && url.description) {
            newState.newRoomDescription = url.description;
          }
          if (!this.state.newRoomThumbnail && url.thumbnail) {
            newState.newRoomThumbnail = url.thumbnail;
          }
        }
      }

      // Feature support: when a context save completed without error, we can
      // close the context edit form.
      if (("savingContext" in nextProps) && this.props.savingContext &&
          this.props.savingContext !== nextProps.savingContext && this.state.show
          && !this.props.error && !nextProps.error) {
        newState.show = false;
        if (this.props.onClose) {
          this.props.onClose();
        }
      }

      if (Object.getOwnPropertyNames(newState).length) {
        this.setState(newState);
      }
    },

    getInitialState: function() {
      var url = this._getURL();
      return {
        // `availableContext` prop only used in tests.
        availableContext: null,
        show: this.props.show,
        newRoomName: this.props.roomData.roomName || "",
        newRoomURL: url && url.location || "",
        newRoomDescription: url && url.description || "",
        newRoomThumbnail: url && url.thumbnail || ""
      };
    },

    _fetchMetadata: function() {
      this.props.mozLoop.getSelectedTabMetadata(function(metadata) {
        var previewImage = metadata.favicon || "";
        var description = metadata.title || metadata.description;
        var metaUrl = metadata.url;
        this.setState({
          availableContext: {
            previewImage: previewImage,
            description: description,
            url: metaUrl
          }
       });
      }.bind(this));
    },

    handleCloseClick: function(event) {
      event.stopPropagation();
      event.preventDefault();

      this.setState({ show: false });
      if (this.props.onClose) {
        this.props.onClose();
      }
    },

    handleContextClick: function(event) {
      event.stopPropagation();
      event.preventDefault();

      var url = this._getURL();
      if (!url || !url.location) {
        return;
      }

      var mozLoop = this.props.mozLoop;
      mozLoop.openURL(url.location);

      mozLoop.telemetryAddValue("LOOP_ROOM_CONTEXT_CLICK", 1);
    },

    handleFormSubmit: function(event) {
      event && event.preventDefault();

      this.props.dispatcher.dispatch(new sharedActions.UpdateRoomContext({
        roomToken: this.props.roomData.roomToken,
        newRoomName: this.state.newRoomName,
        newRoomURL: this.state.newRoomURL,
        newRoomDescription: this.state.newRoomDescription,
        newRoomThumbnail: this.state.newRoomThumbnail
      }));
    },

    handleTextareaKeyDown: function(event) {
      // Submit the form as soon as the user press Enter in that field
      // Note: We're using a textarea instead of a simple text input to display
      // placeholder and entered text on two lines, to circumvent l10n
      // rendering/UX issues for some locales.
      if (event.which === 13) {
        this.handleFormSubmit(event);
      }
    },

    /**
     * Utility function to extract URL context data from the `roomData` property
     * that can also be supplied as an argument.
     *
     * @param  {Object} roomData Optional room data object to use, equivalent to
     *                           the activeRoomStore state.
     * @return {Object} The first context URL found on the `roomData` object.
     */
    _getURL: function(roomData) {
      roomData = roomData || this.props.roomData;
      return this.props.roomData.roomContextUrls &&
        this.props.roomData.roomContextUrls[0];
    },

    render: function() {
      if (!this.state.show) {
        return null;
      }

      var url = this._getURL();
      var thumbnail = url && url.thumbnail || "loop/shared/img/icons-16x16.svg#globe";
      var urlDescription = url && url.description || "";
      var location = url && url.location || "";

      var cx = React.addons.classSet;
      var availableContext = this.state.availableContext;
      return (
        React.createElement("div", {className: "room-context"}, 
          React.createElement("p", {className: cx({"error": !!this.props.error,
                            "error-display-area": true})}, 
            mozL10n.get("rooms_change_failed_label")
          ), 
          React.createElement("h2", {className: "room-context-header"}, mozL10n.get("context_inroom_header")), 
          React.createElement("form", {onSubmit: this.handleFormSubmit}, 
            React.createElement("input", {className: "room-context-name", 
              maxLength: this.maxRoomNameLength, 
              onKeyDown: this.handleTextareaKeyDown, 
              placeholder: mozL10n.get("context_edit_name_placeholder"), 
              type: "text", 
              valueLink: this.linkState("newRoomName")}), 
            React.createElement("input", {className: "room-context-url", 
              disabled: availableContext && availableContext.url === this.state.newRoomURL, 
              onKeyDown: this.handleTextareaKeyDown, 
              placeholder: "https://", 
              type: "text", 
              valueLink: this.linkState("newRoomURL")}), 
            React.createElement("textarea", {className: "room-context-comments", 
              onKeyDown: this.handleTextareaKeyDown, 
              placeholder: mozL10n.get("context_edit_comments_placeholder"), 
              rows: "2", type: "text", 
              valueLink: this.linkState("newRoomDescription")}), 
            React.createElement(sharedViews.ButtonGroup, null, 
              React.createElement(sharedViews.Button, {additionalClass: "button-cancel", 
                caption: mozL10n.get("context_cancel_label"), 
                onClick: this.handleCloseClick}), 
              React.createElement(sharedViews.Button, {additionalClass: "button-accept", 
                caption: mozL10n.get("context_done_label"), 
                disabled: this.props.savingContext, 
                onClick: this.handleFormSubmit})
            )
          )
        )
      );
    }
  });

  /**
   * Desktop room conversation view.
   */
  var DesktopRoomConversationView = React.createClass({displayName: "DesktopRoomConversationView",
    mixins: [
      ActiveRoomStoreMixin,
      sharedMixins.DocumentTitleMixin,
      sharedMixins.MediaSetupMixin,
      sharedMixins.RoomsAudioMixin,
      sharedMixins.WindowCloseMixin
    ],

    propTypes: {
      chatWindowDetached: React.PropTypes.bool.isRequired,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      // The poster URLs are for UI-showcase testing and development.
      localPosterUrl: React.PropTypes.string,
      mozLoop: React.PropTypes.object.isRequired,
      onCallTerminated: React.PropTypes.func.isRequired,
      remotePosterUrl: React.PropTypes.string,
      roomStore: React.PropTypes.instanceOf(loop.store.RoomStore).isRequired
    },

    getInitialState: function() {
      return {
        contextEnabled: this.props.mozLoop.getLoopPref("contextInConversations.enabled"),
        showEditContext: false
      };
    },

    componentWillUpdate: function(nextProps, nextState) {
      // The SDK needs to know about the configuration and the elements to use
      // for display. So the best way seems to pass the information here - ideally
      // the sdk wouldn't need to know this, but we can't change that.
      if (this.state.roomState !== ROOM_STATES.MEDIA_WAIT &&
          nextState.roomState === ROOM_STATES.MEDIA_WAIT) {
        this.props.dispatcher.dispatch(new sharedActions.SetupStreamElements({
          publisherConfig: this.getDefaultPublisherConfig({
            publishVideo: !this.state.videoMuted
          })
        }));
      }
    },

    /**
     * User clicked on the "Leave" button.
     */
    leaveRoom: function() {
      if (this.state.used) {
        this.props.dispatcher.dispatch(new sharedActions.LeaveRoom());
      } else {
        this.closeWindow();
      }
    },

    /**
     * Used to control publishing a stream - i.e. to mute a stream
     *
     * @param {String} type The type of stream, e.g. "audio" or "video".
     * @param {Boolean} enabled True to enable the stream, false otherwise.
     */
    publishStream: function(type, enabled) {
      this.props.dispatcher.dispatch(
        new sharedActions.SetMute({
          type: type,
          enabled: enabled
        }));
    },

    /**
     * Determine if the invitation controls should be shown.
     *
     * @return {Boolean} True if there's no guests.
     */
    _shouldRenderInvitationOverlay: function() {
      var hasGuests = typeof this.state.participants === "object" &&
        this.state.participants.filter(function(participant) {
          return !participant.owner;
        }).length > 0;

      // Don't show if the room has participants whether from the room state or
      // there being non-owner guests in the participants array.
      return this.state.roomState !== ROOM_STATES.HAS_PARTICIPANTS && !hasGuests;
    },

    /**
     * Works out if remote video should be rended or not, depending on the
     * room state and other flags.
     *
     * @return {Boolean} True if remote video should be rended.
     *
     * XXX Refactor shouldRenderRemoteVideo & shouldRenderLoading into one fn
     *     that returns an enum
     */
    shouldRenderRemoteVideo: function() {
      switch(this.state.roomState) {
        case ROOM_STATES.HAS_PARTICIPANTS:
          if (this.state.remoteVideoEnabled) {
            return true;
          }

          if (this.state.mediaConnected) {
            // since the remoteVideo hasn't yet been enabled, if the
            // media is connected, then we should be displaying an avatar.
            return false;
          }

          return true;

        case ROOM_STATES.READY:
        case ROOM_STATES.GATHER:
        case ROOM_STATES.INIT:
        case ROOM_STATES.JOINING:
        case ROOM_STATES.SESSION_CONNECTED:
        case ROOM_STATES.JOINED:
        case ROOM_STATES.MEDIA_WAIT:
          // this case is so that we don't show an avatar while waiting for
          // the other party to connect
          return true;

        case ROOM_STATES.CLOSING:
          return true;

        default:
          console.warn("DesktopRoomConversationView.shouldRenderRemoteVideo:" +
            " unexpected roomState: ", this.state.roomState);
          return true;
      }
    },

    /**
     * Should we render a visual cue to the user (e.g. a spinner) that a local
     * stream is on its way from the camera?
     *
     * @returns {boolean}
     * @private
     */
    _isLocalLoading: function () {
      return this.state.roomState === ROOM_STATES.MEDIA_WAIT &&
             !this.state.localSrcMediaElement;
    },

    /**
     * Should we render a visual cue to the user (e.g. a spinner) that a remote
     * stream is on its way from the other user?
     *
     * @returns {boolean}
     * @private
     */
    _isRemoteLoading: function() {
      return !!(this.state.roomState === ROOM_STATES.HAS_PARTICIPANTS &&
                !this.state.remoteSrcMediaElement &&
                !this.state.mediaConnected);
    },

    handleAddContextClick: function() {
      this.setState({ showEditContext: true });
    },

    handleEditContextClick: function() {
      this.setState({ showEditContext: !this.state.showEditContext });
    },

    handleEditContextClose: function() {
      this.setState({ showEditContext: false });
    },

    componentDidUpdate: function(prevProps, prevState) {
      // Handle timestamp and window closing only when the call has terminated.
      if (prevState.roomState === ROOM_STATES.ENDED &&
          this.state.roomState === ROOM_STATES.ENDED) {
        this.props.onCallTerminated();
      }
    },

    render: function() {
      if (this.state.roomName) {
        this.setTitle(this.state.roomName);
      }

      var localStreamClasses = React.addons.classSet({
        local: true,
        "local-stream": true,
        "local-stream-audio": this.state.videoMuted,
        "room-preview": this.state.roomState !== ROOM_STATES.HAS_PARTICIPANTS
      });

      var screenShareData = {
        state: this.state.screenSharingState || SCREEN_SHARE_STATES.INACTIVE,
        visible: true
      };

      var shouldRenderInvitationOverlay = this._shouldRenderInvitationOverlay();
      var shouldRenderEditContextView = this.state.contextEnabled && this.state.showEditContext;
      var roomData = this.props.roomStore.getStoreState("activeRoom");

      switch(this.state.roomState) {
        case ROOM_STATES.FAILED:
        case ROOM_STATES.FULL: {
          // Note: While rooms are set to hold a maximum of 2 participants, the
          //       FULL case should never happen on desktop.
          return (
            React.createElement(RoomFailureView, {
              dispatcher: this.props.dispatcher, 
              failureReason: this.state.failureReason, 
              mozLoop: this.props.mozLoop})
          );
        }
        case ROOM_STATES.ENDED: {
          // When conversation ended we either display a feedback form or
          // close the window. This is decided in the AppControllerView.
          return null;
        }
        default: {
          var settingsMenuItems = [
            {
              id: "edit",
              enabled: !this.state.showEditContext,
              visible: this.state.contextEnabled,
              onClick: this.handleEditContextClick
            },
            { id: "feedback" },
            { id: "help" }
          ];
          return (
            React.createElement("div", {className: "room-conversation-wrapper desktop-room-wrapper"}, 
              React.createElement(sharedViews.MediaLayoutView, {
                dispatcher: this.props.dispatcher, 
                displayScreenShare: false, 
                isLocalLoading: this._isLocalLoading(), 
                isRemoteLoading: this._isRemoteLoading(), 
                isScreenShareLoading: false, 
                localPosterUrl: this.props.localPosterUrl, 
                localSrcMediaElement: this.state.localSrcMediaElement, 
                localVideoMuted: this.state.videoMuted, 
                matchMedia: this.state.matchMedia || window.matchMedia.bind(window), 
                remotePosterUrl: this.props.remotePosterUrl, 
                remoteSrcMediaElement: this.state.remoteSrcMediaElement, 
                renderRemoteVideo: this.shouldRenderRemoteVideo(), 
                screenShareMediaElement: this.state.screenShareMediaElement, 
                screenSharePosterUrl: null, 
                showContextRoomName: false, 
                useDesktopPaths: true}, 
                React.createElement(sharedViews.ConversationToolbar, {
                  audio: {enabled: !this.state.audioMuted, visible: true}, 
                  dispatcher: this.props.dispatcher, 
                  hangup: this.leaveRoom, 
                  mozLoop: this.props.mozLoop, 
                  publishStream: this.publishStream, 
                  screenShare: screenShareData, 
                  settingsMenuItems: settingsMenuItems, 
                  show: !shouldRenderEditContextView, 
                  showHangup: this.props.chatWindowDetached, 
                  video: {enabled: !this.state.videoMuted, visible: true}}), 
                React.createElement(DesktopRoomInvitationView, {
                  dispatcher: this.props.dispatcher, 
                  error: this.state.error, 
                  mozLoop: this.props.mozLoop, 
                  onAddContextClick: this.handleAddContextClick, 
                  onEditContextClose: this.handleEditContextClose, 
                  roomData: roomData, 
                  savingContext: this.state.savingContext, 
                  show: shouldRenderInvitationOverlay, 
                  showEditContext: shouldRenderInvitationOverlay && shouldRenderEditContextView, 
                  socialShareProviders: this.state.socialShareProviders}), 
                React.createElement(DesktopRoomEditContextView, {
                  dispatcher: this.props.dispatcher, 
                  error: this.state.error, 
                  mozLoop: this.props.mozLoop, 
                  onClose: this.handleEditContextClose, 
                  roomData: roomData, 
                  savingContext: this.state.savingContext, 
                  show: !shouldRenderInvitationOverlay && shouldRenderEditContextView})
              )
            )
          );
        }
      }
    }
  });

  return {
    ActiveRoomStoreMixin: ActiveRoomStoreMixin,
    RoomFailureView: RoomFailureView,
    SocialShareDropdown: SocialShareDropdown,
    DesktopRoomEditContextView: DesktopRoomEditContextView,
    DesktopRoomConversationView: DesktopRoomConversationView,
    DesktopRoomInvitationView: DesktopRoomInvitationView
  };

})(document.mozL10n || navigator.mozL10n);
