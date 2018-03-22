/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* a list of all Servo binding functions */

/* This file contains the list of all Servo binding functions. Each
 * entry is defined as a SERVO_BINDING_FUNC macro with the following
 * parameters:
 * - 'name_' the name of the binding function
 * - 'return_' the return type of the binding function
 * and the parameter list of the function.
 *
 * Users of this list should define a macro
 * SERVO_BINDING_FUNC(name_, return_, ...)
 * before including this file.
 */

// Element data
SERVO_BINDING_FUNC(Servo_Element_ClearData, void, RawGeckoElementBorrowed node)
SERVO_BINDING_FUNC(Servo_Element_SizeOfExcludingThisAndCVs, size_t,
                   mozilla::MallocSizeOf malloc_size_of,
                   mozilla::MallocSizeOf malloc_enclosing_size_of,
                   mozilla::SeenPtrs* seen_ptrs, RawGeckoElementBorrowed node)
SERVO_BINDING_FUNC(Servo_Element_HasPrimaryComputedValues, bool,
                   RawGeckoElementBorrowed node)
SERVO_BINDING_FUNC(Servo_Element_GetPrimaryComputedValues,
                   ServoStyleContextStrong,
                   RawGeckoElementBorrowed node)
SERVO_BINDING_FUNC(Servo_Element_HasPseudoComputedValues, bool,
                   RawGeckoElementBorrowed node, size_t index)
SERVO_BINDING_FUNC(Servo_Element_GetPseudoComputedValues,
                   ServoStyleContextStrong,
                   RawGeckoElementBorrowed node, size_t index)
SERVO_BINDING_FUNC(Servo_Element_IsDisplayNone,
                   bool,
                   RawGeckoElementBorrowed element)
SERVO_BINDING_FUNC(Servo_Element_IsPrimaryStyleReusedViaRuleNode,
                   bool,
                   RawGeckoElementBorrowed element)

// Styleset and Stylesheet management
SERVO_BINDING_FUNC(Servo_StyleSheet_FromUTF8Bytes,
                   RawServoStyleSheetContentsStrong,
                   mozilla::css::Loader* loader,
                   mozilla::ServoStyleSheet* gecko_stylesheet,
                   const uint8_t* data,
                   size_t data_len,
                   mozilla::css::SheetParsingMode parsing_mode,
                   RawGeckoURLExtraData* extra_data,
                   uint32_t line_number_offset,
                   nsCompatibility quirks_mode,
                   mozilla::css::LoaderReusableStyleSheets* reusable_sheets)
SERVO_BINDING_FUNC(Servo_StyleSheet_Empty, RawServoStyleSheetContentsStrong,
                   mozilla::css::SheetParsingMode parsing_mode)
SERVO_BINDING_FUNC(Servo_StyleSheet_HasRules, bool,
                   RawServoStyleSheetContentsBorrowed sheet)
SERVO_BINDING_FUNC(Servo_StyleSheet_GetRules, ServoCssRulesStrong,
                   RawServoStyleSheetContentsBorrowed sheet)
SERVO_BINDING_FUNC(Servo_StyleSheet_Clone, RawServoStyleSheetContentsStrong,
                   RawServoStyleSheetContentsBorrowed sheet,
                   const mozilla::ServoStyleSheet* reference_sheet);
SERVO_BINDING_FUNC(Servo_StyleSheet_SizeOfIncludingThis, size_t,
                   mozilla::MallocSizeOf malloc_size_of,
                   mozilla::MallocSizeOf malloc_enclosing_size_of,
                   RawServoStyleSheetContentsBorrowed sheet)
SERVO_BINDING_FUNC(Servo_StyleSheet_GetSourceMapURL, void,
                   RawServoStyleSheetContentsBorrowed sheet, nsAString* result)
SERVO_BINDING_FUNC(Servo_StyleSheet_GetSourceURL, void,
                   RawServoStyleSheetContentsBorrowed sheet, nsAString* result)
// We'd like to return `OriginFlags` here, but bindgen bitfield enums don't
// work as return values with the Linux 32-bit ABI at the moment because
// they wrap the value in a struct.
SERVO_BINDING_FUNC(Servo_StyleSheet_GetOrigin, uint8_t,
                   RawServoStyleSheetContentsBorrowed sheet)
SERVO_BINDING_FUNC(Servo_StyleSet_Init, RawServoStyleSet*, RawGeckoPresContextOwned pres_context)
SERVO_BINDING_FUNC(Servo_StyleSet_RebuildCachedData, void,
                   RawServoStyleSetBorrowed set)
// We'd like to return `OriginFlags` here, but bindgen bitfield enums don't
// work as return values with the Linux 32-bit ABI at the moment because
// they wrap the value in a struct.
SERVO_BINDING_FUNC(Servo_StyleSet_MediumFeaturesChanged, uint8_t,
                   RawServoStyleSetBorrowed set, bool* viewport_units_used)
