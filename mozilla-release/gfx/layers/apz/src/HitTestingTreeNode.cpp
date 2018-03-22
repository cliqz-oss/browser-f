/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "HitTestingTreeNode.h"

#include "AsyncPanZoomController.h"                     // for AsyncPanZoomController
#include "gfxPrefs.h"
#include "LayersLogging.h"                              // for Stringify
#include "mozilla/gfx/Point.h"                          // for Point4D
#include "mozilla/layers/APZThreadUtils.h"              // for AssertOnCompositorThread
#include "mozilla/layers/APZUtils.h"                    // for CompleteAsyncTransform
#include "mozilla/layers/AsyncCompositionManager.h"     // for ViewTransform::operator Matrix4x4()
#include "mozilla/layers/AsyncDragMetrics.h"            // for AsyncDragMetrics
#include "nsPrintfCString.h"                            // for nsPrintfCString
#include "UnitTransforms.h"                             // for ViewAs

namespace mozilla {
namespace layers {

using gfx::CompositorHitTestInfo;

HitTestingTreeNode::HitTestingTreeNode(AsyncPanZoomController* aApzc,
                                       bool aIsPrimaryHolder,
                                       uint64_t aLayersId)
  : mApzc(aApzc)
  , mIsPrimaryApzcHolder(aIsPrimaryHolder)
  , mLayersId(aLayersId)
  , mScrollViewId(FrameMetrics::NULL_SCROLL_ID)
  , mScrollbarAnimationId(0)
  , mFixedPosTarget(FrameMetrics::NULL_SCROLL_ID)
  , mOverride(EventRegionsOverride::NoOverride)
{
if (mIsPrimaryApzcHolder) {
    MOZ_ASSERT(mApzc);
  }
  MOZ_ASSERT(!mApzc || mApzc->GetLayersId() == mLayersId);
}

void
HitTestingTreeNode::RecycleWith(AsyncPanZoomController* aApzc,
                                uint64_t aLayersId)
{
  MOZ_ASSERT(!mIsPrimaryApzcHolder);
  Destroy(); // clear out tree pointers
  mApzc = aApzc;
  mLayersId = aLayersId;
  MOZ_ASSERT(!mApzc || mApzc->GetLayersId() == mLayersId);
  // The caller is expected to call SetHitTestData to repopulate the hit-test
  // fields.
}

HitTestingTreeNode::~HitTestingTreeNode()
{
}

void
HitTestingTreeNode::Destroy()
{
  APZThreadUtils::AssertOnCompositorThread();

  mPrevSibling = nullptr;
  mLastChild = nullptr;
  mParent = nullptr;

  if (mApzc) {
    if (mIsPrimaryApzcHolder) {
      mApzc->Destroy();
    }
    mApzc = nullptr;
  }

  mLayersId = 0;
}

void
HitTestingTreeNode::SetLastChild(HitTestingTreeNode* aChild)
{
  mLastChild = aChild;
  if (aChild) {
    aChild->mParent = this;

    if (aChild->GetApzc()) {
      AsyncPanZoomController* parent = GetNearestContainingApzc();
      // We assume that HitTestingTreeNodes with an ancestor/descendant
      // relationship cannot both point to the same APZC instance. This
      // assertion only covers a subset of cases in which that might occur,
      // but it's better than nothing.
      MOZ_ASSERT(aChild->GetApzc() != parent);
      aChild->SetApzcParent(parent);
    }
  }
}

void
HitTestingTreeNode::SetScrollbarData(FrameMetrics::ViewID aScrollViewId,
                                     const uint64_t& aScrollbarAnimationId,
                                     const ScrollThumbData& aThumbData,
                                     const Maybe<ScrollDirection>& aScrollContainerDirection)
{
  mScrollViewId = aScrollViewId;
  mScrollbarAnimationId = aScrollbarAnimationId;
  mScrollThumbData = aThumbData;
  mScrollbarContainerDirection = aScrollContainerDirection;
}

bool
HitTestingTreeNode::MatchesScrollDragMetrics(const AsyncDragMetrics& aDragMetrics) const
{
  return IsScrollThumbNode() &&
         mScrollThumbData.mDirection == aDragMetrics.mDirection &&
         mScrollViewId == aDragMetrics.mViewId;
}

bool
HitTestingTreeNode::IsScrollThumbNode() const
{
  return mScrollThumbData.mDirection.isSome();
}

bool
HitTestingTreeNode::IsScrollbarNode() const
{
  return mScrollbarContainerDirection.isSome() || IsScrollThumbNode();
}

ScrollDirection
HitTestingTreeNode::GetScrollbarDirection() const
{
  MOZ_ASSERT(IsScrollbarNode());
  if (mScrollThumbData.mDirection.isSome()) {
    return *(mScrollThumbData.mDirection);
  }
  return *mScrollbarContainerDirection;
}

FrameMetrics::ViewID
HitTestingTreeNode::GetScrollTargetId() const
{
  return mScrollViewId;
}

const uint64_t&
HitTestingTreeNode::GetScrollbarAnimationId() const
{
  return mScrollbarAnimationId;
}

const ScrollThumbData&
HitTestingTreeNode::GetScrollThumbData() const
{
  return mScrollThumbData;
}

void
HitTestingTreeNode::SetFixedPosData(FrameMetrics::ViewID aFixedPosTarget)
{
  mFixedPosTarget = aFixedPosTarget;
}

FrameMetrics::ViewID
HitTestingTreeNode::GetFixedPosTarget() const
{
  return mFixedPosTarget;
}

void
HitTestingTreeNode::SetPrevSibling(HitTestingTreeNode* aSibling)
{
  mPrevSibling = aSibling;
  if (aSibling) {
    aSibling->mParent = mParent;

    if (aSibling->GetApzc()) {
      AsyncPanZoomController* parent = mParent ? mParent->GetNearestContainingApzc() : nullptr;
      aSibling->SetApzcParent(parent);
    }
  }
}

void
HitTestingTreeNode::MakeRoot()
{
  mParent = nullptr;

  if (GetApzc()) {
    SetApzcParent(nullptr);
  }
}

HitTestingTreeNode*
HitTestingTreeNode::GetFirstChild() const
{
  HitTestingTreeNode* child = GetLastChild();
  while (child && child->GetPrevSibling()) {
    child = child->GetPrevSibling();
  }
  return child;
}

HitTestingTreeNode*
HitTestingTreeNode::GetLastChild() const
{
  return mLastChild;
}

HitTestingTreeNode*
HitTestingTreeNode::GetPrevSibling() const
{
  return mPrevSibling;
}

HitTestingTreeNode*
HitTestingTreeNode::GetParent() const
{
  return mParent;
}

bool
HitTestingTreeNode::IsAncestorOf(const HitTestingTreeNode* aOther) const
{
  for (const HitTestingTreeNode* cur = aOther; cur; cur = cur->GetParent()) {
    if (cur == this) {
      return true;
    }
  }
  return false;
}

AsyncPanZoomController*
HitTestingTreeNode::GetApzc() const
{
  return mApzc;
}

AsyncPanZoomController*
HitTestingTreeNode::GetNearestContainingApzc() const
{
  for (const HitTestingTreeNode* n = this; n; n = n->GetParent()) {
    if (n->GetApzc()) {
      return n->GetApzc();
    }
  }
  return nullptr;
}

bool
HitTestingTreeNode::IsPrimaryHolder() const
{
  return mIsPrimaryApzcHolder;
}

uint64_t
HitTestingTreeNode::GetLayersId() const
{
  return mLayersId;
}

void
HitTestingTreeNode::SetHitTestData(const EventRegions& aRegions,
                                   const LayerIntRegion& aVisibleRegion,
                                   const CSSTransformMatrix& aTransform,
                                   const Maybe<ParentLayerIntRegion>& aClipRegion,
                                   const EventRegionsOverride& aOverride)
{
  mEventRegions = aRegions;
  mVisibleRegion = aVisibleRegion;
  mTransform = aTransform;
  mClipRegion = aClipRegion;
  mOverride = aOverride;
}

bool
HitTestingTreeNode::IsOutsideClip(const ParentLayerPoint& aPoint) const
{
  // test against clip rect in ParentLayer coordinate space
  return (mClipRegion.isSome() && !mClipRegion->Contains(aPoint.x, aPoint.y));
}

Maybe<LayerPoint>
HitTestingTreeNode::Untransform(const ParentLayerPoint& aPoint,
                                const LayerToParentLayerMatrix4x4& aTransform) const
{
  Maybe<ParentLayerToLayerMatrix4x4> inverse = aTransform.MaybeInverse();
  if (inverse) {
    return UntransformBy(inverse.ref(), aPoint);
  }
  return Nothing();
}

CompositorHitTestInfo
HitTestingTreeNode::HitTest(const LayerPoint& aPoint) const
{
  CompositorHitTestInfo result = CompositorHitTestInfo::eInvisibleToHitTest;

  if (mOverride & EventRegionsOverride::ForceEmptyHitRegion) {
    return result;
  }

  auto point = LayerIntPoint::Round(aPoint);

  // test against event regions in Layer coordinate space
  if (!mEventRegions.mHitRegion.Contains(point.x, point.y)) {
    return result;
  }

  result |= CompositorHitTestInfo::eVisibleToHitTest;

  if ((mOverride & EventRegionsOverride::ForceDispatchToContent) ||
      mEventRegions.mDispatchToContentHitRegion.Contains(point.x, point.y))
  {
    result |= CompositorHitTestInfo::eDispatchToContent;
  } else if (gfxPrefs::TouchActionEnabled()) {
    if (mEventRegions.mNoActionRegion.Contains(point.x, point.y)) {
      // set all the touch-action flags as disabled
      result |= CompositorHitTestInfo::eTouchActionMask;
    } else {
      bool panX = mEventRegions.mHorizontalPanRegion.Contains(point.x, point.y);
      bool panY = mEventRegions.mVerticalPanRegion.Contains(point.x, point.y);
      if (panX && panY) {
        // touch-action: pan-x pan-y
        result |= CompositorHitTestInfo::eTouchActionDoubleTapZoomDisabled
                | CompositorHitTestInfo::eTouchActionPinchZoomDisabled;
      } else if (panX) {
        // touch-action: pan-x
        result |= CompositorHitTestInfo::eTouchActionPanYDisabled
                | CompositorHitTestInfo::eTouchActionPinchZoomDisabled
                | CompositorHitTestInfo::eTouchActionDoubleTapZoomDisabled;
      } else if (panY) {
        // touch-action: pan-y
        result |= CompositorHitTestInfo::eTouchActionPanXDisabled
                | CompositorHitTestInfo::eTouchActionPinchZoomDisabled
                | CompositorHitTestInfo::eTouchActionDoubleTapZoomDisabled;
      } // else we're in the touch-action: auto or touch-action: manipulation
        // cases and we'll allow all actions. Technically we shouldn't allow
        // double-tap zooming in the manipulation case but apparently this has
        // been broken since the dawn of time.
    }
  }

  // The scrollbar flags are set at the call site in GetAPZCAtPoint, because
  // those require walking up the tree to see if we are contained inside a
  // scrollbar or scrollthumb, and we do that there anyway to get the scrollbar
  // node.

  return result;
}

EventRegionsOverride
HitTestingTreeNode::GetEventRegionsOverride() const
{
  return mOverride;
}

const CSSTransformMatrix&
HitTestingTreeNode::GetTransform() const
{
  return mTransform;
}

const LayerIntRegion&
HitTestingTreeNode::GetVisibleRegion() const
{
  return mVisibleRegion;
}

void
HitTestingTreeNode::Dump(const char* aPrefix) const
{
  if (mPrevSibling) {
    mPrevSibling->Dump(aPrefix);
  }
  printf_stderr("%sHitTestingTreeNode (%p) APZC (%p) g=(%s) %s%s%sr=(%s) t=(%s) c=(%s)%s%s\n",
    aPrefix, this, mApzc.get(),
    mApzc ? Stringify(mApzc->GetGuid()).c_str() : nsPrintfCString("l=0x%" PRIx64, mLayersId).get(),
    (mOverride & EventRegionsOverride::ForceDispatchToContent) ? "fdtc " : "",
    (mOverride & EventRegionsOverride::ForceEmptyHitRegion) ? "fehr " : "",
    (mFixedPosTarget != FrameMetrics::NULL_SCROLL_ID) ? nsPrintfCString("fixed=%" PRIu64 " ", mFixedPosTarget).get() : "",
    Stringify(mEventRegions).c_str(), Stringify(mTransform).c_str(),
    mClipRegion ? Stringify(mClipRegion.ref()).c_str() : "none",
    mScrollbarContainerDirection.isSome() ? " scrollbar" : "",
    IsScrollThumbNode() ? " scrollthumb" : "");
  if (mLastChild) {
    mLastChild->Dump(nsPrintfCString("%s  ", aPrefix).get());
  }
}

void
HitTestingTreeNode::SetApzcParent(AsyncPanZoomController* aParent)
{
  // precondition: GetApzc() is non-null
  MOZ_ASSERT(GetApzc() != nullptr);
  if (IsPrimaryHolder()) {
    GetApzc()->SetParent(aParent);
  } else {
    MOZ_ASSERT(GetApzc()->GetParent() == aParent);
  }
}

} // namespace layers
} // namespace mozilla
