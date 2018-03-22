/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { PureComponent } = require("devtools/client/shared/vendor/react");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const dom = require("devtools/client/shared/vendor/react-dom-factories");

class AnimationTimeTickItem extends PureComponent {
  static get propTypes() {
    return {
      position: PropTypes.number.isRequired,
      timeTickLabel: PropTypes.string.isRequired,
    };
  }

  render() {
    const { position, timeTickLabel } = this.props;

    return dom.div(
      {
        className: "animation-timeline-tick-item",
        style: { left: `${ position }%` }
      },
      timeTickLabel
    );
  }
}

module.exports = AnimationTimeTickItem;
