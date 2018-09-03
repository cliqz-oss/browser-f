/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { method } = require("devtools/shared/protocol");

/**
 * Creates "registered" actors factory meant for creating another kind of
 * factories, ObservedActorFactory, during the call to listTabs.
 * These factories live in DebuggerServer.{tab|global}ActorFactories.
 *
 * These actors only exposes:
 * - `name` string attribute used to match actors by constructor name
 *   in DebuggerServer.remove{Global,Tab}Actor.
 * - `createObservedActorFactory` function to create "observed" actors factory
 *
 * @param options object
 *        - constructorName: (required)
 *          name of actor constructor, which is also used when removing the actor.
 *        One of the following:
 *          - id:
 *            module ID that contains the actor
 *          - constructorFun:
 *            a function to construct the actor
 */
function RegisteredActorFactory(options, prefix) {
  // By default the actor name will also be used for the actorID prefix.
  this._prefix = prefix;
  if (options.constructorFun) {
    // Actor definition registered by ActorRegistryActor or testing helpers
    this._getConstructor = () => options.constructorFun;
  } else {
    // Lazy actor definition, where options contains all the information
    // required to load the actor lazily.
    this._getConstructor = function() {
      // Load the module
      let mod;
      try {
        mod = require(options.id);
      } catch (e) {
        throw new Error("Unable to load actor module '" + options.id + "'.\n" +
                        e.message + "\n" + e.stack + "\n");
      }
      // Fetch the actor constructor
      const c = mod[options.constructorName];
      if (!c) {
        throw new Error("Unable to find actor constructor named '" +
                        options.constructorName + "'. (Is it exported?)");
      }
      return c;
    };
  }
  // Exposes `name` attribute in order to allow removeXXXActor to match
  // the actor by its actor constructor name.
  this.name = options.constructorName;
}
RegisteredActorFactory.prototype.createObservedActorFactory = function(conn,
  parentActor) {
  return new ObservedActorFactory(this._getConstructor, this._prefix, conn, parentActor);
};
exports.RegisteredActorFactory = RegisteredActorFactory;

/**
 * Creates "observed" actors factory meant for creating real actor instances.
 * These factories lives in actor pools and fake various actor attributes.
 * They will be replaced in actor pools by final actor instances during
 * the first request for the same actorID from DebuggerServer._getOrCreateActor.
 *
 * ObservedActorFactory fakes the following actors attributes:
 *   actorPrefix (string) Used by ActorPool.addActor to compute the actor id
 *   actorID (string) Set by ActorPool.addActor just after being instantiated
 *   registeredPool (object) Set by ActorPool.addActor just after being
 *                           instantiated
 * And exposes the following method:
 *   createActor (function) Instantiate an actor that is going to replace
 *                          this factory in the actor pool.
 */
function ObservedActorFactory(getConstructor, prefix, conn, parentActor) {
  this._getConstructor = getConstructor;
  this._conn = conn;
  this._parentActor = parentActor;

  this.actorPrefix = prefix;

  this.actorID = null;
  this.registeredPool = null;
}
ObservedActorFactory.prototype.createActor = function() {
  // Fetch the actor constructor
  const C = this._getConstructor();
  // Instantiate a new actor instance
  const instance = new C(this._conn, this._parentActor);
  instance.conn = this._conn;
  instance.parentID = this._parentActor.actorID;
  // We want the newly-constructed actor to completely replace the factory
  // actor. Reusing the existing actor ID will make sure ActorPool.addActor
  // does the right thing.
  instance.actorID = this.actorID;
  this.registeredPool.addActor(instance);
  return instance;
};
exports.ObservedActorFactory = ObservedActorFactory;

/*
 * Methods shared between RootActor and BrowsingContextTargetActor.
 */

/**
 * Populate |this._extraActors| as specified by |factories|, reusing whatever
 * actors are already there. Add all actors in the final extra actors table to
 * |pool|.
 *
 * The root actor and the target actor use this to instantiate actors that other
 * parts of the browser have specified with DebuggerServer.addTabActor and
 * DebuggerServer.addGlobalActor.
 *
 * @param factories
 *     An object whose own property names are the names of properties to add to
 *     some reply packet (say, a target actor grip or the "listTabs" response
 *     form), and whose own property values are actor constructor functions, as
 *     documented for addTabActor and addGlobalActor.
 *
 * @param this
 *     The RootActor or BrowsingContextTargetActor with which the new actors
 *     will be associated. It should support whatever API the |factories|
 *     constructor functions might be interested in, as it is passed to them.
 *     For the sake of CommonCreateExtraActors itself, it should have at least
 *     the following properties:
 *
 *     - _extraActors
 *        An object whose own property names are factory table (and packet)
 *        property names, and whose values are no-argument actor constructors,
 *        of the sort that one can add to an ActorPool.
 *
 *     - conn
 *        The DebuggerServerConnection in which the new actors will participate.
 *
 *     - actorID
 *        The actor's name, for use as the new actors' parentID.
 */
