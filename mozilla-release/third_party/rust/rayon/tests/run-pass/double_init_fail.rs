extern crate rayon;

use rayon::*;
use std::error::Error;

fn main() {
    let result1 = ThreadPoolBuilder::new().build_global();
    assert_eq!(result1.unwrap(), ());
    let err = ThreadPoolBuilder::new().build_global().unwrap_err();
    assert!(err.description() == "The global thread pool has already been initialized.");
}
