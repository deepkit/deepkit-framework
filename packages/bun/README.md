# Deepkit Bun Plugin

## Install

```sh
bun init
```

`bunfig.toml`:

```toml
preload = ["@deepkit/bun"]

[install]
peer = true
```

```sh
bun install @deepkit/type @deepkit/type-compiler @deepkit/core @deepkit/bun typescript
```

`tsconfig.json`:

```json
{
  "reflection": true
}
```
