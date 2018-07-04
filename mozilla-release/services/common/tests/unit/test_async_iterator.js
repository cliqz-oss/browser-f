/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://services-common/async.js");
// Sinon seems to require setTimeout.
ChromeUtils.import("resource://gre/modules/Timer.jsm");
Services.scriptloader.loadSubScript("resource://testing-common/sinon-2.3.2.js", this);
/* globals sinon */

function makeArray(length) {
  // Start at 1 so that we can just divide by yieldEvery to get the expected
  // call count. (we exp)
  return Array.from({ length }, (v, i) => i + 1);
}

// Adjust if we ever change the default
const DEFAULT_YIELD_EVERY = 50;

async function checkIterYields(iterator, yieldEvery = DEFAULT_YIELD_EVERY) {
  let spy = sinon.spy(Async, "promiseYield");
  try {
    for await (let i of iterator) {
      let expectCount = Math.floor(i / yieldEvery);
      Assert.equal(spy.callCount, expectCount);
    }
  } finally {
    spy.restore();
  }
}

add_task(async function testWrapIterable() {
  let iterator = Async.yieldingIterator(makeArray(DEFAULT_YIELD_EVERY * 2));
  await checkIterYields(iterator);
});

add_task(async function testWrapIterator() {
  let innerIter = makeArray(DEFAULT_YIELD_EVERY * 2)[Symbol.iterator]();
  await checkIterYields(Async.yieldingIterator(innerIter));
});

add_task(async function testNumberArgument() {
  const yieldEvery = 10;
  let iterator = Async.yieldingIterator(makeArray(yieldEvery * 2), yieldEvery);
  await checkIterYields(iterator, yieldEvery);
});

add_task(async function testCustomJankYielder() {
  let fakeJankYielderSpy = sinon.spy();
  let iter = Async.yieldingIterator(makeArray(10), fakeJankYielderSpy);
  for await (let i of iter) {
    Assert.equal(fakeJankYielderSpy.callCount, i);
  }
});
