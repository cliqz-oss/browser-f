/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * nodejs script to generate: testing/talos/talos/tests/devtools/addon/content/pages/custom/inspector.html
 *
 * Execute it like this:
 * $ nodejs generate-inspector-html.js > testing/talos/talos/tests/devtools/addon/content/pages/custom/inspector.html
 */

// We first create a deep tree with ${deep} nested children
let deep = 50;
// Then we create ${n} element after the deep tree
let n = 50;
// Number of attributes set on the repeated elements
let attributes = 50;

// Build the <div> with $attributes data attributes
let div = "<div";
for (var i = 1; i <= attributes; i++) {
  div += ` data-a${i}="${i}"`;
}
div += ">";

// Build the tree of $deep elements
let tree = "";
for (i = 1; i <= deep; i++) {
  tree += new Array(i).join(" ");
  tree += div + " " + i + "\n";
}
for (i = deep; i >= 1; i--) {
  tree += new Array(i).join(" ");
  tree += "</div>\n";
}

// Build the list of $n elements
let repeat = "";
for (i = 1; i <= n; i++) {
  repeat += div + " " + i + " </div>\n";
}

console.log(`
<!DOCTYPE html>
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this file,
   - You can obtain one at http://mozilla.org/MPL/2.0/.  -->
<!-- This file is a generated file, do not edit it directly.
   - See generate-inspector-html.js for instructions to update this file -->
<html>
<head>
  <meta charset="utf-8">
  <title>Custom page for the Inspector</title>
  <style>
  div {
    margin-left: 0.5em;
  }
  </style>
</head>
<body>
<!-- <div> elements with ${deep} nested childs, all with ${attributes} attributes -->
<!-- The deepest <div> has id="deep"> -->
`);
console.log(tree);
console.log(`
<!-- ${n} <div> elements without any children -->
`);
console.log(repeat);
console.log(`
</body>
</html>`);

