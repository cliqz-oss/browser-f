
/*
 * Copyright 2008 The Android Open Source Project
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

#include "SkFontMgr.h"
#include "SkScalerContext.h"

SkFontMgr* SkFontMgr::Factory() {
    // Always return NULL, an empty SkFontMgr will be used.
    return NULL;
}
