'use strict';
// Copyright (C) 2016 the V8 project authors. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.
/*---
description: AnnexB extension not honored in strict mode
es6id: B.3.3.2
flags: [onlyStrict]
info: |
    Block statement in eval code containing a function declaration

    B.3.3.3 Changes to EvalDeclarationInstantiation

    1. If strict is false, then
---*/

var err;

eval('{ function f() {} }');

try {
  f;
} catch (exception) {
  err = exception;
}

assert.sameValue(err.constructor, ReferenceError);

reportCompare(0, 0);
