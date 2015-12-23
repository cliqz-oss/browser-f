/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.b2gdroid;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.app.KeyguardManager.KeyguardLock;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.view.View;

import org.json.JSONObject;
import org.json.JSONException;

import org.mozilla.gecko.BaseGeckoInterface;
import org.mozilla.gecko.ContactService;
import org.mozilla.gecko.ContextGetter;
import org.mozilla.gecko.EventDispatcher;
import org.mozilla.gecko.GeckoAppShell;
import org.mozilla.gecko.GeckoBatteryManager;
import org.mozilla.gecko.GeckoEvent;
import org.mozilla.gecko.GeckoThread;
import org.mozilla.gecko.IntentHelper;
import org.mozilla.gecko.util.GeckoEventListener;

import org.mozilla.b2gdroid.ScreenStateObserver;
import org.mozilla.b2gdroid.Apps;

public class Launcher extends Activity
                      implements GeckoEventListener, ContextGetter {
    private static final String LOGTAG = "B2G";

    private ContactService      mContactService;
    private ScreenStateObserver mScreenStateObserver;
    private Apps                mApps;

    /** ContextGetter */
    public Context getContext() {
        return this;
    }

    public SharedPreferences getSharedPreferences() {
        return null;
    }

    /** Initializes Gecko APIs */
    private void initGecko() {
        GeckoAppShell.setContextGetter(this);

        GeckoBatteryManager.getInstance().start(this);
        mContactService = new ContactService(EventDispatcher.getInstance(), this);
        mApps = new Apps(this);
    }

    private void hideSplashScreen() {
        final View splash = findViewById(R.id.splashscreen);
        runOnUiThread(new Runnable() {
            @Override public void run() {
                splash.setVisibility(View.GONE);
            }
        });
    }

    /** Called when the activity is first created. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.w(LOGTAG, "onCreate");
        super.onCreate(savedInstanceState);

        IntentHelper.init(this);
        mScreenStateObserver = new ScreenStateObserver(this);

        // Disable the default lockscreen.
        KeyguardManager keyguardManager = (KeyguardManager)getSystemService(KEYGUARD_SERVICE);
        KeyguardLock lock = keyguardManager.newKeyguardLock(KEYGUARD_SERVICE);
        lock.disableKeyguard();

        initGecko();

        GeckoAppShell.setGeckoInterface(new BaseGeckoInterface(this));

        EventDispatcher.getInstance().registerGeckoThreadListener(this,
            "Launcher:Ready");

        setContentView(R.layout.launcher);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (GeckoThread.isRunning()) {
            hideSplashScreen();
        }
    }

    @Override
    public void onDestroy() {
        Log.w(LOGTAG, "onDestroy");
        super.onDestroy();
        IntentHelper.destroy();
        mScreenStateObserver.destroy(this);
        mScreenStateObserver = null;

        EventDispatcher.getInstance().unregisterGeckoThreadListener(this,
            "Launcher:Ready");

        mContactService.destroy();
        mApps.destroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        final String action = intent.getAction();
        Log.w(LOGTAG, "onNewIntent " + action);
        if (Intent.ACTION_VIEW.equals(action)) {
            Log.w(LOGTAG, "Asking gecko to view " + intent.getDataString());
            JSONObject obj = new JSONObject();
            try {
                obj.put("action", "view");
                obj.put("url", intent.getDataString());
            } catch(Exception ex) {
                Log.wtf(LOGTAG, "Error building Android:Launcher view message", ex);
            }
            GeckoEvent e = GeckoEvent.createBroadcastEvent("Android:Launcher", obj.toString());
            GeckoAppShell.sendEventToGecko(e);
        } else if (Intent.ACTION_MAIN.equals(action)) {
            Log.d(LOGTAG, "Let's dispatch a 'home' key event");
            JSONObject obj = new JSONObject();
            try {
                obj.put("action", "home-key");
            } catch(JSONException ex) {
                Log.wtf(LOGTAG, "Error building Android:Launcher message", ex);
            }
            GeckoEvent e = GeckoEvent.createBroadcastEvent("Android:Launcher", obj.toString());
            GeckoAppShell.sendEventToGecko(e);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        Log.d(LOGTAG, "onWindowFocusChanged hasFocus=" + hasFocus);

        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            findViewById(R.id.main_layout).setSystemUiVisibility(
                     View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    );
        }
    }

    public void handleMessage(String event, JSONObject message) {
        Log.w(LOGTAG, "Launcher received " + event);

        if ("Launcher:Ready".equals(event)) {
            hideSplashScreen();
        }
    }
}
