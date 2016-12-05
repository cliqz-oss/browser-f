var gPairingPane = {
  _pane: null,

  init: function ()
  {
    function setEventListener(aId, aEventType, aCallback)
    {
      document.getElementById(aId)
              .addEventListener(aEventType, aCallback.bind(gPairingPane));
    }
    this._pane = document.getElementById("panePairing");
  },

};
