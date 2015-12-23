/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __FFmpegH264Decoder_h__
#define __FFmpegH264Decoder_h__

#include "FFmpegDataDecoder.h"
#include "mozilla/Pair.h"
#include "nsTArray.h"

namespace mozilla
{

template <int V>
class FFmpegH264Decoder : public FFmpegDataDecoder<V>
{
};

template <>
class FFmpegH264Decoder<LIBAV_VER> : public FFmpegDataDecoder<LIBAV_VER>
{
  typedef mozilla::layers::Image Image;
  typedef mozilla::layers::ImageContainer ImageContainer;

  enum DecodeResult {
    DECODE_FRAME,
    DECODE_NO_FRAME,
    DECODE_ERROR
  };

public:
  FFmpegH264Decoder(FlushableTaskQueue* aTaskQueue,
                    MediaDataDecoderCallback* aCallback,
                    const VideoInfo& aConfig,
                    ImageContainer* aImageContainer);
  virtual ~FFmpegH264Decoder();

  virtual nsRefPtr<InitPromise> Init() override;
  virtual nsresult Input(MediaRawData* aSample) override;
  virtual void ProcessDrain() override;
  virtual void ProcessFlush() override;
  static AVCodecID GetCodecId(const nsACString& aMimeType);

private:
  void DecodeFrame(MediaRawData* aSample);
  DecodeResult DoDecodeFrame(MediaRawData* aSample);
  DecodeResult DoDecodeFrame(MediaRawData* aSample, uint8_t* aData, int aSize);
  void DoDrain();
  void OutputDelayedFrames();

  /**
   * This method allocates a buffer for FFmpeg's decoder, wrapped in an Image.
   * Currently it only supports Planar YUV420, which appears to be the only
   * non-hardware accelerated image format that FFmpeg's H264 decoder is
   * capable of outputting.
   */
  int AllocateYUV420PVideoBuffer(AVCodecContext* aCodecContext,
                                 AVFrame* aFrame);

  static int AllocateBufferCb(AVCodecContext* aCodecContext, AVFrame* aFrame);
  static void ReleaseBufferCb(AVCodecContext* aCodecContext, AVFrame* aFrame);

  nsRefPtr<ImageContainer> mImageContainer;
  uint32_t mPictureWidth;
  uint32_t mPictureHeight;
  uint32_t mDisplayWidth;
  uint32_t mDisplayHeight;

  class PtsCorrectionContext {
  public:
    PtsCorrectionContext();
    int64_t GuessCorrectPts(int64_t aPts, int64_t aDts);
    void Reset();

  private:
    int64_t mNumFaultyPts; /// Number of incorrect PTS values so far
    int64_t mNumFaultyDts; /// Number of incorrect DTS values so far
    int64_t mLastPts;       /// PTS of the last frame
    int64_t mLastDts;       /// DTS of the last frame
  };

  PtsCorrectionContext mPtsContext;

  class DurationMap {
  public:
    typedef Pair<int64_t, int64_t> DurationElement;

    // Insert Dts and Duration pair at the end of our map.
    void Insert(int64_t aDts, int64_t aDuration)
    {
      mMap.AppendElement(MakePair(aDts, aDuration));
    }
    // Sets aDuration matching aDts and remove it from the map if found.
    // The element returned is the first one found.
    // Returns true if found, false otherwise.
    bool Find(int64_t aDts, int64_t& aDuration)
    {
      for (uint32_t i = 0; i < mMap.Length(); i++) {
        DurationElement& element = mMap[i];
        if (element.first() == aDts) {
          aDuration = element.second();
          mMap.RemoveElementAt(i);
          return true;
        }
      }
      return false;
    }
    // Remove all elements of the map.
    void Clear()
    {
      mMap.Clear();
    }

  private:
    nsAutoTArray<DurationElement, 16> mMap;
  };

  DurationMap mDurationMap;
};

} // namespace mozilla

#endif // __FFmpegH264Decoder_h__
