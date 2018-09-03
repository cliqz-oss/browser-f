/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { createFactory, PureComponent } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");

const FontMeta = createFactory(require("./FontMeta"));
const FontPreview = createFactory(require("./FontPreview"));

const Types = require("../types");

class Font extends PureComponent {
  static get propTypes() {
    return {
      font: PropTypes.shape(Types.font).isRequired,
      fontOptions: PropTypes.shape(Types.fontOptions).isRequired,
      onPreviewFonts: PropTypes.func.isRequired,
      onToggleFontHighlight: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      isFontFaceRuleExpanded: false,
    };

    this.onFontFaceRuleToggle = this.onFontFaceRuleToggle.bind(this);
  }

  componentWillReceiveProps(newProps) {
    if (this.props.font.name === newProps.font.name) {
      return;
    }

    this.setState({
      isFontFaceRuleExpanded: false,
    });
  }

  onFontFaceRuleToggle(event) {
    this.setState({
      isFontFaceRuleExpanded: !this.state.isFontFaceRuleExpanded
    });
    event.stopPropagation();
  }

  renderFontCSSCode(rule, ruleText) {
    if (!rule) {
      return null;
    }

    // Cut the rule text in 3 parts: the selector, the declarations, the closing brace.
    // This way we can collapse the declarations by default and display an expander icon
    // to expand them again.
    const leading = ruleText.substring(0, ruleText.indexOf("{") + 1);
    const body = ruleText.substring(ruleText.indexOf("{") + 1, ruleText.lastIndexOf("}"));
    const trailing = ruleText.substring(ruleText.lastIndexOf("}"));

    const { isFontFaceRuleExpanded } = this.state;

    return dom.pre(
      {
        className: "font-css-code",
      },
      this.renderFontCSSCodeTwisty(),
      leading,
      isFontFaceRuleExpanded ?
        body :
        dom.span(
          {
            className: "font-css-code-expander",
            onClick: this.onFontFaceRuleToggle,
          }
        ),
      trailing
    );
  }

  renderFontCSSCodeTwisty() {
    const { isFontFaceRuleExpanded } = this.state;

    const attributes = {
      className: "theme-twisty",
      onClick: this.onFontFaceRuleToggle,
    };
    if (isFontFaceRuleExpanded) {
      attributes.open = "true";
    }

    return dom.span(attributes);
  }

  render() {
    const {
      font,
      fontOptions,
      onPreviewFonts,
      onToggleFontHighlight,
    } = this.props;

    const { previewText } = fontOptions;

    const {
      previewUrl,
      rule,
      ruleText,
    } = font;

    return dom.li(
      {
        className: "font",
      },
      FontMeta({ font, onToggleFontHighlight }),
      FontPreview({ previewText, previewUrl, onPreviewFonts }),
      this.renderFontCSSCode(rule, ruleText)
    );
  }
}

module.exports = Font;
