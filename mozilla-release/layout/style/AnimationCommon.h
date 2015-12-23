/* vim: set shiftwidth=2 tabstop=8 autoindent cindent expandtab: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_css_AnimationCommon_h
#define mozilla_css_AnimationCommon_h

#include <algorithm> // For <std::stable_sort>
#include "nsIStyleRuleProcessor.h"
#include "nsIStyleRule.h"
#include "nsRefreshDriver.h"
#include "nsChangeHint.h"
#include "nsCSSProperty.h"
#include "nsDisplayList.h" // For nsDisplayItem::Type
#include "mozilla/AnimationComparator.h"
#include "mozilla/EventDispatcher.h"
#include "mozilla/LinkedList.h"
#include "mozilla/MemoryReporting.h"
#include "mozilla/StyleAnimationValue.h"
#include "mozilla/dom/Animation.h"
#include "mozilla/dom/Element.h"
#include "mozilla/dom/Nullable.h"
#include "nsStyleStruct.h"
#include "mozilla/Attributes.h"
#include "mozilla/Assertions.h"
#include "mozilla/FloatingPoint.h"
#include "nsContentUtils.h"
#include "nsCSSPseudoElements.h"
#include "nsCycleCollectionParticipant.h"
#include "nsCSSPropertySet.h"

class nsIFrame;
class nsPresContext;

namespace mozilla {

class RestyleTracker;
struct AnimationCollection;

bool IsGeometricProperty(nsCSSProperty aProperty);

class CommonAnimationManager : public nsIStyleRuleProcessor,
                               public nsARefreshObserver {
public:
  explicit CommonAnimationManager(nsPresContext *aPresContext);

  // nsIStyleRuleProcessor (parts)
  virtual nsRestyleHint HasStateDependentStyle(StateRuleProcessorData* aData) override;
  virtual nsRestyleHint HasStateDependentStyle(PseudoElementStateRuleProcessorData* aData) override;
  virtual bool HasDocumentStateDependentStyle(StateRuleProcessorData* aData) override;
  virtual nsRestyleHint
    HasAttributeDependentStyle(AttributeRuleProcessorData* aData,
                               RestyleHintData& aRestyleHintDataResult) override;
  virtual bool MediumFeaturesChanged(nsPresContext* aPresContext) override;
  virtual void RulesMatching(ElementRuleProcessorData* aData) override;
  virtual void RulesMatching(PseudoElementRuleProcessorData* aData) override;
  virtual void RulesMatching(AnonBoxRuleProcessorData* aData) override;
#ifdef MOZ_XUL
  virtual void RulesMatching(XULTreeRuleProcessorData* aData) override;
#endif
  virtual size_t SizeOfExcludingThis(MallocSizeOf aMallocSizeOf)
    const MOZ_MUST_OVERRIDE override;
  virtual size_t SizeOfIncludingThis(MallocSizeOf aMallocSizeOf)
    const MOZ_MUST_OVERRIDE override;

  // nsARefreshObserver
  void WillRefresh(TimeStamp aTime) override;

  // NOTE:  This can return null after Disconnect().
  nsPresContext* PresContext() const { return mPresContext; }

  /**
   * Notify the manager that the pres context is going away.
   */
  void Disconnect();

  // Tell the restyle tracker about all the styles that we're currently
  // animating, so that it can update the animation rule for these
  // elements.
  void AddStyleUpdatesTo(RestyleTracker& aTracker);

  AnimationCollection*
  GetAnimations(dom::Element *aElement,
                nsCSSPseudoElements::Type aPseudoType,
                bool aCreateIfNeeded);

  // Returns true if aContent or any of its ancestors has an animation
  // or transition.
  static bool ContentOrAncestorHasAnimation(nsIContent* aContent) {
    do {
      if (aContent->GetProperty(nsGkAtoms::animationsProperty) ||
          aContent->GetProperty(nsGkAtoms::transitionsProperty)) {
        return true;
      }
    } while ((aContent = aContent->GetParent()));

    return false;
  }

  // Requests a standard restyle on each managed AnimationCollection that has
  // an out-of-date mStyleRuleRefreshTime.
  void FlushAnimations();

  nsIStyleRule* GetAnimationRule(dom::Element* aElement,
                                 nsCSSPseudoElements::Type aPseudoType);

  static bool ExtractComputedValueForTransition(
                  nsCSSProperty aProperty,
                  nsStyleContext* aStyleContext,
                  StyleAnimationValue& aComputedValue);

  // For CSS properties that may be animated on a separate layer, represents
  // a record of the corresponding layer type and change hint.
  struct LayerAnimationRecord {
    nsCSSProperty mProperty;
    nsDisplayItem::Type mLayerType;
    nsChangeHint mChangeHint;
  };

