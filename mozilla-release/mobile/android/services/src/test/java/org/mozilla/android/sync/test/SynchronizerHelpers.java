/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

package org.mozilla.android.sync.test;

import android.content.Context;
import org.mozilla.gecko.background.common.log.Logger;
import org.mozilla.gecko.background.testhelpers.WBORepository;
import org.mozilla.gecko.sync.CollectionConcurrentModificationException;
import org.mozilla.gecko.sync.SyncDeadlineReachedException;
import org.mozilla.gecko.sync.SyncException;
import org.mozilla.gecko.sync.repositories.FetchFailedException;
import org.mozilla.gecko.sync.repositories.InactiveSessionException;
import org.mozilla.gecko.sync.repositories.NoStoreDelegateException;
import org.mozilla.gecko.sync.repositories.RepositorySession;
import org.mozilla.gecko.sync.repositories.StoreFailedException;
import org.mozilla.gecko.sync.repositories.delegates.RepositorySessionFetchRecordsDelegate;
import org.mozilla.gecko.sync.repositories.delegates.RepositorySessionFinishDelegate;
import org.mozilla.gecko.sync.repositories.domain.Record;

import java.util.ArrayList;
import java.util.concurrent.ExecutorService;

public class SynchronizerHelpers {
  public static final String FAIL_SENTINEL = "Fail";

  enum FailMode {
    COLLECTION_MODIFIED,
    DEADLINE_REACHED,
    FETCH,
    STORE
  }

  private static Exception getFailException(FailMode failMode) {
    switch (failMode) {
      case COLLECTION_MODIFIED:
        return new CollectionConcurrentModificationException();
      case DEADLINE_REACHED:
        return new SyncDeadlineReachedException();
      case FETCH:
        return new FetchFailedException();
      case STORE:
        return new StoreFailedException();
      default:
        throw new IllegalStateException();
    }
  }

  /**
   * Store one at a time, failing if the guid contains FAIL_SENTINEL.
   */
  public static class FailFetchWBORepository extends WBORepository {
    private final FailMode failMode;

    public FailFetchWBORepository(FailMode failMode) {
      this.failMode = failMode;
    }

    @Override
    public RepositorySession createSession(Context context) {
      return new WBORepositorySession(this) {
        @Override
        public void fetchModified(final RepositorySessionFetchRecordsDelegate delegate) {
          super.fetchModified(new RepositorySessionFetchRecordsDelegate() {
            @Override
            public void onFetchedRecord(Record record) {
              if (record.guid.contains(FAIL_SENTINEL)) {
                delegate.onFetchFailed(getFailException(failMode));
              } else {
                delegate.onFetchedRecord(record);
              }
            }

            @Override
            public void onFetchFailed(Exception ex) {
              delegate.onFetchFailed(ex);
            }

            @Override
            public void onFetchCompleted() {
              delegate.onFetchCompleted();
            }

            @Override
            public void onBatchCompleted() {

            }

            @Override
            public RepositorySessionFetchRecordsDelegate deferredFetchDelegate(ExecutorService executor) {
              return this;
            }
          });
        }
      };
    }
  }

  /**
   * Store one at a time, failing if the guid contains FAIL_SENTINEL.
   */
  public static class SerialFailStoreWBORepository extends WBORepository {
    private final FailMode failMode;

    public SerialFailStoreWBORepository(FailMode failMode) {
      this.failMode = failMode;
    }

    @Override
    public RepositorySession createSession(Context context) {
      return new WBORepositorySession(this) {
        @Override
        public void store(final Record record) throws NoStoreDelegateException {
          if (storeDelegate == null) {
            throw new NoStoreDelegateException();
          }
          if (record.guid.contains(FAIL_SENTINEL)) {
            Exception ex = getFailException(failMode);
            if (ex instanceof CollectionConcurrentModificationException) {
              storeDelegate.onStoreFailed(ex);
            } else {
              storeDelegate.onRecordStoreFailed(ex, record.guid);
            }
          } else {
            super.store(record);
          }
        }
      };
    }
  }

  /**
   * Store in batches, failing if any of the batch guids contains "Fail".
   * <p>
   * This will drop the final batch.
   */
  public static class BatchFailStoreWBORepository extends WBORepository {
    public final int batchSize;
    public ArrayList<Record> batch = new ArrayList<Record>();
    public boolean batchShouldFail = false;

    public class BatchFailStoreWBORepositorySession extends WBORepositorySession {
      public BatchFailStoreWBORepositorySession(WBORepository repository) {
        super(repository);
      }

