use quote::{Tokens, ToTokens};
use syn;

use ast::{Data, Style, Fields};
use codegen::{Field, TraitImpl, OuterFromImpl, Variant};

pub struct FmiImpl<'a> {
    pub base: TraitImpl<'a>,
}

impl<'a> ToTokens for FmiImpl<'a> {
    fn to_tokens(&self, tokens: &mut Tokens) {
        let base = &self.base;

        let impl_block = match base.data {
            // Unit structs allow empty bodies only.
            Data::Struct(ref vd) if vd.style.is_unit() => {
                let ty_ident = base.ident;
                quote!(
                    fn from_word() -> ::darling::Result<Self> {
                        Ok(#ty_ident)
                    }
                )
            }

            // Newtype structs proxy to the sole value they contain.
            Data::Struct(Fields { ref fields, style: Style::Tuple, .. }) if fields.len() == 1 => {
                let ty_ident = base.ident;
                quote!(
                    fn from_meta_item(__item: &::syn::Meta) -> ::darling::Result<Self> {
                        Ok(#ty_ident(::darling::FromMetaItem::from_meta_item(__item)?))
                    }
                )
            }
            Data::Struct(Fields { style: Style::Tuple, .. }) => {
                panic!("Multi-field tuples are not supported");
            }
            Data::Struct(ref data) => {
                let inits = data.fields.iter().map(Field::as_initializer);
                let declare_errors = base.declare_errors();
                let require_fields = base.require_fields();
                let check_errors = base.check_errors();
                let decls = base.local_declarations();
                let core_loop = base.core_loop();
                let default = base.fallback_decl();
                let map = base.map_fn();


                quote!(
                    fn from_list(__items: &[::syn::NestedMeta]) -> ::darling::Result<Self> {

                        #decls

                        #declare_errors

                        #core_loop

                        #require_fields

                        #check_errors

                        #default

                        ::darling::export::Ok(Self {
                            #(#inits),*
                        }) #map
                    }
                )
            }
            Data::Enum(ref variants) => {
                let unit_arms = variants.iter().map(Variant::as_unit_match_arm);
                let struct_arms = variants.iter().map(Variant::as_data_match_arm);

                quote!(
                    fn from_list(__outer: &[::syn::NestedMeta]) -> ::darling::Result<Self> {
                        // An enum must have exactly one value inside the parentheses if it's not a unit
                        // match arm
                        match __outer.len() {
                            0 => ::darling::export::Err(::darling::Error::too_few_items(1)),
                            1 => {
                                if let ::syn::NestedMeta::Meta(ref __nested) = __outer[0] {
                                    match __nested.name().as_ref() {
                                        #(#struct_arms)*
                                        __other => ::darling::export::Err(::darling::Error::unknown_value(__other))
                                    }
                                } else {
                                    ::darling::export::Err(::darling::Error::unsupported_format("literal"))
                                }
                            }
                            _ => ::darling::export::Err(::darling::Error::too_many_items(1)),
                        }
                    }

                    fn from_string(lit: &str) -> ::darling::Result<Self> {
                        match lit {
                            #(#unit_arms)*
                            __other => ::darling::export::Err(::darling::Error::unknown_value(__other))
                        }
                    }
                )
            }
        };

        self.wrap(impl_block, tokens);
    }
}

impl<'a> OuterFromImpl<'a> for FmiImpl<'a> {
    fn trait_path(&self) -> syn::Path {
        path!(::darling::FromMetaItem)
    }

    fn base(&'a self) -> &'a TraitImpl<'a> {
        &self.base
    }
}
