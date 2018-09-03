//
// Copyright (c) 2012-2014 The ANGLE Project Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//

// TextureStorage9.cpp: Implements the abstract rx::TextureStorage9 class and its concrete derived
// classes TextureStorage9_2D and TextureStorage9_Cube, which act as the interface to the
// D3D9 texture.

#include "libANGLE/renderer/d3d/d3d9/TextureStorage9.h"

#include "common/utilities.h"
#include "libANGLE/Texture.h"
#include "libANGLE/formatutils.h"
#include "libANGLE/renderer/d3d/EGLImageD3D.h"
#include "libANGLE/renderer/d3d/TextureD3D.h"
#include "libANGLE/renderer/d3d/d3d9/RenderTarget9.h"
#include "libANGLE/renderer/d3d/d3d9/Renderer9.h"
#include "libANGLE/renderer/d3d/d3d9/SwapChain9.h"
#include "libANGLE/renderer/d3d/d3d9/formatutils9.h"
#include "libANGLE/renderer/d3d/d3d9/renderer9_utils.h"

namespace rx
{
TextureStorage9::TextureStorage9(Renderer9 *renderer, DWORD usage)
    : mTopLevel(0),
      mMipLevels(0),
      mTextureWidth(0),
      mTextureHeight(0),
      mInternalFormat(GL_NONE),
      mTextureFormat(D3DFMT_UNKNOWN),
      mRenderer(renderer),
      mD3DUsage(usage),
      mD3DPool(mRenderer->getTexturePool(usage))
{
}

TextureStorage9::~TextureStorage9()
{
}

DWORD TextureStorage9::GetTextureUsage(GLenum internalformat, bool renderTarget)
{
    DWORD d3dusage = 0;

    const gl::InternalFormat &formatInfo     = gl::GetSizedInternalFormatInfo(internalformat);
    const d3d9::TextureFormat &d3dFormatInfo = d3d9::GetTextureFormatInfo(internalformat);
    if (formatInfo.depthBits > 0 || formatInfo.stencilBits > 0)
    {
        d3dusage |= D3DUSAGE_DEPTHSTENCIL;
    }
    else if (renderTarget && (d3dFormatInfo.renderFormat != D3DFMT_UNKNOWN))
    {
        d3dusage |= D3DUSAGE_RENDERTARGET;
    }

    return d3dusage;
}


bool TextureStorage9::isRenderTarget() const
{
    return (mD3DUsage & (D3DUSAGE_RENDERTARGET | D3DUSAGE_DEPTHSTENCIL)) != 0;
}

bool TextureStorage9::isManaged() const
{
    return (mD3DPool == D3DPOOL_MANAGED);
}

bool TextureStorage9::supportsNativeMipmapFunction() const
{
    return false;
}

D3DPOOL TextureStorage9::getPool() const
{
    return mD3DPool;
}

DWORD TextureStorage9::getUsage() const
{
    return mD3DUsage;
}

int TextureStorage9::getTopLevel() const
{
    return mTopLevel;
}

int TextureStorage9::getLevelCount() const
{
    return static_cast<int>(mMipLevels) - mTopLevel;
}

gl::Error TextureStorage9::setData(const gl::Context *context,
                                   const gl::ImageIndex &index,
                                   ImageD3D *image,
                                   const gl::Box *destBox,
                                   GLenum type,
                                   const gl::PixelUnpackState &unpack,
                                   const uint8_t *pixelData)
{
    UNREACHABLE();
    return gl::InternalError();
}

TextureStorage9_2D::TextureStorage9_2D(Renderer9 *renderer, SwapChain9 *swapchain)
    : TextureStorage9(renderer, D3DUSAGE_RENDERTARGET)
{
    IDirect3DTexture9 *surfaceTexture = swapchain->getOffscreenTexture();
    mTexture = surfaceTexture;
    mMipLevels = surfaceTexture->GetLevelCount();

    mInternalFormat = swapchain->getRenderTargetInternalFormat();

    D3DSURFACE_DESC surfaceDesc;
    surfaceTexture->GetLevelDesc(0, &surfaceDesc);
    mTextureWidth = surfaceDesc.Width;
    mTextureHeight = surfaceDesc.Height;
    mTextureFormat = surfaceDesc.Format;

    mRenderTargets.resize(mMipLevels, nullptr);
}

TextureStorage9_2D::TextureStorage9_2D(Renderer9 *renderer, GLenum internalformat, bool renderTarget, GLsizei width, GLsizei height, int levels)
    : TextureStorage9(renderer, GetTextureUsage(internalformat, renderTarget))
{
    mTexture = nullptr;

    mInternalFormat = internalformat;

    const d3d9::TextureFormat &d3dFormatInfo = d3d9::GetTextureFormatInfo(internalformat);
    mTextureFormat = d3dFormatInfo.texFormat;

    d3d9::MakeValidSize(false, d3dFormatInfo.texFormat, &width, &height, &mTopLevel);
    mTextureWidth = width;
    mTextureHeight = height;
    mMipLevels = mTopLevel + levels;

    mRenderTargets.resize(levels, nullptr);
}

TextureStorage9_2D::~TextureStorage9_2D()
{
    SafeRelease(mTexture);
    for (RenderTargetD3D *renderTarget : mRenderTargets)
    {
        SafeDelete(renderTarget);
    }
}

// Increments refcount on surface.
// caller must Release() the returned surface
gl::Error TextureStorage9_2D::getSurfaceLevel(const gl::Context *context,
                                              gl::TextureTarget target,
                                              int level,
                                              bool dirty,
                                              IDirect3DSurface9 **outSurface)
{
    ASSERT(target == gl::TextureTarget::_2D);

    IDirect3DBaseTexture9 *baseTexture = nullptr;
    gl::Error error                    = getBaseTexture(context, &baseTexture);
    if (error.isError())
    {
        return error;
    }

    IDirect3DTexture9 *texture = static_cast<IDirect3DTexture9*>(baseTexture);

    HRESULT result = texture->GetSurfaceLevel(level + mTopLevel, outSurface);

    ASSERT(SUCCEEDED(result));
    if (FAILED(result))
    {
        return gl::OutOfMemory() << "Failed to get the surface from a texture, "
                                 << gl::FmtHR(result);
    }

    // With managed textures the driver needs to be informed of updates to the lower mipmap levels
    if (level + mTopLevel != 0 && isManaged() && dirty)
    {
        texture->AddDirtyRect(nullptr);
    }

    return gl::NoError();
}

gl::Error TextureStorage9_2D::getRenderTarget(const gl::Context *context,
                                              const gl::ImageIndex &index,
                                              RenderTargetD3D **outRT)
{
    ASSERT(index.mipIndex < getLevelCount());

    if (!mRenderTargets[index.mipIndex] && isRenderTarget())
    {
        IDirect3DBaseTexture9 *baseTexture = nullptr;
        gl::Error error                    = getBaseTexture(context, &baseTexture);
        if (error.isError())
        {
            return error;
        }

        IDirect3DSurface9 *surface = nullptr;
        error = getSurfaceLevel(context, gl::TextureTarget::_2D, index.mipIndex, false, &surface);
        if (error.isError())
        {
            return error;
        }

        size_t textureMipLevel = mTopLevel + index.mipIndex;
        size_t mipWidth        = std::max<size_t>(mTextureWidth >> textureMipLevel, 1u);
        size_t mipHeight       = std::max<size_t>(mTextureHeight >> textureMipLevel, 1u);

        baseTexture->AddRef();
        mRenderTargets[index.mipIndex] = new TextureRenderTarget9(
            baseTexture, textureMipLevel, surface, mInternalFormat, static_cast<GLsizei>(mipWidth),
            static_cast<GLsizei>(mipHeight), 1, 0);
    }

    ASSERT(outRT);
    *outRT = mRenderTargets[index.mipIndex];
    return gl::NoError();
}

gl::Error TextureStorage9_2D::generateMipmap(const gl::Context *context,
                                             const gl::ImageIndex &sourceIndex,
                                             const gl::ImageIndex &destIndex)
{
    IDirect3DSurface9 *upper = nullptr;
    gl::Error error =
        getSurfaceLevel(context, gl::TextureTarget::_2D, sourceIndex.mipIndex, false, &upper);
    if (error.isError())
    {
        return error;
    }

    IDirect3DSurface9 *lower = nullptr;
    error = getSurfaceLevel(context, gl::TextureTarget::_2D, destIndex.mipIndex, true, &lower);
    if (error.isError())
    {
        SafeRelease(upper);
        return error;
    }

    ASSERT(upper && lower);
    error = mRenderer->boxFilter(upper, lower);

    SafeRelease(upper);
    SafeRelease(lower);

    return error;
}

gl::Error TextureStorage9_2D::getBaseTexture(const gl::Context *context,
                                             IDirect3DBaseTexture9 **outTexture)
{
    // if the width or height is not positive this should be treated as an incomplete texture
    // we handle that here by skipping the d3d texture creation
    if (mTexture == nullptr && mTextureWidth > 0 && mTextureHeight > 0)
    {
        ASSERT(mMipLevels > 0);

        IDirect3DDevice9 *device = mRenderer->getDevice();
        HRESULT result           = device->CreateTexture(static_cast<unsigned int>(mTextureWidth),
                                               static_cast<unsigned int>(mTextureHeight),
                                               static_cast<unsigned int>(mMipLevels), getUsage(),
                                               mTextureFormat, getPool(), &mTexture, nullptr);

        if (FAILED(result))
        {
            ASSERT(result == D3DERR_OUTOFVIDEOMEMORY || result == E_OUTOFMEMORY);
            return gl::OutOfMemory()
                   << "Failed to create 2D storage texture, " << gl::FmtHR(result);
        }
    }

    *outTexture = mTexture;
    return gl::NoError();
}

gl::Error TextureStorage9_2D::copyToStorage(const gl::Context *context, TextureStorage *destStorage)
{
    ASSERT(destStorage);

    TextureStorage9_2D *dest9 = GetAs<TextureStorage9_2D>(destStorage);

    int levels = getLevelCount();
    for (int i = 0; i < levels; ++i)
    {
        IDirect3DSurface9 *srcSurf = nullptr;
        gl::Error error = getSurfaceLevel(context, gl::TextureTarget::_2D, i, false, &srcSurf);
        if (error.isError())
        {
            return error;
        }

        IDirect3DSurface9 *dstSurf = nullptr;
        error = dest9->getSurfaceLevel(context, gl::TextureTarget::_2D, i, true, &dstSurf);
        if (error.isError())
        {
            SafeRelease(srcSurf);
            return error;
        }

        error = mRenderer->copyToRenderTarget(dstSurf, srcSurf, isManaged());

        SafeRelease(srcSurf);
        SafeRelease(dstSurf);

        if (error.isError())
        {
            return error;
        }
    }

    return gl::NoError();
}

TextureStorage9_EGLImage::TextureStorage9_EGLImage(Renderer9 *renderer,
                                                   EGLImageD3D *image,
                                                   RenderTarget9 *renderTarget9)
    : TextureStorage9(renderer, D3DUSAGE_RENDERTARGET), mImage(image)
{
    mInternalFormat = renderTarget9->getInternalFormat();
    mTextureFormat  = renderTarget9->getD3DFormat();
    mTextureWidth   = renderTarget9->getWidth();
    mTextureHeight  = renderTarget9->getHeight();
    mTopLevel       = static_cast<int>(renderTarget9->getTextureLevel());
    mMipLevels      = mTopLevel + 1;
}

TextureStorage9_EGLImage::~TextureStorage9_EGLImage()
{
}

gl::Error TextureStorage9_EGLImage::getSurfaceLevel(const gl::Context *context,
                                                    gl::TextureTarget target,
                                                    int level,
                                                    bool,
                                                    IDirect3DSurface9 **outSurface)
{
    ASSERT(target == gl::TextureTarget::_2D);
    ASSERT(level == 0);

    RenderTargetD3D *renderTargetD3D = nullptr;
    gl::Error error                  = mImage->getRenderTarget(context, &renderTargetD3D);
    if (error.isError())
    {
        return error;
    }

    RenderTarget9 *renderTarget9 = GetAs<RenderTarget9>(renderTargetD3D);

    *outSurface = renderTarget9->getSurface();
    return gl::NoError();
}

gl::Error TextureStorage9_EGLImage::getRenderTarget(const gl::Context *context,
                                                    const gl::ImageIndex &index,
                                                    RenderTargetD3D **outRT)
{
    ASSERT(!index.hasLayer());
    ASSERT(index.mipIndex == 0);

    return mImage->getRenderTarget(context, outRT);
}

gl::Error TextureStorage9_EGLImage::getBaseTexture(const gl::Context *context,
                                                   IDirect3DBaseTexture9 **outTexture)
{
    RenderTargetD3D *renderTargetD3D = nullptr;
    gl::Error error                  = mImage->getRenderTarget(context, &renderTargetD3D);
    if (error.isError())
    {
        return error;
    }

    RenderTarget9 *renderTarget9 = GetAs<RenderTarget9>(renderTargetD3D);
    *outTexture = renderTarget9->getTexture();
    ASSERT(*outTexture != nullptr);

    return gl::NoError();
}

gl::Error TextureStorage9_EGLImage::generateMipmap(const gl::Context *context,
                                                   const gl::ImageIndex &,
                                                   const gl::ImageIndex &)
{
    UNREACHABLE();
    return gl::InternalError();
}

gl::Error TextureStorage9_EGLImage::copyToStorage(const gl::Context *context,
                                                  TextureStorage *destStorage)
{
    ASSERT(destStorage);
    ASSERT(getLevelCount() == 1);

    TextureStorage9 *dest9 = GetAs<TextureStorage9>(destStorage);

    IDirect3DBaseTexture9 *destBaseTexture9 = nullptr;
    gl::Error error                         = dest9->getBaseTexture(context, &destBaseTexture9);
    if (error.isError())
    {
        return error;
    }

    IDirect3DTexture9 *destTexture9 = static_cast<IDirect3DTexture9 *>(destBaseTexture9);

    IDirect3DSurface9 *destSurface = nullptr;
    HRESULT result = destTexture9->GetSurfaceLevel(destStorage->getTopLevel(), &destSurface);
    if (FAILED(result))
    {
        return gl::OutOfMemory() << "Failed to get the surface from a texture, "
                                 << gl::FmtHR(result);
    }

    RenderTargetD3D *sourceRenderTarget = nullptr;
    error                               = mImage->getRenderTarget(context, &sourceRenderTarget);
    if (error.isError())
    {
        SafeRelease(destSurface);
        return error;
    }

    RenderTarget9 *sourceRenderTarget9 = GetAs<RenderTarget9>(sourceRenderTarget);
    error =
        mRenderer->copyToRenderTarget(destSurface, sourceRenderTarget9->getSurface(), isManaged());
    if (error.isError())
    {
        SafeRelease(destSurface);
        return error;
    }

    if (destStorage->getTopLevel() != 0)
    {
        destTexture9->AddDirtyRect(nullptr);
    }

    SafeRelease(destSurface);
    return gl::NoError();
}

TextureStorage9_Cube::TextureStorage9_Cube(Renderer9 *renderer, GLenum internalformat, bool renderTarget, int size, int levels, bool hintLevelZeroOnly)
    : TextureStorage9(renderer, GetTextureUsage(internalformat, renderTarget))
{
    mTexture = nullptr;
    for (size_t i = 0; i < gl::CUBE_FACE_COUNT; ++i)
    {
        mRenderTarget[i] = nullptr;
    }

    mInternalFormat = internalformat;

    const d3d9::TextureFormat &d3dFormatInfo = d3d9::GetTextureFormatInfo(internalformat);
    mTextureFormat = d3dFormatInfo.texFormat;

    int height = size;
    d3d9::MakeValidSize(false, d3dFormatInfo.texFormat, &size, &height, &mTopLevel);
    mTextureWidth = size;
    mTextureHeight = size;
    mMipLevels = mTopLevel + levels;
}

TextureStorage9_Cube::~TextureStorage9_Cube()
{
    SafeRelease(mTexture);

    for (size_t i = 0; i < gl::CUBE_FACE_COUNT; ++i)
    {
        SafeDelete(mRenderTarget[i]);
    }
}

// Increments refcount on surface.
// caller must Release() the returned surface
gl::Error TextureStorage9_Cube::getSurfaceLevel(const gl::Context *context,
                                                gl::TextureTarget target,
                                                int level,
                                                bool dirty,
                                                IDirect3DSurface9 **outSurface)
{
    IDirect3DBaseTexture9 *baseTexture = nullptr;
    gl::Error error                    = getBaseTexture(context, &baseTexture);
    if (error.isError())
    {
        return error;
    }

    IDirect3DCubeTexture9 *texture = static_cast<IDirect3DCubeTexture9*>(baseTexture);

    D3DCUBEMAP_FACES face = gl_d3d9::ConvertCubeFace(target);
    HRESULT result        = texture->GetCubeMapSurface(face, level, outSurface);

    ASSERT(SUCCEEDED(result));
    if (FAILED(result))
    {
        return gl::OutOfMemory() << "Failed to get the surface from a texture, "
                                 << gl::FmtHR(result);
    }

    // With managed textures the driver needs to be informed of updates to the lower mipmap levels
    if (level != 0 && isManaged() && dirty)
    {
        texture->AddDirtyRect(face, nullptr);
    }

    return gl::NoError();
}

gl::Error TextureStorage9_Cube::getRenderTarget(const gl::Context *context,
                                                const gl::ImageIndex &index,
                                                RenderTargetD3D **outRT)
{
    ASSERT(outRT);
    ASSERT(index.mipIndex == 0);

    ASSERT(index.type == gl::TextureType::CubeMap &&
           gl::TextureTargetToType(index.target) == gl::TextureType::CubeMap);
    const size_t renderTargetIndex = index.cubeMapFaceIndex();

    if (mRenderTarget[renderTargetIndex] == nullptr && isRenderTarget())
    {
        IDirect3DBaseTexture9 *baseTexture = nullptr;
        gl::Error error                    = getBaseTexture(context, &baseTexture);
        if (error.isError())
        {
            return error;
        }

        IDirect3DSurface9 *surface = nullptr;
        error = getSurfaceLevel(context, index.target, mTopLevel + index.mipIndex, false, &surface);
        if (error.isError())
        {
            return error;
        }

        baseTexture->AddRef();
        mRenderTarget[renderTargetIndex] = new TextureRenderTarget9(
            baseTexture, mTopLevel + index.mipIndex, surface, mInternalFormat,
            static_cast<GLsizei>(mTextureWidth), static_cast<GLsizei>(mTextureHeight), 1, 0);
    }

    *outRT = mRenderTarget[renderTargetIndex];
    return gl::NoError();
}

gl::Error TextureStorage9_Cube::generateMipmap(const gl::Context *context,
                                               const gl::ImageIndex &sourceIndex,
                                               const gl::ImageIndex &destIndex)
{
    IDirect3DSurface9 *upper = nullptr;
    gl::Error error =
        getSurfaceLevel(context, sourceIndex.target, sourceIndex.mipIndex, false, &upper);
    if (error.isError())
    {
        return error;
    }

    IDirect3DSurface9 *lower = nullptr;
    error = getSurfaceLevel(context, destIndex.target, destIndex.mipIndex, true, &lower);
    if (error.isError())
    {
        SafeRelease(upper);
        return error;
    }

    ASSERT(upper && lower);
    error = mRenderer->boxFilter(upper, lower);

    SafeRelease(upper);
    SafeRelease(lower);

    return error;
}

gl::Error TextureStorage9_Cube::getBaseTexture(const gl::Context *context,
                                               IDirect3DBaseTexture9 **outTexture)
{
    // if the size is not positive this should be treated as an incomplete texture
    // we handle that here by skipping the d3d texture creation
    if (mTexture == nullptr && mTextureWidth > 0 && mTextureHeight > 0)
    {
        ASSERT(mMipLevels > 0);
        ASSERT(mTextureWidth == mTextureHeight);

        IDirect3DDevice9 *device = mRenderer->getDevice();
        HRESULT result           = device->CreateCubeTexture(
            static_cast<unsigned int>(mTextureWidth), static_cast<unsigned int>(mMipLevels),
            getUsage(), mTextureFormat, getPool(), &mTexture, nullptr);

        if (FAILED(result))
        {
            ASSERT(result == D3DERR_OUTOFVIDEOMEMORY || result == E_OUTOFMEMORY);
            return gl::OutOfMemory()
                   << "Failed to create cube storage texture, " << gl::FmtHR(result);
        }
    }

    *outTexture = mTexture;
    return gl::NoError();
}

gl::Error TextureStorage9_Cube::copyToStorage(const gl::Context *context,
                                              TextureStorage *destStorage)
{
    ASSERT(destStorage);

    TextureStorage9_Cube *dest9 = GetAs<TextureStorage9_Cube>(destStorage);

    int levels = getLevelCount();
    for (gl::TextureTarget face : gl::AllCubeFaceTextureTargets())
    {
        for (int i = 0; i < levels; i++)
        {
            IDirect3DSurface9 *srcSurf = nullptr;
            gl::Error error            = getSurfaceLevel(context, face, i, false, &srcSurf);
            if (error.isError())
            {
                return error;
            }

            IDirect3DSurface9 *dstSurf = nullptr;
            error                      = dest9->getSurfaceLevel(context, face, i, true, &dstSurf);
            if (error.isError())
            {
                SafeRelease(srcSurf);
                return error;
            }

            error = mRenderer->copyToRenderTarget(dstSurf, srcSurf, isManaged());

            SafeRelease(srcSurf);
            SafeRelease(dstSurf);

            if (error.isError())
            {
                return error;
            }
        }
    }

    return gl::NoError();
}

}
