/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsThread_h__
#define nsThread_h__

#include "mozilla/Mutex.h"
#include "nsIIdlePeriod.h"
#include "nsIThreadInternal.h"
#include "nsISupportsPriority.h"
#include "nsThreadUtils.h"
#include "nsString.h"
#include "nsTObserverArray.h"
#include "mozilla/Attributes.h"
#include "mozilla/SynchronizedEventQueue.h"
#include "mozilla/NotNull.h"
#include "mozilla/TimeStamp.h"
#include "nsAutoPtr.h"
#include "mozilla/AlreadyAddRefed.h"
#include "mozilla/UniquePtr.h"
#include "mozilla/Array.h"

namespace mozilla {
class CycleCollectedJSContext;
class ThreadEventTarget;
}

using mozilla::NotNull;

// A native thread
class nsThread
  : public nsIThreadInternal
  , public nsISupportsPriority
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIEVENTTARGET_FULL
  NS_DECL_NSITHREAD
  NS_DECL_NSITHREADINTERNAL
  NS_DECL_NSISUPPORTSPRIORITY

  enum MainThreadFlag
  {
    MAIN_THREAD,
    NOT_MAIN_THREAD
  };

  nsThread(NotNull<mozilla::SynchronizedEventQueue*> aQueue,
           MainThreadFlag aMainThread,
           uint32_t aStackSize);

  // Initialize this as a wrapper for a new PRThread, and optionally give it a name.
  nsresult Init(const nsACString& aName = NS_LITERAL_CSTRING(""));

  // Initialize this as a wrapper for the current PRThread.
  nsresult InitCurrentThread();

  // The PRThread corresponding to this thread.
  PRThread* GetPRThread()
  {
    return mThread;
  }

  // If this flag is true, then the nsThread was created using
  // nsIThreadManager::NewThread.
  bool ShutdownRequired()
  {
    return mShutdownRequired;
  }

  // Clear the observer list.
  void ClearObservers()
  {
    mEventObservers.Clear();
  }

  void
  SetScriptObserver(mozilla::CycleCollectedJSContext* aScriptObserver);

  uint32_t
  RecursionDepth() const;

  void ShutdownComplete(NotNull<struct nsThreadShutdownContext*> aContext);

  void WaitForAllAsynchronousShutdowns();

  enum class ShouldSaveMemoryReport
  {
    kMaybeReport,
    kForceReport
  };

  static bool SaveMemoryReportNearOOM(ShouldSaveMemoryReport aShouldSave);

  static const uint32_t kRunnableNameBufSize = 1000;
  static mozilla::Array<char, kRunnableNameBufSize> sMainThreadRunnableName;

  void EnableInputEventPrioritization()
  {
    EventQueue()->EnableInputEventPrioritization();
  }

  void FlushInputEventPrioritization()
  {
    EventQueue()->FlushInputEventPrioritization();
  }

  void SuspendInputEventPrioritization()
  {
    EventQueue()->SuspendInputEventPrioritization();
  }

  void ResumeInputEventPrioritization()
  {
    EventQueue()->ResumeInputEventPrioritization();
  }

#ifndef RELEASE_OR_BETA
  mozilla::TimeStamp& NextIdleDeadlineRef() { return mNextIdleDeadline; }
#endif

  mozilla::SynchronizedEventQueue* EventQueue() { return mEvents.get(); }

  bool ShuttingDown()
  {
    return mShutdownContext != nullptr;
  }

private:
  void DoMainThreadSpecificProcessing(bool aReallyWait);

protected:
  friend class nsThreadShutdownEvent;

  virtual ~nsThread();

  static void ThreadFunc(void* aArg);

  // Helper
  already_AddRefed<nsIThreadObserver> GetObserver()
  {
    nsIThreadObserver* obs;
    nsThread::GetObserver(&obs);
    return already_AddRefed<nsIThreadObserver>(obs);
  }

  struct nsThreadShutdownContext* ShutdownInternal(bool aSync);

  RefPtr<mozilla::SynchronizedEventQueue> mEvents;
  RefPtr<mozilla::ThreadEventTarget> mEventTarget;

  mozilla::CycleCollectedJSContext* mScriptObserver;

  // Only accessed on the target thread.
  nsAutoTObserverArray<NotNull<nsCOMPtr<nsIThreadObserver>>, 2> mEventObservers;

  int32_t   mPriority;
  PRThread* mThread;
  uint32_t  mNestedEventLoopDepth;
  uint32_t  mStackSize;

  // The shutdown context for ourselves.
  struct nsThreadShutdownContext* mShutdownContext;
  // The shutdown contexts for any other threads we've asked to shut down.
  nsTArray<nsAutoPtr<struct nsThreadShutdownContext>> mRequestedShutdownContexts;

  mozilla::Atomic<bool> mShutdownRequired;
  MainThreadFlag mIsMainThread;

  // The time when we last ran an unlabeled runnable (one not associated with a
  // SchedulerGroup).
  mozilla::TimeStamp mLastUnlabeledRunnable;

  // Set to true if this thread creates a JSRuntime.
  bool mCanInvokeJS;

#ifndef RELEASE_OR_BETA
  mozilla::TimeStamp mNextIdleDeadline;
#endif
};

#if defined(XP_UNIX) && !defined(ANDROID) && !defined(DEBUG) && HAVE_UALARM \
  && defined(_GNU_SOURCE)
# define MOZ_CANARY

extern int sCanaryOutputFD;
#endif

#endif  // nsThread_h__
