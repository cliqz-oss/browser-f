/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { getStr } = require("../utils/l10n");
const { parseFontVariationAxes } = require("../utils/font-utils");

const {
  APPLY_FONT_VARIATION_INSTANCE,
  RESET_EDITOR,
  UPDATE_AXIS_VALUE,
  UPDATE_CUSTOM_INSTANCE,
  UPDATE_EDITOR_STATE,
  UPDATE_PROPERTY_VALUE,
} = require("../actions/index");

const INITIAL_STATE = {
  // Variable font axes.
  axes: {},
  // Copy of the most recent axes values. Used to revert from a named instance.
  customInstanceValues: [],
  // Font families declared on the selected element
  families: {
    // Names of font families used
    used: [],
    // Names of font families declared but not used
    notUsed: []
  },
  // Fonts whose family names are declared in CSS font-family and used
  // on the selected element.
  fonts: [],
  // Current selected font variation instance.
  instance: {
    name: getStr("fontinspector.customInstanceName"),
    values: [],
  },
  // CSS font properties defined on the selected rule.
  properties: {},
};

const reducers = {

  // Update font editor with the axes and values defined by a font variation instance.
  [APPLY_FONT_VARIATION_INSTANCE](state, { name, values }) {
    const newState = { ...state };
    newState.instance.name = name;
    newState.instance.values = values;

    if (Array.isArray(values) && values.length) {
      newState.axes = values.reduce((acc, value) => {
        acc[value.axis] = value.value;
        return acc;
      }, {});
    }

    return newState;
  },

  [RESET_EDITOR](state) {
    return { ...INITIAL_STATE };
  },

  [UPDATE_AXIS_VALUE](state, { axis, value }) {
    const newState = { ...state };
    newState.axes[axis] = value;
    return newState;
  },

  // Copy state of current axes in the format of the "values" property of a named font
  // variation instance.
  [UPDATE_CUSTOM_INSTANCE](state) {
    const newState = { ...state };
    newState.customInstanceValues = Object.keys(state.axes).map(axis => {
      return { axis: [axis], value: state.axes[axis] };
    });
    return newState;
  },

  [UPDATE_EDITOR_STATE](state, { fonts, families, properties }) {
    const axes = parseFontVariationAxes(properties["font-variation-settings"]);

    // If not defined in font-variation-settings, setup "wght" axis with the value of
    // "font-weight" if it is numeric and not a keyword.
    const weight = properties["font-weight"];
    if (axes.wght === undefined && parseFloat(weight).toString() === weight.toString()) {
      axes.wght = weight;
    }

    // If not defined in font-variation-settings, setup "wdth" axis with the percentage
    // number from the value of "font-stretch" if it is not a keyword.
    const stretch = properties["font-stretch"];
    // Match the number part from values like: 10%, 10.55%, 0.2%
    // If there's a match, the number is the second item in the match array.
    const match = stretch.trim().match(/^(\d+(.\d+)?)%$/);
    if (axes.wdth === undefined && match && match[1]) {
      axes.wdth = match[1];
    }

    return { ...state, axes, fonts, families, properties };
  },

  [UPDATE_PROPERTY_VALUE](state, { property, value }) {
    const newState = { ...state };
    newState.properties[property] = value;
    return newState;
  }

};

module.exports = function(state = INITIAL_STATE, action) {
  const reducer = reducers[action.type];
  if (!reducer) {
    return state;
  }
  return reducer(state, action);
};
