/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/GeckoViewContentModule.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
});

XPCOMUtils.defineLazyGetter(this, "dump", () =>
    Cu.import("resource://gre/modules/AndroidLog.jsm",
              {}).AndroidLog.d.bind(null, "ViewContent"));

function debug(aMsg) {
  // dump(aMsg);
}

class GeckoViewContent extends GeckoViewContentModule {
  register() {
    debug("register");

    addEventListener("DOMTitleChanged", this, false);
    addEventListener("MozDOMFullscreen:Entered", this, false);
    addEventListener("MozDOMFullscreen:Exit", this, false);
    addEventListener("MozDOMFullscreen:Exited", this, false);
    addEventListener("MozDOMFullscreen:Request", this, false);
    addEventListener("contextmenu", this, { capture: true });

    this.messageManager.addMessageListener("GeckoView:DOMFullscreenEntered",
                                           this);
    this.messageManager.addMessageListener("GeckoView:DOMFullscreenExited",
                                           this);
    this.messageManager.addMessageListener("GeckoView:ZoomToInput",
                                           this);
  }

  unregister() {
    debug("unregister");

    removeEventListener("DOMTitleChanged", this);
    removeEventListener("MozDOMFullscreen:Entered", this);
    removeEventListener("MozDOMFullscreen:Exit", this);
    removeEventListener("MozDOMFullscreen:Exited", this);
    removeEventListener("MozDOMFullscreen:Request", this);
    removeEventListener("contextmenu", this, { capture: true });

    this.messageManager.removeMessageListener("GeckoView:DOMFullscreenEntered",
                                              this);
    this.messageManager.removeMessageListener("GeckoView:DOMFullscreenExited",
                                              this);
    this.messageManager.removeMessageListener("GeckoView:ZoomToInput",
                                              this);
  }

  receiveMessage(aMsg) {
    debug("receiveMessage " + aMsg.name);

    switch (aMsg.name) {
      case "GeckoView:DOMFullscreenEntered":
        if (content) {
          content.QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIDOMWindowUtils)
                 .handleFullscreenRequests();
        }
        break;

      case "GeckoView:DOMFullscreenExited":
        if (content) {
          content.QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIDOMWindowUtils)
                 .exitFullscreen();
        }
        break;

      case "GeckoView:ZoomToInput": {
        let dwu = content.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindowUtils);

        let zoomToFocusedInput = function() {
          if (!dwu.flushApzRepaints()) {
            dwu.zoomToFocusedInput();
            return;
          }
          Services.obs.addObserver(function apzFlushDone() {
            Services.obs.removeObserver(apzFlushDone, "apz-repaints-flushed");
            dwu.zoomToFocusedInput();
          }, "apz-repaints-flushed");
        };

        let gotResize = false;
        let onResize = function() {
          gotResize = true;
          if (dwu.isMozAfterPaintPending) {
            addEventListener("MozAfterPaint", function paintDone() {
              removeEventListener("MozAfterPaint", paintDone, {capture: true});
              zoomToFocusedInput();
            }, {capture: true});
          } else {
            zoomToFocusedInput();
          }
        };

        addEventListener("resize", onResize, { capture: true });

        // When the keyboard is displayed, we can get one resize event,
        // multiple resize events, or none at all. Try to handle all these
        // cases by allowing resizing within a set interval, and still zoom to
        // input if there is no resize event at the end of the interval.
        content.setTimeout(() => {
          removeEventListener("resize", onResize, { capture: true });
          if (!gotResize) {
            onResize();
          }
        }, 500);
      }
      break;
    }
  }

  handleEvent(aEvent) {
    debug("handleEvent " + aEvent.type);

    switch (aEvent.type) {
      case "contextmenu":
        function nearestParentHref(node) {
          while (node && !node.href) {
            node = node.parentNode;
          }
          return node && node.href;
        }

        let node = aEvent.target;
        let hrefNode = nearestParentHref(node);
        let isImageNode = (ChromeUtils.getClassName(node) === "HTMLImageElement");
        let isMediaNode = (ChromeUtils.getClassName(node) === "HTMLVideoElement" ||
                           ChromeUtils.getClassName(node) === "HTMLAudioElement");

        if (hrefNode || isImageNode || isMediaNode) {
          this.eventDispatcher.sendRequest({
            type: "GeckoView:ContextMenu",
            screenX: aEvent.screenX,
            screenY: aEvent.screenY,
            uri: hrefNode,
            elementSrc: isImageNode || isMediaNode
                        ? node.currentSrc || node.src
                        : null
          });
          aEvent.preventDefault();
        }
        break;
      case "MozDOMFullscreen:Request":
        sendAsyncMessage("GeckoView:DOMFullscreenRequest");
        break;
      case "MozDOMFullscreen:Entered":
      case "MozDOMFullscreen:Exited":
        // Content may change fullscreen state by itself, and we should ensure
        // that the parent always exits fullscreen when content has left
        // full screen mode.
        if (content && content.document.fullscreenElement) {
          break;
        }
        // fall-through
      case "MozDOMFullscreen:Exit":
        sendAsyncMessage("GeckoView:DOMFullscreenExit");
        break;
      case "DOMTitleChanged":
        this.eventDispatcher.sendRequest({
          type: "GeckoView:DOMTitleChanged",
          title: content.document.title
        });
        break;
    }
  }
}

var contentListener = new GeckoViewContent("GeckoViewContent", this);
