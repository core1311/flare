# flare-core

`flare-core` provides platform-neutral semantic types for describing
canvas-rendered interfaces. It has no browser or operating-system dependency
and can be used as the shared Rust model for web and future native adapters.

```rust
use flare_core::{Role, SemNode};

let node = SemNode::new(Role::Button, "January")
    .with_value("1,234")
    .with_focusable(true);
```

The crate does not currently provide Android/Kotlin or iOS/Swift bindings.
Those integrations can be added separately around this stable, pure-Rust API.

Project repository: <https://github.com/core1311/flare>
