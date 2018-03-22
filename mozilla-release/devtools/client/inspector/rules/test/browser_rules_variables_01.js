/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
 http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Test for variables in rule view.

const TEST_URI = URL_ROOT + "doc_variables_1.html";

add_task(function* () {
  yield addTab(TEST_URI);
  let {inspector, view} = yield openRuleView();
  yield selectNode("#target", inspector);

  info("Tests basic support for CSS Variables for both single variable " +
  "and double variable. Formats tested: var(x, constant), var(x, var(y))");

  let unsetColor = getRuleViewProperty(view, "div", "color").valueSpan
    .querySelector(".ruleview-unmatched-variable");
  let setColor = unsetColor.previousElementSibling;
  is(unsetColor.textContent, " red", "red is unmatched in color");
  is(setColor.textContent, "--color", "--color is not set correctly");
  is(setColor.dataset.variable, "--color = chartreuse",
                                "--color's dataset.variable is not set correctly");
  let previewTooltip = yield assertShowPreviewTooltip(view, setColor);
  yield assertTooltipHiddenOnMouseOut(previewTooltip, setColor);

  let unsetVar = getRuleViewProperty(view, "div", "background-color").valueSpan
    .querySelector(".ruleview-unmatched-variable");
  let setVar = unsetVar.nextElementSibling;
  let setVarName = setVar.firstElementChild.firstElementChild;
  is(unsetVar.textContent, "--not-set",
     "--not-set is unmatched in background-color");
  is(setVar.textContent, " var(--bg)", "var(--bg) parsed incorrectly");
  is(setVarName.textContent, "--bg", "--bg is not set correctly");
  is(setVarName.dataset.variable, "--bg = seagreen",
                                  "--bg's dataset.variable is not set correctly");
  previewTooltip = yield assertShowPreviewTooltip(view, setVarName);
  yield assertTooltipHiddenOnMouseOut(previewTooltip, setVarName);
});
