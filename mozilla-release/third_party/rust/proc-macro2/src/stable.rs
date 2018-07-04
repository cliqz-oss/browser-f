#![cfg_attr(not(procmacro2_semver_exempt), allow(dead_code))]

use std::borrow::Borrow;
use std::cell::RefCell;
#[cfg(procmacro2_semver_exempt)]
use std::cmp;
use std::collections::HashMap;
use std::fmt;
use std::iter;
use std::rc::Rc;
use std::str::FromStr;
use std::vec;

use strnom::{block_comment, skip_whitespace, whitespace, word_break, Cursor, PResult};
use unicode_xid::UnicodeXID;

use {Delimiter, Group, Op, Spacing, TokenTree};

#[derive(Clone, Debug)]
pub struct TokenStream {
    inner: Vec<TokenTree>,
}

#[derive(Debug)]
pub struct LexError;

impl TokenStream {
    pub fn empty() -> TokenStream {
        TokenStream { inner: Vec::new() }
    }

    pub fn is_empty(&self) -> bool {
        self.inner.len() == 0
    }
}

#[cfg(procmacro2_semver_exempt)]
fn get_cursor(src: &str) -> Cursor {
    // Create a dummy file & add it to the codemap
    CODEMAP.with(|cm| {
        let mut cm = cm.borrow_mut();
        let name = format!("<parsed string {}>", cm.files.len());
        let span = cm.add_file(&name, src);
        Cursor {
            rest: src,
            off: span.lo,
        }
    })
}

#[cfg(not(procmacro2_semver_exempt))]
fn get_cursor(src: &str) -> Cursor {
    Cursor { rest: src }
}

impl FromStr for TokenStream {
    type Err = LexError;

    fn from_str(src: &str) -> Result<TokenStream, LexError> {
        // Create a dummy file & add it to the codemap
        let cursor = get_cursor(src);

        match token_stream(cursor) {
            Ok((input, output)) => {
                if skip_whitespace(input).len() != 0 {
                    Err(LexError)
                } else {
                    Ok(output.inner)
                }
            }
            Err(LexError) => Err(LexError),
        }
    }
}

impl fmt::Display for TokenStream {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let mut joint = false;
        for (i, tt) in self.inner.iter().enumerate() {
            if i != 0 && !joint {
                write!(f, " ")?;
            }
            joint = false;
            match *tt {
                TokenTree::Group(ref tt) => {
                    let (start, end) = match tt.delimiter() {
                        Delimiter::Parenthesis => ("(", ")"),
                        Delimiter::Brace => ("{", "}"),
                        Delimiter::Bracket => ("[", "]"),
                        Delimiter::None => ("", ""),
                    };
                    if tt.stream().inner.inner.len() == 0 {
                        write!(f, "{} {}", start, end)?
                    } else {
                        write!(f, "{} {} {}", start, tt.stream(), end)?
                    }
                }
                TokenTree::Term(ref tt) => write!(f, "{}", tt.as_str())?,
                TokenTree::Op(ref tt) => {
                    write!(f, "{}", tt.op())?;
                    match tt.spacing() {
                        Spacing::Alone => {}
                        Spacing::Joint => joint = true,
                    }
                }
                TokenTree::Literal(ref tt) => write!(f, "{}", tt)?,
            }
        }

        Ok(())
    }
}

#[cfg(feature = "proc-macro")]
impl From<::proc_macro::TokenStream> for TokenStream {
    fn from(inner: ::proc_macro::TokenStream) -> TokenStream {
        inner
            .to_string()
            .parse()
            .expect("compiler token stream parse failed")
    }
}

#[cfg(feature = "proc-macro")]
impl From<TokenStream> for ::proc_macro::TokenStream {
    fn from(inner: TokenStream) -> ::proc_macro::TokenStream {
        inner
            .to_string()
            .parse()
            .expect("failed to parse to compiler tokens")
    }
}

impl From<TokenTree> for TokenStream {
    fn from(tree: TokenTree) -> TokenStream {
        TokenStream { inner: vec![tree] }
    }
}

impl iter::FromIterator<TokenTree> for TokenStream {
    fn from_iter<I: IntoIterator<Item = TokenTree>>(streams: I) -> Self {
        let mut v = Vec::new();

        for token in streams.into_iter() {
            v.push(token);
        }

        TokenStream { inner: v }
    }
}

