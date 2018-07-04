/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.sync.repositories.delegates;

import java.util.concurrent.ExecutorService;

/**
 * These methods *must* be invoked asynchronously. Use deferredStoreDelegate if you
 * need help doing this.
 *
 * @author rnewman
 *
 */
public interface RepositorySessionStoreDelegate {
  void onRecordStoreFailed(Exception ex, String recordGuid);

  // Meant for signaling that a record has been reconciled.
  // Only makes sense in context of local repositories.
  // Further call to onRecordStoreSucceeded is necessary.
  void onRecordStoreReconciled(String guid, String oldGuid, Integer newVersion);

  // Called with a GUID when store has succeeded.
  void onRecordStoreSucceeded(int count);
  void onStoreCompleted();
  void onStoreFailed(Exception e);
  // Only relevant for store batches, and exists to help us record correct telemetry.
  void onBatchCommitted();
  RepositorySessionStoreDelegate deferredStoreDelegate(ExecutorService executor);
}
