/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef NSSVGEFFECTS_H_
#define NSSVGEFFECTS_H_

#include "mozilla/Attributes.h"
#include "mozilla/dom/IDTracker.h"
#include "FrameProperties.h"
#include "mozilla/dom/Element.h"
#include "nsHashKeys.h"
#include "nsID.h"
#include "nsIFrame.h"
#include "nsIMutationObserver.h"
#include "nsInterfaceHashtable.h"
#include "nsISupportsBase.h"
#include "nsISupportsImpl.h"
#include "nsStubMutationObserver.h"
#include "nsSVGUtils.h"
#include "nsTHashtable.h"
#include "nsURIHashKey.h"
#include "nsCycleCollectionParticipant.h"

class nsAtom;
class nsIPresShell;
class nsIURI;
class nsSVGClipPathFrame;
class nsSVGPaintServerFrame;
class nsSVGFilterFrame;
class nsSVGMaskFrame;
class nsSVGFilterChainObserver;

/*
 * This interface allows us to be notified when a piece of SVG content is
 * re-rendered.
 *
 * Concrete implementations of this interface need to implement
 * "GetTarget()" to specify the piece of SVG content that they'd like to
 * monitor, and they need to implement "OnRenderingChange" to specify how
 * we'll react when that content gets re-rendered. They also need to implement
 * a constructor and destructor, which should call StartObserving and
 * StopObserving, respectively.
 */
class nsSVGRenderingObserver : public nsStubMutationObserver
{

protected:
  virtual ~nsSVGRenderingObserver()
    {}

public:
  typedef mozilla::dom::Element Element;
  nsSVGRenderingObserver()
    : mInObserverList(false)
    {}

  // nsIMutationObserver
  NS_DECL_NSIMUTATIONOBSERVER_ATTRIBUTECHANGED
  NS_DECL_NSIMUTATIONOBSERVER_CONTENTAPPENDED
  NS_DECL_NSIMUTATIONOBSERVER_CONTENTINSERTED
  NS_DECL_NSIMUTATIONOBSERVER_CONTENTREMOVED

  /**
   * Called when non-DOM-mutation changes to the observed element should likely
   * cause the rendering of our observer to change.  This includes changes to
   * CSS computed values, but also changes to rendering observers that the
   * observed element itself may have (for example, when we're being used to
   * observe an SVG pattern, and an element in that pattern references and
   * observes a gradient that has changed).
   */
  void OnNonDOMMutationRenderingChange();

  // When a nsSVGRenderingObserver list gets forcibly cleared, it uses this
  // callback to notify every observer that's cleared from it, so they can
  // react.
  void NotifyEvictedFromRenderingObserverList();

  bool IsInObserverList() const { return mInObserverList; }

  nsIFrame* GetReferencedFrame();
  /**
   * @param aOK this is only for the convenience of callers. We set *aOK to false
   * if the frame is the wrong type
   */
  nsIFrame* GetReferencedFrame(mozilla::LayoutFrameType aFrameType, bool* aOK);

  Element* GetReferencedElement();

  virtual bool ObservesReflow() { return true; }

protected:
  void StartObserving();
  void StopObserving();

  /**
   * Called whenever the rendering of the observed element may have changed.
   *
   * More specifically, this method is called whenever DOM mutation occurs in
   * the observed element's subtree, or whenever
   * SVGObserverUtils::InvalidateRenderingObservers or
   * SVGObserverUtils::InvalidateDirectRenderingObservers is called for the
   * observed element's frame.
   *
   * Subclasses should override this method to handle rendering changes
   * appropriately.
   */
  virtual void OnRenderingChange() = 0;

  // This is an internally-used version of GetReferencedElement that doesn't
  // forcibly add us as an observer. (whereas GetReferencedElement does)
  virtual Element* GetTarget() = 0;

  // Whether we're in our referenced element's observer list at this time.
  bool mInObserverList;
};


