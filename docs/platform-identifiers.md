# Platform identifiers and integration

The canonical reverse-DNS identifier for Flare is:

```text
io.github.core1311.flare
```

It is based on the GitHub organization because the project does not use a
project-owned internet domain. Keep it lowercase and use it where a platform
requires an application or namespace identifier:

| Platform | Identifier use |
|---|---|
| Android | `namespace` for a Flare Android library; an app consuming it chooses its own `applicationId` |
| iOS | `CFBundleIdentifier` for a Flare app; frameworks and Swift modules have their own module names |
| Flatpak | Application ID if a desktop app is packaged in the future |

This identifier is separate from language package names. The Rust package is
`flare-core`; any future npm package, Maven coordinate, or Swift package should
follow that ecosystem's naming rules.

## Mobile architecture

`flare-core` contains the platform-neutral semantic tree and depends on no
browser APIs. It is the Rust code intended for reuse by native integrations.
`flare-chart` currently uses browser canvas APIs and is not the native mobile
renderer.

Android and iOS support will need explicit language bindings (for example,
Kotlin and Swift bindings generated from a stable Rust API) and platform
adapters that turn semantic nodes into native accessibility elements. The
shared crate alone does not provide those bindings or native UI behavior yet.
