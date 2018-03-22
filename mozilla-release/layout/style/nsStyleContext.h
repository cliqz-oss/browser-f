/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* the interface (to internal code) for retrieving computed style data */

#ifndef _nsStyleContext_h_
#define _nsStyleContext_h_

#include "mozilla/Assertions.h"
#include "mozilla/RestyleLogging.h"
#include "mozilla/ServoStyleSet.h"
#include "mozilla/ServoUtils.h"
#include "mozilla/StyleComplexColor.h"
#include "nsCSSAnonBoxes.h"
#include "nsStyleSet.h"

class nsAtom;
class nsPresContext;

namespace mozilla {
enum class CSSPseudoElementType : uint8_t;
class GeckoStyleContext;
class ServoStyleContext;
} // namespace mozilla

extern "C" {
  void Servo_StyleContext_AddRef(const mozilla::ServoStyleContext* aContext);
  void Servo_StyleContext_Release(const mozilla::ServoStyleContext* aContext);
}

/**
 * An nsStyleContext represents the computed style data for an element.
 * The computed style data are stored in a set of structs (see
 * nsStyleStruct.h) that are cached either on the style context or in
 * the rule tree (see nsRuleNode.h for a description of this caching and
 * how the cached structs are shared).
 *
 * Since the data in |nsIStyleRule|s and |nsRuleNode|s are immutable
 * (with a few exceptions, like system color changes), the data in an
 * nsStyleContext are also immutable (with the additional exception of
 * GetUniqueStyleData).  When style data change,
 * ElementRestyler::Restyle creates a new style context.
 *
 * Style contexts are reference counted.  References are generally held
 * by:
 *  1. the |nsIFrame|s that are using the style context and
 *  2. any *child* style contexts (this might be the reverse of
 *     expectation, but it makes sense in this case)
 */

class nsStyleContext
{
public:
#ifdef MOZ_STYLO
  bool IsGecko() const { return !IsServo(); }
  bool IsServo() const { return (mBits & NS_STYLE_CONTEXT_IS_GECKO) == 0; }
#else
  bool IsGecko() const { return true; }
  bool IsServo() const { return false; }
#endif
  MOZ_DECL_STYLO_CONVERT_METHODS(mozilla::GeckoStyleContext, mozilla::ServoStyleContext);

  // These two methods are for use by ArenaRefPtr.
  static mozilla::ArenaObjectID ArenaObjectID()
  {
    return mozilla::eArenaObjectID_GeckoStyleContext;
  }
  nsIPresShell* Arena();

  inline void AddRef();
  inline void Release();

#ifdef DEBUG
  void FrameAddRef();
  void FrameRelease();
#endif

  inline nsPresContext* PresContext() const;

  nsAtom* GetPseudo() const { return mPseudoTag; }
  mozilla::CSSPseudoElementType GetPseudoType() const {
    return static_cast<mozilla::CSSPseudoElementType>(
             mBits >> NS_STYLE_CONTEXT_TYPE_SHIFT);
  }

  bool IsInheritingAnonBox() const {
    return GetPseudoType() == mozilla::CSSPseudoElementType::InheritingAnonBox;
  }

  bool IsNonInheritingAnonBox() const {
    return GetPseudoType() == mozilla::CSSPseudoElementType::NonInheritingAnonBox;
  }

  // This function is rather slow; you probably don't want to use it outside
  // asserts unless you have to.  We _could_ add a new CSSPseudoElementType for
  // wrapper anon boxes, but that adds a bunch of complexity everywhere we
  // resolve anonymous box styles...
  bool IsWrapperAnonBox() const {
    return nsCSSAnonBoxes::IsWrapperAnonBox(GetPseudo());
  }

  bool IsAnonBox() const {
    return IsInheritingAnonBox() || IsNonInheritingAnonBox();
  }

  bool IsPseudoElement() const { return mPseudoTag && !IsAnonBox(); }


  // Does this style context or any of its ancestors have text
  // decoration lines?
  // Differs from nsStyleTextReset::HasTextDecorationLines, which tests
  // only the data for a single context.
  bool HasTextDecorationLines() const
    { return !!(mBits & NS_STYLE_HAS_TEXT_DECORATION_LINES); }

  // Whether any line break inside should be suppressed? If this returns
  // true, the line should not be broken inside, which means inlines act
  // as if nowrap is set, <br> is suppressed, and blocks are inlinized.
  // This bit is propogated to all children of line partitipants. It is
  // currently used by ruby to make its content frames unbreakable.
  // NOTE: for nsTextFrame, use nsTextFrame::ShouldSuppressLineBreak()
  // instead of this method.
  bool ShouldSuppressLineBreak() const
    { return !!(mBits & NS_STYLE_SUPPRESS_LINEBREAK); }

