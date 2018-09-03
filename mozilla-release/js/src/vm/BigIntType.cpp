/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sts=4 et sw=4 tw=99:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "vm/BigIntType.h"

#include "mozilla/FloatingPoint.h"
#include "mozilla/HashFunctions.h"
#include "mozilla/Maybe.h"
#include "mozilla/Range.h"
#include "mozilla/RangedPtr.h"

#include <gmp.h>
#include <math.h>

#include "jsapi.h"

#include "builtin/BigInt.h"
#include "gc/Allocator.h"
#include "gc/Tracer.h"
#include "js/Initialization.h"
#include "js/Utility.h"
#include "vm/JSContext.h"
#include "vm/SelfHosting.h"

using namespace js;

using mozilla::Maybe;
using mozilla::Range;
using mozilla::RangedPtr;

// The following functions are wrappers for use with
// mp_set_memory_functions. GMP passes extra arguments to the realloc
// and free functions not needed by the JS allocation interface.
// js_malloc has the signature expected for GMP's malloc function, so no
// wrapper is required.

static void*
js_mp_realloc(void* ptr, size_t old_size, size_t new_size)
{
    return js_realloc(ptr, new_size);
}

static void
js_mp_free(void* ptr, size_t size)
{
    return js_free(ptr);
}

static bool memoryFunctionsInitialized = false;

JS_PUBLIC_API(void)
JS::SetGMPMemoryFunctions(JS::GMPAllocFn allocFn,
                          JS::GMPReallocFn reallocFn,
                          JS::GMPFreeFn freeFn)
{
    MOZ_ASSERT(JS::detail::libraryInitState == JS::detail::InitState::Uninitialized);
    memoryFunctionsInitialized = true;
    mp_set_memory_functions(allocFn, reallocFn, freeFn);
}

void
BigInt::init()
{
    // Don't override custom allocation functions if
    // JS::SetGMPMemoryFunctions was called.
    if (!memoryFunctionsInitialized) {
        memoryFunctionsInitialized = true;
        mp_set_memory_functions(js_malloc, js_mp_realloc, js_mp_free);
    }
}

BigInt*
BigInt::create(JSContext* cx)
{
    BigInt* x = Allocate<BigInt>(cx);
    if (!x)
        return nullptr;
    mpz_init(x->num_); // to zero
    return x;
}

BigInt*
BigInt::createFromDouble(JSContext* cx, double d)
{
    BigInt* x = Allocate<BigInt>(cx);
    if (!x)
        return nullptr;
    mpz_init_set_d(x->num_, d);
    return x;
}

BigInt*
BigInt::createFromBoolean(JSContext* cx, bool b)
{
    BigInt* x = Allocate<BigInt>(cx);
    if (!x)
        return nullptr;
    mpz_init_set_ui(x->num_, b);
    return x;
}

BigInt*
BigInt::createFromBytes(JSContext* cx, int sign, void* bytes, size_t nbytes)
{
    BigInt* x = Allocate<BigInt>(cx);
    if (!x)
        return nullptr;
    // Initialize num_ to zero before calling mpz_import.
    mpz_init(x->num_);

    if (nbytes == 0)
        return x;

    mpz_import(x->num_, nbytes,
               -1, // order: least significant word first
               1, // size: one byte per "word"
               0, // endianness: native
               0, // nail bits: none; use full words
               bytes);
    if (sign < 0)
        mpz_neg(x->num_, x->num_);
    return x;
}

// BigInt proposal section 5.1.1
static bool
IsInteger(double d)
{
    // Step 1 is an assertion checked by the caller.
    // Step 2.
    if (!mozilla::IsFinite(d))
        return false;

    // Step 3.
    double i = JS::ToInteger(d);

    // Step 4.
    if (i != d)
        return false;

    // Step 5.
    return true;
}

// BigInt proposal section 5.1.2
BigInt*
js::NumberToBigInt(JSContext* cx, double d)
{
    // Step 1 is an assertion checked by the caller.
    // Step 2.
    if (!IsInteger(d)) {
        JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr,
                                  JSMSG_NUMBER_TO_BIGINT);
        return nullptr;
    }

    // Step 3.
    return BigInt::createFromDouble(cx, d);
}

BigInt*
BigInt::copy(JSContext* cx, HandleBigInt x)
{
    BigInt* bi = Allocate<BigInt>(cx);
    if (!bi)
        return nullptr;
    mpz_init_set(bi->num_, x->num_);
    return bi;
}

// BigInt proposal section 7.3
BigInt*
js::ToBigInt(JSContext* cx, HandleValue val)
{
    RootedValue v(cx, val);

    // Step 1.
    if (!ToPrimitive(cx, JSTYPE_NUMBER, &v))
        return nullptr;

    // Step 2.
    // String conversions are not yet supported.
    if (v.isBigInt())
        return v.toBigInt();

    if (v.isBoolean())
        return BigInt::createFromBoolean(cx, v.toBoolean());

    if (v.isString()) {
        RootedString str(cx, v.toString());
        return StringToBigInt(cx, str, 0);
    }

    JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr, JSMSG_NOT_BIGINT);
    return nullptr;
}

// ES 2019 draft 6.1.6
double
BigInt::numberValue(BigInt* x)
{
    // mpz_get_d may cause a hardware overflow trap, so use
    // mpz_get_d_2exp to get the fractional part and exponent
    // separately.
    signed long int exp;
    double d = mpz_get_d_2exp(&exp, x->num_);
    return ldexp(d, exp);
}

