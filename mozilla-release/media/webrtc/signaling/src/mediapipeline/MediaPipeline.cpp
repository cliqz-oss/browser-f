/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Original author: ekr@rtfm.com

#include "MediaPipeline.h"

#include <inttypes.h>
#include <math.h>

#include "AudioSegment.h"
#include "AudioConverter.h"
#include "AutoTaskQueue.h"
#include "CSFLog.h"
#include "DOMMediaStream.h"
#include "ImageContainer.h"
#include "ImageTypes.h"
#include "Layers.h"
#include "LayersLogging.h"
#include "MediaEngine.h"
#include "MediaPipelineFilter.h"
#include "MediaSegment.h"
#include "MediaStreamGraphImpl.h"
#include "MediaStreamListener.h"
#include "MediaStreamTrack.h"
#include "MediaStreamVideoSink.h"
#include "RtpLogger.h"
#include "VideoSegment.h"
#include "VideoStreamTrack.h"
#include "VideoUtils.h"
#include "libyuv/convert.h"
#include "mozilla/PeerIdentity.h"
#include "mozilla/Preferences.h"
#include "mozilla/SharedThreadPool.h"
#include "mozilla/Sprintf.h"
#include "mozilla/UniquePtr.h"
#include "mozilla/UniquePtrExtensions.h"
#include "mozilla/dom/RTCStatsReportBinding.h"
#include "mozilla/gfx/Point.h"
#include "mozilla/gfx/Types.h"
#include "nsError.h"
#include "nsThreadUtils.h"
#include "nspr.h"
#include "runnable_utils.h"
#include "srtp.h"
#include "transportflow.h"
#include "transportlayer.h"
#include "transportlayerdtls.h"
#include "transportlayerice.h"
#include "Tracing.h"

#include "webrtc/base/bind.h"
#include "webrtc/base/keep_ref_until_done.h"
#include "webrtc/common_types.h"
#include "webrtc/common_video/include/i420_buffer_pool.h"
#include "webrtc/common_video/include/video_frame_buffer.h"
#include "webrtc/common_video/libyuv/include/webrtc_libyuv.h"

// Max size given stereo is 480*2*2 = 1920 (10ms of 16-bits stereo audio at
// 48KHz)
#define AUDIO_SAMPLE_BUFFER_MAX_BYTES (480 * 2 * 2)
static_assert((WEBRTC_MAX_SAMPLE_RATE / 100) * sizeof(uint16_t) * 2
               <= AUDIO_SAMPLE_BUFFER_MAX_BYTES,
               "AUDIO_SAMPLE_BUFFER_MAX_BYTES is not large enough");

// The number of frame buffers VideoFrameConverter may create before returning
// errors.
// Sometimes these are released synchronously but they can be forwarded all the
// way to the encoder for asynchronous encoding. With a pool size of 5,
// we allow 1 buffer for the current conversion, and 4 buffers to be queued at
// the encoder.
#define CONVERTER_BUFFER_POOL_SIZE 5

using namespace mozilla;
using namespace mozilla::dom;
using namespace mozilla::gfx;
using namespace mozilla::layers;

static const char* mpLogTag = "MediaPipeline";
#ifdef LOGTAG
#undef LOGTAG
#endif
#define LOGTAG mpLogTag

namespace mozilla {
extern mozilla::LogModule*
AudioLogModule();

class VideoConverterListener
{
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(VideoConverterListener)

  virtual void OnVideoFrameConverted(const webrtc::VideoFrame& aVideoFrame) = 0;

protected:
  virtual ~VideoConverterListener() {}
};

// An async video frame format converter.
//
// Input is typically a MediaStream(Track)Listener driven by MediaStreamGraph.
//
// We keep track of the size of the TaskQueue so we can drop frames if
// conversion is taking too long.
//
// Output is passed through to all added VideoConverterListeners on a TaskQueue
// thread whenever a frame is converted.
class VideoFrameConverter
{
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(VideoFrameConverter)

  VideoFrameConverter()
    : mLength(0)
    , mTaskQueue(
        new AutoTaskQueue(GetMediaThreadPool(MediaThreadType::WEBRTC_DECODER),
                          "VideoFrameConverter"))
    , mBufferPool(false, CONVERTER_BUFFER_POOL_SIZE)
    , mLastImage(-1) // -1 is not a guaranteed invalid serial. See bug 1262134.
#ifdef DEBUG
    , mThrottleCount(0)
    , mThrottleRecord(0)
#endif
    , mMutex("VideoFrameConverter")
  {
    MOZ_COUNT_CTOR(VideoFrameConverter);
  }

  void QueueVideoChunk(const VideoChunk& aChunk, bool aForceBlack)
  {
    IntSize size = aChunk.mFrame.GetIntrinsicSize();
    if (size.width == 0 || size.width == 0) {
      return;
    }

    if (aChunk.IsNull()) {
      aForceBlack = true;
    } else {
      aForceBlack = aChunk.mFrame.GetForceBlack();
    }

    int32_t serial;
    if (aForceBlack) {
      // Reset the last-img check.
      // -1 is not a guaranteed invalid serial. See bug 1262134.
      serial = -1;
    } else {
      serial = aChunk.mFrame.GetImage()->GetSerial();
    }

    const double duplicateMinFps = 1.0;
    TimeStamp t = aChunk.mTimeStamp;
    MOZ_ASSERT(!t.IsNull());
    if (!t.IsNull() &&
        serial == mLastImage &&
        !mLastFrameSent.IsNull() &&
        (t - mLastFrameSent).ToSeconds() < (1.0 / duplicateMinFps)) {
      // We get passed duplicate frames every ~10ms even with no frame change.

      // After disabling, or when the source is not producing many frames,
      // we still want *some* frames to flow to the other side.
      // It could happen that we drop the packet that carried the first disabled
      // frame, for instance. Note that this still requires the application to
      // send a frame, or it doesn't trigger at all.
      return;
    }
    mLastFrameSent = t;
    mLastImage = serial;

    // A throttling limit of 1 allows us to convert 2 frames concurrently.
    // It's short enough to not build up too significant a delay, while
    // giving us a margin to not cause some machines to drop every other frame.
    const int32_t queueThrottlingLimit = 1;
    if (mLength > queueThrottlingLimit) {
      CSFLogDebug(LOGTAG,
                  "VideoFrameConverter %p queue is full. Throttling by "
                  "throwing away a frame.",
                  this);
#ifdef DEBUG
      ++mThrottleCount;
      mThrottleRecord = std::max(mThrottleCount, mThrottleRecord);
#endif
      return;
    }

#ifdef DEBUG
    if (mThrottleCount > 0) {
      if (mThrottleCount > 5) {
        // Log at a higher level when we have large drops.
        CSFLogInfo(LOGTAG,
                   "VideoFrameConverter %p stopped throttling after throwing "
                   "away %d frames. Longest throttle so far was %d frames.",
                   this,
                   mThrottleCount,
                   mThrottleRecord);
      } else {
        CSFLogDebug(LOGTAG,
                    "VideoFrameConverter %p stopped throttling after throwing "
                    "away %d frames. Longest throttle so far was %d frames.",
                    this,
                    mThrottleCount,
                    mThrottleRecord);
      }
      mThrottleCount = 0;
    }
#endif

    ++mLength; // Atomic

    nsCOMPtr<nsIRunnable> runnable =
      NewRunnableMethod<StoreRefPtrPassByPtr<Image>, IntSize, bool>(
        "VideoFrameConverter::ProcessVideoFrame",
        this,
        &VideoFrameConverter::ProcessVideoFrame,
        aChunk.mFrame.GetImage(),
        size,
        aForceBlack);
    nsresult rv = mTaskQueue->Dispatch(runnable.forget());
    MOZ_DIAGNOSTIC_ASSERT(NS_SUCCEEDED(rv));
    Unused << rv;
  }

  void AddListener(VideoConverterListener* aListener)
  {
    MutexAutoLock lock(mMutex);

    MOZ_ASSERT(!mListeners.Contains(aListener));
    mListeners.AppendElement(aListener);
  }

  bool RemoveListener(VideoConverterListener* aListener)
  {
    MutexAutoLock lock(mMutex);

    return mListeners.RemoveElement(aListener);
  }

  void Shutdown()
  {
    MutexAutoLock lock(mMutex);
    mListeners.Clear();
  }

protected:
  virtual ~VideoFrameConverter() { MOZ_COUNT_DTOR(VideoFrameConverter); }

  static void DeleteBuffer(uint8_t* aData) { delete[] aData; }

  // This takes ownership of the buffer and attached it to the VideoFrame we
  // send to the listeners
  void VideoFrameConverted(UniquePtr<uint8_t[]> aBuffer,
                           unsigned int aVideoFrameLength,
                           unsigned short aWidth,
                           unsigned short aHeight,
                           VideoType aVideoType,
                           uint64_t aCaptureTime)
  {
    // check for parameter sanity
    if (!aBuffer || aVideoFrameLength == 0 || aWidth == 0 || aHeight == 0) {
      CSFLogError(LOGTAG, "%s Invalid Parameters", __FUNCTION__);
      MOZ_ASSERT(false);
      return;
    }
    MOZ_ASSERT(aVideoType == VideoType::kVideoI420);

    const int stride_y = aWidth;
    const int stride_uv = (aWidth + 1) / 2;

    const uint8_t* buffer_y = aBuffer.get();
    const uint8_t* buffer_u = buffer_y + stride_y * aHeight;
    const uint8_t* buffer_v = buffer_u + stride_uv * ((aHeight + 1) / 2);
    rtc::scoped_refptr<webrtc::WrappedI420Buffer> video_frame_buffer(
      new rtc::RefCountedObject<webrtc::WrappedI420Buffer>(
        aWidth,
        aHeight,
        buffer_y,
        stride_y,
        buffer_u,
        stride_uv,
        buffer_v,
        stride_uv,
        rtc::Bind(&DeleteBuffer, aBuffer.release())));

    webrtc::VideoFrame video_frame(video_frame_buffer,
                                   aCaptureTime,
                                   aCaptureTime,
                                   webrtc::kVideoRotation_0); // XXX
    VideoFrameConverted(video_frame);
  }

