/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "AudioBuffer.h"
#include "mozilla/dom/AudioBufferBinding.h"
#include "jsfriendapi.h"
#include "mozilla/ErrorResult.h"
#include "AudioSegment.h"
#include "AudioChannelFormat.h"
#include "mozilla/PodOperations.h"
#include "mozilla/CheckedInt.h"
#include "AudioNodeEngine.h"

namespace mozilla {
namespace dom {

NS_IMPL_CYCLE_COLLECTION_CLASS(AudioBuffer)

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN(AudioBuffer)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mJSChannels)
  NS_IMPL_CYCLE_COLLECTION_UNLINK_PRESERVED_WRAPPER
  tmp->ClearJSChannels();
NS_IMPL_CYCLE_COLLECTION_UNLINK_END

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN(AudioBuffer)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE_SCRIPT_OBJECTS
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTION_TRACE_BEGIN(AudioBuffer)
  NS_IMPL_CYCLE_COLLECTION_TRACE_PRESERVED_WRAPPER
  for (uint32_t i = 0; i < tmp->mJSChannels.Length(); ++i) {
    NS_IMPL_CYCLE_COLLECTION_TRACE_JS_MEMBER_CALLBACK(mJSChannels[i])
  }
NS_IMPL_CYCLE_COLLECTION_TRACE_END

NS_IMPL_CYCLE_COLLECTION_ROOT_NATIVE(AudioBuffer, AddRef)
NS_IMPL_CYCLE_COLLECTION_UNROOT_NATIVE(AudioBuffer, Release)

AudioBuffer::AudioBuffer(AudioContext* aContext, uint32_t aNumberOfChannels,
                         uint32_t aLength, float aSampleRate,
                         already_AddRefed<ThreadSharedFloatArrayBufferList>
                           aInitialContents)
  : mOwnerWindow(do_GetWeakReference(aContext->GetOwner())),
    mSharedChannels(aInitialContents),
    mLength(aLength),
    mSampleRate(aSampleRate)
{
  MOZ_ASSERT(!mSharedChannels ||
             mSharedChannels->GetChannels() == aNumberOfChannels);
  mJSChannels.SetLength(aNumberOfChannels);
  mozilla::HoldJSObjects(this);
}

AudioBuffer::~AudioBuffer()
{
  ClearJSChannels();
}

void
AudioBuffer::ClearJSChannels()
{
  mJSChannels.Clear();
  mozilla::DropJSObjects(this);
}

/* static */ already_AddRefed<AudioBuffer>
AudioBuffer::Create(AudioContext* aContext, uint32_t aNumberOfChannels,
                    uint32_t aLength, float aSampleRate,
                    already_AddRefed<ThreadSharedFloatArrayBufferList>
                      aInitialContents,
                    JSContext* aJSContext, ErrorResult& aRv)
{
  // Note that a buffer with zero channels is permitted here for the sake of
  // AudioProcessingEvent, where channel counts must match parameters passed
  // to createScriptProcessor(), one of which may be zero.
  if (aSampleRate < WebAudioUtils::MinSampleRate ||
      aSampleRate > WebAudioUtils::MaxSampleRate ||
      aNumberOfChannels > WebAudioUtils::MaxChannelCount ||
      !aLength || aLength > INT32_MAX) {
    aRv.Throw(NS_ERROR_DOM_INDEX_SIZE_ERR);
    return nullptr;
  }

  nsRefPtr<AudioBuffer> buffer =
    new AudioBuffer(aContext, aNumberOfChannels, aLength, aSampleRate,
                    Move(aInitialContents));

  return buffer.forget();
}

JSObject*
AudioBuffer::WrapObject(JSContext* aCx, JS::Handle<JSObject*> aGivenProto)
{
  return AudioBufferBinding::Wrap(aCx, this, aGivenProto);
}

bool
AudioBuffer::RestoreJSChannelData(JSContext* aJSContext)
{
  for (uint32_t i = 0; i < mJSChannels.Length(); ++i) {
    if (mJSChannels[i]) {
      // Already have data in JS array.
      continue;
    }

    // The following code first zeroes the array and then copies our data
    // into it. We could avoid this with additional JS APIs to construct
    // an array (or ArrayBuffer) containing initial data.
    JS::Rooted<JSObject*> array(aJSContext,
                                JS_NewFloat32Array(aJSContext, mLength));
    if (!array) {
      return false;
    }
    if (mSharedChannels) {
      // "4. Attach ArrayBuffers containing copies of the data to the
      // AudioBuffer, to be returned by the next call to getChannelData."
      const float* data = mSharedChannels->GetData(i);
      JS::AutoCheckCannotGC nogc;
      mozilla::PodCopy(JS_GetFloat32ArrayData(array, nogc), data, mLength);
    }
    mJSChannels[i] = array;
  }

  mSharedChannels = nullptr;

  return true;
}

void
AudioBuffer::CopyFromChannel(const Float32Array& aDestination, uint32_t aChannelNumber,
                             uint32_t aStartInChannel, ErrorResult& aRv)
{
  aDestination.ComputeLengthAndData();

  uint32_t length = aDestination.Length();
  CheckedInt<uint32_t> end = aStartInChannel;
  end += length;
  if (aChannelNumber >= NumberOfChannels() ||
      !end.isValid() || end.value() > mLength) {
    aRv.Throw(NS_ERROR_DOM_INDEX_SIZE_ERR);
    return;
  }

  JS::AutoCheckCannotGC nogc;
  JSObject* channelArray = mJSChannels[aChannelNumber];
  const float* sourceData = nullptr;
  if (channelArray) {
    if (JS_GetTypedArrayLength(channelArray) != mLength) {
      // The array was probably neutered
      aRv.Throw(NS_ERROR_DOM_INDEX_SIZE_ERR);
      return;
    }

    sourceData = JS_GetFloat32ArrayData(channelArray, nogc);
  } else if (mSharedChannels) {
    sourceData = mSharedChannels->GetData(aChannelNumber);
  }

  if (sourceData) {
    PodMove(aDestination.Data(), sourceData + aStartInChannel, length);
  } else {
    PodZero(aDestination.Data(), length);
  }
}

void
AudioBuffer::CopyToChannel(JSContext* aJSContext, const Float32Array& aSource,
                           uint32_t aChannelNumber, uint32_t aStartInChannel,
                           ErrorResult& aRv)
{
  aSource.ComputeLengthAndData();

  uint32_t length = aSource.Length();
  CheckedInt<uint32_t> end = aStartInChannel;
  end += length;
  if (aChannelNumber >= NumberOfChannels() ||
      !end.isValid() || end.value() > mLength) {
    aRv.Throw(NS_ERROR_DOM_INDEX_SIZE_ERR);
    return;
  }

  if (!RestoreJSChannelData(aJSContext)) {
    aRv.Throw(NS_ERROR_OUT_OF_MEMORY);
    return;
  }

  JS::AutoCheckCannotGC nogc;
  JSObject* channelArray = mJSChannels[aChannelNumber];
  if (JS_GetTypedArrayLength(channelArray) != mLength) {
    // The array was probably neutered
    aRv.Throw(NS_ERROR_DOM_INDEX_SIZE_ERR);
    return;
  }

  PodMove(JS_GetFloat32ArrayData(channelArray, nogc) + aStartInChannel,
          aSource.Data(), length);
}

void
AudioBuffer::GetChannelData(JSContext* aJSContext, uint32_t aChannel,
                            JS::MutableHandle<JSObject*> aRetval,
                            ErrorResult& aRv)
{
  if (aChannel >= NumberOfChannels()) {
    aRv.Throw(NS_ERROR_DOM_SYNTAX_ERR);
    return;
  }

  if (!RestoreJSChannelData(aJSContext)) {
    aRv.Throw(NS_ERROR_OUT_OF_MEMORY);
    return;
  }

  if (mJSChannels[aChannel]) {
    JS::ExposeObjectToActiveJS(mJSChannels[aChannel]);
  }
  aRetval.set(mJSChannels[aChannel]);
}

already_AddRefed<ThreadSharedFloatArrayBufferList>
AudioBuffer::StealJSArrayDataIntoSharedChannels(JSContext* aJSContext)
{
  // "1. If any of the AudioBuffer's ArrayBuffer have been neutered, abort
  // these steps, and return a zero-length channel data buffers to the
  // invoker."
  for (uint32_t i = 0; i < mJSChannels.Length(); ++i) {
    JSObject* channelArray = mJSChannels[i];
    if (!channelArray || mLength != JS_GetTypedArrayLength(channelArray)) {
      // Either empty buffer or one of the arrays was probably neutered
      return nullptr;
    }
  }

  // "2. Neuter all ArrayBuffers for arrays previously returned by
  // getChannelData on this AudioBuffer."
  // "3. Retain the underlying data buffers from those ArrayBuffers and return
  // references to them to the invoker."
  nsRefPtr<ThreadSharedFloatArrayBufferList> result =
    new ThreadSharedFloatArrayBufferList(mJSChannels.Length());
  for (uint32_t i = 0; i < mJSChannels.Length(); ++i) {
    JS::Rooted<JSObject*> arrayBufferView(aJSContext, mJSChannels[i]);
    JS::Rooted<JSObject*> arrayBuffer(aJSContext,
                                      JS_GetArrayBufferViewBuffer(aJSContext, arrayBufferView));
    auto stolenData = arrayBuffer
      ? static_cast<float*>(JS_StealArrayBufferContents(aJSContext,
                                                        arrayBuffer))
      : nullptr;
    if (stolenData) {
      result->SetData(i, stolenData, js_free, stolenData);
    } else {
      NS_ASSERTION(i == 0, "some channels lost when contents not acquired");
      return nullptr;
    }
  }

  for (uint32_t i = 0; i < mJSChannels.Length(); ++i) {
    mJSChannels[i] = nullptr;
  }

  return result.forget();
}

ThreadSharedFloatArrayBufferList*
AudioBuffer::GetThreadSharedChannelsForRate(JSContext* aJSContext)
{
  if (!mSharedChannels) {
    mSharedChannels = StealJSArrayDataIntoSharedChannels(aJSContext);
  }

  return mSharedChannels;
}

size_t
AudioBuffer::SizeOfIncludingThis(MallocSizeOf aMallocSizeOf) const
{
  size_t amount = aMallocSizeOf(this);
  amount += mJSChannels.ShallowSizeOfExcludingThis(aMallocSizeOf);
  if (mSharedChannels) {
    amount += mSharedChannels->SizeOfIncludingThis(aMallocSizeOf);
  }
  return amount;
}

} // namespace dom
} // namespace mozilla
