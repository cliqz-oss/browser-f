/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ServoKeyframeRule_h
#define mozilla_ServoKeyframeRule_h

#include "mozilla/dom/CSSKeyframeRule.h"
#include "mozilla/ServoBindingTypes.h"

class nsICSSDeclaration;

namespace mozilla {

class ServoDeclarationBlock;
class ServoKeyframeDeclaration;

class ServoKeyframeRule final : public dom::CSSKeyframeRule
{
public:
  ServoKeyframeRule(already_AddRefed<RawServoKeyframe> aRaw,
                    uint32_t aLine, uint32_t aColumn)
    : CSSKeyframeRule(aLine, aColumn)
    , mRaw(aRaw) {}

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_CYCLE_COLLECTION_CLASS_INHERITED(ServoKeyframeRule,
                                           dom::CSSKeyframeRule)

  bool IsCCLeaf() const final;
#ifdef DEBUG
  void List(FILE* out = stdout, int32_t aIndent = 0) const final;
#endif

  RawServoKeyframe* Raw() const { return mRaw; }

  // WebIDL interface
  void GetCssText(nsAString& aCssText) const final;
  void GetKeyText(nsAString& aKeyText) final;
  void SetKeyText(const nsAString& aKeyText) final;
  nsICSSDeclaration* Style() final;

  size_t SizeOfIncludingThis(MallocSizeOf aMallocSizeOf) const final;

private:
  virtual ~ServoKeyframeRule();

  friend class ServoKeyframeDeclaration;

  template<typename Func>
  void UpdateRule(Func aCallback);

  RefPtr<RawServoKeyframe> mRaw;
  // lazily created when needed
  RefPtr<ServoKeyframeDeclaration> mDeclaration;
};

} // namespace mozilla

#endif // mozilla_ServoKeyframeRule_h
