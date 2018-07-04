/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.sync.repositories.android;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.json.simple.JSONArray;

import org.mozilla.gecko.db.BrowserContract;
import org.mozilla.gecko.fxa.devices.FxAccountDevice;
import org.mozilla.gecko.sync.CommandProcessor.Command;
import org.mozilla.gecko.sync.repositories.NullCursorException;
import org.mozilla.gecko.sync.repositories.domain.ClientRecord;
import org.mozilla.gecko.sync.setup.Constants;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;

public class ClientsDatabaseAccessor {

  public static final String LOG_TAG = "ClientsDatabaseAccessor";

  private ClientsDatabase db;

  // Need this so we can properly stub out the class for testing.
  public ClientsDatabaseAccessor() {}

  public ClientsDatabaseAccessor(Context context) {
    db = new ClientsDatabase(context);
  }

  public void store(ClientRecord record) {
    db.store(getProfileId(), record);
  }

  public void store(Collection<ClientRecord> records) {
    for (ClientRecord record : records) {
      this.store(record);
    }
  }

  public void store(String accountGUID, Command command) throws NullCursorException {
    db.store(accountGUID, command.commandType, command.args.toJSONString(), command.flowID);
  }

  public ClientRecord fetchClient(String accountGUID) throws NullCursorException {
    final Cursor cur = db.fetchClientsCursor(accountGUID, getProfileId());
    try {
      if (!cur.moveToFirst()) {
        return null;
      }
      return recordFromCursor(cur);
    } finally {
      cur.close();
    }
  }

  public Map<String, ClientRecord> fetchAllClients() throws NullCursorException {
    final HashMap<String, ClientRecord> map = new HashMap<String, ClientRecord>();
    final Cursor cur = db.fetchAllClients();
    try {
      if (!cur.moveToFirst()) {
        return Collections.unmodifiableMap(map);
      }

      while (!cur.isAfterLast()) {
        ClientRecord clientRecord = recordFromCursor(cur);
        map.put(clientRecord.guid, clientRecord);
        cur.moveToNext();
      }
      return Collections.unmodifiableMap(map);
    } finally {
      cur.close();
    }
  }

  // Filters our list of clients with the device list we have from FxA.
  public Collection<ClientRecord> fetchNonStaleClients(String[] fxaDeviceIds) throws NullCursorException {
    final Cursor cur = db.fetchClientsWithFxADeviceIds(fxaDeviceIds);
    final Collection<ClientRecord> clients = new ArrayList<>(cur.getCount());
    try {
      if (!cur.moveToFirst()) {
        return clients;
      }

      while (!cur.isAfterLast()) {
        ClientRecord clientRecord = recordFromCursor(cur);
        clients.add(clientRecord);
        cur.moveToNext();
      }
      return clients;
    } finally {
      cur.close();
    }
  }

  public boolean hasNonStaleClients(String[] fxaDeviceIds) throws NullCursorException {
    try {
      final Cursor cur = db.fetchClientsWithFxADeviceIds(fxaDeviceIds);
      try {
        return cur.getCount() > 0;
      } finally {
        cur.close();
      }
    } catch (NullCursorException e) {
      return false;
    }
  }

  public String[] getRemoteDevicesIds(Context context) {
    final ContentResolver cr = context.getContentResolver();
    final String[] guidProjection = new String[] {
      BrowserContract.RemoteDevices.GUID, // 0
    };
    final Cursor c = cr.query(BrowserContract.RemoteDevices.CONTENT_URI, guidProjection, null, null, "NAME ASC");
    final String[] remoteDevicesIds = new String[c.getCount()];
    try {
      int i = 0;
      while (c.moveToNext()) {
        remoteDevicesIds[i] = c.getString(c.getColumnIndexOrThrow(BrowserContract.RemoteDevices.GUID));
        i++;
      }
    } finally {
      c.close();
    }
    return remoteDevicesIds;
  }

  public List<Command> fetchAllCommands() throws NullCursorException {
    final List<Command> commands = new ArrayList<Command>();
    final Cursor cur = db.fetchAllCommands();
    try {
      if (!cur.moveToFirst()) {
        return Collections.unmodifiableList(commands);
      }

      while (!cur.isAfterLast()) {
        Command command = commandFromCursor(cur);
        commands.add(command);
        cur.moveToNext();
      }
      return Collections.unmodifiableList(commands);
    } finally {
      cur.close();
    }
  }

  public List<Command> fetchCommandsForClient(String accountGUID) throws NullCursorException {
    final List<Command> commands = new ArrayList<Command>();
    final Cursor cur = db.fetchCommandsForClient(accountGUID);
    try {
      if (!cur.moveToFirst()) {
        return Collections.unmodifiableList(commands);
      }

      while(!cur.isAfterLast()) {
        Command command = commandFromCursor(cur);
        commands.add(command);
        cur.moveToNext();
      }
      return Collections.unmodifiableList(commands);
    } finally {
      cur.close();
    }
  }

  protected static ClientRecord recordFromCursor(Cursor cur) {
    final String accountGUID = RepoUtils.getStringFromCursor(cur, ClientsDatabase.COL_ACCOUNT_GUID);
    final String clientName = RepoUtils.getStringFromCursor(cur, ClientsDatabase.COL_NAME);
    final String clientType = RepoUtils.getStringFromCursor(cur, ClientsDatabase.COL_TYPE);

    final ClientRecord record = new ClientRecord(accountGUID);
    record.name = clientName;
    record.type = clientType;

    // Optional fields. These will either be null or strings.
    record.formfactor = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_FORMFACTOR);
    record.os = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_OS);
    record.device = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_DEVICE);
    record.fxaDeviceId = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_FXA_DEVICE_ID);
    record.appPackage = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_APP_PACKAGE);
    record.application = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_APPLICATION);

    return record;
  }

  protected static Command commandFromCursor(Cursor cur) {
    final String commandType = RepoUtils.getStringFromCursor(cur, ClientsDatabase.COL_COMMAND);
    final JSONArray commandArgs = RepoUtils.getJSONArrayFromCursor(cur, ClientsDatabase.COL_ARGS);
    final String flowID = RepoUtils.optStringFromCursor(cur, ClientsDatabase.COL_FLOW_ID);
    return new Command(commandType, commandArgs, flowID);
  }

  public int clientsCount() {
    try {
      final Cursor cur = db.fetchAllClients();
      try {
        return cur.getCount();
      } finally {
        cur.close();
      }
    } catch (NullCursorException e) {
      return 0;
    }

  }

  private String getProfileId() {
    return Constants.DEFAULT_PROFILE;
  }

  public void wipeDB() {
    db.wipeDB();
  }

  public void wipeClientsTable() {
    db.wipeClientsTable();
  }

  public void wipeCommandsTable() {
    db.wipeCommandsTable();
  }

  public void close() {
    db.close();
  }
}
