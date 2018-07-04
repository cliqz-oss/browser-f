/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function test_no_changes() {
  let buf = await openMirror("nochanges");

  await PlacesUtils.bookmarks.insertTree({
    guid: PlacesUtils.bookmarks.menuGuid,
    children: [{
      guid: "mozBmk______",
      url: "https://mozilla.org",
      title: "Mozilla",
      tags: ["moz", "dot", "org"],
    }],
  });
  await storeRecords(buf, shuffle([{
    id: "menu",
    type: "folder",
    children: ["mozBmk______"],
  }, {
    id: "toolbar",
    type: "folder",
    children: [],
  }, {
    id: "unfiled",
    type: "folder",
    children: [],
  }, {
    id: "mobile",
    type: "folder",
    children: [],
  }, {
    id: "mozBmk______",
    type: "bookmark",
    title: "Mozilla",
    bmkUri: "https://mozilla.org",
    tags: ["moz", "dot", "org"],
  }]), { needsMerge: false });
  await PlacesTestUtils.markBookmarksAsSynced();

  const hasChanges = await buf.hasChanges();
  Assert.ok(!hasChanges);

  await buf.finalize();
  await PlacesUtils.bookmarks.eraseEverything();
  await PlacesSyncUtils.bookmarks.reset();
});

add_task(async function test_changes_remote() {
  let buf = await openMirror("remote_changes");

  await PlacesUtils.bookmarks.insertTree({
    guid: PlacesUtils.bookmarks.menuGuid,
    children: [{
      guid: "mozBmk______",
      url: "https://mozilla.org",
      title: "Mozilla",
      tags: ["moz", "dot", "org"],
    }],
  });
  await storeRecords(buf, shuffle([{
    id: "menu",
    type: "folder",
    children: ["mozBmk______"],
  }, {
    id: "mozBmk______",
    type: "bookmark",
    title: "Mozilla",
    bmkUri: "https://mozilla.org",
    tags: ["moz", "dot", "org"],
  }]), { needsMerge: false });
  await PlacesTestUtils.markBookmarksAsSynced();

  await storeRecords(buf, [{
    id: "mozBmk______",
    type: "bookmark",
    title: "New Mozilla",
    bmkUri: "https://mozilla.org",
    tags: ["moz", "dot", "org"]
  }], { needsMerge: true });

  const hasChanges = await buf.hasChanges();
  Assert.ok(hasChanges);

  await buf.finalize();
  await PlacesUtils.bookmarks.eraseEverything();
  await PlacesSyncUtils.bookmarks.reset();
});

add_task(async function test_changes_local() {
  let buf = await openMirror("local_changes");

  await PlacesUtils.bookmarks.insertTree({
    guid: PlacesUtils.bookmarks.menuGuid,
    children: [{
      guid: "mozBmk______",
      url: "https://mozilla.org",
      title: "Mozilla",
      tags: ["moz", "dot", "org"],
    }],
  });
  await storeRecords(buf, shuffle([{
    id: "menu",
    type: "folder",
    children: ["mozBmk______"],
  }, {
    id: "mozBmk______",
    type: "bookmark",
    title: "Mozilla",
    bmkUri: "https://mozilla.org",
    tags: ["moz", "dot", "org"],
  }]), { needsMerge: false });
  await PlacesTestUtils.markBookmarksAsSynced();

  await PlacesUtils.bookmarks.update({
    guid: "mozBmk______",
    title: "New Mozilla!",
  });

  const hasChanges = await buf.hasChanges();
  Assert.ok(hasChanges);

  await buf.finalize();
  await PlacesUtils.bookmarks.eraseEverything();
  await PlacesSyncUtils.bookmarks.reset();
});

add_task(async function test_changes_deleted_bookmark() {
  let buf = await openMirror("delete_bookmark");

  await PlacesUtils.bookmarks.insertTree({
    guid: PlacesUtils.bookmarks.menuGuid,
    children: [{
      guid: "mozBmk______",
      url: "https://mozilla.org",
      title: "Mozilla",
      tags: ["moz", "dot", "org"],
    }],
  });
  await storeRecords(buf, shuffle([{
    id: "menu",
    type: "folder",
    children: ["mozBmk______"],
  }, {
    id: "mozBmk______",
    type: "bookmark",
    title: "Mozilla",
    bmkUri: "https://mozilla.org",
    tags: ["moz", "dot", "org"],
  }]), { needsMerge: false });
  await PlacesTestUtils.markBookmarksAsSynced();

  await PlacesUtils.bookmarks.remove("mozBmk______");

  const hasChanges = await buf.hasChanges();
  Assert.ok(hasChanges);

  await buf.finalize();
  await PlacesUtils.bookmarks.eraseEverything();
  await PlacesSyncUtils.bookmarks.reset();
});
