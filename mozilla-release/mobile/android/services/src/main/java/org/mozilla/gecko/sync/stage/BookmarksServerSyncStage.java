/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.sync.stage;

import android.net.Uri;

import java.net.URISyntaxException;

import org.mozilla.gecko.sync.MetaGlobalException;
import org.mozilla.gecko.sync.repositories.ConfigurableServer15Repository;
import org.mozilla.gecko.sync.repositories.RecordFactory;
import org.mozilla.gecko.sync.repositories.Repository;
import org.mozilla.gecko.sync.repositories.android.BrowserContractHelpers;
import org.mozilla.gecko.sync.repositories.android.BookmarksRepository;
import org.mozilla.gecko.sync.repositories.domain.BookmarkRecordFactory;
import org.mozilla.gecko.sync.repositories.domain.VersionConstants;

public class BookmarksServerSyncStage extends VersionedServerSyncStage {
  protected static final String LOG_TAG = "BookmarksStage";

  // Eventually this kind of sync stage will be data-driven,
  // and all this hard-coding can go away.
  private static final String BOOKMARKS_SORT = "oldest";
  private static final long BOOKMARKS_BATCH_LIMIT = 5000;

  @Override
  protected String getCollection() {
    return "bookmarks";
  }

  @Override
  protected String getEngineName() {
    return "bookmarks";
  }

  @Override
  public Integer getStorageVersion() {
    return VersionConstants.BOOKMARKS_ENGINE_VERSION;
  }

  @Override
  /* package-private */ Uri getLocalDataUri() {
    return BrowserContractHelpers.BOOKMARKS_CONTENT_URI;
  }

  /**
   * We're downloading records into a non-persistent buffer for safety, so we can't use a H.W.M.
   * Once this stage is using a persistent buffer, this should change. See Bug 1318515.
   *
   * @return HighWaterMark.Disabled
   */
  @Override
  protected HighWaterMark getAllowedToUseHighWaterMark() {
    return HighWaterMark.Disabled;
  }

  /**
   * Full batching is allowed, because we want all of the records.
   *
   * @return MultipleBatches.Enabled
   */
  @Override
  protected MultipleBatches getAllowedMultipleBatches() {
    return MultipleBatches.Enabled;
  }

  @Override
  protected Repository getRemoteRepository() throws URISyntaxException {
    return new ConfigurableServer15Repository(
            getCollection(),
            session.getSyncDeadline(),
            session.config.storageURL(),
            session.getAuthHeaderProvider(),
            session.config.infoCollections,
            session.config.infoConfiguration,
            BOOKMARKS_BATCH_LIMIT,
            BOOKMARKS_SORT,
            getAllowedMultipleBatches(),
            getAllowedToUseHighWaterMark(),
            getRepositoryStateProvider(),
            false,
            true
    );
  }

  @Override
  protected Repository getLocalRepository() {
    return new BookmarksRepository();
  }

  @Override
  protected RecordFactory getRecordFactory() {
    return new BookmarkRecordFactory();
  }

  @Override
  protected boolean isEnabled() throws MetaGlobalException {
    if (session == null || session.getContext() == null) {
      return false;
    }
    return super.isEnabled();
  }
}
