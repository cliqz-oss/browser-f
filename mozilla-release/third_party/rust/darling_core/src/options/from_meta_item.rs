use syn;

use Result;
use codegen;
use options::{Core, ParseAttribute, ParseData};

pub struct FmiOptions {
    base: Core
}

impl FmiOptions {
    pub fn new(di: &syn::DeriveInput) -> Result<Self> {
        (FmiOptions {
            base: Core::start(di),
        }).parse_attributes(&di.attrs)?.parse_body(&di.data)
    }
}

impl ParseAttribute for FmiOptions {
    fn parse_nested(&mut self, mi: &syn::Meta) -> Result<()> {
        self.base.parse_nested(mi)
    }
}

impl ParseData for FmiOptions {
    fn parse_variant(&mut self, variant: &syn::Variant) -> Result<()> {
        self.base.parse_variant(variant)
    }

    fn parse_field(&mut self, field: &syn::Field) -> Result<()> {
        self.base.parse_field(field)
    }
}

impl<'a> From<&'a FmiOptions> for codegen::FmiImpl<'a> {
    fn from(v: &'a FmiOptions) -> Self {
        codegen::FmiImpl {
            base: (&v.base).into(),
        }
    }
}
