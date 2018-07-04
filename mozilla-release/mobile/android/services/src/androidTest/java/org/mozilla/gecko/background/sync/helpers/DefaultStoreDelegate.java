/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

package org.mozilla.gecko.background.sync.helpers;

import java.util.concurrent.ExecutorService;

import org.mozilla.gecko.sync.repositories.delegates.RepositorySessionStoreDelegate;

public class DefaultStoreDelegate extends DefaultDelegate implements RepositorySessionStoreDelegate {

  @Override
  public void onRecordStoreFailed(Exception ex, String guid) {
    performNotify("Record store failed", ex);
  }

  @Override
  public void onRecordStoreSucceeded(int count) {
    performNotify("DefaultStoreDelegate used", null);
  }

  @Override
  public void onStoreCompleted() {
    performNotify("DefaultStoreDelegate used", null);
  }

  @Override
  public void onStoreFailed(Exception ex) {
    performNotify("Store failed", ex);
  }

  @Override
  public void onBatchCommitted() {
    performNotify("Stores committed ", null);
  }

  @Override
  public void onRecordStoreReconciled(String guid, String oldGuid, Integer newVersion) {}

  @Override
  public RepositorySessionStoreDelegate deferredStoreDelegate(final ExecutorService executor) {
    final RepositorySessionStoreDelegate self = this;
    return new RepositorySessionStoreDelegate() {

      @Override
      public void onRecordStoreSucceeded(final int count) {
        executor.execute(new Runnable() {
          @Override
          public void run() {
            self.onRecordStoreSucceeded(count);
          }
        });
      }

      @Override
      public void onRecordStoreFailed(final Exception ex, final String guid) {
        executor.execute(new Runnable() {
          @Override
          public void run() {
            self.onRecordStoreFailed(ex, guid);
          }
        });
      }

      @Override
      public void onRecordStoreReconciled(final String guid, String oldGuid, Integer newVersion) {
        executor.execute(new Runnable() {
          @Override
          public void run() {
            self.onRecordStoreReconciled(guid, null, null);
          }
        });
      }

      @Override
      public void onStoreCompleted() {
        executor.execute(new Runnable() {
          @Override
          public void run() {
            self.onStoreCompleted();
          }
        });
      }

      @Override
      public void onBatchCommitted() {
        executor.execute(new Runnable() {
          @Override
          public void run() {
            self.onBatchCommitted();
          }
        });
      }

      @Override
      public void onStoreFailed(Exception e) {

      }

      @Override
      public RepositorySessionStoreDelegate deferredStoreDelegate(ExecutorService newExecutor) {
        if (newExecutor == executor) {
          return this;
        }
        throw new IllegalArgumentException("Can't re-defer this delegate.");
      }
    };
  }
}
