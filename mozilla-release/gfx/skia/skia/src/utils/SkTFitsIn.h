/*
 * Copyright 2013 Google Inc.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

#ifndef SkTFitsIn_DEFINED
#define SkTFitsIn_DEFINED

#include "SkTypes.h"
#include "SkTLogic.h"
#include <limits>

namespace sktfitsin {
namespace Private {

/** SkTHasMoreDigits::type = (digits(A) >= digits(B)) ? SkTrue : SkFalse. */
template<typename A, typename B> struct SkTHasMoreDigits {
    typedef SkTBool<std::numeric_limits<A>::digits >= std::numeric_limits<B>::digits> type;
};

/** A high or low side predicate which is used when it is statically known
 *  that source values are in the range of the Destination.
 */
template <typename S> struct SkTOutOfRange_False {
    typedef SkFalse can_be_true;
    typedef S source_type;
    static bool apply(S s) {
        return false;
    }
};

/** A low side predicate which tests if the source value < Min(D).
 *  Assumes that Min(S) <= Min(D).
 */
template <typename D, typename S> struct SkTOutOfRange_LT_MinD {
    typedef SkTrue can_be_true;
    typedef S source_type;
    static bool apply(S s) {
        typedef typename SkTHasMoreDigits<S, D>::type precondition;
        SK_COMPILE_ASSERT(precondition::value, SkTOutOfRange_LT_MinD__minS_gt_minD);

        return s < static_cast<S>((std::numeric_limits<D>::min)());
    }
};

/** A low side predicate which tests if the source value is less than 0. */
template <typename D, typename S> struct SkTOutOfRange_LT_Zero {
    typedef SkTrue can_be_true;
    typedef S source_type;
    static bool apply(S s) {
        return s < static_cast<S>(0);
    }
};

/** A high side predicate which tests if the source value > Max(D).
 *  Assumes that Max(S) >= Max(D).
 */
template <typename D, typename S> struct SkTOutOfRange_GT_MaxD {
    typedef SkTrue can_be_true;
    typedef S source_type;
    static bool apply(S s) {
        typedef typename SkTHasMoreDigits<S, D>::type precondition;
        SK_COMPILE_ASSERT(precondition::value, SkTOutOfRange_GT_MaxD__maxS_lt_maxD);

        return s > static_cast<S>((std::numeric_limits<D>::max)());
    }
};

/** Composes two SkTOutOfRange predicates.
 *  First checks OutOfRange_Low then, if in range, OutOfRange_High.
 */
template<class OutOfRange_Low, class OutOfRange_High> struct SkTOutOfRange_Either {
    typedef SkTrue can_be_true;
    typedef typename OutOfRange_Low::source_type source_type;
    static bool apply(source_type s) {
        bool outOfRange = OutOfRange_Low::apply(s);
        if (!outOfRange) {
            outOfRange = OutOfRange_High::apply(s);
        }
        return outOfRange;
    }
};

/** SkTCombineOutOfRange::type is an SkTOutOfRange_XXX type which is the
 *  optimal combination of OutOfRange_Low and OutOfRange_High.
 */
template<class OutOfRange_Low, class OutOfRange_High> struct SkTCombineOutOfRange {
    typedef SkTOutOfRange_Either<OutOfRange_Low, OutOfRange_High> Both;
    typedef SkTOutOfRange_False<typename OutOfRange_Low::source_type> Neither;

    typedef typename OutOfRange_Low::can_be_true apply_low;
    typedef typename OutOfRange_High::can_be_true apply_high;

    typedef typename SkTMux<apply_low, apply_high,
                            Both, OutOfRange_Low, OutOfRange_High, Neither>::type type;
};

template<typename D, typename S, class OutOfRange_Low, class OutOfRange_High>
struct SkTRangeChecker {
    /** This is the method which is called at runtime to do the range check. */
    static bool OutOfRange(S s) {
        typedef typename SkTCombineOutOfRange<OutOfRange_Low, OutOfRange_High>::type Combined;
        return Combined::apply(s);
    }
};

/** SkTFitsIn_Unsigned2Unsiged::type is an SkTRangeChecker with an OutOfRange(S s) method
 *  the implementation of which is tailored for the source and destination types.
 *  Assumes that S and D are unsigned integer types.
 */
template<typename D, typename S> struct SkTFitsIn_Unsigned2Unsiged {
    typedef SkTOutOfRange_False<S> OutOfRange_Low;
    typedef SkTOutOfRange_GT_MaxD<D, S> OutOfRange_High;

    typedef SkTRangeChecker<D, S, OutOfRange_Low, OutOfRange_High> HighSideOnlyCheck;
    typedef SkTRangeChecker<D, S, SkTOutOfRange_False<S>, SkTOutOfRange_False<S> > NoCheck;

    // If std::numeric_limits<D>::digits >= std::numeric_limits<S>::digits, nothing to check.
    // This also protects the precondition of SkTOutOfRange_GT_MaxD.
    typedef typename SkTHasMoreDigits<D, S>::type sourceFitsInDesitination;
    typedef typename SkTIf<sourceFitsInDesitination, NoCheck, HighSideOnlyCheck>::type type;
};

