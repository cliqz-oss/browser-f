/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

const WindowWatcher = {
  openWindow(aParent, aUrl, aName, aFeatures, aArgs) {
    check_showUpdateAvailable();
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowWatcher])
};

const WindowMediator = {
  getMostRecentWindow(aWindowType) {
    return null;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowMediator])
};

function run_test() {
  setupTestCommon();

  debugDump("testing nsIUpdatePrompt notifications should not be displayed " +
            "when showUpdateAvailable is called for an unsupported system " +
            "update when the unsupported notification has already been " +
            "shown (bug 843497)");

  start_httpserver();
  setUpdateURL(gURLData + gHTTPHandlerPath);
  standardInit();

  let windowWatcherCID =
    MockRegistrar.register("@mozilla.org/embedcomp/window-watcher;1",
                           WindowWatcher);
  let windowMediatorCID =
    MockRegistrar.register("@mozilla.org/appshell/window-mediator;1",
                           WindowMediator);
  registerCleanupFunction(() => {
    MockRegistrar.unregister(windowWatcherCID);
    MockRegistrar.unregister(windowMediatorCID);
  });

  Services.prefs.setBoolPref(PREF_APP_UPDATE_SILENT, false);
  Services.prefs.setBoolPref(PREF_APP_UPDATE_NOTIFIEDUNSUPPORTED, true);
  // This preference is used to determine when the background update check has
  // completed since a successful check will clear the preference.
  Services.prefs.setIntPref(PREF_APP_UPDATE_BACKGROUNDERRORS, 1);

  gResponseBody = getRemoteUpdatesXMLString("  <update type=\"major\" " +
                                            "name=\"Unsupported Update\" " +
                                            "unsupported=\"true\" " +
                                            "detailsURL=\"" + URL_HOST +
                                            "\"></update>\n");
  gAUS.notify(null);
  executeSoon(check_test);
}

function check_test() {
  if (Services.prefs.prefHasUserValue(PREF_APP_UPDATE_BACKGROUNDERRORS)) {
    executeSoon(check_test);
    return;
  }
  Assert.ok(true,
            PREF_APP_UPDATE_BACKGROUNDERRORS + " preference should not exist");

  stop_httpserver(doTestFinish);
}

function check_showUpdateAvailable() {
  do_throw("showUpdateAvailable should not have called openWindow!");
}
