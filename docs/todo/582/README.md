# Issue #582: Replace faker with @faker-js/faker

## Summary

Replace the deprecated `faker` package with the maintained `@faker-js/faker` package.

## GitHub Link

https://github.com/deepkit/deepkit-framework/issues/582

## Context

- **Package**: @deepkit/framework, @deepkit/orm-browser-api
- **Severity**: Medium
- **Type**: Enhancement (dependency upgrade)

## Current Behavior

Using deprecated `faker` package v5.4.0 which is no longer maintained.

## Expected Behavior

Use `@faker-js/faker` v8.x which is actively maintained and has built-in TypeScript types.

## Affected Files

- `packages/framework/package.json` - Dependencies
- `packages/orm-browser-api/src/faker.ts` - Faker function list and helpers
- `packages/framework/src/orm-browser/controller.ts` - Faker require statement

## Key API Changes (v5 to v8)

### Namespace Renames
- `faker.address.*` → `faker.location.*`
- `faker.name.*` → `faker.person.*`
- `faker.commerce.color` → `faker.color.human`

### Method Renames
- `random.number` → `number.int`
- `random.float` → `number.float`
- `random.uuid` → `string.uuid`
- `random.boolean` → `datatype.boolean`
- `phone.phoneNumber` → `phone.number`
- `name.findName` → `person.fullName`
- `name.gender` → `person.sex`
- `image.imageUrl` → `image.url`
- `company.companyName` → `company.name`

### Removed Methods
- `date.between` → `date.between({ from, to })`
- Many image.* methods removed (lorempixel service dead)

## Tasks

- [x] Create issue folder
- [ ] Update dependencies in package.json
- [ ] Update fakerFunctions list with new API names
- [ ] Update findFaker() return values
- [ ] Update require statement to import correctly
- [ ] Run tests
- [ ] Commit

## Testing

```bash
npm run test packages/framework/
npm run test packages/orm-browser-api/
```

## References

- Migration guide: https://v8.fakerjs.dev/guide/upgrading.html

## Progress Log

| Date | Action |
|------|--------|
| 2026-01-19 | Started work |
