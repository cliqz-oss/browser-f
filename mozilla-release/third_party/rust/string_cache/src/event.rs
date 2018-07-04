// Copyright 2014 The Servo Project Developers. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use std::sync::Mutex;

#[derive(PartialEq, Eq, PartialOrd, Ord, Hash, Clone, Debug)]
pub enum Event {
    Intern(u64),
    Insert(u64, String),
    Remove(u64),
}

lazy_static! {
    pub static ref LOG: Mutex<Vec<Event>>
        = Mutex::new(Vec::with_capacity(50_000));
}

pub fn log(e: Event) {
    LOG.lock().unwrap().push(e);
}

macro_rules! log (($e:expr) => (::event::log($e)));