      public void superStore(final Record record) throws NoStoreDelegateException {
        super.store(record);
      }

      @Override
      public void store(final Record record) throws NoStoreDelegateException {
        if (storeDelegate == null) {
          throw new NoStoreDelegateException();
        }
        synchronized (batch) {
          batch.add(record);
          if (record.guid.contains("Fail")) {
            batchShouldFail = true;
          }

          if (batch.size() >= batchSize) {
            flush();
          }
        }
      }

      public void flush() {
        final ArrayList<Record> thisBatch = new ArrayList<Record>(batch);
        final boolean thisBatchShouldFail = batchShouldFail;
        batchShouldFail = false;
        batch.clear();
        storeWorkQueue.execute(new Runnable() {
          @Override
          public void run() {
            Logger.trace("XXX", "Notifying about batch.  Failure? " + thisBatchShouldFail);
            for (Record batchRecord : thisBatch) {
              if (thisBatchShouldFail) {
                storeDelegate.onRecordStoreFailed(new StoreFailedException(), batchRecord.guid);
              } else {
                try {
                  superStore(batchRecord);
                } catch (NoStoreDelegateException e) {
                  storeDelegate.onRecordStoreFailed(e, batchRecord.guid);
                }
              }
            }
          }
        });
      }

      @Override
      public void storeDone() {
        synchronized (batch) {
          flush();
          // Do this in a Runnable so that the timestamp is grabbed after any upload.
          final Runnable r = new Runnable() {
            @Override
            public void run() {
              synchronized (batch) {
                Logger.trace("XXX", "Calling storeDone.");
                setLastStoreTimestamp(now());
                storeDelegate.onStoreCompleted();
              }
            }
          };
          storeWorkQueue.execute(r);
        }
      }
    }
    public BatchFailStoreWBORepository(int batchSize) {
      super();
      this.batchSize = batchSize;
    }

    @Override
    public RepositorySession createSession(Context context) {
      return new BatchFailStoreWBORepositorySession(this);
    }
  }

  public static class TrackingWBORepository extends WBORepository {
    @Override
    public synchronized boolean shouldTrack() {
      return true;
    }
  }

  public static class BeginFailedException extends SyncException {
    private static final long serialVersionUID = -2349459755976915096L;
  }

  public static class FinishFailedException extends Exception {
    private static final long serialVersionUID = -4644528423867070934L;
  }

  public static class BeginErrorWBORepository extends TrackingWBORepository {
    @Override
    public RepositorySession createSession(Context context) {
      return new BeginErrorWBORepositorySession(this);
    }

    public class BeginErrorWBORepositorySession extends WBORepositorySession {
      public BeginErrorWBORepositorySession(WBORepository repository) {
        super(repository);
      }

      @Override
      public void begin() throws SyncException {
        throw new BeginFailedException();
      }
    }
  }

  public static class FinishErrorWBORepository extends TrackingWBORepository {
    @Override
    public RepositorySession createSession(Context context) {
      return new FinishErrorWBORepositorySession(this);
    }

    public class FinishErrorWBORepositorySession extends WBORepositorySession {
      public FinishErrorWBORepositorySession(WBORepository repository) {
        super(repository);
      }

      @Override
      public void finish(final RepositorySessionFinishDelegate delegate) throws InactiveSessionException {
        delegate.onFinishFailed(new FinishFailedException());
      }
    }
  }

  public static class DataAvailableWBORepository extends TrackingWBORepository {
    public boolean dataAvailable = true;

    public DataAvailableWBORepository(boolean dataAvailable) {
      this.dataAvailable = dataAvailable;
    }

    @Override
    public RepositorySession createSession(Context context) {
      return new DataAvailableWBORepositorySession(this);
    }

    public class DataAvailableWBORepositorySession extends WBORepositorySession {
      public DataAvailableWBORepositorySession(WBORepository repository) {
        super(repository);
      }

      @Override
      public boolean dataAvailable() {
        return dataAvailable;
      }
    }
  }

  public static class ShouldSkipWBORepository extends TrackingWBORepository {
    public boolean shouldSkip = true;

    public ShouldSkipWBORepository(boolean shouldSkip) {
      this.shouldSkip = shouldSkip;
    }

    @Override
    public RepositorySession createSession(Context context) {
      return new ShouldSkipWBORepositorySession(this);
    }

    public class ShouldSkipWBORepositorySession extends WBORepositorySession {
      public ShouldSkipWBORepositorySession(WBORepository repository) {
        super(repository);
      }

      @Override
      public boolean shouldSkip() {
        return shouldSkip;
      }
    }
  }
}
