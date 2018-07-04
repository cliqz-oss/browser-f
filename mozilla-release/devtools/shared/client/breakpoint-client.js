/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const promise = require("devtools/shared/deprecated-sync-thenables");

const eventSource = require("devtools/shared/client/event-source");
const {DebuggerClient} = require("devtools/shared/client/debugger-client");

/**
 * Breakpoint clients are used to remove breakpoints that are no longer used.
 *
 * @param client DebuggerClient
 *        The debugger client parent.
 * @param sourceClient SourceClient
 *        The source where this breakpoint exists
 * @param actor string
 *        The actor ID for this breakpoint.
 * @param location object
 *        The location of the breakpoint. This is an object with two properties:
 *        url and line.
 * @param condition string
 *        The conditional expression of the breakpoint
 */
function BreakpointClient(client, sourceClient, actor, location, condition) {
  this._client = client;
  this._actor = actor;
  this.location = location;
  this.location.actor = sourceClient.actor;
  this.location.url = sourceClient.url;
  this.source = sourceClient;
  this.request = this._client.request;

  // The condition property should only exist if it's a truthy value
  if (condition) {
    this.condition = condition;
  }
}

BreakpointClient.prototype = {

  _actor: null,
  get actor() {
    return this._actor;
  },
  get _transport() {
    return this._client._transport;
  },

  /**
   * Remove the breakpoint from the server.
   */
  remove: DebuggerClient.requester({
    type: "delete"
  }),

  /**
   * Determines if this breakpoint has a condition
   */
  hasCondition: function() {
    let root = this._client.mainRoot;
    // XXX bug 990137: We will remove support for client-side handling of
    // conditional breakpoints
    if (root.traits.conditionalBreakpoints) {
      return "condition" in this;
    }
    return "conditionalExpression" in this;
  },

  /**
   * Get the condition of this breakpoint. Currently we have to
   * support locally emulated conditional breakpoints until the
   * debugger servers are updated (see bug 990137). We used a
   * different property when moving it server-side to ensure that we
   * are testing the right code.
   */
  getCondition: function() {
    let root = this._client.mainRoot;
    if (root.traits.conditionalBreakpoints) {
      return this.condition;
    }
    return this.conditionalExpression;
  },

  /**
   * Set the condition of this breakpoint
   */
  setCondition: function(gThreadClient, condition) {
    let root = this._client.mainRoot;
    let deferred = promise.defer();

    if (root.traits.conditionalBreakpoints) {
      let info = {
        line: this.location.line,
        column: this.location.column,
        condition: condition
      };

      // Remove the current breakpoint and add a new one with the
      // condition.
      this.remove(response => {
        if (response && response.error) {
          deferred.reject(response);
          return;
        }

        this.source.setBreakpoint(info, (resp, newBreakpoint) => {
          if (resp && resp.error) {
            deferred.reject(resp);
          } else {
            deferred.resolve(newBreakpoint);
          }
        });
      });
    } else {
      // The property shouldn't even exist if the condition is blank
      if (condition === "") {
        delete this.conditionalExpression;
      } else {
        this.conditionalExpression = condition;
      }
      deferred.resolve(this);
    }

    return deferred.promise;
  }
};

eventSource(BreakpointClient.prototype);

module.exports = BreakpointClient;
