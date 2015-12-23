/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

const {PushDB, PushService, PushServiceWebSocket} = serviceExports;

const userAgentID = '28cd09e2-7506-42d8-9e50-b02785adc7ef';

function run_test() {
  do_get_profile();
  setPrefs({
    userAgentID,
  });
  run_next_test();
}

add_task(function* test_expiration_history_observer() {
  let db = PushServiceWebSocket.newPushDB();
  do_register_cleanup(() => db.drop().then(_ => db.close()));

  // A registration that we'll expire...
  yield db.put({
    channelID: '379c0668-8323-44d2-a315-4ee83f1a9ee9',
    pushEndpoint: 'https://example.org/push/1',
    scope: 'https://example.com/deals',
    pushCount: 0,
    lastPush: 0,
    version: null,
    originAttributes: '',
    quota: 16,
  });

  // ...And an expired registration that we'll revive later.
  yield db.put({
    channelID: 'eb33fc90-c883-4267-b5cb-613969e8e349',
    pushEndpoint: 'https://example.org/push/2',
    scope: 'https://example.com/auctions',
    pushCount: 0,
    lastPush: 0,
    version: null,
    originAttributes: '',
    quota: 0,
  });

  yield addVisit({
    uri: 'https://example.com/infrequent',
    title: 'Infrequently-visited page',
    visits: [{
      visitDate: (Date.now() - 14 * 24 * 60 * 60 * 1000) * 1000,
      transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
    }],
  });

  let unregisterDone;
  let unregisterPromise = new Promise(resolve => unregisterDone = resolve);

  PushService.init({
    serverURI: 'wss://push.example.org/',
    networkInfo: new MockDesktopNetworkInfo(),
    db,
    makeWebSocket(uri) {
      return new MockWebSocket(uri, {
        onHello(request) {
          deepEqual(request.channelIDs, [
            '379c0668-8323-44d2-a315-4ee83f1a9ee9',
          ], 'Should not include expired channel IDs');
          this.serverSendMsg(JSON.stringify({
            messageType: 'hello',
            status: 200,
            uaid: userAgentID,
          }));
          this.serverSendMsg(JSON.stringify({
            messageType: 'notification',
            updates: [{
              channelID: '379c0668-8323-44d2-a315-4ee83f1a9ee9',
              version: 2,
            }],
          }));
        },
        onUnregister(request) {
          equal(request.channelID, '379c0668-8323-44d2-a315-4ee83f1a9ee9', 'Dropped wrong channel ID');
          unregisterDone();
        },
        onACK(request) {},
      });
    }
  });

  yield waitForPromise(unregisterPromise, DEFAULT_TIMEOUT,
    'Timed out waiting for unregister request');

  let expiredRecord = yield db.getByKeyID('379c0668-8323-44d2-a315-4ee83f1a9ee9');
  strictEqual(expiredRecord.quota, 0, 'Expired record not updated');

  let notifiedScopes = [];
  let subChangePromise = promiseObserverNotification('push-subscription-change', (subject, data) => {
    notifiedScopes.push(data);
    return notifiedScopes.length == 2;
  });

  // Now visit the site...
  yield addVisit({
    uri: 'https://example.com/another-page',
    title: 'Infrequently-visited page',
    visits: [{
      visitDate: Date.now() * 1000,
      transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
    }],
  });
  Services.obs.notifyObservers(null, 'idle-daily', '');

  // And we should receive notifications for both scopes.
  yield waitForPromise(subChangePromise, DEFAULT_TIMEOUT,
    'Timed out waiting for subscription change events');
  deepEqual(notifiedScopes.sort(), [
    'https://example.com/auctions',
    'https://example.com/deals'
  ], 'Wrong scopes for subscription changes');

  let aRecord = yield db.getByKeyID('379c0668-8323-44d2-a315-4ee83f1a9ee9');
  ok(!aRecord, 'Should drop expired record');

  let bRecord = yield db.getByKeyID('eb33fc90-c883-4267-b5cb-613969e8e349');
  ok(!bRecord, 'Should drop evicted record');
});
