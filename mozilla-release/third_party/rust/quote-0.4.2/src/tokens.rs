use super::ToTokens;
use std::fmt::{self, Debug, Display};
use std::hash::{Hash, Hasher};

use proc_macro;
use proc_macro2::{TokenStream, TokenTree};

/// Tokens produced by a [`quote!`] invocation.
///
/// [`quote!`]: macro.quote.html
#[derive(Clone, Default)]
pub struct Tokens {
    tts: Vec<TokenTree>,
}

impl Tokens {
    /// Empty tokens.
    pub fn new() -> Self {
        Tokens { tts: Vec::new() }
    }

    /// For use by `ToTokens` implementations.
    ///
    /// Appends the token specified to this list of tokens.
    pub fn append<U>(&mut self, token: U)
    where
        U: Into<TokenTree>,
    {
        self.tts.push(token.into());
    }

    /// For use by `ToTokens` implementations.
    ///
    /// ```
    /// # #[macro_use] extern crate quote;
    /// # use quote::{Tokens, ToTokens};
    /// # fn main() {
    /// struct X;
    ///
    /// impl ToTokens for X {
    ///     fn to_tokens(&self, tokens: &mut Tokens) {
    ///         tokens.append_all(&[true, false]);
    ///     }
    /// }
    ///
    /// let tokens = quote!(#X);
    /// assert_eq!(tokens.to_string(), "true false");
    /// # }
    /// ```
    pub fn append_all<T, I>(&mut self, iter: I)
    where
        T: ToTokens,
        I: IntoIterator<Item = T>,
    {
        for token in iter {
            token.to_tokens(self);
        }
    }

    /// For use by `ToTokens` implementations.
    ///
    /// Appends all of the items in the iterator `I`, separated by the tokens
    /// `U`.
    pub fn append_separated<T, I, U>(&mut self, iter: I, op: U)
    where
        T: ToTokens,
        I: IntoIterator<Item = T>,
        U: ToTokens,
    {
        for (i, token) in iter.into_iter().enumerate() {
            if i > 0 {
                op.to_tokens(self);
            }
            token.to_tokens(self);
        }
    }

    /// For use by `ToTokens` implementations.
    ///
    /// Appends all tokens in the iterator `I`, appending `U` after each
    /// element, including after the last element of the iterator.
    pub fn append_terminated<T, I, U>(&mut self, iter: I, term: U)
    where
        T: ToTokens,
        I: IntoIterator<Item = T>,
        U: ToTokens,
    {
        for token in iter {
            token.to_tokens(self);
            term.to_tokens(self);
        }
    }
}

impl ToTokens for Tokens {
    fn to_tokens(&self, dst: &mut Tokens) {
        dst.tts.extend(self.tts.iter().cloned());
    }

    fn into_tokens(self) -> Tokens {
        self
    }
}

impl From<Tokens> for TokenStream {
    fn from(tokens: Tokens) -> TokenStream {
        tokens.tts.into_iter().collect()
    }
}

impl From<Tokens> for proc_macro::TokenStream {
    fn from(tokens: Tokens) -> proc_macro::TokenStream {
        TokenStream::from(tokens).into()
    }
}

/// Allows a `Tokens` to be passed to `Tokens::append_all`.
impl IntoIterator for Tokens {
    type Item = TokenTree;
    type IntoIter = private::IntoIter;

    fn into_iter(self) -> Self::IntoIter {
        private::into_iter(self.tts.into_iter())
    }
}

mod private {
    use std::vec;
    use proc_macro2::TokenTree;

    pub struct IntoIter(vec::IntoIter<TokenTree>);

    pub fn into_iter(tts: vec::IntoIter<TokenTree>) -> IntoIter {
        IntoIter(tts)
    }

    impl Iterator for IntoIter {
        type Item = TokenTree;

        fn next(&mut self) -> Option<Self::Item> {
            self.0.next()
        }
    }
}

impl Display for Tokens {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        Display::fmt(&TokenStream::from(self.clone()), formatter)
    }
}

impl Debug for Tokens {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        struct DebugAsDisplay<'a, T: 'a>(&'a T);

        impl<'a, T> Debug for DebugAsDisplay<'a, T>
        where
            T: Display,
        {
            fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                Display::fmt(self.0, formatter)
            }
        }

        formatter
            .debug_tuple("Tokens")
            .field(&DebugAsDisplay(self))
            .finish()
    }
}

fn tt_eq(a: &TokenTree, b: &TokenTree) -> bool {
    use proc_macro2::{TokenNode, Delimiter, Spacing};

    match (&a.kind, &b.kind) {
        (&TokenNode::Group(d1, ref s1), &TokenNode::Group(d2, ref s2)) => {
            match (d1, d2) {
                (Delimiter::Parenthesis, Delimiter::Parenthesis)
                | (Delimiter::Brace, Delimiter::Brace)
                | (Delimiter::Bracket, Delimiter::Bracket)
                | (Delimiter::None, Delimiter::None) => {}
                _ => return false,
            }

            let s1 = s1.clone().into_iter();
            let mut s2 = s2.clone().into_iter();

            for item1 in s1 {
                let item2 = match s2.next() {
                    Some(item) => item,
                    None => return false,
                };
                if !tt_eq(&item1, &item2) {
                    return false;
                }
            }
            s2.next().is_none()
        }
        (&TokenNode::Op(o1, k1), &TokenNode::Op(o2, k2)) => {
            o1 == o2 && match (k1, k2) {
                (Spacing::Alone, Spacing::Alone) | (Spacing::Joint, Spacing::Joint) => true,
                _ => false,
            }
        }
        (&TokenNode::Literal(ref l1), &TokenNode::Literal(ref l2)) => {
            l1.to_string() == l2.to_string()
        }
        (&TokenNode::Term(ref s1), &TokenNode::Term(ref s2)) => s1.as_str() == s2.as_str(),
        _ => false,
    }
}

impl PartialEq for Tokens {
    fn eq(&self, other: &Self) -> bool {
        if self.tts.len() != other.tts.len() {
            return false;
        }

        self.tts
            .iter()
            .zip(other.tts.iter())
            .all(|(a, b)| tt_eq(a, b))
    }
}

fn tt_hash<H: Hasher>(tt: &TokenTree, h: &mut H) {
    use proc_macro2::{TokenNode, Delimiter, Spacing};

    match tt.kind {
        TokenNode::Group(delim, ref stream) => {
            0u8.hash(h);
            match delim {
                Delimiter::Parenthesis => 0u8.hash(h),
                Delimiter::Brace => 1u8.hash(h),
                Delimiter::Bracket => 2u8.hash(h),
                Delimiter::None => 3u8.hash(h),
            }

            for item in stream.clone() {
                tt_hash(&item, h);
            }
            0xffu8.hash(h); // terminator w/ a variant we don't normally hash
        }
        TokenNode::Op(op, kind) => {
            1u8.hash(h);
            op.hash(h);
            match kind {
                Spacing::Alone => 0u8.hash(h),
                Spacing::Joint => 1u8.hash(h),
            }
        }
        TokenNode::Literal(ref lit) => (2u8, lit.to_string()).hash(h),
        TokenNode::Term(ref word) => (3u8, word.as_str()).hash(h),
    }
}

impl<'a> Hash for Tokens {
    fn hash<H: Hasher>(&self, h: &mut H) {
        self.tts.len().hash(h);
        for tt in &self.tts {
            tt_hash(&tt, h);
        }
    }
}