/*
 * SVG elements reference supporting resources by element ID. We need to
 * track when those resources change and when the DOM changes in ways
 * that affect which element is referenced by a given ID (e.g., when
 * element IDs change). The code here is responsible for that.
 *
 * When a frame references a supporting resource, we create a property
 * object derived from nsSVGIDRenderingObserver to manage the relationship. The
 * property object is attached to the referencing frame.
 */
class nsSVGIDRenderingObserver : public nsSVGRenderingObserver
{
public:
  typedef mozilla::dom::Element Element;
  typedef mozilla::dom::IDTracker IDTracker;

  nsSVGIDRenderingObserver(nsIURI* aURI, nsIContent* aObservingContent,
                         bool aReferenceImage);
  virtual ~nsSVGIDRenderingObserver();

protected:
  Element* GetTarget() override { return mObservedElementTracker.get(); }

  void OnRenderingChange() override;

  /**
   * Helper that provides a reference to the element with the ID that our
   * observer wants to observe, and that will invalidate our observer if the
   * element that that ID identifies changes to a different element (or none).
   */
  class ElementTracker final : public IDTracker
  {
  public:
    explicit ElementTracker(nsSVGIDRenderingObserver* aOwningObserver)
      : mOwningObserver(aOwningObserver)
    {}
  protected:
    virtual void ElementChanged(Element* aFrom, Element* aTo) override {
      mOwningObserver->StopObserving(); // stop observing the old element
      IDTracker::ElementChanged(aFrom, aTo);
      mOwningObserver->StartObserving(); // start observing the new element
      mOwningObserver->OnRenderingChange();
    }
    /**
     * Override IsPersistent because we want to keep tracking the element
     * for the ID even when it changes.
     */
    virtual bool IsPersistent() override { return true; }
  private:
    nsSVGIDRenderingObserver* mOwningObserver;
  };

  ElementTracker mObservedElementTracker;
};

struct nsSVGFrameReferenceFromProperty
{
  explicit nsSVGFrameReferenceFromProperty(nsIFrame* aFrame)
    : mFrame(aFrame)
    , mFramePresShell(aFrame->PresShell())
  {}

  // Clear our reference to the frame.
  void Detach();

  // null if the frame has become invalid
  nsIFrame* Get();

private:
  // The frame that this property is attached to, may be null
  nsIFrame *mFrame;
  // When a presshell is torn down, we don't delete the properties for
  // each frame until after the frames are destroyed. So here we remember
  // the presshell for the frames we care about and, before we use the frame,
  // we test the presshell to see if it's destroying itself. If it is,
  // then the frame pointer is not valid and we know the frame has gone away.
  // mFramePresShell may be null, but when mFrame is non-null, mFramePresShell
  // is guaranteed to be non-null, too.
  nsIPresShell *mFramePresShell;
};

class nsSVGRenderingObserverProperty : public nsSVGIDRenderingObserver
{
public:
  NS_DECL_ISUPPORTS

  nsSVGRenderingObserverProperty(nsIURI* aURI, nsIFrame *aFrame,
                                 bool aReferenceImage)
    : nsSVGIDRenderingObserver(aURI, aFrame->GetContent(), aReferenceImage)
    , mFrameReference(aFrame)
  {}

protected:
  virtual ~nsSVGRenderingObserverProperty() {}

  virtual void OnRenderingChange() override;

  nsSVGFrameReferenceFromProperty mFrameReference;
};

/**
 * In a filter chain, there can be multiple SVG reference filters.
 * e.g. filter: url(#svg-filter-1) blur(10px) url(#svg-filter-2);
 *
 * This class keeps track of one SVG reference filter in a filter chain.
 * e.g. url(#svg-filter-1)
 *
 * It fires invalidations when the SVG filter element's id changes or when
 * the SVG filter element's content changes.
 *
 * The nsSVGFilterChainObserver class manages a list of nsSVGFilterReferences.
 */