  // Does this style context or any of its ancestors have display:none set?
  bool IsInDisplayNoneSubtree() const
    { return !!(mBits & NS_STYLE_IN_DISPLAY_NONE_SUBTREE); }

  // Is this horizontal-in-vertical (tate-chu-yoko) text? This flag is
  // only set on style contexts whose pseudo is nsCSSAnonBoxes::mozText.
  bool IsTextCombined() const
    { return !!(mBits & NS_STYLE_IS_TEXT_COMBINED); }

  // Does this style context represent the style for a pseudo-element or
  // inherit data from such a style context?  Whether this returns true
  // is equivalent to whether it or any of its ancestors returns
  // non-null for IsPseudoElement().
  bool HasPseudoElementData() const
    { return !!(mBits & NS_STYLE_HAS_PSEUDO_ELEMENT_DATA); }

  bool HasChildThatUsesResetStyle() const
    { return mBits & NS_STYLE_HAS_CHILD_THAT_USES_RESET_STYLE; }

  // Is the only link whose visitedness is allowed to influence the
  // style of the node this style context is for (which is that element
  // or its nearest ancestor that is a link) visited?
  bool RelevantLinkVisited() const
    { return !!(mBits & NS_STYLE_RELEVANT_LINK_VISITED); }

  // Is this a style context for a link?
  inline bool IsLinkContext() const;

  // Is this style context the GetStyleIfVisited() for some other style
  // context?
  bool IsStyleIfVisited() const
    { return !!(mBits & NS_STYLE_IS_STYLE_IF_VISITED); }

  // Tells this style context that it should return true from
  // IsStyleIfVisited.
  void SetIsStyleIfVisited()
    { mBits |= NS_STYLE_IS_STYLE_IF_VISITED; }

  // Return the style context whose style data should be used for the R,
  // G, and B components of color, background-color, and border-*-color
  // if RelevantLinkIsVisited().
  //
  // GetPseudo() and GetPseudoType() on this style context return the
  // same as on |this|, and its depth in the tree (number of GetParent()
  // calls until null is returned) is the same as |this|, since its
  // parent is either |this|'s parent or |this|'s parent's
  // style-if-visited.
  //
  // Structs on this context should never be examined without also
  // examining the corresponding struct on |this|.  Doing so will likely
  // both (1) lead to a privacy leak and (2) lead to dynamic change bugs
  // related to the Peek code in nsStyleContext::CalcStyleDifference.
  inline nsStyleContext* GetStyleIfVisited() const;

  // Does any descendant of this style context have any style values
  // that were computed based on this style context's ancestors?
  bool HasChildThatUsesGrandancestorStyle() const
    { return !!(mBits & NS_STYLE_CHILD_USES_GRANDANCESTOR_STYLE); }

  // Is this style context shared with a sibling or cousin?
  // (See nsStyleSet::GetContext.)
  bool IsShared() const
    { return !!(mBits & NS_STYLE_IS_SHARED); }

  /**
   * Returns whether this style context has cached style data for a
   * given style struct and it does NOT own that struct.  This can
   * happen because it was inherited from the parent style context, or
   * because it was stored conditionally on the rule node.
   */
  bool HasCachedDependentStyleData(nsStyleStructID aSID) {
    return mBits & GetBitForSID(aSID);
  }

  inline nsRuleNode* RuleNode();
  inline const ServoComputedData* ComputedData();

  void AddStyleBit(const uint64_t& aBit) { mBits |= aBit; }

  /**
   * Define typesafe getter functions for each style struct by
   * preprocessing the list of style structs.  These functions are the
   * preferred way to get style data.  The macro creates functions like:
   *   const nsStyleBorder* StyleBorder();
   *   const nsStyleColor* StyleColor();
   */
  #define STYLE_STRUCT(name_, checkdata_cb_) \
    inline const nsStyle##name_ * Style##name_() MOZ_NONNULL_RETURN;
  #include "nsStyleStructList.h"
  #undef STYLE_STRUCT

  /**
   * Equivalent to StyleFoo(), except that we skip the cache write during the
   * servo traversal. This can cause incorrect behavior if used improperly,
   * since we won't record that layout potentially depends on the values in
   * this style struct. Use with care.
   */

  #define STYLE_STRUCT(name_, checkdata_cb_) \
    inline const nsStyle##name_ * ThreadsafeStyle##name_();
  #include "nsStyleStructList.h"
  #undef STYLE_STRUCT