JSLinearString*
BigInt::toString(JSContext* cx, BigInt* x, uint8_t radix)
{
    MOZ_ASSERT(2 <= radix && radix <= 36);
    // We need two extra chars for '\0' and potentially '-'.
    size_t strSize = mpz_sizeinbase(x->num_, 10) + 2;
    UniqueChars str(static_cast<char*>(js_malloc(strSize)));
    if (!str) {
        ReportOutOfMemory(cx);
        return nullptr;
    }
    mpz_get_str(str.get(), radix, x->num_);

    return NewStringCopyZ<CanGC>(cx, str.get());
}

// BigInt proposal section 7.2
template <typename CharT>
bool
js::StringToBigIntImpl(const Range<const CharT>& chars, uint8_t radix,
                       HandleBigInt res)
{
    const RangedPtr<const CharT> end = chars.end();
    RangedPtr<const CharT> s = chars.begin();
    Maybe<int8_t> sign;

    s = SkipSpace(s.get(), end.get());

    if (s != end && s[0] == '+') {
        sign.emplace(1);
        s++;
    } else if (s != end && s[0] == '-') {
        sign.emplace(-1);
        s++;
    }

    if (!radix) {
        radix = 10;

        if (end - s >= 2 && s[0] == '0') {
            if (s[1] == 'x' || s[1] == 'X') {
                radix = 16;
                s += 2;
            } else if (s[1] == 'o' || s[1] == 'O') {
                radix = 8;
                s += 2;
            } else if (s[1] == 'b' || s[1] == 'B') {
                radix = 2;
                s += 2;
            }

            if (radix != 10 && s == end)
                return false;
        }
    }

    if (sign && radix != 10)
        return false;

    mpz_set_ui(res->num_, 0);

    for (; s < end; s++) {
        unsigned digit;
        if (!mozilla::IsAsciiAlphanumeric(s[0])) {
            s = SkipSpace(s.get(), end.get());
            if (s == end)
                break;
            return false;
        }
        digit = mozilla::AsciiAlphanumericToNumber(s[0]);
        if (digit >= radix)
            return false;
        mpz_mul_ui(res->num_, res->num_, radix);
        mpz_add_ui(res->num_, res->num_, digit);
    }

    if (sign.valueOr(1) < 0)
        mpz_neg(res->num_, res->num_);

    return true;
}

BigInt*
js::StringToBigInt(JSContext* cx, HandleString str, uint8_t radix)
{
    RootedBigInt res(cx, BigInt::create(cx));

    JSLinearString* linear = str->ensureLinear(cx);
    if (!linear)
        return nullptr;

    {
        JS::AutoCheckCannotGC nogc;
        if (linear->hasLatin1Chars()) {
            if (StringToBigIntImpl(linear->latin1Range(nogc), radix, res))
                return res;
        } else {
            if (StringToBigIntImpl(linear->twoByteRange(nogc), radix, res))
                return res;
        }
    }

    JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr,
                              JSMSG_BIGINT_INVALID_SYNTAX);
    return nullptr;
}

size_t
BigInt::byteLength(BigInt* x)
{
    if (mpz_sgn(x->num_) == 0)
        return 0;
    return JS_HOWMANY(mpz_sizeinbase(x->num_, 2), 8);
}

void
BigInt::writeBytes(BigInt* x, RangedPtr<uint8_t> buffer)
{
#ifdef DEBUG
    // Check that the buffer being filled is large enough to hold the
    // integer we're writing. The result of the RangedPtr addition is
    // restricted to the buffer's range.
    size_t reprSize = byteLength(x);
    MOZ_ASSERT(buffer + reprSize, "out of bounds access to buffer");
#endif

    size_t count;
    // cf. mpz_import parameters in createFromBytes, above.
    mpz_export(buffer.get(), &count, -1, 1, 0, 0, x->num_);
    MOZ_ASSERT(count == reprSize);
}

void
BigInt::finalize(js::FreeOp* fop)
{
    mpz_clear(num_);
}

JSAtom*
js::BigIntToAtom(JSContext* cx, BigInt* bi)
{
    JSString* str = BigInt::toString(cx, bi, 10);
    if (!str)
        return nullptr;
    return AtomizeString(cx, str);
}

bool
BigInt::toBoolean()
{
    return mpz_sgn(num_) != 0;
}

int8_t
BigInt::sign()
{
    return mpz_sgn(num_);
}

js::HashNumber
BigInt::hash()
{
    const mp_limb_t* limbs = mpz_limbs_read(num_);
    size_t limbCount = mpz_size(num_);
    uint32_t hash = mozilla::HashBytes(limbs, limbCount * sizeof(mp_limb_t));
    hash = mozilla::AddToHash(hash, mpz_sgn(num_));
    return hash;
}

size_t
BigInt::sizeOfExcludingThis(mozilla::MallocSizeOf mallocSizeOf) const
{
    // Use the total number of limbs allocated when calculating the size
    // (_mp_alloc), not the number of limbs currently in use (_mp_size).
    // See the Info node `(gmp)Integer Internals` for details.
    mpz_srcptr n = static_cast<mpz_srcptr>(num_);
    return sizeof(*n) + sizeof(mp_limb_t) * n->_mp_alloc;
}

JS::ubi::Node::Size
JS::ubi::Concrete<BigInt>::size(mozilla::MallocSizeOf mallocSizeOf) const
{
    BigInt& bi = get();
    MOZ_ASSERT(bi.isTenured());
    size_t size = js::gc::Arena::thingSize(bi.asTenured().getAllocKind());
    size += bi.sizeOfExcludingThis(mallocSizeOf);
    return size;
}