// We'd like to return `OriginFlags` here, but bindgen bitfield enums don't
// work as return values with the Linux 32-bit ABI at the moment because
// they wrap the value in a struct.
SERVO_BINDING_FUNC(Servo_StyleSet_SetDevice, uint8_t,
                   RawServoStyleSetBorrowed set, RawGeckoPresContextOwned pres_context)
SERVO_BINDING_FUNC(Servo_StyleSet_Drop, void, RawServoStyleSetOwned set)
SERVO_BINDING_FUNC(Servo_StyleSet_CompatModeChanged, void,
                   RawServoStyleSetBorrowed raw_data)
SERVO_BINDING_FUNC(Servo_StyleSet_AppendStyleSheet, void,
                   RawServoStyleSetBorrowed set,
                   const mozilla::ServoStyleSheet* gecko_sheet)
SERVO_BINDING_FUNC(Servo_StyleSet_PrependStyleSheet, void,
                   RawServoStyleSetBorrowed set,
                   const mozilla::ServoStyleSheet* gecko_sheet)
SERVO_BINDING_FUNC(Servo_StyleSet_RemoveStyleSheet, void,
                   RawServoStyleSetBorrowed set,
                   const mozilla::ServoStyleSheet* gecko_sheet)
SERVO_BINDING_FUNC(Servo_StyleSet_InsertStyleSheetBefore, void,
                   RawServoStyleSetBorrowed set,
                   const mozilla::ServoStyleSheet* gecko_sheet,
                   const mozilla::ServoStyleSheet* before)
SERVO_BINDING_FUNC(Servo_StyleSet_FlushStyleSheets, void,
                   RawServoStyleSetBorrowed set,
                   RawGeckoElementBorrowedOrNull doc_elem,
                   const mozilla::ServoElementSnapshotTable* snapshots)
SERVO_BINDING_FUNC(Servo_StyleSet_NoteStyleSheetsChanged, void,
                   RawServoStyleSetBorrowed set,
                   bool author_style_disabled,
                   mozilla::OriginFlags changed_origins)
SERVO_BINDING_FUNC(Servo_StyleSet_GetKeyframesForName, bool,
                   RawServoStyleSetBorrowed set,
                   nsAtom* name,
                   nsTimingFunctionBorrowed timing_function,
                   RawGeckoKeyframeListBorrowedMut keyframe_list)
SERVO_BINDING_FUNC(Servo_StyleSet_GetFontFaceRules, void,
                   RawServoStyleSetBorrowed set,
                   RawGeckoFontFaceRuleListBorrowedMut list)
SERVO_BINDING_FUNC(Servo_StyleSet_GetCounterStyleRule, nsCSSCounterStyleRule*,
                   RawServoStyleSetBorrowed set, nsAtom* name)
// This function may return nullptr or gfxFontFeatureValueSet with zero reference.
SERVO_BINDING_FUNC(Servo_StyleSet_BuildFontFeatureValueSet,
                   gfxFontFeatureValueSet*,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_StyleSet_ResolveForDeclarations,
                   ServoStyleContextStrong,
                   RawServoStyleSetBorrowed set,
                   ServoStyleContextBorrowedOrNull parent_style,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_SelectorList_Drop, void,
                   RawServoSelectorListOwned selector_list)
SERVO_BINDING_FUNC(Servo_SelectorList_Parse,
                   RawServoSelectorList*,
                   const nsACString* selector_list)
SERVO_BINDING_FUNC(Servo_SourceSizeList_Parse,
                   RawServoSourceSizeList*,
                   const nsACString* value)
SERVO_BINDING_FUNC(Servo_SourceSizeList_Evaluate,
                   int32_t,
                   RawServoStyleSetBorrowed set,
                   RawServoSourceSizeListBorrowedOrNull)
SERVO_BINDING_FUNC(Servo_SourceSizeList_Drop, void,
                   RawServoSourceSizeListOwned)
SERVO_BINDING_FUNC(Servo_SelectorList_Matches, bool,
                   RawGeckoElementBorrowed, RawServoSelectorListBorrowed)
SERVO_BINDING_FUNC(Servo_SelectorList_Closest, const RawGeckoElement*,
                   RawGeckoElementBorrowed, RawServoSelectorListBorrowed)
SERVO_BINDING_FUNC(Servo_SelectorList_QueryFirst, const RawGeckoElement*,
                   RawGeckoNodeBorrowed, RawServoSelectorListBorrowed,
                   bool may_use_invalidation)
SERVO_BINDING_FUNC(Servo_SelectorList_QueryAll, void,
                   RawGeckoNodeBorrowed, RawServoSelectorListBorrowed,
                   nsSimpleContentList* content_list,
                   bool may_use_invalidation)
SERVO_BINDING_FUNC(Servo_StyleSet_AddSizeOfExcludingThis, void,
                   mozilla::MallocSizeOf malloc_size_of,
                   mozilla::MallocSizeOf malloc_enclosing_size_of,
                   mozilla::ServoStyleSetSizes* sizes,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_UACache_AddSizeOf, void,
                   mozilla::MallocSizeOf malloc_size_of,
                   mozilla::MallocSizeOf malloc_enclosing_size_of,
                   mozilla::ServoStyleSetSizes* sizes)
