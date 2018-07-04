/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var button, menuButton;
/* Clicking a button should close the panel */
add_task(async function plain_button() {
  button = document.createElement("toolbarbutton");
  button.id = "browser_940307_button";
  button.setAttribute("label", "Button");
  gNavToolbox.palette.appendChild(button);
  CustomizableUI.addWidgetToArea(button.id, CustomizableUI.AREA_FIXED_OVERFLOW_PANEL);

  await waitForOverflowButtonShown();

  await document.getElementById("nav-bar").overflowable.show();
  let hiddenAgain = promiseOverflowHidden(window);
  EventUtils.synthesizeMouseAtCenter(button, {});
  await hiddenAgain;
  CustomizableUI.removeWidgetFromArea(button.id);
  button.remove();
});

add_task(async function searchbar_in_panel() {
  CustomizableUI.addWidgetToArea("search-container",
                                 CustomizableUI.AREA_FIXED_OVERFLOW_PANEL);

  await waitForOverflowButtonShown();

  await document.getElementById("nav-bar").overflowable.show();

  let searchbar = document.getElementById("searchbar");
  await waitForCondition(() => "value" in searchbar && searchbar.value === "");

  // Focusing a non-empty searchbox will cause us to open the
  // autocomplete panel and search for suggestions, which would
  // trigger network requests. Temporarily disable suggestions.
  await SpecialPowers.pushPrefEnv({set: [["browser.search.suggest.enabled", false]]});
  let dontShowPopup = e => e.preventDefault();
  let searchbarPopup = searchbar.textbox.popup;
  searchbarPopup.addEventListener("popupshowing", dontShowPopup);

  searchbar.value = "foo";
  searchbar.focus();
  // Reaching into this context menu is pretty evil, but hey... it's a test.
  let textbox = document.getAnonymousElementByAttribute(searchbar.textbox, "anonid", "textbox-input-box");
  let contextmenu = document.getAnonymousElementByAttribute(textbox, "anonid", "input-box-contextmenu");
  let contextMenuShown = promisePanelElementShown(window, contextmenu);
  EventUtils.synthesizeMouseAtCenter(searchbar, {type: "contextmenu", button: 2});
  await contextMenuShown;

  ok(isOverflowOpen(), "Panel should still be open");

  let selectAll = contextmenu.querySelector("[cmd='cmd_selectAll']");
  let contextMenuHidden = promisePanelElementHidden(window, contextmenu);
  EventUtils.synthesizeMouseAtCenter(selectAll, {});
  await contextMenuHidden;

  ok(isOverflowOpen(), "Panel should still be open");

  let hiddenPanelPromise = promiseOverflowHidden(window);
  EventUtils.synthesizeKey("KEY_Escape");
  await hiddenPanelPromise;
  ok(!isOverflowOpen(), "Panel should no longer be open");

  // Allow search bar popup to show again.
  searchbarPopup.removeEventListener("popupshowing", dontShowPopup);

  // We focused the search bar earlier - ensure we don't keep doing that.
  gURLBar.select();

  CustomizableUI.reset();
});

add_task(async function disabled_button_in_panel() {
  button = document.createElement("toolbarbutton");
  button.id = "browser_946166_button_disabled";
  button.setAttribute("disabled", "true");
  button.setAttribute("label", "Button");
  gNavToolbox.palette.appendChild(button);
  CustomizableUI.addWidgetToArea(button.id, CustomizableUI.AREA_FIXED_OVERFLOW_PANEL);

  await waitForOverflowButtonShown();

  await document.getElementById("nav-bar").overflowable.show();
  EventUtils.synthesizeMouseAtCenter(button, {});
  is(PanelUI.overflowPanel.state, "open", "Popup stays open");
  button.removeAttribute("disabled");
  let hiddenAgain = promiseOverflowHidden(window);
  EventUtils.synthesizeMouseAtCenter(button, {});
  await hiddenAgain;
  button.remove();
});

registerCleanupFunction(function() {
  if (button && button.parentNode) {
    button.remove();
  }
  if (menuButton && menuButton.parentNode) {
    menuButton.remove();
  }
  // Sadly this isn't task.jsm-enabled, so we can't wait for this to happen. But we should
  // definitely close it here and hope it won't interfere with other tests.
  // Of course, all the tests are meant to do this themselves, but if they fail...
  if (isOverflowOpen()) {
    PanelUI.overflowPanel.hidePopup();
  }
  CustomizableUI.reset();
});
