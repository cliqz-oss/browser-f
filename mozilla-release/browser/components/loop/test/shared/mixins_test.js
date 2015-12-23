/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

describe("loop.shared.mixins", function() {
  "use strict";

  var expect = chai.expect;
  var sandbox;
  var sharedMixins = loop.shared.mixins;
  var TestUtils = React.addons.TestUtils;
  var ROOM_STATES = loop.store.ROOM_STATES;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
    sharedMixins.setRootObject(window);
  });

  describe("loop.shared.mixins.UrlHashChangeMixin", function() {
    function createTestComponent(onUrlHashChange) {
      var TestComp = React.createClass({
        mixins: [loop.shared.mixins.UrlHashChangeMixin],
        onUrlHashChange: onUrlHashChange || function(){},
        render: function() {
          return React.DOM.div();
        }
      });
      return new React.createElement(TestComp);
    }

    it("should watch for hashchange event", function() {
      var addEventListener = sandbox.spy();
      sharedMixins.setRootObject({
        addEventListener: addEventListener
      });

      TestUtils.renderIntoDocument(createTestComponent());

      sinon.assert.calledOnce(addEventListener);
      sinon.assert.calledWith(addEventListener, "hashchange");
    });

    it("should call onUrlHashChange when the url is updated", function() {
      sharedMixins.setRootObject({
        addEventListener: function(name, cb) {
          if (name === "hashchange") {
            cb();
          }
        }
      });
      var onUrlHashChange = sandbox.stub();

      TestUtils.renderIntoDocument(createTestComponent(onUrlHashChange));

      sinon.assert.calledOnce(onUrlHashChange);
    });
  });

  describe("loop.shared.mixins.DocumentLocationMixin", function() {
    var reloadStub, TestComp;

    beforeEach(function() {
      reloadStub = sandbox.stub();

      sharedMixins.setRootObject({
        location: {
          reload: reloadStub
        }
      });

      TestComp = React.createClass({
        mixins: [loop.shared.mixins.DocumentLocationMixin],
        render: function() {
          return React.DOM.div();
        }
      });
    });

    it("should call window.location.reload", function() {
      var comp = TestUtils.renderIntoDocument(React.createElement(TestComp));

      comp.locationReload();

      sinon.assert.calledOnce(reloadStub);
    });
  });

  describe("loop.shared.mixins.DocumentTitleMixin", function() {
    var TestComp, rootObject;

    beforeEach(function() {
      rootObject = {
        document: {}
      };
      sharedMixins.setRootObject(rootObject);

      TestComp = React.createClass({
        mixins: [loop.shared.mixins.DocumentTitleMixin],
        render: function() {
          return React.DOM.div();
        }
      });
    });

    it("should set window.document.title", function() {
      var comp = TestUtils.renderIntoDocument(React.createElement(TestComp));

      comp.setTitle("It's a Fake!");

      expect(rootObject.document.title).eql("It's a Fake!");
    });
  });


  describe("loop.shared.mixins.WindowCloseMixin", function() {
    var TestComp, rootObject;

    beforeEach(function() {
      rootObject = {
        close: sandbox.stub()
      };
      sharedMixins.setRootObject(rootObject);

      TestComp = React.createClass({
        mixins: [loop.shared.mixins.WindowCloseMixin],
        render: function() {
          return React.DOM.div();
        }
      });
    });

    it("should call window.close", function() {
      var comp = TestUtils.renderIntoDocument(React.createElement(TestComp));

      comp.closeWindow();

      sinon.assert.calledOnce(rootObject.close);
      sinon.assert.calledWithExactly(rootObject.close);
    });
  });

  describe("loop.shared.mixins.DocumentVisibilityMixin", function() {
    var comp, TestComp, onDocumentVisibleStub, onDocumentHiddenStub;

    beforeEach(function() {
      onDocumentVisibleStub = sandbox.stub();
      onDocumentHiddenStub = sandbox.stub();

      TestComp = React.createClass({
        mixins: [loop.shared.mixins.DocumentVisibilityMixin],
        onDocumentHidden: onDocumentHiddenStub,
        onDocumentVisible: onDocumentVisibleStub,
        render: function() {
          return React.DOM.div();
        }
      });
    });

    function setupFakeVisibilityEventDispatcher(event) {
      loop.shared.mixins.setRootObject({
        document: {
          addEventListener: function(_, fn) {
            fn(event);
          },
          removeEventListener: sandbox.stub()
        }
      });
    }

    it("should call onDocumentVisible when document visibility changes to visible",
      function() {
        setupFakeVisibilityEventDispatcher({target: {hidden: false}});

        comp = TestUtils.renderIntoDocument(React.createElement(TestComp));

        // Twice, because it's also called when the component was mounted.
        sinon.assert.calledTwice(onDocumentVisibleStub);
      });

    it("should call onDocumentVisible when document visibility changes to hidden",
      function() {
        setupFakeVisibilityEventDispatcher({target: {hidden: true}});

        comp = TestUtils.renderIntoDocument(React.createElement(TestComp));

        sinon.assert.calledOnce(onDocumentHiddenStub);
      });
  });

  describe("loop.shared.mixins.MediaSetupMixin", function() {
    var view;

    beforeEach(function() {
      var TestComp = React.createClass({
        mixins: [loop.shared.mixins.MediaSetupMixin],
        render: function() {
          return React.DOM.div();
        }
      });

      view = TestUtils.renderIntoDocument(React.createElement(TestComp));
    });

    describe("#getDefaultPublisherConfig", function() {
      it("should throw if publishVideo is not given", function() {
        expect(function() {
          view.getDefaultPublisherConfig();
        }).to.throw(/missing/);
      });

      it("should return a set of defaults based on the options", function() {
        expect(view.getDefaultPublisherConfig({
          publishVideo: true
        }).publishVideo).eql(true);
      });
    });
  });

  describe("loop.shared.mixins.AudioMixin", function() {
    var view, fakeAudio, TestComp;

    beforeEach(function() {
      navigator.mozLoop = {
        doNotDisturb: true,
        getAudioBlob: sinon.spy(function(name, callback) {
          callback(null, new Blob([new ArrayBuffer(10)], {type: "audio/ogg"}));
        }),
        getLoopPref: sandbox.stub()
      };

      fakeAudio = {
        play: sinon.spy(),
        pause: sinon.spy(),
        removeAttribute: sinon.spy()
      };
      sandbox.stub(window, "Audio").returns(fakeAudio);

      TestComp = React.createClass({
        mixins: [loop.shared.mixins.AudioMixin],
        componentDidMount: function() {
          this.play("failure");
        },
        render: function() {
          return React.DOM.div();
        }
      });

    });

    it("should not play a failure sound when doNotDisturb true", function() {
      view = TestUtils.renderIntoDocument(React.createElement(TestComp));
      sinon.assert.notCalled(navigator.mozLoop.getAudioBlob);
      sinon.assert.notCalled(fakeAudio.play);
    });

    it("should play a failure sound, once", function() {
      navigator.mozLoop.doNotDisturb = false;
      view = TestUtils.renderIntoDocument(React.createElement(TestComp));
      sinon.assert.calledOnce(navigator.mozLoop.getAudioBlob);
      sinon.assert.calledWithExactly(navigator.mozLoop.getAudioBlob,
                                     "failure", sinon.match.func);
      sinon.assert.calledOnce(fakeAudio.play);
      expect(fakeAudio.loop).to.equal(false);
    });
  });

  describe("loop.shared.mixins.RoomsAudioMixin", function() {
    var view, fakeAudioMixin, comp;

    function createTestComponent(initialState) {
      var TestComp = React.createClass({
        mixins: [loop.shared.mixins.RoomsAudioMixin],
        render: function() {
          return React.DOM.div();
        },

        getInitialState: function() {
          return { roomState: initialState};
        }
      });

      var renderedComp = TestUtils.renderIntoDocument(
        React.createElement(TestComp));
      sandbox.stub(renderedComp, "play");
      return renderedComp;
    }

    beforeEach(function() {
    });

    it("should play a sound when the local user joins the room", function() {
      comp = createTestComponent(ROOM_STATES.INIT);

      comp.setState({roomState: ROOM_STATES.SESSION_CONNECTED});

      sinon.assert.calledOnce(comp.play);
      sinon.assert.calledWithExactly(comp.play, "room-joined");
    });

    it("should play a sound when another user joins the room", function() {
      comp = createTestComponent(ROOM_STATES.SESSION_CONNECTED);

      comp.setState({roomState: ROOM_STATES.HAS_PARTICIPANTS});

      sinon.assert.calledOnce(comp.play);
      sinon.assert.calledWithExactly(comp.play, "room-joined-in");
    });

    it("should play a sound when another user leaves the room", function() {
      comp = createTestComponent(ROOM_STATES.HAS_PARTICIPANTS);

      comp.setState({roomState: ROOM_STATES.SESSION_CONNECTED});

      sinon.assert.calledOnce(comp.play);
      sinon.assert.calledWithExactly(comp.play, "room-left");
    });

    it("should play a sound when the local user leaves the room", function() {
      comp = createTestComponent(ROOM_STATES.HAS_PARTICIPANTS);

      comp.setState({roomState: ROOM_STATES.READY});

      sinon.assert.calledOnce(comp.play);
      sinon.assert.calledWithExactly(comp.play, "room-left");
    });

    it("should play a sound when if there is a failure", function() {
      comp = createTestComponent(ROOM_STATES.HAS_PARTICIPANTS);

      comp.setState({roomState: ROOM_STATES.FAILED});

      sinon.assert.calledOnce(comp.play);
      sinon.assert.calledWithExactly(comp.play, "failure");
    });

    it("should play a sound when if the room is full", function() {
      comp = createTestComponent(ROOM_STATES.READY);

      comp.setState({roomState: ROOM_STATES.FULL});

      sinon.assert.calledOnce(comp.play);
      sinon.assert.calledWithExactly(comp.play, "failure");
    });
  });
});
