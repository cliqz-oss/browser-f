/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/AvailableMemoryTracker.h"

#if defined(XP_WIN)
#include "prinrval.h"
#include "prenv.h"
#include "nsExceptionHandler.h"
#include "nsIMemoryReporter.h"
#include "nsMemoryPressure.h"
#include "nsPrintfCString.h"
#endif

#include "nsIObserver.h"
#include "nsIObserverService.h"
#include "nsIRunnable.h"
#include "nsISupports.h"
#include "nsITimer.h"
#include "nsThreadUtils.h"
#include "nsXULAppAPI.h"

#include "mozilla/ResultExtensions.h"
#include "mozilla/Services.h"
#include "mozilla/Unused.h"

#if defined(XP_WIN)
#   include "nsWindowsDllInterceptor.h"
#   include <windows.h>
#endif

#if defined(MOZ_MEMORY)
#   include "mozmemory.h"
#endif  // MOZ_MEMORY

using namespace mozilla;

namespace {

#if defined(XP_WIN)

// Fire a low-memory notification if we have less than this many bytes of
// virtual address space available.
#if defined(HAVE_64BIT_BUILD)
static const size_t kLowVirtualMemoryThreshold = 0;
#else
static const size_t kLowVirtualMemoryThreshold = 256 * 1024 * 1024;
#endif

// Fire a low-memory notification if we have less than this many bytes of commit
// space (physical memory plus page file) left.
static const size_t kLowCommitSpaceThreshold = 256 * 1024 * 1024;

// Fire a low-memory notification if we have less than this many bytes of
// physical memory available on the whole machine.
static const size_t kLowPhysicalMemoryThreshold = 0;

// Don't fire a low-memory notification because of low available physical
// memory or low commit space more often than this interval.
static const uint32_t kLowMemoryNotificationIntervalMS = 10000;

Atomic<uint32_t, MemoryOrdering::Relaxed> sNumLowVirtualMemEvents;
Atomic<uint32_t, MemoryOrdering::Relaxed> sNumLowCommitSpaceEvents;
Atomic<uint32_t, MemoryOrdering::Relaxed> sNumLowPhysicalMemEvents;

#if !defined(HAVE_64BIT_BUILD)

WindowsDllInterceptor sKernel32Intercept;
WindowsDllInterceptor sGdi32Intercept;

// Has Init() been called?
bool sInitialized = false;

// Has Activate() been called?  The hooks don't do anything until this happens.
bool sHooksActive = false;

// Alas, we'd like to use mozilla::TimeStamp, but we can't, because it acquires
// a lock!
volatile bool sUnderMemoryPressure = false;
volatile PRIntervalTime sLastLowMemoryNotificationTime;

// These are function pointers to the functions we wrap in Init().

void* (WINAPI* sVirtualAllocOrig)(LPVOID aAddress, SIZE_T aSize,
                                  DWORD aAllocationType, DWORD aProtect);

void* (WINAPI* sMapViewOfFileOrig)(HANDLE aFileMappingObject,
                                   DWORD aDesiredAccess, DWORD aFileOffsetHigh,
                                   DWORD aFileOffsetLow, SIZE_T aNumBytesToMap);

HBITMAP(WINAPI* sCreateDIBSectionOrig)(HDC aDC, const BITMAPINFO* aBitmapInfo,
                                       UINT aUsage, VOID** aBits,
                                       HANDLE aSection, DWORD aOffset);

/**
 * Fire a memory pressure event if we were not under memory pressure yet, or
 * fire an ongoing one if it's been long enough since the last one we
 * fired.
 */
bool
MaybeScheduleMemoryPressureEvent()
{
  MemoryPressureState state = MemPressure_New;
  PRIntervalTime now = PR_IntervalNow();

  // If this interval rolls over, we may fire an extra memory pressure
  // event, but that's not a big deal.
  PRIntervalTime interval = now - sLastLowMemoryNotificationTime;
  if (sUnderMemoryPressure) {
    if (PR_IntervalToMilliseconds(interval) <
        kLowMemoryNotificationIntervalMS) {
      return false;
    }

    state = MemPressure_Ongoing;
  }

  // There's a bit of a race condition here, since an interval may be a
  // 64-bit number, and 64-bit writes aren't atomic on x86-32.  But let's
  // not worry about it -- the races only happen when we're already
  // experiencing memory pressure and firing notifications, so the worst
  // thing that can happen is that we fire two notifications when we
  // should have fired only one.
  sUnderMemoryPressure = true;
  sLastLowMemoryNotificationTime = now;

  NS_DispatchEventualMemoryPressure(state);
  return true;
}

static bool
CheckLowMemory(DWORDLONG available, size_t threshold,
               Atomic<uint32_t, MemoryOrdering::Relaxed>& counter)
{
  if (available < threshold) {
    if (MaybeScheduleMemoryPressureEvent()) {
      counter++;
    }

    return true;
  }

  return false;
}

void
CheckMemAvailable()
{
  if (!sHooksActive) {
    return;
  }

  MEMORYSTATUSEX stat;
  stat.dwLength = sizeof(stat);
  bool success = GlobalMemoryStatusEx(&stat);

  if (success) {
    bool lowMemory = CheckLowMemory(stat.ullAvailVirtual,
                                    kLowVirtualMemoryThreshold,
                                    sNumLowVirtualMemEvents);
    lowMemory |= CheckLowMemory(stat.ullAvailPageFile, kLowCommitSpaceThreshold,
                                sNumLowCommitSpaceEvents);
    lowMemory |= CheckLowMemory(stat.ullAvailPhys, kLowPhysicalMemoryThreshold,
                                sNumLowPhysicalMemEvents);

    sUnderMemoryPressure = lowMemory;
  }
}

LPVOID WINAPI
VirtualAllocHook(LPVOID aAddress, SIZE_T aSize,
                 DWORD aAllocationType,
                 DWORD aProtect)
{
  // It's tempting to see whether we have enough free virtual address space for
  // this allocation and, if we don't, synchronously fire a low-memory
  // notification to free some before we allocate.
  //
  // Unfortunately that doesn't work, principally because code doesn't expect a
  // call to malloc could trigger a GC (or call into the other routines which
  // are triggered by a low-memory notification).
  //
  // I think the best we can do here is try to allocate the memory and check
  // afterwards how much free virtual address space we have.  If we're running
  // low, we schedule a low-memory notification to run as soon as possible.

  LPVOID result = sVirtualAllocOrig(aAddress, aSize, aAllocationType, aProtect);

  // Don't call CheckMemAvailable for MEM_RESERVE if we're not tracking low
  // virtual memory.  Similarly, don't call CheckMemAvailable for MEM_COMMIT if
  // we're not tracking low physical memory.
  if ((kLowVirtualMemoryThreshold != 0 && aAllocationType & MEM_RESERVE) ||
      ((kLowCommitSpaceThreshold != 0 || kLowPhysicalMemoryThreshold != 0) &&
       aAllocationType & MEM_COMMIT)) {
    CheckMemAvailable();
  }

  return result;
}

LPVOID WINAPI
MapViewOfFileHook(HANDLE aFileMappingObject,
                  DWORD aDesiredAccess,
                  DWORD aFileOffsetHigh,
                  DWORD aFileOffsetLow,
                  SIZE_T aNumBytesToMap)
{
  LPVOID result = sMapViewOfFileOrig(aFileMappingObject, aDesiredAccess,
                                     aFileOffsetHigh, aFileOffsetLow,
                                     aNumBytesToMap);
  CheckMemAvailable();
  return result;
}

HBITMAP WINAPI
CreateDIBSectionHook(HDC aDC,
                     const BITMAPINFO* aBitmapInfo,
                     UINT aUsage,
                     VOID** aBits,
                     HANDLE aSection,
                     DWORD aOffset)
{
  // There are a lot of calls to CreateDIBSection, so we make some effort not
  // to CheckMemAvailable() for calls to CreateDIBSection which allocate only
  // a small amount of memory.

  // If aSection is non-null, CreateDIBSection won't allocate any new memory.
  bool doCheck = false;
  if (sHooksActive && !aSection && aBitmapInfo) {
    uint16_t bitCount = aBitmapInfo->bmiHeader.biBitCount;
    if (bitCount == 0) {
      // MSDN says bitCount == 0 means that it figures out how many bits each
      // pixel gets by examining the corresponding JPEG or PNG data.  We'll just
      // assume the worst.
      bitCount = 32;
    }

    // |size| contains the expected allocation size in *bits*.  Height may be
    // negative (indicating the direction the DIB is drawn in), so we take the
    // absolute value.
    int64_t size = bitCount * aBitmapInfo->bmiHeader.biWidth *
                              aBitmapInfo->bmiHeader.biHeight;
    if (size < 0) {
      size *= -1;
    }

    // If we're allocating more than 1MB, check how much memory is left after
    // the allocation.
    if (size > 1024 * 1024 * 8) {
      doCheck = true;
    }
  }

  HBITMAP result = sCreateDIBSectionOrig(aDC, aBitmapInfo, aUsage, aBits,
                                         aSection, aOffset);

  if (doCheck) {
    CheckMemAvailable();
  }

  return result;
}

#else

class nsAvailableMemoryWatcher final : public nsIObserver,
                                       public nsITimerCallback
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER
  NS_DECL_NSITIMERCALLBACK