exports.createExtraActors = function createExtraActors(factories, pool) {
  // Walk over global actors added by extensions.
  for (const name in factories) {
    let actor = this._extraActors[name];
    if (!actor) {
      // Register another factory, but this time specific to this connection.
      // It creates a fake actor that looks like an regular actor in the pool,
      // but without actually instantiating the actor.
      // It will only be instantiated on the first request made to the actor.
      actor = factories[name].createObservedActorFactory(this.conn, this);
      this._extraActors[name] = actor;
    }

    // If the actor already exists in the pool, it may have been instantiated,
    // so make sure not to overwrite it by a non-instantiated version.
    if (!pool.has(actor.actorID)) {
      pool.addActor(actor);
    }
  }
};

/**
 * Append the extra actors in |this._extraActors|, constructed by a prior call
 * to CommonCreateExtraActors, to |object|.
 *
 * @param object
 *     The object to which the extra actors should be added, under the
 *     property names given in the |factories| table passed to
 *     CommonCreateExtraActors.
 *
 * @param this
 *     The RootActor or BrowsingContextTargetActor whose |_extraActors| table we
 *     should use; see above.
 */
exports.appendExtraActors = function appendExtraActors(object) {
  for (const name in this._extraActors) {
    const actor = this._extraActors[name];
    object[name] = actor.actorID;
  }
};

/**
 * Construct an ActorPool.
 *
 * ActorPools are actorID -> actor mapping and storage.  These are
 * used to accumulate and quickly dispose of groups of actors that
 * share a lifetime.
 */
function ActorPool(connection) {
  this.conn = connection;
  this._actors = {};
}

ActorPool.prototype = {
  /**
   * Destroy the pool. This will remove all actors from the pool.
   */
  destroy: function APDestroy() {
    for (const id in this._actors) {
      this.removeActor(this._actors[id]);
    }
  },

  /**
   * Add an actor to the pool. If the actor doesn't have an ID, allocate one
   * from the connection.
   *
   * @param Object actor
   *        The actor to be added to the pool.
   */
  addActor: function APAddActor(actor) {
    actor.conn = this.conn;
    if (!actor.actorID) {
      // Older style actors use actorPrefix, while protocol.js-based actors use typeName
      let prefix = actor.actorPrefix || actor.typeName;
      if (!prefix && typeof actor == "function") {
        prefix = actor.prototype.actorPrefix || actor.prototype.typeName;
      }
      actor.actorID = this.conn.allocID(prefix || undefined);
    }

    // If the actor is already in a pool, remove it without destroying it.
    if (actor.registeredPool) {
      delete actor.registeredPool._actors[actor.actorID];
    }
    actor.registeredPool = this;

    this._actors[actor.actorID] = actor;
  },

  /**
   * Remove an actor from the pool. If the actor has a destroy method, call it.
   */
  removeActor(actor) {
    delete this._actors[actor.actorID];
    if (actor.destroy) {
      actor.destroy();
      return;
    }
    // Obsolete destruction method name (might still be used by custom actors)
    if (actor.disconnect) {
      actor.disconnect();
    }
  },

  get: function APGet(actorID) {
    return this._actors[actorID] || undefined;
  },

  has: function APHas(actorID) {
    return actorID in this._actors;
  },

  /**
   * Returns true if the pool is empty.
   */
  isEmpty: function APIsEmpty() {
    return Object.keys(this._actors).length == 0;
  },

  /**
   * Match the api expected by the protocol library.
   */
  unmanage: function(actor) {
    return this.removeActor(actor);
  },

  forEach: function(callback) {
    for (const name in this._actors) {
      callback(this._actors[name]);
    }
  },
};

exports.ActorPool = ActorPool;

/**
 * An OriginalLocation represents a location in an original source.
 *
 * @param SourceActor actor
 *        A SourceActor representing an original source.
 * @param Number line
 *        A line within the given source.
 * @param Number column
 *        A column within the given line.
 * @param String name
 *        The name of the symbol corresponding to this OriginalLocation.
 */
function OriginalLocation(actor, line, column, name) {
  this._connection = actor ? actor.conn : null;
  this._actorID = actor ? actor.actorID : undefined;
  this._line = line;
  this._column = column;
  this._name = name;
}

OriginalLocation.fromGeneratedLocation = function(generatedLocation) {
  return new OriginalLocation(
    generatedLocation.generatedSourceActor,
    generatedLocation.generatedLine,
    generatedLocation.generatedColumn
  );
};