SERVO_BINDING_FUNC(Servo_StyleContext_AddRef, void, ServoStyleContextBorrowed ctx);
SERVO_BINDING_FUNC(Servo_StyleContext_Release, void, ServoStyleContextBorrowed ctx);

SERVO_BINDING_FUNC(Servo_StyleSet_MightHaveAttributeDependency, bool,
                   RawServoStyleSetBorrowed set,
                   RawGeckoElementBorrowed element,
                   nsAtom* local_name)
SERVO_BINDING_FUNC(Servo_StyleSet_HasStateDependency, bool,
                   RawServoStyleSetBorrowed set,
                   RawGeckoElementBorrowed element,
                   uint64_t state)
SERVO_BINDING_FUNC(Servo_StyleSet_HasDocumentStateDependency, bool,
                   RawServoStyleSetBorrowed set,
                   uint64_t state)

// CSSRuleList
SERVO_BINDING_FUNC(Servo_CssRules_ListTypes, void,
                   ServoCssRulesBorrowed rules,
                   nsTArrayBorrowed_uintptr_t result)
SERVO_BINDING_FUNC(Servo_CssRules_InsertRule, nsresult,
                   ServoCssRulesBorrowed rules,
                   RawServoStyleSheetContentsBorrowed sheet,
                   const nsACString* rule,
                   uint32_t index,
                   bool nested,
                   mozilla::css::Loader* loader,
                   mozilla::ServoStyleSheet* gecko_stylesheet,
                   uint16_t* rule_type)
SERVO_BINDING_FUNC(Servo_CssRules_DeleteRule, nsresult,
                   ServoCssRulesBorrowed rules, uint32_t index)

