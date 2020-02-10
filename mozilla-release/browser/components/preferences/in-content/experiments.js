/* global: Services, AddonManager */

var gExperimentsPane = {
  DAT_ADDON_ID: 'dat@cliqz.com',
  init: function ()
  {
    document.getElementById('experimentsBox').parentNode.style.minWidth = '600px';
    document.getElementById('datEnable').addEventListener('click', () => {
      AddonManager.getAddonByID(this.DAT_ADDON_ID).then((addon) => {
        if (addon.isActive) {
          Services.prefs.setBoolPref("extension.cliqz.dat.enabled", false);
          addon.disable();
          // reset dat settings iframe (as extension is now disabled)
          const iframeEl = document.getElementById('theExperimentsFrame');
          if (iframeEl) {
            iframeEl.setAttribute('src', 'about:blank');
          }
        } else {
          Services.prefs.setBoolPref("extension.cliqz.dat.enabled", true);
          addon.enable().then(() => {
            this.loadDatSettings();
          });
        }
      });
    });
  },
  loadFrame: function() {
    this.setDatCheckboxState();
    this.loadDatSettings();
  },
  setDatCheckboxState: function() {
    AddonManager.getAddonByID(this.DAT_ADDON_ID).then((addon) => {
      document.getElementById('datEnable').checked = addon.isActive;
    })
  },
  loadDatSettings: function() {
    const url = CliqzResources.getExtensionURL('/pages/settings.html', 'dat@cliqz.com')
    fetch(url).then((res) => {
      const iframeEl = document.getElementById('theExperimentsFrame');
      if (res.status === 200) {
        // this pref is set to allow requests to this URL to be whitelisted for the about: protocol
        // (see nsDocShell.cpp)
        Services.prefs.setStringPref('extensions.webextensions.datUrl', url);
        if (iframeEl && iframeEl.getAttribute('src') !== url) iframeEl.setAttribute('src', url);
      } else {
        iframeEl.setAttribute('src', 'about:blank');
      }
    }, (err) => {})
  }
};