  void VideoFrameConverted(const webrtc::VideoFrame& aVideoFrame)
  {
    MutexAutoLock lock(mMutex);

    for (RefPtr<VideoConverterListener>& listener : mListeners) {
      listener->OnVideoFrameConverted(aVideoFrame);
    }
  }

  void ProcessVideoFrame(Image* aImage, IntSize aSize, bool aForceBlack)
  {
    --mLength; // Atomic
    MOZ_ASSERT(mLength >= 0);

    if (aForceBlack) {
      // Send a black image.
      rtc::scoped_refptr<webrtc::I420Buffer> buffer =
        mBufferPool.CreateBuffer(aSize.width, aSize.height);
      if (!buffer) {
        MOZ_DIAGNOSTIC_ASSERT(false, "Buffers not leaving scope except for "
                                     "reconfig, should never leak");
        CSFLogWarn(LOGTAG, "Creating a buffer for a black video frame failed");
        return;
      }

      CSFLogDebug(LOGTAG, "Sending a black video frame");
      webrtc::I420Buffer::SetBlack(buffer);
      webrtc::VideoFrame frame(buffer,
                               0, 0, // not setting timestamps
                               webrtc::kVideoRotation_0);
      VideoFrameConverted(frame);
      return;
    }

    if (!aImage) {
      MOZ_ASSERT_UNREACHABLE("Must have image if not forcing black");
      return;
    }

    ImageFormat format = aImage->GetFormat();
    if (format == ImageFormat::PLANAR_YCBCR) {
      // Cast away constness b/c some of the accessors are non-const
      const PlanarYCbCrData* data =
        static_cast<const PlanarYCbCrImage*>(aImage)->GetData();
      if (data) {
        uint8_t* y = data->mYChannel;
        uint8_t* cb = data->mCbChannel;
        uint8_t* cr = data->mCrChannel;
        int32_t yStride = data->mYStride;
        int32_t cbCrStride = data->mCbCrStride;
        uint32_t width = aImage->GetSize().width;
        uint32_t height = aImage->GetSize().height;

        rtc::scoped_refptr<webrtc::WrappedI420Buffer> video_frame_buffer(
          new rtc::RefCountedObject<webrtc::WrappedI420Buffer>(
            width,
            height,
            y,
            yStride,
            cb,
            cbCrStride,
            cr,
            cbCrStride,
            rtc::KeepRefUntilDone(aImage)));

        webrtc::VideoFrame i420_frame(video_frame_buffer,
                                      0,
                                      0, // not setting timestamps
                                      webrtc::kVideoRotation_0);
        CSFLogDebug(LOGTAG, "Sending an I420 video frame");
        VideoFrameConverted(i420_frame);
        return;
      }
    }

    RefPtr<SourceSurface> surf = aImage->GetAsSourceSurface();
    if (!surf) {
      CSFLogError(LOGTAG,
                  "Getting surface from %s image failed",
                  Stringify(format).c_str());
      return;
    }

    RefPtr<DataSourceSurface> data = surf->GetDataSurface();
    if (!data) {
      CSFLogError(
        LOGTAG,
        "Getting data surface from %s image with %s (%s) surface failed",
        Stringify(format).c_str(),
        Stringify(surf->GetType()).c_str(),
        Stringify(surf->GetFormat()).c_str());
      return;
    }

    if (aImage->GetSize() != aSize) {
      MOZ_DIAGNOSTIC_ASSERT(false, "Unexpected intended size");
      return;
    }

    rtc::scoped_refptr<webrtc::I420Buffer> buffer =
      mBufferPool.CreateBuffer(aSize.width, aSize.height);
    if (!buffer) {
      CSFLogWarn(LOGTAG, "Creating a buffer for a black video frame failed");
      return;
    }

    DataSourceSurface::ScopedMap map(data, DataSourceSurface::READ);
    if (!map.IsMapped()) {
      CSFLogError(
        LOGTAG,
        "Reading DataSourceSurface from %s image with %s (%s) surface failed",
        Stringify(format).c_str(),
        Stringify(surf->GetType()).c_str(),
        Stringify(surf->GetFormat()).c_str());
      return;
    }

    int rv;
    switch (surf->GetFormat()) {
      case SurfaceFormat::B8G8R8A8:
      case SurfaceFormat::B8G8R8X8:
        rv = libyuv::ARGBToI420(static_cast<uint8_t*>(map.GetData()),
                                map.GetStride(),
                                buffer->MutableDataY(),
                                buffer->StrideY(),
                                buffer->MutableDataU(),
                                buffer->StrideU(),
                                buffer->MutableDataV(),
                                buffer->StrideV(),
                                aSize.width,
                                aSize.height);
        break;
      case SurfaceFormat::R5G6B5_UINT16:
        rv = libyuv::RGB565ToI420(static_cast<uint8_t*>(map.GetData()),
                                  map.GetStride(),
                                  buffer->MutableDataY(),
                                  buffer->StrideY(),
                                  buffer->MutableDataU(),
                                  buffer->StrideU(),
                                  buffer->MutableDataV(),
                                  buffer->StrideV(),
                                  aSize.width,
                                  aSize.height);
        break;
      default:
        CSFLogError(LOGTAG,
                    "Unsupported RGB video format %s",
                    Stringify(surf->GetFormat()).c_str());
        MOZ_ASSERT(PR_FALSE);
        return;
    }
    if (rv != 0) {
      CSFLogError(LOGTAG,
                  "%s to I420 conversion failed",
                  Stringify(surf->GetFormat()).c_str());
      return;
    }
    CSFLogDebug(LOGTAG,
                "Sending an I420 video frame converted from %s",
                Stringify(surf->GetFormat()).c_str());
    webrtc::VideoFrame frame(buffer,
                             0, 0, // not setting timestamps
                             webrtc::kVideoRotation_0);
    VideoFrameConverted(frame);
  }

  Atomic<int32_t, Relaxed> mLength;
  const RefPtr<AutoTaskQueue> mTaskQueue;
  webrtc::I420BufferPool mBufferPool;

  // Written and read from the queueing thread (normally MSG).
  int32_t mLastImage;       // serial number of last Image
  TimeStamp mLastFrameSent; // The time we sent the last frame.
#ifdef DEBUG
  uint32_t mThrottleCount;
  uint32_t mThrottleRecord;
#endif

  // mMutex guards the below variables.
  Mutex mMutex;
  nsTArray<RefPtr<VideoConverterListener>> mListeners;
};

// An async inserter for audio data, to avoid running audio codec encoders
// on the MSG/input audio thread.  Basically just bounces all the audio
// data to a single audio processing/input queue.  We could if we wanted to
// use multiple threads and a TaskQueue.
class AudioProxyThread
{
public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(AudioProxyThread)

  explicit AudioProxyThread(AudioSessionConduit* aConduit)
    : mConduit(aConduit)
    , mTaskQueue(
        new AutoTaskQueue(GetMediaThreadPool(MediaThreadType::WEBRTC_DECODER),
                          "AudioProxy"))
    , mAudioConverter(nullptr)
  {
    MOZ_ASSERT(mConduit);
    MOZ_COUNT_CTOR(AudioProxyThread);
  }

  // This function is the identity if aInputRate is supported.
  // Else, it returns a rate that is supported, that ensure no loss in audio
  // quality: the sampling rate returned is always greater to the inputed
  // sampling-rate, if they differ..
  uint32_t AppropriateSendingRateForInputRate(uint32_t aInputRate)
  {
    AudioSessionConduit* conduit =
      static_cast<AudioSessionConduit*>(mConduit.get());
    if (conduit->IsSamplingFreqSupported(aInputRate)) {
      return aInputRate;
    }
    if (aInputRate < 16000) {
      return 16000;
    } else if (aInputRate < 32000) {
      return 32000;
    } else if (aInputRate < 44100) {
      return 44100;
    } else {
      return 48000;
    }
  }

  // From an arbitrary AudioChunk at sampling-rate aRate, process the audio into
  // something the conduit can work with (or send silence if the track is not
  // enabled), and send the audio in 10ms chunks to the conduit.
  void InternalProcessAudioChunk(TrackRate aRate,
                                 const AudioChunk& aChunk,
                                 bool aEnabled)
  {
    MOZ_ASSERT(mTaskQueue->IsCurrentThreadIn());

    // Convert to interleaved 16-bits integer audio, with a maximum of two
    // channels (since the WebRTC.org code below makes the assumption that the
    // input audio is either mono or stereo), with a sample-rate rate that is
    // 16, 32, 44.1, or 48kHz.
    uint32_t outputChannels = aChunk.ChannelCount() == 1 ? 1 : 2;
    int32_t transmissionRate = AppropriateSendingRateForInputRate(aRate);

    // We take advantage of the fact that the common case (microphone directly
    // to PeerConnection, that is, a normal call), the samples are already
    // 16-bits mono, so the representation in interleaved and planar is the
    // same, and we can just use that.
    if (aEnabled &&
        outputChannels == 1 &&
        aChunk.mBufferFormat == AUDIO_FORMAT_S16 &&
        transmissionRate == aRate) {
      const int16_t* samples = aChunk.ChannelData<int16_t>().Elements()[0];
      PacketizeAndSend(samples,
                       transmissionRate,
                       outputChannels,
                       aChunk.mDuration);
      return;
    }

    uint32_t sampleCount = aChunk.mDuration * outputChannels;
    if (mInterleavedAudio.Length() < sampleCount) {
      mInterleavedAudio.SetLength(sampleCount);
    }

    if (!aEnabled || aChunk.mBufferFormat == AUDIO_FORMAT_SILENCE) {
      PodZero(mInterleavedAudio.Elements(), sampleCount);
    } else if (aChunk.mBufferFormat == AUDIO_FORMAT_FLOAT32) {
      DownmixAndInterleave(aChunk.ChannelData<float>(),
                           aChunk.mDuration,
                           aChunk.mVolume,
                           outputChannels,
                           mInterleavedAudio.Elements());
    } else if (aChunk.mBufferFormat == AUDIO_FORMAT_S16) {
      DownmixAndInterleave(aChunk.ChannelData<int16_t>(),
                           aChunk.mDuration,
                           aChunk.mVolume,
                           outputChannels,
                           mInterleavedAudio.Elements());
    }
    int16_t* inputAudio = mInterleavedAudio.Elements();
    size_t inputAudioFrameCount = aChunk.mDuration;

    AudioConfig inputConfig(AudioConfig::ChannelLayout(outputChannels),
                            aRate,
                            AudioConfig::FORMAT_S16);
    AudioConfig outputConfig(AudioConfig::ChannelLayout(outputChannels),
                             transmissionRate,
                             AudioConfig::FORMAT_S16);
    // Resample to an acceptable sample-rate for the sending side
    if (!mAudioConverter ||
        mAudioConverter->InputConfig() != inputConfig ||
        mAudioConverter->OutputConfig() != outputConfig) {
      mAudioConverter = MakeUnique<AudioConverter>(inputConfig, outputConfig);
    }

    int16_t* processedAudio = nullptr;
    size_t framesProcessed =
      mAudioConverter->Process(inputAudio, inputAudioFrameCount);

    if (framesProcessed == 0) {
      // In place conversion not possible, use a buffer.
      framesProcessed =
        mAudioConverter->Process(mOutputAudio,
                                 inputAudio,
                                 inputAudioFrameCount);
      processedAudio = mOutputAudio.Data();
    } else {
      processedAudio = inputAudio;
    }

    PacketizeAndSend(processedAudio,
                     transmissionRate,
                     outputChannels,
                     framesProcessed);
  }