pub type TokenTreeIter = vec::IntoIter<TokenTree>;

impl IntoIterator for TokenStream {
    type Item = TokenTree;
    type IntoIter = TokenTreeIter;

    fn into_iter(self) -> TokenTreeIter {
        self.inner.into_iter()
    }
}

#[cfg(procmacro2_semver_exempt)]
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct FileName(String);

#[cfg(procmacro2_semver_exempt)]
impl fmt::Display for FileName {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(procmacro2_semver_exempt)]
#[derive(Clone, PartialEq, Eq)]
pub struct SourceFile {
    name: FileName,
}

#[cfg(procmacro2_semver_exempt)]
impl SourceFile {
    /// Get the path to this source file as a string.
    pub fn path(&self) -> &FileName {
        &self.name
    }

    pub fn is_real(&self) -> bool {
        // XXX(nika): Support real files in the future?
        false
    }
}

#[cfg(procmacro2_semver_exempt)]
impl AsRef<FileName> for SourceFile {
    fn as_ref(&self) -> &FileName {
        self.path()
    }
}

#[cfg(procmacro2_semver_exempt)]
impl fmt::Debug for SourceFile {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.debug_struct("SourceFile")
            .field("path", &self.path())
            .field("is_real", &self.is_real())
            .finish()
    }
}

#[cfg(procmacro2_semver_exempt)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LineColumn {
    pub line: usize,
    pub column: usize,
}

#[cfg(procmacro2_semver_exempt)]
thread_local! {
    static CODEMAP: RefCell<Codemap> = RefCell::new(Codemap {
        // NOTE: We start with a single dummy file which all call_site() and
        // def_site() spans reference.
        files: vec![FileInfo {
            name: "<unspecified>".to_owned(),
            span: Span { lo: 0, hi: 0 },
            lines: vec![0],
        }],
    });
}

#[cfg(procmacro2_semver_exempt)]
struct FileInfo {
    name: String,
    span: Span,
    lines: Vec<usize>,
}

#[cfg(procmacro2_semver_exempt)]
impl FileInfo {
    fn offset_line_column(&self, offset: usize) -> LineColumn {
        assert!(self.span_within(Span {
            lo: offset as u32,
            hi: offset as u32
        }));
        let offset = offset - self.span.lo as usize;
        match self.lines.binary_search(&offset) {
            Ok(found) => LineColumn {
                line: found + 1,
                column: 0,
            },
            Err(idx) => LineColumn {
                line: idx,
                column: offset - self.lines[idx - 1],
            },
        }
    }

    fn span_within(&self, span: Span) -> bool {
        span.lo >= self.span.lo && span.hi <= self.span.hi
    }
}

/// Computesthe offsets of each line in the given source string.
#[cfg(procmacro2_semver_exempt)]
fn lines_offsets(s: &str) -> Vec<usize> {
    let mut lines = vec![0];
    let mut prev = 0;
    while let Some(len) = s[prev..].find('\n') {
        prev += len + 1;
        lines.push(prev);
    }
    lines
}

#[cfg(procmacro2_semver_exempt)]
struct Codemap {
    files: Vec<FileInfo>,
}

#[cfg(procmacro2_semver_exempt)]
impl Codemap {
    fn next_start_pos(&self) -> u32 {
        // Add 1 so there's always space between files.
        //
        // We'll always have at least 1 file, as we initialize our files list
        // with a dummy file.
        self.files.last().unwrap().span.hi + 1
    }

    fn add_file(&mut self, name: &str, src: &str) -> Span {
        let lines = lines_offsets(src);
        let lo = self.next_start_pos();
        // XXX(nika): Shouild we bother doing a checked cast or checked add here?
        let span = Span {
            lo: lo,
            hi: lo + (src.len() as u32),
        };

        self.files.push(FileInfo {
            name: name.to_owned(),
            span: span,
            lines: lines,
        });

        span
    }

