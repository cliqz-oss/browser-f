function test() {
  waitForExplicitFinish();

  Services.prefs.setBoolPref("browser.search.widget.inNavBar", true);
  let searchBar = BrowserSearch.searchBar;
  searchBar.focus();

  let DOMWindowUtils = EventUtils._getDOMWindowUtils();
  is(DOMWindowUtils.IMEStatus, DOMWindowUtils.IME_STATUS_ENABLED,
     "IME should be available when searchbar has focus");

  let searchPopup = document.getElementById("PopupSearchAutoComplete");
  searchPopup.addEventListener("popupshown", function (aEvent) {
    setTimeout(function () {
      is(DOMWindowUtils.IMEStatus, DOMWindowUtils.IME_STATUS_ENABLED,
         "IME should be available even when the popup of searchbar is open");
      searchPopup.addEventListener("popuphidden", function (aEvent) {
        setTimeout(function () {
          is(DOMWindowUtils.IMEStatus, DOMWindowUtils.IME_STATUS_DISABLED,
             "IME should not be available when menubar is active");
          // Inactivate the menubar (and restore the focus to the searchbar
          EventUtils.synthesizeKey("KEY_Escape");
          is(DOMWindowUtils.IMEStatus, DOMWindowUtils.IME_STATUS_ENABLED,
             "IME should be available after focus is back to the searchbar");
          Services.prefs.clearUserPref("browser.search.widget.inNavBar");
          finish();
        }, 0);
      }, {once: true});
      // Activate the menubar, then, the popup should be closed
      EventUtils.synthesizeKey("KEY_Alt");
    }, 0);
  }, {once: true});
  // Open popup of the searchbar
  EventUtils.synthesizeKey("KEY_F4");
}
