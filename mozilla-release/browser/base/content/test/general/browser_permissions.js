/*
 * Test the Permissions section in the Control Center.
 */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
const PERMISSIONS_PAGE = "http://example.com/browser/browser/base/content/test/general/permissions.html";
var {SitePermissions} = Cu.import("resource:///modules/SitePermissions.jsm", {});

registerCleanupFunction(function() {
  SitePermissions.remove(gBrowser.currentURI, "install");
  while (gBrowser.tabs.length > 1) {
    gBrowser.removeCurrentTab();
  }
});

add_task(function* testMainViewVisible() {
  let {gIdentityHandler} = gBrowser.ownerGlobal;
  let tab = gBrowser.selectedTab = gBrowser.addTab();
  yield promiseTabLoadEvent(tab, PERMISSIONS_PAGE);

  let permissionsList = document.getElementById("identity-popup-permission-list");
  let emptyLabel = permissionsList.nextSibling;

  gIdentityHandler._identityBox.click();
  ok(!is_hidden(emptyLabel), "List of permissions is empty");
  gIdentityHandler._identityPopup.hidden = true;

  gIdentityHandler.setPermission("install", 1);

  gIdentityHandler._identityBox.click();
  ok(is_hidden(emptyLabel), "List of permissions is not empty");

  let labelText = SitePermissions.getPermissionLabel("install");
  let labels = permissionsList.querySelectorAll(".identity-popup-permission-label");
  is(labels.length, 1, "One permission visible in main view");
  is(labels[0].textContent, labelText, "Correct value");

  let menulists = permissionsList.querySelectorAll("menulist");
  is(menulists.length, 1, "One permission visible in main view");
  is(menulists[0].id, "identity-popup-permission:install", "Install permission visible");
  is(menulists[0].value, "1", "Correct value on install menulist");
  gIdentityHandler._identityPopup.hidden = true;

  gIdentityHandler.setPermission("install", SitePermissions.getDefault("install"));

  gIdentityHandler._identityBox.click();
  ok(!is_hidden(emptyLabel), "List of permissions is empty");
  gIdentityHandler._identityPopup.hidden = true;
});
