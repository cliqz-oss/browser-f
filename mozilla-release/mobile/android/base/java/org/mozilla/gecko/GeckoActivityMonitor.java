/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.os.Bundle;

import java.lang.ref.WeakReference;

public class GeckoActivityMonitor implements Application.ActivityLifecycleCallbacks {
    private static final String LOGTAG = "GeckoActivityMonitor";

    private static final GeckoActivityMonitor instance = new GeckoActivityMonitor();

    private WeakReference<Activity> currentActivity = new WeakReference<>(null);

    public static GeckoActivityMonitor getInstance() {
        return instance;
    }

    private GeckoActivityMonitor() { }

    private void updateActivity(final Activity activity) {
        if (currentActivity.get() == null) {
            ((GeckoApplication) activity.getApplication()).onApplicationForeground();
        }
        currentActivity = new WeakReference<>(activity);
    }

    private void checkAppGoingIntoBackground(final Activity activity) {
        // For the previous activity, this is called after onStart/onResume for the
        // new/resumed activity, so if we're switching activities within our app,
        // currentActivity should already refer to the next activity at this point.
        // If it doesn't, it means we've been backgrounded.
        if (currentActivity.get() == activity) {
            currentActivity.clear();
            ((GeckoApplication) activity.getApplication()).onApplicationBackground();
        }
    }

    public Activity getCurrentActivity() {
        return currentActivity.get();
    }

    public synchronized void initialize(final GeckoApplication app) {
        app.registerActivityLifecycleCallbacks(this);
    }

    @Override
    public void onActivityCreated(Activity activity, Bundle savedInstanceState) { }

    @Override
    public void onActivityStarted(Activity activity) {
        updateActivity(activity);
    }

    @Override
    public void onActivityResumed(Activity activity) {
        updateActivity(activity);
    }

    @Override
    public void onActivityPaused(Activity activity) { }

    @Override
    public void onActivitySaveInstanceState(Activity activity, Bundle outState) {
        checkAppGoingIntoBackground(activity);
    }

    @Override
    public void onActivityStopped(Activity activity) {
        checkAppGoingIntoBackground(activity);
    }

    @Override
    public void onActivityDestroyed(Activity activity) { }
}
