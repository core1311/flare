# Flare

Flare is an accessible canvas-rendering project. Its Rust semantic model is
platform-neutral; the current chart renderer and DOM mirror are for the web.

## Project structure

- [`flare-core`](./crates/flare-core/) - platform-neutral semantic nodes and
  descriptions, with no browser or operating-system dependencies.
- [`flare-chart`](./chart/) - chart rendering for WebAssembly using
  `wasm-bindgen` and `web-sys`.
- [`mirror-dom`](./mirror-dom/) - JavaScript helpers that project semantic
  nodes into accessible DOM elements.
- [`demo`](./demo/) - browser demo showing the canvas and DOM projections.

`flare-core` is the part intended to be shared with future Android and iOS
integrations. It is not yet a Kotlin or Swift binding. When those bindings are
added, they can expose this crate's platform-neutral API without bringing the
web renderer into native apps.

## Identifiers

Use `io.github.core1311.flare` as the project's reverse-DNS identifier where
an application or platform package identifier is needed:

- Android library `namespace`: `io.github.core1311.flare`
- iOS app `CFBundleIdentifier`: `io.github.core1311.flare`
- Optional Flatpak application ID: `io.github.core1311.flare`

An Android app that consumes the library should choose its own `applicationId`.
The identifier above does not replace the Rust crate name (`flare-core`) or
future platform-specific package names.

## Use the Rust core

Before a crates.io release, add the workspace crate directly from Git:

```toml
[dependencies]
flare-core = { git = "https://github.com/core1311/flare", package = "flare-core" }
```

After it is published, use `flare-core = "0.1"` instead. Its basic types are
`SemNode`, `Role`, `Geometry`, and the `Describable` trait.

See [platform identifiers and integration](./docs/platform-identifiers.md) for
the intended mobile identifiers and the boundary between the shared crate and
native bindings.

## Release `flare-core`

The `Publish flare-core` workflow publishes only the core crate when a
`flare-core-v*` tag is pushed. Before the first release, add a crates.io API
token with publish permission as the GitHub Actions repository secret
`CRATES_IO_TOKEN`.

To release a version, update `version` in
[`crates/flare-core/Cargo.toml`](./crates/flare-core/Cargo.toml), commit the
change, then create and push a matching tag (for example, `flare-core-v0.1.0`).
The workflow tests the workspace, checks that the tag matches the crate
version, dry-runs packaging, and then publishes to crates.io.

## Build and test

```sh
cargo test --workspace
```

To build the browser demo, install `wasm-pack` and run:

```sh
wasm-pack build demo --target web --out-name flare
python3 -m http.server 8081 --directory demo
```

Then open `http://localhost:8081`.

## License

Licensed under either of
[MIT](./LICENSE-MIT) or [Apache-2.0](./LICENSE-APACHE), at your option.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to build, test, and contribute.