class nsSVGFilterReference final : public nsSVGIDRenderingObserver
                                 , public nsISVGFilterReference
{
public:
  nsSVGFilterReference(nsIURI* aURI,
                       nsIContent* aObservingContent,
                       nsSVGFilterChainObserver* aFilterChainObserver)
    : nsSVGIDRenderingObserver(aURI, aObservingContent, false)
    , mFilterChainObserver(aFilterChainObserver)
  {
  }

  bool ReferencesValidResource() { return GetFilterFrame(); }

  void DetachFromChainObserver() { mFilterChainObserver = nullptr; }

  /**
   * @return the filter frame, or null if there is no filter frame
   */
  nsSVGFilterFrame *GetFilterFrame();

  // nsISupports
  NS_DECL_CYCLE_COLLECTING_ISUPPORTS
  NS_DECL_CYCLE_COLLECTION_CLASS_AMBIGUOUS(nsSVGFilterReference, nsSVGIDRenderingObserver)

  // nsISVGFilterReference
  virtual void Invalidate() override { OnRenderingChange(); };

protected:
  virtual ~nsSVGFilterReference() {}

  // nsSVGIDRenderingObserver
  virtual void OnRenderingChange() override;

private:
  nsSVGFilterChainObserver* mFilterChainObserver;
};

/**
 * This class manages a list of nsSVGFilterReferences, which represent SVG
 * reference filters in a filter chain.
 * e.g. filter: url(#svg-filter-1) blur(10px) url(#svg-filter-2);
 *
 * In the above example, the nsSVGFilterChainObserver will manage two
 * nsSVGFilterReferences, one for each SVG reference filter. CSS filters like
 * "blur(10px)" don't reference filter elements, so they don't need an
 * nsSVGFilterReference. The style system invalidates changes to CSS filters.
 */
class nsSVGFilterChainObserver : public nsISupports
{
public:
  nsSVGFilterChainObserver(const nsTArray<nsStyleFilter>& aFilters,
                           nsIContent* aFilteredElement,
                           nsIFrame* aFiltedFrame = nullptr);

  bool ReferencesValidResources();
  bool IsInObserverLists() const;
  void Invalidate() { OnRenderingChange(); }

  // nsISupports
  NS_DECL_CYCLE_COLLECTING_ISUPPORTS
  NS_DECL_CYCLE_COLLECTION_CLASS(nsSVGFilterChainObserver)

protected:
  virtual ~nsSVGFilterChainObserver();

  virtual void OnRenderingChange() = 0;

private:

  void DetachReferences()
  {
    for (uint32_t i = 0; i < mReferences.Length(); i++) {
      mReferences[i]->DetachFromChainObserver();
    }
  }

  nsTArray<RefPtr<nsSVGFilterReference>> mReferences;
};

class nsSVGFilterProperty : public nsSVGFilterChainObserver
{
public:
  nsSVGFilterProperty(const nsTArray<nsStyleFilter>& aFilters,
                      nsIFrame* aFilteredFrame)
    : nsSVGFilterChainObserver(aFilters, aFilteredFrame->GetContent(),
                               aFilteredFrame)
    , mFrameReference(aFilteredFrame)
  {}

  void DetachFromFrame() { mFrameReference.Detach(); }

protected:
  virtual void OnRenderingChange() override;

  nsSVGFrameReferenceFromProperty mFrameReference;
};

class nsSVGMarkerProperty final: public nsSVGRenderingObserverProperty
{
public:
  nsSVGMarkerProperty(nsIURI* aURI, nsIFrame* aFrame, bool aReferenceImage)
    : nsSVGRenderingObserverProperty(aURI, aFrame, aReferenceImage) {}

protected:
  virtual void OnRenderingChange() override;
};

class nsSVGTextPathProperty final : public nsSVGRenderingObserverProperty
{
public:
  nsSVGTextPathProperty(nsIURI* aURI, nsIFrame* aFrame, bool aReferenceImage)
    : nsSVGRenderingObserverProperty(aURI, aFrame, aReferenceImage)
    , mValid(true) {}

  virtual bool ObservesReflow() override { return false; }

protected:
  virtual void OnRenderingChange() override;

private:
  /**
   * Returns true if the target of the textPath is the frame of a 'path' element.
   */
  bool TargetIsValid();

  bool mValid;
};

