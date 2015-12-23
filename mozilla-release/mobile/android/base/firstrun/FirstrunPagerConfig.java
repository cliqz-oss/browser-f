/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.firstrun;

import android.content.Context;
import android.util.Log;
import com.keepsafe.switchboard.SwitchBoard;
import org.mozilla.gecko.AppConstants;
import org.mozilla.gecko.Telemetry;
import org.mozilla.gecko.TelemetryContract;

import java.util.LinkedList;
import java.util.List;

public class FirstrunPagerConfig {
    public static final String LOGTAG = "FirstrunPagerConfig";
    public static final String ONBOARDING_A = "onboarding-a";
    public static final String ONBOARDING_B = "onboarding-b";

    public static List<FirstrunPanelConfig> getDefault(Context context) {
        final List<FirstrunPanelConfig> panels = new LinkedList<>();
        if (isInExperimentLocal(context, ONBOARDING_A)) {
            panels.add(new FirstrunPanelConfig(WelcomePanel.class.getName(), WelcomePanel.TITLE_RES));
            Telemetry.startUISession(TelemetryContract.Session.EXPERIMENT, ONBOARDING_A);
        } else if (isInExperimentLocal(context, ONBOARDING_B)) {
            // Strings used for first run, pulled from existing strings.
            panels.add(new FirstrunPanelConfig(ImportPanel.class.getName(), ImportPanel.TITLE_RES));
            panels.add(new FirstrunPanelConfig(SyncPanel.class.getName(), SyncPanel.TITLE_RES));
            Telemetry.startUISession(TelemetryContract.Session.EXPERIMENT, ONBOARDING_B);
        } else {
            Log.d(LOGTAG, "Not in an experiment!");
            panels.add(new FirstrunPanelConfig(WelcomePanel.class.getName(), WelcomePanel.TITLE_RES));
        }

        return panels;
    }

    /*
     * Wrapper method for using local bucketing rather than server-side.
     * This needs to match the server-side bucketing used on mozilla-switchboard.herokuapp.com.
     */
    private static boolean isInExperimentLocal(Context context, String name) {
        if (AppConstants.MOZ_SWITCHBOARD) {
            if (SwitchBoard.isInBucket(context, 0, 50)) {
                return ONBOARDING_A.equals(name);
            } else if (SwitchBoard.isInBucket(context, 50, 100)) {
                return ONBOARDING_B.equals(name);
            }
        }
        return false;
    }

    public static List<FirstrunPanelConfig> getRestricted() {
        final List<FirstrunPanelConfig> panels = new LinkedList<>();
        panels.add(new FirstrunPanelConfig(RestrictedWelcomePanel.class.getName(), RestrictedWelcomePanel.TITLE_RES));
        return panels;
    }

    public static class FirstrunPanelConfig {
        private String classname;
        private int titleRes;

        public FirstrunPanelConfig(String resource, int titleRes) {
            this.classname= resource;
            this.titleRes = titleRes;
        }

        public String getClassname() {
            return this.classname;
        }

        public int getTitleRes() {
            return this.titleRes;
        }

    }
}
