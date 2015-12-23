/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * These tests make sure that focusing the 'New Tage Page' works as expected.
 */
function runTests() {
  // Handle the OSX full keyboard access setting
  Services.prefs.setIntPref("accessibility.tabfocus", 7);

  // Focus count in new tab page.
  // 30 = 9 * 3 + 3 = 9 sites, each with link, pin and remove buttons; search
  // bar; search button; and toggle button. Additionaly there may or may not be
  // a scroll bar caused by fix to 1180387, which will eat an extra focus
  let FOCUS_COUNT = 30;

  // Create a new tab page.
  yield setLinks("0,1,2,3,4,5,6,7,8");
  setPinnedLinks("");

  yield addNewTabPageTab();
  gURLBar.focus();

  // Count the focus with the enabled page.
  yield countFocus(FOCUS_COUNT);

  // Disable page and count the focus with the disabled page.
  NewTabUtils.allPages.enabled = false;
  yield countFocus(1);

  Services.prefs.clearUserPref("accessibility.tabfocus");
  NewTabUtils.allPages.enabled = true;
}

/**
 * Focus the urlbar and count how many focus stops to return again to the urlbar.
 */
function countFocus(aExpectedCount) {
  let focusCount = 0;
  let contentDoc = getContentDocument();

  window.addEventListener("focus", function onFocus() {
    let focusedElement = document.commandDispatcher.focusedElement;
    if (focusedElement && focusedElement.classList.contains("urlbar-input")) {
      window.removeEventListener("focus", onFocus, true);
      // account for a potential presence of a scroll bar
      ok(focusCount == aExpectedCount || focusCount == (aExpectedCount + 1),
         "Validate focus count in the new tab page.");
      executeSoon(TestRunner.next);
    } else {
      if (focusedElement && focusedElement.ownerDocument == contentDoc &&
          focusedElement instanceof HTMLElement) {
        focusCount++;
      }
      document.commandDispatcher.advanceFocus();
    }
  }, true);

  document.commandDispatcher.advanceFocus();
}
