/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.process;

import org.mozilla.gecko.annotation.WrapForJNI;
import org.mozilla.gecko.GeckoAppShell;
import org.mozilla.gecko.IGeckoEditableParent;
import org.mozilla.gecko.mozglue.GeckoLoader;
import org.mozilla.gecko.GeckoThread;
import org.mozilla.gecko.mozglue.SafeIntent;
import org.mozilla.gecko.util.ThreadUtils;

import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.IBinder;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.os.RemoteException;
import android.util.Log;

public class GeckoServiceChildProcess extends Service {

    private static final String LOGTAG = "GeckoServiceChildProcess";

    private static IProcessManager sProcessManager;

    @WrapForJNI(calledFrom = "gecko")
    private static IGeckoEditableParent getEditableParent(final long contentId,
                                                          final long tabId) {
        try {
            return sProcessManager.getEditableParent(contentId, tabId);
        } catch (final RemoteException e) {
            Log.e(LOGTAG, "Cannot get editable", e);
            return null;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();

        GeckoAppShell.ensureCrashHandling();
        GeckoAppShell.setApplicationContext(getApplicationContext());
    }

    @Override
    public int onStartCommand(final Intent intent, final int flags, final int startId) {
        return Service.START_NOT_STICKY;
    }

    private final Binder mBinder = new IChildProcess.Stub() {
        @Override
        public int getPid() {
            return Process.myPid();
        }

        @Override
        public boolean start(final IProcessManager procMan,
                             final String[] args,
                             final ParcelFileDescriptor crashReporterPfd,
                             final ParcelFileDescriptor ipcPfd) {
            synchronized (GeckoServiceChildProcess.class) {
                if (sProcessManager != null) {
                    Log.e(LOGTAG, "Child process already started");
                    return false;
                }
                sProcessManager = procMan;
            }

            final int crashReporterFd = crashReporterPfd != null ?
                                        crashReporterPfd.detachFd() : -1;
            final int ipcFd = ipcPfd != null ? ipcPfd.detachFd() : -1;

            ThreadUtils.postToUiThread(new Runnable() {
                @Override
                public void run() {
                    if (GeckoThread.initChildProcess(args, crashReporterFd, ipcFd)) {
                        GeckoThread.launch();
                    }
                }
            });
            return true;
        }
    };

    @Override
    public IBinder onBind(final Intent intent) {
        GeckoLoader.setLastIntent(new SafeIntent(intent));
        GeckoThread.launch(); // Preload Gecko.
        return mBinder;
    }

    @Override
    public boolean onUnbind(Intent intent) {
        Log.i(LOGTAG, "Service has been unbound. Stopping.");
        Process.killProcess(Process.myPid());
        return false;
    }

    public static final class geckomediaplugin extends GeckoServiceChildProcess {}

    public static final class tab extends GeckoServiceChildProcess {}
}