  // This packetizes aAudioData in 10ms chunks and sends it.
  // aAudioData is interleaved audio data at a rate and with a channel count
  // that is appropriate to send with the conduit.
  void PacketizeAndSend(const int16_t* aAudioData,
                        uint32_t aRate,
                        uint32_t aChannels,
                        uint32_t aFrameCount)
  {
    MOZ_ASSERT(AppropriateSendingRateForInputRate(aRate) == aRate);
    MOZ_ASSERT(aChannels == 1 || aChannels == 2);
    MOZ_ASSERT(aAudioData);

    uint32_t audio_10ms = aRate / 100;

    if (!mPacketizer || mPacketizer->PacketSize() != audio_10ms ||
        mPacketizer->Channels() != aChannels) {
      // It's the right thing to drop the bit of audio still in the packetizer:
      // we don't want to send to the conduit audio that has two different
      // rates while telling it that it has a constante rate.
      mPacketizer = MakeUnique<AudioPacketizer<int16_t, int16_t>>(
        audio_10ms, aChannels);
      mPacket = MakeUnique<int16_t[]>(audio_10ms * aChannels);
    }

    mPacketizer->Input(aAudioData, aFrameCount);

    while (mPacketizer->PacketsAvailable()) {
      mPacketizer->Output(mPacket.get());
      mConduit->SendAudioFrame(mPacket.get(),
                               mPacketizer->PacketSize(),
                               aRate,
                               mPacketizer->Channels(),
                               0);
    }
  }

  void QueueAudioChunk(TrackRate aRate, const AudioChunk& aChunk, bool aEnabled)
  {
    RefPtr<AudioProxyThread> self = this;
    nsresult rv = mTaskQueue->Dispatch(NS_NewRunnableFunction(
      "AudioProxyThread::QueueAudioChunk", [self, aRate, aChunk, aEnabled]() {
        self->InternalProcessAudioChunk(aRate, aChunk, aEnabled);
      }));
    MOZ_DIAGNOSTIC_ASSERT(NS_SUCCEEDED(rv));
    Unused << rv;
  }

protected:
  virtual ~AudioProxyThread()
  {
    // Conduits must be released on MainThread, and we might have the last
    // reference We don't need to worry about runnables still trying to access
    // the conduit, since the runnables hold a ref to AudioProxyThread.
    NS_ReleaseOnMainThreadSystemGroup("AudioProxyThread::mConduit",
                                      mConduit.forget());
    MOZ_COUNT_DTOR(AudioProxyThread);
  }

