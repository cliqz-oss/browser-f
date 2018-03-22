/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the reducer responding to the action `selectSnapshot(snapshot)`
 */

let actions = require("devtools/client/memory/actions/snapshot");
let { snapshotState: states } = require("devtools/client/memory/constants");

add_task(function* () {
  let front = new StubbedMemoryFront();
  yield front.attach();
  let store = Store();

  for (let i = 0; i < 5; i++) {
    store.dispatch(actions.takeSnapshot(front));
  }

  yield waitUntilState(store,
    ({ snapshots }) => snapshots.length === 5 && snapshots.every(isDone));

  for (let i = 0; i < 5; i++) {
    info(`Selecting snapshot[${i}]`);
    store.dispatch(actions.selectSnapshot(store.getState().snapshots[i].id));
    yield waitUntilState(store, ({ snapshots }) => snapshots[i].selected);

    let { snapshots } = store.getState();
    ok(snapshots[i].selected, `snapshot[${i}] selected`);
    equal(snapshots.filter(s => !s.selected).length, 4,
          "All other snapshots are unselected");
  }
});

function isDone(s) {
  return s.state === states.SAVED;
}
