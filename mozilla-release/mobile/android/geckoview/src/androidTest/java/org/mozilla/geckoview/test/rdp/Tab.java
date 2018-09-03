/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.geckoview.test.rdp;

import android.support.annotation.NonNull;
import android.support.annotation.Nullable;

import org.json.JSONObject;

/**
 * Provide access to the tab API.
 */
public final class Tab extends Actor {
    private final ReplyParser<Void> TAB_STATE_PARSER = new ReplyParser<Void>() {
        @Override
        public boolean canParse(@NonNull JSONObject packet) {
            return packet.has("type");
        }

        @Override
        public @Nullable Void parse(@NonNull JSONObject packet) {
            return null;
        }
    };

    public final String title;
    public final String url;
    public final long outerWindowID;
    private final JSONObject mTab;

    /* package */ Tab(final RDPConnection connection, final JSONObject tab) {
        super(connection, tab);
        title = tab.optString("title", null);
        url = tab.optString("url", null);
        outerWindowID = tab.optLong("outerWindowID", -1);
        mTab = tab;
        attach();
    }

    /**
     * Attach to the server tab.
     */
    private void attach() {
        sendPacket("{\"type\":\"attach\"}", TAB_STATE_PARSER).get();
    }

    /**
     * Detach from the server tab.
     */
    public void detach() {
        sendPacket("{\"type\":\"detach\"}", TAB_STATE_PARSER).get();
        release();
    }

    /**
     * Get the console object for access to the webconsole API.
     *
     * @return Console object.
     */
    public Console getConsole() {
        final String name = mTab.optString("consoleActor", null);
        final Actor console = connection.getActor(name);
        return (console != null) ? (Console) console : new Console(connection, name);
    }

    /**
     * Get the promises object for access to the promises API.
     *
     * @return Promises object.
     */
    public Promises getPromises() {
        final String name = mTab.optString("promisesActor", null);
        final Actor promises = connection.getActor(name);
        return (promises != null) ? (Promises) promises : new Promises(connection, name);
    }

    /**
     * Get the memory object for access to the memory API.
     *
     * @return Memory object.
     */
    public Memory getMemory() {
        final String name = mTab.optString("memoryActor", null);
        final Actor memory = connection.getActor(name);
        return (memory != null) ? (Memory) memory : new Memory(connection, name);
    }
}
