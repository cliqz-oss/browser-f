var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var gExperimentsPane = {
  init: function ()
  {
    document.getElementById('experimentsBox').parentNode.style.minWidth = '600px';
  },
  loadFrame: function() {
    const theUrl = CliqzResources.getExtensionURL('/pages/settings.html', 'dat@cliqz.com');
    // this pref is set to allow requests to this URL to be whitelisted for the about: protocol
    // (see nsDocShell.cpp)
    Services.prefs.setStringPref('extensions.webextensions.datUrl', theUrl);
    const iframeEl = document.getElementById('theExperimentsFrame');
    if (iframeEl && !iframeEl.getAttribute('src')) iframeEl.setAttribute('src', theUrl);
  }
};
