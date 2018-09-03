/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef jit_CompileWrappers_h
#define jit_CompileWrappers_h

#include "vm/JSContext.h"

namespace js {
namespace jit {

class JitRuntime;

// During Ion compilation we need access to various bits of the current
// compartment, runtime and so forth. However, since compilation can run off
// thread while the main thread is mutating the VM, this access needs
// to be restricted. The classes below give the compiler an interface to access
// all necessary information in a threadsafe fashion.

class CompileRuntime
{
    JSRuntime* runtime();

  public:
    static CompileRuntime* get(JSRuntime* rt);

#ifdef JS_GC_ZEAL
    const void* addressOfGCZealModeBits();
#endif

    const JitRuntime* jitRuntime();

    // Compilation does not occur off thread when the Gecko Profiler is enabled.
    GeckoProfilerRuntime& geckoProfiler();

    bool jitSupportsFloatingPoint();
    bool hadOutOfMemory();
    bool profilingScripts();

    const JSAtomState& names();
    const PropertyName* emptyString();
    const StaticStrings& staticStrings();
    const Value& NaNValue();
    const Value& positiveInfinityValue();
    const WellKnownSymbols& wellKnownSymbols();

    const void* mainContextPtr();
    const void* addressOfJitStackLimit();
    const void* addressOfInterruptBits();

#ifdef DEBUG
    bool isInsideNursery(gc::Cell* cell);
#endif

    // DOM callbacks must be threadsafe (and will hopefully be removed soon).
    const DOMCallbacks* DOMcallbacks();

    bool runtimeMatches(JSRuntime* rt);
};

class CompileZone
{
    Zone* zone();

  public:
    static CompileZone* get(Zone* zone);

    CompileRuntime* runtime();
    bool isAtomsZone();

#ifdef DEBUG
    const void* addressOfIonBailAfter();
#endif

    const void* addressOfNeedsIncrementalBarrier();
    const void* addressOfFreeList(gc::AllocKind allocKind);
    const void* addressOfNurseryPosition();
    const void* addressOfStringNurseryPosition();
    const void* addressOfNurseryCurrentEnd();
    const void* addressOfStringNurseryCurrentEnd();

    bool nurseryExists();
    bool canNurseryAllocateStrings();
    void setMinorGCShouldCancelIonCompilations();
};

class JitRealm;

class CompileRealm
{
    JS::Realm* realm();

  public:
    static CompileRealm* get(JS::Realm* realm);

    CompileZone* zone();
    CompileRuntime* runtime();

    const void* addressOfRandomNumberGenerator();

    const JitRealm* jitRealm();

    const GlobalObject* maybeGlobal();
    const uint32_t* addressOfGlobalWriteBarriered();

    bool hasAllocationMetadataBuilder();

    // Mirror RealmOptions.
    void setSingletonsAsValues();
};

class JitCompileOptions
{
  public:
    JitCompileOptions();
    explicit JitCompileOptions(JSContext* cx);

    bool cloneSingletons() const {
        return cloneSingletons_;
    }

    bool profilerSlowAssertionsEnabled() const {
        return profilerSlowAssertionsEnabled_;
    }

    bool offThreadCompilationAvailable() const {
        return offThreadCompilationAvailable_;
    }

  private:
    bool cloneSingletons_;
    bool profilerSlowAssertionsEnabled_;
    bool offThreadCompilationAvailable_;
};

} // namespace jit
} // namespace js

#endif // jit_CompileWrappers_h