    fn fileinfo(&self, span: Span) -> &FileInfo {
        for file in &self.files {
            if file.span_within(span) {
                return file;
            }
        }
        panic!("Invalid span with no related FileInfo!");
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Span {
    #[cfg(procmacro2_semver_exempt)]
    lo: u32,
    #[cfg(procmacro2_semver_exempt)]
    hi: u32,
}

impl Span {
    #[cfg(not(procmacro2_semver_exempt))]
    pub fn call_site() -> Span {
        Span {}
    }

    #[cfg(procmacro2_semver_exempt)]
    pub fn call_site() -> Span {
        Span { lo: 0, hi: 0 }
    }

    pub fn def_site() -> Span {
        Span::call_site()
    }

    pub fn resolved_at(&self, _other: Span) -> Span {
        // Stable spans consist only of line/column information, so
        // `resolved_at` and `located_at` only select which span the
        // caller wants line/column information from.
        *self
    }

    pub fn located_at(&self, other: Span) -> Span {
        other
    }

    #[cfg(procmacro2_semver_exempt)]
    pub fn source_file(&self) -> SourceFile {
        CODEMAP.with(|cm| {
            let cm = cm.borrow();
            let fi = cm.fileinfo(*self);
            SourceFile {
                name: FileName(fi.name.clone()),
            }
        })
    }

    #[cfg(procmacro2_semver_exempt)]
    pub fn start(&self) -> LineColumn {
        CODEMAP.with(|cm| {
            let cm = cm.borrow();
            let fi = cm.fileinfo(*self);
            fi.offset_line_column(self.lo as usize)
        })
    }

    #[cfg(procmacro2_semver_exempt)]
    pub fn end(&self) -> LineColumn {
        CODEMAP.with(|cm| {
            let cm = cm.borrow();
            let fi = cm.fileinfo(*self);
            fi.offset_line_column(self.hi as usize)
        })
    }

    #[cfg(procmacro2_semver_exempt)]
    pub fn join(&self, other: Span) -> Option<Span> {
        CODEMAP.with(|cm| {
            let cm = cm.borrow();
            // If `other` is not within the same FileInfo as us, return None.
            if !cm.fileinfo(*self).span_within(other) {
                return None;
            }
            Some(Span {
                lo: cmp::min(self.lo, other.lo),
                hi: cmp::max(self.hi, other.hi),
            })
        })
    }
}

#[derive(Copy, Clone)]
pub struct Term {
    intern: usize,
    span: Span,
}

thread_local!(static SYMBOLS: RefCell<Interner> = RefCell::new(Interner::new()));

impl Term {
    pub fn new(string: &str, span: Span) -> Term {
        validate_term(string);

        Term {
            intern: SYMBOLS.with(|s| s.borrow_mut().intern(string)),
            span: span,
        }
    }

    pub fn as_str(&self) -> &str {
        SYMBOLS.with(|interner| {
            let interner = interner.borrow();
            let s = interner.get(self.intern);
            unsafe { &*(s as *const str) }
        })
    }

    pub fn span(&self) -> Span {
        self.span
    }

    pub fn set_span(&mut self, span: Span) {
        self.span = span;
    }
}

fn validate_term(string: &str) {
    let validate = if string.starts_with('\'') {
        &string[1..]
    } else if string.starts_with("r#") {
        &string[2..]
    } else {
        string
    };

    if validate.is_empty() {
        panic!("Term is not allowed to be empty; use Option<Term>");
    }

    if validate.bytes().all(|digit| digit >= b'0' && digit <= b'9') {
        panic!("Term cannot be a number; use Literal instead");
    }

    fn xid_ok(string: &str) -> bool {
        let mut chars = string.chars();
        let first = chars.next().unwrap();
        if !(UnicodeXID::is_xid_start(first) || first == '_') {
            return false;
        }
        for ch in chars {
            if !UnicodeXID::is_xid_continue(ch) {
                return false;
            }
        }
        true
    }

    if !xid_ok(validate) {
        panic!("{:?} is not a valid Term", string);
    }
}

impl fmt::Debug for Term {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.debug_tuple("Term").field(&self.as_str()).finish()
    }
}

struct Interner {
    string_to_index: HashMap<MyRc, usize>,
    index_to_string: Vec<Rc<String>>,
}

#[derive(Hash, Eq, PartialEq)]
struct MyRc(Rc<String>);

impl Borrow<str> for MyRc {
    fn borrow(&self) -> &str {
        &self.0
    }
}

impl Interner {
    fn new() -> Interner {
        Interner {
            string_to_index: HashMap::new(),
            index_to_string: Vec::new(),
        }
    }