// CSS Rules
#define BASIC_RULE_FUNCS_WITHOUT_GETTER(type_) \
  SERVO_BINDING_FUNC(Servo_##type_##_Debug, void, \
                     RawServo##type_##Borrowed rule, nsACString* result) \
  SERVO_BINDING_FUNC(Servo_##type_##_GetCssText, void, \
                     RawServo##type_##Borrowed rule, nsAString* result)
#define BASIC_RULE_FUNCS(type_) \
  SERVO_BINDING_FUNC(Servo_CssRules_Get##type_##RuleAt, \
                     RawServo##type_##RuleStrong, \
                     ServoCssRulesBorrowed rules, uint32_t index, \
                     uint32_t* line, uint32_t* column) \
  BASIC_RULE_FUNCS_WITHOUT_GETTER(type_##Rule)
#define GROUP_RULE_FUNCS(type_) \
  BASIC_RULE_FUNCS(type_) \
  SERVO_BINDING_FUNC(Servo_##type_##Rule_GetRules, ServoCssRulesStrong, \
                     RawServo##type_##RuleBorrowed rule)
BASIC_RULE_FUNCS(Style)
BASIC_RULE_FUNCS(Import)
BASIC_RULE_FUNCS_WITHOUT_GETTER(Keyframe)
BASIC_RULE_FUNCS(Keyframes)
GROUP_RULE_FUNCS(Media)
BASIC_RULE_FUNCS(Namespace)
BASIC_RULE_FUNCS(Page)
GROUP_RULE_FUNCS(Supports)
GROUP_RULE_FUNCS(Document)
BASIC_RULE_FUNCS(FontFeatureValues)
#undef GROUP_RULE_FUNCS
#undef BASIC_RULE_FUNCS
#undef BASIC_RULE_FUNCS_WITHOUT_GETTER
SERVO_BINDING_FUNC(Servo_CssRules_GetFontFaceRuleAt, nsCSSFontFaceRule*,
                   ServoCssRulesBorrowed rules, uint32_t index)
SERVO_BINDING_FUNC(Servo_CssRules_GetCounterStyleRuleAt, nsCSSCounterStyleRule*,
                   ServoCssRulesBorrowed rules, uint32_t index)
SERVO_BINDING_FUNC(Servo_StyleRule_GetStyle, RawServoDeclarationBlockStrong,
                   RawServoStyleRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_StyleRule_SetStyle, void,
                   RawServoStyleRuleBorrowed rule,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_StyleRule_GetSelectorText, void,
                   RawServoStyleRuleBorrowed rule, nsAString* result)
SERVO_BINDING_FUNC(Servo_StyleRule_GetSelectorTextAtIndex, void,
                   RawServoStyleRuleBorrowed rule, uint32_t index,
                   nsAString* result)
SERVO_BINDING_FUNC(Servo_StyleRule_GetSpecificityAtIndex, void,
                   RawServoStyleRuleBorrowed rule, uint32_t index,
                   uint64_t* specificity)
SERVO_BINDING_FUNC(Servo_StyleRule_GetSelectorCount, void,
                   RawServoStyleRuleBorrowed rule, uint32_t* count)
SERVO_BINDING_FUNC(Servo_StyleRule_SelectorMatchesElement, bool,
                   RawServoStyleRuleBorrowed, RawGeckoElementBorrowed,
                   uint32_t index, mozilla::CSSPseudoElementType pseudo_type)
SERVO_BINDING_FUNC(Servo_ImportRule_GetHref, void,
                   RawServoImportRuleBorrowed rule, nsAString* result)
SERVO_BINDING_FUNC(Servo_ImportRule_GetSheet,
                   const mozilla::ServoStyleSheet*,
                   RawServoImportRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_Keyframe_GetKeyText, void,
                   RawServoKeyframeBorrowed keyframe, nsAString* result)
// Returns whether it successfully changes the key text.
SERVO_BINDING_FUNC(Servo_Keyframe_SetKeyText, bool,
                   RawServoKeyframeBorrowed keyframe, const nsACString* text)
SERVO_BINDING_FUNC(Servo_Keyframe_GetStyle, RawServoDeclarationBlockStrong,
                   RawServoKeyframeBorrowed keyframe)
SERVO_BINDING_FUNC(Servo_Keyframe_SetStyle, void,
                   RawServoKeyframeBorrowed keyframe,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_KeyframesRule_GetName, nsAtom*,
                   RawServoKeyframesRuleBorrowed rule)
// This method takes an addrefed nsAtom.
SERVO_BINDING_FUNC(Servo_KeyframesRule_SetName, void,
                   RawServoKeyframesRuleBorrowed rule, nsAtom* name)
SERVO_BINDING_FUNC(Servo_KeyframesRule_GetCount, uint32_t,
                   RawServoKeyframesRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_KeyframesRule_GetKeyframeAt, RawServoKeyframeStrong,
                   RawServoKeyframesRuleBorrowed rule, uint32_t index,
                   uint32_t* line, uint32_t* column)
// Returns the index of the rule, max value of uint32_t if nothing found.
SERVO_BINDING_FUNC(Servo_KeyframesRule_FindRule, uint32_t,
                   RawServoKeyframesRuleBorrowed rule, const nsACString* key)
// Returns whether it successfully appends the rule.
SERVO_BINDING_FUNC(Servo_KeyframesRule_AppendRule, bool,
                   RawServoKeyframesRuleBorrowed rule,
                   RawServoStyleSheetContentsBorrowed sheet,
                   const nsACString* css)
SERVO_BINDING_FUNC(Servo_KeyframesRule_DeleteRule, void,
                   RawServoKeyframesRuleBorrowed rule, uint32_t index)
SERVO_BINDING_FUNC(Servo_MediaRule_GetMedia, RawServoMediaListStrong,
                   RawServoMediaRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_NamespaceRule_GetPrefix, nsAtom*,
                   RawServoNamespaceRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_NamespaceRule_GetURI, nsAtom*,
                   RawServoNamespaceRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_PageRule_GetStyle, RawServoDeclarationBlockStrong,
                   RawServoPageRuleBorrowed rule)
SERVO_BINDING_FUNC(Servo_PageRule_SetStyle, void,
                   RawServoPageRuleBorrowed rule,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_SupportsRule_GetConditionText, void,
                   RawServoSupportsRuleBorrowed rule, nsAString* result)
SERVO_BINDING_FUNC(Servo_DocumentRule_GetConditionText, void,
                   RawServoDocumentRuleBorrowed rule, nsAString* result)
SERVO_BINDING_FUNC(Servo_FontFeatureValuesRule_GetFontFamily, void,
                   RawServoFontFeatureValuesRuleBorrowed rule,
                   nsAString* result)
SERVO_BINDING_FUNC(Servo_FontFeatureValuesRule_GetValueText, void,
                   RawServoFontFeatureValuesRuleBorrowed rule,
                   nsAString* result)

// Animations API
SERVO_BINDING_FUNC(Servo_ParseProperty,
                   RawServoDeclarationBlockStrong,
                   nsCSSPropertyID property, const nsACString* value,
                   RawGeckoURLExtraData* data,
                   mozilla::ParsingMode parsing_mode,
                   nsCompatibility quirks_mode,
                   mozilla::css::Loader* loader)
SERVO_BINDING_FUNC(Servo_ParseEasing, bool,
                   const nsAString* easing,
                   RawGeckoURLExtraData* data,
                   nsTimingFunctionBorrowedMut output)
SERVO_BINDING_FUNC(Servo_GetComputedKeyframeValues, void,
                   RawGeckoKeyframeListBorrowed keyframes,
                   RawGeckoElementBorrowed element,
                   ServoStyleContextBorrowed style,
                   RawServoStyleSetBorrowed set,
                   RawGeckoComputedKeyframeValuesListBorrowedMut result)
SERVO_BINDING_FUNC(Servo_ComputedValues_ExtractAnimationValue,
                   RawServoAnimationValueStrong,
                   ServoStyleContextBorrowed computed_values,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_ComputedValues_SpecifiesAnimationsOrTransitions, bool,
                   ServoStyleContextBorrowed computed_values)
SERVO_BINDING_FUNC(Servo_Property_IsAnimatable, bool,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_Property_IsTransitionable, bool,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_Property_IsDiscreteAnimatable, bool,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_GetProperties_Overriding_Animation, void,
                   RawGeckoElementBorrowed,
                   RawGeckoCSSPropertyIDListBorrowed,
                   nsCSSPropertyIDSetBorrowedMut)
SERVO_BINDING_FUNC(Servo_MatrixTransform_Operate, void,
                   nsStyleTransformMatrix::MatrixTransformOperator
                     matrix_operator,
                   const RawGeckoGfxMatrix4x4* from,
                   const RawGeckoGfxMatrix4x4* to,
                   double progress,
                   RawGeckoGfxMatrix4x4* result)
SERVO_BINDING_FUNC(Servo_GetAnimationValues, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   RawGeckoElementBorrowed element,
                   ServoStyleContextBorrowed style,
                   RawServoStyleSetBorrowed style_set,
                   RawGeckoServoAnimationValueListBorrowedMut animation_values)

// AnimationValues handling
SERVO_BINDING_FUNC(Servo_AnimationValues_Interpolate,
                   RawServoAnimationValueStrong,
                   RawServoAnimationValueBorrowed from,
                   RawServoAnimationValueBorrowed to,
                   double progress)
SERVO_BINDING_FUNC(Servo_AnimationValues_IsInterpolable, bool,
                   RawServoAnimationValueBorrowed from,
                   RawServoAnimationValueBorrowed to)
SERVO_BINDING_FUNC(Servo_AnimationValues_Add,
                   RawServoAnimationValueStrong,
                   RawServoAnimationValueBorrowed a,
                   RawServoAnimationValueBorrowed b)
SERVO_BINDING_FUNC(Servo_AnimationValues_Accumulate,
                   RawServoAnimationValueStrong,
                   RawServoAnimationValueBorrowed a,
                   RawServoAnimationValueBorrowed b,
                   uint64_t count)
SERVO_BINDING_FUNC(Servo_AnimationValues_GetZeroValue,
                   RawServoAnimationValueStrong,
                   RawServoAnimationValueBorrowed value_to_match)
SERVO_BINDING_FUNC(Servo_AnimationValues_ComputeDistance, double,
                   RawServoAnimationValueBorrowed from,
                   RawServoAnimationValueBorrowed to)
SERVO_BINDING_FUNC(Servo_AnimationValue_Serialize, void,
                   RawServoAnimationValueBorrowed value,
                   nsCSSPropertyID property,
                   nsAString* buffer)
SERVO_BINDING_FUNC(Servo_Shorthand_AnimationValues_Serialize, void,
                   nsCSSPropertyID shorthand_property,
                   RawGeckoServoAnimationValueListBorrowed values,
                   nsAString* buffer)
SERVO_BINDING_FUNC(Servo_AnimationValue_GetOpacity, float,
                   RawServoAnimationValueBorrowed value)
SERVO_BINDING_FUNC(Servo_AnimationValue_Opacity,
                   RawServoAnimationValueStrong,
                   float)
SERVO_BINDING_FUNC(Servo_AnimationValue_GetTransform, void,
                   RawServoAnimationValueBorrowed value,
                   RefPtr<nsCSSValueSharedList>* list)
SERVO_BINDING_FUNC(Servo_AnimationValue_Transform,
                   RawServoAnimationValueStrong,
                   const nsCSSValueSharedList& list)
SERVO_BINDING_FUNC(Servo_AnimationValue_DeepEqual, bool,
                   RawServoAnimationValueBorrowed,
                   RawServoAnimationValueBorrowed)
SERVO_BINDING_FUNC(Servo_AnimationValue_Uncompute,
                   RawServoDeclarationBlockStrong,
                   RawServoAnimationValueBorrowed value)
SERVO_BINDING_FUNC(Servo_AnimationValue_Compute,
                   RawServoAnimationValueStrong,
                   RawGeckoElementBorrowed element,
                   RawServoDeclarationBlockBorrowed declarations,
                   ServoStyleContextBorrowed style,
                   RawServoStyleSetBorrowed raw_data)

// Style attribute
SERVO_BINDING_FUNC(Servo_ParseStyleAttribute, RawServoDeclarationBlockStrong,
                   const nsACString* data,
                   RawGeckoURLExtraData* extra_data,
                   nsCompatibility quirks_mode,
                   mozilla::css::Loader* loader)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_CreateEmpty,
                   RawServoDeclarationBlockStrong)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_Clone, RawServoDeclarationBlockStrong,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_Equals, bool,
                   RawServoDeclarationBlockBorrowed a,
                   RawServoDeclarationBlockBorrowed b)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_GetCssText, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsAString* result)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SerializeOneValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property, nsAString* buffer,
                   ServoStyleContextBorrowedOrNull computed_values,
                   RawServoDeclarationBlockBorrowedOrNull custom_properties)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_Count, uint32_t,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_GetNthProperty, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   uint32_t index, nsAString* result)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_GetPropertyValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   const nsACString* property, nsAString* value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_GetPropertyValueById, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property, nsAString* value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_GetPropertyIsImportant, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   const nsACString* property)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetProperty, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   const nsACString* property,
                   const nsACString* value, bool is_important,
                   RawGeckoURLExtraData* data,
                   mozilla::ParsingMode parsing_mode,
                   nsCompatibility quirks_mode,
                   mozilla::css::Loader* loader)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetPropertyById, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   const nsACString* value, bool is_important,
                   RawGeckoURLExtraData* data,
                   mozilla::ParsingMode parsing_mode,
                   nsCompatibility quirks_mode,
                   mozilla::css::Loader* loader)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_RemoveProperty, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   const nsACString* property)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_RemovePropertyById, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_HasCSSWideKeyword, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property)
