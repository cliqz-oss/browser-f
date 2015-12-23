/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIClassInfoImpl.h"
#include "nsThreadPool.h"
#include "nsThreadManager.h"
#include "nsThread.h"
#include "nsMemory.h"
#include "nsAutoPtr.h"
#include "prinrval.h"
#include "mozilla/Logging.h"

using namespace mozilla;

static PRLogModuleInfo*
GetThreadPoolLog()
{
  static PRLogModuleInfo* sLog;
  if (!sLog) {
    sLog = PR_NewLogModule("nsThreadPool");
  }
  return sLog;
}
#ifdef LOG
#undef LOG
#endif
#define LOG(args) MOZ_LOG(GetThreadPoolLog(), mozilla::LogLevel::Debug, args)

// DESIGN:
//  o  Allocate anonymous threads.
//  o  Use nsThreadPool::Run as the main routine for each thread.
//  o  Each thread waits on the event queue's monitor, checking for
//     pending events and rescheduling itself as an idle thread.

#define DEFAULT_THREAD_LIMIT 4
#define DEFAULT_IDLE_THREAD_LIMIT 1
#define DEFAULT_IDLE_THREAD_TIMEOUT PR_SecondsToInterval(60)

NS_IMPL_ADDREF(nsThreadPool)
NS_IMPL_RELEASE(nsThreadPool)
NS_IMPL_CLASSINFO(nsThreadPool, nullptr, nsIClassInfo::THREADSAFE,
                  NS_THREADPOOL_CID)
NS_IMPL_QUERY_INTERFACE_CI(nsThreadPool, nsIThreadPool, nsIEventTarget,
                           nsIRunnable)
NS_IMPL_CI_INTERFACE_GETTER(nsThreadPool, nsIThreadPool, nsIEventTarget)

nsThreadPool::nsThreadPool()
  : mMonitor("[nsThreadPool.mMonitor]")
  , mThreadLimit(DEFAULT_THREAD_LIMIT)
  , mIdleThreadLimit(DEFAULT_IDLE_THREAD_LIMIT)
  , mIdleThreadTimeout(DEFAULT_IDLE_THREAD_TIMEOUT)
  , mIdleCount(0)
  , mStackSize(nsIThreadManager::DEFAULT_STACK_SIZE)
  , mShutdown(false)
{
  LOG(("THRD-P(%p) constructor!!!\n", this));
}

nsThreadPool::~nsThreadPool()
{
  // Threads keep a reference to the nsThreadPool until they return from Run()
  // after removing themselves from mThreads.
  MOZ_ASSERT(mThreads.IsEmpty());
}

nsresult
nsThreadPool::PutEvent(nsIRunnable* aEvent)
{
  nsCOMPtr<nsIRunnable> event(aEvent);
  return PutEvent(event.forget());
}

nsresult
nsThreadPool::PutEvent(already_AddRefed<nsIRunnable>&& aEvent)
{
  // Avoid spawning a new thread while holding the event queue lock...

  bool spawnThread = false;
  uint32_t stackSize = 0;
  {
    MonitorAutoLock mon(mMonitor);

    if (NS_WARN_IF(mShutdown)) {
      return NS_ERROR_NOT_AVAILABLE;
    }
    LOG(("THRD-P(%p) put [%d %d %d]\n", this, mIdleCount, mThreads.Count(),
         mThreadLimit));
    MOZ_ASSERT(mIdleCount <= (uint32_t)mThreads.Count(), "oops");

    // Make sure we have a thread to service this event.
    if (mThreads.Count() < (int32_t)mThreadLimit &&
        // Spawn a new thread if we don't have enough idle threads to serve
        // pending events immediately.
        mEvents.Count(mon) >= mIdleCount) {
      spawnThread = true;
    }

    mEvents.PutEvent(Move(aEvent), mon);
    stackSize = mStackSize;
  }

  LOG(("THRD-P(%p) put [spawn=%d]\n", this, spawnThread));
  if (!spawnThread) {
    return NS_OK;
  }

  nsCOMPtr<nsIThread> thread;
  nsThreadManager::get()->NewThread(0,
                                    stackSize,
                                    getter_AddRefs(thread));
  if (NS_WARN_IF(!thread)) {
    return NS_ERROR_UNEXPECTED;
  }

  bool killThread = false;
  {
    MonitorAutoLock mon(mMonitor);
    if (mThreads.Count() < (int32_t)mThreadLimit) {
      mThreads.AppendObject(thread);
    } else {
      killThread = true;  // okay, we don't need this thread anymore
    }
  }
  LOG(("THRD-P(%p) put [%p kill=%d]\n", this, thread.get(), killThread));
  if (killThread) {
    // We never dispatched any events to the thread, so we can shut it down
    // asynchronously without worrying about anything.
    MOZ_ALWAYS_TRUE(NS_SUCCEEDED(thread->AsyncShutdown()));
  } else {
    thread->Dispatch(this, NS_DISPATCH_NORMAL);
  }

  return NS_OK;
}

