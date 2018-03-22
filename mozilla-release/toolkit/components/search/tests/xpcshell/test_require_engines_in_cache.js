/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function run_test() {
  do_load_manifest("data/chrome.manifest");

  configureToLoadJarEngines();
  Assert.ok(!Services.search.isInitialized);

  run_next_test();
}

add_task(async function ignore_cache_files_without_engines() {
  let commitPromise = promiseAfterCache();
  await asyncInit();

  let engineCount = Services.search.getEngines().length;
  Assert.equal(engineCount, 1);

  // Wait for the file to be saved to disk, so that we can mess with it.
  await commitPromise;

  // Remove all engines from the cache file.
  let cache = await promiseCacheData();
  cache.engines = [];
  await promiseSaveCacheData(cache);

  // Check that after an async re-initialization, we still have the same engine count.
  commitPromise = promiseAfterCache();
  await asyncReInit();
  Assert.equal(engineCount, Services.search.getEngines().length);
  await commitPromise;

  // Check that after a sync re-initialization, we still have the same engine count.
  await promiseSaveCacheData(cache);
  let unInitPromise = waitForSearchNotification("uninit-complete");
  let reInitPromise = asyncReInit();
  await unInitPromise;
  Assert.ok(!Services.search.isInitialized);
  // Synchronously check the engine count; will force a sync init.
  Assert.equal(engineCount, Services.search.getEngines().length);
  Assert.ok(Services.search.isInitialized);
  await reInitPromise;
});

add_task(async function skip_writing_cache_without_engines() {
  let unInitPromise = waitForSearchNotification("uninit-complete");
  let reInitPromise = asyncReInit();
  await unInitPromise;

  // Configure so that no engines will be found.
  Assert.ok(removeCacheFile());
  let resProt = Services.io.getProtocolHandler("resource")
                        .QueryInterface(Ci.nsIResProtocolHandler);
  resProt.setSubstitution("search-plugins",
                          Services.io.newURI("about:blank"));

  // Let the async-reInit happen.
  await reInitPromise;
  Assert.equal(0, Services.search.getEngines().length);

  // Trigger yet another re-init, to flush of any pending cache writing task.
  unInitPromise = waitForSearchNotification("uninit-complete");
  reInitPromise = asyncReInit();
  await unInitPromise;

  // Now check that a cache file doesn't exist.
  Assert.ok(!removeCacheFile());

  await reInitPromise;
});
