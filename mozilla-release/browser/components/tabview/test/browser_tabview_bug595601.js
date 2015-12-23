/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

var ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);

const TAB_STATE_NEEDS_RESTORE = 1;
const TAB_STATE_RESTORING = 2;

var stateBackup = ss.getBrowserState();

var state = {windows:[{tabs:[
  // first group
  {entries:[{url:"http://example.com#1"}],extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#1\",\"groupID\":2}"}},
  {entries:[{url:"http://example.com#2"}],extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#2\",\"groupID\":2}"}},
  {entries:[{url:"http://example.com#3"}],extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#3\",\"groupID\":2}"}},
  {entries:[{url:"http://example.com#4"}],extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#4\",\"groupID\":2}"}},

  // second group
  {entries:[{url:"http://example.com#5"}],hidden:true,extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#5\",\"groupID\":1}"}},
  {entries:[{url:"http://example.com#6"}],hidden:true,extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#6\",\"groupID\":1}"}},
  {entries:[{url:"http://example.com#7"}],hidden:true,extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#7\",\"groupID\":1}"}},
  {entries:[{url:"http://example.com#8"}],hidden:true,extData:{"tabview-tab":"{\"bounds\":{\"left\":20,\"top\":20,\"width\":20,\"height\":20},\"url\":\"http://example.com#8\",\"groupID\":1}"}}
],selected:4,extData:{
  "tabview-groups":"{\"nextID\":8,\"activeGroupId\":1}","tabview-group":"{\"1\":{\"bounds\":{\"left\":15,\"top\":10,\"width\":415,\"height\":367},\"userSize\":{\"x\":415,\"y\":367},\"title\":\"\",\"id\":1},\"2\":{\"bounds\":{\"left\":286,\"top\":488,\"width\":418,\"height\":313},\"title\":\"\",\"id\":2}}",
  "tabview-ui":"{\"pageBounds\":{\"left\":0,\"top\":0,\"width\":940,\"height\":1075}}"
}}]};

function test() {
  waitForExplicitFinish();

  Services.prefs.setBoolPref("browser.sessionstore.restore_hidden_tabs", false);

  TabsProgressListener.init();

  registerCleanupFunction(function () {
    TabsProgressListener.uninit();

    Services.prefs.clearUserPref("browser.sessionstore.restore_hidden_tabs");

    gBrowser.selectedTab = gBrowser.tabs[0];
    ss.setBrowserState(stateBackup);
  });

  TabView._initFrame(function () {
    executeSoon(testRestoreWithHiddenTabs);
  });
}

function testRestoreWithHiddenTabs() {
  TabsProgressListener.setCallback(function (needsRestore, isRestoring) {
    if (needsRestore <= 4) {
      TabsProgressListener.unsetCallback();
      is(needsRestore, 4, "4/8 tabs restored");
    }
  });

  waitForBrowserState(state, 4, function () {
    is(gBrowser.tabs.length, 8, "there are now eight tabs");
    is(gBrowser.visibleTabs.length, 4, "four visible tabs");

    let cw = TabView.getContentWindow();
    is(cw.GroupItems.groupItems.length, 2, "there are now two groupItems");

    testSwitchToInactiveGroup();
  });
}

function testSwitchToInactiveGroup() {
  let firstProgress = true;

  TabsProgressListener.setCallback(function (needsRestore, isRestoring) {
    if (firstProgress) {
      firstProgress = false;
      is(isRestoring, 3, "restoring 3 tabs concurrently");
    } else {
      ok(isRestoring < 4, "restoring max. 3 tabs concurrently");
    }

    if (needsRestore)
      return;

    TabsProgressListener.unsetCallback();

    is(gBrowser.visibleTabs.length, 4, "four visible tabs");
    waitForFocus(finish);
  });

  gBrowser.selectedTab = gBrowser.tabs[4];
}

function waitForBrowserState(state, numTabs, callback) {
  let tabContainer = gBrowser.tabContainer;
  tabContainer.addEventListener("SSTabRestored", function onRestored() {
    if (--numTabs <= 0) {
      tabContainer.removeEventListener("SSTabRestored", onRestored, true);
      executeSoon(callback);
    }
  }, true);

  ss.setBrowserState(JSON.stringify(state));
}

function countTabs() {
  let needsRestore = 0, isRestoring = 0;
  let windowsEnum = Services.wm.getEnumerator("navigator:browser");

  while (windowsEnum.hasMoreElements()) {
    let window = windowsEnum.getNext();
    if (window.closed)
      continue;

    for (let i = 0; i < window.gBrowser.tabs.length; i++) {
      let browser = window.gBrowser.tabs[i].linkedBrowser;
      if (browser.__SS_restoreState == TAB_STATE_RESTORING)
        isRestoring++;
      else if (browser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE)
        needsRestore++;
    }
  }

  return [needsRestore, isRestoring];
}

var TabsProgressListener = {
  init: function () {
    gBrowser.addTabsProgressListener(this);
  },

  uninit: function () {
    this.unsetCallback();
    gBrowser.removeTabsProgressListener(this);
 },

  setCallback: function (callback) {
    this.callback = callback;
  },

  unsetCallback: function () {
    delete this.callback;
  },

  onStateChange: function (aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
    let isNetwork = aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK;
    let isWindow = aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW;

    if (!(this.callback && isNetwork && isWindow))
      return;

    let self = this;
    let finalize = function () {
      if (wasRestoring)
        delete aBrowser.__wasRestoring;

      self.callback.apply(null, countTabs());
    };

    let isRestoring = aBrowser.__SS_restoreState == TAB_STATE_RESTORING;
    let wasRestoring = !aBrowser.__SS_restoreState && aBrowser.__wasRestoring;
    let hasStopped = aStateFlags & Ci.nsIWebProgressListener.STATE_STOP;

    if (isRestoring && !hasStopped)
      aBrowser.__wasRestoring = true;

    if (hasStopped && (isRestoring || wasRestoring))
      finalize();
  }
}
