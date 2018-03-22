/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component } = require("devtools/client/shared/vendor/react");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const dom = require("devtools/client/shared/vendor/react-dom-factories");

/**
 * This template represents a size limit notification message
 * used e.g. in the Response tab when response body exceeds
 * size limit. The message contains a link allowing the user
 * to fetch the rest of the data from the backend (debugger server).
 */
class SizeLimit extends Component {
  static get propTypes() {
    return {
      data: PropTypes.object.isRequired,
      message: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
      actions: PropTypes.shape({
        resolveString: PropTypes.func.isRequired
      }),
    };
  }

  constructor(props) {
    super(props);
    this.onClickLimit = this.onClickLimit.bind(this);
  }

  // Event Handlers

  onClickLimit(event) {
    let actions = this.props.actions;
    let content = this.props.data;

    actions.resolveString(content, "text");
  }

  // Rendering

  render() {
    let message = this.props.message;
    let link = this.props.link;
    let reLink = /^(.*)\{\{link\}\}(.*$)/;
    let m = message.match(reLink);

    return (
        dom.div({className: "netInfoSizeLimit"},
          dom.span({}, m[1]),
          dom.a({
            className: "objectLink",
            onClick: this.onClickLimit},
              link
          ),
          dom.span({}, m[2])
        )
    );
  }
}

// Exports from this module
module.exports = SizeLimit;
