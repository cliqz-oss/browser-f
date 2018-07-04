/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */
package org.mozilla.gecko.tests;

import org.mozilla.gecko.AppConstants;
import org.mozilla.gecko.Tab;
import org.mozilla.gecko.Tabs;
import org.mozilla.gecko.util.GeckoBundle;

import android.util.Log;

public class testAccessibleCarets extends JavascriptTest {
    private static final String LOGTAG = "testAccessibleCarets";
    private static final String TAB_CHANGE_EVENT = "testAccessibleCarets:TabChange";

    private final TabsListener tabsListener;


    public testAccessibleCarets() {
        super("testAccessibleCarets.js");

        tabsListener = new TabsListener();
    }

    @Override
    public void setUp() throws Exception {
        super.setUp();

        Tabs.registerOnTabsChangedListener(tabsListener);
    }

    @Override
    public void tearDown() throws Exception {
        Tabs.unregisterOnTabsChangedListener(tabsListener);

        super.tearDown();
    }

    /**
     * Observes tab change events to broadcast to the test script.
     */
    private class TabsListener implements Tabs.OnTabsChangedListener {
        @Override
        public void onTabChanged(Tab tab, Tabs.TabEvents msg, String data) {
            switch (msg) {
                case STOP:
                    final GeckoBundle args = new GeckoBundle(2);
                    args.putInt("tabId", tab.getId());
                    args.putString("event", msg.toString());
                    mActions.sendGlobalEvent(TAB_CHANGE_EVENT, args);
                    break;
            }
        }
    }
}
