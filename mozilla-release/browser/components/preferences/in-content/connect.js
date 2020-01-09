var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var gConnectPane = {
  init: function ()
  {
    document.getElementById('connectBox').parentNode.style.minWidth = '600px';
  },
  loadFrame: function() {
    const theUrl = CliqzResources.whatIstheURL('pairing/index.html');
    Services.prefs.setStringPref('extensions.webextensions.connectUrl', theUrl);

    const iframeEl = document.getElementById('theConnectFrame');
    if (iframeEl && !iframeEl.getAttribute('src')) iframeEl.setAttribute('src', theUrl);
  }
};
