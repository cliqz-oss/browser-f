/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "MediaEngineCameraVideoSource.h"

#include "mozilla/IntegerPrintfMacros.h"

#include <limits>

namespace mozilla {

using namespace mozilla::gfx;
using namespace mozilla::dom;

extern LogModule* GetMediaManagerLog();
#define LOG(msg) MOZ_LOG(GetMediaManagerLog(), mozilla::LogLevel::Debug, msg)
#define LOGFRAME(msg) MOZ_LOG(GetMediaManagerLog(), mozilla::LogLevel::Verbose, msg)

// guts for appending data to the MSG track
bool MediaEngineCameraVideoSource::AppendToTrack(SourceMediaStream* aSource,
                                                 layers::Image* aImage,
                                                 TrackID aID,
                                                 StreamTime delta,
                                                 const PrincipalHandle& aPrincipalHandle)
{
  MOZ_ASSERT(aSource);

  VideoSegment segment;
  RefPtr<layers::Image> image = aImage;
  IntSize size = image ? image->GetSize() : IntSize(0, 0);

  segment.AppendFrame(image.forget(), delta, size, aPrincipalHandle);

  // This is safe from any thread, and is safe if the track is Finished
  // or Destroyed.
  // This can fail if either a) we haven't added the track yet, or b)
  // we've removed or finished the track.
  return aSource->AppendToTrack(aID, &(segment));
}

// Sub-classes (B2G or desktop) should overload one of both of these two methods
// to provide capabilities
size_t
MediaEngineCameraVideoSource::NumCapabilities() const
{
  return mHardcodedCapabilities.Length();
}

webrtc::CaptureCapability
MediaEngineCameraVideoSource::GetCapability(size_t aIndex) const
{
  MOZ_ASSERT(aIndex < mHardcodedCapabilities.Length());
  return mHardcodedCapabilities.SafeElementAt(aIndex, webrtc::CaptureCapability());
}

uint32_t
MediaEngineCameraVideoSource::GetDistance(
    const webrtc::CaptureCapability& aCandidate,
    const NormalizedConstraintSet &aConstraints,
    const nsString& aDeviceId,
    const DistanceCalculation aCalculate) const
{
  if (aCalculate == kFeasibility) {
    return GetFeasibilityDistance(aCandidate, aConstraints, aDeviceId);
  }
  return GetFitnessDistance(aCandidate, aConstraints, aDeviceId);
}

uint32_t
MediaEngineCameraVideoSource::GetFitnessDistance(
    const webrtc::CaptureCapability& aCandidate,
    const NormalizedConstraintSet &aConstraints,
    const nsString& aDeviceId) const
{
  // Treat width|height|frameRate == 0 on capability as "can do any".
  // This allows for orthogonal capabilities that are not in discrete steps.

  uint64_t distance =
    uint64_t(FitnessDistance(aDeviceId, aConstraints.mDeviceId)) +
    uint64_t(FitnessDistance(mFacingMode, aConstraints.mFacingMode)) +
    uint64_t(aCandidate.width? FitnessDistance(int32_t(aCandidate.width),
                                               aConstraints.mWidth) : 0) +
    uint64_t(aCandidate.height? FitnessDistance(int32_t(aCandidate.height),
                                                aConstraints.mHeight) : 0) +
    uint64_t(aCandidate.maxFPS? FitnessDistance(double(aCandidate.maxFPS),
                                                aConstraints.mFrameRate) : 0);
  return uint32_t(std::min(distance, uint64_t(UINT32_MAX)));
}

uint32_t
MediaEngineCameraVideoSource::GetFeasibilityDistance(
    const webrtc::CaptureCapability& aCandidate,
    const NormalizedConstraintSet &aConstraints,
    const nsString& aDeviceId) const
{
  // Treat width|height|frameRate == 0 on capability as "can do any".
  // This allows for orthogonal capabilities that are not in discrete steps.

  uint64_t distance =
    uint64_t(FitnessDistance(aDeviceId, aConstraints.mDeviceId)) +
    uint64_t(FitnessDistance(mFacingMode, aConstraints.mFacingMode)) +
    uint64_t(aCandidate.width? FeasibilityDistance(int32_t(aCandidate.width),
                                               aConstraints.mWidth) : 0) +
    uint64_t(aCandidate.height? FeasibilityDistance(int32_t(aCandidate.height),
                                                aConstraints.mHeight) : 0) +
    uint64_t(aCandidate.maxFPS? FeasibilityDistance(double(aCandidate.maxFPS),
                                                aConstraints.mFrameRate) : 0);
  return uint32_t(std::min(distance, uint64_t(UINT32_MAX)));
}

// Find best capability by removing inferiors. May leave >1 of equal distance

/* static */ void
MediaEngineCameraVideoSource::TrimLessFitCandidates(nsTArray<CapabilityCandidate>& aSet) {
  uint32_t best = UINT32_MAX;
  for (auto& candidate : aSet) {
    if (best > candidate.mDistance) {
      best = candidate.mDistance;
    }
  }
  for (size_t i = 0; i < aSet.Length();) {
    if (aSet[i].mDistance > best) {
      aSet.RemoveElementAt(i);
    } else {
      ++i;
    }
  }
  MOZ_ASSERT(aSet.Length());
}

// GetBestFitnessDistance returns the best distance the capture device can offer
// as a whole, given an accumulated number of ConstraintSets.
// Ideal values are considered in the first ConstraintSet only.
// Plain values are treated as Ideal in the first ConstraintSet.
// Plain values are treated as Exact in subsequent ConstraintSets.
// Infinity = UINT32_MAX e.g. device cannot satisfy accumulated ConstraintSets.
// A finite result may be used to calculate this device's ranking as a choice.

uint32_t
MediaEngineCameraVideoSource::GetBestFitnessDistance(
    const nsTArray<const NormalizedConstraintSet*>& aConstraintSets,
    const nsString& aDeviceId) const
{
  size_t num = NumCapabilities();
  nsTArray<CapabilityCandidate> candidateSet;
  for (size_t i = 0; i < num; i++) {
    candidateSet.AppendElement(CapabilityCandidate(GetCapability(i)));
  }

  bool first = true;
  for (const NormalizedConstraintSet* ns : aConstraintSets) {
    for (size_t i = 0; i < candidateSet.Length();  ) {
      auto& candidate = candidateSet[i];
      uint32_t distance =
        GetFitnessDistance(candidate.mCapability, *ns, aDeviceId);
      if (distance == UINT32_MAX) {
        candidateSet.RemoveElementAt(i);
      } else {
        ++i;
        if (first) {
          candidate.mDistance = distance;
        }
      }
    }
    first = false;
  }
  if (!candidateSet.Length()) {
    return UINT32_MAX;
  }
  TrimLessFitCandidates(candidateSet);
  return candidateSet[0].mDistance;
}

void
MediaEngineCameraVideoSource::LogConstraints(
    const NormalizedConstraintSet& aConstraints)
{
  auto& c = aConstraints;
  if (c.mWidth.mIdeal.isSome()) {
    LOG(("Constraints: width: { min: %d, max: %d, ideal: %d }",
         c.mWidth.mMin, c.mWidth.mMax,
         c.mWidth.mIdeal.valueOr(0)));
  } else {
    LOG(("Constraints: width: { min: %d, max: %d }",
         c.mWidth.mMin, c.mWidth.mMax));
  }
  if (c.mHeight.mIdeal.isSome()) {
    LOG(("             height: { min: %d, max: %d, ideal: %d }",
         c.mHeight.mMin, c.mHeight.mMax,
         c.mHeight.mIdeal.valueOr(0)));
  } else {
    LOG(("             height: { min: %d, max: %d }",
         c.mHeight.mMin, c.mHeight.mMax));
  }
  if (c.mFrameRate.mIdeal.isSome()) {
    LOG(("             frameRate: { min: %f, max: %f, ideal: %f }",
         c.mFrameRate.mMin, c.mFrameRate.mMax,
         c.mFrameRate.mIdeal.valueOr(0)));
  } else {
    LOG(("             frameRate: { min: %f, max: %f }",
         c.mFrameRate.mMin, c.mFrameRate.mMax));
  }
}

void
MediaEngineCameraVideoSource::LogCapability(const char* aHeader,
    const webrtc::CaptureCapability &aCapability, uint32_t aDistance)
{
  // RawVideoType and VideoCodecType media/webrtc/trunk/webrtc/common_types.h
  static const char* const types[] = {
    "I420",
    "YV12",
    "YUY2",
    "UYVY",
    "IYUV",
    "ARGB",
    "RGB24",
    "RGB565",
    "ARGB4444",
    "ARGB1555",
    "MJPEG",
    "NV12",
    "NV21",
    "BGRA",
    "Unknown type"
  };

  static const char* const codec[] = {
    "VP8",
    "VP9",
    "H264",
    "I420",
    "RED",
    "ULPFEC",
    "Generic codec",
    "Unknown codec"
  };

  LOG(("%s: %4u x %4u x %2u maxFps, %s, %s. Distance = %" PRIu32,
       aHeader, aCapability.width, aCapability.height, aCapability.maxFPS,
       types[std::min(std::max(uint32_t(0), uint32_t(aCapability.rawType)),
                      uint32_t(sizeof(types) / sizeof(*types) - 1))],
       codec[std::min(std::max(uint32_t(0), uint32_t(aCapability.codecType)),
                      uint32_t(sizeof(codec) / sizeof(*codec) - 1))],
       aDistance));
}

bool
MediaEngineCameraVideoSource::ChooseCapability(
    const NormalizedConstraints &aConstraints,
    const MediaEnginePrefs &aPrefs,
    const nsString& aDeviceId,
    webrtc::CaptureCapability& aCapability,
    const DistanceCalculation aCalculate)
{
  if (MOZ_LOG_TEST(GetMediaManagerLog(), LogLevel::Debug)) {
    LOG(("ChooseCapability: prefs: %dx%d @%dfps",
         aPrefs.GetWidth(), aPrefs.GetHeight(),
         aPrefs.mFPS));
    LogConstraints(aConstraints);
    if (!aConstraints.mAdvanced.empty()) {
      LOG(("Advanced array[%zu]:", aConstraints.mAdvanced.size()));
      for (auto& advanced : aConstraints.mAdvanced) {
        LogConstraints(advanced);
      }
    }
  }

  nsTArray<CapabilityCandidate> candidateSet;
  size_t num = NumCapabilities();
  for (size_t i = 0; i < num; i++) {
    candidateSet.AppendElement(CapabilityCandidate(GetCapability(i)));
  }

  if (!mHardcodedCapabilities.IsEmpty() &&
      GetMediaSource() == MediaSourceEnum::Camera) {
    // We have a hardcoded capability, which means this camera didn't report
    // discrete capabilities. It might still allow a ranged capability, so we
    // add a couple of default candidates based on prefs and constraints.
    // The chosen candidate will be propagated to StartCapture() which will fail
    // for an invalid candidate.
    MOZ_DIAGNOSTIC_ASSERT(mHardcodedCapabilities.Length() == 1);
    MOZ_DIAGNOSTIC_ASSERT(candidateSet.Length() == 1);
    candidateSet.Clear();

    FlattenedConstraints c(aConstraints);
    // Reuse the code across both the low-definition (`false`) pref and
    // the high-definition (`true`) pref.
    // If there are constraints we try to satisfy them but we default to prefs.
    // Note that since constraints are from content and can literally be
    // anything we put (rather generous) caps on them.
    for (bool isHd : {false, true}) {
      webrtc::CaptureCapability cap;
      int32_t prefWidth = aPrefs.GetWidth(isHd);
      int32_t prefHeight = aPrefs.GetHeight(isHd);

      cap.width = c.mWidth.Get(prefWidth);
      cap.width = std::max(0, std::min(cap.width, 7680));

      cap.height = c.mHeight.Get(prefHeight);
      cap.height = std::max(0, std::min(cap.height, 4320));

      cap.maxFPS = c.mFrameRate.Get(aPrefs.mFPS);
      cap.maxFPS = std::max(0, std::min(cap.maxFPS, 480));

      if (cap.width != prefWidth) {
        // Width was affected by constraints.
        // We'll adjust the height too so the aspect ratio is retained.
        cap.height = cap.width * prefHeight / prefWidth;
      } else if (cap.height != prefHeight) {
        // Height was affected by constraints but not width.
        // We'll adjust the width too so the aspect ratio is retained.
        cap.width = cap.height * prefWidth / prefHeight;
      }

      if (candidateSet.Contains(cap, CapabilityComparator())) {
        continue;
      }
      LogCapability("Hardcoded capability", cap, 0);
      candidateSet.AppendElement(CapabilityCandidate(Move(cap)));
    }
  }

  // First, filter capabilities by required constraints (min, max, exact).

  for (size_t i = 0; i < candidateSet.Length();) {
    auto& candidate = candidateSet[i];
    candidate.mDistance =
      GetDistance(candidate.mCapability, aConstraints, aDeviceId, aCalculate);
    LogCapability("Capability", candidate.mCapability, candidate.mDistance);
    if (candidate.mDistance == UINT32_MAX) {
      candidateSet.RemoveElementAt(i);
    } else {
      ++i;
    }
  }

  if (candidateSet.IsEmpty()) {
    LOG(("failed to find capability match from %zu choices", candidateSet.Length()));
    return false;
  }

  // Filter further with all advanced constraints (that don't overconstrain).

  for (const auto &cs : aConstraints.mAdvanced) {
    nsTArray<CapabilityCandidate> rejects;
    for (size_t i = 0; i < candidateSet.Length();) {
      if (GetDistance(candidateSet[i].mCapability,
                      cs, aDeviceId, aCalculate) == UINT32_MAX) {
        rejects.AppendElement(candidateSet[i]);
        candidateSet.RemoveElementAt(i);
      } else {
        ++i;
      }
    }
    if (!candidateSet.Length()) {
      candidateSet.AppendElements(Move(rejects));
    }
  }
  MOZ_ASSERT(candidateSet.Length(),
             "advanced constraints filtering step can't reduce candidates to zero");

  // Remaining algorithm is up to the UA.

  TrimLessFitCandidates(candidateSet);

  // Any remaining multiples all have the same distance. A common case of this
  // occurs when no ideal is specified. Lean toward defaults.
  uint32_t sameDistance = candidateSet[0].mDistance;
  {
    MediaTrackConstraintSet prefs;
    prefs.mWidth.SetAsLong() = aPrefs.GetWidth();
    prefs.mHeight.SetAsLong() = aPrefs.GetHeight();
    prefs.mFrameRate.SetAsDouble() = aPrefs.mFPS;
    NormalizedConstraintSet normPrefs(prefs, false);

    for (auto& candidate : candidateSet) {
      candidate.mDistance =
        GetDistance(candidate.mCapability, normPrefs, aDeviceId, aCalculate);
    }
    TrimLessFitCandidates(candidateSet);
  }

  // Any remaining multiples all have the same distance, but may vary on
  // format. Some formats are more desirable for certain use like WebRTC.
  // E.g. I420 over RGB24 can remove a needless format conversion.

  bool found = false;
  for (auto& candidate : candidateSet) {
    const webrtc::CaptureCapability& cap = candidate.mCapability;
    if (cap.rawType == webrtc::RawVideoType::kVideoI420 ||
        cap.rawType == webrtc::RawVideoType::kVideoYUY2 ||
        cap.rawType == webrtc::RawVideoType::kVideoYV12) {
      aCapability = cap;
      found = true;
      break;
    }
  }
  if (!found) {
    aCapability = candidateSet[0].mCapability;
  }

  LogCapability("Chosen capability", aCapability, sameDistance);
  return true;
}

void
MediaEngineCameraVideoSource::SetName(nsString aName)
{
  mDeviceName = aName;
  bool hasFacingMode = false;
  VideoFacingModeEnum facingMode = VideoFacingModeEnum::User;

  // Set facing mode based on device name.
#if defined(ANDROID)
  // Names are generated. Example: "Camera 0, Facing back, Orientation 90"
  //
  // See media/webrtc/trunk/webrtc/modules/video_capture/android/java/src/org/
  // webrtc/videoengine/VideoCaptureDeviceInfoAndroid.java

  if (aName.Find(NS_LITERAL_STRING("Facing back")) != kNotFound) {
    hasFacingMode = true;
    facingMode = VideoFacingModeEnum::Environment;
  } else if (aName.Find(NS_LITERAL_STRING("Facing front")) != kNotFound) {
    hasFacingMode = true;
    facingMode = VideoFacingModeEnum::User;
  }
#endif // ANDROID
#ifdef XP_MACOSX
  // Kludge to test user-facing cameras on OSX.
  if (aName.Find(NS_LITERAL_STRING("Face")) != -1) {
    hasFacingMode = true;
    facingMode = VideoFacingModeEnum::User;
  }
#endif
#ifdef XP_WIN
  // The cameras' name of Surface book are "Microsoft Camera Front" and
  // "Microsoft Camera Rear" respectively.

  if (aName.Find(NS_LITERAL_STRING("Front")) != kNotFound) {
    hasFacingMode = true;
    facingMode = VideoFacingModeEnum::User;
  } else if (aName.Find(NS_LITERAL_STRING("Rear")) != kNotFound) {
    hasFacingMode = true;
    facingMode = VideoFacingModeEnum::Environment;
  }
#endif // WINDOWS
  if (hasFacingMode) {
    mFacingMode.Assign(NS_ConvertUTF8toUTF16(
        VideoFacingModeEnumValues::strings[uint32_t(facingMode)].value));
  } else {
    mFacingMode.Truncate();
  }
}

void
MediaEngineCameraVideoSource::GetName(nsAString& aName) const
{
  aName = mDeviceName;
}

void
MediaEngineCameraVideoSource::SetUUID(const char* aUUID)
{
  mUniqueId.Assign(aUUID);
}

void
MediaEngineCameraVideoSource::GetUUID(nsACString& aUUID) const
{
  aUUID = mUniqueId;
}

const nsCString&
MediaEngineCameraVideoSource::GetUUID() const
{
  return mUniqueId;
}

} // namespace mozilla
