// Copyright (C) 2016 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-dataview.prototype.getfloat64
description: >
  Detached buffer is only checked after ToIndex(requestIndex)
info: |
  24.2.4.6 DataView.prototype.getFloat64 ( byteOffset [ , littleEndian ] )

  1. Let v be the this value.
  2. If littleEndian is not present, let littleEndian be false.
  3. Return ? GetViewValue(v, byteOffset, littleEndian, "Float64").

  24.2.1.1 GetViewValue ( view, requestIndex, isLittleEndian, type )

  ...
  4. Let getIndex be ? ToIndex(requestIndex).
  ...
  6. Let buffer be view.[[ViewedArrayBuffer]].
  7. If IsDetachedBuffer(buffer) is true, throw a TypeError exception.
  ...
includes: [detachArrayBuffer.js]
---*/

var buffer = new ArrayBuffer(10);
var sample = new DataView(buffer, 0);

$DETACHBUFFER(buffer);

assert.throws(RangeError, function() {
  sample.getFloat64(-1);
});

assert.throws(RangeError, function() {
  sample.getFloat64(Infinity);
}, "Infinity");

reportCompare(0, 0);
