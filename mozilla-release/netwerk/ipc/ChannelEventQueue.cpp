/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: set sw=2 ts=8 et tw=80 :
 */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsISupports.h"
#include "mozilla/net/ChannelEventQueue.h"
#include "nsThreadUtils.h"

namespace mozilla {
namespace net {

void
ChannelEventQueue::FlushQueue()
{
  // Events flushed could include destruction of channel (and our own
  // destructor) unless we make sure its refcount doesn't drop to 0 while this
  // method is running.
  nsCOMPtr<nsISupports> kungFuDeathGrip(mOwner);

  // Prevent flushed events from flushing the queue recursively
  mFlushing = true;

  uint32_t i;
  for (i = 0; i < mEventQueue.Length(); i++) {
    mEventQueue[i]->Run();
    if (mSuspended)
      break;
  }

  // We will always want to remove at least one finished callback.
  if (i < mEventQueue.Length())
    i++;

  // It is possible for new callbacks to be enqueued as we are
  // flushing the queue, so the queue must not be cleared until
  // all callbacks have run.
  mEventQueue.RemoveElementsAt(0, i);

  mFlushing = false;
}

void
ChannelEventQueue::Resume()
{
  // Resuming w/o suspend: error in debug mode, ignore in build
  MOZ_ASSERT(mSuspendCount > 0);
  if (mSuspendCount <= 0) {
    return;
  }

  if (!--mSuspendCount) {
    nsRefPtr<nsRunnableMethod<ChannelEventQueue> > event =
      NS_NewRunnableMethod(this, &ChannelEventQueue::CompleteResume);
    if (mTargetThread) {
      mTargetThread->Dispatch(event, NS_DISPATCH_NORMAL);
    } else {
      MOZ_RELEASE_ASSERT(NS_IsMainThread());
      NS_DispatchToCurrentThread(event);
    }
  }
}

nsresult
ChannelEventQueue::RetargetDeliveryTo(nsIEventTarget* aTargetThread)
{
  MOZ_RELEASE_ASSERT(NS_IsMainThread());
  MOZ_RELEASE_ASSERT(!mTargetThread);
  MOZ_RELEASE_ASSERT(aTargetThread);

  mTargetThread = do_QueryInterface(aTargetThread);
  MOZ_RELEASE_ASSERT(mTargetThread);

  return NS_OK;
}

} // namespace net
} // namespace mozilla
