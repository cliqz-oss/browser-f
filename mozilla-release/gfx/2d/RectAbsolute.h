/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MOZILLA_GFX_RECT_ABSOLUTE_H_
#define MOZILLA_GFX_RECT_ABSOLUTE_H_

#include <algorithm>
#include <cstdint>

#include "mozilla/Attributes.h"
#include "Rect.h"
#include "Types.h"

namespace mozilla {

template <typename> struct IsPixel;

namespace gfx {

/**
 * A RectAbsolute is similar to a Rect (see BaseRect.h), but represented as
 * (x1, y1, x2, y2) instead of (x, y, width, height).
 *
 * Unless otherwise indicated, methods on this class correspond
 * to methods on BaseRect.
 *
 * The API is currently very bare-bones; it may be extended as needed.
 *
 * Do not use this class directly. Subclass it, pass that subclass as the
 * Sub parameter, and only use that subclass.
 */
template <class T, class Sub, class Rect>
struct BaseRectAbsolute {
protected:
  T x1, y1, x2, y2;

public:
  BaseRectAbsolute() : x1(0), y1(0), x2(0), y2(0) {}
  BaseRectAbsolute(T aX1, T aY1, T aX2, T aY2) :
    x1(aX1), y1(aY1), x2(aX2), y2(aY2) {}

  MOZ_ALWAYS_INLINE T X() const { return x1; }
  MOZ_ALWAYS_INLINE T Y() const { return y1; }
  MOZ_ALWAYS_INLINE T Width() const { return x2 - x1; }
  MOZ_ALWAYS_INLINE T Height() const { return y2 - y1; }
  MOZ_ALWAYS_INLINE T XMost() const { return x2; }
  MOZ_ALWAYS_INLINE T YMost() const { return y2; }

  MOZ_ALWAYS_INLINE void SetBox(T aX1, T aY1, T aX2, T aY2)
  {
    x1 = aX1; y1 = aY1; x2 = aX2; y2 = aY2;
  }
  void SetLeftEdge(T aX1)
  {
    x1 = aX1;
  }
  void SetRightEdge(T aX2)
  {
    x2 = aX2;
  }
  void SetTopEdge(T aY1)
  {
    y1 = aY1;
  }
  void SetBottomEdge(T aY2)
  {
    y2 = aY2;
  }

  static Sub FromRect(const Rect& aRect)
  {
    return Sub(aRect.x, aRect.y, aRect.XMost(), aRect.YMost());
  }

  MOZ_MUST_USE Sub Intersect(const Sub& aOther) const
  {
    Sub result;
    result.x1 = std::max<T>(x1, aOther.x1);
    result.y1 = std::max<T>(y1, aOther.y1);
    result.x2 = std::min<T>(x2, aOther.x2);
    result.y2 = std::min<T>(y2, aOther.y2);
    return result;
  }

  bool IsEqualEdges(const Sub& aOther) const
  {
    return x1 == aOther.x1 && y1 == aOther.y1 &&
           x2 == aOther.x2 && y2 == aOther.y2;
  }
};

template <class Units>
struct IntRectAbsoluteTyped :
    public BaseRectAbsolute<int32_t, IntRectAbsoluteTyped<Units>, IntRectTyped<Units>>,
    public Units {
  static_assert(IsPixel<Units>::value,
                "'units' must be a coordinate system tag");
  typedef BaseRectAbsolute<int32_t, IntRectAbsoluteTyped<Units>, IntRectTyped<Units>> Super;
  typedef IntParam<int32_t> ToInt;

  IntRectAbsoluteTyped() : Super() {}
  IntRectAbsoluteTyped(ToInt aX1, ToInt aY1, ToInt aX2, ToInt aY2) :
      Super(aX1.value, aY1.value, aX2.value, aY2.value) {}
};

template <class Units>
struct RectAbsoluteTyped :
    public BaseRectAbsolute<Float, RectAbsoluteTyped<Units>, RectTyped<Units>>,
    public Units {
  static_assert(IsPixel<Units>::value,
                "'units' must be a coordinate system tag");
  typedef BaseRectAbsolute<Float, RectAbsoluteTyped<Units>, RectTyped<Units>> Super;

  RectAbsoluteTyped() : Super() {}
  RectAbsoluteTyped(Float aX1, Float aY1, Float aX2, Float aY2) :
      Super(aX1, aY1, aX2, aY2) {}
};

}
}

#endif /* MOZILLA_GFX_RECT_ABSOLUTE_H_ */