  RefPtr<AudioSessionConduit> mConduit;
  const RefPtr<AutoTaskQueue> mTaskQueue;
  // Only accessed on mTaskQueue
  UniquePtr<AudioPacketizer<int16_t, int16_t>> mPacketizer;
  // A buffer to hold a single packet of audio.
  UniquePtr<int16_t[]> mPacket;
  nsTArray<int16_t> mInterleavedAudio;
  AlignedShortBuffer mOutputAudio;
  UniquePtr<AudioConverter> mAudioConverter;
};

MediaPipeline::MediaPipeline(const std::string& aPc,
                             DirectionType aDirection,
                             nsCOMPtr<nsIEventTarget> aMainThread,
                             nsCOMPtr<nsIEventTarget> aStsThread,
                             RefPtr<MediaSessionConduit> aConduit)
  : mDirection(aDirection)
  , mLevel(0)
  , mConduit(aConduit)
  , mRtp(nullptr, RTP)
  , mRtcp(nullptr, RTCP)
  , mMainThread(aMainThread)
  , mStsThread(aStsThread)
  , mTransport(new PipelineTransport(aStsThread))
  , mRtpPacketsSent(0)
  , mRtcpPacketsSent(0)
  , mRtpPacketsReceived(0)
  , mRtcpPacketsReceived(0)
  , mRtpBytesSent(0)
  , mRtpBytesReceived(0)
  , mPc(aPc)
  , mRtpParser(webrtc::RtpHeaderParser::Create())
  , mPacketDumper(new PacketDumper(mPc))
{
  if (mDirection == DirectionType::RECEIVE) {
    mConduit->SetReceiverTransport(mTransport);
  } else {
    mConduit->SetTransmitterTransport(mTransport);
  }
}

MediaPipeline::~MediaPipeline()
{
  CSFLogInfo(LOGTAG, "Destroying MediaPipeline: %s", mDescription.c_str());
  NS_ReleaseOnMainThreadSystemGroup("MediaPipeline::mConduit",
                                    mConduit.forget());
}

void
MediaPipeline::Shutdown_m()
{
  Stop();
  DetachMedia();

  RUN_ON_THREAD(mStsThread,
                WrapRunnable(RefPtr<MediaPipeline>(this),
                             &MediaPipeline::DetachTransport_s),
                NS_DISPATCH_NORMAL);
}

void
MediaPipeline::DetachTransport_s()
{
  ASSERT_ON_THREAD(mStsThread);

  CSFLogInfo(LOGTAG, "%s in %s", mDescription.c_str(), __FUNCTION__);

  disconnect_all();
  mTransport->Detach();
  mRtp.Detach();
  mRtcp.Detach();

  // Make sure any cycles are broken
  mPacketDumper = nullptr;
}

nsresult
MediaPipeline::AttachTransport_s()
{
  ASSERT_ON_THREAD(mStsThread);
  nsresult res;
  MOZ_ASSERT(mRtp.mTransport);
  MOZ_ASSERT(mRtcp.mTransport);
  res = ConnectTransport_s(mRtp);
  if (NS_FAILED(res)) {
    return res;
  }

  if (mRtcp.mTransport != mRtp.mTransport) {
    res = ConnectTransport_s(mRtcp);
    if (NS_FAILED(res)) {
      return res;
    }
  }

  mTransport->Attach(this);

  return NS_OK;
}

void
MediaPipeline::UpdateTransport_m(RefPtr<TransportFlow> aRtpTransport,
                                 RefPtr<TransportFlow> aRtcpTransport,
                                 nsAutoPtr<MediaPipelineFilter> aFilter)
{
  RUN_ON_THREAD(mStsThread,
                WrapRunnable(RefPtr<MediaPipeline>(this),
                             &MediaPipeline::UpdateTransport_s,
                             aRtpTransport,
                             aRtcpTransport,
                             aFilter),
                NS_DISPATCH_NORMAL);
}

void
MediaPipeline::UpdateTransport_s(RefPtr<TransportFlow> aRtpTransport,
                                 RefPtr<TransportFlow> aRtcpTransport,
                                 nsAutoPtr<MediaPipelineFilter> aFilter)
{
  bool rtcp_mux = false;
  if (!aRtcpTransport) {
    aRtcpTransport = aRtpTransport;
    rtcp_mux = true;
  }

  if ((aRtpTransport != mRtp.mTransport) ||
      (aRtcpTransport != mRtcp.mTransport)) {
    disconnect_all();
    mTransport->Detach();
    mRtp.Detach();
    mRtcp.Detach();
    if (aRtpTransport && aRtcpTransport) {
      mRtp = TransportInfo(aRtpTransport, rtcp_mux ? MUX : RTP);
      mRtcp = TransportInfo(aRtcpTransport, rtcp_mux ? MUX : RTCP);
      AttachTransport_s();
    }
  }

  if (mFilter && aFilter) {
    // Use the new filter, but don't forget any remote SSRCs that we've learned
    // by receiving traffic.
    mFilter->Update(*aFilter);
  } else {
    mFilter = aFilter;
  }
}

void
MediaPipeline::AddRIDExtension_m(size_t aExtensionId)
{
  RUN_ON_THREAD(mStsThread,
                WrapRunnable(RefPtr<MediaPipeline>(this),
                             &MediaPipeline::AddRIDExtension_s,
                             aExtensionId),
                NS_DISPATCH_NORMAL);
}

void
MediaPipeline::AddRIDExtension_s(size_t aExtensionId)
{
  mRtpParser->RegisterRtpHeaderExtension(webrtc::kRtpExtensionRtpStreamId,
                                         aExtensionId);
}

void
MediaPipeline::AddRIDFilter_m(const std::string& aRid)
{
  RUN_ON_THREAD(mStsThread,
                WrapRunnable(RefPtr<MediaPipeline>(this),
                             &MediaPipeline::AddRIDFilter_s,
                             aRid),
                NS_DISPATCH_NORMAL);
}

void
MediaPipeline::AddRIDFilter_s(const std::string& aRid)
{
  mFilter = new MediaPipelineFilter;
  mFilter->AddRemoteRtpStreamId(aRid);
}

void
MediaPipeline::GetContributingSourceStats(
  const nsString& aInboundRtpStreamId,
  FallibleTArray<dom::RTCRTPContributingSourceStats>& aArr) const
{
  // Get the expiry from now
  DOMHighResTimeStamp expiry = RtpCSRCStats::GetExpiryFromTime(GetNow());
  for (auto info : mCsrcStats) {
    if (!info.second.Expired(expiry)) {
      RTCRTPContributingSourceStats stats;
      info.second.GetWebidlInstance(stats, aInboundRtpStreamId);
      aArr.AppendElement(stats, fallible);
    }
  }
}

void
MediaPipeline::StateChange(TransportLayer* aLayer, TransportLayer::State aState)
{
  TransportInfo* info = GetTransportInfo_s(aLayer);
  MOZ_ASSERT(info);

  if (aState == TransportLayer::TS_OPEN) {
    CSFLogInfo(LOGTAG, "Flow is ready");
    TransportReady_s(*info);
  } else if (aState == TransportLayer::TS_CLOSED ||
             aState == TransportLayer::TS_ERROR) {
    TransportFailed_s(*info);
  }
}

static bool
MakeRtpTypeToStringArray(const char** aArray)
{
  static const char* RTP_str = "RTP";
  static const char* RTCP_str = "RTCP";
  static const char* MUX_str = "RTP/RTCP mux";
  aArray[MediaPipeline::RTP] = RTP_str;
  aArray[MediaPipeline::RTCP] = RTCP_str;
  aArray[MediaPipeline::MUX] = MUX_str;
  return true;
}

static const char*
ToString(MediaPipeline::RtpType type)
{
  static const char* array[(int)MediaPipeline::MAX_RTP_TYPE] = { nullptr };
  // Dummy variable to cause init to happen only on first call
  static bool dummy = MakeRtpTypeToStringArray(array);
  (void)dummy;
  return array[type];
}

nsresult
MediaPipeline::TransportReady_s(TransportInfo& aInfo)
{
  // TODO(ekr@rtfm.com): implement some kind of notification on
  // failure. bug 852665.
  if (aInfo.mState != StateType::MP_CONNECTING) {
    CSFLogError(LOGTAG,
                "Transport ready for flow in wrong state:%s :%s",
                mDescription.c_str(),
                ToString(aInfo.mType));
    return NS_ERROR_FAILURE;
  }

  CSFLogInfo(LOGTAG,
             "Transport ready for pipeline %p flow %s: %s",
             this,
             mDescription.c_str(),
             ToString(aInfo.mType));

  if (mDirection == DirectionType::RECEIVE) {
    CSFLogInfo(LOGTAG,
               "Listening for %s packets received on %p",
               ToString(aInfo.mType),
               aInfo.mSrtp);

    aInfo.mSrtp->SignalPacketReceived.connect(
        this, &MediaPipeline::PacketReceived);
  }

  aInfo.mState = StateType::MP_OPEN;
  UpdateRtcpMuxState(aInfo);
  return NS_OK;
}

nsresult
MediaPipeline::TransportFailed_s(TransportInfo& aInfo)
{
  ASSERT_ON_THREAD(mStsThread);

  aInfo.mState = StateType::MP_CLOSED;
  UpdateRtcpMuxState(aInfo);

  CSFLogInfo(LOGTAG, "Transport closed for flow %s", ToString(aInfo.mType));

  NS_WARNING(
    "MediaPipeline Transport failed. This is not properly cleaned up yet");

  // TODO(ekr@rtfm.com): SECURITY: Figure out how to clean up if the
  // connection was good and now it is bad.
  // TODO(ekr@rtfm.com): Report up so that the PC knows we
  // have experienced an error.

  return NS_OK;
}

void
MediaPipeline::UpdateRtcpMuxState(TransportInfo& aInfo)
{
  if (aInfo.mType == MUX) {
    if (aInfo.mTransport == mRtcp.mTransport) {
      mRtcp.mState = aInfo.mState;
    }
  }
}

nsresult
MediaPipeline::SendPacket(TransportLayer* aLayer, MediaPacket& packet)
{
  ASSERT_ON_THREAD(mStsThread);

  int len = packet.len();
  TransportResult res = aLayer->SendPacket(packet);

  if (res != len) {
    // Ignore blocking indications
    if (res == TE_WOULDBLOCK)
      return NS_OK;

    CSFLogError(LOGTAG, "Failed write on stream %s", mDescription.c_str());
    return NS_BASE_STREAM_CLOSED;
  }

  return NS_OK;
}

void
MediaPipeline::IncrementRtpPacketsSent(int32_t aBytes)
{
  ++mRtpPacketsSent;
  mRtpBytesSent += aBytes;

  if (!(mRtpPacketsSent % 100)) {
    CSFLogInfo(LOGTAG,
               "RTP sent packet count for %s Pipeline %p Flow: %p: %u (%" PRId64
               " bytes)",
               mDescription.c_str(),
               this,
               static_cast<void*>(mRtp.mTransport),
               mRtpPacketsSent,
               mRtpBytesSent);
  }
}

void
MediaPipeline::IncrementRtcpPacketsSent()
{
  ++mRtcpPacketsSent;
  if (!(mRtcpPacketsSent % 100)) {
    CSFLogInfo(LOGTAG,
               "RTCP sent packet count for %s Pipeline %p Flow: %p: %u",
               mDescription.c_str(),
               this,
               static_cast<void*>(mRtp.mTransport),
               mRtcpPacketsSent);
  }
}

void
MediaPipeline::IncrementRtpPacketsReceived(int32_t aBytes)
{
  ++mRtpPacketsReceived;
  mRtpBytesReceived += aBytes;
  if (!(mRtpPacketsReceived % 100)) {
    CSFLogInfo(
      LOGTAG,
      "RTP received packet count for %s Pipeline %p Flow: %p: %u (%" PRId64
      " bytes)",
      mDescription.c_str(),
      this,
      static_cast<void*>(mRtp.mTransport),
      mRtpPacketsReceived,
      mRtpBytesReceived);
  }
}

void
MediaPipeline::IncrementRtcpPacketsReceived()
{
  ++mRtcpPacketsReceived;
  if (!(mRtcpPacketsReceived % 100)) {
    CSFLogInfo(LOGTAG,
               "RTCP received packet count for %s Pipeline %p Flow: %p: %u",
               mDescription.c_str(),
               this,
               static_cast<void*>(mRtp.mTransport),
               mRtcpPacketsReceived);
  }
}

void
MediaPipeline::RtpPacketReceived(TransportLayer* aLayer, MediaPacket& packet)
{
  if (mDirection == DirectionType::TRANSMIT) {
    return;
  }

  if (!mTransport->Pipeline()) {
    CSFLogError(LOGTAG, "Discarding incoming packet; transport disconnected");
    return;
  }

  if (!mConduit) {
    CSFLogDebug(LOGTAG, "Discarding incoming packet; media disconnected");
    return;
  }

  if (mRtp.mState != StateType::MP_OPEN) {
    CSFLogError(LOGTAG, "Discarding incoming packet; pipeline not open");
    return;
  }

  if (mRtp.mSrtp->state() != TransportLayer::TS_OPEN) {
    CSFLogError(LOGTAG, "Discarding incoming packet; transport not open");
    return;
  }

  if (!packet.len()) {
    return;
  }

  webrtc::RTPHeader header;
  if (!mRtpParser->Parse(packet.data(), packet.len(), &header, true)) {
    return;
  }

  if (mFilter && !mFilter->Filter(header)) {
    return;
  }

  // Make sure to only get the time once, and only if we need it by
  // using getTimestamp() for access
  DOMHighResTimeStamp now = 0.0;
  bool hasTime = false;

  // Remove expired RtpCSRCStats
  if (!mCsrcStats.empty()) {
    if (!hasTime) {
      now = GetNow();
      hasTime = true;
    }
    auto expiry = RtpCSRCStats::GetExpiryFromTime(now);
    for (auto p = mCsrcStats.begin(); p != mCsrcStats.end();) {
      if (p->second.Expired(expiry)) {
        p = mCsrcStats.erase(p);
        continue;
      }
      p++;
    }
  }

  // Add new RtpCSRCStats
  if (header.numCSRCs) {
    for (auto i = 0; i < header.numCSRCs; i++) {
      if (!hasTime) {
        now = GetNow();
        hasTime = true;
      }
      auto csrcInfo = mCsrcStats.find(header.arrOfCSRCs[i]);
      if (csrcInfo == mCsrcStats.end()) {
        mCsrcStats.insert(std::make_pair(
          header.arrOfCSRCs[i], RtpCSRCStats(header.arrOfCSRCs[i], now)));
      } else {
        csrcInfo->second.SetTimestamp(now);
      }
    }
  }

  CSFLogDebug(LOGTAG, "%s received RTP packet.", mDescription.c_str());
  IncrementRtpPacketsReceived(packet.len());
  OnRtpPacketReceived();

  RtpLogger::LogPacket(packet, true, mDescription);

  // Might be nice to pass ownership of the buffer in this case, but it is a
  // small optimization in a rare case.
  mPacketDumper->Dump(
    mLevel, dom::mozPacketDumpType::Srtp, false, packet.encrypted_data(), packet.encrypted_len());

  mPacketDumper->Dump(
    mLevel, dom::mozPacketDumpType::Rtp, false, packet.data(), packet.len());

  (void)mConduit->ReceivedRTPPacket(
    packet.data(), packet.len(), header.ssrc); // Ignore error codes
}

void
MediaPipeline::RtcpPacketReceived(TransportLayer* aLayer, MediaPacket& packet)
{
  if (!mTransport->Pipeline()) {
    CSFLogDebug(LOGTAG, "Discarding incoming packet; transport disconnected");
    return;
  }

  if (!mConduit) {
    CSFLogDebug(LOGTAG, "Discarding incoming packet; media disconnected");
    return;
  }

  if (mRtcp.mState != StateType::MP_OPEN) {
    CSFLogDebug(LOGTAG, "Discarding incoming packet; pipeline not open");
    return;
  }

  if (mRtcp.mSrtp->state() != TransportLayer::TS_OPEN) {
    CSFLogError(LOGTAG, "Discarding incoming packet; transport not open");
    return;
  }

  if (!packet.len()) {
    return;
  }

  // We do not filter receiver reports, since the webrtc.org code for
  // senders already has logic to ignore RRs that do not apply.
  // TODO bug 1279153: remove SR check for reduced size RTCP
  if (mFilter && !mFilter->FilterSenderReport(packet.data(), packet.len())) {
    CSFLogWarn(LOGTAG, "Dropping incoming RTCP packet; filtered out");
    return;
  }

  CSFLogDebug(LOGTAG, "%s received RTCP packet.", mDescription.c_str());
  IncrementRtcpPacketsReceived();

  RtpLogger::LogPacket(packet, true, mDescription);

  // Might be nice to pass ownership of the buffer in this case, but it is a
  // small optimization in a rare case.
  mPacketDumper->Dump(
    mLevel, dom::mozPacketDumpType::Srtcp, false, packet.encrypted_data(), packet.encrypted_len());

  mPacketDumper->Dump(mLevel, dom::mozPacketDumpType::Rtcp, false, packet.data(), packet.len());

  (void)mConduit->ReceivedRTCPPacket(packet.data(), packet.len()); // Ignore error codes
}

void
MediaPipeline::PacketReceived(TransportLayer* aLayer, MediaPacket& packet)
{
  if (!mTransport->Pipeline()) {
    CSFLogDebug(LOGTAG, "Discarding incoming packet; transport disconnected");
    return;
  }

  switch (packet.type()) {
    case MediaPacket::RTP:
      RtpPacketReceived(aLayer, packet);
      break;
    case MediaPacket::RTCP:
      RtcpPacketReceived(aLayer, packet);
      break;
    default:
      MOZ_CRASH("TransportLayerSrtp let something other than RTP/RTCP through");
  }
}

class MediaPipelineTransmit::PipelineListener : public MediaStreamVideoSink
{
  friend class MediaPipelineTransmit;

public:
  explicit PipelineListener(const RefPtr<MediaSessionConduit>& aConduit)
    : mConduit(aConduit)
    , mActive(false)
    , mEnabled(false)
    , mDirectConnect(false)
  {
  }