protected:
  virtual ~CommonAnimationManager();

  // For ElementCollectionRemoved
  friend struct AnimationCollection;

  void AddElementCollection(AnimationCollection* aCollection);
  void ElementCollectionRemoved() { MaybeStartOrStopObservingRefreshDriver(); }
  void RemoveAllElementCollections();

  // We should normally only call MaybeStartOrStopObservingRefreshDriver in
  // situations where we will also queue events since otherwise we may stop
  // getting refresh driver ticks before we queue the necessary events.
  void MaybeStartObservingRefreshDriver();
  void MaybeStartOrStopObservingRefreshDriver();
  bool NeedsRefresh() const;

  virtual nsIAtom* GetAnimationsAtom() = 0;
  virtual nsIAtom* GetAnimationsBeforeAtom() = 0;
  virtual nsIAtom* GetAnimationsAfterAtom() = 0;

  virtual bool IsAnimationManager() {
    return false;
  }


public:
  // Return an AnimationCollection* if we have an animation for
  // the frame aFrame that can be performed on the compositor thread (as
  // defined by AnimationCollection::CanPerformOnCompositorThread).
  //
  // Note that this does not test whether the frame's layer uses
  // off-main-thread compositing, although it does check whether
  // off-main-thread compositing is enabled as a whole.
  AnimationCollection*
  GetAnimationsForCompositor(const nsIFrame* aFrame,
                             nsCSSProperty aProperty);

  // Given the frame aFrame with possibly animated content, finds its
  // associated collection of animations. If it is a generated content
  // frame, it may examine the parent frame to search for such animations.
  AnimationCollection*
  GetAnimationCollection(const nsIFrame* aFrame);

  void ClearIsRunningOnCompositor(const nsIFrame *aFrame,
                                  nsCSSProperty aProperty);
protected:
  LinkedList<AnimationCollection> mElementCollections;
  nsPresContext *mPresContext; // weak (non-null from ctor to Disconnect)
  bool mIsObservingRefreshDriver;
};

/**
 * A style rule that maps property-StyleAnimationValue pairs.
 */
class AnimValuesStyleRule final : public nsIStyleRule
{
public:
  // nsISupports implementation
  NS_DECL_ISUPPORTS

  // nsIStyleRule implementation
  virtual void MapRuleInfoInto(nsRuleData* aRuleData) override;
#ifdef DEBUG
  virtual void List(FILE* out = stdout, int32_t aIndent = 0) const override;
#endif

  void AddValue(nsCSSProperty aProperty, StyleAnimationValue &aStartValue)
  {
    PropertyValuePair v = { aProperty, aStartValue };
    mPropertyValuePairs.AppendElement(v);
  }

  // Caller must fill in returned value.
  StyleAnimationValue* AddEmptyValue(nsCSSProperty aProperty)
  {
    PropertyValuePair *p = mPropertyValuePairs.AppendElement();
    p->mProperty = aProperty;
    return &p->mValue;
  }

  struct PropertyValuePair {
    nsCSSProperty mProperty;
    StyleAnimationValue mValue;
  };

  void AddPropertiesToSet(nsCSSPropertySet& aSet) const
  {
    for (size_t i = 0, i_end = mPropertyValuePairs.Length(); i < i_end; ++i) {
      const PropertyValuePair &cv = mPropertyValuePairs[i];
      aSet.AddProperty(cv.mProperty);
    }
  }

private:
  ~AnimValuesStyleRule() {}

  InfallibleTArray<PropertyValuePair> mPropertyValuePairs;
};

typedef InfallibleTArray<nsRefPtr<dom::Animation>> AnimationPtrArray;

struct AnimationCollection : public LinkedListElement<AnimationCollection>
{
  AnimationCollection(dom::Element *aElement, nsIAtom *aElementProperty,
                      CommonAnimationManager *aManager)
    : mElement(aElement)
    , mElementProperty(aElementProperty)
    , mManager(aManager)
    , mAnimationGeneration(0)
    , mCheckGeneration(0)
    , mNeedsRefreshes(true)
    , mHasPendingAnimationRestyle(false)
#ifdef DEBUG
    , mCalledPropertyDtor(false)
#endif
  {
    MOZ_COUNT_CTOR(AnimationCollection);
  }
  ~AnimationCollection()
  {
    MOZ_ASSERT(mCalledPropertyDtor,
               "must call destructor through element property dtor");
    MOZ_COUNT_DTOR(AnimationCollection);
    remove();
    mManager->ElementCollectionRemoved();
  }

