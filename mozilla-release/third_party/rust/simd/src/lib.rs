//! `simd` offers a basic interface to the SIMD functionality of CPUs.
#![no_std]

#![feature(cfg_target_feature, repr_simd, platform_intrinsics, const_fn)]
#![allow(non_camel_case_types)]

#[cfg(feature = "with-serde")]
extern crate serde;
#[cfg(feature = "with-serde")]
#[macro_use]
extern crate serde_derive;

use core::mem;

/// Boolean type for 8-bit integers.
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct bool8i(i8);
/// Boolean type for 16-bit integers.
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct bool16i(i16);
/// Boolean type for 32-bit integers.
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct bool32i(i32);
/// Boolean type for 32-bit floats.
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct bool32f(i32);

macro_rules! bool {
    ($($name: ident, $inner: ty;)*) => {
        $(
            impl From<bool> for $name {
                #[inline]
                fn from(b: bool) -> $name {
                    $name(-(b as $inner))
                }
            }
            impl From<$name> for bool {
                #[inline]
                fn from(b: $name) -> bool {
                    b.0 != 0
                }
            }
            )*
    }
}
bool! {
    bool8i, i8;
    bool16i, i16;
    bool32i, i32;
    bool32f, i32;
}

/// Types that are SIMD vectors.
pub unsafe trait Simd {
    /// The corresponding boolean vector type.
    type Bool: Simd;
    /// The element that this vector stores.
    type Elem;
}

/// A SIMD vector of 4 `u32`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct u32x4(u32, u32, u32, u32);
/// A SIMD vector of 4 `i32`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct i32x4(i32, i32, i32, i32);
/// A SIMD vector of 4 `f32`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct f32x4(f32, f32, f32, f32);
/// A SIMD boolean vector for length-4 vectors of 32-bit integers.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct bool32ix4(i32, i32, i32, i32);
/// A SIMD boolean vector for length-4 vectors of 32-bit floats.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct bool32fx4(i32, i32, i32, i32);

#[allow(dead_code)]
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
struct u32x2(u32, u32);
#[allow(dead_code)]
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
struct i32x2(i32, i32);
#[allow(dead_code)]
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
struct f32x2(f32, f32);
#[allow(dead_code)]
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
struct bool32ix2(i32, i32);
#[allow(dead_code)]
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
struct bool32fx2(i32, i32);

/// A SIMD vector of 8 `u16`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct u16x8(u16, u16, u16, u16,
                 u16, u16, u16, u16);
/// A SIMD vector of 8 `i16`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct i16x8(i16, i16, i16, i16,
                 i16, i16, i16, i16);
/// A SIMD boolean vector for length-8 vectors of 16-bit integers.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct bool16ix8(i16, i16, i16, i16,
                     i16, i16, i16, i16);

/// A SIMD vector of 16 `u8`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct u8x16(u8, u8, u8, u8, u8, u8, u8, u8,
                 u8, u8, u8, u8, u8, u8, u8, u8);
/// A SIMD vector of 16 `i8`s.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct i8x16(i8, i8, i8, i8, i8, i8, i8, i8,
                 i8, i8, i8, i8, i8, i8, i8, i8);
/// A SIMD boolean vector for length-16 vectors of 8-bit integers.
#[repr(simd)]
#[cfg_attr(feature = "with-serde", derive(Serialize, Deserialize))]
#[derive(Debug, Copy)]
pub struct bool8ix16(i8, i8, i8, i8, i8, i8, i8, i8,
                     i8, i8, i8, i8, i8, i8, i8, i8);


