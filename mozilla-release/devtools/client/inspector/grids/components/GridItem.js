/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { PureComponent } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");
const { findDOMNode } = require("devtools/client/shared/vendor/react-dom");

// Reps
const { REPS, MODE } = require("devtools/client/shared/components/reps/reps");
const { Rep } = REPS;
const ElementNode = REPS.ElementNode;

const Types = require("../types");

class GridItem extends PureComponent {
  static get propTypes() {
    return {
      getSwatchColorPickerTooltip: PropTypes.func.isRequired,
      grid: PropTypes.shape(Types.grid).isRequired,
      setSelectedNode: PropTypes.func.isRequired,
      onHideBoxModelHighlighter: PropTypes.func.isRequired,
      onSetGridOverlayColor: PropTypes.func.isRequired,
      onShowBoxModelHighlighterForNode: PropTypes.func.isRequired,
      onToggleGridHighlighter: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.setGridColor = this.setGridColor.bind(this);
    this.translateNodeFrontToGrip = this.translateNodeFrontToGrip.bind(this);
    this.onGridCheckboxClick = this.onGridCheckboxClick.bind(this);
    this.onGridInspectIconClick = this.onGridInspectIconClick.bind(this);
  }

  componentDidMount() {
    let swatchEl = findDOMNode(this).querySelector(".grid-color-swatch");
    let tooltip = this.props.getSwatchColorPickerTooltip();

    let previousColor;
    tooltip.addSwatch(swatchEl, {
      onCommit: this.setGridColor,
      onPreview: this.setGridColor,
      onRevert: () => {
        this.props.onSetGridOverlayColor(this.props.grid.nodeFront, previousColor);
      },
      onShow: () => {
        previousColor = this.props.grid.color;
      },
    });
  }

  componentWillUnmount() {
    let swatchEl = findDOMNode(this).querySelector(".grid-color-swatch");
    let tooltip = this.props.getSwatchColorPickerTooltip();
    tooltip.removeSwatch(swatchEl);
  }

  setGridColor() {
    let color = findDOMNode(this).querySelector(".grid-color-value").textContent;
    this.props.onSetGridOverlayColor(this.props.grid.nodeFront, color);
  }

  /**
   * While waiting for a reps fix in https://github.com/devtools-html/reps/issues/92,
   * translate nodeFront to a grip-like object that can be used with an ElementNode rep.
   *
   * @params  {NodeFront} nodeFront
   *          The NodeFront for which we want to create a grip-like object.
   * @returns {Object} a grip-like object that can be used with Reps.
   */
  translateNodeFrontToGrip(nodeFront) {
    let { attributes } = nodeFront;

    // The main difference between NodeFront and grips is that attributes are treated as
    // a map in grips and as an array in NodeFronts.
    let attributesMap = {};
    for (let {name, value} of attributes) {
      attributesMap[name] = value;
    }

    return {
      actor: nodeFront.actorID,
      preview: {
        attributes: attributesMap,
        attributesLength: attributes.length,
        // All the grid containers are assumed to be in the DOM tree.
        isConnected: true,
        // nodeName is already lowerCased in Node grips
        nodeName: nodeFront.nodeName.toLowerCase(),
        nodeType: nodeFront.nodeType,
      }
    };
  }

  onGridCheckboxClick(e) {
    // If the click was on the svg icon to select the node in the inspector, bail out.
    let originalTarget = e.nativeEvent && e.nativeEvent.explicitOriginalTarget;
    if (originalTarget && originalTarget.namespaceURI === "http://www.w3.org/2000/svg") {
      // We should be able to cancel the click event propagation after the following reps
      // issue is implemented : https://github.com/devtools-html/reps/issues/95 .
      e.preventDefault();
      return;
    }

    let {
      grid,
      onToggleGridHighlighter,
    } = this.props;

    onToggleGridHighlighter(grid.nodeFront);
  }

  onGridInspectIconClick(nodeFront) {
    let { setSelectedNode } = this.props;
    setSelectedNode(nodeFront, "layout-panel").catch(e => console.error(e));
    nodeFront.scrollIntoView().catch(e => console.error(e));
  }

  render() {
    let {
      grid,
      onHideBoxModelHighlighter,
      onShowBoxModelHighlighterForNode,
    } = this.props;
    let { nodeFront } = grid;

    return dom.li(
      {},
      dom.label(
        {},
        dom.input(
          {
            checked: grid.highlighted,
            type: "checkbox",
            value: grid.id,
            onChange: this.onGridCheckboxClick,
          }
        ),
        Rep(
          {
            defaultRep: ElementNode,
            mode: MODE.TINY,
            object: this.translateNodeFrontToGrip(nodeFront),
            onDOMNodeMouseOut: () => onHideBoxModelHighlighter(),
            onDOMNodeMouseOver: () => onShowBoxModelHighlighterForNode(nodeFront),
            onInspectIconClick: () => this.onGridInspectIconClick(nodeFront),
          }
        )
      ),
      dom.div(
        {
          className: "grid-color-swatch",
          style: {
            backgroundColor: grid.color,
          },
          title: grid.color,
        }
      ),
      // The SwatchColorPicker relies on the nextSibling of the swatch element to apply
      // the selected color. This is why we use a span in display: none for now.
      // Ideally we should modify the SwatchColorPickerTooltip to bypass this requirement.
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=1341578
      dom.span(
        {
          className: "grid-color-value"
        },
        grid.color
      )
    );
  }
}

module.exports = GridItem;
