/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

"use strict";

requestLongerTimeout(2);

// Check that the timeline toolbar displays the current time, and that it
// changes when animations are playing, gets back to 0 when animations are
// rewound, and stops when animations are paused.

add_task(async function() {
  await addTab(URL_ROOT + "doc_simple_animation.html");

  const {panel} = await openAnimationInspector();
  const label = panel.timelineCurrentTimeEl;
  ok(label, "The current time label exists");

  // On page load animations are playing so the time shoud change, although we
  // don't want to test the exact value of the time displayed, just that it
  // actually changes.
  info("Make sure the time displayed actually changes");
  await isCurrentTimeLabelChanging(panel, true);

  info("Pause the animations and check that the time stops changing");
  await clickTimelinePlayPauseButton(panel);
  await isCurrentTimeLabelChanging(panel, false);

  info("Rewind the animations and check that the time stops changing");
  await clickTimelineRewindButton(panel);
  await isCurrentTimeLabelChanging(panel, false);
  is(label.textContent, "00:00.000");
});

async function isCurrentTimeLabelChanging(panel, isChanging) {
  const label = panel.timelineCurrentTimeEl;

  const time1 = label.textContent;
  await new Promise(r => setTimeout(r, 200));
  const time2 = label.textContent;

  if (isChanging) {
    ok(time1 !== time2, "The text displayed in the label changes with time");
  } else {
    is(time1, time2, "The text displayed in the label doesn't change");
  }
}