    fn intern(&mut self, s: &str) -> usize {
        if let Some(&idx) = self.string_to_index.get(s) {
            return idx;
        }
        let s = Rc::new(s.to_string());
        self.index_to_string.push(s.clone());
        self.string_to_index
            .insert(MyRc(s), self.index_to_string.len() - 1);
        self.index_to_string.len() - 1
    }

    fn get(&self, idx: usize) -> &str {
        &self.index_to_string[idx]
    }
}

#[derive(Clone, Debug)]
pub struct Literal {
    text: String,
    span: Span,
}

macro_rules! suffixed_numbers {
    ($($name:ident => $kind:ident,)*) => ($(
        pub fn $name(n: $kind) -> Literal {
            Literal::_new(format!(concat!("{}", stringify!($kind)), n))
        }
    )*)
}

macro_rules! unsuffixed_numbers {
    ($($name:ident => $kind:ident,)*) => ($(
        pub fn $name(n: $kind) -> Literal {
            Literal::_new(n.to_string())
        }
    )*)
}

impl Literal {
    fn _new(text: String) -> Literal {
        Literal {
            text: text,
            span: Span::call_site(),
        }
    }

    suffixed_numbers! {
        u8_suffixed => u8,
        u16_suffixed => u16,
        u32_suffixed => u32,
        u64_suffixed => u64,
        usize_suffixed => usize,
        i8_suffixed => i8,
        i16_suffixed => i16,
        i32_suffixed => i32,
        i64_suffixed => i64,
        isize_suffixed => isize,

        f32_suffixed => f32,
        f64_suffixed => f64,
    }

    unsuffixed_numbers! {
        u8_unsuffixed => u8,
        u16_unsuffixed => u16,
        u32_unsuffixed => u32,
        u64_unsuffixed => u64,
        usize_unsuffixed => usize,
        i8_unsuffixed => i8,
        i16_unsuffixed => i16,
        i32_unsuffixed => i32,
        i64_unsuffixed => i64,
        isize_unsuffixed => isize,
    }

    pub fn f32_unsuffixed(f: f32) -> Literal {
        let mut s = f.to_string();
        if !s.contains(".") {
            s.push_str(".0");
        }
        Literal::_new(s)
    }

    pub fn f64_unsuffixed(f: f64) -> Literal {
        let mut s = f.to_string();
        if !s.contains(".") {
            s.push_str(".0");
        }
        Literal::_new(s)
    }

    pub fn string(t: &str) -> Literal {
        let mut s = t.chars()
            .flat_map(|c| c.escape_default())
            .collect::<String>();
        s.push('"');
        s.insert(0, '"');
        Literal::_new(s)
    }

    pub fn character(t: char) -> Literal {
        Literal::_new(format!("'{}'", t.escape_default().collect::<String>()))
    }

    pub fn byte_string(bytes: &[u8]) -> Literal {
        let mut escaped = "b\"".to_string();
        for b in bytes {
            match *b {
                b'\0' => escaped.push_str(r"\0"),
                b'\t' => escaped.push_str(r"\t"),
                b'\n' => escaped.push_str(r"\n"),
                b'\r' => escaped.push_str(r"\r"),
                b'"' => escaped.push_str("\\\""),
                b'\\' => escaped.push_str("\\\\"),
                b'\x20'...b'\x7E' => escaped.push(*b as char),
                _ => escaped.push_str(&format!("\\x{:02X}", b)),
            }
        }
        escaped.push('"');
        Literal::_new(escaped)
    }

    pub fn span(&self) -> Span {
        self.span
    }

    pub fn set_span(&mut self, span: Span) {
        self.span = span;
    }
}

impl fmt::Display for Literal {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.text.fmt(f)
    }
}

fn token_stream(mut input: Cursor) -> PResult<::TokenStream> {
    let mut trees = Vec::new();
    loop {
        let input_no_ws = skip_whitespace(input);
        if input_no_ws.rest.len() == 0 {
            break
        }
        if let Ok((a, tokens)) = doc_comment(input_no_ws) {
            input = a;
            trees.extend(tokens);
            continue
        }

        let (a, tt) = match token_tree(input_no_ws) {
            Ok(p) => p,
            Err(_) => break,
        };
        trees.push(tt);
        input = a;
    }
    Ok((input, ::TokenStream::_new(TokenStream { inner: trees })))
}