  void Destroy()
  {
    // This will call our destructor.
    mElement->DeleteProperty(mElementProperty);
  }

  static void PropertyDtor(void *aObject, nsIAtom *aPropertyName,
                           void *aPropertyValue, void *aData);

  void Tick();

  void EnsureStyleRuleFor(TimeStamp aRefreshTime);

  enum CanAnimateFlags {
    // Testing for width, height, top, right, bottom, or left.
    CanAnimate_HasGeometricProperty = 1,
    // Allow the case where OMTA is allowed in general, but not for the
    // specified property.
    CanAnimate_AllowPartial = 2
  };

  enum class RestyleType {
    // Animation style has changed but the compositor is applying the same
    // change so we might be able to defer updating the main thread until it
    // becomes necessary.
    Throttled,
    // Animation style has changed and needs to be updated on the main thread.
    Standard,
    // Animation style has changed and needs to be updated on the main thread
    // as well as forcing animations on layers to be updated.
    // This is needed in cases such as when an animation becomes paused or has
    // its playback rate changed. In such a case, although the computed style
    // and refresh driver time might not change, we still need to ensure the
    // corresponding animations on layers are updated to reflect the new
    // configuration of the animation.
    Layer
  };
  void RequestRestyle(RestyleType aRestyleType);
  void ClearIsRunningOnCompositor(nsCSSProperty aProperty);

private:
  static bool
  CanAnimatePropertyOnCompositor(const dom::Element *aElement,
                                 nsCSSProperty aProperty,
                                 CanAnimateFlags aFlags);

  bool CanThrottleAnimation(TimeStamp aTime);
  bool CanThrottleTransformChanges(TimeStamp aTime);

public:
  static bool IsCompositorAnimationDisabledForFrame(nsIFrame* aFrame);

  // True if this animation can be performed on the compositor thread.
  //
  // If aFlags contains CanAnimate_AllowPartial, returns whether the
  // state of this element's animations at the current refresh driver
  // time contains animation data that can be done on the compositor
  // thread.  (This is useful for determining whether a layer should be
  // active, or whether to send data to the layer.)
  //
  // If aFlags does not contain CanAnimate_AllowPartial, returns whether
  // the state of this element's animations at the current refresh driver
  // time can be fully represented by data sent to the compositor.
  // (This is useful for determining whether throttle the animation
  // (suppress main-thread style updates).)
  //
  // Note that this does not test whether the element's layer uses
  // off-main-thread compositing, although it does check whether
  // off-main-thread compositing is enabled as a whole.
  bool CanPerformOnCompositorThread(CanAnimateFlags aFlags) const;

  bool HasCurrentAnimationOfProperty(nsCSSProperty aProperty) const;

  bool IsForElement() const { // rather than for a pseudo-element
    return mElementProperty == nsGkAtoms::animationsProperty ||
           mElementProperty == nsGkAtoms::transitionsProperty;
  }

  bool IsForBeforePseudo() const {
    return mElementProperty == nsGkAtoms::animationsOfBeforeProperty ||
           mElementProperty == nsGkAtoms::transitionsOfBeforeProperty;
  }

  bool IsForAfterPseudo() const {
    return mElementProperty == nsGkAtoms::animationsOfAfterProperty ||
           mElementProperty == nsGkAtoms::transitionsOfAfterProperty;
  }

  bool IsForTransitions() const {
    return mElementProperty == nsGkAtoms::transitionsProperty ||
           mElementProperty == nsGkAtoms::transitionsOfBeforeProperty ||
           mElementProperty == nsGkAtoms::transitionsOfAfterProperty;
  }

  bool IsForAnimations() const {
    return mElementProperty == nsGkAtoms::animationsProperty ||
           mElementProperty == nsGkAtoms::animationsOfBeforeProperty ||
           mElementProperty == nsGkAtoms::animationsOfAfterProperty;
  }

  nsCSSPseudoElements::Type PseudoElementType() const
  {
    if (IsForElement()) {
      return nsCSSPseudoElements::ePseudo_NotPseudoElement;
    }
    if (IsForBeforePseudo()) {
      return nsCSSPseudoElements::ePseudo_before;
    }
    MOZ_ASSERT(IsForAfterPseudo(),
               "::before & ::after should be the only pseudo-elements here");
    return nsCSSPseudoElements::ePseudo_after;
  }