OriginalLocation.prototype = {
  get originalSourceActor() {
    return this._connection ? this._connection.getActor(this._actorID) : null;
  },

  get originalUrl() {
    const actor = this.originalSourceActor;
    const source = actor.source;
    return source ? source.url : actor._originalUrl;
  },

  get originalLine() {
    return this._line;
  },

  get originalColumn() {
    return this._column;
  },

  get originalName() {
    return this._name;
  },

  get generatedSourceActor() {
    throw new Error("Shouldn't  access generatedSourceActor from an OriginalLocation");
  },

  get generatedLine() {
    throw new Error("Shouldn't access generatedLine from an OriginalLocation");
  },

  get generatedColumn() {
    throw new Error("Shouldn't access generatedColumn from an Originallocation");
  },

  equals: function(other) {
    return this.originalSourceActor.url == other.originalSourceActor.url &&
           this.originalLine === other.originalLine &&
           (this.originalColumn === undefined ||
            other.originalColumn === undefined ||
            this.originalColumn === other.originalColumn);
  },

  toJSON: function() {
    return {
      source: this.originalSourceActor.form(),
      line: this.originalLine,
      column: this.originalColumn
    };
  }
};

exports.OriginalLocation = OriginalLocation;

/**
 * A GeneratedLocation represents a location in a generated source.
 *
 * @param SourceActor actor
 *        A SourceActor representing a generated source.
 * @param Number line
 *        A line within the given source.
 * @param Number column
 *        A column within the given line.
 */
function GeneratedLocation(actor, line, column, lastColumn) {
  this._connection = actor ? actor.conn : null;
  this._actorID = actor ? actor.actorID : undefined;
  this._line = line;
  this._column = column;
  this._lastColumn = (lastColumn !== undefined) ? lastColumn : column + 1;
}

GeneratedLocation.fromOriginalLocation = function(originalLocation) {
  return new GeneratedLocation(
    originalLocation.originalSourceActor,
    originalLocation.originalLine,
    originalLocation.originalColumn
  );
};

GeneratedLocation.prototype = {
  get originalSourceActor() {
    throw new Error();
  },

  get originalUrl() {
    throw new Error("Shouldn't access originalUrl from a GeneratedLocation");
  },

  get originalLine() {
    throw new Error("Shouldn't access originalLine from a GeneratedLocation");
  },

  get originalColumn() {
    throw new Error("Shouldn't access originalColumn from a GeneratedLocation");
  },

  get originalName() {
    throw new Error("Shouldn't access originalName from a GeneratedLocation");
  },

  get generatedSourceActor() {
    return this._connection ? this._connection.getActor(this._actorID) : null;
  },

  get generatedLine() {
    return this._line;
  },

  get generatedColumn() {
    return this._column;
  },

  get generatedLastColumn() {
    return this._lastColumn;
  },

  equals: function(other) {
    return this.generatedSourceActor.url == other.generatedSourceActor.url &&
           this.generatedLine === other.generatedLine &&
           (this.generatedColumn === undefined ||
            other.generatedColumn === undefined ||
            this.generatedColumn === other.generatedColumn);
  },

  toJSON: function() {
    return {
      source: this.generatedSourceActor.form(),
      line: this.generatedLine,
      column: this.generatedColumn,
      lastColumn: this.generatedLastColumn
    };
  }
};

exports.GeneratedLocation = GeneratedLocation;

/**
 * A method decorator that ensures the actor is in the expected state before
 * proceeding. If the actor is not in the expected state, the decorated method
 * returns a rejected promise.
 *
 * The actor's state must be at this.state property.
 *
 * @param String expectedState
 *        The expected state.
 * @param String activity
 *        Additional info about what's going on.
 * @param Function methodFunc
 *        The actor method to proceed with when the actor is in the expected
 *        state.
 *
 * @returns Function
 *          The decorated method.
 */
function expectState(expectedState, methodFunc, activity) {
  return function(...args) {
    if (this.state !== expectedState) {
      const msg = `Wrong state while ${activity}:` +
                  `Expected '${expectedState}', ` +
                  `but current state is '${this.state}'.`;
      return Promise.reject(new Error(msg));
    }

    return methodFunc.apply(this, args);
  };
}

exports.expectState = expectState;

/**
 * Proxies a call from an actor to an underlying module, stored
 * as `bridge` on the actor. This allows a module to be defined in one
 * place, usable by other modules/actors on the server, but a separate
 * module defining the actor/RDP definition.
 *
 * @see Framerate implementation: devtools/server/performance/framerate.js
 * @see Framerate actor definition: devtools/server/actors/framerate.js
 */
function actorBridge(methodName, definition = {}) {
  return method(function() {
    return this.bridge[methodName].apply(this.bridge, arguments);
  }, definition);
}
exports.actorBridge = actorBridge;

/**
 * Like `actorBridge`, but without a spec definition, for when the actor is
 * created with `ActorClassWithSpec` rather than vanilla `ActorClass`.
 */
function actorBridgeWithSpec(methodName) {
  return method(function() {
    return this.bridge[methodName].apply(this.bridge, arguments);
  });
}
exports.actorBridgeWithSpec = actorBridgeWithSpec;