#[cfg(not(procmacro2_semver_exempt))]
fn spanned<'a, T>(
    input: Cursor<'a>,
    f: fn(Cursor<'a>) -> PResult<'a, T>,
) -> PResult<'a, (T, ::Span)> {
    let (a, b) = f(skip_whitespace(input))?;
    Ok((a, ((b, ::Span::_new(Span { })))))
}

#[cfg(procmacro2_semver_exempt)]
fn spanned<'a, T>(
    input: Cursor<'a>,
    f: fn(Cursor<'a>) -> PResult<'a, T>,
) -> PResult<'a, (T, ::Span)> {
    let input = skip_whitespace(input);
    let lo = input.off;
    let (a, b) = f(input)?;
    let hi = a.off;
    let span = ::Span::_new(Span { lo: lo, hi: hi });
    Ok((a, (b, span)))
}

fn token_tree(input: Cursor) -> PResult<TokenTree> {
    let (rest, (mut tt, span)) = spanned(input, token_kind)?;
    tt.set_span(span);
    Ok((rest, tt))
}

named!(token_kind -> TokenTree, alt!(
    map!(group, TokenTree::Group)
    |
    map!(literal, TokenTree::Literal) // must be before symbol
    |
    symbol
    |
    map!(op, TokenTree::Op)
));

named!(group -> Group, alt!(
    delimited!(
        punct!("("),
        token_stream,
        punct!(")")
    ) => { |ts| Group::new(Delimiter::Parenthesis, ts) }
    |
    delimited!(
        punct!("["),
        token_stream,
        punct!("]")
    ) => { |ts| Group::new(Delimiter::Bracket, ts) }
    |
    delimited!(
        punct!("{"),
        token_stream,
        punct!("}")
    ) => { |ts| Group::new(Delimiter::Brace, ts) }
));

fn symbol(mut input: Cursor) -> PResult<TokenTree> {
    input = skip_whitespace(input);

    let mut chars = input.char_indices();

    let lifetime = input.starts_with("'");
    if lifetime {
        chars.next();
    }

    let raw = !lifetime && input.starts_with("r#");
    if raw {
        chars.next();
        chars.next();
    }

    match chars.next() {
        Some((_, ch)) if UnicodeXID::is_xid_start(ch) || ch == '_' => {}
        _ => return Err(LexError),
    }

    let mut end = input.len();
    for (i, ch) in chars {
        if !UnicodeXID::is_xid_continue(ch) {
            end = i;
            break;
        }
    }

    let a = &input.rest[..end];
    if a == "r#_" || lifetime && a != "'static" && KEYWORDS.contains(&&a[1..]) {
        Err(LexError)
    } else if a == "_" {
        Ok((input.advance(end), Op::new('_', Spacing::Alone).into()))
    } else {
        Ok((
            input.advance(end),
            ::Term::new(a, ::Span::call_site()).into(),
        ))
    }
}

// From https://github.com/rust-lang/rust/blob/master/src/libsyntax_pos/symbol.rs
static KEYWORDS: &'static [&'static str] = &[
    "abstract", "alignof", "as", "become", "box", "break", "const", "continue", "crate", "do",
    "else", "enum", "extern", "false", "final", "fn", "for", "if", "impl", "in", "let", "loop",
    "macro", "match", "mod", "move", "mut", "offsetof", "override", "priv", "proc", "pub", "pure",
    "ref", "return", "self", "Self", "sizeof", "static", "struct", "super", "trait", "true",
    "type", "typeof", "unsafe", "unsized", "use", "virtual", "where", "while", "yield",
];

fn literal(input: Cursor) -> PResult<::Literal> {
    let input_no_ws = skip_whitespace(input);

    match literal_nocapture(input_no_ws) {
        Ok((a, ())) => {
            let start = input.len() - input_no_ws.len();
            let len = input_no_ws.len() - a.len();
            let end = start + len;
            Ok((
                a,
                ::Literal::_new(Literal::_new(input.rest[start..end].to_string())),
            ))
        }
        Err(LexError) => Err(LexError),
    }
}

