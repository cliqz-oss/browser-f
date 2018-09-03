/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable no-shadow */

"use strict";

/**
 * Test that the PromisesActor exists in the TabActors and ParentProcessTargetActors.
 */

add_task(async function() {
  const client = await startTestDebuggerServer("promises-actor-test");

  const response = await listTabs(client);
  const targetTab = findTab(response.tabs, "promises-actor-test");
  Assert.ok(targetTab, "Found our target tab.");

  // Attach to the BrowsingContextTargetActor and check the response
  await new Promise(resolve => {
    client.request({ to: targetTab.actor, type: "attach" }, response => {
      Assert.ok(!("error" in response), "Expect no error in response.");
      Assert.equal(response.from, targetTab.actor,
        "Expect the target BrowsingContextTargetActor in response form field.");
      Assert.equal(response.type, "tabAttached",
        "Expect tabAttached in the response type.");
      Assert.ok(typeof response.promisesActor === "string",
        "Should have a tab context PromisesActor.");
      resolve();
    });
  });

  const parentProcessActors = await getParentProcessActors(client);
  Assert.ok(typeof parentProcessActors.promisesActor === "string",
    "Should have a chrome context PromisesActor.");
});