  ~PipelineListener()
  {
    NS_ReleaseOnMainThreadSystemGroup("MediaPipeline::mConduit",
                                      mConduit.forget());
    if (mConverter) {
      mConverter->Shutdown();
    }
  }

  void SetActive(bool aActive) { mActive = aActive; }
  void SetEnabled(bool aEnabled) { mEnabled = aEnabled; }

  // These are needed since nested classes don't have access to any particular
  // instance of the parent
  void SetAudioProxy(const RefPtr<AudioProxyThread>& aProxy)
  {
    mAudioProcessing = aProxy;
  }

  void SetVideoFrameConverter(const RefPtr<VideoFrameConverter>& aConverter)
  {
    mConverter = aConverter;
  }


  void OnVideoFrameConverted(const webrtc::VideoFrame& aVideoFrame)
  {
    MOZ_RELEASE_ASSERT(mConduit->type() == MediaSessionConduit::VIDEO);
    static_cast<VideoSessionConduit*>(mConduit.get())
      ->SendVideoFrame(aVideoFrame);
  }

  // Implement MediaStreamTrackListener
  void NotifyQueuedChanges(MediaStreamGraph* aGraph,
                           StreamTime aTrackOffset,
                           const MediaSegment& aQueuedMedia) override;

  // Implement DirectMediaStreamTrackListener
  void NotifyRealtimeTrackData(MediaStreamGraph* aGraph,
                               StreamTime aTrackOffset,
                               const MediaSegment& aMedia) override;
  void NotifyDirectListenerInstalled(InstallationResult aResult) override;
  void NotifyDirectListenerUninstalled() override;

  // Implement MediaStreamVideoSink
  void SetCurrentFrames(const VideoSegment& aSegment) override;
  void ClearFrames() override {}

private:
  void NewData(const MediaSegment& aMedia, TrackRate aRate = 0);

  RefPtr<MediaSessionConduit> mConduit;
  RefPtr<AudioProxyThread> mAudioProcessing;
  RefPtr<VideoFrameConverter> mConverter;

  // active is true if there is a transport to send on
  mozilla::Atomic<bool> mActive;
  // enabled is true if the media access control permits sending
  // actual content; when false you get black/silence
  mozilla::Atomic<bool> mEnabled;

  // Written and read on the MediaStreamGraph thread
  bool mDirectConnect;
};

// Implements VideoConverterListener for MediaPipeline.
//
// We pass converted frames on to MediaPipelineTransmit::PipelineListener
// where they are further forwarded to VideoConduit.
// MediaPipelineTransmit calls Detach() during shutdown to ensure there is
// no cyclic dependencies between us and PipelineListener.
class MediaPipelineTransmit::VideoFrameFeeder : public VideoConverterListener
{
public:
  explicit VideoFrameFeeder(const RefPtr<PipelineListener>& aListener)
    : mMutex("VideoFrameFeeder")
    , mListener(aListener)
  {
    MOZ_COUNT_CTOR(VideoFrameFeeder);
  }

  void Detach()
  {
    MutexAutoLock lock(mMutex);

    mListener = nullptr;
  }


  void OnVideoFrameConverted(const webrtc::VideoFrame& aVideoFrame) override
  {
    MutexAutoLock lock(mMutex);

    if (!mListener) {
      return;
    }

    mListener->OnVideoFrameConverted(aVideoFrame);
  }

protected:
  virtual ~VideoFrameFeeder() { MOZ_COUNT_DTOR(VideoFrameFeeder); }

