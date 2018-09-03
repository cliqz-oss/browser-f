/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

requestLongerTimeout(2);

// Test that a page navigation resets the state of the global toggle button.

add_task(async function() {
  await addTab(URL_ROOT + "doc_simple_animation.html");
  const {inspector, panel} = await openAnimationInspector();

  info("Select the non-animated test node");
  await selectNodeAndWaitForAnimations(".still", inspector);

  ok(!panel.toggleAllButtonEl.classList.contains("paused"),
    "The toggle button is in its running state by default");

  info("Toggle all animations, so that they pause");
  await panel.toggleAll();
  ok(panel.toggleAllButtonEl.classList.contains("paused"),
    "The toggle button now is in its paused state");

  info("Reloading the page");
  await reloadTab(inspector);

  ok(!panel.toggleAllButtonEl.classList.contains("paused"),
    "The toggle button is back in its running state");
});