  /**
   * PeekStyle* is like Style* but doesn't trigger style
   * computation if the data is not cached on either the style context
   * or the rule node.
   *
   * Perhaps this shouldn't be a public nsStyleContext API.
   */
  #define STYLE_STRUCT(name_, checkdata_cb_)  \
    inline const nsStyle##name_ * PeekStyle##name_();
  #include "nsStyleStructList.h"
  #undef STYLE_STRUCT

  /**
   * Compute the style changes needed during restyling when this style
   * context is being replaced by aNewContext.  (This is nonsymmetric since
   * we optimize by skipping comparison for styles that have never been
   * requested.)
   *
   * This method returns a change hint (see nsChangeHint.h).  All change
   * hints apply to the frame and its later continuations or ib-split
   * siblings.  Most (all of those except the "NotHandledForDescendants"
   * hints) also apply to all descendants.
   *
   * aEqualStructs must not be null.  Into it will be stored a bitfield
   * representing which structs were compared to be non-equal.
   *
   * aIgnoreVariables indicates whether to skip comparing the Variables
   * struct.  This must only be true for Servo style contexts.  When
   * true, the Variables bit in aEqualStructs will be set.
   */
  nsChangeHint CalcStyleDifference(nsStyleContext* aNewContext,
                                   uint32_t* aEqualStructs,
                                   uint32_t* aSamePointerStructs,
				   bool aIgnoreVariables = false);

public:
  /**
   * Get a color that depends on link-visitedness using this and
   * this->GetStyleIfVisited().
   *
   * @param aField A pointer to a member variable in a style struct.
   *               The member variable and its style struct must have
   *               been listed in nsCSSVisitedDependentPropList.h.
   */
  template<typename T, typename S>
  nscolor GetVisitedDependentColor(T S::* aField);

  /**
   * aColors should be a two element array of nscolor in which the first
   * color is the unvisited color and the second is the visited color.
   *
   * Combine the R, G, and B components of whichever of aColors should
   * be used based on aLinkIsVisited with the A component of aColors[0].
   */
  static nscolor CombineVisitedColors(nscolor *aColors,
                                      bool aLinkIsVisited);

  /**
   * Start the background image loads for this style context.
   */
  inline void StartBackgroundImageLoads();

  static bool IsReset(const nsStyleStructID aSID) {
    MOZ_ASSERT(0 <= aSID && aSID < nsStyleStructID_Length,
               "must be an inherited or reset SID");
    return nsStyleStructID_Reset_Start <= aSID;
  }
  static bool IsInherited(const nsStyleStructID aSID) { return !IsReset(aSID); }
  static uint32_t GetBitForSID(const nsStyleStructID aSID) { return 1 << aSID; }

#ifdef DEBUG
  void List(FILE* out, int32_t aIndent, bool aListDescendants = true);
  static const char* StructName(nsStyleStructID aSID);
  static bool LookupStruct(const nsACString& aName, nsStyleStructID& aResult);
#endif

protected:
  // protected destructor to discourage deletion outside of Release()
  ~nsStyleContext() {}

  // Delegated Helper constructor.
  nsStyleContext(nsAtom* aPseudoTag,
                 mozilla::CSSPseudoElementType aPseudoType);

  // Helper functions for GetStyle* and PeekStyle*
  #define STYLE_STRUCT_INHERITED(name_, checkdata_cb_)                  \
    template<bool aComputeData>                                         \
    const nsStyle##name_ * DoGetStyle##name_();
  #define STYLE_STRUCT_RESET(name_, checkdata_cb_)                      \
    template<bool aComputeData>                                         \
    const nsStyle##name_ * DoGetStyle##name_();

  #include "nsStyleStructList.h"
  #undef STYLE_STRUCT_RESET
  #undef STYLE_STRUCT_INHERITED

  // If this style context is for a pseudo-element or anonymous box,
  // the relevant atom.
  RefPtr<nsAtom> mPseudoTag;

  // mBits stores a number of things:
  //  - It records (using the style struct bits) which structs are
  //    inherited from the parent context or owned by the rule node (i.e.,
  //    not owned by the style context).
  //  - It also stores the additional bits listed at the top of
  //    nsStyleStruct.h.
  uint64_t                mBits;

#ifdef DEBUG
  static bool DependencyAllowed(nsStyleStructID aOuterSID,
                                nsStyleStructID aInnerSID)
  {
    return !!(sDependencyTable[aOuterSID] & GetBitForSID(aInnerSID));
  }

  static const uint32_t sDependencyTable[];
#endif
};

already_AddRefed<mozilla::GeckoStyleContext>
NS_NewStyleContext(mozilla::GeckoStyleContext* aParentContext,
                   nsAtom* aPseudoTag,
                   mozilla::CSSPseudoElementType aPseudoType,
                   nsRuleNode* aRuleNode,
                   bool aSkipParentDisplayBasedStyleFixup);

#endif
