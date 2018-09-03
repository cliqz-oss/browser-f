/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { createFactory, PureComponent } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");

const FontMeta = createFactory(require("./FontMeta"));
const FontPropertyValue = createFactory(require("./FontPropertyValue"));
const FontSize = createFactory(require("./FontSize"));
const FontStyle = createFactory(require("./FontStyle"));
const FontWeight = createFactory(require("./FontWeight"));

const { getStr } = require("../utils/l10n");
const Types = require("../types");

class FontEditor extends PureComponent {
  static get propTypes() {
    return {
      fontEditor: PropTypes.shape(Types.fontEditor).isRequired,
      onInstanceChange: PropTypes.func.isRequired,
      onPropertyChange: PropTypes.func.isRequired,
      onToggleFontHighlight: PropTypes.func.isRequired,
    };
  }

  /**
   * Naive implementation to get increment step for variable font axis that ensures
   * a wide spectrum of precision based on range of values between min and max.
   *
   * @param  {Number|String} min
   *         Minumum value for range.
   * @param  {Number|String} max
   *         Maximum value for range.
   * @return {String}
   *         Step value used in range input for font axis.
   */
  getAxisStep(min, max) {
    let step = 1;
    const delta = parseInt(max, 10) - parseInt(min, 10);

    if (delta <= 1) {
      step = 0.001;
    } else if (delta <= 10) {
      step = 0.01;
    } else if (delta <= 100) {
      step = 0.1;
    }

    return step.toString();
  }

  /**
   * Get an array of FontPropertyValue components for of the given variable font axes.
   * If an axis is defined in the fontEditor store, use its value, else use the default.
   *
   * @param  {Array} fontAxes
   *         Array of font axis instances
   * @param  {Object} editedAxes
   *         Object with axes and values edited by the user or predefined in the CSS
   *         declaration for font-variation-settings.
   * @return {Array}
  *          Array of FontPropertyValue components
   */
  renderAxes(fontAxes = [], editedAxes) {
    return fontAxes.map(axis => {
      return FontPropertyValue({
        min: axis.minValue,
        max: axis.maxValue,
        value: editedAxes[axis.tag] || axis.defaultValue,
        step: this.getAxisStep(axis.minValue, axis.maxValue),
        label: axis.name,
        name: axis.tag,
        onChange: this.props.onPropertyChange,
        unit: null
      });
    });
  }
  /**
   * Render font family, font name, and metadata for all fonts used on selected node.
   *
   * @param {Array} fonts
   *        Fonts used on selected node.
   * @param {Function} onToggleFontHighlight
   *        Callback to trigger in-context highlighting of text that uses a font.
   * @return {DOMNode}
   */
  renderFontFamily(fonts, onToggleFontHighlight) {
    if (!fonts.length) {
      return null;
    }

    const fontList = dom.ul(
      {
        className: "fonts-list"
      },
      fonts.map(font => {
        return dom.li(
          {},
          FontMeta({ font, onToggleFontHighlight })
        );
      })
    );

    return dom.label(
      {
        className: "font-control font-control-family",
      },
      dom.span(
        {
          className: "font-control-label",
        },
        getStr("fontinspector.fontFamilyLabel")
      ),
      dom.div(
        {
          className: "font-control-box",
        },
        fontList
      )
    );
  }

  renderFontSize(value) {
    return value && FontSize({
      onChange: this.props.onPropertyChange,
      value,
    });
  }

  renderFontStyle(value) {
    return value && FontStyle({
      onChange: this.props.onPropertyChange,
      value,
    });
  }

  renderFontWeight(value) {
    return value && FontWeight({
      onChange: this.props.onPropertyChange,
      value,
    });
  }

  /**
   * Get a dropdown which allows selecting between variation instances defined by a font.
   *
   * @param {Array} fontInstances
   *        Named variation instances as provided with the font file.
   * @param {Object} selectedInstance
   *        Object with information about the currently selected variation instance.
   *        Example:
   *        {
   *          name: "Custom",
   *          values: []
   *        }
   * @return {DOMNode}
   */
  renderInstances(fontInstances = [], selectedInstance) {
    // Append a "Custom" instance entry which represents the latest manual axes changes.
    const customInstance = {
      name: getStr("fontinspector.customInstanceName"),
      values: this.props.fontEditor.customInstanceValues
    };
    fontInstances = [ ...fontInstances, customInstance ];

    // Generate the <option> elements for the dropdown.
    const instanceOptions = fontInstances.map(instance =>
      dom.option(
        {
          value: instance.name,
          selected: instance.name === selectedInstance.name ? "selected" : null,
        },
        instance.name
      )
    );

    // Generate the dropdown.
    const instanceSelect = dom.select(
      {
        className: "font-control-input",
        onChange: (e) => {
          const instance = fontInstances.find(inst => e.target.value === inst.name);
          instance && this.props.onInstanceChange(instance.name, instance.values);
        }
      },
      instanceOptions
    );

    return dom.label(
      {
        className: "font-control",
      },
      dom.span(
        {
          className: "font-control-label",
        },
        getStr("fontinspector.fontInstanceLabel")
      ),
      instanceSelect
    );
  }

  renderWarning() {
    return dom.div(
      {
        className: "devtools-sidepanel-no-result"
      },
      getStr("fontinspector.noFontsOnSelectedElement")
    );
  }

  render() {
    const { fontEditor, onToggleFontHighlight } = this.props;
    const { fonts, axes, instance, properties } = fontEditor;
    // Pick the first font to show editor controls regardless of how many fonts are used.
    const font = fonts[0];
    const hasFontAxes = font && font.variationAxes;
    const hasFontInstances = font && font.variationInstances
      && font.variationInstances.length > 0;
    const hasSlantOrItalicAxis = hasFontAxes && font.variationAxes.find(axis => {
      return axis.tag === "slnt" || axis.tag === "ital";
    });
    const hasWeightAxis = hasFontAxes && font.variationAxes.find(axis => {
      return axis.tag === "wght";
    });
    // Check for falsy font-weight value (undefined or empty string).
    const hasWeight = properties["font-weight"] != null;

    return dom.div(
      {
        id: "font-editor"
      },
      // Render empty state message for nodes that don't have font properties.
      !hasWeight && this.renderWarning(),
      // Always render UI for font family, format and font file URL.
      this.renderFontFamily(fonts, onToggleFontHighlight),
      // Render UI for font variation instances if they are defined.
      hasFontInstances && this.renderInstances(font.variationInstances, instance),
      // Always render UI for font size.
      this.renderFontSize(properties["font-size"]),
      // Render UI for font weight if no "wght" registered axis is defined.
      !hasWeightAxis && this.renderFontWeight(properties["font-weight"]),
      // Render UI for font style if no "slnt" or "ital" registered axis is defined.
      !hasSlantOrItalicAxis && this.renderFontStyle(properties["font-style"]),
      // Render UI for each variable font axis if any are defined.
      hasFontAxes && this.renderAxes(font.variationAxes, axes)
    );
  }
}

module.exports = FontEditor;
