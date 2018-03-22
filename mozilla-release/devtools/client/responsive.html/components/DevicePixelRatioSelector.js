/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env browser */

"use strict";

const { PureComponent} = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");

const Types = require("../types");
const { getStr, getFormatStr } = require("../utils/l10n");
const labelForOption = value => getFormatStr("responsive.devicePixelRatioOption", value);

const PIXEL_RATIO_PRESET = [1, 2, 3];

const createVisibleOption = value => {
  let label = labelForOption(value);
  return dom.option({
    value,
    title: label,
    key: value,
  }, label);
};

const createHiddenOption = value => {
  let label = labelForOption(value);
  return dom.option({
    value,
    title: label,
    hidden: true,
    disabled: true,
  }, label);
};

class DevicePixelRatioSelector extends PureComponent {
  static get propTypes() {
    return {
      devices: PropTypes.shape(Types.devices).isRequired,
      displayPixelRatio: Types.pixelRatio.value.isRequired,
      selectedDevice: PropTypes.string.isRequired,
      selectedPixelRatio: PropTypes.shape(Types.pixelRatio).isRequired,
      onChangePixelRatio: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      isFocused: false
    };

    this.onFocusChange = this.onFocusChange.bind(this);
    this.onSelectChange = this.onSelectChange.bind(this);
  }

  onFocusChange({type}) {
    this.setState({
      isFocused: type === "focus"
    });
  }

  onSelectChange({ target }) {
    this.props.onChangePixelRatio(+target.value);
  }

  render() {
    let {
      devices,
      displayPixelRatio,
      selectedDevice,
      selectedPixelRatio,
    } = this.props;

    let hiddenOptions = [];

    for (let type of devices.types) {
      for (let device of devices[type]) {
        if (device.displayed &&
            !hiddenOptions.includes(device.pixelRatio) &&
            !PIXEL_RATIO_PRESET.includes(device.pixelRatio)) {
          hiddenOptions.push(device.pixelRatio);
        }
      }
    }

    if (!PIXEL_RATIO_PRESET.includes(displayPixelRatio)) {
      hiddenOptions.push(displayPixelRatio);
    }

    let state = devices.listState;
    let isDisabled = (state !== Types.deviceListState.LOADED) || (selectedDevice !== "");
    let selectorClass = "";
    let title;

    if (isDisabled) {
      selectorClass += " disabled";
      title = getFormatStr("responsive.devicePixelRatio.auto", selectedDevice);
    } else {
      title = getStr("responsive.changeDevicePixelRatio");

      if (selectedPixelRatio.value) {
        selectorClass += " selected";
      }
    }

    if (this.state.isFocused) {
      selectorClass += " focused";
    }

    let listContent = PIXEL_RATIO_PRESET.map(createVisibleOption);

    if (state == Types.deviceListState.LOADED) {
      listContent = listContent.concat(hiddenOptions.map(createHiddenOption));
    }

    return dom.select(
      {
        id: "global-device-pixel-ratio-selector",
        value: selectedPixelRatio.value || displayPixelRatio,
        disabled: isDisabled,
        onChange: this.onSelectChange,
        onFocus: this.onFocusChange,
        onBlur: this.onFocusChange,
        className: selectorClass,
        title: title
      },
      ...listContent
    );
  }
}

module.exports = DevicePixelRatioSelector;
