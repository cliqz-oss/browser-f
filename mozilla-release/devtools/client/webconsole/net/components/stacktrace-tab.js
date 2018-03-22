/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component, createFactory } = require("devtools/client/shared/vendor/react");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const StackTrace =
  createFactory(require("devtools/client/shared/components/StackTrace"));

class StackTraceTab extends Component {
  static get propTypes() {
    return {
      data: PropTypes.object.isRequired,
      actions: PropTypes.shape({
        onViewSourceInDebugger: PropTypes.func.isRequired
      }),
      // Service to enable the source map feature.
      sourceMapService: PropTypes.object,
    };
  }

  render() {
    let { stacktrace } = this.props.data.cause;
    let { actions, sourceMapService } = this.props;
    let onViewSourceInDebugger = actions.onViewSourceInDebugger.bind(actions);

    return StackTrace({ stacktrace, onViewSourceInDebugger, sourceMapService });
  }
}

// Exports from this module
module.exports = StackTraceTab;