// Compose animation value for a given property.
// |base_values| is nsRefPtrHashtable<nsUint32HashKey, RawServoAnimationValue>.
// We use RawServoAnimationValueTableBorrowed to avoid exposing
// nsRefPtrHashtable in FFI.
SERVO_BINDING_FUNC(Servo_AnimationCompose, void,
                   RawServoAnimationValueMapBorrowedMut animation_values,
                   RawServoAnimationValueTableBorrowed base_values,
                   nsCSSPropertyID property,
                   RawGeckoAnimationPropertySegmentBorrowed animation_segment,
                   RawGeckoAnimationPropertySegmentBorrowed last_segment,
                   RawGeckoComputedTimingBorrowed computed_timing,
                   mozilla::dom::IterationCompositeOperation iter_composite)
// Calculate the result of interpolating given animation segment at the given
// progress and current iteration.
// This includes combining the segment endpoints with the underlying value
// and/or last value depending the composite modes specified on the
// segment endpoints and the supplied iteration composite mode.
// The caller is responsible for providing an underlying value and
// last value in all situations where there are needed.
SERVO_BINDING_FUNC(Servo_ComposeAnimationSegment,
                   RawServoAnimationValueStrong,
                   RawGeckoAnimationPropertySegmentBorrowed animation_segment,
                   RawServoAnimationValueBorrowedOrNull underlying_value,
                   RawServoAnimationValueBorrowedOrNull last_value,
                   mozilla::dom::IterationCompositeOperation iter_composite,
                   double progress,
                   uint64_t current_iteration)

