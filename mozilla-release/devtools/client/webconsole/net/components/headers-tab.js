/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component, createFactory } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const NetInfoGroupList = createFactory(require("./net-info-group-list"));
const Spinner = createFactory(require("./spinner"));

/**
 * This template represents 'Headers' tab displayed when the user
 * expands network log in the Console panel. It's responsible for rendering
 * request and response HTTP headers.
 */
class HeadersTab extends Component {
  static get propTypes() {
    return {
      actions: PropTypes.shape({
        requestData: PropTypes.func.isRequired
      }),
      data: PropTypes.object.isRequired,
    };
  }

  componentDidMount() {
    let { actions, data } = this.props;
    let requestHeaders = data.request.headers;
    let responseHeaders = data.response.headers;

    // Request headers if they are not available yet.
    // TODO: use async action objects as soon as Redux is in place
    if (!requestHeaders) {
      actions.requestData("requestHeaders");
    }

    if (!responseHeaders) {
      actions.requestData("responseHeaders");
    }
  }

  render() {
    let { data } = this.props;
    let requestHeaders = data.request.headers;
    let responseHeaders = data.response.headers;

    // TODO: Another groups to implement:
    // 1) Cached Headers
    // 2) Headers from upload stream
    let groups = [{
      key: "responseHeaders",
      name: Locale.$STR("responseHeaders"),
      params: responseHeaders
    }, {
      key: "requestHeaders",
      name: Locale.$STR("requestHeaders"),
      params: requestHeaders
    }];

    // If response headers are not available yet, display a spinner
    if (!responseHeaders || !responseHeaders.length) {
      groups[0].content = Spinner();
    }

    return (
      dom.div({className: "headersTabBox"},
        dom.div({className: "panelContent"},
          NetInfoGroupList({groups: groups})
        )
      )
    );
  }
}

// Exports from this module
module.exports = HeadersTab;
