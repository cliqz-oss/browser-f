//! A public API for more fine-grained customization of bindgen behavior.

pub use ir::enum_ty::{EnumVariantCustomBehavior, EnumVariantValue};
pub use ir::int::IntKind;
use std::fmt;
use std::panic::UnwindSafe;

/// An enum to allow ignoring parsing of macros.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum MacroParsingBehavior {
    /// Ignore the macro, generating no code for it, or anything that depends on
    /// it.
    Ignore,
    /// The default behavior bindgen would have otherwise.
    Default,
}

impl Default for MacroParsingBehavior {
    fn default() -> Self {
        MacroParsingBehavior::Default
    }
}

/// A trait to allow configuring different kinds of types in different
/// situations.
pub trait ParseCallbacks: fmt::Debug + UnwindSafe {
    /// This function will be run on every macro that is identified.
    fn will_parse_macro(&self, _name: &str) -> MacroParsingBehavior {
        MacroParsingBehavior::Default
    }

    /// The integer kind an integer macro should have, given a name and the
    /// value of that macro, or `None` if you want the default to be chosen.
    fn int_macro(&self, _name: &str, _value: i64) -> Option<IntKind> {
        None
    }

    /// This function should return whether, given the a given enum variant
    /// name, and value, this enum variant will forcibly be a constant.
    fn enum_variant_behavior(
        &self,
        _enum_name: Option<&str>,
        _original_variant_name: &str,
        _variant_value: EnumVariantValue,
    ) -> Option<EnumVariantCustomBehavior> {
        None
    }

    /// Allows to rename an enum variant, replacing `_original_variant_name`.
    fn enum_variant_name(
        &self,
        _enum_name: Option<&str>,
        _original_variant_name: &str,
        _variant_value: EnumVariantValue,
    ) -> Option<String> {
        None
    }
}
