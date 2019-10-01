// Copyright Cliqz GmbH, 2016.

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

this.EXPORTED_SYMBOLS = [
  "AFTSvcRPCMethods",
  "AFTMonRPCMethods",

  "RPCCaller",
  "RPCResponder",
  "maybeGetDomain"
];

// List of methods exposed to RPC by |AutoForgetTabsService|.
// Messages should be posted to frame message manager, as it allows for implicit
// source xul:browser argument.
const AFTSvcRPCMethods = {
  hasDatabase: [],
  isActive: [],
};

// List of methods exposed to RPC by |AutoForgetTabsMonitor|.
const AFTMonRPCMethods = {
  switchPrivateFlag: ["isPrivate"],
  switchMonitor: ["isEnabled"]
};

/**
 * A class simplifying RPC implementation. The caller side.
 * It generates methods, which upon call will send IPC messages and
 * transparently return dispatched result.
 * TODO: Allow async messages.
 */
class RPCCaller {
  /**
   * @param publishedMethods {Object} Map of method names and their arguments.
   *     Example: { myMethod: [arg1, arg2], ... }
   *     A function property "myMethod" will be added to this instance. It will
   *     accept arguments "arg1" and "arg2" in specified order and assign their
   *     values to message |data| object by their names.
   * @param messageSender {nsIMessageSender} channel to send messages through.
   *     Pass {nsISyncMessageSender} to send synchronous messages.
   *     Pass null to instantiate a multi-channel shim. It can be later used to
   *     communicate to different responders through a single shim instance.
   *     The only difference is in terms of usage is that you'll have to pass
   *     |messageSender| as first argument each time you call an RPC method.
   * @param messagePrefix {string} String prepended to message names.
   */
  constructor(publishedMethods, messageSender, messagePrefix) {
    this._publishedMethods = publishedMethods;
    this._messagePrefix = String(messagePrefix);
    this._messageSender = messageSender;
    for (let [methodName, argNames] of Object.entries(this._publishedMethods)) {
      this._genMethod(methodName, argNames);
    }
  }

  _genMethod(methodName, argNames) {
    const bound = [this, methodName, argNames];
    if (this._messageSender)
      bound.push(this._messageSender);
    this[methodName] = this._callStub.bind.apply(this._callStub, bound);
  }

  _callStub(methodName, argNames, sender) {
    const msgName = this._messagePrefix + methodName;

    // Map additional args as RPC call args.
    const rpcCalArgs = {};
    let argIdx = this._callStub.length;
    for (let argName of argNames) {
      rpcCalArgs[argName] = arguments[argIdx++];
    }

    if (typeof sender.sendSyncMessage === "function")
      return sender.sendSyncMessage(msgName, rpcCalArgs)[0];

    if (typeof sender.broadcastAsyncMessage === "function")
      return sender.broadcastAsyncMessage(msgName, rpcCalArgs);

    if (typeof sender.sendAsyncMessage === "function")
      return sender.sendAsyncMessage(msgName, rpcCalArgs);

    throw new TypeError("ChromeMessageSender or ChromeMessageBroadcaster required");
  }
}

/**
 * A class simplifying RPC implementation. The responder side.
 * It will automatically translate IPC messages to method calls on a desired
 * object.
 */
class RPCResponder {
  /**
   * @param delegate {Object} The object wishing to expose its methods.
   * @param publishedMethods {Object} Map of method names and their arguments.
   *     Example: { myMethod: [arg1, arg2], ... }
   *     There must be a function named "myMethod" in |delegate|.
   *     Arguments are extracted from message |data| object by their names.
   *     If message was sent through a frame message manager, arguments list
   *     will be prepended with xul:browser corresponding to that tab.
   * @param messageManager {nsIMessageListenerManager} channel to listen to.
   * @param messagePrefix {string} String prepended to message names.
   */
  constructor(delegate, publishedMethods, messageManager, messagePrefix) {
    this._delegate = delegate;
    this._publishedMethods = publishedMethods;
    this._messageManager = messageManager;
    this._messagePrefix = String(messagePrefix);
    this._methodCallPattern = new RegExp(messagePrefix + "(\\w+)");
  }

  // Start listening to IPC messages for published method calls.
  connect() {
    for (let methodName of Object.keys(this._publishedMethods)) {
      if (typeof this._delegate[methodName] !== "function") {
        dump("Can't register as RPC-callable: " + methodName + "\n");
        continue;
      }
      this._messageManager.addMessageListener(
          this._messagePrefix + methodName, this);
    }
  }

  // Start listening to IPC messages.
  disconnect() {
    for (let methodName of Object.keys(this._publishedMethods)) {
      this._messageManager.removeMessageListener(
          this._messagePrefix + methodName, this);
    }
  }

  // nsIMessageListener:
  receiveMessage({target, name, sync, data}) {
    const methodName = name.match(this._methodCallPattern)[1];
    if (!(methodName in this._publishedMethods)) {
      throw new Error("RPC method unavailable: " + methodName);
    }
    const argsMap = this._publishedMethods[methodName];
    // Turn passed named arguments into list of values.
    const args = argsMap.map(argName => data[argName]);
    // Prepend xul:browser corresponding to message source frame.
    if (target && target.nodeName === "browser")
      args.unshift(target);
    return this._delegate[methodName].apply(this._delegate, args);
  }
}
// nsISupports:
RPCResponder.prototype.QueryInterface = ChromeUtils.generateQI([
    Ci.nsISupports,
]);


/**
 * Exception-safely checks whether URI is white- or black-listable and returns
 * host part if true.
 * @param uri - uri to check. Type should be either nsIURI or a string.
 * @returns host part of the URI or undefined.
 */
function maybeGetDomain(uri) {
  var spec;
  try {
    if (uri instanceof Ci.nsIURI) {
      spec = uri.spec;
    }
    else {
      spec = uri;
      uri = Services.uriFixup.createFixupURI(spec,
          Services.uriFixup.FIXUP_FLAG_NONE);
    }

    if (!uri.schemeIs("http") && !uri.schemeIs("https"))
      return undefined;

    return uri.host.replace(/^www\./i, '');
  }
  catch (e) {
    Cu.reportError("Could not check spec: " + spec);
    Cu.reportError(e);
  }
}
