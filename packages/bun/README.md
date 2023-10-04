# Deepkit Bun Plugin

## Install

```sh
bun install @deepkit/type @deepkit/type-compiler @deepkit/core @deepkit/bun typescript
```

`bunfig.toml`:
```toml
preload = ["@deepkit/bun"]

[install]
peer = true
```

`tsconfig.json`:
```json
{
    "reflection": true
}
```
