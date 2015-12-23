"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
const CONTROL_CENTER_PANEL = gIdentityHandler._identityPopup;
const CONTROL_CENTER_MENU_NAME = "controlCenter";

var gTestTab;
var gContentAPI;
var gContentWindow;

function test() {
  UITourTest();
}

var tests = [
  taskify(function* test_showMenu() {
    is_element_hidden(CONTROL_CENTER_PANEL, "Panel should initially be hidden");
    yield showMenuPromise(CONTROL_CENTER_MENU_NAME);
    is_element_visible(CONTROL_CENTER_PANEL, "Panel should be visible after showMenu");

    yield gURLBar.focus();
    is_element_visible(CONTROL_CENTER_PANEL, "Panel should remain visible after focus outside");

    yield showMenuPromise(CONTROL_CENTER_MENU_NAME);
    is_element_visible(CONTROL_CENTER_PANEL,
                       "Panel should remain visible and callback called after a 2nd showMenu");

    yield BrowserTestUtils.withNewTab({
      gBrowser,
      url: "about:blank"
    }, function*() {
      ok(true, "Tab opened");
    });

    is_element_hidden(CONTROL_CENTER_PANEL, "Panel should hide upon tab switch");
  }),

  taskify(function* test_hideMenu() {
    is_element_hidden(CONTROL_CENTER_PANEL, "Panel should initially be hidden");
    yield showMenuPromise(CONTROL_CENTER_MENU_NAME);
    is_element_visible(CONTROL_CENTER_PANEL, "Panel should be visible after showMenu");
    let hidePromise = promisePanelElementHidden(window, CONTROL_CENTER_PANEL);
    gContentAPI.hideMenu(CONTROL_CENTER_MENU_NAME);
    yield hidePromise;

    is_element_hidden(CONTROL_CENTER_PANEL, "Panel should hide after hideMenu");
  }),
];