class nsSVGPaintingProperty final : public nsSVGRenderingObserverProperty
{
public:
  nsSVGPaintingProperty(nsIURI* aURI, nsIFrame* aFrame, bool aReferenceImage)
    : nsSVGRenderingObserverProperty(aURI, aFrame, aReferenceImage) {}

protected:
  virtual void OnRenderingChange() override;
};

class nsSVGMaskProperty final : public nsISupports
{
public:
  explicit nsSVGMaskProperty(nsIFrame* aFrame);

  // nsISupports
  NS_DECL_ISUPPORTS

  const nsTArray<RefPtr<nsSVGPaintingProperty>>& GetProps() const
  {
    return mProperties;
  }

  void ResolveImage(uint32_t aIndex);

private:
  virtual ~nsSVGMaskProperty() {}
  nsTArray<RefPtr<nsSVGPaintingProperty>> mProperties;
  nsIFrame* mFrame;
};

/**
 * A manager for one-shot nsSVGRenderingObserver tracking.
 * nsSVGRenderingObservers can be added or removed. They are not strongly
 * referenced so an observer must be removed before it dies.
 * When InvalidateAll is called, all outstanding references get
 * OnNonDOMMutationRenderingChange()
 * called on them and the list is cleared. The intent is that
 * the observer will force repainting of whatever part of the document
 * is needed, and then at paint time the observer will do a clean lookup
 * of the referenced element and [re-]add itself to the element's observer list.
 *
 * InvalidateAll must be called before this object is destroyed, i.e.
 * before the referenced frame is destroyed. This should normally happen
 * via nsSVGContainerFrame::RemoveFrame, since only frames in the frame
 * tree should be referenced.
 */
class nsSVGRenderingObserverList
{
public:
  nsSVGRenderingObserverList()
    : mObservers(4)
  {
    MOZ_COUNT_CTOR(nsSVGRenderingObserverList);
  }

  ~nsSVGRenderingObserverList() {
    InvalidateAll();
    MOZ_COUNT_DTOR(nsSVGRenderingObserverList);
  }

  void Add(nsSVGRenderingObserver* aObserver)
  { mObservers.PutEntry(aObserver); }
  void Remove(nsSVGRenderingObserver* aObserver)
  { mObservers.RemoveEntry(aObserver); }
#ifdef DEBUG
  bool Contains(nsSVGRenderingObserver* aObserver)
  { return (mObservers.GetEntry(aObserver) != nullptr); }
#endif
  bool IsEmpty()
  { return mObservers.Count() == 0; }

  /**
   * Drop all our observers, and notify them that we have changed and dropped
   * our reference to them.
   */
  void InvalidateAll();

  /**
   * Drop all observers that observe reflow, and notify them that we have changed and dropped
   * our reference to them.
   */
  void InvalidateAllForReflow();

  /**
   * Drop all our observers, and notify them that we have dropped our reference
   * to them.
   */
  void RemoveAll();

private:
  nsTHashtable<nsPtrHashKey<nsSVGRenderingObserver> > mObservers;
};

class SVGObserverUtils
{
public:
  typedef mozilla::dom::Element Element;
  typedef nsInterfaceHashtable<nsURIHashKey, nsIMutationObserver>
    URIObserverHashtable;

  using PaintingPropertyDescriptor =
    const mozilla::FramePropertyDescriptor<nsSVGPaintingProperty>*;
  using URIObserverHashtablePropertyDescriptor =
    const mozilla::FramePropertyDescriptor<URIObserverHashtable>*;

  static void DestroyFilterProperty(nsSVGFilterProperty* aProp)
  {
    // nsSVGFilterProperty is cycle-collected, so dropping the last reference
    // doesn't necessarily destroy it. We need to tell it that the frame
    // has now become invalid.
    aProp->DetachFromFrame();

    aProp->Release();
  }