macro_rules! simd {
    ($($bool: ty: $($ty: ty = $elem: ty),*;)*) => {
        $($(unsafe impl Simd for $ty {
            type Bool = $bool;
            type Elem = $elem;
        }
            impl Clone for $ty { #[inline] fn clone(&self) -> Self { *self } }
            )*)*}
}
simd! {
    bool8ix16: i8x16 = i8, u8x16 = u8, bool8ix16 = bool8i;
    bool16ix8: i16x8 = i16, u16x8 = u16, bool16ix8 = bool16i;
    bool32ix4: i32x4 = i32, u32x4 = u32, bool32ix4 = bool32i;
    bool32fx4: f32x4 = f32, bool32fx4 = bool32f;

    bool32ix2: i32x2 = i32, u32x2 = u32, bool32ix2 = bool32i;
    bool32fx2: f32x2 = f32, bool32fx2 = bool32f;
}

#[allow(dead_code)]
#[inline]
fn bitcast<T: Simd, U: Simd>(x: T) -> U {
    assert_eq!(mem::size_of::<T>(),
               mem::size_of::<U>());
    unsafe {mem::transmute_copy(&x)}
}

#[allow(dead_code)]
extern "platform-intrinsic" {
    fn simd_eq<T: Simd<Bool = U>, U>(x: T, y: T) -> U;
    fn simd_ne<T: Simd<Bool = U>, U>(x: T, y: T) -> U;
    fn simd_lt<T: Simd<Bool = U>, U>(x: T, y: T) -> U;
    fn simd_le<T: Simd<Bool = U>, U>(x: T, y: T) -> U;
    fn simd_gt<T: Simd<Bool = U>, U>(x: T, y: T) -> U;
    fn simd_ge<T: Simd<Bool = U>, U>(x: T, y: T) -> U;

    fn simd_shuffle2<T: Simd, U: Simd<Elem = T::Elem>>(x: T, y: T, idx: [u32; 2]) -> U;
    fn simd_shuffle4<T: Simd, U: Simd<Elem = T::Elem>>(x: T, y: T, idx: [u32; 4]) -> U;
    fn simd_shuffle8<T: Simd, U: Simd<Elem = T::Elem>>(x: T, y: T, idx: [u32; 8]) -> U;
    fn simd_shuffle16<T: Simd, U: Simd<Elem = T::Elem>>(x: T, y: T, idx: [u32; 16]) -> U;

    fn simd_insert<T: Simd<Elem = U>, U>(x: T, idx: u32, val: U) -> T;
    fn simd_extract<T: Simd<Elem = U>, U>(x: T, idx: u32) -> U;

    fn simd_cast<T: Simd, U: Simd>(x: T) -> U;

    fn simd_add<T: Simd>(x: T, y: T) -> T;
    fn simd_sub<T: Simd>(x: T, y: T) -> T;
    fn simd_mul<T: Simd>(x: T, y: T) -> T;
    fn simd_div<T: Simd>(x: T, y: T) -> T;
    fn simd_shl<T: Simd>(x: T, y: T) -> T;
    fn simd_shr<T: Simd>(x: T, y: T) -> T;
    fn simd_and<T: Simd>(x: T, y: T) -> T;
    fn simd_or<T: Simd>(x: T, y: T) -> T;
    fn simd_xor<T: Simd>(x: T, y: T) -> T;
}
#[repr(packed)]
#[derive(Copy)]
struct Unalign<T>(T);

impl<T: Clone> Clone for Unalign<T> {
    fn clone(&self) -> Unalign<T> {
        Unalign(unsafe { self.0.clone() })
    }
}

#[macro_use]
mod common;
mod sixty_four;
mod v256;

#[cfg(any(feature = "doc",
          target_arch = "x86",
          target_arch = "x86_64"))]
pub mod x86;
#[cfg(any(feature = "doc", target_arch = "arm"))]
pub mod arm;
#[cfg(any(feature = "doc", target_arch = "aarch64"))]
pub mod aarch64;

#[cfg(test)]
mod tests {

    use super::u8x16;
    use super::u16x8;
    use super::u32x4;
    use super::f32x4;