  nsresult Init();

private:
  // Poll the amount of free memory at this rate.
  static const uint32_t kPollingIntervalMS = 1000;

  // Observer topics we subscribe to
  static const char* const kObserverTopics[];

  static bool IsVirtualMemoryLow(const MEMORYSTATUSEX& aStat);
  static bool IsCommitSpaceLow(const MEMORYSTATUSEX& aStat);
  static bool IsPhysicalMemoryLow(const MEMORYSTATUSEX& aStat);

  ~nsAvailableMemoryWatcher() {};
  void AdjustPollingInterval(const bool aLowMemory);
  void SendMemoryPressureEvent();
  void Shutdown();

  nsCOMPtr<nsITimer> mTimer;
  bool mUnderMemoryPressure;
};

const char* const nsAvailableMemoryWatcher::kObserverTopics[] = {
  "quit-application",
  "user-interaction-active",
  "user-interaction-inactive",
};

NS_IMPL_ISUPPORTS(nsAvailableMemoryWatcher, nsIObserver, nsITimerCallback)

nsresult
nsAvailableMemoryWatcher::Init()
{
  mTimer = NS_NewTimer();

  nsCOMPtr<nsIObserverService> observerService = services::GetObserverService();
  MOZ_ASSERT(observerService);

  for (auto topic : kObserverTopics) {
    nsresult rv = observerService->AddObserver(this, topic,
                                               /* ownsWeak */ false);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  MOZ_TRY(mTimer->InitWithCallback(this, kPollingIntervalMS,
                                   nsITimer::TYPE_REPEATING_SLACK));
  return NS_OK;
}

void
nsAvailableMemoryWatcher::Shutdown()
{
  nsCOMPtr<nsIObserverService> observerService = services::GetObserverService();
  MOZ_ASSERT(observerService);

  for (auto topic : kObserverTopics) {
    Unused << observerService->RemoveObserver(this, topic);
  }

  if (mTimer) {
    mTimer->Cancel();
    mTimer = nullptr;
  }
}

/* static */ bool
nsAvailableMemoryWatcher::IsVirtualMemoryLow(const MEMORYSTATUSEX& aStat)
{
  if ((kLowVirtualMemoryThreshold != 0) &&
      (aStat.ullAvailVirtual < kLowVirtualMemoryThreshold)) {
    sNumLowVirtualMemEvents++;
    return true;
  }

  return false;
}

/* static */ bool
nsAvailableMemoryWatcher::IsCommitSpaceLow(const MEMORYSTATUSEX& aStat)
{
  if ((kLowCommitSpaceThreshold != 0) &&
      (aStat.ullAvailPageFile < kLowCommitSpaceThreshold)) {
    sNumLowCommitSpaceEvents++;
    CrashReporter::AnnotateCrashReport(
      NS_LITERAL_CSTRING("LowCommitSpaceEvents"),
      nsPrintfCString("%" PRIu32, uint32_t(sNumLowCommitSpaceEvents)));
    return true;
  }

  return false;
}

/* static */ bool
nsAvailableMemoryWatcher::IsPhysicalMemoryLow(const MEMORYSTATUSEX& aStat)
{
  if ((kLowPhysicalMemoryThreshold != 0) &&
      (aStat.ullAvailPhys < kLowPhysicalMemoryThreshold)) {
    sNumLowPhysicalMemEvents++;
    return true;
  }

  return false;
}

void
nsAvailableMemoryWatcher::SendMemoryPressureEvent()
{
    MemoryPressureState state = mUnderMemoryPressure ? MemPressure_Ongoing
                                                     : MemPressure_New;
    NS_DispatchEventualMemoryPressure(state);
}

void
nsAvailableMemoryWatcher::AdjustPollingInterval(const bool aLowMemory)
{
  if (aLowMemory) {
    // We entered a low-memory state, wait for a longer interval before polling
    // again as there's no point in rapidly sending further notifications.
    mTimer->SetDelay(kLowMemoryNotificationIntervalMS);
  } else if (mUnderMemoryPressure) {
    // We were under memory pressure but we're not anymore, resume polling at
    // a faster pace.
    mTimer->SetDelay(kPollingIntervalMS);
  }
}

// Timer callback, polls memory stats to detect low-memory conditions. This
// will send memory-pressure events if memory is running low and adjust the
// polling interval accordingly.
NS_IMETHODIMP
nsAvailableMemoryWatcher::Notify(nsITimer* aTimer)
{
  MEMORYSTATUSEX stat;
  stat.dwLength = sizeof(stat);
  bool success = GlobalMemoryStatusEx(&stat);

  if (success) {
    bool lowMemory =
      IsVirtualMemoryLow(stat) ||
      IsCommitSpaceLow(stat) ||
      IsPhysicalMemoryLow(stat);

    if (lowMemory) {
      SendMemoryPressureEvent();
    }

    AdjustPollingInterval(lowMemory);
    mUnderMemoryPressure = lowMemory;
  }

  return NS_OK;
}

// Observer service callback, used to stop the polling timer when the user
// stops interacting with Firefox and resuming it when they interact again.
// Also used to shut down the service if the application is quitting.
NS_IMETHODIMP
nsAvailableMemoryWatcher::Observe(nsISupports* aSubject, const char* aTopic,
                                  const char16_t* aData)
{
  if (strcmp(aTopic, "quit-application") == 0) {
    Shutdown();
  } else if (strcmp(aTopic, "user-interaction-inactive") == 0) {
    mTimer->Cancel();
  } else if (strcmp(aTopic, "user-interaction-active") == 0) {
    mTimer->InitWithCallback(this, kPollingIntervalMS,
                             nsITimer::TYPE_REPEATING_SLACK);
  } else {
    MOZ_ASSERT_UNREACHABLE("Unknown topic");
  }

  return NS_OK;
}

#endif // !defined(HAVE_64BIT_BUILD)

static int64_t
LowMemoryEventsVirtualDistinguishedAmount()
{
  return sNumLowVirtualMemEvents;
}

static int64_t
LowMemoryEventsCommitSpaceDistinguishedAmount()
{
  return sNumLowCommitSpaceEvents;
}

static int64_t
LowMemoryEventsPhysicalDistinguishedAmount()
{
  return sNumLowPhysicalMemEvents;
}

class LowEventsReporter final : public nsIMemoryReporter
{
  ~LowEventsReporter() {}

public:
  NS_DECL_ISUPPORTS

  NS_IMETHOD CollectReports(nsIHandleReportCallback* aHandleReport,
                            nsISupports* aData, bool aAnonymize) override
  {
    MOZ_COLLECT_REPORT(
      "low-memory-events/virtual", KIND_OTHER, UNITS_COUNT_CUMULATIVE,
      LowMemoryEventsVirtualDistinguishedAmount(),
"Number of low-virtual-memory events fired since startup. We fire such an "
"event if we notice there is less than memory.low_virtual_mem_threshold_mb of "
"virtual address space available (if zero, this behavior is disabled). The "
"process will probably crash if it runs out of virtual address space, so "
"this event is dire.");

    MOZ_COLLECT_REPORT(
      "low-memory-events/commit-space", KIND_OTHER, UNITS_COUNT_CUMULATIVE,
      LowMemoryEventsCommitSpaceDistinguishedAmount(),
"Number of low-commit-space events fired since startup. We fire such an "
"event if we notice there is less than memory.low_commit_space_threshold_mb of "
"commit space available (if zero, this behavior is disabled). Windows will "
"likely kill the process if it runs out of commit space, so this event is "
"dire.");

    MOZ_COLLECT_REPORT(
      "low-memory-events/physical", KIND_OTHER, UNITS_COUNT_CUMULATIVE,
      LowMemoryEventsPhysicalDistinguishedAmount(),
"Number of low-physical-memory events fired since startup. We fire such an "
"event if we notice there is less than memory.low_physical_memory_threshold_mb "
"of physical memory available (if zero, this behavior is disabled).  The "
"machine will start to page if it runs out of physical memory.  This may "
"cause it to run slowly, but it shouldn't cause it to crash.");

    return NS_OK;
  }
};
NS_IMPL_ISUPPORTS(LowEventsReporter, nsIMemoryReporter)

#endif // defined(XP_WIN)

/**
 * This runnable is executed in response to a memory-pressure event; we spin
 * the event-loop when receiving the memory-pressure event in the hope that
 * other observers will synchronously free some memory that we'll be able to
 * purge here.
 */
class nsJemallocFreeDirtyPagesRunnable final : public nsIRunnable
{
  ~nsJemallocFreeDirtyPagesRunnable() {}

public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIRUNNABLE
};

NS_IMPL_ISUPPORTS(nsJemallocFreeDirtyPagesRunnable, nsIRunnable)

NS_IMETHODIMP
nsJemallocFreeDirtyPagesRunnable::Run()
{
  MOZ_ASSERT(NS_IsMainThread());

#if defined(MOZ_MEMORY)
  jemalloc_free_dirty_pages();
#endif

  return NS_OK;
}

/**
 * The memory pressure watcher is used for listening to memory-pressure events
 * and reacting upon them. We use one instance per process currently only for
 * cleaning up dirty unused pages held by jemalloc.
 */
class nsMemoryPressureWatcher final : public nsIObserver
{
  ~nsMemoryPressureWatcher() {}

public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  void Init();
};

NS_IMPL_ISUPPORTS(nsMemoryPressureWatcher, nsIObserver)

/**
 * Initialize and subscribe to the memory-pressure events. We subscribe to the
 * observer service in this method and not in the constructor because we need
 * to hold a strong reference to 'this' before calling the observer service.
 */
void
nsMemoryPressureWatcher::Init()
{
  nsCOMPtr<nsIObserverService> os = services::GetObserverService();

  if (os) {
    os->AddObserver(this, "memory-pressure", /* ownsWeak */ false);
  }
}

/**
 * Reacts to all types of memory-pressure events, launches a runnable to
 * free dirty pages held by jemalloc.
 */
NS_IMETHODIMP
nsMemoryPressureWatcher::Observe(nsISupports* aSubject, const char* aTopic,
                                 const char16_t* aData)
{
  MOZ_ASSERT(!strcmp(aTopic, "memory-pressure"), "Unknown topic");

  nsCOMPtr<nsIRunnable> runnable = new nsJemallocFreeDirtyPagesRunnable();

  NS_DispatchToMainThread(runnable);

  return NS_OK;
}

} // namespace