  Mutex mMutex; // Protects the member below.
  RefPtr<PipelineListener> mListener;
};

MediaPipelineTransmit::MediaPipelineTransmit(
  const std::string& aPc,
  nsCOMPtr<nsIEventTarget> aMainThread,
  nsCOMPtr<nsIEventTarget> aStsThread,
  bool aIsVideo,
  RefPtr<MediaSessionConduit> aConduit)
  : MediaPipeline(aPc,
                  DirectionType::TRANSMIT,
                  aMainThread,
                  aStsThread,
                  aConduit)
  , mIsVideo(aIsVideo)
  , mListener(new PipelineListener(aConduit))
  , mFeeder(aIsVideo ? MakeAndAddRef<VideoFrameFeeder>(mListener)
                     : nullptr) // For video we send frames to an
                                // async VideoFrameConverter that
                                // calls back to a VideoFrameFeeder
                                // that feeds I420 frames to
                                // VideoConduit.
  , mTransmitting(false)
{
  if (!IsVideo()) {
    mAudioProcessing = MakeAndAddRef<AudioProxyThread>(
      static_cast<AudioSessionConduit*>(aConduit.get()));
    mListener->SetAudioProxy(mAudioProcessing);
  } else { // Video
    mConverter = MakeAndAddRef<VideoFrameConverter>();
    mConverter->AddListener(mFeeder);
    mListener->SetVideoFrameConverter(mConverter);
  }
}

MediaPipelineTransmit::~MediaPipelineTransmit()
{
  if (mFeeder) {
    mFeeder->Detach();
  }

  MOZ_ASSERT(!mDomTrack);
}

void
MediaPipeline::SetDescription_s(const std::string& description)
{
  mDescription = description;
}

void
MediaPipelineTransmit::SetDescription()
{
  std::string description;
  description = mPc + "| ";
  description += mConduit->type() == MediaSessionConduit::AUDIO
                    ? "Transmit audio["
                    : "Transmit video[";

  if (!mDomTrack) {
    description += "no track]";
    return;
  }

  nsString nsTrackId;
  mDomTrack->GetId(nsTrackId);
  std::string trackId(NS_ConvertUTF16toUTF8(nsTrackId).get());
  description += trackId;
  description += "]";

  RUN_ON_THREAD(
    mStsThread,
    WrapRunnable(RefPtr<MediaPipeline>(this),
                 &MediaPipelineTransmit::SetDescription_s,
                 description),
    NS_DISPATCH_NORMAL);
}

void
MediaPipelineTransmit::Stop()
{
  ASSERT_ON_THREAD(mMainThread);

  if (!mDomTrack || !mTransmitting) {
    return;
  }

  mTransmitting = false;

  if (mDomTrack->AsAudioStreamTrack()) {
    mDomTrack->RemoveDirectListener(mListener);
    mDomTrack->RemoveListener(mListener);
  } else if (VideoStreamTrack* video = mDomTrack->AsVideoStreamTrack()) {
    video->RemoveVideoOutput(mListener);
  } else {
    MOZ_ASSERT(false, "Unknown track type");
  }

  mConduit->StopTransmitting();
}

void
MediaPipelineTransmit::Start()
{
  ASSERT_ON_THREAD(mMainThread);

  if (!mDomTrack || mTransmitting) {
    return;
  }

  mTransmitting = true;

  mConduit->StartTransmitting();

  // TODO(ekr@rtfm.com): Check for errors
  CSFLogDebug(
    LOGTAG,
    "Attaching pipeline to track %p conduit type=%s",
    this,
    (mConduit->type() == MediaSessionConduit::AUDIO ? "audio" : "video"));

#if !defined(MOZILLA_EXTERNAL_LINKAGE)
  // With full duplex we don't risk having audio come in late to the MSG
  // so we won't need a direct listener.
  const bool enableDirectListener =
    !Preferences::GetBool("media.navigator.audio.full_duplex", false);
#else
  const bool enableDirectListener = true;
#endif

  if (mDomTrack->AsAudioStreamTrack()) {
    if (enableDirectListener) {
      // Register the Listener directly with the source if we can.
      // We also register it as a non-direct listener so we fall back to that
      // if installing the direct listener fails. As a direct listener we get
      // access to direct unqueued (and not resampled) data.
      mDomTrack->AddDirectListener(mListener);
    }
    mDomTrack->AddListener(mListener);
  } else if (VideoStreamTrack* video = mDomTrack->AsVideoStreamTrack()) {
    video->AddVideoOutput(mListener);
  } else {
    MOZ_ASSERT(false, "Unknown track type");
  }
}

bool
MediaPipelineTransmit::IsVideo() const
{
  return mIsVideo;
}

void
MediaPipelineTransmit::UpdateSinkIdentity_m(const MediaStreamTrack* aTrack,
                                            nsIPrincipal* aPrincipal,
                                            const PeerIdentity* aSinkIdentity)
{
  ASSERT_ON_THREAD(mMainThread);

  if (aTrack != nullptr && aTrack != mDomTrack) {
    // If a track is specified, then it might not be for this pipeline,
    // since we receive notifications for all tracks on the PC.
    // nullptr means that the PeerIdentity has changed and shall be applied
    // to all tracks of the PC.
    return;
  }

  if (!mDomTrack) {
    // Nothing to do here
    return;
  }

  bool enableTrack = aPrincipal->Subsumes(mDomTrack->GetPrincipal());
  if (!enableTrack) {
    // first try didn't work, but there's a chance that this is still available
    // if our track is bound to a peerIdentity, and the peer connection (our
    // sink) is bound to the same identity, then we can enable the track.
    const PeerIdentity* trackIdentity = mDomTrack->GetPeerIdentity();
    if (aSinkIdentity && trackIdentity) {
      enableTrack = (*aSinkIdentity == *trackIdentity);
    }
  }

  mListener->SetEnabled(enableTrack);
}

void
MediaPipelineTransmit::DetachMedia()
{
  ASSERT_ON_THREAD(mMainThread);
  mDomTrack = nullptr;
  // Let the listener be destroyed with the pipeline (or later).
}

nsresult
MediaPipelineTransmit::TransportReady_s(TransportInfo& aInfo)
{
  ASSERT_ON_THREAD(mStsThread);
  // Call base ready function.
  MediaPipeline::TransportReady_s(aInfo);

  // Should not be set for a transmitter
  if (&aInfo == &mRtp) {
    mListener->SetActive(true);
  }

  return NS_OK;
}

nsresult
MediaPipelineTransmit::SetTrack(MediaStreamTrack* aDomTrack)
{
  // MainThread, checked in calls we make
  if (aDomTrack) {
    nsString nsTrackId;
    aDomTrack->GetId(nsTrackId);
    std::string track_id(NS_ConvertUTF16toUTF8(nsTrackId).get());
    CSFLogDebug(
      LOGTAG,
      "Reattaching pipeline to track %p track %s conduit type: %s",
      &aDomTrack,
      track_id.c_str(),
      (mConduit->type() == MediaSessionConduit::AUDIO ? "audio" : "video"));
  }

  RefPtr<dom::MediaStreamTrack> oldTrack = mDomTrack;
  bool wasTransmitting = oldTrack && mTransmitting;
  Stop();
  mDomTrack = aDomTrack;
  SetDescription();

  if (wasTransmitting) {
    Start();
  }
  return NS_OK;
}

nsresult
MediaPipeline::ConnectTransport_s(TransportInfo& aInfo)
{
  MOZ_ASSERT(aInfo.mTransport);
  MOZ_ASSERT(aInfo.mSrtp);
  ASSERT_ON_THREAD(mStsThread);

  // Look to see if the transport is ready
  if (aInfo.mSrtp->state() == TransportLayer::TS_OPEN) {
    nsresult res = TransportReady_s(aInfo);
    if (NS_FAILED(res)) {
      CSFLogError(LOGTAG,
                  "Error calling TransportReady(); res=%u in %s",
                  static_cast<uint32_t>(res),
                  __FUNCTION__);
      return res;
    }
  } else if (aInfo.mSrtp->state() == TransportLayer::TS_ERROR) {
    CSFLogError(
      LOGTAG, "%s transport is already in error state", ToString(aInfo.mType));
    TransportFailed_s(aInfo);
    return NS_ERROR_FAILURE;
  }

  aInfo.mSrtp->SignalStateChange.connect(this, &MediaPipeline::StateChange);

  return NS_OK;
}

MediaPipeline::TransportInfo*
MediaPipeline::GetTransportInfo_s(TransportLayer* aLayer)
{
  ASSERT_ON_THREAD(mStsThread);
  if (aLayer == mRtp.mSrtp) {
    return &mRtp;
  }

  if (aLayer == mRtcp.mSrtp) {
    return &mRtcp;
  }

  return nullptr;
}

nsresult
MediaPipeline::PipelineTransport::SendRtpPacket(const uint8_t* aData, size_t aLen)
{
  nsAutoPtr<MediaPacket> packet(new MediaPacket);
  packet->Copy(aData, aLen, aLen + SRTP_MAX_EXPANSION);
  packet->SetType(MediaPacket::RTP);

  RUN_ON_THREAD(
    mStsThread,
    WrapRunnable(RefPtr<MediaPipeline::PipelineTransport>(this),
                 &MediaPipeline::PipelineTransport::SendRtpRtcpPacket_s,
                 packet),
    NS_DISPATCH_NORMAL);

  return NS_OK;
}

nsresult
MediaPipeline::PipelineTransport::SendRtpRtcpPacket_s(
  nsAutoPtr<MediaPacket> aPacket)
{
  bool isRtp = aPacket->type() == MediaPacket::RTP;

  ASSERT_ON_THREAD(mStsThread);
  if (!mPipeline) {
    return NS_OK; // Detached
  }

  TransportInfo& transport = isRtp ? mPipeline->mRtp : mPipeline->mRtcp;

  if (transport.mSrtp->state() != TransportLayer::TS_OPEN) {
    // SRTP not ready yet.
    return NS_OK;
  }

  MOZ_ASSERT(transport.mTransport);
  NS_ENSURE_TRUE(transport.mTransport, NS_ERROR_NULL_POINTER);

  MediaPacket packet(std::move(*aPacket));
  packet.sdp_level() = Some(mPipeline->Level());

  if (RtpLogger::IsPacketLoggingOn()) {
    RtpLogger::LogPacket(packet, false, mPipeline->mDescription);
  }

  if (isRtp) {
    mPipeline->mPacketDumper->Dump(mPipeline->Level(),
                                    dom::mozPacketDumpType::Rtp,
                                    true,
                                    packet.data(),
                                    packet.len());
    mPipeline->IncrementRtpPacketsSent(packet.len());
  } else {
    mPipeline->mPacketDumper->Dump(mPipeline->Level(),
                                    dom::mozPacketDumpType::Rtcp,
                                    true,
                                    packet.data(),
                                    packet.len());
    mPipeline->IncrementRtcpPacketsSent();
  }

  CSFLogDebug(LOGTAG,
              "%s sending %s packet",
              mPipeline->mDescription.c_str(),
              (isRtp ? "RTP" : "RTCP"));

  return mPipeline->SendPacket(transport.mSrtp, packet);
}

nsresult
MediaPipeline::PipelineTransport::SendRtcpPacket(const uint8_t* aData,
                                                 size_t aLen)
{
  nsAutoPtr<MediaPacket> packet(new MediaPacket);
  packet->Copy(aData, aLen, aLen + SRTP_MAX_EXPANSION);
  packet->SetType(MediaPacket::RTCP);

  RUN_ON_THREAD(
    mStsThread,
    WrapRunnable(RefPtr<MediaPipeline::PipelineTransport>(this),
                 &MediaPipeline::PipelineTransport::SendRtpRtcpPacket_s,
                 packet),
    NS_DISPATCH_NORMAL);

  return NS_OK;
}

// Called if we're attached with AddDirectListener()
void
MediaPipelineTransmit::PipelineListener::NotifyRealtimeTrackData(
  MediaStreamGraph* aGraph,
  StreamTime aOffset,
  const MediaSegment& aMedia)
{
  CSFLogDebug(
    LOGTAG,
    "MediaPipeline::NotifyRealtimeTrackData() listener=%p, offset=%" PRId64
    ", duration=%" PRId64,
    this,
    aOffset,
    aMedia.GetDuration());

  if (aMedia.GetType() == MediaSegment::VIDEO) {
    TRACE_COMMENT("Video");
    // We have to call the upstream NotifyRealtimeTrackData and
    // MediaStreamVideoSink will route them to SetCurrentFrames.
    MediaStreamVideoSink::NotifyRealtimeTrackData(aGraph, aOffset, aMedia);
    return;
  }
  TRACE_COMMENT("Audio");
  NewData(aMedia, aGraph->GraphRate());
}

void
MediaPipelineTransmit::PipelineListener::NotifyQueuedChanges(
  MediaStreamGraph* aGraph,
  StreamTime aOffset,
  const MediaSegment& aQueuedMedia)
{
  CSFLogDebug(LOGTAG, "MediaPipeline::NotifyQueuedChanges()");

  if (aQueuedMedia.GetType() == MediaSegment::VIDEO) {
    // We always get video from SetCurrentFrames().
    return;
  }

  if (mDirectConnect) {
    // ignore non-direct data if we're also getting direct data
    return;
  }

  size_t rate;
  if (aGraph) {
    rate = aGraph->GraphRate();
  } else {
    // When running tests, graph may be null. In that case use a default.
    rate = 16000;
  }
  NewData(aQueuedMedia, rate);
}

void
MediaPipelineTransmit::PipelineListener::NotifyDirectListenerInstalled(
  InstallationResult aResult)
{
  CSFLogInfo(
    LOGTAG,
    "MediaPipeline::NotifyDirectListenerInstalled() listener=%p, result=%d",
    this,
    static_cast<int32_t>(aResult));

  mDirectConnect = InstallationResult::SUCCESS == aResult;
}

void
MediaPipelineTransmit::PipelineListener::NotifyDirectListenerUninstalled()
{
  CSFLogInfo(LOGTAG,
             "MediaPipeline::NotifyDirectListenerUninstalled() listener=%p",
             this);

  mDirectConnect = false;
}

void
MediaPipelineTransmit::PipelineListener::NewData(const MediaSegment& aMedia,
                                                 TrackRate aRate /* = 0 */)
{
  if (!mActive) {
    CSFLogDebug(LOGTAG, "Discarding packets because transport not ready");
    return;
  }

  if (mConduit->type() != (aMedia.GetType() == MediaSegment::AUDIO
                             ? MediaSessionConduit::AUDIO
                             : MediaSessionConduit::VIDEO)) {
    MOZ_ASSERT(false,
               "The media type should always be correct since the "
               "listener is locked to a specific track");
    return;
  }

  // TODO(ekr@rtfm.com): For now assume that we have only one
  // track type and it's destined for us
  // See bug 784517
  if (aMedia.GetType() == MediaSegment::AUDIO) {
    MOZ_RELEASE_ASSERT(aRate > 0);

    const AudioSegment* audio = static_cast<const AudioSegment*>(&aMedia);
    for (AudioSegment::ConstChunkIterator iter(*audio); !iter.IsEnded();
         iter.Next()) {
      mAudioProcessing->QueueAudioChunk(aRate, *iter, mEnabled);
    }
  } else {
    const VideoSegment* video = static_cast<const VideoSegment*>(&aMedia);

    for (VideoSegment::ConstChunkIterator iter(*video); !iter.IsEnded();
         iter.Next()) {
      mConverter->QueueVideoChunk(*iter, !mEnabled);
    }
  }
}

void
MediaPipelineTransmit::PipelineListener::SetCurrentFrames(
  const VideoSegment& aSegment)
{
  NewData(aSegment);
}

class GenericReceiveListener : public MediaStreamListener
{
public:
  explicit GenericReceiveListener(dom::MediaStreamTrack* aTrack)
    : mTrack(aTrack)
    , mTrackId(aTrack->GetInputTrackId())
    , mSource(mTrack->GetInputStream()->AsSourceStream())
    , mPlayedTicks(0)
    , mPrincipalHandle(PRINCIPAL_HANDLE_NONE)
    , mListening(false)
    , mMaybeTrackNeedsUnmute(true)
  {
    MOZ_RELEASE_ASSERT(mSource, "Must be used with a SourceMediaStream");
  }