/** SkTFitsIn_Signed2Signed::type is an SkTRangeChecker with an OutOfRange(S s) method
 *  the implementation of which is tailored for the source and destination types.
 *  Assumes that S and D are signed integer types.
 */
template<typename D, typename S> struct SkTFitsIn_Signed2Signed {
    typedef SkTOutOfRange_LT_MinD<D, S> OutOfRange_Low;
    typedef SkTOutOfRange_GT_MaxD<D, S> OutOfRange_High;

    typedef SkTRangeChecker<D, S, OutOfRange_Low, OutOfRange_High> FullCheck;
    typedef SkTRangeChecker<D, S, SkTOutOfRange_False<S>, SkTOutOfRange_False<S> > NoCheck;

    // If std::numeric_limits<D>::digits >= std::numeric_limits<S>::digits, nothing to check.
    // This also protects the precondition of SkTOutOfRange_LT_MinD and SkTOutOfRange_GT_MaxD.
    typedef typename SkTHasMoreDigits<D, S>::type sourceFitsInDesitination;
    typedef typename SkTIf<sourceFitsInDesitination, NoCheck, FullCheck>::type type;
};

/** SkTFitsIn_Signed2Unsigned::type is an SkTRangeChecker with an OutOfRange(S s) method
 *  the implementation of which is tailored for the source and destination types.
 *  Assumes that S is a signed integer type and D is an unsigned integer type.
 */
template<typename D, typename S> struct SkTFitsIn_Signed2Unsigned {
    typedef SkTOutOfRange_LT_Zero<D, S> OutOfRange_Low;
    typedef SkTOutOfRange_GT_MaxD<D, S> OutOfRange_High;

    typedef SkTRangeChecker<D, S, OutOfRange_Low, OutOfRange_High> FullCheck;
    typedef SkTRangeChecker<D, S, OutOfRange_Low, SkTOutOfRange_False<S> > LowSideOnlyCheck;

    // If std::numeric_limits<D>::max() >= std::numeric_limits<S>::max(),
    // no need to check the high side. (Until C++11, assume more digits means greater max.)
    // This also protects the precondition of SkTOutOfRange_GT_MaxD.
    typedef typename SkTHasMoreDigits<D, S>::type sourceCannotExceedDesitination;
    typedef typename SkTIf<sourceCannotExceedDesitination, LowSideOnlyCheck, FullCheck>::type type;
};

/** SkTFitsIn_Unsigned2Signed::type is an SkTRangeChecker with an OutOfRange(S s) method
 *  the implementation of which is tailored for the source and destination types.
 *  Assumes that S is an usigned integer type and D is a signed integer type.
 */
template<typename D, typename S> struct SkTFitsIn_Unsigned2Signed {
    typedef SkTOutOfRange_False<S> OutOfRange_Low;
    typedef SkTOutOfRange_GT_MaxD<D, S> OutOfRange_High;

    typedef SkTRangeChecker<D, S, OutOfRange_Low, OutOfRange_High> HighSideOnlyCheck;
    typedef SkTRangeChecker<D, S, SkTOutOfRange_False<S>, SkTOutOfRange_False<S> > NoCheck;

    // If std::numeric_limits<D>::max() >= std::numeric_limits<S>::max(), nothing to check.
    // (Until C++11, assume more digits means greater max.)
    // This also protects the precondition of SkTOutOfRange_GT_MaxD.
    typedef typename SkTHasMoreDigits<D, S>::type sourceCannotExceedDesitination;
    typedef typename SkTIf<sourceCannotExceedDesitination, NoCheck, HighSideOnlyCheck>::type type;
};

/** SkTFitsIn::type is an SkTRangeChecker with an OutOfRange(S s) method
 *  the implementation of which is tailored for the source and destination types.
 *  Assumes that S and D are integer types.
 */
template<typename D, typename S> struct SkTFitsIn {
    // One of the following will be the 'selector' type.
    typedef SkTFitsIn_Signed2Signed<D, S> S2S;
    typedef SkTFitsIn_Signed2Unsigned<D, S> S2U;
    typedef SkTFitsIn_Unsigned2Signed<D, S> U2S;
    typedef SkTFitsIn_Unsigned2Unsiged<D, S> U2U;

    typedef SkTBool<std::numeric_limits<S>::is_signed> S_is_signed;
    typedef SkTBool<std::numeric_limits<D>::is_signed> D_is_signed;

    typedef typename SkTMux<S_is_signed, D_is_signed, S2S, S2U, U2S, U2U>::type selector;
    // This type is an SkTRangeChecker.
    typedef typename selector::type type;
};

} // namespace Private
} // namespace sktfitsin

/** Returns true if the integer source value 's' will fit in the integer destination type 'D'. */
template <typename D, typename S> inline bool SkTFitsIn(S s) {
    SK_COMPILE_ASSERT(std::numeric_limits<S>::is_integer, SkTFitsIn_source_must_be_integer);
    SK_COMPILE_ASSERT(std::numeric_limits<D>::is_integer, SkTFitsIn_destination_must_be_integer);

    return !sktfitsin::Private::SkTFitsIn<D, S>::type::OutOfRange(s);
}

#endif