// presentation attributes
SERVO_BINDING_FUNC(Servo_DeclarationBlock_PropertyIsSet, bool,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetIdentStringValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   nsAtom* value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetKeywordValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   int32_t value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetIntValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   int32_t value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetPixelValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   float value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetLengthValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   float value,
                   nsCSSUnit unit)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetNumberValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   float value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetPercentValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   float value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetAutoValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetCurrentColor, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetColorValue, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsCSSPropertyID property,
                   nscolor value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetFontFamily, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   const nsAString& value)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetTextDecorationColorOverride, void,
                   RawServoDeclarationBlockBorrowed declarations)
SERVO_BINDING_FUNC(Servo_DeclarationBlock_SetBackgroundImage, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   const nsAString& value,
                   RawGeckoURLExtraData* extra_data)

// MediaList
SERVO_BINDING_FUNC(Servo_MediaList_Create, RawServoMediaListStrong)
SERVO_BINDING_FUNC(Servo_MediaList_DeepClone, RawServoMediaListStrong,
                   RawServoMediaListBorrowed list)
SERVO_BINDING_FUNC(Servo_MediaList_Matches, bool,
                   RawServoMediaListBorrowed list,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_MediaList_GetText, void,
                   RawServoMediaListBorrowed list, nsAString* result)
SERVO_BINDING_FUNC(Servo_MediaList_SetText, void,
                   RawServoMediaListBorrowed list, const nsACString* text,
                   mozilla::dom::CallerType aCallerType)
SERVO_BINDING_FUNC(Servo_MediaList_GetLength, uint32_t,
                   RawServoMediaListBorrowed list)
SERVO_BINDING_FUNC(Servo_MediaList_GetMediumAt, bool,
                   RawServoMediaListBorrowed list, uint32_t index,
                   nsAString* result)
SERVO_BINDING_FUNC(Servo_MediaList_AppendMedium, void,
                   RawServoMediaListBorrowed list, const nsACString* new_medium)
SERVO_BINDING_FUNC(Servo_MediaList_DeleteMedium, bool,
                   RawServoMediaListBorrowed list, const nsACString* old_medium)

// CSS supports()
SERVO_BINDING_FUNC(Servo_CSSSupports2, bool,
                   const nsACString* name, const nsACString* value)
SERVO_BINDING_FUNC(Servo_CSSSupports, bool,
                   const nsACString* cond)

// Computed style data
SERVO_BINDING_FUNC(Servo_ComputedValues_GetForAnonymousBox,
                   ServoStyleContextStrong,
                   ServoStyleContextBorrowedOrNull parent_style_or_null,
                   nsAtom* pseudo_tag,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_ComputedValues_Inherit, ServoStyleContextStrong,
                   RawServoStyleSetBorrowed set,
                   nsAtom* pseudo_tag,
                   ServoStyleContextBorrowedOrNull parent_style,
                   mozilla::InheritTarget target)
