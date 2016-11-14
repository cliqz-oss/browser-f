// Copyright Cliqz GmbH, 2016.

"use strict";

this.EXPORTED_SYMBOLS = [ "AutoForgetTabsMonitor" ];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/AutoForgetTabs-utils.jsm");

/**
 * This is a per-tab object living in a content process and monitoring
 * navigation events. It communicates with |AutoForgetTabsService| living in the
 * main process to query domain status or notify when a content switches its
 * privateness.
 */
class AutoForgetTabsMonitor {

  /**
   * @param docShell {nsIDocShell}
   * @param msgMgr {nsIMessageListenerManager}
   */
  constructor(docShell, msgMgr) {
    if (!(docShell instanceof Ci.nsIDocShell))
      throw new TypeError("nsIDocShell required");
    if (!(msgMgr instanceof Ci.nsIMessageListenerManager))
      throw new TypeError("nsIMessageListenerManager required");

    this._loadContext = docShell.QueryInterface(Ci.nsILoadContext);
    this._webNav = docShell.QueryInterface(Ci.nsIWebNavigation);
    this._webProgress = docShell.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebProgress);

    this._aftSvc = new RPCCaller(AFTSvcRPCMethods, msgMgr, RPC_PREFIX);

    this._rpcResponder =
        new RPCResponder(this, AFTMonRPCMethods, msgMgr, RPC_PREFIX);
    this._rpcResponder.connect();

    this._listening = false;
    if (this._aftSvc.isActive())
      this.switchMonitor(true);
  }

  shutdown() {
    this._rpcResponder.disconnect();
    this.switchMonitor(false);
  }

  // nsIWebProgressListener:
  onStateChange(aWebProgress, aRequest, aStateFlags, aStatus) {
    const startOrRedirect =
        (aStateFlags & Ci.nsIWebProgressListener.STATE_START) ||
        (aStateFlags & Ci.nsIWebProgressListener.STATE_REDIRECTING);
    const isDoc =
        (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_REDIR_DOC) ||
        (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT);
    if (startOrRedirect && isDoc) {
      this._filterDocRequest(aRequest, aWebProgress.isTopLevel);
    }
  }

  // RPC
  switchPrivateFlag(isPrivate) {
    this._loadContext.usePrivateBrowsing = isPrivate;
    this._webNav.reload(Ci.nsIWebNavigation.LOAD_FLAGS_NONE);
    // TODO: Try experimenting with different flags like:
    //        Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE |
    //        Ci.nsIWebNavigation.LOAD_FLAGS_STOP_CONTENT
  }

  // RPC
  switchMonitor(isEnabled) {
    if (this._listening == !!isEnabled)
      return;
    if (isEnabled) {
      this._webProgress.addProgressListener(this,
          Ci.nsIWebProgress.NOTIFY_STATE_ALL);
    }
    else {
      this._webProgress.removeProgressListener(this);
    }
    this._listening = !!isEnabled;
  }

  // Private:

  _filterDocRequest(request, isTopLevel) {
    const channel = request.QueryInterface(Ci.nsIChannel);
    const domain = maybeGetDomain(channel.URI || channel.originalURI);
    if (!domain)
      return;

    const loadContext = findChannelLoadContext(channel);
    if (!loadContext || loadContext.usePrivateBrowsing)
      return;

    if (!this._aftSvc.shouldForget(domain))
      return;

    loadContext.usePrivateBrowsing = true;
    // Load flags seem to be unaffected by privateness after request is already
    // created, so we have to make it anonymous here to prevent http headers
    // from being populated by cookies and potentially other deanonimyzers.
    request.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
    // Unfortunately, at this moment cookie header is already set. Clear it.
    // TODO: Put request into anonymous mode earlier, as there may be other
    // pieces of data leaking, because of that.
    const httpChannel = request.QueryInterface(Ci.nsIHttpChannel);
    if (httpChannel)
      httpChannel.setEmptyRequestHeader("Cookie");

    // We filter sub-document requests, but don't want to display any
    // notifications for those, because top-level page may be left in normal
    // mode.
    if (isTopLevel) {
      this._aftSvc.notifyAutoSwitched();
    }
  }
}

// nsISupports:
AutoForgetTabsMonitor.prototype.QueryInterface = XPCOMUtils.generateQI([
    Ci.nsISupports,
    Ci.nsISupportsWeakReference,
    Ci.nsIWebProgressListener,
]);

/**
 * @param channel {nsIChannel}
 * @return {nsILoadContext}
 */
function findChannelLoadContext(channel) {
  const notificationCallbacks = channel.notificationCallbacks ||
      (channel.loadGroup && channel.loadGroup.notificationCallbacks);
  if (!notificationCallbacks)
    return;

  try {
    return notificationCallbacks.getInterface(Ci.nsILoadContext);
  }
  catch (e) {
    // Most likely |e| is NS_NOINTERFACE, nothing can be done.
  }
}
