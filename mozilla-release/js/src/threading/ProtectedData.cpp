/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "threading/ProtectedData.h"

#include "gc/Heap.h"
#include "vm/HelperThreads.h"
#include "vm/JSContext.h"

namespace js {

#ifdef JS_HAS_PROTECTED_DATA_CHECKS

/* static */ mozilla::Atomic<size_t> AutoNoteSingleThreadedRegion::count(0);

template <AllowedHelperThread Helper>
static inline bool
OnHelperThread()
{
    if (Helper == AllowedHelperThread::IonCompile || Helper == AllowedHelperThread::GCTaskOrIonCompile) {
        if (CurrentThreadIsIonCompiling())
            return true;
    }

    if (Helper == AllowedHelperThread::GCTask || Helper == AllowedHelperThread::GCTaskOrIonCompile) {
        if (TlsContext.get()->performingGC || TlsContext.get()->runtime()->gc.onBackgroundThread())
            return true;
    }

    return false;
}

void
CheckThreadLocal::check() const
{
    JSContext* cx = TlsContext.get();
    MOZ_ASSERT(cx);
    MOZ_ASSERT_IF(cx->isMainThreadContext(),
                  CurrentThreadCanAccessRuntime(cx->runtime()));
    MOZ_ASSERT(id == ThisThread::GetId());
}

template <AllowedHelperThread Helper>
void
CheckMainThread<Helper>::check() const
{
    if (OnHelperThread<Helper>())
        return;

    JSContext* cx = TlsContext.get();
    MOZ_ASSERT(CurrentThreadCanAccessRuntime(cx->runtime()));
}

template class CheckMainThread<AllowedHelperThread::None>;
template class CheckMainThread<AllowedHelperThread::GCTask>;
template class CheckMainThread<AllowedHelperThread::IonCompile>;

template <AllowedHelperThread Helper>
void
CheckZone<Helper>::check() const
{
    if (OnHelperThread<Helper>())
        return;

    JSRuntime* runtime = TlsContext.get()->runtime();
    if (zone->isAtomsZone()) {
        // The atoms zone is protected by the exclusive access lock, but can be
        // also accessed when off-thread parsing is blocked.
        MOZ_ASSERT(runtime->currentThreadHasExclusiveAccess() ||
                   (!runtime->isOffThreadParseRunning() && runtime->isOffThreadParsingBlocked()));
    } else if (zone->usedByHelperThread()) {
        // This may only be accessed by the helper thread using this zone.
        MOZ_ASSERT(zone->ownedByCurrentHelperThread());
    } else {
        // The main thread is permitted access to all zones. These accesses
        // are threadsafe if the zone is not in use by a helper thread.
        MOZ_ASSERT(CurrentThreadCanAccessRuntime(runtime));
    }
}

template class CheckZone<AllowedHelperThread::None>;
template class CheckZone<AllowedHelperThread::GCTask>;
template class CheckZone<AllowedHelperThread::IonCompile>;
template class CheckZone<AllowedHelperThread::GCTaskOrIonCompile>;

template <GlobalLock Lock, AllowedHelperThread Helper>
void
CheckGlobalLock<Lock, Helper>::check() const
{
    if (OnHelperThread<Helper>())
        return;

    switch (Lock) {
      case GlobalLock::GCLock:
        MOZ_ASSERT(TlsContext.get()->runtime()->gc.currentThreadHasLockedGC());
        break;
      case GlobalLock::ExclusiveAccessLock:
        MOZ_ASSERT(TlsContext.get()->runtime()->currentThreadHasExclusiveAccess());
        break;
      case GlobalLock::ScriptDataLock:
        MOZ_ASSERT(TlsContext.get()->runtime()->currentThreadHasScriptDataAccess());
        break;
      case GlobalLock::HelperThreadLock:
        MOZ_ASSERT(HelperThreadState().isLockedByCurrentThread());
        break;
    }
}

template class CheckGlobalLock<GlobalLock::GCLock, AllowedHelperThread::None>;
template class CheckGlobalLock<GlobalLock::ExclusiveAccessLock, AllowedHelperThread::None>;
template class CheckGlobalLock<GlobalLock::ExclusiveAccessLock, AllowedHelperThread::GCTask>;
template class CheckGlobalLock<GlobalLock::ScriptDataLock, AllowedHelperThread::None>;
template class CheckGlobalLock<GlobalLock::HelperThreadLock, AllowedHelperThread::None>;

#endif // JS_HAS_PROTECTED_DATA_CHECKS

} // namespace js