named!(literal_nocapture -> (), alt!(
    string
    |
    byte_string
    |
    byte
    |
    character
    |
    float
    |
    int
));

named!(string -> (), alt!(
    quoted_string
    |
    preceded!(
        punct!("r"),
        raw_string
    ) => { |_| () }
));

named!(quoted_string -> (), delimited!(
    punct!("\""),
    cooked_string,
    tag!("\"")
));

fn cooked_string(input: Cursor) -> PResult<()> {
    let mut chars = input.char_indices().peekable();
    while let Some((byte_offset, ch)) = chars.next() {
        match ch {
            '"' => {
                return Ok((input.advance(byte_offset), ()));
            }
            '\r' => {
                if let Some((_, '\n')) = chars.next() {
                    // ...
                } else {
                    break;
                }
            }
            '\\' => match chars.next() {
                Some((_, 'x')) => {
                    if !backslash_x_char(&mut chars) {
                        break;
                    }
                }
                Some((_, 'n')) | Some((_, 'r')) | Some((_, 't')) | Some((_, '\\'))
                | Some((_, '\'')) | Some((_, '"')) | Some((_, '0')) => {}
                Some((_, 'u')) => {
                    if !backslash_u(&mut chars) {
                        break;
                    }
                }
                Some((_, '\n')) | Some((_, '\r')) => {
                    while let Some(&(_, ch)) = chars.peek() {
                        if ch.is_whitespace() {
                            chars.next();
                        } else {
                            break;
                        }
                    }
                }
                _ => break,
            },
            _ch => {}
        }
    }
    Err(LexError)
}

named!(byte_string -> (), alt!(
    delimited!(
        punct!("b\""),
        cooked_byte_string,
        tag!("\"")
    ) => { |_| () }
    |
    preceded!(
        punct!("br"),
        raw_string
    ) => { |_| () }
));

fn cooked_byte_string(mut input: Cursor) -> PResult<()> {
    let mut bytes = input.bytes().enumerate();
    'outer: while let Some((offset, b)) = bytes.next() {
        match b {
            b'"' => {
                return Ok((input.advance(offset), ()));
            }
            b'\r' => {
                if let Some((_, b'\n')) = bytes.next() {
                    // ...
                } else {
                    break;
                }
            }
            b'\\' => match bytes.next() {
                Some((_, b'x')) => {
                    if !backslash_x_byte(&mut bytes) {
                        break;
                    }
                }
                Some((_, b'n')) | Some((_, b'r')) | Some((_, b't')) | Some((_, b'\\'))
                | Some((_, b'0')) | Some((_, b'\'')) | Some((_, b'"')) => {}
                Some((newline, b'\n')) | Some((newline, b'\r')) => {
                    let rest = input.advance(newline + 1);
                    for (offset, ch) in rest.char_indices() {
                        if !ch.is_whitespace() {
                            input = rest.advance(offset);
                            bytes = input.bytes().enumerate();
                            continue 'outer;
                        }
                    }
                    break;
                }
                _ => break,
            },
            b if b < 0x80 => {}
            _ => break,
        }
    }
    Err(LexError)
}

fn raw_string(input: Cursor) -> PResult<()> {
    let mut chars = input.char_indices();
    let mut n = 0;
    while let Some((byte_offset, ch)) = chars.next() {
        match ch {
            '"' => {
                n = byte_offset;
                break;
            }
            '#' => {}
            _ => return Err(LexError),
        }
    }
    for (byte_offset, ch) in chars {
        match ch {
            '"' if input.advance(byte_offset + 1).starts_with(&input.rest[..n]) => {
                let rest = input.advance(byte_offset + 1 + n);
                return Ok((rest, ()));
            }
            '\r' => {}
            _ => {}
        }
    }
    Err(LexError)
}

named!(byte -> (), do_parse!(
    punct!("b") >>
    tag!("'") >>
    cooked_byte >>
    tag!("'") >>
    (())
));