  static nsString PseudoTypeAsString(nsCSSPseudoElements::Type aPseudoType);

  dom::Element* GetElementToRestyle() const;

  void PostRestyleForAnimation(nsPresContext *aPresContext) {
    dom::Element* element = GetElementToRestyle();
    if (element) {
      nsRestyleHint hint = IsForTransitions() ? eRestyle_CSSTransitions
                                              : eRestyle_CSSAnimations;
      aPresContext->PresShell()->RestyleForAnimation(element, hint);
    }
  }

  static void LogAsyncAnimationFailure(nsCString& aMessage,
                                       const nsIContent* aContent = nullptr);

  dom::Element *mElement;

  // the atom we use in mElement's prop table (must be a static atom,
  // i.e., in an atom list)
  nsIAtom *mElementProperty;

  CommonAnimationManager *mManager;

  AnimationPtrArray mAnimations;

  // This style rule contains the style data for currently animating
  // values.  It only matches when styling with animation.  When we
  // style without animation, we need to not use it so that we can
  // detect any new changes; if necessary we restyle immediately
  // afterwards with animation.
  // NOTE: If we don't need to apply any styles, mStyleRule will be
  // null, but mStyleRuleRefreshTime will still be valid.
  nsRefPtr<AnimValuesStyleRule> mStyleRule;

  // RestyleManager keeps track of the number of animation
  // 'mini-flushes' (see nsTransitionManager::UpdateAllThrottledStyles()).
  // mAnimationGeneration is the sequence number of the last flush where a
  // transition/animation changed.  We keep a similar count on the
  // corresponding layer so we can check that the layer is up to date with
  // the animation manager.
  uint64_t mAnimationGeneration;
  // Update mAnimationGeneration to nsCSSFrameConstructor's count
  void UpdateAnimationGeneration(nsPresContext* aPresContext);

  // For CSS transitions only, we also record the most recent generation
  // for which we've done the transition update, so that we avoid doing
  // it more than once per style change.  This should be greater than or
  // equal to mAnimationGeneration, except when the generation counter
  // cycles, or when animations are updated through the DOM Animation
  // interfaces.
  uint64_t mCheckGeneration;
  // Update mAnimationGeneration to nsCSSFrameConstructor's count
  void UpdateCheckGeneration(nsPresContext* aPresContext);

  // Returns true if there is an animation that has yet to finish.
  bool HasCurrentAnimations() const;
  // Returns true if there is an animation of any of the specified properties
  // that has yet to finish.
  bool HasCurrentAnimationsForProperties(const nsCSSProperty* aProperties,
                                         size_t aPropertyCount) const;

  // The refresh time associated with mStyleRule.
  TimeStamp mStyleRuleRefreshTime;

  // False when we know that our current style rule is valid
  // indefinitely into the future (because all of our animations are
  // either completed or paused).  May be invalidated by a style change.
  bool mNeedsRefreshes;

private:
  // Whether or not we have already posted for animation restyle.
  // This is used to avoid making redundant requests and is reset each time
  // the animation restyle is performed.
  bool mHasPendingAnimationRestyle;

#ifdef DEBUG
  bool mCalledPropertyDtor;
#endif
};

/**
 * Utility class for referencing the element that created a CSS animation or
 * transition. It is non-owning (i.e. it uses a raw pointer) since it is only
 * expected to be set by the owned animation while it actually being managed
 * by the owning element.
 *
 * This class also abstracts the comparison of an element/pseudo-class pair
 * for the sake of composite ordering since this logic is common to both CSS
 * animations and transitions.
 *
 * (We call this OwningElementRef instead of just OwningElement so that we can
 * call the getter on CSSAnimation/CSSTransition OwningElement() without
 * clashing with this object's contructor.)
 */
class OwningElementRef final
{
public:
  OwningElementRef()
    : mElement(nullptr)
    , mPseudoType(nsCSSPseudoElements::ePseudo_NotPseudoElement)
  { }

  OwningElementRef(dom::Element& aElement,
                   nsCSSPseudoElements::Type aPseudoType)
    : mElement(&aElement)
    , mPseudoType(aPseudoType)
  { }

  bool Equals(const OwningElementRef& aOther) const
  {
    return mElement == aOther.mElement &&
           mPseudoType == aOther.mPseudoType;
  }

