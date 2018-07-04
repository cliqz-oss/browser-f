/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test clearSnapshots deletes several snapshots

let { takeSnapshotAndCensus, clearSnapshots } = require("devtools/client/memory/actions/snapshot");
let { snapshotState: states, actions, treeMapState } = require("devtools/client/memory/constants");

add_task(async function() {
  let front = new StubbedMemoryFront();
  let heapWorker = new HeapAnalysesClient();
  await front.attach();
  let store = Store();
  const { getState, dispatch } = store;

  ok(true, "create 3 snapshots with a saved census");
  dispatch(takeSnapshotAndCensus(front, heapWorker));
  dispatch(takeSnapshotAndCensus(front, heapWorker));
  dispatch(takeSnapshotAndCensus(front, heapWorker));
  await waitUntilCensusState(store, snapshot => snapshot.treeMap,
    [treeMapState.SAVED, treeMapState.SAVED, treeMapState.SAVED]);
  ok(true, "snapshots created with a saved census");

  ok(true, "set first snapshot state to error");
  let id = getState().snapshots[0].id;
  dispatch({ type: actions.SNAPSHOT_ERROR, id, error: new Error("_") });
  await waitUntilSnapshotState(store,
    [states.ERROR, states.READ, states.READ]);
  ok(true, "first snapshot set to error state");

  ok(true, "dispatch clearSnapshots action");
  let deleteEvents = Promise.all([
    waitUntilAction(store, actions.DELETE_SNAPSHOTS_START),
    waitUntilAction(store, actions.DELETE_SNAPSHOTS_END)
  ]);
  dispatch(clearSnapshots(heapWorker));
  await deleteEvents;
  ok(true, "received delete snapshots events");

  equal(getState().snapshots.length, 0, "no snapshot remaining");

  heapWorker.destroy();
  await front.detach();
});
