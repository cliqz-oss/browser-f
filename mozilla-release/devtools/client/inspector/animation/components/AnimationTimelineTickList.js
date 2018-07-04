/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Component, createFactory } = require("devtools/client/shared/vendor/react");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const { connect } = require("devtools/client/shared/vendor/react-redux");
const ReactDOM = require("devtools/client/shared/vendor/react-dom");

const AnimationTimelineTickItem = createFactory(require("./AnimationTimelineTickItem"));

const { findOptimalTimeInterval } = require("../utils/utils");

// The minimum spacing between 2 time graduation headers in the timeline (px).
const TIME_GRADUATION_MIN_SPACING = 40;

class AnimationTimelineTickList extends Component {
  static get propTypes() {
    return {
      sidebarWidth: PropTypes.number.isRequired,
      timeScale: PropTypes.object.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      tickList: [],
    };
  }

  componentDidMount() {
    this.updateTickList(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.updateTickList(nextProps);
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.tickList.length !== nextState.tickList.length) {
      return true;
    }

    for (let i = 0; i < this.state.tickList.length; i++) {
      const currentTickItem = this.state.tickList[i];
      const nextTickItem = nextState.tickList[i];

      if (currentTickItem.timeTickLabel !== nextTickItem.timeTickLabel) {
        return true;
      }
    }

    return false;
  }

  updateTickList(props) {
    const { timeScale } = props;
    const tickListEl = ReactDOM.findDOMNode(this);
    const width = tickListEl.offsetWidth;
    const animationDuration = timeScale.getDuration();
    const minTimeInterval = TIME_GRADUATION_MIN_SPACING * animationDuration / width;
    const intervalLength = findOptimalTimeInterval(minTimeInterval);
    const intervalWidth = intervalLength * width / animationDuration;
    const tickCount = width / intervalWidth;
    const intervalPositionPercentage = 100 * intervalWidth / width;

    const tickList = [];
    for (let i = 0; i <= tickCount; i++) {
      const position = i * intervalPositionPercentage;
      const timeTickLabel =
        timeScale.formatTime(timeScale.distanceToRelativeTime(position));
      tickList.push({ position, timeTickLabel });
    }

    this.setState({ tickList });
  }

  render() {
    const { tickList } = this.state;

    return dom.div(
      {
        className: "animation-timeline-tick-list"
      },
      tickList.map(tickItem => AnimationTimelineTickItem(tickItem))
    );
  }
}

const mapStateToProps = state => {
  return {
    sidebarWidth: state.animations.sidebarSize ? state.animations.sidebarSize.width : 0
  };
};

module.exports = connect(mapStateToProps)(AnimationTimelineTickList);