    #[test]
    fn test_u8x16_none_not_any() {
        let x1 = u8x16::splat(1);
        let x2 = u8x16::splat(2);
        assert!(!(x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_none_not_all() {
        let x1 = u8x16::splat(1);
        let x2 = u8x16::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_all_any() {
        let x1 = u8x16::splat(1);
        let x2 = u8x16::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_all_all() {
        let x1 = u8x16::splat(1);
        let x2 = u8x16::splat(1);
        assert!((x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_except_last_any() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u8x16::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_except_last_not_all() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u8x16::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_except_first_any() {
        let x1 = u8x16::new(1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_except_first_not_all() {
        let x1 = u8x16::new(1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_only_last_any() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u8x16::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_only_last_not_all() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u8x16::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_only_first_any() {
        let x1 = u8x16::new(1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_only_first_not_all() {
        let x1 = u8x16::new(1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_except_thirteenth_any() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2);
        let x2 = u8x16::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_except_thirteenth_not_all() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2);
        let x2 = u8x16::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_except_fifth_any() {
        let x1 = u8x16::new(2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_except_fifth_not_all() {
        let x1 = u8x16::new(2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_only_thirteenth_any() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2);
        let x2 = u8x16::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_only_thirteenth_not_all() {
        let x1 = u8x16::new(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2);
        let x2 = u8x16::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u8x16_only_fifth_any() {
        let x1 = u8x16::new(2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u8x16_only_fifth_not_all() {
        let x1 = u8x16::new(2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u8x16::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_none_not_any() {
        let x1 = u16x8::splat(1);
        let x2 = u16x8::splat(2);
        assert!(!(x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_none_not_all() {
        let x1 = u16x8::splat(1);
        let x2 = u16x8::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_all_any() {
        let x1 = u16x8::splat(1);
        let x2 = u16x8::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_all_all() {
        let x1 = u16x8::splat(1);
        let x2 = u16x8::splat(1);
        assert!((x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_except_last_any() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u16x8::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_except_last_not_all() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u16x8::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_except_first_any() {
        let x1 = u16x8::new(1, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_except_first_not_all() {
        let x1 = u16x8::new(1, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_only_last_any() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u16x8::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_only_last_not_all() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 2, 2, 1);
        let x2 = u16x8::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_only_first_any() {
        let x1 = u16x8::new(1, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_only_first_not_all() {
        let x1 = u16x8::new(1, 2, 2, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_except_sixth_any() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 1, 2, 2);
        let x2 = u16x8::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_except_sixth_not_all() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 1, 2, 2);
        let x2 = u16x8::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_except_third_any() {
        let x1 = u16x8::new(2, 2, 1, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_except_third_not_all() {
        let x1 = u16x8::new(2, 2, 1, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_only_sixth_any() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 1, 2, 2);
        let x2 = u16x8::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_only_sixth_not_all() {
        let x1 = u16x8::new(2, 2, 2, 2, 2, 1, 2, 2);
        let x2 = u16x8::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u16x8_only_third_any() {
        let x1 = u16x8::new(2, 2, 1, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u16x8_only_third_not_all() {
        let x1 = u16x8::new(2, 2, 1, 2, 2, 2, 2, 2);
        let x2 = u16x8::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_none_not_any() {
        let x1 = u32x4::splat(1);
        let x2 = u32x4::splat(2);
        assert!(!(x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_none_not_all() {
        let x1 = u32x4::splat(1);
        let x2 = u32x4::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_all_any() {
        let x1 = u32x4::splat(1);
        let x2 = u32x4::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_all_all() {
        let x1 = u32x4::splat(1);
        let x2 = u32x4::splat(1);
        assert!((x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_except_last_any() {
        let x1 = u32x4::new(2, 2, 2, 1);
        let x2 = u32x4::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_except_last_not_all() {
        let x1 = u32x4::new(2, 2, 2, 1);
        let x2 = u32x4::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_except_first_any() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_except_first_not_all() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_only_last_any() {
        let x1 = u32x4::new(2, 2, 2, 1);
        let x2 = u32x4::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_only_last_not_all() {
        let x1 = u32x4::new(2, 2, 2, 1);
        let x2 = u32x4::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_only_first_any() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_only_first_not_all() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_except_second_any() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_except_second_not_all() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_except_third_any() {
        let x1 = u32x4::new(2, 2, 1, 2);
        let x2 = u32x4::splat(2);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_except_third_not_all() {
        let x1 = u32x4::new(2, 2, 1, 2);
        let x2 = u32x4::splat(2);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_only_second_any() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_only_second_not_all() {
        let x1 = u32x4::new(1, 2, 2, 2);
        let x2 = u32x4::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_u32x4_only_third_any() {
        let x1 = u32x4::new(2, 2, 1, 2);
        let x2 = u32x4::splat(1);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_u32x4_only_third_not_all() {
        let x1 = u32x4::new(2, 2, 1, 2);
        let x2 = u32x4::splat(1);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_none_not_any() {
        let x1 = f32x4::splat(1.0);
        let x2 = f32x4::splat(2.0);
        assert!(!(x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_none_not_all() {
        let x1 = f32x4::splat(1.0);
        let x2 = f32x4::splat(2.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_all_any() {
        let x1 = f32x4::splat(1.0);
        let x2 = f32x4::splat(1.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_all_all() {
        let x1 = f32x4::splat(1.0);
        let x2 = f32x4::splat(1.0);
        assert!((x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_except_last_any() {
        let x1 = f32x4::new(2.0, 2.0, 2.0, 1.0);
        let x2 = f32x4::splat(2.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_except_last_not_all() {
        let x1 = f32x4::new(2.0, 2.0, 2.0, 1.0);
        let x2 = f32x4::splat(2.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_except_first_any() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(2.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_except_first_not_all() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(2.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_only_last_any() {
        let x1 = f32x4::new(2.0, 2.0, 2.0, 1.0);
        let x2 = f32x4::splat(1.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_only_last_not_all() {
        let x1 = f32x4::new(2.0, 2.0, 2.0, 1.0);
        let x2 = f32x4::splat(1.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_only_first_any() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(1.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_only_first_not_all() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(1.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_except_second_any() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(2.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_except_second_not_all() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(2.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_except_third_any() {
        let x1 = f32x4::new(2.0, 2.0, 1.0, 2.0);
        let x2 = f32x4::splat(2.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_except_third_not_all() {
        let x1 = f32x4::new(2.0, 2.0, 1.0, 2.0);
        let x2 = f32x4::splat(2.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_only_second_any() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(1.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_only_second_not_all() {
        let x1 = f32x4::new(1.0, 2.0, 2.0, 2.0);
        let x2 = f32x4::splat(1.0);
        assert!(!(x1.eq(x2)).all());
    }

    #[test]
    fn test_f32x4_only_third_any() {
        let x1 = f32x4::new(2.0, 2.0, 1.0, 2.0);
        let x2 = f32x4::splat(1.0);
        assert!((x1.eq(x2)).any());
    }

    #[test]
    fn test_f32x4_only_third_not_all() {
        let x1 = f32x4::new(2.0, 2.0, 1.0, 2.0);
        let x2 = f32x4::splat(1.0);
        assert!(!(x1.eq(x2)).all());
    }

}
