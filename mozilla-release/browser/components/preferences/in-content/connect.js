ChromeUtils.import("resource:///modules/CliqzResources.jsm");

var gConnectPane = {
  _pane: null,

  init: function ()
  {
    function setEventListener(aId, aEventType, aCallback)
    {
      document.getElementById(aId)
              .addEventListener(aEventType, aCallback.bind(gConnectPane));
    }
    this._pane = document.getElementById("paneConnect");

    document.getElementById('connectBox').parentNode.style.minWidth = '600px';

    if (!CliqzResources.isWebExtensionAPI()) {
      // Inject Iframe on init in case of legacy, legacy extension handles it with hashchange event
      gConnectPane.loadFrame();
    }
  },

  loadFrame: function() {
    const theUrl = CliqzResources.whatIstheURL('pairing/index.html');
    const iframeEl = document.getElementById('theConnectFrame');
    if (iframeEl && !iframeEl.getAttribute('src')) iframeEl.setAttribute('src', theUrl);
  }

};
