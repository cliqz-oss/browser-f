/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.sync.middleware;

import java.util.concurrent.ExecutorService;

import org.mozilla.gecko.sync.SyncException;
import org.mozilla.gecko.sync.repositories.InactiveSessionException;
import org.mozilla.gecko.sync.repositories.InvalidSessionTransitionException;
import org.mozilla.gecko.sync.repositories.Repository;
import org.mozilla.gecko.sync.repositories.RepositorySession;
import org.mozilla.gecko.sync.repositories.RepositorySessionBundle;
import org.mozilla.gecko.sync.repositories.delegates.RepositorySessionFinishDelegate;
import org.mozilla.gecko.sync.repositories.delegates.RepositorySessionWipeDelegate;

public abstract class MiddlewareRepositorySession extends RepositorySession {
  private static final String LOG_TAG = "MiddlewareSession";
  protected final RepositorySession inner;

  /* package-private */ MiddlewareRepositorySession(RepositorySession innerSession, Repository repository) {
    super(repository);
    this.inner = innerSession;
  }

  @Override
  public void wipe(RepositorySessionWipeDelegate delegate) {
    inner.wipe(delegate);
  }

  @Override
  public void begin() throws SyncException {
    inner.begin();
  }

  public static final class MiddlewareRepositorySessionFinishDelegate implements RepositorySessionFinishDelegate {
    private final MiddlewareRepositorySession outerSession;
    private final RepositorySessionFinishDelegate next;

    /* package-private */ MiddlewareRepositorySessionFinishDelegate(MiddlewareRepositorySession outerSession, RepositorySessionFinishDelegate next) {
      this.outerSession = outerSession;
      this.next = next;
    }

    @Override
    public void onFinishFailed(Exception ex) {
      next.onFinishFailed(ex);
    }

    @Override
    public void onFinishSucceeded(RepositorySession session, RepositorySessionBundle bundle) {
      next.onFinishSucceeded(outerSession, bundle);
    }

    @Override
    public RepositorySessionFinishDelegate deferredFinishDelegate(ExecutorService executor) {
      return this;
    }
  }

  @Override
  public void finish(RepositorySessionFinishDelegate delegate) throws InactiveSessionException {
    inner.finish(new MiddlewareRepositorySessionFinishDelegate(this, delegate));
  }


  @Override
  public synchronized void ensureActive() throws InactiveSessionException {
    inner.ensureActive();
  }

  @Override
  public synchronized boolean isActive() {
    return inner.isActive();
  }

  @Override
  public synchronized SessionStatus getStatus() {
    return inner.getStatus();
  }

  @Override
  public synchronized void setStatus(SessionStatus status) {
    inner.setStatus(status);
  }

  @Override
  public synchronized void transitionFrom(SessionStatus from, SessionStatus to)
      throws InvalidSessionTransitionException {
    inner.transitionFrom(from, to);
  }

  @Override
  public void abort() {
    inner.abort();
  }

  @Override
  public void abort(RepositorySessionFinishDelegate delegate) {
    inner.abort(new MiddlewareRepositorySessionFinishDelegate(this, delegate));
  }

  @Override
  public void storeIncomplete() {
    inner.storeIncomplete();
  }

  @Override
  public void storeDone() {
    inner.storeDone();
  }

  @Override
  public boolean shouldSkip() {
    return inner.shouldSkip();
  }

  @Override
  public boolean dataAvailable() {
    return inner.dataAvailable();
  }

  @Override
  public void unbundle(RepositorySessionBundle bundle) {
    inner.unbundle(bundle);
  }

  @Override
  public long getLastSyncTimestamp() {
    return inner.getLastSyncTimestamp();
  }

  @Override
  public long getLastFetchTimestamp() {
    return inner.getLastFetchTimestamp();
  }

  @Override
  public long getLastStoreTimestamp() {
    return inner.getLastStoreTimestamp();
  }
}
