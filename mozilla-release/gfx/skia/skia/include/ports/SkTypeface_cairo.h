#ifndef SkTypeface_cairo_DEFINED
#define SkTypeface_cairo_DEFINED

#include <cairo.h>

#include "SkTypeface.h"

SK_API extern SkTypeface* SkCreateTypefaceFromCairoFont(cairo_font_face_t* fontFace, SkTypeface::Style style, bool isFixedWidth);

#endif