fn cooked_byte(input: Cursor) -> PResult<()> {
    let mut bytes = input.bytes().enumerate();
    let ok = match bytes.next().map(|(_, b)| b) {
        Some(b'\\') => match bytes.next().map(|(_, b)| b) {
            Some(b'x') => backslash_x_byte(&mut bytes),
            Some(b'n') | Some(b'r') | Some(b't') | Some(b'\\') | Some(b'0') | Some(b'\'')
            | Some(b'"') => true,
            _ => false,
        },
        b => b.is_some(),
    };
    if ok {
        match bytes.next() {
            Some((offset, _)) => {
                if input.chars().as_str().is_char_boundary(offset) {
                    Ok((input.advance(offset), ()))
                } else {
                    Err(LexError)
                }
            }
            None => Ok((input.advance(input.len()), ())),
        }
    } else {
        Err(LexError)
    }
}

named!(character -> (), do_parse!(
    punct!("'") >>
    cooked_char >>
    tag!("'") >>
    (())
));

fn cooked_char(input: Cursor) -> PResult<()> {
    let mut chars = input.char_indices();
    let ok = match chars.next().map(|(_, ch)| ch) {
        Some('\\') => match chars.next().map(|(_, ch)| ch) {
            Some('x') => backslash_x_char(&mut chars),
            Some('u') => backslash_u(&mut chars),
            Some('n') | Some('r') | Some('t') | Some('\\') | Some('0') | Some('\'') | Some('"') => {
                true
            }
            _ => false,
        },
        ch => ch.is_some(),
    };
    if ok {
        match chars.next() {
            Some((idx, _)) => Ok((input.advance(idx), ())),
            None => Ok((input.advance(input.len()), ())),
        }
    } else {
        Err(LexError)
    }
}

macro_rules! next_ch {
    ($chars:ident @ $pat:pat $(| $rest:pat)*) => {
        match $chars.next() {
            Some((_, ch)) => match ch {
                $pat $(| $rest)*  => ch,
                _ => return false,
            },
            None => return false
        }
    };
}

fn backslash_x_char<I>(chars: &mut I) -> bool
where
    I: Iterator<Item = (usize, char)>,
{
    next_ch!(chars @ '0'...'7');
    next_ch!(chars @ '0'...'9' | 'a'...'f' | 'A'...'F');
    true
}

fn backslash_x_byte<I>(chars: &mut I) -> bool
where
    I: Iterator<Item = (usize, u8)>,
{
    next_ch!(chars @ b'0'...b'9' | b'a'...b'f' | b'A'...b'F');
    next_ch!(chars @ b'0'...b'9' | b'a'...b'f' | b'A'...b'F');
    true
}

fn backslash_u<I>(chars: &mut I) -> bool
where
    I: Iterator<Item = (usize, char)>,
{
    next_ch!(chars @ '{');
    next_ch!(chars @ '0'...'9' | 'a'...'f' | 'A'...'F');
    loop {
        let c = next_ch!(chars @ '0'...'9' | 'a'...'f' | 'A'...'F' | '_' | '}');
        if c == '}' {
            return true;
        }
    }
}

fn float(input: Cursor) -> PResult<()> {
    let (rest, ()) = float_digits(input)?;
    for suffix in &["f32", "f64"] {
        if rest.starts_with(suffix) {
            return word_break(rest.advance(suffix.len()));
        }
    }
    word_break(rest)
}

fn float_digits(input: Cursor) -> PResult<()> {
    let mut chars = input.chars().peekable();
    match chars.next() {
        Some(ch) if ch >= '0' && ch <= '9' => {}
        _ => return Err(LexError),
    }

    let mut len = 1;
    let mut has_dot = false;
    let mut has_exp = false;
    while let Some(&ch) = chars.peek() {
        match ch {
            '0'...'9' | '_' => {
                chars.next();
                len += 1;
            }
            '.' => {
                if has_dot {
                    break;
                }
                chars.next();
                if chars
                    .peek()
                    .map(|&ch| ch == '.' || UnicodeXID::is_xid_start(ch))
                    .unwrap_or(false)
                {
                    return Err(LexError);
                }
                len += 1;
                has_dot = true;
            }
            'e' | 'E' => {
                chars.next();
                len += 1;
                has_exp = true;
                break;
            }
            _ => break,
        }
    }

    let rest = input.advance(len);
    if !(has_dot || has_exp || rest.starts_with("f32") || rest.starts_with("f64")) {
        return Err(LexError);
    }

    if has_exp {
        let mut has_exp_value = false;
        while let Some(&ch) = chars.peek() {
            match ch {
                '+' | '-' => {
                    if has_exp_value {
                        break;
                    }
                    chars.next();
                    len += 1;
                }
                '0'...'9' => {
                    chars.next();
                    len += 1;
                    has_exp_value = true;
                }
                '_' => {
                    chars.next();
                    len += 1;
                }
                _ => break,
            }
        }
        if !has_exp_value {
            return Err(LexError);
        }
    }

    Ok((input.advance(len), ()))
}