SERVO_BINDING_FUNC(Servo_ComputedValues_GetStyleBits, uint64_t,
                   ServoStyleContextBorrowed values)
SERVO_BINDING_FUNC(Servo_ComputedValues_EqualCustomProperties, bool,
                   ServoComputedDataBorrowed first,
                   ServoComputedDataBorrowed second)
// Gets the source style rules for the computed values. This returns
// the result via rules, which would include a list of unowned pointers
// to RawServoStyleRule.
SERVO_BINDING_FUNC(Servo_ComputedValues_GetStyleRuleList, void,
                   ServoStyleContextBorrowed values,
                   RawGeckoServoStyleRuleListBorrowedMut rules)

// Initialize Servo components. Should be called exactly once at startup.
SERVO_BINDING_FUNC(Servo_Initialize, void,
                   RawGeckoURLExtraData* dummy_url_data)
// Initialize Servo on a cooperative Quantum DOM thread.
SERVO_BINDING_FUNC(Servo_InitializeCooperativeThread, void);
// Shut down Servo components. Should be called exactly once at shutdown.
SERVO_BINDING_FUNC(Servo_Shutdown, void)

// Restyle and change hints.
SERVO_BINDING_FUNC(Servo_NoteExplicitHints, void, RawGeckoElementBorrowed element,
                   nsRestyleHint restyle_hint, nsChangeHint change_hint)
// We'd like to return `nsChangeHint` here, but bindgen bitfield enums don't
// work as return values with the Linux 32-bit ABI at the moment because
// they wrap the value in a struct.
SERVO_BINDING_FUNC(Servo_TakeChangeHint,
                   uint32_t,
                   RawGeckoElementBorrowed element,
                   bool* was_restyled)
SERVO_BINDING_FUNC(Servo_ResolveStyle, ServoStyleContextStrong,
                   RawGeckoElementBorrowed element,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_ResolvePseudoStyle, ServoStyleContextStrong,
                   RawGeckoElementBorrowed element,
                   mozilla::CSSPseudoElementType pseudo_type,
                   bool is_probe,
                   ServoStyleContextBorrowedOrNull inherited_style,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_ComputedValues_ResolveXULTreePseudoStyle,
                   ServoStyleContextStrong,
                   RawGeckoElementBorrowed element,
                   nsAtom* pseudo_tag,
                   ServoStyleContextBorrowed inherited_style,
                   const mozilla::AtomArray* input_word,
                   RawServoStyleSetBorrowed set)
SERVO_BINDING_FUNC(Servo_SetExplicitStyle, void,
                   RawGeckoElementBorrowed element,
                   ServoStyleContextBorrowed primary_style)
SERVO_BINDING_FUNC(Servo_HasAuthorSpecifiedRules, bool,
                   ServoStyleContextBorrowed style,
                   RawGeckoElementBorrowed element,
                   mozilla::CSSPseudoElementType pseudo_type,
                   uint32_t rule_type_mask,
                   bool author_colors_allowed)

// Resolves style for an element or pseudo-element without processing pending
// restyles first. The Element and its ancestors may be unstyled, have pending
// restyles, or be in a display:none subtree. Styles are cached when possible,
// though caching is not possible within display:none subtrees, and the styles
// may be invalidated by already-scheduled restyles.
//
// The tree must be in a consistent state such that a normal traversal could be
// performed, and this function maintains that invariant.
SERVO_BINDING_FUNC(Servo_ResolveStyleLazily, ServoStyleContextStrong,
                   RawGeckoElementBorrowed element,
                   mozilla::CSSPseudoElementType pseudo_type,
                   mozilla::StyleRuleInclusion rule_inclusion,
                   const mozilla::ServoElementSnapshotTable* snapshots,
                   RawServoStyleSetBorrowed set,
                   bool ignore_existing_styles)

// Reparents style to the new parents.
SERVO_BINDING_FUNC(Servo_ReparentStyle, ServoStyleContextStrong,
                   ServoStyleContextBorrowed style_to_reparent,
                   ServoStyleContextBorrowed parent_style,
                   ServoStyleContextBorrowed parent_style_ignoring_first_line,
                   ServoStyleContextBorrowed layout_parent_style,
                   // element is null if there is no content node involved, or
                   // if it's not an element.
                   RawGeckoElementBorrowedOrNull element,
                   RawServoStyleSetBorrowed set);

// Use ServoStyleSet::PrepareAndTraverseSubtree instead of calling this
// directly
SERVO_BINDING_FUNC(Servo_TraverseSubtree,
                   bool,
                   RawGeckoElementBorrowed root,
                   RawServoStyleSetBorrowed set,
                   const mozilla::ServoElementSnapshotTable* snapshots,
                   mozilla::ServoTraversalFlags flags)

// Assert that the tree has no pending or unconsumed restyles.
SERVO_BINDING_FUNC(Servo_AssertTreeIsClean, void, RawGeckoElementBorrowed root)

// Returns true if the current thread is a Servo parallel worker thread.
SERVO_BINDING_FUNC(Servo_IsWorkerThread, bool, )