void
nsThreadPool::ShutdownThread(nsIThread* aThread)
{
  LOG(("THRD-P(%p) shutdown async [%p]\n", this, aThread));

  // This method is responsible for calling Shutdown on |aThread|.  This must be
  // done from some other thread, so we use the main thread of the application.

  MOZ_ASSERT(!NS_IsMainThread(), "wrong thread");

  nsCOMPtr<nsIRunnable> r = NS_NewRunnableMethod(aThread, &nsIThread::Shutdown);
  NS_DispatchToMainThread(r);
}

NS_IMETHODIMP
nsThreadPool::Run()
{
  mThreadNaming.SetThreadPoolName(mName);

  LOG(("THRD-P(%p) enter %s\n", this, mName.BeginReading()));

  nsCOMPtr<nsIThread> current;
  nsThreadManager::get()->GetCurrentThread(getter_AddRefs(current));

  bool shutdownThreadOnExit = false;
  bool exitThread = false;
  bool wasIdle = false;
  PRIntervalTime idleSince;

  nsCOMPtr<nsIThreadPoolListener> listener;
  {
    MonitorAutoLock mon(mMonitor);
    listener = mListener;
  }

  if (listener) {
    listener->OnThreadCreated();
  }

  do {
    nsCOMPtr<nsIRunnable> event;
    {
      MonitorAutoLock mon(mMonitor);
      if (!mEvents.GetPendingEvent(getter_AddRefs(event), mon)) {
        PRIntervalTime now     = PR_IntervalNow();
        PRIntervalTime timeout = PR_MillisecondsToInterval(mIdleThreadTimeout);

        // If we are shutting down, then don't keep any idle threads
        if (mShutdown) {
          exitThread = true;
        } else {
          if (wasIdle) {
            // if too many idle threads or idle for too long, then bail.
            if (mIdleCount > mIdleThreadLimit || (now - idleSince) >= timeout) {
              exitThread = true;
            }
          } else {
            // if would be too many idle threads...
            if (mIdleCount == mIdleThreadLimit) {
              exitThread = true;
            } else {
              ++mIdleCount;
              idleSince = now;
              wasIdle = true;
            }
          }
        }

        if (exitThread) {
          if (wasIdle) {
            --mIdleCount;
          }
          shutdownThreadOnExit = mThreads.RemoveObject(current);
        } else {
          PRIntervalTime delta = timeout - (now - idleSince);
          LOG(("THRD-P(%p) %s waiting [%d]\n", this, mName.BeginReading(), delta));
          mon.Wait(delta);
          LOG(("THRD-P(%p) done waiting\n", this));
        }
      } else if (wasIdle) {
        wasIdle = false;
        --mIdleCount;
      }
    }
    if (event) {
      LOG(("THRD-P(%p) %s running [%p]\n", this, mName.BeginReading(), event.get()));
      event->Run();
    }
  } while (!exitThread);

  if (listener) {
    listener->OnThreadShuttingDown();
  }

  if (shutdownThreadOnExit) {
    ShutdownThread(current);
  }

  LOG(("THRD-P(%p) leave\n", this));
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::DispatchFromScript(nsIRunnable* aEvent, uint32_t aFlags)
{
  nsCOMPtr<nsIRunnable> event(aEvent);
  return Dispatch(event.forget(), aFlags);
}

NS_IMETHODIMP
nsThreadPool::Dispatch(already_AddRefed<nsIRunnable>&& aEvent, uint32_t aFlags)
{
  LOG(("THRD-P(%p) dispatch [%p %x]\n", this, /* XXX aEvent*/ nullptr, aFlags));

  if (NS_WARN_IF(mShutdown)) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  if (aFlags & DISPATCH_SYNC) {
    nsCOMPtr<nsIThread> thread;
    nsThreadManager::get()->GetCurrentThread(getter_AddRefs(thread));
    if (NS_WARN_IF(!thread)) {
      return NS_ERROR_NOT_AVAILABLE;
    }

    nsRefPtr<nsThreadSyncDispatch> wrapper =
      new nsThreadSyncDispatch(thread, Move(aEvent));
    PutEvent(wrapper);

    while (wrapper->IsPending()) {
      NS_ProcessNextEvent(thread);
    }
  } else {
    NS_ASSERTION(aFlags == NS_DISPATCH_NORMAL, "unexpected dispatch flags");
    PutEvent(Move(aEvent));
  }
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::IsOnCurrentThread(bool* aResult)
{
  MonitorAutoLock mon(mMonitor);
  if (NS_WARN_IF(mShutdown)) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  nsIThread* thread = NS_GetCurrentThread();
  for (uint32_t i = 0; i < static_cast<uint32_t>(mThreads.Count()); ++i) {
    if (mThreads[i] == thread) {
      *aResult = true;
      return NS_OK;
    }
  }
  *aResult = false;
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::Shutdown()
{
  nsCOMArray<nsIThread> threads;
  nsCOMPtr<nsIThreadPoolListener> listener;
  {
    MonitorAutoLock mon(mMonitor);
    mShutdown = true;
    mon.NotifyAll();

    threads.AppendObjects(mThreads);
    mThreads.Clear();

    // Swap in a null listener so that we release the listener at the end of
    // this method. The listener will be kept alive as long as the other threads
    // that were created when it was set.
    mListener.swap(listener);
  }

  // It's important that we shutdown the threads while outside the event queue
  // monitor.  Otherwise, we could end up dead-locking.

  for (int32_t i = 0; i < threads.Count(); ++i) {
    threads[i]->Shutdown();
  }

  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::GetThreadLimit(uint32_t* aValue)
{
  *aValue = mThreadLimit;
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::SetThreadLimit(uint32_t aValue)
{
  MonitorAutoLock mon(mMonitor);
  LOG(("THRD-P(%p) thread limit [%u]\n", this, aValue));
  mThreadLimit = aValue;
  if (mIdleThreadLimit > mThreadLimit) {
    mIdleThreadLimit = mThreadLimit;
  }

  if (static_cast<uint32_t>(mThreads.Count()) > mThreadLimit) {
    mon.NotifyAll();  // wake up threads so they observe this change
  }
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::GetIdleThreadLimit(uint32_t* aValue)
{
  *aValue = mIdleThreadLimit;
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::SetIdleThreadLimit(uint32_t aValue)
{
  MonitorAutoLock mon(mMonitor);
  LOG(("THRD-P(%p) idle thread limit [%u]\n", this, aValue));
  mIdleThreadLimit = aValue;
  if (mIdleThreadLimit > mThreadLimit) {
    mIdleThreadLimit = mThreadLimit;
  }

  // Do we need to kill some idle threads?
  if (mIdleCount > mIdleThreadLimit) {
    mon.NotifyAll();  // wake up threads so they observe this change
  }
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::GetIdleThreadTimeout(uint32_t* aValue)
{
  *aValue = mIdleThreadTimeout;
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::SetIdleThreadTimeout(uint32_t aValue)
{
  MonitorAutoLock mon(mMonitor);
  uint32_t oldTimeout = mIdleThreadTimeout;
  mIdleThreadTimeout = aValue;

  // Do we need to notify any idle threads that their sleep time has shortened?
  if (mIdleThreadTimeout < oldTimeout && mIdleCount > 0) {
    mon.NotifyAll();  // wake up threads so they observe this change
  }
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::GetThreadStackSize(uint32_t* aValue)
{
  MonitorAutoLock mon(mMonitor);
  *aValue = mStackSize;
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::SetThreadStackSize(uint32_t aValue)
{
  MonitorAutoLock mon(mMonitor);
  mStackSize = aValue;
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::GetListener(nsIThreadPoolListener** aListener)
{
  MonitorAutoLock mon(mMonitor);
  NS_IF_ADDREF(*aListener = mListener);
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::SetListener(nsIThreadPoolListener* aListener)
{
  nsCOMPtr<nsIThreadPoolListener> swappedListener(aListener);
  {
    MonitorAutoLock mon(mMonitor);
    mListener.swap(swappedListener);
  }
  return NS_OK;
}

NS_IMETHODIMP
nsThreadPool::SetName(const nsACString& aName)
{
  {
    MonitorAutoLock mon(mMonitor);
    if (mThreads.Count()) {
      return NS_ERROR_NOT_AVAILABLE;
    }
  }

  mName = aName;
  return NS_OK;
}