namespace mozilla {
namespace AvailableMemoryTracker {

void
Activate()
{
#if defined(XP_WIN) && !defined(HAVE_64BIT_BUILD)
  MOZ_ASSERT(sInitialized);
  MOZ_ASSERT(!sHooksActive);

  RegisterStrongMemoryReporter(new LowEventsReporter());
  RegisterLowMemoryEventsVirtualDistinguishedAmount(
    LowMemoryEventsVirtualDistinguishedAmount);
  RegisterLowMemoryEventsPhysicalDistinguishedAmount(
    LowMemoryEventsPhysicalDistinguishedAmount);
  sHooksActive = true;
#endif // defined(XP_WIN) && !defined(HAVE_64BIT_BUILD)

  // The watchers are held alive by the observer service.
  RefPtr<nsMemoryPressureWatcher> watcher = new nsMemoryPressureWatcher();
  watcher->Init();

#if defined(XP_WIN) && defined(HAVE_64BIT_BUILD)
  if (XRE_IsParentProcess()) {
    RefPtr<nsAvailableMemoryWatcher> poller = new nsAvailableMemoryWatcher();

    if (NS_FAILED(poller->Init())) {
      NS_WARNING("Could not start the available memory watcher");
    }
  }
#endif // defined(XP_WIN) && defined(HAVE_64BIT_BUILD)
}

void
Init()
{
  // Do nothing on x86-64, because nsWindowsDllInterceptor is not thread-safe
  // on 64-bit.  (On 32-bit, it's probably thread-safe.)  Even if we run Init()
  // before any other of our threads are running, another process may have
  // started a remote thread which could call VirtualAlloc!
  //
  // Moreover, the benefit of this code is less clear when we're a 64-bit
  // process, because we aren't going to run out of virtual memory, and the
  // system is likely to have a fair bit of physical memory.

#if defined(XP_WIN) && !defined(HAVE_64BIT_BUILD)
  // Don't register the hooks if we're a build instrumented for PGO: If we're
  // an instrumented build, the compiler adds function calls all over the place
  // which may call VirtualAlloc; this makes it hard to prevent
  // VirtualAllocHook from reentering itself.
  if (!PR_GetEnv("MOZ_PGO_INSTRUMENTED")) {
    sKernel32Intercept.Init("Kernel32.dll");
    sKernel32Intercept.AddHook("VirtualAlloc",
                               reinterpret_cast<intptr_t>(VirtualAllocHook),
                               reinterpret_cast<void**>(&sVirtualAllocOrig));
    sKernel32Intercept.AddHook("MapViewOfFile",
                               reinterpret_cast<intptr_t>(MapViewOfFileHook),
                               reinterpret_cast<void**>(&sMapViewOfFileOrig));

    sGdi32Intercept.Init("Gdi32.dll");
    sGdi32Intercept.AddHook("CreateDIBSection",
                            reinterpret_cast<intptr_t>(CreateDIBSectionHook),
                            reinterpret_cast<void**>(&sCreateDIBSectionOrig));
  }

  sInitialized = true;
#endif // defined(XP_WIN) && !defined(HAVE_64BIT_BUILD)
}

} // namespace AvailableMemoryTracker
} // namespace mozilla
