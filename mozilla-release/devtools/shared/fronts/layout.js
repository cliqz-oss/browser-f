/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { FrontClassWithSpec } = require("devtools/shared/protocol");
const { flexboxSpec, gridSpec, layoutSpec } = require("devtools/shared/specs/layout");

const FlexboxFront = FrontClassWithSpec(flexboxSpec, {
  form: function(form, detail) {
    if (detail === "actorid") {
      this.actorID = form;
      return;
    }
    this._form = form;
  },

  /**
   * In some cases, the FlexboxActor already knows the NodeActor ID of the node where the
   * flexbox is located. In such cases, this getter returns the NodeFront for it.
   */
  get containerNodeFront() {
    if (!this._form.containerNodeActorID) {
      return null;
    }

    return this.conn.getActor(this._form.containerNodeActorID);
  },
});

const GridFront = FrontClassWithSpec(gridSpec, {
  form: function(form, detail) {
    if (detail === "actorid") {
      this.actorID = form;
      return;
    }
    this._form = form;
  },

  /**
   * In some cases, the GridActor already knows the NodeActor ID of the node where the
   * grid is located. In such cases, this getter returns the NodeFront for it.
   */
  get containerNodeFront() {
    if (!this._form.containerNodeActorID) {
      return null;
    }

    return this.conn.getActor(this._form.containerNodeActorID);
  },

  /**
   * Get the text direction of the grid container.
   * Added in Firefox 60.
   */
  get direction() {
    if (!this._form.direction) {
      return "ltr";
    }

    return this._form.direction;
  },

  /**
   * Getter for the grid fragments data.
   */
  get gridFragments() {
    return this._form.gridFragments;
  },

  /**
   * Get the writing mode of the grid container.
   * Added in Firefox 60.
   */
  get writingMode() {
    if (!this._form.writingMode) {
      return "horizontal-tb";
    }

    return this._form.writingMode;
  },
});

const LayoutFront = FrontClassWithSpec(layoutSpec, {});

exports.FlexboxFront = FlexboxFront;
exports.GridFront = GridFront;
exports.LayoutFront = LayoutFront;
