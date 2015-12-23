/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

function doesNotThrow(f) {
  try {
    f();
  } catch(e) {
    ok(false, e + e.stack);
  }
}

var assert = this;