fn int(input: Cursor) -> PResult<()> {
    let (rest, ()) = digits(input)?;
    for suffix in &[
        "isize", "i8", "i16", "i32", "i64", "i128", "usize", "u8", "u16", "u32", "u64", "u128"
    ] {
        if rest.starts_with(suffix) {
            return word_break(rest.advance(suffix.len()));
        }
    }
    word_break(rest)
}

fn digits(mut input: Cursor) -> PResult<()> {
    let base = if input.starts_with("0x") {
        input = input.advance(2);
        16
    } else if input.starts_with("0o") {
        input = input.advance(2);
        8
    } else if input.starts_with("0b") {
        input = input.advance(2);
        2
    } else {
        10
    };

    let mut len = 0;
    let mut empty = true;
    for b in input.bytes() {
        let digit = match b {
            b'0'...b'9' => (b - b'0') as u64,
            b'a'...b'f' => 10 + (b - b'a') as u64,
            b'A'...b'F' => 10 + (b - b'A') as u64,
            b'_' => {
                if empty && base == 10 {
                    return Err(LexError);
                }
                len += 1;
                continue;
            }
            _ => break,
        };
        if digit >= base {
            return Err(LexError);
        }
        len += 1;
        empty = false;
    }
    if empty {
        Err(LexError)
    } else {
        Ok((input.advance(len), ()))
    }
}

fn op(input: Cursor) -> PResult<Op> {
    let input = skip_whitespace(input);
    match op_char(input) {
        Ok((rest, ch)) => {
            let kind = match op_char(rest) {
                Ok(_) => Spacing::Joint,
                Err(LexError) => Spacing::Alone,
            };
            Ok((rest, Op::new(ch, kind)))
        }
        Err(LexError) => Err(LexError),
    }
}

fn op_char(input: Cursor) -> PResult<char> {
    let mut chars = input.chars();
    let first = match chars.next() {
        Some(ch) => ch,
        None => {
            return Err(LexError);
        }
    };
    let recognized = "~!@#$%^&*-=+|;:,<.>/?";
    if recognized.contains(first) {
        Ok((input.advance(first.len_utf8()), first))
    } else {
        Err(LexError)
    }
}

fn doc_comment(input: Cursor) -> PResult<Vec<TokenTree>> {
    let mut trees = Vec::new();
    let (rest, ((comment, inner), span)) = spanned(input, doc_comment_contents)?;
    trees.push(TokenTree::Op(Op::new('#', Spacing::Alone)));
    if inner {
        trees.push(Op::new('!', Spacing::Alone).into());
    }
    let mut stream = vec![
        TokenTree::Term(::Term::new("doc", span)),
        TokenTree::Op(Op::new('=', Spacing::Alone)),
        TokenTree::Literal(::Literal::string(comment)),
    ];
    for tt in stream.iter_mut() {
        tt.set_span(span);
    }
    trees.push(Group::new(Delimiter::Bracket, stream.into_iter().collect()).into());
    for tt in trees.iter_mut() {
        tt.set_span(span);
    }
    Ok((rest, trees))
}

named!(doc_comment_contents -> (&str, bool), alt!(
    do_parse!(
        punct!("//!") >>
        s: take_until_newline_or_eof!() >>
        ((s, true))
    )
    |
    do_parse!(
        option!(whitespace) >>
        peek!(tag!("/*!")) >>
        s: block_comment >>
        ((s, true))
    )
    |
    do_parse!(
        punct!("///") >>
        not!(tag!("/")) >>
        s: take_until_newline_or_eof!() >>
        ((s, false))
    )
    |
    do_parse!(
        option!(whitespace) >>
        peek!(tuple!(tag!("/**"), not!(tag!("*")))) >>
        s: block_comment >>
        ((s, false))
    )
));