  virtual ~GenericReceiveListener()
  {
    NS_ReleaseOnMainThreadSystemGroup(
      "GenericReceiveListener::track_", mTrack.forget());
  }

  void AddTrackToSource(uint32_t aRate = 0)
  {
    MOZ_ASSERT((aRate != 0 && mTrack->AsAudioStreamTrack()) ||
               mTrack->AsVideoStreamTrack());

    if (mTrack->AsAudioStreamTrack()) {
      mSource->AddAudioTrack(
          mTrackId, aRate, 0, new AudioSegment());
    } else if (mTrack->AsVideoStreamTrack()) {
      mSource->AddTrack(mTrackId, 0, new VideoSegment());
    }
    CSFLogDebug(
      LOGTAG,
      "GenericReceiveListener added %s track %d (%p) to stream %p",
      mTrack->AsAudioStreamTrack() ? "audio" : "video",
      mTrackId,
      mTrack.get(),
      mSource.get());

    mSource->AdvanceKnownTracksTime(STREAM_TIME_MAX);
    mSource->AddListener(this);
  }

  void AddSelf()
  {
    if (!mListening) {
      mListening = true;
      mSource->SetPullEnabled(true);
      mMaybeTrackNeedsUnmute = true;
    }
  }

  void RemoveSelf()
  {
    if (mListening) {
      mListening = false;
      mSource->SetPullEnabled(false);
    }
  }

  void OnRtpReceived()
  {
    if (mMaybeTrackNeedsUnmute) {
      mMaybeTrackNeedsUnmute = false;
      NS_DispatchToMainThread(
        NewRunnableMethod("GenericReceiveListener::OnRtpReceived_m",
                          this,
                          &GenericReceiveListener::OnRtpReceived_m));
    }
  }

  void OnRtpReceived_m()
  {
    if (mListening && mTrack->Muted()) {
      mTrack->MutedChanged(false);
    }
  }

  void EndTrack()
  {
    CSFLogDebug(LOGTAG, "GenericReceiveListener ending track");


    // This breaks the cycle with the SourceMediaStream
    mSource->RemoveListener(this);
    mSource->EndTrack(mTrackId);
  }

  // Must be called on the main thread
  void SetPrincipalHandle_m(const PrincipalHandle& aPrincipalHandle)
  {
    class Message : public ControlMessage
    {
    public:
      Message(GenericReceiveListener* aListener,
              const PrincipalHandle& aPrincipalHandle)
        : ControlMessage(nullptr)
        , mListener(aListener)
        , mPrincipalHandle(aPrincipalHandle)
      {
      }

      void Run() override
      {
        mListener->SetPrincipalHandle_msg(mPrincipalHandle);
      }

      const RefPtr<GenericReceiveListener> mListener;
      PrincipalHandle mPrincipalHandle;
    };

    mTrack->GraphImpl()->AppendMessage(
      MakeUnique<Message>(this, aPrincipalHandle));
  }

