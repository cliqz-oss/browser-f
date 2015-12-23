/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef GFX_D311_SHARE_HANDLE_IMAGE_H
#define GFX_D311_SHARE_HANDLE_IMAGE_H

#include "mozilla/RefPtr.h"
#include "ImageContainer.h"
#include "nsAutoPtr.h"
#include "d3d11.h"
#include "mozilla/layers/TextureClient.h"
#include "mozilla/layers/TextureD3D11.h"
#include "mozilla/layers/TextureClientRecycleAllocator.h"

namespace mozilla {
namespace layers {

class D3D11RecycleAllocator : public TextureClientRecycleAllocator
{
public:
  explicit D3D11RecycleAllocator(ISurfaceAllocator* aAllocator,
                                 ID3D11Device* aDevice)
    : TextureClientRecycleAllocator(aAllocator)
    , mDevice(aDevice)
  {}

  already_AddRefed<TextureClientD3D11>
  CreateOrRecycleClient(gfx::SurfaceFormat aFormat,
                        const gfx::IntSize& aSize);

protected:
  virtual already_AddRefed<TextureClient>
  Allocate(gfx::SurfaceFormat aFormat,
           gfx::IntSize aSize,
           BackendSelector aSelector,
           TextureFlags aTextureFlags,
           TextureAllocationFlags aAllocFlags) override;

  RefPtr<ID3D11Device> mDevice;
};

// Image class that wraps a ID3D11Texture2D. This class copies the image
// passed into SetData(), so that it can be accessed from other D3D devices.
// This class also manages the synchronization of the copy, to ensure the
// resource is ready to use.
class D3D11ShareHandleImage : public Image {
public:

  struct Data {
    Data(D3D11RecycleAllocator* aAllocator,
         const gfx::IntSize& aSize,
         const gfx::IntRect& aRegion)
      : mAllocator(aAllocator)
      , mSize(aSize)
      , mRegion(aRegion) {}
    RefPtr<D3D11RecycleAllocator> mAllocator;
    gfx::IntSize mSize;
    gfx::IntRect mRegion;
  };

  D3D11ShareHandleImage() : Image(NULL, ImageFormat::D3D11_SHARE_HANDLE_TEXTURE), mSize(0, 0) {}
  virtual ~D3D11ShareHandleImage() {}

  // Copies the surface into a sharable texture's surface, and initializes
  // the image.
  HRESULT SetData(const Data& aData);

  gfx::IntSize GetSize() override;

  virtual already_AddRefed<gfx::SourceSurface> GetAsSourceSurface() override;

  virtual TextureClient* GetTextureClient(CompositableClient* aClient) override;

  ID3D11Texture2D* GetTexture() const;

  virtual gfx::IntRect GetPictureRect() override { return mPictureRect; }

private:

  gfx::IntSize mSize;
  gfx::IntRect mPictureRect;
  RefPtr<TextureClientD3D11> mTextureClient;
};

} // namepace layers
} // namespace mozilla

#endif // GFX_D3DSURFACEIMAGE_H
