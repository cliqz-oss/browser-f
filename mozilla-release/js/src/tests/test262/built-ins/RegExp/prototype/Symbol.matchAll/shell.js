// file: compareIterator.js
// Copyright (C) 2018 Peter Wong.  All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
description: Compare the values of an iterator with an array of expected values
---*/

// Example:
//
//    function* numbers() {
//      yield 1;
//      yield 2;
//      yield 3;
//    }
//
//    compareIterator(numbers(), [
//      v => assert.sameValue(v, 1),
//      v => assert.sameValue(v, 2),
//      v => assert.sameValue(v, 3),
//    ]);
//
assert.compareIterator = function(iter, validators, message) {
  message = message || '';

  var i, result;
  for (i = 0; i < validators.length; i++) {
    result = iter.next();
    assert(!result.done, 'Expected ' + i + ' values(s). Instead iterator only produced ' + (i - 1) + ' value(s). ' + message);
    validators[i](result.value);
  }

  result = iter.next();
  assert(result.done, 'Expected only ' + i + ' values(s). Instead iterator produced more. ' + message);
  assert.sameValue(result.value, undefined, 'Expected value of `undefined` when iterator completes. ' + message);
}

// file: regExpUtils.js
// Copyright (C) 2017 Ecma International.  All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
description: |
    Collection of functions used to assert the correctness of RegExp objects.
---*/

function buildString({ loneCodePoints, ranges }) {
  const CHUNK_SIZE = 10000;
  let result = String.fromCodePoint(...loneCodePoints);
  for (const [start, end] of ranges) {
    const codePoints = [];
    for (let length = 0, codePoint = start; codePoint <= end; codePoint++) {
      codePoints[length++] = codePoint;
      if (length === CHUNK_SIZE) {
        result += String.fromCodePoint(...codePoints);
        codePoints.length = length = 0;
      }
    }
    result += String.fromCodePoint(...codePoints);
  }
  return result;
}

function testPropertyEscapes(regex, string, expression) {
  if (!regex.test(string)) {
    for (const symbol of string) {
      const hex = symbol
        .codePointAt(0)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      assert(
        regex.test(symbol),
        `\`${ expression }\` should match U+${ hex } (\`${ symbol }\`)`
      );
    }
  }
}

// Returns a function that will validate RegExp match result
//
// Example:
//
//    var validate = matchValidator(['b'], 1, 'abc');
//    validate(/b/.exec('abc'));
//
function matchValidator(expectedEntries, expectedIndex, expectedInput) {
  return function(match) {
    assert.compareArray(match, expectedEntries, 'Match entries');
    assert.sameValue(match.index, expectedIndex, 'Match index');
    assert.sameValue(match.input, expectedInput, 'Match input');
  }
}