  // Must be called on the MediaStreamGraph thread
  void SetPrincipalHandle_msg(const PrincipalHandle& aPrincipalHandle)
  {
    mPrincipalHandle = aPrincipalHandle;
  }

protected:
  RefPtr<dom::MediaStreamTrack> mTrack;
  const TrackID mTrackId;
  const RefPtr<SourceMediaStream> mSource;
  TrackTicks mPlayedTicks;
  PrincipalHandle mPrincipalHandle;
  bool mListening;
  Atomic<bool> mMaybeTrackNeedsUnmute;
};

MediaPipelineReceive::MediaPipelineReceive(const std::string& aPc,
                                           nsCOMPtr<nsIEventTarget> aMainThread,
                                           nsCOMPtr<nsIEventTarget> aStsThread,
                                           RefPtr<MediaSessionConduit> aConduit)
  : MediaPipeline(aPc,
                  DirectionType::RECEIVE,
                  aMainThread,
                  aStsThread,
                  aConduit)
{
}

MediaPipelineReceive::~MediaPipelineReceive() {}

class MediaPipelineReceiveAudio::PipelineListener
  : public GenericReceiveListener
{
public:
  PipelineListener(dom::MediaStreamTrack* aTrack,
                   const RefPtr<MediaSessionConduit>& aConduit)
    : GenericReceiveListener(aTrack)
    , mConduit(aConduit)
    // AudioSession conduit only supports 16, 32, 44.1 and 48kHz
    // This is an artificial limitation, it would however require more changes
    // to support any rates.
    // If the sampling rate is not-supported, we will use 48kHz instead.
    , mRate(static_cast<AudioSessionConduit*>(mConduit.get())
                ->IsSamplingFreqSupported(mSource->GraphRate())
              ? mSource->GraphRate()
              : WEBRTC_MAX_SAMPLE_RATE)
    , mTaskQueue(
        new AutoTaskQueue(GetMediaThreadPool(MediaThreadType::WEBRTC_DECODER),
                          "AudioPipelineListener"))
    , mLastLog(0)
  {
    AddTrackToSource(mRate);
  }

  // Implement MediaStreamListener
  void NotifyPull(MediaStreamGraph* aGraph,
                  StreamTime aDesiredTime) override
  {
    NotifyPullImpl(aDesiredTime);
  }

private:
  ~PipelineListener()
  {
    NS_ReleaseOnMainThreadSystemGroup("MediaPipeline::mConduit",
                                      mConduit.forget());
  }

  void NotifyPullImpl(StreamTime aDesiredTime)
  {
    TRACE();
    uint32_t samplesPer10ms = mRate / 100;

    // mSource's rate is not necessarily the same as the graph rate, since there
    // are sample-rate constraints on the inbound audio: only 16, 32, 44.1 and
    // 48kHz are supported. The audio frames we get here is going to be
    // resampled when inserted into the graph.
    TrackTicks desired = mSource->TimeToTicksRoundUp(mRate, aDesiredTime);
    TrackTicks framesNeeded = desired - mPlayedTicks;

    while (framesNeeded >= 0) {
      const int scratchBufferLength =
        AUDIO_SAMPLE_BUFFER_MAX_BYTES / sizeof(int16_t);
      int16_t scratchBuffer[scratchBufferLength];

      int samplesLength = scratchBufferLength;

      // This fetches 10ms of data, either mono or stereo
      MediaConduitErrorCode err =
        static_cast<AudioSessionConduit*>(mConduit.get())
          ->GetAudioFrame(scratchBuffer,
                          mRate,
                          0, // TODO(ekr@rtfm.com): better estimate of "capture"
                             // (really playout) delay
                          samplesLength);

      if (err != kMediaConduitNoError) {
        // Insert silence on conduit/GIPS failure (extremely unlikely)
        CSFLogError(LOGTAG,
                    "Audio conduit failed (%d) to return data @ %" PRId64
                    " (desired %" PRId64 " -> %f)",
                    err,
                    mPlayedTicks,
                    aDesiredTime,
                    mSource->StreamTimeToSeconds(aDesiredTime));
        // if this is not enough we'll loop and provide more
        samplesLength = samplesPer10ms;
        PodArrayZero(scratchBuffer);
      }

      MOZ_RELEASE_ASSERT(samplesLength <= scratchBufferLength);

      CSFLogDebug(
        LOGTAG, "Audio conduit returned buffer of length %u", samplesLength);

      RefPtr<SharedBuffer> samples =
        SharedBuffer::Create(samplesLength * sizeof(uint16_t));
      int16_t* samplesData = static_cast<int16_t*>(samples->Data());
      AudioSegment segment;
      // We derive the number of channels of the stream from the number of
      // samples the AudioConduit gives us, considering it gives us packets of
      // 10ms and we know the rate.
      uint32_t channelCount = samplesLength / samplesPer10ms;
      AutoTArray<int16_t*,2> channels;
      AutoTArray<const int16_t*,2> outputChannels;
      size_t frames = samplesLength / channelCount;

      channels.SetLength(channelCount);

      size_t offset = 0;
      for (size_t i = 0; i < channelCount; i++) {
        channels[i] = samplesData + offset;
        offset += frames;
      }

      DeinterleaveAndConvertBuffer(
        scratchBuffer, frames, channelCount, channels.Elements());

      outputChannels.AppendElements(channels);

      segment.AppendFrames(
        samples.forget(), outputChannels, frames, mPrincipalHandle);

      // Handle track not actually added yet or removed/finished
      if (mSource->AppendToTrack(mTrackId, &segment)) {
        framesNeeded -= frames;
        mPlayedTicks += frames;
        if (MOZ_LOG_TEST(AudioLogModule(), LogLevel::Debug)) {
          if (mPlayedTicks > mLastLog + mRate) {
            MOZ_LOG(AudioLogModule(),
                    LogLevel::Debug,
                    ("%p: Inserting samples into track %d, total = "
                     "%" PRIu64,
                     (void*)this,
                     mTrackId,
                     mPlayedTicks));
            mLastLog = mPlayedTicks;
          }
        }
      } else {
        CSFLogError(LOGTAG, "AppendToTrack failed");
        // we can't un-read the data, but that's ok since we don't want to
        // buffer - but don't i-loop!
        break;
      }
    }
  }

  RefPtr<MediaSessionConduit> mConduit;
  const TrackRate mRate;
  const RefPtr<AutoTaskQueue> mTaskQueue;
  // Graph's current sampling rate
  TrackTicks mLastLog = 0; // mPlayedTicks when we last logged
};

MediaPipelineReceiveAudio::MediaPipelineReceiveAudio(
  const std::string& aPc,
  nsCOMPtr<nsIEventTarget> aMainThread,
  nsCOMPtr<nsIEventTarget> aStsThread,
  RefPtr<AudioSessionConduit> aConduit,
  dom::MediaStreamTrack* aTrack)
  : MediaPipelineReceive(aPc, aMainThread, aStsThread, aConduit)
  , mListener(aTrack ? new PipelineListener(aTrack, mConduit) : nullptr)
{
  mDescription = mPc + "| Receive audio";
}

void
MediaPipelineReceiveAudio::DetachMedia()
{
  ASSERT_ON_THREAD(mMainThread);
  if (mListener) {
    mListener->EndTrack();
    mListener = nullptr;
  }
}

void
MediaPipelineReceiveAudio::SetPrincipalHandle_m(
  const PrincipalHandle& aPrincipalHandle)
{
  if (mListener) {
    mListener->SetPrincipalHandle_m(aPrincipalHandle);
  }
}

void
MediaPipelineReceiveAudio::Start()
{
  mConduit->StartReceiving();
  if (mListener) {
    mListener->AddSelf();
  }
}

void
MediaPipelineReceiveAudio::Stop()
{
  if (mListener) {
    mListener->RemoveSelf();
  }
  mConduit->StopReceiving();
}

void
MediaPipelineReceiveAudio::OnRtpPacketReceived()
{
  if (mListener) {
    mListener->OnRtpReceived();
  }
}

class MediaPipelineReceiveVideo::PipelineListener
  : public GenericReceiveListener
{
public:
  explicit PipelineListener(dom::MediaStreamTrack* aTrack)
    : GenericReceiveListener(aTrack)
    , mWidth(0)
    , mHeight(0)
    , mImageContainer(
        LayerManager::CreateImageContainer(ImageContainer::ASYNCHRONOUS))
    , mMutex("Video PipelineListener")
  {
    AddTrackToSource();
  }

  // Implement MediaStreamListener
  void NotifyPull(MediaStreamGraph* aGraph, StreamTime aDesiredTime) override
  {
    MutexAutoLock lock(mMutex);

    RefPtr<Image> image = mImage;
    StreamTime delta = aDesiredTime - mPlayedTicks;

    // Don't append if we've already provided a frame that supposedly
    // goes past the current aDesiredTime Doing so means a negative
    // delta and thus messes up handling of the graph
    if (delta > 0) {
      VideoSegment segment;
      IntSize size = image ? image->GetSize() : IntSize(mWidth, mHeight);
      segment.AppendFrame(image.forget(), delta, size, mPrincipalHandle);
      // Handle track not actually added yet or removed/finished
      if (!mSource->AppendToTrack(mTrackId, &segment)) {
        CSFLogError(LOGTAG, "AppendToTrack failed");
        return;
      }
      mPlayedTicks = aDesiredTime;
    }
  }

  // Accessors for external writes from the renderer
  void FrameSizeChange(unsigned int aWidth,
                       unsigned int aHeight,
                       unsigned int aNumberOfStreams)
  {
    MutexAutoLock enter(mMutex);

    mWidth = aWidth;
    mHeight = aHeight;
  }

  void RenderVideoFrame(const webrtc::VideoFrameBuffer& aBuffer,
                        uint32_t aTimeStamp,
                        int64_t aRenderTime)
  {
    if (aBuffer.native_handle()) {
      // We assume that only native handles are used with the
      // WebrtcMediaDataDecoderCodec decoder.
      RefPtr<Image> image = static_cast<Image*>(aBuffer.native_handle());
      MutexAutoLock lock(mMutex);
      mImage = image;
      return;
    }

    MOZ_ASSERT(aBuffer.DataY());
    // Create a video frame using |buffer|.
    RefPtr<PlanarYCbCrImage> yuvImage =
      mImageContainer->CreatePlanarYCbCrImage();

    PlanarYCbCrData yuvData;
    yuvData.mYChannel = const_cast<uint8_t*>(aBuffer.DataY());
    yuvData.mYSize = IntSize(aBuffer.width(), aBuffer.height());
    yuvData.mYStride = aBuffer.StrideY();
    MOZ_ASSERT(aBuffer.StrideU() == aBuffer.StrideV());
    yuvData.mCbCrStride = aBuffer.StrideU();
    yuvData.mCbChannel = const_cast<uint8_t*>(aBuffer.DataU());
    yuvData.mCrChannel = const_cast<uint8_t*>(aBuffer.DataV());
    yuvData.mCbCrSize =
      IntSize((aBuffer.width() + 1) >> 1, (aBuffer.height() + 1) >> 1);
    yuvData.mPicX = 0;
    yuvData.mPicY = 0;
    yuvData.mPicSize = IntSize(aBuffer.width(), aBuffer.height());
    yuvData.mStereoMode = StereoMode::MONO;

    if (!yuvImage->CopyData(yuvData)) {
      MOZ_ASSERT(false);
      return;
    }

    MutexAutoLock lock(mMutex);
    mImage = yuvImage;
  }

private:
  int mWidth;
  int mHeight;
  RefPtr<layers::ImageContainer> mImageContainer;
  RefPtr<layers::Image> mImage;
  Mutex mMutex; // Mutex for processing WebRTC frames.
                // Protects mImage against:
                // - Writing from the GIPS thread
                // - Reading from the MSG thread
};

class MediaPipelineReceiveVideo::PipelineRenderer
  : public mozilla::VideoRenderer
{
public:
  explicit PipelineRenderer(MediaPipelineReceiveVideo* aPipeline)
    : mPipeline(aPipeline)
  {
  }

  void Detach() { mPipeline = nullptr; }

  // Implement VideoRenderer
  void FrameSizeChange(unsigned int aWidth,
                       unsigned int aHeight,
                       unsigned int aNumberOfStreams) override
  {
    mPipeline->mListener->FrameSizeChange(aWidth, aHeight, aNumberOfStreams);
  }

  void RenderVideoFrame(const webrtc::VideoFrameBuffer& aBuffer,
                        uint32_t aTimeStamp,
                        int64_t aRenderTime) override
  {
    mPipeline->mListener->RenderVideoFrame(aBuffer, aTimeStamp, aRenderTime);
  }

private:
  MediaPipelineReceiveVideo* mPipeline; // Raw pointer to avoid cycles
};

MediaPipelineReceiveVideo::MediaPipelineReceiveVideo(
  const std::string& aPc,
  nsCOMPtr<nsIEventTarget> aMainThread,
  nsCOMPtr<nsIEventTarget> aStsThread,
  RefPtr<VideoSessionConduit> aConduit,
  dom::MediaStreamTrack* aTrack)
  : MediaPipelineReceive(aPc, aMainThread, aStsThread, aConduit)
  , mRenderer(new PipelineRenderer(this))
  , mListener(aTrack ? new PipelineListener(aTrack) : nullptr)
{
  mDescription = mPc + "| Receive video";
  aConduit->AttachRenderer(mRenderer);
}

void
MediaPipelineReceiveVideo::DetachMedia()
{
  ASSERT_ON_THREAD(mMainThread);

  // stop generating video and thus stop invoking the PipelineRenderer
  // and PipelineListener - the renderer has a raw ptr to the Pipeline to
  // avoid cycles, and the render callbacks are invoked from a different
  // thread so simple null-checks would cause TSAN bugs without locks.
  static_cast<VideoSessionConduit*>(mConduit.get())->DetachRenderer();
  if (mListener) {
    mListener->EndTrack();
    mListener = nullptr;
  }
}

void
MediaPipelineReceiveVideo::SetPrincipalHandle_m(
  const PrincipalHandle& aPrincipalHandle)
{
  if (mListener) {
    mListener->SetPrincipalHandle_m(aPrincipalHandle);
  }
}

void
MediaPipelineReceiveVideo::Start()
{
  mConduit->StartReceiving();
  if (mListener) {
    mListener->AddSelf();
  }
}

void
MediaPipelineReceiveVideo::Stop()
{
  if (mListener) {
    mListener->RemoveSelf();
  }
  mConduit->StopReceiving();
}

void
MediaPipelineReceiveVideo::OnRtpPacketReceived()
{
  if (mListener) {
    mListener->OnRtpReceived();
  }
}

DOMHighResTimeStamp
MediaPipeline::GetNow()
{
  return webrtc::Clock::GetRealTimeClock()->TimeInMilliseconds();
}

DOMHighResTimeStamp
MediaPipeline::RtpCSRCStats::GetExpiryFromTime(const DOMHighResTimeStamp aTime)
{
  // DOMHighResTimeStamp is a unit measured in ms
  return aTime - EXPIRY_TIME_MILLISECONDS;
}

MediaPipeline::RtpCSRCStats::RtpCSRCStats(const uint32_t aCsrc,
                                          const DOMHighResTimeStamp aTime)
  : mCsrc(aCsrc)
  , mTimestamp(aTime)
{
}

void
MediaPipeline::RtpCSRCStats::GetWebidlInstance(
  dom::RTCRTPContributingSourceStats& aWebidlObj,
  const nsString& aInboundRtpStreamId) const
{
  nsString statId = NS_LITERAL_STRING("csrc_") + aInboundRtpStreamId;
  statId.AppendLiteral("_");
  statId.AppendInt(mCsrc);
  aWebidlObj.mId.Construct(statId);
  aWebidlObj.mType.Construct(RTCStatsType::Csrc);
  aWebidlObj.mTimestamp.Construct(mTimestamp);
  aWebidlObj.mContributorSsrc.Construct(mCsrc);
  aWebidlObj.mInboundRtpStreamId.Construct(aInboundRtpStreamId);
}

} // end namespace
