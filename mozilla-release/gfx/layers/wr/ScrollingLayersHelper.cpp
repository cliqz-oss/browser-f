/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/layers/ScrollingLayersHelper.h"

#include "DisplayItemClipChain.h"
#include "FrameMetrics.h"
#include "mozilla/layers/StackingContextHelper.h"
#include "mozilla/layers/WebRenderLayerManager.h"
#include "mozilla/webrender/WebRenderAPI.h"
#include "nsDisplayList.h"
#include "UnitTransforms.h"

#define SLH_LOG(...)
//#define SLH_LOG(...) printf_stderr("SLH: " __VA_ARGS__)
//#define SLH_LOG(...) if (XRE_IsContentProcess()) printf_stderr("SLH: " __VA_ARGS__)

namespace mozilla {
namespace layers {

ScrollingLayersHelper::ScrollingLayersHelper()
  : mManager(nullptr)
  , mBuilder(nullptr)
{
}

void
ScrollingLayersHelper::BeginBuild(WebRenderLayerManager* aManager,
                                  wr::DisplayListBuilder& aBuilder)
{
  MOZ_ASSERT(!mManager);
  mManager = aManager;
  MOZ_ASSERT(!mBuilder);
  mBuilder = &aBuilder;
  MOZ_ASSERT(mCacheStack.empty());
  mCacheStack.emplace_back();
  MOZ_ASSERT(mItemClipStack.empty());
}

void
ScrollingLayersHelper::EndBuild()
{
  mBuilder = nullptr;
  mManager = nullptr;
  mCacheStack.pop_back();
  MOZ_ASSERT(mCacheStack.empty());
  MOZ_ASSERT(mItemClipStack.empty());
}

void
ScrollingLayersHelper::BeginList(const StackingContextHelper& aStackingContext)
{
  if (aStackingContext.IsReferenceFrame()) {
    mCacheStack.emplace_back();
  }
  mItemClipStack.emplace_back(nullptr, nullptr);
}

void
ScrollingLayersHelper::EndList(const StackingContextHelper& aStackingContext)
{
  MOZ_ASSERT(!mItemClipStack.empty());
  mItemClipStack.back().Unapply(mBuilder);
  mItemClipStack.pop_back();
  if (aStackingContext.IsReferenceFrame()) {
    mCacheStack.pop_back();
  }
}

void
ScrollingLayersHelper::BeginItem(nsDisplayItem* aItem,
                                 const StackingContextHelper& aStackingContext)
{
  SLH_LOG("processing item %p\n", aItem);

  const DisplayItemClipChain* clip = aItem->GetClipChain();
  clip = ExtendChain(clip);

  ItemClips clips(aItem->GetActiveScrolledRoot(), clip);
  MOZ_ASSERT(!mItemClipStack.empty());
  if (clips.HasSameInputs(mItemClipStack.back())) {
    // Early-exit because if the clips are the same then we don't need to do
    // do the work of popping the old stuff and then pushing it right back on
    // for the new item.
    SLH_LOG("early-exit for %p\n", aItem);
    return;
  }
  mItemClipStack.back().Unapply(mBuilder);
  mItemClipStack.pop_back();

  int32_t auPerDevPixel = aItem->Frame()->PresContext()->AppUnitsPerDevPixel();

  // There are two ASR chains here that we need to be fully defined. One is the
  // ASR chain pointed to by aItem->GetActiveScrolledRoot(). The other is the
  // ASR chain pointed to by clip->mASR. We pick the leafmost
  // of these two chains because that one will include the other.
  // The leafmost clip is trivially going to be |clip|.
  // So we call DefineClipChain with these two leafmost things, and it will
  // recursively define all the clips and scroll layers with the appropriate
  // parents, but will not actually push anything onto the WR stack.
  const ActiveScrolledRoot* leafmostASR = aItem->GetActiveScrolledRoot();
  if (clip) {
    leafmostASR = ActiveScrolledRoot::PickDescendant(leafmostASR, clip->mASR);
  }
  auto ids = DefineClipChain(aItem, leafmostASR, clip,
      auPerDevPixel, aStackingContext);

  // Now that stuff is defined, we need to ensure the right items are on the
  // stack. We need this primarily for the WR display items that will be
  // generated while processing aItem. However those display items only care
  // about the topmost clip on the stack. If that were all we cared about we
  // would only need to push one thing here and we would be done. However, we
  // also care about the ScrollingLayersHelper instance that might be created
  // for nested display items, in the case where aItem is a wrapper item. The
  // nested ScrollingLayersHelper may rely on things like TopmostScrollId and
  // TopmostClipId, so now we need to push at most two things onto the stack.

  FrameMetrics::ViewID leafmostId = ids.first.valueOr(FrameMetrics::NULL_SCROLL_ID);
  FrameMetrics::ViewID scrollId = aItem->GetActiveScrolledRoot()
      ? aItem->GetActiveScrolledRoot()->GetViewId()
      : FrameMetrics::NULL_SCROLL_ID;
  // If the leafmost ASR is not the same as the item's ASR then we are dealing
  // with a case where the item's clip chain is scrolled by something other than
  // the item's ASR. So for those cases we need to use the ClipAndScroll API.
  bool needClipAndScroll = (leafmostId != scrollId);

  // The other scenario where we need to push a ClipAndScroll is when we are
  // in a nested display item where the enclosing item pushed a ClipAndScroll,
  // and our clip chain extends from that item's clip chain. To check this we
  // want to make sure that (a) we are inside a ClipAndScroll, and (b) nothing
  // else was pushed onto mBuilder's stack since that ClipAndScroll.
  if (!needClipAndScroll &&
      mBuilder->TopmostScrollId() == scrollId &&
      !mBuilder->TopmostIsClip()) {
    if (auto cs = EnclosingClipAndScroll()) {
      MOZ_ASSERT(cs->first == scrollId);
      needClipAndScroll = true;
    }
  }

  // If we don't need a ClipAndScroll, ensure the item's ASR is at the top of
  // the scroll stack
  if (!needClipAndScroll && mBuilder->TopmostScrollId() != scrollId) {
    MOZ_ASSERT(leafmostId == scrollId); // because !needClipAndScroll
    clips.mScrollId = Some(scrollId);
  }
  // And ensure the leafmost clip, if scrolled by that ASR, is at the top of the
  // stack.
  if (ids.second && clip->mASR == leafmostASR) {
    clips.mClipId = ids.second;
  }
  // If we need the ClipAndScroll, we want to replace the topmost scroll layer
  // with the item's ASR but preseve the topmost clip (which is scrolled by
  // some other ASR).
  if (needClipAndScroll) {
    // If mClipId is set that means we want to push it such that it's going
    // to be the TopmostClipId(), but we haven't actually pushed it yet.
    // But we still want to take that instead of the actual current TopmostClipId().
    Maybe<wr::WrClipId> clipId = clips.mClipId;
    if (!clipId) {
      clipId = mBuilder->TopmostClipId();
    }
    clips.mClipAndScroll = Some(std::make_pair(scrollId, clipId));
  }

  clips.Apply(mBuilder);
  mItemClipStack.push_back(clips);

  SLH_LOG("done setup for %p\n", aItem);
}

std::pair<Maybe<FrameMetrics::ViewID>, Maybe<wr::WrClipId>>
ScrollingLayersHelper::DefineClipChain(nsDisplayItem* aItem,
                                       const ActiveScrolledRoot* aAsr,
                                       const DisplayItemClipChain* aChain,
                                       int32_t aAppUnitsPerDevPixel,
                                       const StackingContextHelper& aStackingContext)
{
  // This is the main entry point for defining the clip chain for a display
  // item. This function recursively walks up the ASR chain and the display
  // item's clip chain to define all the ASRs and clips necessary. Each level
  // of the recursion defines one item, if it hasn't been defined already.
  // The |aAsr| and |aChain| parameters are the important ones to track during
  // the recursion; the rest of the parameters don't change.
  // At each level of the recursion, the return value is the pair of identifiers
  // that correspond to aAsr and aChain, respectively.

  // These are the possible cases when recursing:
  //
  // aAsr is null, aChain is null     => base case; return
  // aAsr is non-null, aChain is null => recurse(aAsr->mParent, null),
  //                                     then define aAsr
  // aAsr is null, aChain is non-null => assert(aChain->mASR == null),
  //                                     recurse(null, aChain->mParent),
  //                                     then define aChain
  // aChain->mASR == aAsr             => recurse(aAsr, aChain->mParent),
  //                                     then define aChain
  // aChain->mASR != aAsr             => recurse(aAsr->mParent, aChain),
  //                                     then define aAsr
  //
  // These can basically be collapsed down into two codepaths; one that recurses
  // on the ASR chain and one that recurses on the clip chain; that's what the
  // code below does.

  // in all of these cases, this invariant should hold:
  //   PickDescendant(aChain->mASR, aAsr) == aAsr
  MOZ_ASSERT(!aChain || ActiveScrolledRoot::PickDescendant(aChain->mASR, aAsr) == aAsr);

  if (aChain && aChain->mASR == aAsr) {
    return RecurseAndDefineClip(aItem, aAsr, aChain, aAppUnitsPerDevPixel, aStackingContext);
  }
  if (aAsr) {
    return RecurseAndDefineAsr(aItem, aAsr, aChain, aAppUnitsPerDevPixel, aStackingContext);
  }

  MOZ_ASSERT(!aChain && !aAsr);

  return std::make_pair(Nothing(), Nothing());
}

std::pair<Maybe<FrameMetrics::ViewID>, Maybe<wr::WrClipId>>
ScrollingLayersHelper::RecurseAndDefineClip(nsDisplayItem* aItem,
                                            const ActiveScrolledRoot* aAsr,
                                            const DisplayItemClipChain* aChain,
                                            int32_t aAppUnitsPerDevPixel,
                                            const StackingContextHelper& aSc)
{
  MOZ_ASSERT(aChain);

  // This will hold our return value
  std::pair<Maybe<FrameMetrics::ViewID>, Maybe<wr::WrClipId>> ids;

  if (mBuilder->HasExtraClip()) {
    // We can't use the clip cache directly. However if there's an out-of-band clip that
    // was pushed on top of aChain, we should return the id for that OOB clip,
    // so that anything we want to define as a descendant of aChain we actually
    // end up defining as a descendant of the OOB clip.
    ids.second = mBuilder->GetCacheOverride(aChain);
  } else {
    const ClipIdMap& cache = mCacheStack.back();
    auto it = cache.find(aChain);
    if (it != cache.end()) {
      ids.second = Some(it->second);
    }
  }
  if (ids.second) {
    // If we've already got an id for this clip, we can early-exit
    if (aAsr) {
      FrameMetrics::ViewID scrollId = aAsr->GetViewId();
      MOZ_ASSERT(mBuilder->IsScrollLayerDefined(scrollId));
      ids.first = Some(scrollId);
    }
    return ids;
  }

  // If not, recurse to ensure all the ancestors are defined
  auto ancestorIds = DefineClipChain(
      aItem, aAsr, aChain->mParent, aAppUnitsPerDevPixel, aSc);
  ids = ancestorIds;

  if (!aChain->mClip.HasClip()) {
    // This item in the chain is a no-op, skip over it
    return ids;
  }

  // Now we need to figure out whether the new clip we're defining should be
  // a child of aChain->mParent, or of aAsr.
  if (aChain->mParent) {
    if (mBuilder->GetCacheOverride(aChain->mParent)) {
      // If the parent clip had an override (i.e. the parent display item pushed
      // an out-of-band clip), then we definitely want to use that as the parent
      // because everything defined inside that clip should have it as an
      // ancestor.
      ancestorIds.first = Nothing();
    } else if (aChain->mParent->mASR == aAsr) {
      // If the parent clip item shares the ASR, then this clip needs to be
      // a child of the aChain->mParent, which will already be a descendant of
      // the ASR.
      ancestorIds.first = Nothing();
    } else {
      // But if the ASRs are different, this is the outermost clip that's
      // still inside aAsr, and we need to make it a child of aAsr rather
      // than aChain->mParent.
      ancestorIds.second = Nothing();
    }
  } else {
    MOZ_ASSERT(!ancestorIds.second);
    FrameMetrics::ViewID scrollId = aChain->mASR ? aChain->mASR->GetViewId() : FrameMetrics::NULL_SCROLL_ID;
    if (mBuilder->TopmostScrollId() == scrollId) {
      if (mBuilder->TopmostIsClip()) {
        // If aChain->mASR is already the topmost scroll layer on the stack, but
        // but there was another clip pushed *on top* of that ASR, then that clip
        // shares the ASR, and we need to make our clip a child of that clip, which
        // in turn will already be a descendant of the correct ASR.
        // This covers the cases where e.g. the Gecko display list has nested items,
        // and the clip chain on the nested item implicitly extends from the clip
        // chain on the containing wrapper item. In this case the aChain->mParent
        // pointer will be null for the nested item but the containing wrapper's
        // clip will be on the stack already and we can pick it up from there.
        // Another way of thinking about this is that if the clip chain were
        // "fully completed" then aChain->mParent wouldn't be null but would point
        // to the clip corresponding to mBuilder->TopmostClipId(), and we would
        // have gone into the |aChain->mParent->mASR == aAsr| branch above.
        ancestorIds.first = Nothing();
        ancestorIds.second = mBuilder->TopmostClipId();
      } else if (auto cs = EnclosingClipAndScroll()) {
        // If aChain->mASR is already the topmost scroll layer on the stack, but
        // it was pushed as part of a "clip and scroll" entry (i.e. because an
        // item had a clip scrolled by a different ASR than the item itself),
        // then we have need to propagate that behaviour as well. For example if
        // the enclosing display item pushed a ClipAndScroll with (scrollid=S,
        // clipid=C), then then clip we're defining here (call it D) needs to be
        // defined as a child of C, and we'll need to push the ClipAndScroll
        // (S, D) for this item. This hunk of code ensures that we define D
        // as a child of C, and when we set the needClipAndScroll flag elsewhere
        // in this file we make sure to set it for this scenario.
        MOZ_ASSERT(cs->first == scrollId);
        ancestorIds.first = Nothing();
        ancestorIds.second = cs->second;
      }
    }
  }
  // At most one of the ancestor pair should be defined here, and the one that
  // is defined will be the parent clip for the new clip that we're defining.
  MOZ_ASSERT(!(ancestorIds.first && ancestorIds.second));

  LayoutDeviceRect clip = LayoutDeviceRect::FromAppUnits(
      aChain->mClip.GetClipRect(), aAppUnitsPerDevPixel);
  nsTArray<wr::ComplexClipRegion> wrRoundedRects;
  aChain->mClip.ToComplexClipRegions(aAppUnitsPerDevPixel, aSc, wrRoundedRects);

  // Define the clip
  wr::WrClipId clipId = mBuilder->DefineClip(
      ancestorIds.first, ancestorIds.second,
      aSc.ToRelativeLayoutRect(clip), &wrRoundedRects);
  if (!mBuilder->HasExtraClip()) {
    mCacheStack.back()[aChain] = clipId;
  }

  ids.second = Some(clipId);
  return ids;
}

std::pair<Maybe<FrameMetrics::ViewID>, Maybe<wr::WrClipId>>
ScrollingLayersHelper::RecurseAndDefineAsr(nsDisplayItem* aItem,
                                           const ActiveScrolledRoot* aAsr,
                                           const DisplayItemClipChain* aChain,
                                           int32_t aAppUnitsPerDevPixel,
                                           const StackingContextHelper& aSc)
{
  MOZ_ASSERT(aAsr);

  // This will hold our return value
  std::pair<Maybe<FrameMetrics::ViewID>, Maybe<wr::WrClipId>> ids;

  FrameMetrics::ViewID scrollId = aAsr->GetViewId();
  if (mBuilder->IsScrollLayerDefined(scrollId)) {
    // If we've already defined this scroll layer before, we can early-exit
    ids.first = Some(scrollId);
    if (aChain) {
      if (mBuilder->HasExtraClip()) {
        ids.second = mBuilder->GetCacheOverride(aChain);
      } else {
        const ClipIdMap& cache = mCacheStack.back();
        auto it = cache.find(aChain);
        // If |it == cache.end()| here then we have run into a case where the
        // scroll layer was previously defined with a specific parent clip, and
        // now here it has a different parent clip. Gecko can create display
        // lists like this because it treats the ASR chain and clipping chain
        // more independently, but we can't yet represent this in WR. This is
        // tracked by bug 1409442. For now we'll just leave ids.second as
        // Nothing() which will effectively ignore the clip |aChain|. Once WR
        // supports multiple ancestors on a scroll layer we can deal with this
        // better. The layout/reftests/text/wordwrap-08.html has a Text display
        // item that exercises this case.
        if (it != cache.end()) {
          ids.second = Some(it->second);
        }
      }
    }
    return ids;
  }

  // If not, recurse to ensure all the ancestors are defined
  auto ancestorIds = DefineClipChain(
      aItem, aAsr->mParent, aChain, aAppUnitsPerDevPixel, aSc);
  ids = ancestorIds;

  // Ok to pass nullptr for aLayer here (first arg) because aClip (last arg) is
  // also nullptr.
  Maybe<ScrollMetadata> metadata = aAsr->mScrollableFrame->ComputeScrollMetadata(
      nullptr, mManager, aItem->ReferenceFrame(), ContainerLayerParameters(), nullptr);
  MOZ_ASSERT(metadata);
  FrameMetrics& metrics = metadata->GetMetrics();

  if (!metrics.IsScrollable()) {
    // This item in the chain is a no-op, skip over it
    return ids;
  }

  // Now we need to figure out whether the new clip we're defining should be
  // a child of aChain, or of aAsr->mParent, if we have both as a possibility.
  if (ancestorIds.first && ancestorIds.second) {
    MOZ_ASSERT(aAsr->mParent); // because ancestorIds.first
    MOZ_ASSERT(aChain); // because ancestorIds.second
    if (aChain->mASR && aChain->mASR == aAsr->mParent) {
      // aChain is scrolled by aAsr's parent, so we should use aChain as the
      // ancestor when defining the aAsr scroll layer.
      ancestorIds.first = Nothing();
    } else {
      // This scenario never seems to occur in practice, but if it did it would
      // mean that aChain is scrolled by one of aAsr's ancestors beyond the
      // parent, in which case we should use aAsr->mParent as the ancestor
      // when defining the aAsr scroll layer.
      ancestorIds.second = Nothing();
    }
  }
  // At most one of the ancestor pair should be defined here, and the one that
  // is defined will be the parent clip for the new scrollframe that we're
  // defining.
  MOZ_ASSERT(!(ancestorIds.first && ancestorIds.second));

  LayoutDeviceRect contentRect =
      metrics.GetExpandedScrollableRect() * metrics.GetDevPixelsPerCSSPixel();
  // TODO: check coordinate systems are sane here
  LayoutDeviceRect clipBounds =
      LayoutDeviceRect::FromUnknownRect(metrics.GetCompositionBounds().ToUnknownRect());
  // The content rect that we hand to PushScrollLayer should be relative to
  // the same origin as the clipBounds that we hand to PushScrollLayer - that
  // is, both of them should be relative to the stacking context `aSc`.
  // However, when we get the scrollable rect from the FrameMetrics, the origin
  // has nothing to do with the position of the frame but instead represents
  // the minimum allowed scroll offset of the scrollable content. While APZ
  // uses this to clamp the scroll position, we don't need to send this to
  // WebRender at all. Instead, we take the position from the composition
  // bounds.
  contentRect.MoveTo(clipBounds.TopLeft());

  mBuilder->DefineScrollLayer(scrollId, ancestorIds.first, ancestorIds.second,
      aSc.ToRelativeLayoutRect(contentRect),
      aSc.ToRelativeLayoutRect(clipBounds));

  ids.first = Some(scrollId);
  return ids;
}

const DisplayItemClipChain*
ScrollingLayersHelper::ExtendChain(const DisplayItemClipChain* aClip)
{
  // The intent of this function is to handle Gecko display list scenarios
  // like so:
  // nsDisplayFixedPosition with clip chain A -> B -> nullptr
  //   nsDisplayBackgroundColor with clip chain B -> nullptr
  //
  // The specific types are not relevant, but the important part is that there
  // is a display item whose clip chain is a subchain of the enclosing display
  // item.
  //
  // The semantics of the gecko display items means that the two clip chains
  // should be intersected for the child display item; because one clip chain
  // is a subset of the other the intersection comes out to be clip chain from
  // the parent.
  // However, WebRender doesn't let us (yet) intersect clip chains, so one of
  // the jobs of ScrollingLayersHelper is to generate as-good-as-possible clip
  // chains by merging the necessary clips into a new clip chain. In the example
  // above, we really want the nsDisplayBackgroundColor to use the clip chain
  // from A rather than from B in order to get the right clips, and this
  // function "extends" an input of |B| and returns |A|.

  if (!aClip) {
    return aClip;
  }
  // mItemClipStack has the clips that we pushed for ancestor display items.
  size_t clipDepth = mItemClipStack.size();
  MOZ_ASSERT(clipDepth > 0);
  while (--clipDepth > 0) {
    const DisplayItemClipChain* enclosingClip = mItemClipStack[clipDepth - 1].mChain;
    if (!enclosingClip) {
      // This is a special case; if an item has a nullptr clipchain it basically
      // inherits the clipchain from its ancestor, so let's skip to that.
      continue;
    }
    if (aClip == enclosingClip) {
      // The ancestor clip chain is the same as our item's clip chain, so
      // we're done. Note that because this function will have run on the
      // ancestor as well, we can be assured via induction that there is no
      // ancestor beyond this one that has a longer superset-clipchain.
      return aClip;
    }
    const ClipIdMap& cache = mCacheStack.back();
    if (cache.find(enclosingClip) == cache.end()) {
      // The ancestor clip chain isn't in our clip cache, which means there
      // must be a reference frame between the ancestor item and this item.
      // Therefore we cannot use the enclosing clip, so let's abort
      return aClip;
    }
    for (const DisplayItemClipChain* i = enclosingClip->mParent; i; i = i->mParent) {
      if (i == aClip) {
        // aClip is contained inside the enclosingClip clipchain. Since the
        // enclosingClip also applies to the item we're currently processing,
        // we should use that as it is a better approximation to the real clip
        // set that applies to the item.
        SLH_LOG("extending clip %p to %p\n", aClip, enclosingClip);
        return enclosingClip;
      }
    }
    break;
  }
  return aClip;
}

Maybe<ScrollingLayersHelper::ClipAndScroll>
ScrollingLayersHelper::EnclosingClipAndScroll() const
{
  for (auto it = mItemClipStack.rbegin(); it != mItemClipStack.rend(); it++) {
    if (it->mClipAndScroll) {
      return it->mClipAndScroll;
    }
    // If an entry in the stack pushed a single clip or scroll without pushing
    // a mClipAndScroll, we abort because we are effectively no longer inside
    // a ClipAndScroll
    if (it->mClipId || it->mScrollId) {
      break;
    }
  }
  return Nothing();
}

ScrollingLayersHelper::~ScrollingLayersHelper()
{
  MOZ_ASSERT(!mBuilder);
  MOZ_ASSERT(mCacheStack.empty());
  MOZ_ASSERT(mItemClipStack.empty());
}

ScrollingLayersHelper::ItemClips::ItemClips(const ActiveScrolledRoot* aAsr,
                                            const DisplayItemClipChain* aChain)
  : mAsr(aAsr)
  , mChain(aChain)
{
}

void
ScrollingLayersHelper::ItemClips::Apply(wr::DisplayListBuilder* aBuilder)
{
  if (mScrollId) {
    aBuilder->PushScrollLayer(mScrollId.ref());
  }
  if (mClipId) {
    aBuilder->PushClip(mClipId.ref());
  }
  if (mClipAndScroll) {
    aBuilder->PushClipAndScrollInfo(mClipAndScroll->first,
                                    mClipAndScroll->second.ptrOr(nullptr));
  }
}

void
ScrollingLayersHelper::ItemClips::Unapply(wr::DisplayListBuilder* aBuilder)
{
  if (mClipAndScroll) {
    aBuilder->PopClipAndScrollInfo();
  }
  if (mClipId) {
    aBuilder->PopClip();
  }
  if (mScrollId) {
    aBuilder->PopScrollLayer();
  }
}

bool
ScrollingLayersHelper::ItemClips::HasSameInputs(const ItemClips& aOther)
{
  return mAsr == aOther.mAsr &&
         mChain == aOther.mChain;
}

} // namespace layers
} // namespace mozilla
