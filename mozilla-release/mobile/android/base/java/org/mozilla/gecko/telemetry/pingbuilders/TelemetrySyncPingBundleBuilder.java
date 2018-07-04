/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.mozilla.gecko.telemetry.pingbuilders;

import android.os.Build;
import android.support.annotation.NonNull;
import android.util.Log;

import org.json.simple.JSONArray;
import org.mozilla.gecko.AppConstants;
import org.mozilla.gecko.Locales;
import org.mozilla.gecko.sync.ExtendedJSONObject;
import org.mozilla.gecko.sync.NonArrayJSONException;
import org.mozilla.gecko.telemetry.TelemetryOutgoingPing;
import org.mozilla.gecko.telemetry.TelemetryPing;
import org.mozilla.gecko.telemetry.stores.TelemetryPingStore;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Responsible for building a Sync Ping, based on the telemetry docs:
 * https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/telemetry/data/sync-ping.html
 *
 * Fields common to all pings are documented here:
 * https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/telemetry/data/common-ping.html
 *
 * This builder takes two stores ('sync' and 'event') and produces a single "sync ping".
 *
 * Sample result will look something like:
 * {
 *     "syncs": [list of syncs, as produced by the SyncBuilder],
 *     "events": [list of events, as produced by the EventBuilder]
 * }
 */
public class TelemetrySyncPingBundleBuilder extends TelemetryPingBuilder {
    public static final String LOG_TAG = "SyncPingBundleBuilder";

    private static final String PING_TYPE = "sync";
    private static final int PING_BUNDLE_VERSION = 4; // Bug 1410145
    private static final int PING_SYNC_DATA_FORMAT_VERSION = 1; // Bug 1374758

    public static final String UPLOAD_REASON_FIRST = "first";
    public static final String UPLOAD_REASON_CLOCK_DRIFT = "clockdrift";
    public static final String UPLOAD_REASON_SCHEDULE = "schedule";
    public static final String UPLOAD_REASON_IDCHANGE = "idchange";
    public static final String UPLOAD_REASON_COUNT = "count";

    private final ExtendedJSONObject pingData = new ExtendedJSONObject();

    @Override
    public String getDocType() {
        return "sync";
    }

    @Override
    public String[] getMandatoryFields() {
        return new String[0];
    }

    public TelemetrySyncPingBundleBuilder setReason(@NonNull String reason) {
        pingData.put("why", reason);
        return this;
    }

    public TelemetrySyncPingBundleBuilder setUID(@NonNull String uid) {
        pingData.put("uid", uid);
        return this;
    }

    public TelemetrySyncPingBundleBuilder setDeviceID(@NonNull String deviceID) {
        pingData.put("deviceID", deviceID);
        return this;
    }

    @Override
    public TelemetryOutgoingPing build() {
        final DateFormat pingCreationDateFormat = new SimpleDateFormat(
                "yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        pingCreationDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

        payload.put("type", PING_TYPE);
        payload.put("version", PING_BUNDLE_VERSION);
        payload.put("id", docID);
        payload.put("creationDate", pingCreationDateFormat.format(new Date()));

        final ExtendedJSONObject application = new ExtendedJSONObject();
        application.put("architecture", Build.CPU_ABI);
        application.put("buildId", AppConstants.MOZ_APP_BUILDID);
        application.put("platformVersion", AppConstants.MOZ_APP_VERSION);
        application.put("name", AppConstants.MOZ_APP_BASENAME);
        application.put("version", AppConstants.MOZ_APP_VERSION);
        application.put("displayVersion", AppConstants.MOZ_APP_VERSION);
        application.put("vendor", AppConstants.MOZ_APP_VENDOR);
        application.put("xpcomAbi", AppConstants.MOZ_APP_ABI);
        application.put("channel", AppConstants.MOZ_UPDATE_CHANNEL);

        // Limited environment object, to help identify platforms easier. See Bug 1374758.
        final ExtendedJSONObject os = new ExtendedJSONObject();
        os.put("name", "Android");
        os.put("version", Integer.toString(Build.VERSION.SDK_INT));
        os.put("locale", Locales.getLanguageTag(Locale.getDefault()));

        payload.put("application", application);

        pingData.put("os", os);
        pingData.put("version", PING_SYNC_DATA_FORMAT_VERSION);

        payload.put("payload", pingData);
        return super.build();
    }

    @SuppressWarnings("unchecked")
    public TelemetrySyncPingBundleBuilder setSyncStore(TelemetryPingStore store) {
        final JSONArray syncs = new JSONArray();
        List<TelemetryPing> pings = store.getAllPings();

        // Please note how we're not including constituent ping's docID in the final payload. This is
        // unfortunate and causes some grief when managing local ping storage and uploads, but needs
        // to be resolved beyond this individual client. See Bug 1369186.
        for (TelemetryPing ping : pings) {
            syncs.add(ping.getPayload());
        }

        if (syncs.size() > 0) {
            pingData.put("syncs", syncs);
        }
        return this;
    }
    @SuppressWarnings("unchecked")
    public TelemetrySyncPingBundleBuilder setSyncEventStore(TelemetryPingStore store) {
        final JSONArray events = new JSONArray();
        List<TelemetryPing> pings = store.getAllPings();

        for (TelemetryPing ping : pings) {
            try {
                events.add(ping.getPayload().getArray("event"));
            } catch (NonArrayJSONException ex) {
                Log.e(LOG_TAG, "Invalid state: Non JSONArray for event payload.");
            }
        }

        if (events.size() > 0) {
            pingData.put("events", events);
        }
        return this;
    }
}
