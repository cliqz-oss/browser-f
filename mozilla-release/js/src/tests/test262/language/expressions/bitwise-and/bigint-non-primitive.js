// |reftest| skip -- BigInt is not supported
// Copyright (C) 2017 Josh Wolfe. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
description: Bitwise AND for BigInt non-primitive values
esid: sec-binary-bitwise-operators-runtime-semantics-evaluation
info: |
  5. Let lnum be ? ToNumeric(lval).
  6. Let rnum be ? ToNumeric(rval).
  ...
  8. Let T be Type(lnum).
  9. If @ is &, return T::bitwiseAND(lnum, rnum).

features: [BigInt]
---*/

assert.sameValue(Object(0b101n) & 0b011n, 0b001n, "Object(0b101n) & 0b011n === 0b001n");
assert.sameValue(0b011n & Object(0b101n), 0b001n, "0b011n & Object(0b101n) === 0b001n");
assert.sameValue(Object(0b101n) & Object(0b011n), 0b001n, "Object(0b101n) & Object(0b011n) === 0b001n");

function err() {
  throw new Test262Error();
}

assert.sameValue(
  {[Symbol.toPrimitive]: function() { return 0b101n; }, valueOf: err, toString: err} & 0b011n, 0b001n,
  "primitive from @@toPrimitive");
assert.sameValue(
  0b011n & {[Symbol.toPrimitive]: function() { return 0b101n; }, valueOf: err, toString: err}, 0b001n,
  "primitive from @@toPrimitive");
assert.sameValue(
  {valueOf: function() { return 0b101n; }, toString: err} & 0b011n, 0b001n,
  "primitive from {}.valueOf");
assert.sameValue(
  0b011n & {valueOf: function() { return 0b101n; }, toString: err}, 0b001n,
  "primitive from {}.valueOf");
assert.sameValue(
  {toString: function() { return 0b101n; }} & 0b011n, 0b001n,
  "primitive from {}.toString");
assert.sameValue(
  0b011n & {toString: function() { return 0b101n; }}, 0b001n,
  "primitive from {}.toString");

reportCompare(0, 0);