  NS_DECLARE_FRAME_PROPERTY_WITH_DTOR(FilterProperty, nsSVGFilterProperty,
                                      DestroyFilterProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(MaskProperty, nsSVGMaskProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(ClipPathProperty, nsSVGPaintingProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(MarkerBeginProperty, nsSVGMarkerProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(MarkerMiddleProperty, nsSVGMarkerProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(MarkerEndProperty, nsSVGMarkerProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(FillProperty, nsSVGPaintingProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(StrokeProperty, nsSVGPaintingProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(HrefAsTextPathProperty,
                                       nsSVGTextPathProperty)
  NS_DECLARE_FRAME_PROPERTY_RELEASABLE(HrefAsPaintingProperty,
                                       nsSVGPaintingProperty)
  NS_DECLARE_FRAME_PROPERTY_DELETABLE(BackgroundImageProperty,
                                      URIObserverHashtable)

  /**
   * Get the paint server for a aTargetFrame.
   */
  static nsSVGPaintServerFrame *GetPaintServer(nsIFrame* aTargetFrame,
                                               nsStyleSVGPaint nsStyleSVG::* aPaint,
                                               PaintingPropertyDescriptor aProperty);

  struct EffectProperties {
    nsSVGFilterProperty*   mFilter;
    nsSVGMaskProperty*     mMask;
    nsSVGPaintingProperty* mClipPath;

    /**
     * @return the clip-path frame, or null if there is no clip-path frame
     */
    nsSVGClipPathFrame* GetClipPathFrame();

    /**
     * @return an array which contains all SVG mask frames.
     */
    nsTArray<nsSVGMaskFrame*> GetMaskFrames();

    /*
     * @return true if all effects we have are valid or we have no effect
     * at all.
     */
    bool HasNoOrValidEffects();

    /*
     * @return true if we have any invalid effect.
     */
    bool HasInvalidEffects() {
      return !HasNoOrValidEffects();
    }

    /*
     * @return true if we either do not have clip-path or have a valid
     * clip-path.
     */
    bool HasNoOrValidClipPath();

    /*
     * @return true if we have an invalid clip-path.
     */
    bool HasInvalidClipPath() {
      return !HasNoOrValidClipPath();
    }

    /*
     * @return true if we either do not have mask or all masks we have
     * are valid.
     */
    bool HasNoOrValidMask();

    /*
     * @return true if we have an invalid mask.
     */
    bool HasInvalidMask() {
      return !HasNoOrValidMask();
    }

    bool HasValidFilter() {
      return mFilter && mFilter->ReferencesValidResources();
    }

    /*
     * @return true if we either do not have filter or all filters we have
     * are valid.
     */
    bool HasNoOrValidFilter() {
      return !mFilter || mFilter->ReferencesValidResources();
    }

    /*
     * @return true if we have an invalid filter.
     */
    bool HasInvalidFilter() {
      return !HasNoOrValidFilter();
    }
  };

  /**
   * @param aFrame should be the first continuation
   */
  static EffectProperties GetEffectProperties(nsIFrame* aFrame);

  /**
   * Called when changes to an element (e.g. CSS property changes) cause its
   * frame to start/stop referencing (or reference different) SVG resource
   * elements. (_Not_ called for changes to referenced resource elements.)
   *
   * This function handles such changes by discarding _all_ the frame's SVG
   * effects frame properties (causing those properties to stop watching their
   * target element). It also synchronously (re)creates the filter and marker
   * frame properties (XXX why not the other properties?), which makes it
   * useful for initializing those properties during first reflow.
   *
   * XXX rename to something more meaningful like RefreshResourceReferences?
   */
  static void UpdateEffects(nsIFrame* aFrame);

  /**
   * @param aFrame should be the first continuation
   */
  static nsSVGFilterProperty *GetFilterProperty(nsIFrame* aFrame);

  /**
   * @param aFrame must be a first-continuation.
   */
  static void AddRenderingObserver(Element* aElement, nsSVGRenderingObserver *aObserver);
  /**
   * @param aFrame must be a first-continuation.
   */
  static void RemoveRenderingObserver(Element* aElement, nsSVGRenderingObserver *aObserver);

  /**
   * Removes all rendering observers from aElement.
   */
  static void RemoveAllRenderingObservers(Element* aElement);

  /**
   * This can be called on any frame. We invalidate the observers of aFrame's
   * element, if any, or else walk up to the nearest observable SVG parent
   * frame with observers and invalidate them instead.
   *
   * Note that this method is very different to e.g.
   * nsNodeUtils::AttributeChanged which walks up the content node tree all the
   * way to the root node (not stopping if it encounters a non-container SVG
   * node) invalidating all mutation observers (not just
   * nsSVGRenderingObservers) on all nodes along the way (not just the first
   * node it finds with observers). In other words, by doing all the
   * things in parentheses in the preceding sentence, this method uses
   * knowledge about our implementation and what can be affected by SVG effects
   * to make invalidation relatively lightweight when an SVG effect changes.
   */
  static void InvalidateRenderingObservers(nsIFrame* aFrame);

  enum {
    INVALIDATE_REFLOW = 1
  };

  /**
   * This can be called on any element or frame. Only direct observers of this
   * (frame's) element, if any, are invalidated.
   */
  static void InvalidateDirectRenderingObservers(Element* aElement, uint32_t aFlags = 0);
  static void InvalidateDirectRenderingObservers(nsIFrame* aFrame, uint32_t aFlags = 0);

  /**
   * Get an nsSVGMarkerProperty for the frame, creating a fresh one if necessary
   */
  static nsSVGMarkerProperty *
  GetMarkerProperty(nsIURI* aURI, nsIFrame* aFrame,
    const mozilla::FramePropertyDescriptor<nsSVGMarkerProperty>* aProperty);
  /**
   * Get an nsSVGTextPathProperty for the frame, creating a fresh one if necessary
   */
  static nsSVGTextPathProperty *
  GetTextPathProperty(nsIURI* aURI, nsIFrame* aFrame,
    const mozilla::FramePropertyDescriptor<nsSVGTextPathProperty>* aProperty);
  /**
   * Get an nsSVGPaintingProperty for the frame, creating a fresh one if necessary
   */
  static nsSVGPaintingProperty*
  GetPaintingProperty(nsIURI* aURI, nsIFrame* aFrame,
      const mozilla::FramePropertyDescriptor<nsSVGPaintingProperty>* aProperty);
  /**
   * Get an nsSVGPaintingProperty for the frame for that URI, creating a fresh
   * one if necessary
   */
  static nsSVGPaintingProperty*
  GetPaintingPropertyForURI(nsIURI* aURI, nsIFrame* aFrame,
                            URIObserverHashtablePropertyDescriptor aProp);

  /**
   * A helper function to resolve marker's URL.
   */
  static already_AddRefed<nsIURI>
  GetMarkerURI(nsIFrame* aFrame,
               RefPtr<mozilla::css::URLValue> nsStyleSVG::* aMarker);

  /**
   * A helper function to resolve clip-path URL.
   */
  static already_AddRefed<nsIURI>
  GetClipPathURI(nsIFrame* aFrame);

  /**
   * A helper function to resolve filter URL.
   */
  static already_AddRefed<nsIURI>
  GetFilterURI(nsIFrame* aFrame, uint32_t aIndex);

  /**
   * A helper function to resolve filter URL.
   */
  static already_AddRefed<nsIURI>
  GetFilterURI(nsIFrame* aFrame, const nsStyleFilter& aFilter);

  /**
   * A helper function to resolve paint-server URL.
   */
  static already_AddRefed<nsIURI>
  GetPaintURI(nsIFrame* aFrame, nsStyleSVGPaint nsStyleSVG::* aPaint);

  /**
   * A helper function to resolve SVG mask URL.
   */
  static already_AddRefed<nsIURI>
  GetMaskURI(nsIFrame* aFrame, uint32_t aIndex);

  /**
   * Return a baseURL for resolving a local-ref URL.
   *
   * @param aContent an element which uses a local-ref property. Here are some
   *                 examples:
   *                   <rect fill=url(#foo)>
   *                   <circle clip-path=url(#foo)>
   *                   <use xlink:href="#foo">
   */
  static already_AddRefed<nsIURI>
  GetBaseURLForLocalRef(nsIContent* aContent, nsIURI* aDocURI);
};

#endif /*NSSVGEFFECTS_H_*/
