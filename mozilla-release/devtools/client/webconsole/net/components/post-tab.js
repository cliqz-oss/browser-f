/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component, createFactory } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const PropTypes = require("devtools/client/shared/vendor/react-prop-types");

const TreeView =
  createFactory(require("devtools/client/shared/components/tree/TreeView"));

const { REPS, MODE, parseURLEncodedText } =
  require("devtools/client/shared/components/reps/reps");
const { Rep } = REPS;

// Network
const NetInfoParams = createFactory(require("./net-info-params"));
const NetInfoGroupList = createFactory(require("./net-info-group-list"));
const Spinner = createFactory(require("./spinner"));
const SizeLimit = createFactory(require("./size-limit"));
const NetUtils = require("../utils/net");
const Json = require("../utils/json");

/**
 * This template represents 'Post' tab displayed when the user
 * expands network log in the Console panel. It's responsible for
 * displaying posted data (HTTP post body).
 */
class PostTab extends Component {
  static get propTypes() {
    return {
      data: PropTypes.shape({
        request: PropTypes.object.isRequired
      }),
      actions: PropTypes.object.isRequired
    };
  }

  constructor(props) {
    super(props);
    this.isJson = this.isJson.bind(this);
    this.parseJson = this.parseJson.bind(this);
    this.renderJson = this.renderJson.bind(this);
    this.parseXml = this.parseXml.bind(this);
    this.isXml = this.isXml.bind(this);
    this.renderXml = this.renderXml.bind(this);
    this.renderMultiPart = this.renderMultiPart.bind(this);
    this.renderUrlEncoded = this.renderUrlEncoded.bind(this);
    this.renderRawData = this.renderRawData.bind(this);
  }

  componentDidMount() {
    let { actions, data: file } = this.props;

    if (!file.request.postData) {
      // TODO: use async action objects as soon as Redux is in place
      actions.requestData("requestPostData");
    }
  }

  isJson(file) {
    let text = file.request.postData.text;
    let value = NetUtils.getHeaderValue(file.request.headers, "content-type");
    return Json.isJSON(value, text);
  }

  parseJson(file) {
    let postData = file.request.postData;
    if (!postData) {
      return null;
    }

    let jsonString = new String(postData.text);
    return Json.parseJSONString(jsonString);
  }

  /**
   * Render JSON post data as an expandable tree.
   */
  renderJson(file) {
    let text = file.request.postData.text;
    if (!text || isLongString(text)) {
      return null;
    }

    if (!this.isJson(file)) {
      return null;
    }

    let json = this.parseJson(file);
    if (!json) {
      return null;
    }

    return {
      key: "json",
      content: TreeView({
        columns: [{id: "value"}],
        object: json,
        mode: MODE.TINY,
        renderValue: props => Rep(Object.assign({}, props, {
          cropLimit: 50,
        })),
      }),
      name: Locale.$STR("jsonScopeName")
    };
  }

  parseXml(file) {
    let text = file.request.postData.text;
    if (isLongString(text)) {
      return null;
    }

    return NetUtils.parseXml({
      mimeType: NetUtils.getHeaderValue(file.request.headers, "content-type"),
      text: text,
    });
  }

  isXml(file) {
    if (isLongString(file.request.postData.text)) {
      return false;
    }

    let value = NetUtils.getHeaderValue(file.request.headers, "content-type");
    if (!value) {
      return false;
    }

    return NetUtils.isHTML(value);
  }

  renderXml(file) {
    let text = file.request.postData.text;
    if (!text || isLongString(text)) {
      return null;
    }

    if (!this.isXml(file)) {
      return null;
    }

    let doc = this.parseXml(file);
    if (!doc) {
      return null;
    }

    // Proper component for rendering XML should be used (see bug 1247392)
    return null;
  }

  /**
   * Multipart post data are parsed and nicely rendered
   * as an expandable tree of individual parts.
   */
  renderMultiPart(file) {
    let text = file.request.postData.text;
    if (!text || isLongString(text)) {
      return;
    }

    if (NetUtils.isMultiPartRequest(file)) {
      // TODO: render multi part request (bug: 1247423)
    }
  }

  /**
   * URL encoded post data are nicely rendered as a list
   * of parameters.
   */
  renderUrlEncoded(file) {
    let text = file.request.postData.text;
    if (!text || isLongString(text)) {
      return null;
    }

    if (!NetUtils.isURLEncodedRequest(file)) {
      return null;
    }

    let lines = text.split("\n");
    let params = parseURLEncodedText(lines[lines.length - 1]);

    return {
      key: "url-encoded",
      content: NetInfoParams({params: params}),
      name: Locale.$STR("netRequest.params")
    };
  }

  renderRawData(file) {
    let text = file.request.postData.text;

    let group;

    // The post body might reached the limit, so check if we are
    // dealing with a long string.
    if (typeof text == "object") {
      group = {
        key: "raw-longstring",
        name: Locale.$STR("netRequest.rawData"),
        content: dom.div({className: "netInfoResponseContent"},
          sanitize(text.initial),
          SizeLimit({
            actions: this.props.actions,
            data: file.request.postData,
            message: Locale.$STR("netRequest.sizeLimitMessage"),
            link: Locale.$STR("netRequest.sizeLimitMessageLink")
          })
        )
      };
    } else {
      group = {
        key: "raw",
        name: Locale.$STR("netRequest.rawData"),
        content: dom.div({className: "netInfoResponseContent"},
          sanitize(text)
        )
      };
    }

    return group;
  }

  render() {
    let { data: file } = this.props;

    if (file.discardRequestBody) {
      return dom.span({className: "netInfoBodiesDiscarded"},
        Locale.$STR("netRequest.requestBodyDiscarded")
      );
    }

    if (!file.request.postData) {
      return (
        Spinner()
      );
    }

    // Render post body data. The right representation of the data
    // is picked according to the content type.
    let groups = [];
    groups.push(this.renderUrlEncoded(file));
    // TODO: render multi part request (bug: 1247423)
    // groups.push(this.renderMultiPart(file));
    groups.push(this.renderJson(file));
    groups.push(this.renderXml(file));
    groups.push(this.renderRawData(file));

    // Filter out empty groups.
    groups = groups.filter(group => group);

    // The raw response is collapsed by default if a nice formatted
    // version is available.
    if (groups.length > 1) {
      groups[groups.length - 1].open = false;
    }

    return (
      dom.div({className: "postTabBox"},
        dom.div({className: "panelContent"},
          NetInfoGroupList({
            groups: groups
          })
        )
      )
    );
  }
}

// Helpers

/**
 * Workaround for a "not well-formed" error that react
 * reports when there's multipart data passed to render.
 */
function sanitize(text) {
  text = JSON.stringify(text);
  text = text.replace(/\\r\\n/g, "\r\n").replace(/\\"/g, "\"");
  return text.slice(1, text.length - 1);
}

function isLongString(text) {
  return typeof text == "object";
}

// Exports from this module
module.exports = PostTab;
