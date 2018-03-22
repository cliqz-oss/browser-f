/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MediaEngineCameraVideoSource_h
#define MediaEngineCameraVideoSource_h

#include "MediaEngine.h"

#include "nsDirectoryServiceDefs.h"
#include "mozilla/Unused.h"

// conflicts with #include of scoped_ptr.h
#undef FF
// Avoid warnings about redefinition of WARN_UNUSED_RESULT
#include "ipc/IPCMessageUtils.h"

// WebRTC includes
#include "webrtc/common_video/include/i420_buffer_pool.h"
#include "webrtc/modules/video_capture/video_capture_defines.h"

namespace webrtc {
  using CaptureCapability = VideoCaptureCapability;
}

namespace mozilla {

// Fitness distance is defined in
// https://www.w3.org/TR/2017/CR-mediacapture-streams-20171003/#dfn-selectsettings
// The main difference of feasibility and fitness distance is that if the
// constraint is required ('max', or 'exact'), and the settings dictionary's value
// for the constraint does not satisfy the constraint, the fitness distance is
// positive infinity. Given a continuous space of settings dictionaries comprising
// all discrete combinations of dimension and frame-rate related properties,
// the feasibility distance is still in keeping with the constraints algorithm.
enum DistanceCalculation {
  kFitness,
  kFeasibility
};

class MediaEngineCameraVideoSource : public MediaEngineVideoSource
{
public:
  // Some subclasses use an index to track multiple instances.
  explicit MediaEngineCameraVideoSource(int aIndex,
                                        const char* aMonitorName = "Camera.Monitor")
    : MediaEngineVideoSource(kReleased)
    , mMonitor(aMonitorName)
    , mRescalingBufferPool(/* zero_initialize */ false,
                           /* max_number_of_buffers */ 1)
    , mWidth(0)
    , mHeight(0)
    , mInitDone(false)
    , mCaptureIndex(aIndex)
    , mTrackID(0)
  {}

  explicit MediaEngineCameraVideoSource(const char* aMonitorName = "Camera.Monitor")
    : MediaEngineCameraVideoSource(0, aMonitorName) {}

  void GetName(nsAString& aName) const override;
  void GetUUID(nsACString& aUUID) const override;

  bool IsFake() override
  {
    return false;
  }

  nsresult TakePhoto(MediaEnginePhotoCallback* aCallback) override
  {
    return NS_ERROR_NOT_IMPLEMENTED;
  }

  uint32_t GetBestFitnessDistance(
      const nsTArray<const NormalizedConstraintSet*>& aConstraintSets,
      const nsString& aDeviceId) const override;

  void Shutdown() override
  {
    MonitorAutoLock lock(mMonitor);
    // really Stop() *should* be called before it gets here
    Unused << NS_WARN_IF(mImage);
    mImage = nullptr;
    mImageContainer = nullptr;
    mRescalingBufferPool.Release();
  }

protected:
  struct CapabilityCandidate {
    explicit CapabilityCandidate(webrtc::CaptureCapability&& aCapability,
                                 uint32_t aDistance = 0)
    : mCapability(Forward<webrtc::CaptureCapability>(aCapability))
    , mDistance(aDistance) {}

    const webrtc::CaptureCapability mCapability;
    uint32_t mDistance;
  };

  class CapabilityComparator {
  public:
    bool Equals(const CapabilityCandidate& aCandidate,
                const webrtc::CaptureCapability& aCapability) const
    {
      return aCandidate.mCapability == aCapability;
    }
  };

  ~MediaEngineCameraVideoSource() {}

  // guts for appending data to the MSG track
  virtual bool AppendToTrack(SourceMediaStream* aSource,
                             layers::Image* aImage,
                             TrackID aID,
                             StreamTime delta,
                             const PrincipalHandle& aPrincipalHandle);
  uint32_t GetDistance(const webrtc::CaptureCapability& aCandidate,
                       const NormalizedConstraintSet &aConstraints,
                       const nsString& aDeviceId,
                       const DistanceCalculation aCalculate) const;
  uint32_t GetFitnessDistance(const webrtc::CaptureCapability& aCandidate,
                              const NormalizedConstraintSet &aConstraints,
                              const nsString& aDeviceId) const;
  uint32_t GetFeasibilityDistance(const webrtc::CaptureCapability& aCandidate,
                              const NormalizedConstraintSet &aConstraints,
                              const nsString& aDeviceId) const;
  static void TrimLessFitCandidates(nsTArray<CapabilityCandidate>& aSet);
  static void LogConstraints(const NormalizedConstraintSet& aConstraints);
  static void LogCapability(const char* aHeader,
                            const webrtc::CaptureCapability &aCapability,
                            uint32_t aDistance);
  virtual size_t NumCapabilities() const;
  virtual webrtc::CaptureCapability GetCapability(size_t aIndex) const;
  virtual bool ChooseCapability(
    const NormalizedConstraints &aConstraints,
    const MediaEnginePrefs &aPrefs,
    const nsString& aDeviceId,
    webrtc::CaptureCapability& aCapability,
    const DistanceCalculation aCalculate
  );
  void SetName(nsString aName);
  void SetUUID(const char* aUUID);
  const nsCString& GetUUID() const; // protected access

  // Engine variables.

  // mMonitor protects mImage access/changes, and transitions of mState
  // from kStarted to kStopped (which are combined with EndTrack() and
  // image changes).
  // mMonitor also protects mSources[] and mPrincipalHandles[] access/changes.
  // mSources[] and mPrincipalHandles[] are accessed from webrtc threads.

  // All the mMonitor accesses are from the child classes.
  Monitor mMonitor; // Monitor for processing Camera frames.
  nsTArray<RefPtr<SourceMediaStream>> mSources; // When this goes empty, we shut down HW
  nsTArray<PrincipalHandle> mPrincipalHandles; // Directly mapped to mSources.
  RefPtr<layers::Image> mImage;
  nsTArray<RefPtr<layers::Image>> mImages;
  nsTArray<webrtc::CaptureCapability> mTargetCapabilities;
  nsTArray<uint64_t> mHandleIds;
  RefPtr<layers::ImageContainer> mImageContainer;
  // end of data protected by mMonitor

  // A buffer pool used to manage the temporary buffer used when rescaling
  // incoming images. Cameras IPC thread only.
  webrtc::I420BufferPool mRescalingBufferPool;

  int mWidth, mHeight;
  bool mInitDone;
  int mCaptureIndex;
  TrackID mTrackID;

  webrtc::CaptureCapability mCapability;
  webrtc::CaptureCapability mTargetCapability;

  mutable nsTArray<webrtc::CaptureCapability> mHardcodedCapabilities;
private:
  nsString mDeviceName;
  nsCString mUniqueId;
  nsString mFacingMode;
};


} // namespace mozilla

#endif // MediaEngineCameraVideoSource_h
