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

## Bun test runner

To use the [bun test runner](https://bun.sh/docs/cli/test) instead of Jest add the following to file `bunfig.toml`:

```toml
[test]
preload = ["@deepkit/bun"]
```
