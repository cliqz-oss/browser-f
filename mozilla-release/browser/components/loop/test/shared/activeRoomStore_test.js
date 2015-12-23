/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

describe("loop.store.ActiveRoomStore", function () {
  "use strict";

  var expect = chai.expect;
  var sharedActions = loop.shared.actions;
  var REST_ERRNOS = loop.shared.utils.REST_ERRNOS;
  var ROOM_STATES = loop.store.ROOM_STATES;
  var CHAT_CONTENT_TYPES = loop.shared.utils.CHAT_CONTENT_TYPES;
  var FAILURE_DETAILS = loop.shared.utils.FAILURE_DETAILS;
  var SCREEN_SHARE_STATES = loop.shared.utils.SCREEN_SHARE_STATES;
  var ROOM_INFO_FAILURES = loop.shared.utils.ROOM_INFO_FAILURES;
  var sandbox, dispatcher, store, fakeMozLoop, fakeSdkDriver, fakeMultiplexGum;
  var standaloneMediaRestore;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.useFakeTimers();

    dispatcher = new loop.Dispatcher();
    sandbox.stub(dispatcher, "dispatch");
    sandbox.stub(window, "close");

    fakeMozLoop = {
      setLoopPref: sinon.stub(),
      addConversationContext: sinon.stub(),
      addBrowserSharingListener: sinon.stub(),
      removeBrowserSharingListener: sinon.stub(),
      rooms: {
        get: sinon.stub(),
        join: sinon.stub(),
        refreshMembership: sinon.stub(),
        leave: sinon.stub(),
        on: sinon.stub(),
        off: sinon.stub(),
        sendConnectionStatus: sinon.stub()
      },
      setScreenShareState: sinon.stub(),
      getActiveTabWindowId: sandbox.stub().callsArgWith(0, null, 42),
      getSocialShareProviders: sinon.stub().returns([]),
      telemetryAddValue: sinon.stub()
    };

    fakeSdkDriver = {
      connectSession: sinon.stub(),
      disconnectSession: sinon.stub(),
      forceDisconnectAll: sinon.stub().callsArg(0),
      retryPublishWithoutVideo: sinon.stub(),
      startScreenShare: sinon.stub(),
      switchAcquiredWindow: sinon.stub(),
      endScreenShare: sinon.stub().returns(true)
    };

    fakeMultiplexGum = {
      reset: sandbox.spy()
    };

    standaloneMediaRestore = loop.standaloneMedia;
    loop.standaloneMedia = {
      multiplexGum: fakeMultiplexGum
    };

    store = new loop.store.ActiveRoomStore(dispatcher, {
      mozLoop: fakeMozLoop,
      sdkDriver: fakeSdkDriver
    });
  });

  afterEach(function() {
    sandbox.restore();
    loop.standaloneMedia = standaloneMediaRestore;
  });

  describe("#constructor", function() {
    it("should throw an error if mozLoop is missing", function() {
      expect(function() {
        new loop.store.ActiveRoomStore(dispatcher);
      }).to.Throw(/mozLoop/);
    });

    it("should throw an error if sdkDriver is missing", function() {
      expect(function() {
        new loop.store.ActiveRoomStore(dispatcher, {mozLoop: {}});
      }).to.Throw(/sdkDriver/);
    });
  });

  describe("#roomFailure", function() {
    var fakeError;

    beforeEach(function() {
      sandbox.stub(console, "error");

      fakeError = new Error("fake");

      store.setStoreState({
        roomState: ROOM_STATES.JOINED,
        roomToken: "fakeToken",
        sessionToken: "1627384950"
      });
    });

    it("should log the error", function() {
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(console.error);
      sinon.assert.calledWith(console.error,
        sinon.match(ROOM_STATES.JOINED), fakeError);
    });

    it("should set the state to `FULL` on server error room full", function() {
      fakeError.errno = REST_ERRNOS.ROOM_FULL;

      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      expect(store._storeState.roomState).eql(ROOM_STATES.FULL);
    });

    it("should set the state to `FAILED` on generic error", function() {
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      expect(store._storeState.roomState).eql(ROOM_STATES.FAILED);
      expect(store._storeState.failureReason).eql(FAILURE_DETAILS.UNKNOWN);
    });

    it("should set the failureReason to EXPIRED_OR_INVALID on server error: " +
      "invalid token", function() {
        fakeError.errno = REST_ERRNOS.INVALID_TOKEN;

        store.roomFailure(new sharedActions.RoomFailure({
          error: fakeError,
          failedJoinRequest: false
        }));

        expect(store._storeState.roomState).eql(ROOM_STATES.FAILED);
        expect(store._storeState.failureReason).eql(FAILURE_DETAILS.EXPIRED_OR_INVALID);
      });

    it("should set the failureReason to EXPIRED_OR_INVALID on server error: " +
      "expired", function() {
        fakeError.errno = REST_ERRNOS.EXPIRED;

        store.roomFailure(new sharedActions.RoomFailure({
          error: fakeError,
          failedJoinRequest: false
        }));

        expect(store._storeState.roomState).eql(ROOM_STATES.FAILED);
        expect(store._storeState.failureReason).eql(FAILURE_DETAILS.EXPIRED_OR_INVALID);
      });

    it("should reset the multiplexGum", function() {
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(fakeMultiplexGum.reset);
    });

    it("should set screen sharing inactive", function() {
      store.setStoreState({windowId: "1234"});

      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(fakeMozLoop.setScreenShareState);
      sinon.assert.calledWithExactly(fakeMozLoop.setScreenShareState, "1234", false);
    });

    it("should disconnect from the servers via the sdk", function() {
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(fakeSdkDriver.disconnectSession);
    });

    it("should clear any existing timeout", function() {
      sandbox.stub(window, "clearTimeout");
      store._timeout = {};

      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(clearTimeout);
    });

    it("should remove the sharing listener", function() {
      // Setup the listener.
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      // Now simulate room failure.
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(fakeMozLoop.removeBrowserSharingListener);
    });

    it("should call mozLoop.rooms.leave", function() {
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: false
      }));

      sinon.assert.calledOnce(fakeMozLoop.rooms.leave);
      sinon.assert.calledWithExactly(fakeMozLoop.rooms.leave,
        "fakeToken", "1627384950");
    });

    it("should not call mozLoop.rooms.leave if failedJoinRequest is true", function() {
      store.roomFailure(new sharedActions.RoomFailure({
        error: fakeError,
        failedJoinRequest: true
      }));

      sinon.assert.notCalled(fakeMozLoop.rooms.leave);
    });
  });

  describe("#retryAfterRoomFailure", function() {
    beforeEach(function() {
      sandbox.stub(console, "error");
    });

    it("should reject attempts to retry for invalid/expired urls", function() {
      store.setStoreState({
        failureReason: FAILURE_DETAILS.EXPIRED_OR_INVALID
      });

      store.retryAfterRoomFailure();

      sinon.assert.calledOnce(console.error);
      sinon.assert.calledWithMatch(console.error, "Invalid");
      sinon.assert.notCalled(dispatcher.dispatch);
    });

    it("should reject attempts if the failure exit state is not expected", function() {
      store.setStoreState({
        failureReason: FAILURE_DETAILS.UNKNOWN,
        failureExitState: ROOM_STATES.INIT
      });

      store.retryAfterRoomFailure();

      sinon.assert.calledOnce(console.error);
      sinon.assert.calledWithMatch(console.error, "Unexpected");
      sinon.assert.notCalled(dispatcher.dispatch);
    });

    it("should dispatch a FetchServerData action when the exit state is GATHER", function() {
      store.setStoreState({
        failureReason: FAILURE_DETAILS.UNKNOWN,
        failureExitState: ROOM_STATES.GATHER,
        roomCryptoKey: "fakeKey",
        roomToken: "fakeToken"
      });

      store.retryAfterRoomFailure();

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWithExactly(dispatcher.dispatch,
        new sharedActions.FetchServerData({
          cryptoKey: "fakeKey",
          token: "fakeToken",
          windowType: "room"
        }));
    });

    it("should join the room for other states", function() {
      sandbox.stub(store, "joinRoom");

      store.setStoreState({
        failureReason: FAILURE_DETAILS.UNKNOWN,
        failureExitState: ROOM_STATES.MEDIA_WAIT,
        roomCryptoKey: "fakeKey",
        roomToken: "fakeToken"
      });

      store.retryAfterRoomFailure();

      sinon.assert.calledOnce(store.joinRoom);
    });
  });

  describe("#setupWindowData", function() {
    var fakeToken, fakeRoomData;

    beforeEach(function() {
      fakeToken = "337-ff-54";
      fakeRoomData = {
        decryptedContext: {
          roomName: "Monkeys"
        },
        participants: [],
        roomUrl: "http://invalid"
      };

      store = new loop.store.ActiveRoomStore(dispatcher, {
        mozLoop: fakeMozLoop,
        sdkDriver: {}
      });
      fakeMozLoop.rooms.get.withArgs(fakeToken).callsArgOnWith(
        1, // index of callback argument
        store, // |this| to call it on
        null, // args to call the callback with...
        fakeRoomData
      );
    });

    it("should set the state to `GATHER`",
      function() {
        store.setupWindowData(new sharedActions.SetupWindowData({
          windowId: "42",
          type: "room",
          roomToken: fakeToken
        }));

        expect(store.getStoreState()).to.have.property(
          "roomState", ROOM_STATES.GATHER);
      });

    it("should dispatch an SetupRoomInfo action if the get is successful",
      function() {
        store.setupWindowData(new sharedActions.SetupWindowData({
          windowId: "42",
          type: "room",
          roomToken: fakeToken
        }));

        sinon.assert.calledTwice(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.SetupRoomInfo({
            roomContextUrls: undefined,
            roomDescription: undefined,
            participants: [],
            roomToken: fakeToken,
            roomName: fakeRoomData.decryptedContext.roomName,
            roomUrl: fakeRoomData.roomUrl,
            socialShareProviders: []
          }));
      });

    it("should dispatch a JoinRoom action if the get is successful",
      function() {
        store.setupWindowData(new sharedActions.SetupWindowData({
          windowId: "42",
          type: "room",
          roomToken: fakeToken
        }));

        sinon.assert.calledTwice(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.JoinRoom());
      });

    it("should dispatch a RoomFailure action if the get fails",
      function() {

        var fakeError = new Error("fake error");
        fakeMozLoop.rooms.get.withArgs(fakeToken).callsArgOnWith(
          1, // index of callback argument
          store, // |this| to call it on
          fakeError); // args to call the callback with...

        store.setupWindowData(new sharedActions.SetupWindowData({
          windowId: "42",
          type: "room",
          roomToken: fakeToken
        }));

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.RoomFailure({
            error: fakeError,
            failedJoinRequest: false
          }));
      });
  });

  describe("#fetchServerData", function() {
    var fetchServerAction;

    beforeEach(function() {
      fetchServerAction = new sharedActions.FetchServerData({
        windowType: "room",
        token: "fakeToken"
      });
    });

    it("should save the token", function() {
      store.fetchServerData(fetchServerAction);

      expect(store.getStoreState().roomToken).eql("fakeToken");
    });

    it("should set the state to `GATHER`", function() {
      store.fetchServerData(fetchServerAction);

      expect(store.getStoreState().roomState).eql(ROOM_STATES.GATHER);
    });

    it("should call mozLoop.rooms.get to get the room data", function() {
      store.fetchServerData(fetchServerAction);

      sinon.assert.calledOnce(fakeMozLoop.rooms.get);
    });

    it("should dispatch an UpdateRoomInfo message with 'no data' failure if neither roomName nor context are supplied", function() {
      fakeMozLoop.rooms.get.callsArgWith(1, null, {
        roomUrl: "http://invalid"
      });

      store.fetchServerData(fetchServerAction);

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWithExactly(dispatcher.dispatch,
        new sharedActions.UpdateRoomInfo({
          roomInfoFailure: ROOM_INFO_FAILURES.NO_DATA,
          roomState: ROOM_STATES.READY,
          roomUrl: "http://invalid"
        }));
    });

    describe("mozLoop.rooms.get returns roomName as a separate field (no context)", function() {
      it("should dispatch UpdateRoomInfo if mozLoop.rooms.get is successful", function() {
        var roomDetails = {
          roomName: "fakeName",
          roomUrl: "http://invalid"
        };

        fakeMozLoop.rooms.get.callsArgWith(1, null, roomDetails);

        store.fetchServerData(fetchServerAction);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.UpdateRoomInfo(_.extend({
            roomState: ROOM_STATES.READY
          }, roomDetails)));
      });
    });

    describe("mozLoop.rooms.get returns encryptedContext", function() {
      var roomDetails, expectedDetails;

      beforeEach(function() {
        roomDetails = {
          context: {
            value: "fakeContext"
          },
          roomUrl: "http://invalid"
        };
        expectedDetails = {
          roomUrl: "http://invalid"
        };

        fakeMozLoop.rooms.get.callsArgWith(1, null, roomDetails);

        sandbox.stub(loop.crypto, "isSupported").returns(true);
      });

      it("should dispatch UpdateRoomInfo message with 'unsupported' failure if WebCrypto is unsupported", function() {
        loop.crypto.isSupported.returns(false);

        store.fetchServerData(fetchServerAction);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.UpdateRoomInfo(_.extend({
            roomInfoFailure: ROOM_INFO_FAILURES.WEB_CRYPTO_UNSUPPORTED,
            roomState: ROOM_STATES.READY
          }, expectedDetails)));
      });

      it("should dispatch UpdateRoomInfo message with 'no crypto key' failure if there is no crypto key", function() {
        store.fetchServerData(fetchServerAction);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.UpdateRoomInfo(_.extend({
            roomInfoFailure: ROOM_INFO_FAILURES.NO_CRYPTO_KEY,
            roomState: ROOM_STATES.READY
          }, expectedDetails)));
      });

      it("should dispatch UpdateRoomInfo message with 'decrypt failed' failure if decryption failed", function() {
        fetchServerAction.cryptoKey = "fakeKey";

        // This is a work around to turn promise into a sync action to make handling test failures
        // easier.
        sandbox.stub(loop.crypto, "decryptBytes", function() {
          return {
            then: function(resolve, reject) {
              reject(new Error("Operation unsupported"));
            }
          };
        });

        store.fetchServerData(fetchServerAction);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.UpdateRoomInfo(_.extend({
            roomInfoFailure: ROOM_INFO_FAILURES.DECRYPT_FAILED,
            roomState: ROOM_STATES.READY
          }, expectedDetails)));
      });

      it("should dispatch UpdateRoomInfo message with the context if decryption was successful", function() {
        fetchServerAction.cryptoKey = "fakeKey";

        var roomContext = {
          description: "Never gonna let you down. Never gonna give you up...",
          roomName: "The wonderful Loopy room",
          urls: [{
            description: "An invalid page",
            location: "http://invalid.com",
            thumbnail: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
          }]
        };

        // This is a work around to turn promise into a sync action to make handling test failures
        // easier.
        sandbox.stub(loop.crypto, "decryptBytes", function() {
          return {
            then: function(resolve, reject) {
              resolve(JSON.stringify(roomContext));
            }
          };
        });

        store.fetchServerData(fetchServerAction);

        var expectedData = _.extend({
          roomState: ROOM_STATES.READY
        }, roomContext, expectedDetails);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.UpdateRoomInfo(expectedData));
      });
    });
  });

  describe("#videoDimensionsChanged", function() {
    it("should not contain any video dimensions at the very start", function() {
      expect(store.getStoreState()).eql(store.getInitialStoreState());
    });

    it("should update the store with new video dimensions", function() {
      var actionData = {
        isLocal: true,
        videoType: "camera",
        dimensions: { width: 640, height: 480 }
      };

      store.videoDimensionsChanged(new sharedActions.VideoDimensionsChanged(actionData));

      expect(store.getStoreState().localVideoDimensions)
        .to.have.property(actionData.videoType, actionData.dimensions);

      actionData.isLocal = false;
      store.videoDimensionsChanged(new sharedActions.VideoDimensionsChanged(actionData));

      expect(store.getStoreState().remoteVideoDimensions)
        .to.have.property(actionData.videoType, actionData.dimensions);
    });
  });

  describe("#setupRoomInfo", function() {
    var fakeRoomInfo;

    beforeEach(function() {
      fakeRoomInfo = {
        roomName: "Its a room",
        roomToken: "fakeToken",
        roomUrl: "http://invalid",
        socialShareProviders: []
      };
    });

    it("should set the state to READY", function() {
      store.setupRoomInfo(new sharedActions.SetupRoomInfo(fakeRoomInfo));

      expect(store._storeState.roomState).eql(ROOM_STATES.READY);
    });

    it("should save the room information", function() {
      store.setupRoomInfo(new sharedActions.SetupRoomInfo(fakeRoomInfo));

      var state = store.getStoreState();
      expect(state.roomName).eql(fakeRoomInfo.roomName);
      expect(state.roomToken).eql(fakeRoomInfo.roomToken);
      expect(state.roomUrl).eql(fakeRoomInfo.roomUrl);
      expect(state.socialShareProviders).eql([]);
    });
  });

  describe("#updateRoomInfo", function() {
    var fakeRoomInfo;

    beforeEach(function() {
      fakeRoomInfo = {
        roomName: "Its a room",
        roomUrl: "http://invalid",
        urls: [{
          description: "fake site",
          location: "http://invalid.com",
          thumbnail: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
        }]
      };
    });

    it("should save the room information", function() {
      store.updateRoomInfo(new sharedActions.UpdateRoomInfo(fakeRoomInfo));

      var state = store.getStoreState();
      expect(state.roomName).eql(fakeRoomInfo.roomName);
      expect(state.roomUrl).eql(fakeRoomInfo.roomUrl);
      expect(state.roomContextUrls).eql(fakeRoomInfo.urls);
    });
  });

  describe("#updateSocialShareInfo", function() {
    var fakeSocialShareInfo;

    beforeEach(function() {
      fakeSocialShareInfo = {
        socialShareProviders: [{
          name: "foo",
          origin: "https://example.com",
          iconURL: "icon.png"
        }]
      };
    });

    it("should save the Social API information", function() {
      store.updateSocialShareInfo(new sharedActions.UpdateSocialShareInfo(fakeSocialShareInfo));

      var state = store.getStoreState();
      expect(state.socialShareProviders)
        .eql(fakeSocialShareInfo.socialShareProviders);
    });
  });

  describe("#joinRoom", function() {
    beforeEach(function() {
      store.setStoreState({roomState: ROOM_STATES.READY});
    });

    it("should reset failureReason", function() {
      store.setStoreState({failureReason: "Test"});

      store.joinRoom();

      expect(store.getStoreState().failureReason).eql(undefined);
    });

    it("should set the state to MEDIA_WAIT if media devices are present", function() {
      sandbox.stub(loop.shared.utils, "hasAudioOrVideoDevices").callsArgWith(0, true);

      store.joinRoom();

      expect(store.getStoreState().roomState).eql(ROOM_STATES.MEDIA_WAIT);
    });

    it("should not set the state to MEDIA_WAIT if no media devices are present", function() {
      sandbox.stub(loop.shared.utils, "hasAudioOrVideoDevices").callsArgWith(0, false);

      store.joinRoom();

      expect(store.getStoreState().roomState).eql(ROOM_STATES.READY);
    });

    it("should dispatch `ConnectionFailure` if no media devices are present", function() {
      sandbox.stub(loop.shared.utils, "hasAudioOrVideoDevices").callsArgWith(0, false);

      store.joinRoom();

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWithExactly(dispatcher.dispatch,
        new sharedActions.ConnectionFailure({
          reason: FAILURE_DETAILS.NO_MEDIA
        }));
    });
  });

  describe("#gotMediaPermission", function() {
    beforeEach(function() {
      store.setStoreState({roomToken: "tokenFake"});
    });

    it("should set the room state to JOINING", function() {
      store.gotMediaPermission();

      expect(store.getStoreState().roomState).eql(ROOM_STATES.JOINING);
    });

    it("should call rooms.join on mozLoop", function() {
      store.gotMediaPermission();

      sinon.assert.calledOnce(fakeMozLoop.rooms.join);
      sinon.assert.calledWith(fakeMozLoop.rooms.join, "tokenFake");
    });

    it("should dispatch `JoinedRoom` on success", function() {
      var responseData = {
        apiKey: "keyFake",
        sessionToken: "14327659860",
        sessionId: "1357924680",
        expires: 8
      };

      fakeMozLoop.rooms.join.callsArgWith(1, null, responseData);

      store.gotMediaPermission();

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWith(dispatcher.dispatch,
        new sharedActions.JoinedRoom(responseData));
    });

    it("should dispatch `RoomFailure` on error", function() {
      var fakeError = new Error("fake");

      fakeMozLoop.rooms.join.callsArgWith(1, fakeError);

      store.gotMediaPermission();

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWith(dispatcher.dispatch,
        new sharedActions.RoomFailure({
          error: fakeError,
          failedJoinRequest: true
        }));
    });
  });

  describe("#joinedRoom", function() {
    var fakeJoinedData;

    beforeEach(function() {
      fakeJoinedData = {
        apiKey: "9876543210",
        sessionToken: "12563478",
        sessionId: "15263748",
        windowId: "42",
        expires: 20
      };

      store.setStoreState({
        roomToken: "fakeToken"
      });
    });

    it("should set the state to `JOINED`", function() {
      store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

      expect(store._storeState.roomState).eql(ROOM_STATES.JOINED);
    });

    it("should store the session and api values", function() {
      store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

      var state = store.getStoreState();
      expect(state.apiKey).eql(fakeJoinedData.apiKey);
      expect(state.sessionToken).eql(fakeJoinedData.sessionToken);
      expect(state.sessionId).eql(fakeJoinedData.sessionId);
    });

    it("should start the session connection with the sdk", function() {
      var actionData = new sharedActions.JoinedRoom(fakeJoinedData);

      store.joinedRoom(actionData);

      sinon.assert.calledOnce(fakeSdkDriver.connectSession);
      sinon.assert.calledWithExactly(fakeSdkDriver.connectSession,
        actionData);
    });

    it("should pass 'sendTwoWayMediaTelemetry' as true to connectSession if " +
       "store._isDesktop is true", function() {
      store._isDesktop = true;

      store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

      sinon.assert.calledOnce(fakeSdkDriver.connectSession);
      sinon.assert.calledWithMatch(fakeSdkDriver.connectSession,
        sinon.match.has("sendTwoWayMediaTelemetry", true));
    });

    it("should pass 'sendTwoWayTelemetry' as false to connectionSession if " +
       "store._isDesktop is false", function() {
      store._isDesktop = false;

      store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

      sinon.assert.calledOnce(fakeSdkDriver.connectSession);
      sinon.assert.calledWithMatch(fakeSdkDriver.connectSession,
        sinon.match.has("sendTwoWayMediaTelemetry", false));
    });

    it("should call mozLoop.addConversationContext", function() {
      var actionData = new sharedActions.JoinedRoom(fakeJoinedData);

      store.setupWindowData(new sharedActions.SetupWindowData({
        windowId: "42",
        type: "room"
      }));

      store.joinedRoom(actionData);

      sinon.assert.calledOnce(fakeMozLoop.addConversationContext);
      sinon.assert.calledWithExactly(fakeMozLoop.addConversationContext,
                                     "42", "15263748", "");
    });

    it("should call mozLoop.rooms.refreshMembership before the expiresTime",
      function() {
        store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

        sandbox.clock.tick(fakeJoinedData.expires * 1000);

        sinon.assert.calledOnce(fakeMozLoop.rooms.refreshMembership);
        sinon.assert.calledWith(fakeMozLoop.rooms.refreshMembership,
          "fakeToken", "12563478");
    });

    it("should call mozLoop.rooms.refreshMembership before the next expiresTime",
      function() {
        fakeMozLoop.rooms.refreshMembership.callsArgWith(2,
          null, {expires: 40});

        store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

        // Clock tick for the first expiry time (which
        // sets up the refreshMembership).
        sandbox.clock.tick(fakeJoinedData.expires * 1000);

        // Clock tick for expiry time in the refresh membership response.
        sandbox.clock.tick(40000);

        sinon.assert.calledTwice(fakeMozLoop.rooms.refreshMembership);
        sinon.assert.calledWith(fakeMozLoop.rooms.refreshMembership,
          "fakeToken", "12563478");
    });

    it("should dispatch `RoomFailure` if the refreshMembership call failed",
      function() {
        var fakeError = new Error("fake");
        fakeMozLoop.rooms.refreshMembership.callsArgWith(2, fakeError);

        store.joinedRoom(new sharedActions.JoinedRoom(fakeJoinedData));

        // Clock tick for the first expiry time (which
        // sets up the refreshMembership).
        sandbox.clock.tick(fakeJoinedData.expires * 1000);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWith(dispatcher.dispatch,
          new sharedActions.RoomFailure({
            error: fakeError,
            failedJoinRequest: false
          }));
    });
  });

  describe("#connectedToSdkServers", function() {
    it("should set the state to `SESSION_CONNECTED`", function() {
      store.connectedToSdkServers(new sharedActions.ConnectedToSdkServers());

      expect(store.getStoreState().roomState).eql(ROOM_STATES.SESSION_CONNECTED);
    });
  });

  describe("#connectionFailure", function() {
    var connectionFailureAction;

    beforeEach(function() {
      store.setStoreState({
        roomState: ROOM_STATES.JOINED,
        roomToken: "fakeToken",
        sessionToken: "1627384950"
      });

      connectionFailureAction = new sharedActions.ConnectionFailure({
        reason: "FAIL"
      });
    });

    it("should store the failure reason", function() {
      store.connectionFailure(connectionFailureAction);

      expect(store.getStoreState().failureReason).eql("FAIL");
    });

    it("should reset the multiplexGum", function() {
      store.connectionFailure(connectionFailureAction);

      sinon.assert.calledOnce(fakeMultiplexGum.reset);
    });

    it("should set screen sharing inactive", function() {
      store.setStoreState({windowId: "1234"});

      store.connectionFailure(connectionFailureAction);

      sinon.assert.calledOnce(fakeMozLoop.setScreenShareState);
      sinon.assert.calledWithExactly(fakeMozLoop.setScreenShareState, "1234", false);
    });

    it("should disconnect from the servers via the sdk", function() {
      store.connectionFailure(connectionFailureAction);

      sinon.assert.calledOnce(fakeSdkDriver.disconnectSession);
    });

    it("should clear any existing timeout", function() {
      sandbox.stub(window, "clearTimeout");
      store._timeout = {};

      store.connectionFailure(connectionFailureAction);

      sinon.assert.calledOnce(clearTimeout);
    });

    it("should call mozLoop.rooms.leave", function() {
      store.connectionFailure(connectionFailureAction);

      sinon.assert.calledOnce(fakeMozLoop.rooms.leave);
      sinon.assert.calledWithExactly(fakeMozLoop.rooms.leave,
        "fakeToken", "1627384950");
    });

    it("should remove the sharing listener", function() {
      // Setup the listener.
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      // Now simulate connection failure.
      store.connectionFailure(connectionFailureAction);

      sinon.assert.calledOnce(fakeMozLoop.removeBrowserSharingListener);
    });

    it("should set the state to `FAILED`", function() {
      store.connectionFailure(connectionFailureAction);

      expect(store.getStoreState().roomState).eql(ROOM_STATES.FAILED);
    });
  });

  describe("#setMute", function() {
    it("should save the mute state for the audio stream", function() {
      store.setStoreState({audioMuted: false});

      store.setMute(new sharedActions.SetMute({
        type: "audio",
        enabled: true
      }));

      expect(store.getStoreState().audioMuted).eql(false);
    });

    it("should save the mute state for the video stream", function() {
      store.setStoreState({videoMuted: true});

      store.setMute(new sharedActions.SetMute({
        type: "video",
        enabled: false
      }));

      expect(store.getStoreState().videoMuted).eql(true);
    });
  });

  describe("#mediaStreamCreated", function() {
    var fakeStreamElement;

    beforeEach(function() {
      fakeStreamElement = {name: "fakeStreamElement"};
    });

    it("should add a local video object to the store", function() {
      expect(store.getStoreState()).to.not.have.property("localSrcMediaElement");

      store.mediaStreamCreated(new sharedActions.MediaStreamCreated({
        hasVideo: false,
        isLocal: true,
        srcMediaElement: fakeStreamElement
      }));

      expect(store.getStoreState().localSrcMediaElement).eql(fakeStreamElement);
      expect(store.getStoreState()).to.not.have.property("remoteSrcMediaElement");
    });

    it("should set the local video enabled", function() {
      store.setStoreState({
        localVideoEnabled: false,
        remoteVideoEnabled: false
      });

      store.mediaStreamCreated(new sharedActions.MediaStreamCreated({
        hasVideo: true,
        isLocal: true,
        srcMediaElement: fakeStreamElement
      }));

      expect(store.getStoreState().localVideoEnabled).eql(true);
      expect(store.getStoreState().remoteVideoEnabled).eql(false);
    });

    it("should add a remote video object to the store", function() {
      expect(store.getStoreState()).to.not.have.property("remoteSrcMediaElement");

      store.mediaStreamCreated(new sharedActions.MediaStreamCreated({
        hasVideo: false,
        isLocal: false,
        srcMediaElement: fakeStreamElement
      }));

      expect(store.getStoreState()).not.have.property("localSrcMediaElement");
      expect(store.getStoreState().remoteSrcMediaElement).eql(fakeStreamElement);
    });

    it("should set the remote video enabled", function() {
      store.setStoreState({
        localVideoEnabled: false,
        remoteVideoEnabled: false
      });

      store.mediaStreamCreated(new sharedActions.MediaStreamCreated({
        hasVideo: true,
        isLocal: false,
        srcMediaElement: fakeStreamElement
      }));

      expect(store.getStoreState().localVideoEnabled).eql(false);
      expect(store.getStoreState().remoteVideoEnabled).eql(true);
    });
  });

  describe("#mediaStreamDestroyed", function() {
    var fakeStreamElement;

    beforeEach(function() {
      fakeStreamElement = {name: "fakeStreamElement"};

      store.setStoreState({
        localSrcMediaElement: fakeStreamElement,
        remoteSrcMediaElement: fakeStreamElement
      });
    });

    it("should clear the local video object", function() {
      store.mediaStreamDestroyed(new sharedActions.MediaStreamDestroyed({
        isLocal: true
      }));

      expect(store.getStoreState().localSrcMediaElement).eql(null);
      expect(store.getStoreState().remoteSrcMediaElement).eql(fakeStreamElement);
    });

    it("should clear the remote video object", function() {
      store.mediaStreamDestroyed(new sharedActions.MediaStreamDestroyed({
        isLocal: false
      }));

      expect(store.getStoreState().localSrcMediaElement).eql(fakeStreamElement);
      expect(store.getStoreState().remoteSrcMediaElement).eql(null);
    });
  });

  describe("#remoteVideoStatus", function() {
    it("should set remoteVideoEnabled to true", function() {
      store.setStoreState({
        remoteVideoEnabled: false
      });

      store.remoteVideoStatus(new sharedActions.RemoteVideoStatus({
        videoEnabled: true
      }));

      expect(store.getStoreState().remoteVideoEnabled).eql(true);
    });

    it("should set remoteVideoEnabled to false", function() {
      store.setStoreState({
        remoteVideoEnabled: true
      });

      store.remoteVideoStatus(new sharedActions.RemoteVideoStatus({
        videoEnabled: false
      }));

      expect(store.getStoreState().remoteVideoEnabled).eql(false);
    });
  });

  describe("#mediaConnected", function() {
    it("should set mediaConnected to true", function() {
      store.mediaConnected();

      expect(store.getStoreState().mediaConnected).eql(true);
    });
  });

  describe("#screenSharingState", function() {
    beforeEach(function() {
      store.setStoreState({windowId: "1234"});
    });

    it("should save the state", function() {
      store.screenSharingState(new sharedActions.ScreenSharingState({
        state: SCREEN_SHARE_STATES.ACTIVE
      }));

      expect(store.getStoreState().screenSharingState).eql(SCREEN_SHARE_STATES.ACTIVE);
    });

    it("should set screen sharing active when the state is active", function() {
      store.screenSharingState(new sharedActions.ScreenSharingState({
        state: SCREEN_SHARE_STATES.ACTIVE
      }));

      sinon.assert.calledOnce(fakeMozLoop.setScreenShareState);
      sinon.assert.calledWithExactly(fakeMozLoop.setScreenShareState, "1234", true);
    });

    it("should set screen sharing inactive when the state is inactive", function() {
      store.screenSharingState(new sharedActions.ScreenSharingState({
        state: SCREEN_SHARE_STATES.INACTIVE
      }));

      sinon.assert.calledOnce(fakeMozLoop.setScreenShareState);
      sinon.assert.calledWithExactly(fakeMozLoop.setScreenShareState, "1234", false);
    });
  });

  describe("#receivingScreenShare", function() {
    it("should save the state", function() {
      store.receivingScreenShare(new sharedActions.ReceivingScreenShare({
        receiving: true
      }));

      expect(store.getStoreState().receivingScreenShare).eql(true);
    });

    it("should add a screenShareMediaElement to the store when sharing is active", function() {
      var fakeStreamElement = {name: "fakeStreamElement"};
      expect(store.getStoreState()).to.not.have.property("screenShareMediaElement");

      store.receivingScreenShare(new sharedActions.ReceivingScreenShare({
        receiving: true,
        srcMediaElement: fakeStreamElement
      }));

      expect(store.getStoreState()).to.have.property("screenShareMediaElement",
        fakeStreamElement);
    });

    it("should clear the screenShareMediaElement from the store when sharing is inactive", function() {
      store.setStoreState({
        screenShareMediaElement: {
          name: "fakeStreamElement"
        }
      });

      store.receivingScreenShare(new sharedActions.ReceivingScreenShare({
        receiving: false,
        srcMediaElement: null
      }));

      expect(store.getStoreState().screenShareMediaElement).eql(null);
    });

    it("should delete the screen remote video dimensions if screen sharing is not active", function() {
      store.setStoreState({
        remoteVideoDimensions: {
          screen: {fake: 10},
          camera: {fake: 20}
        }
      });

      store.receivingScreenShare(new sharedActions.ReceivingScreenShare({
        receiving: false
      }));

      expect(store.getStoreState().remoteVideoDimensions).eql({
        camera: {fake: 20}
      });
    });
  });

  describe("#startScreenShare", function() {
    it("should set the state to 'pending'", function() {
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "window"
      }));

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWith(dispatcher.dispatch,
        new sharedActions.ScreenSharingState({
          state: SCREEN_SHARE_STATES.PENDING
        }));
    });

    it("should invoke the SDK driver with the correct options for window sharing", function() {
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "window"
      }));

      sinon.assert.calledOnce(fakeSdkDriver.startScreenShare);
      sinon.assert.calledWith(fakeSdkDriver.startScreenShare, {
        videoSource: "window"
      });
    });

    it("should add a browser sharing listener for tab sharing", function() {
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      sinon.assert.calledOnce(fakeMozLoop.addBrowserSharingListener);
    });

    it("should invoke the SDK driver with the correct options for tab sharing", function() {
      fakeMozLoop.addBrowserSharingListener.callsArgWith(0, null, 42);

      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      sinon.assert.calledOnce(fakeSdkDriver.startScreenShare);
      sinon.assert.calledWith(fakeSdkDriver.startScreenShare, {
        videoSource: "browser",
        constraints: {
          browserWindow: 42,
          scrollWithPage: true
        }
      });
    });
  });

  describe("Screen share Events", function() {
    var listener;

    beforeEach(function() {
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      // Listener is the first argument of the first call.
      listener = fakeMozLoop.addBrowserSharingListener.args[0][0];

      store.setStoreState({
        screenSharingState: SCREEN_SHARE_STATES.ACTIVE
      });

      // Stub to prevent errors surfacing in the console.
      sandbox.stub(window.console, "error");
    });

    it("should log an error in the console", function() {
      listener(new Error("foo"));

      sinon.assert.calledOnce(console.error);
    });

    it("should update the SDK driver when a new window id is received", function() {
      listener(null, 72);

      sinon.assert.calledOnce(fakeSdkDriver.switchAcquiredWindow);
      sinon.assert.calledWithExactly(fakeSdkDriver.switchAcquiredWindow, 72);
    });

    it("should end the screen sharing session when the listener receives an error", function() {
      listener(new Error("foo"));

      // The dispatcher was already called once in beforeEach().
      sinon.assert.calledTwice(dispatcher.dispatch);
      sinon.assert.calledWith(dispatcher.dispatch,
        new sharedActions.ScreenSharingState({
          state: SCREEN_SHARE_STATES.INACTIVE
        }));
      sinon.assert.notCalled(fakeSdkDriver.switchAcquiredWindow);
    });
  });

  describe("#endScreenShare", function() {
    it("should set the state to 'inactive'", function() {
      store.endScreenShare();

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWith(dispatcher.dispatch,
        new sharedActions.ScreenSharingState({
          state: SCREEN_SHARE_STATES.INACTIVE
        }));
    });

    it("should remove the sharing listener", function() {
      // Setup the listener.
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      // Now stop the screen share.
      store.endScreenShare();

      sinon.assert.calledOnce(fakeMozLoop.removeBrowserSharingListener);
    });
  });

  describe("#remotePeerConnected", function() {
    it("should set the state to `HAS_PARTICIPANTS`", function() {
      store.remotePeerConnected();

      expect(store.getStoreState().roomState).eql(ROOM_STATES.HAS_PARTICIPANTS);
    });
  });

  describe("#remotePeerDisconnected", function() {
    it("should set the state to `SESSION_CONNECTED`", function() {
      store.remotePeerDisconnected();

      expect(store.getStoreState().roomState).eql(ROOM_STATES.SESSION_CONNECTED);
    });

    it("should clear the mediaConnected state", function() {
      store.setStoreState({
        mediaConnected: true
      });

      store.remotePeerDisconnected();

      expect(store.getStoreState().mediaConnected).eql(false);
    });

    it("should clear the remoteSrcMediaElement", function() {
      store.setStoreState({
        remoteSrcMediaElement: { name: "fakeStreamElement" }
      });

      store.remotePeerDisconnected();

      expect(store.getStoreState().remoteSrcMediaElement).eql(null);
    });

    it("should remove non-owner participants", function() {
      store.setStoreState({
        participants: [{owner: true}, {}]
      });

      store.remotePeerDisconnected();

      var participants = store.getStoreState().participants;
      expect(participants).to.have.length.of(1);
      expect(participants[0].owner).eql(true);
    });

    it("should keep the owner participant", function() {
      store.setStoreState({
        participants: [{owner: true}]
      });

      store.remotePeerDisconnected();

      var participants = store.getStoreState().participants;
      expect(participants).to.have.length.of(1);
      expect(participants[0].owner).eql(true);
    });
  });

  describe("#connectionStatus", function() {
    it("should call rooms.sendConnectionStatus on mozLoop", function() {
      store.setStoreState({
        roomToken: "fakeToken",
        sessionToken: "9876543210"
      });

      var data = new sharedActions.ConnectionStatus({
        event: "Publisher.streamCreated",
        state: "sendrecv",
        connections: 2,
        recvStreams: 1,
        sendStreams: 2
      });

      store.connectionStatus(data);

      sinon.assert.calledOnce(fakeMozLoop.rooms.sendConnectionStatus);
      sinon.assert.calledWith(fakeMozLoop.rooms.sendConnectionStatus,
        "fakeToken", "9876543210", data);
    });
  });

  describe("#windowUnload", function() {
    beforeEach(function() {
      store.setStoreState({
        roomState: ROOM_STATES.JOINED,
        roomToken: "fakeToken",
        sessionToken: "1627384950",
        windowId: "1234"
      });
    });

    it("should set screen sharing inactive", function() {
      store.screenSharingState(new sharedActions.ScreenSharingState({
        state: SCREEN_SHARE_STATES.INACTIVE
      }));

      sinon.assert.calledOnce(fakeMozLoop.setScreenShareState);
      sinon.assert.calledWithExactly(fakeMozLoop.setScreenShareState, "1234", false);
    });

    it("should reset the multiplexGum", function() {
      store.windowUnload();

      sinon.assert.calledOnce(fakeMultiplexGum.reset);
    });

    it("should disconnect from the servers via the sdk", function() {
      store.windowUnload();

      sinon.assert.calledOnce(fakeSdkDriver.disconnectSession);
    });

    it("should clear any existing timeout", function() {
      sandbox.stub(window, "clearTimeout");
      store._timeout = {};

      store.windowUnload();

      sinon.assert.calledOnce(clearTimeout);
    });

    it("should call mozLoop.rooms.leave", function() {
      store.windowUnload();

      sinon.assert.calledOnce(fakeMozLoop.rooms.leave);
      sinon.assert.calledWithExactly(fakeMozLoop.rooms.leave,
        "fakeToken", "1627384950");
    });

    it("should call mozLoop.rooms.leave if the room state is JOINING",
      function() {
        store.setStoreState({roomState: ROOM_STATES.JOINING});

        store.windowUnload();

        sinon.assert.calledOnce(fakeMozLoop.rooms.leave);
        sinon.assert.calledWithExactly(fakeMozLoop.rooms.leave,
          "fakeToken", "1627384950");
      });

    it("should remove the sharing listener", function() {
      // Setup the listener.
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      // Now unload the window.
      store.windowUnload();

      sinon.assert.calledOnce(fakeMozLoop.removeBrowserSharingListener);
    });

    it("should set the state to CLOSING", function() {
      store.windowUnload();

      expect(store._storeState.roomState).eql(ROOM_STATES.CLOSING);
    });
  });

  describe("#leaveRoom", function() {
    beforeEach(function() {
      store.setStoreState({
        roomState: ROOM_STATES.JOINED,
        roomToken: "fakeToken",
        sessionToken: "1627384950"
      });
    });

    it("should reset the multiplexGum", function() {
      store.leaveRoom();

      sinon.assert.calledOnce(fakeMultiplexGum.reset);
    });

    it("should disconnect from the servers via the sdk", function() {
      store.leaveRoom();

      sinon.assert.calledOnce(fakeSdkDriver.disconnectSession);
    });

    it("should clear any existing timeout", function() {
      sandbox.stub(window, "clearTimeout");
      store._timeout = {};

      store.leaveRoom();

      sinon.assert.calledOnce(clearTimeout);
    });

    it("should call mozLoop.rooms.leave", function() {
      store.leaveRoom();

      sinon.assert.calledOnce(fakeMozLoop.rooms.leave);
      sinon.assert.calledWithExactly(fakeMozLoop.rooms.leave,
        "fakeToken", "1627384950");
    });

    it("should remove the sharing listener", function() {
      // Setup the listener.
      store.startScreenShare(new sharedActions.StartScreenShare({
        type: "browser"
      }));

      // Now leave the room.
      store.leaveRoom();

      sinon.assert.calledOnce(fakeMozLoop.removeBrowserSharingListener);
    });

    it("should set the state to ENDED", function() {
      store.leaveRoom();

      expect(store._storeState.roomState).eql(ROOM_STATES.ENDED);
    });

    it("should reset various store states", function() {
      store.setStoreState({
        audioMuted: true,
        localVideoDimensions: { x: 10 },
        receivingScreenShare: true,
        remoteVideoDimensions: { y: 10 },
        screenSharingState: true,
        videoMuted: true,
        chatMessageExchanged: false
      });

      store.leaveRoom();

      expect(store._storeState.audioMuted).eql(false);
      expect(store._storeState.localVideoDimensions).eql({});
      expect(store._storeState.receivingScreenShare).eql(false);
      expect(store._storeState.remoteVideoDimensions).eql({});
      expect(store._storeState.screenSharingState).eql(SCREEN_SHARE_STATES.INACTIVE);
      expect(store._storeState.videoMuted).eql(false);
      expect(store._storeState.chatMessageExchanged).eql(false);
    });

    it("should not reset the room context", function() {
      store.setStoreState({
        roomContextUrls: [{ fake: 1 }],
        roomName: "fred"
      });

      store.leaveRoom();

      expect(store._storeState.roomName).eql("fred");
      expect(store._storeState.roomContextUrls).eql([{ fake: 1 }]);
    });
  });

  describe("#_handleSocialShareUpdate", function() {
    it("should dispatch an UpdateRoomInfo action", function() {
      store._handleSocialShareUpdate();

      sinon.assert.calledOnce(dispatcher.dispatch);
      sinon.assert.calledWithExactly(dispatcher.dispatch,
        new sharedActions.UpdateSocialShareInfo({
          socialShareProviders: []
        }));
    });

    it("should call respective mozLoop methods", function() {
      store._handleSocialShareUpdate();

      sinon.assert.calledOnce(fakeMozLoop.getSocialShareProviders);
    });
  });

  describe("#_handleTextChatMessage", function() {
    beforeEach(function() {
      store._isDesktop = true;
      store.setupWindowData(new sharedActions.SetupWindowData({
        windowId: "42",
        type: "room",
        roomToken: "fakeToken"
      }));
    });

    function assertWeDidNothing() {
      expect(dispatcher._eventData.receivedTextChatMessage.length).eql(1);
      expect(dispatcher._eventData.sendTextChatMessage.length).eql(1);
      expect(store.getStoreState().chatMessageExchanged).eql(false);
      sinon.assert.notCalled(fakeMozLoop.telemetryAddValue);
    }

    it("should not do anything for the link clicker side", function() {
      store._isDesktop = false;

      store._handleTextChatMessage(new sharedActions.SendTextChatMessage({
        contentType: CHAT_CONTENT_TYPES.TEXT,
        message: "Hello!",
        sentTimestamp: "1970-01-01T00:00:00.000Z"
      }));

      assertWeDidNothing();
    });

    it("should not do anything when a chat message has arrived before", function() {
      store.setStoreState({ chatMessageExchanged: true });

      store._handleTextChatMessage(new sharedActions.ReceivedTextChatMessage({
        contentType: CHAT_CONTENT_TYPES.TEXT,
        message: "Hello!",
        receivedTimestamp: "1970-01-01T00:00:00.000Z"
      }));

      sinon.assert.notCalled(fakeMozLoop.telemetryAddValue);
    });

    it("should not do anything for non-chat messages", function() {
      store._handleTextChatMessage(new sharedActions.SendTextChatMessage({
        contentType: CHAT_CONTENT_TYPES.CONTEXT,
        message: "Hello!",
        sentTimestamp: "1970-01-01T00:00:00.000Z"
      }));

      assertWeDidNothing();
    });

    it("should ping telemetry when a chat message arrived or is to be sent", function() {
      store._handleTextChatMessage(new sharedActions.ReceivedTextChatMessage({
        contentType: CHAT_CONTENT_TYPES.TEXT,
        message: "Hello!",
        receivedTimestamp: "1970-01-01T00:00:00.000Z"
      }));

      sinon.assert.calledOnce(fakeMozLoop.telemetryAddValue);
      sinon.assert.calledWithExactly(fakeMozLoop.telemetryAddValue,
        "LOOP_ROOM_SESSION_WITHCHAT", 1);
      expect(store.getStoreState().chatMessageExchanged).eql(true);
      expect(dispatcher._eventData.hasOwnProperty("receivedTextChatMessage")).eql(false);
      expect(dispatcher._eventData.hasOwnProperty("sendTextChatMessage")).eql(false);
    });
  });

  describe("Events", function() {
    describe("update:{roomToken}", function() {
      beforeEach(function() {
        store.setupRoomInfo(new sharedActions.SetupRoomInfo({
          roomName: "Its a room",
          roomToken: "fakeToken",
          roomUrl: "http://invalid",
          socialShareProviders: []
        }));
      });

      it("should dispatch an UpdateRoomInfo action", function() {
        sinon.assert.calledTwice(fakeMozLoop.rooms.on);

        var fakeRoomData = {
          decryptedContext: {
            description: "fakeDescription",
            roomName: "fakeName",
            urls: {
              fake: "url"
            }
          },
          roomUrl: "original"
        };

        fakeMozLoop.rooms.on.callArgWith(1, "update", fakeRoomData);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.UpdateRoomInfo({
            description: "fakeDescription",
            participants: undefined,
            roomName: fakeRoomData.decryptedContext.roomName,
            roomUrl: fakeRoomData.roomUrl,
            urls: {
              fake: "url"
            }
          }));
      });

      it("should call close window", function() {
        var fakeRoomData = {
          decryptedContext: {
            description: "fakeDescription",
            roomName: "fakeName",
            urls: {
              fake: "url"
            }
          },
          roomUrl: "original"
        };

        fakeMozLoop.rooms.on.callArgWith(1, "update", fakeRoomData);

        sinon.assert.calledOnce(window.close);
      });
    });

    describe("delete:{roomToken}", function() {
      var fakeRoomData = {
        decryptedContext: {
          roomName: "Its a room"
        },
        roomToken: "fakeToken",
        roomUrl: "http://invalid"
      };

      beforeEach(function() {
        store.setupRoomInfo(new sharedActions.SetupRoomInfo(
          _.extend(fakeRoomData, {
            socialShareProviders: []
          })
        ));
      });

      it("should disconnect all room connections", function() {
        fakeMozLoop.rooms.on.callArgWith(1, "delete:" + fakeRoomData.roomToken, fakeRoomData);

        sinon.assert.calledOnce(fakeSdkDriver.forceDisconnectAll);
      });

      it("should not disconnect anything when another room is deleted", function() {
        fakeMozLoop.rooms.on.callArgWith(1, "delete:invalidToken", fakeRoomData);

        sinon.assert.calledOnce(fakeSdkDriver.forceDisconnectAll);
      });
    });
  });
});
