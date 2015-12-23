/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "PostMessageEvent.h"

#include "MessageEvent.h"
#include "mozilla/dom/BlobBinding.h"
#include "mozilla/dom/FileList.h"
#include "mozilla/dom/FileListBinding.h"
#include "mozilla/dom/MessagePort.h"
#include "mozilla/dom/MessagePortBinding.h"
#include "mozilla/dom/PMessagePort.h"
#include "mozilla/dom/StructuredCloneTags.h"
#include "mozilla/EventDispatcher.h"
#include "nsGlobalWindow.h"
#include "nsIPresShell.h"
#include "nsIPrincipal.h"
#include "nsPresContext.h"

namespace mozilla {
namespace dom {

PostMessageEvent::PostMessageEvent(nsGlobalWindow* aSource,
                                   const nsAString& aCallerOrigin,
                                   nsGlobalWindow* aTargetWindow,
                                   nsIPrincipal* aProvidedPrincipal,
                                   bool aTrustedCaller)
: StructuredCloneHelper(CloningSupported, TransferringSupported,
                        SameProcessSameThread),
  mSource(aSource),
  mCallerOrigin(aCallerOrigin),
  mTargetWindow(aTargetWindow),
  mProvidedPrincipal(aProvidedPrincipal),
  mTrustedCaller(aTrustedCaller)
{
  MOZ_COUNT_CTOR(PostMessageEvent);
}

PostMessageEvent::~PostMessageEvent()
{
  MOZ_COUNT_DTOR(PostMessageEvent);
}

NS_IMETHODIMP
PostMessageEvent::Run()
{
  MOZ_ASSERT(mTargetWindow->IsOuterWindow(),
             "should have been passed an outer window!");
  MOZ_ASSERT(!mSource || mSource->IsOuterWindow(),
             "should have been passed an outer window!");

  AutoJSAPI jsapi;
  jsapi.Init();
  JSContext* cx = jsapi.cx();

  // If we bailed before this point we're going to leak mMessage, but
  // that's probably better than crashing.

  nsRefPtr<nsGlobalWindow> targetWindow;
  if (mTargetWindow->IsClosedOrClosing() ||
      !(targetWindow = mTargetWindow->GetCurrentInnerWindowInternal()) ||
      targetWindow->IsClosedOrClosing())
    return NS_OK;

  MOZ_ASSERT(targetWindow->IsInnerWindow(),
             "we ordered an inner window!");
  JSAutoCompartment ac(cx, targetWindow->GetWrapperPreserveColor());

  // Ensure that any origin which might have been provided is the origin of this
  // window's document.  Note that we do this *now* instead of when postMessage
  // is called because the target window might have been navigated to a
  // different location between then and now.  If this check happened when
  // postMessage was called, it would be fairly easy for a malicious webpage to
  // intercept messages intended for another site by carefully timing navigation
  // of the target window so it changed location after postMessage but before
  // now.
  if (mProvidedPrincipal) {
    // Get the target's origin either from its principal or, in the case the
    // principal doesn't carry a URI (e.g. the system principal), the target's
    // document.
    nsIPrincipal* targetPrin = targetWindow->GetPrincipal();
    if (NS_WARN_IF(!targetPrin))
      return NS_OK;

    // Note: This is contrary to the spec with respect to file: URLs, which
    //       the spec groups into a single origin, but given we intentionally
    //       don't do that in other places it seems better to hold the line for
    //       now.  Long-term, we want HTML5 to address this so that we can
    //       be compliant while being safer.
    if (!targetPrin->Equals(mProvidedPrincipal)) {
      return NS_OK;
    }
  }

  ErrorResult rv;
  JS::Rooted<JS::Value> messageData(cx);
  nsCOMPtr<nsPIDOMWindow> window = targetWindow.get();

  Read(window, cx, &messageData, rv);
  if (NS_WARN_IF(rv.Failed())) {
    return rv.StealNSResult();
  }

  // Create the event
  nsCOMPtr<mozilla::dom::EventTarget> eventTarget =
    do_QueryInterface(static_cast<nsPIDOMWindow*>(targetWindow.get()));
  nsRefPtr<MessageEvent> event =
    new MessageEvent(eventTarget, nullptr, nullptr);

  event->InitMessageEvent(NS_LITERAL_STRING("message"), false /*non-bubbling */,
                          false /*cancelable */, messageData, mCallerOrigin,
                          EmptyString(), mSource);

  nsTArray<nsRefPtr<MessagePort>> ports = TakeTransferredPorts();

  event->SetPorts(new MessagePortList(static_cast<dom::Event*>(event.get()),
                                      ports));

  // We can't simply call dispatchEvent on the window because doing so ends
  // up flipping the trusted bit on the event, and we don't want that to
  // happen because then untrusted content can call postMessage on a chrome
  // window if it can get a reference to it.

  nsIPresShell *shell = targetWindow->GetExtantDoc()->GetShell();
  nsRefPtr<nsPresContext> presContext;
  if (shell)
    presContext = shell->GetPresContext();

  event->SetTrusted(mTrustedCaller);
  WidgetEvent* internalEvent = event->GetInternalNSEvent();

  nsEventStatus status = nsEventStatus_eIgnore;
  EventDispatcher::Dispatch(static_cast<nsPIDOMWindow*>(mTargetWindow),
                            presContext,
                            internalEvent,
                            static_cast<dom::Event*>(event.get()),
                            &status);
  return NS_OK;
}

} // namespace dom
} // namespace mozilla
