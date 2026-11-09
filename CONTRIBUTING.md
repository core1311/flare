# Contributing to Flare

Thanks for your interest in contributing!

## Get started

Install the stable Rust toolchain, then run the test suite from the repository
root:

```sh
cargo test --workspace
```

To try the web demo, install `wasm-pack` and run:

```sh
wasm-pack build demo --target web --out-name flare
python3 -m http.server 8081 --directory demo
```

Open `http://localhost:8081` in your browser.

## Propose a change

- For bugs or ideas, open a GitHub issue with enough detail to reproduce the
  problem or explain the proposal.
- For code changes, open a pull request describing what changed and how you
  tested it.
- Keep changes focused, and add or update tests when behavior changes.

## License

By submitting a contribution, you agree that it may be distributed under the
project's MIT and Apache-2.0 licenses.
