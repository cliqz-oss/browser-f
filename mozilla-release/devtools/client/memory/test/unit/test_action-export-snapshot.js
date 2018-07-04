/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test exporting a snapshot to a user specified location on disk.

let { exportSnapshot } = require("devtools/client/memory/actions/io");
let { takeSnapshotAndCensus } = require("devtools/client/memory/actions/snapshot");
let { actions, treeMapState } = require("devtools/client/memory/constants");

add_task(async function() {
  let front = new StubbedMemoryFront();
  let heapWorker = new HeapAnalysesClient();
  await front.attach();
  let store = Store();
  const { getState, dispatch } = store;

  let destPath = await createTempFile();
  dispatch(takeSnapshotAndCensus(front, heapWorker));
  await waitUntilCensusState(store, snapshot => snapshot.treeMap,
                             [treeMapState.SAVED]);

  let exportEvents = Promise.all([
    waitUntilAction(store, actions.EXPORT_SNAPSHOT_START),
    waitUntilAction(store, actions.EXPORT_SNAPSHOT_END)
  ]);
  dispatch(exportSnapshot(getState().snapshots[0], destPath));
  await exportEvents;

  let stat = await OS.File.stat(destPath);
  info(stat.size);
  ok(stat.size > 0, "destination file is more than 0 bytes");

  heapWorker.destroy();
  await front.detach();
});