  bool LessThan(const OwningElementRef& aOther) const
  {
    MOZ_ASSERT(mElement && aOther.mElement,
               "Elements to compare should not be null");

    if (mElement != aOther.mElement) {
      return nsContentUtils::PositionIsBefore(mElement, aOther.mElement);
    }

    return mPseudoType == nsCSSPseudoElements::ePseudo_NotPseudoElement ||
          (mPseudoType == nsCSSPseudoElements::ePseudo_before &&
           aOther.mPseudoType == nsCSSPseudoElements::ePseudo_after);
  }

  bool IsSet() const { return !!mElement; }

  void GetElement(dom::Element*& aElement,
                  nsCSSPseudoElements::Type& aPseudoType) const {
    aElement = mElement;
    aPseudoType = mPseudoType;
  }

  nsPresContext* GetRenderedPresContext() const;

private:
  dom::Element* MOZ_NON_OWNING_REF mElement;
  nsCSSPseudoElements::Type        mPseudoType;
};

template <class EventInfo>
class DelayedEventDispatcher
{
public:
  DelayedEventDispatcher() : mIsSorted(true) { }

  void QueueEvent(EventInfo&& aEventInfo)
  {
    mPendingEvents.AppendElement(Forward<EventInfo>(aEventInfo));
    mIsSorted = false;
  }

  // This is exposed as a separate method so that when we are dispatching
  // *both* transition events and animation events we can sort both lists
  // once using the current state of the document before beginning any
  // dispatch.
  void SortEvents()
  {
    if (mIsSorted) {
      return;
    }

    // FIXME: Replace with mPendingEvents.StableSort when bug 1147091 is
    // fixed.
    std::stable_sort(mPendingEvents.begin(), mPendingEvents.end(),
                     EventInfoLessThan());
    mIsSorted = true;
  }

  // Takes a reference to the owning manager's pres context so it can
  // detect if the pres context is destroyed while dispatching one of
  // the events.
  //
  // This will call SortEvents automatically if it has not already been
  // called.
  void DispatchEvents(nsPresContext* const & aPresContext)
  {
    if (!aPresContext || mPendingEvents.IsEmpty()) {
      return;
    }

    SortEvents();

    EventArray events;
    mPendingEvents.SwapElements(events);
    // mIsSorted will be set to true by SortEvents above, and we leave it
    // that way since mPendingEvents is now empty
    for (EventInfo& info : events) {
      EventDispatcher::Dispatch(info.mElement, aPresContext, &info.mEvent);

      if (!aPresContext) {
        break;
      }
    }
  }

  void ClearEventQueue()
  {
    mPendingEvents.Clear();
    mIsSorted = true;
  }
  bool HasQueuedEvents() const { return !mPendingEvents.IsEmpty(); }

  // Methods for supporting cycle-collection
  void Traverse(nsCycleCollectionTraversalCallback* aCallback,
                const char* aName)
  {
    for (EventInfo& info : mPendingEvents) {
      ImplCycleCollectionTraverse(*aCallback, info.mElement, aName);
      ImplCycleCollectionTraverse(*aCallback, info.mAnimation, aName);
    }
  }
  void Unlink() { ClearEventQueue(); }

protected:
  class EventInfoLessThan
  {
  public:
    bool operator()(const EventInfo& a, const EventInfo& b) const
    {
      if (a.mTimeStamp != b.mTimeStamp) {
        // Null timestamps sort first
        if (a.mTimeStamp.IsNull() || b.mTimeStamp.IsNull()) {
          return a.mTimeStamp.IsNull();
        } else {
          return a.mTimeStamp < b.mTimeStamp;
        }
      }

      AnimationPtrComparator<nsRefPtr<dom::Animation>> comparator;
      return comparator.LessThan(a.mAnimation, b.mAnimation);
    }
  };

  typedef nsTArray<EventInfo> EventArray;
  EventArray mPendingEvents;
  bool mIsSorted;
};

template <class EventInfo>
inline void
ImplCycleCollectionUnlink(DelayedEventDispatcher<EventInfo>& aField)
{
  aField.Unlink();
}

template <class EventInfo>
inline void
ImplCycleCollectionTraverse(nsCycleCollectionTraversalCallback& aCallback,
                            DelayedEventDispatcher<EventInfo>& aField,
                            const char* aName,
                            uint32_t aFlags = 0)
{
  aField.Traverse(&aCallback, aName);
}

} // namespace mozilla

#endif /* !defined(mozilla_css_AnimationCommon_h) */
