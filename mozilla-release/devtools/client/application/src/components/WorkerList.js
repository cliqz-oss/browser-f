/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const { createFactory, Component } = require("devtools/client/shared/vendor/react");
const { a, div, h1, ul, li } = require("devtools/client/shared/vendor/react-dom-factories");
const Worker = createFactory(require("./Worker"));

/**
 * This component handles the list of service workers displayed in the application panel
 * and also displays a suggestion to use about debugging for debugging other service
 * workers.
 */
class WorkerList extends Component {
  static get propTypes() {
    return {
      client: PropTypes.object.isRequired,
      workers: PropTypes.object.isRequired,
      serviceContainer: PropTypes.object.isRequired,
    };
  }

  render() {
    const { workers, client, serviceContainer } = this.props;
    const { openTrustedLink } = serviceContainer;

    return [
      ul({ className: "application-workers-container" },
        li({},
          h1({ className: "application-title" }, "Service Workers")
        ),
        workers.map(worker => Worker({
          client,
          debugDisabled: false,
          worker,
        }))
      ),
      div({ className: "application-aboutdebugging-plug" },
        "See about:debugging for Service Workers from other domains",
        a(
          { onClick: () => openTrustedLink("about:debugging#workers") },
          "Open about:debugging"
        )
      )
    ];
  }
}

// Exports

module.exports = WorkerList;
