/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_DeclarationBlockInlines_h
#define mozilla_DeclarationBlockInlines_h

#include "mozilla/ServoDeclarationBlock.h"

namespace mozilla {

MOZ_DEFINE_STYLO_METHODS(DeclarationBlock, css::Declaration, ServoDeclarationBlock)

MozExternalRefCountType
DeclarationBlock::AddRef()
{
  MOZ_STYLO_FORWARD(AddRef, ())
}

MozExternalRefCountType
DeclarationBlock::Release()
{
  MOZ_STYLO_FORWARD(Release, ())
}

already_AddRefed<DeclarationBlock>
DeclarationBlock::Clone() const
{
  return do_AddRef(new ServoDeclarationBlock(*AsServo()));
}

already_AddRefed<DeclarationBlock>
DeclarationBlock::EnsureMutable()
{
  if (!IsDirty()) {
    // In stylo, the old DeclarationBlock is stored in element's rule node tree
    // directly, to avoid new values replacing the DeclarationBlock in the tree
    // directly, we need to copy the old one here if we haven't yet copied.
    // As a result the new value does not replace rule node tree until traversal
    // happens.
    return Clone();
  }

  if (!IsMutable()) {
    return Clone();
  }
  return do_AddRef(this);
}

void
DeclarationBlock::ToString(nsAString& aString) const
{
  MOZ_STYLO_FORWARD(ToString, (aString))
}

uint32_t
DeclarationBlock::Count() const
{
  MOZ_STYLO_FORWARD(Count, ())
}

bool
DeclarationBlock::GetNthProperty(uint32_t aIndex, nsAString& aReturn) const
{
  MOZ_STYLO_FORWARD(GetNthProperty, (aIndex, aReturn))
}

void
DeclarationBlock::GetPropertyValue(const nsAString& aProperty,
                                   nsAString& aValue) const
{
  MOZ_STYLO_FORWARD(GetPropertyValue, (aProperty, aValue))
}

void
DeclarationBlock::GetPropertyValueByID(nsCSSPropertyID aPropID,
                                       nsAString& aValue) const
{
  MOZ_STYLO_FORWARD(GetPropertyValueByID, (aPropID, aValue))
}

bool
DeclarationBlock::GetPropertyIsImportant(const nsAString& aProperty) const
{
  MOZ_STYLO_FORWARD(GetPropertyIsImportant, (aProperty))
}

bool
DeclarationBlock::RemoveProperty(const nsAString& aProperty)
{
  MOZ_STYLO_FORWARD(RemoveProperty, (aProperty))
}

bool
DeclarationBlock::RemovePropertyByID(nsCSSPropertyID aProperty)
{
  MOZ_STYLO_FORWARD(RemovePropertyByID, (aProperty))
}

} // namespace mozilla

#endif // mozilla_DeclarationBlockInlines_h
