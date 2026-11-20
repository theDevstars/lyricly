//! Player sources. Cider is a first-class source; SMTC stays the fallback and
//! is still read through `media`.

pub mod cider;

pub use cider::CiderConfig;