// Checks whether the rule tree has crossed its threshold for unused rule nodes,
// and if so, frees them.
SERVO_BINDING_FUNC(Servo_MaybeGCRuleTree, void, RawServoStyleSetBorrowed set)

// Returns computed values for the given element without any animations rules.
SERVO_BINDING_FUNC(Servo_StyleSet_GetBaseComputedValuesForElement,
                   ServoStyleContextStrong,
                   RawServoStyleSetBorrowed set,
                   RawGeckoElementBorrowed element,
                   ServoStyleContextBorrowed existing_style,
                   const mozilla::ServoElementSnapshotTable* snapshots)
// Returns computed values for the given element by adding an animation value.
SERVO_BINDING_FUNC(Servo_StyleSet_GetComputedValuesByAddingAnimation,
                   ServoStyleContextStrong,
                   RawServoStyleSetBorrowed set,
                   RawGeckoElementBorrowed element,
                   ServoStyleContextBorrowed existing_style,
                   const mozilla::ServoElementSnapshotTable* snapshots,
                   RawServoAnimationValueBorrowed animation)

// For canvas font.
SERVO_BINDING_FUNC(Servo_SerializeFontValueForCanvas, void,
                   RawServoDeclarationBlockBorrowed declarations,
                   nsAString* buffer)

// Get custom property value.
SERVO_BINDING_FUNC(Servo_GetCustomPropertyValue, bool,
                   ServoStyleContextBorrowed computed_values,
                   const nsAString* name, nsAString* value)

SERVO_BINDING_FUNC(Servo_GetCustomPropertiesCount, uint32_t,
                   ServoStyleContextBorrowed computed_values)

SERVO_BINDING_FUNC(Servo_GetCustomPropertyNameAt, bool,
                   ServoStyleContextBorrowed, uint32_t index,
                   nsAString* name)


SERVO_BINDING_FUNC(Servo_ProcessInvalidations, void,
                   RawServoStyleSetBorrowed set,
                   RawGeckoElementBorrowed element,
                   const mozilla::ServoElementSnapshotTable* snapshots)


SERVO_BINDING_FUNC(Servo_HasPendingRestyleAncestor, bool,
                   RawGeckoElementBorrowed element)

SERVO_BINDING_FUNC(Servo_GetArcStringData, void,
                   const RustString*, uint8_t const** chars, uint32_t* len);
SERVO_BINDING_FUNC(Servo_ReleaseArcStringData, void,
                   const mozilla::ServoRawOffsetArc<RustString>* string);
SERVO_BINDING_FUNC(Servo_CloneArcStringData, mozilla::ServoRawOffsetArc<RustString>,
                   const mozilla::ServoRawOffsetArc<RustString>* string);

// CSS parsing utility functions.
SERVO_BINDING_FUNC(Servo_IsValidCSSColor, bool, const nsAString* value);
SERVO_BINDING_FUNC(Servo_ComputeColor, bool,
                   RawServoStyleSetBorrowedOrNull set,
                   nscolor current_color,
                   const nsAString* value,
                   nscolor* result_color,
                   bool* was_current_color,
                   mozilla::css::Loader* loader)
SERVO_BINDING_FUNC(Servo_ParseIntersectionObserverRootMargin, bool,
                   const nsAString* value,
                   nsCSSRect* result);
// Returning false means the parsed transform contains relative lengths or
// percentage value, so we cannot compute the matrix. In this case, we keep
// |result| and |contains_3d_transform| as-is.
SERVO_BINDING_FUNC(Servo_ParseTransformIntoMatrix, bool,
                   const nsAString* value,
                   bool* contains_3d_transform,
                   RawGeckoGfxMatrix4x4* result);
SERVO_BINDING_FUNC(Servo_ParseCounterStyleName, nsAtom*,
                   const nsACString* value);
SERVO_BINDING_FUNC(Servo_ParseCounterStyleDescriptor, bool,
                   nsCSSCounterDesc aDescriptor,
                   const nsACString* aValue,
                   RawGeckoURLExtraData* aURLExtraData,
                   nsCSSValue* aResult);
SERVO_BINDING_FUNC(Servo_ParseFontDescriptor, bool,
                   nsCSSFontDesc desc_id,
                   const nsAString* value,
                   RawGeckoURLExtraData* data,
                   nsCSSValueBorrowedMut);
SERVO_BINDING_FUNC(Servo_ParseFontShorthandForMatching, bool,
                   const nsAString* value,
                   RawGeckoURLExtraData* data,
                   RefPtr<SharedFontList>* family,
                   nsCSSValueBorrowedMut style,
                   nsCSSValueBorrowedMut stretch,
                   nsCSSValueBorrowedMut weight);


// AddRef / Release functions
#define SERVO_ARC_TYPE(name_, type_)                                \
  SERVO_BINDING_FUNC(Servo_##name_##_AddRef, void, type_##Borrowed) \
  SERVO_BINDING_FUNC(Servo_##name_##_Release, void, type_##Borrowed)
#include "mozilla/ServoArcTypeList.h"
#undef SERVO_ARC_TYPE
