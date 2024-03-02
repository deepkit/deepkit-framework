# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1-alpha.140](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.139...v1.0.1-alpha.140) (2024-03-02)

### Features

- **sql:** support per-field name remapping ([63b8aaf](https://github.com/deepkit/deepkit-framework/commit/63b8aaface420a98f14511b22efaffc9628be41d))

## [1.0.1-alpha.139](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.138...v1.0.1-alpha.139) (2024-02-29)

### Bug Fixes

- **type:** better error message when fast path type resolution fails due to undefined symbols ([0ef082d](https://github.com/deepkit/deepkit-framework/commit/0ef082d4b474b7d36d7668cf21ad8a9922469189))

## [1.0.1-alpha.138](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.137...v1.0.1-alpha.138) (2024-02-27)

### Bug Fixes

- **type:** make sure methods are not part of deserialization/type guard union resolver ([eb08a73](https://github.com/deepkit/deepkit-framework/commit/eb08a73db15c4d66f69646fe9f34b3c884e602a6))

## [1.0.1-alpha.137](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.136...v1.0.1-alpha.137) (2024-02-26)

### Bug Fixes

- **type:** correctly type guard `null` in optional properties ([c0adcb0](https://github.com/deepkit/deepkit-framework/commit/c0adcb00ce100b4c01bc6a1d793396b806464f3c))

## [1.0.1-alpha.132](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.131...v1.0.1-alpha.132) (2024-02-10)

### Bug Fixes

- **type:** intersection of two different primitive types always return never ([#549](https://github.com/deepkit/deepkit-framework/issues/549)) ([20d3dc8](https://github.com/deepkit/deepkit-framework/commit/20d3dc83a00431db99f6feb0f41da890fa422f48))

## [1.0.1-alpha.131](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.130...v1.0.1-alpha.131) (2024-02-09)

### Bug Fixes

- **type:** make sure cast<string> throws when null/undefined is passed ([1bb3641](https://github.com/deepkit/deepkit-framework/commit/1bb3641f3db8196c9bcab64ef17004dc5e1f9f4c))

## [1.0.1-alpha.124](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.123...v1.0.1-alpha.124) (2024-02-04)

### Bug Fixes

- **type:** handle more circular types ([5f6bd12](https://github.com/deepkit/deepkit-framework/commit/5f6bd124aaf9c546014b81dbded8110312f4e819)), closes [#477](https://github.com/deepkit/deepkit-framework/issues/477)

## [1.0.1-alpha.123](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.122...v1.0.1-alpha.123) (2024-02-02)

**Note:** Version bump only for package @deepkit/type

## [1.0.1-alpha.121](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.120...v1.0.1-alpha.121) (2024-01-31)

**Note:** Version bump only for package @deepkit/type

## [1.0.1-alpha.120](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.119...v1.0.1-alpha.120) (2024-01-29)

### Features

- **type:** preserve modifiers in homomorphic mapped types ([f2091d0](https://github.com/deepkit/deepkit-framework/commit/f2091d0beeb7360d0bdcc7475d0c88e53dee5de2)), closes [#515](https://github.com/deepkit/deepkit-framework/issues/515) [#514](https://github.com/deepkit/deepkit-framework/issues/514)

## [1.0.1-alpha.119](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.118...v1.0.1-alpha.119) (2024-01-28)

### Features

- **type:** provide parent types in serializer template state ([d65dfc0](https://github.com/deepkit/deepkit-framework/commit/d65dfc0f80ee429e1f74af05e3a3fda385855ce5))

## [1.0.1-alpha.117](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.116...v1.0.1-alpha.117) (2024-01-26)

### Bug Fixes

- **type:** correct type guard ([272cff9](https://github.com/deepkit/deepkit-framework/commit/272cff92292043c4b76bd61bc4abe3c9a63509c9))

### Features

- **type-compiler:** support local export syntax + improve logging ([993cffa](https://github.com/deepkit/deepkit-framework/commit/993cffaa822a76963ed5185d8b1d0a7c1de28069))

## [1.0.1-alpha.116](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.115...v1.0.1-alpha.116) (2024-01-22)

### Features

- **type:** refactor typeName embedding ([48a2994](https://github.com/deepkit/deepkit-framework/commit/48a29944064d03d108988949a1ff5b6e42395b57))

## [1.0.1-alpha.114](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.113...v1.0.1-alpha.114) (2024-01-21)

**Note:** Version bump only for package @deepkit/type

## [1.0.1-alpha.113](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.112...v1.0.1-alpha.113) (2024-01-17)

**Note:** Version bump only for package @deepkit/type

## [1.0.1-alpha.112](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.111...v1.0.1-alpha.112) (2024-01-16)

### Features

- **app:** improve CLI outputs/parsing by removing [@oclif](https://github.com/oclif) ([e38bbd1](https://github.com/deepkit/deepkit-framework/commit/e38bbd143daa2c856c57eca07a4fd29e884fe97e))

## [1.0.1-alpha.111](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.110...v1.0.1-alpha.111) (2024-01-15)

### Features

- **type:** add new fast path to resolveReceiveType and made it 5x faster on average use case. ([45d656c](https://github.com/deepkit/deepkit-framework/commit/45d656ccc0e4ba36fe362784e60ca58c6b2da31d))

## [1.0.1-alpha.110](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.109...v1.0.1-alpha.110) (2024-01-11)

**Note:** Version bump only for package @deepkit/type

## [1.0.1-alpha.109](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.108...v1.0.1-alpha.109) (2024-01-10)

### Bug Fixes

- **http:** use default values of route parameters if no http value was provided. ([fa74d16](https://github.com/deepkit/deepkit-framework/commit/fa74d166d5421f8459f64c9b2339b9cf272a1b18)), closes [#529](https://github.com/deepkit/deepkit-framework/issues/529)
- **orm:** snapshot type `any` correctly ([4898e9b](https://github.com/deepkit/deepkit-framework/commit/4898e9bc067b655284b08aa7e9a75b0bffedcbf6))
- **type-compiler:** arrow function receive type ([#521](https://github.com/deepkit/deepkit-framework/issues/521)) ([6bfb246](https://github.com/deepkit/deepkit-framework/commit/6bfb2466753bb99020d8f429097ad1cb3520e500))
- **type:** make serializer API consistent ([5870005](https://github.com/deepkit/deepkit-framework/commit/587000526c1ca59e28eea3b107b882151aedb08b))

## [1.0.1-alpha.108](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.107...v1.0.1-alpha.108) (2023-11-21)

### Bug Fixes

- **injector:** make sure type cache is used when finding matching provider. ([8c79e4b](https://github.com/deepkit/deepkit-framework/commit/8c79e4b1d370c21f12c203a786608b6d39dc5c56))
- **type:** correctly check `X extends Date` and print validation errors with caused value. ([fde795e](https://github.com/deepkit/deepkit-framework/commit/fde795ee6998606b0791f936a25ee85921c6586a))
- **type:** correctly materialize Promise in runtime checks. ([aa66460](https://github.com/deepkit/deepkit-framework/commit/aa66460f9b125a7070645f64f34a5574cd9eb549)), closes [#495](https://github.com/deepkit/deepkit-framework/issues/495)
- **type:** make sure `typeof x` expression doesn't return the original type ([7206e7e](https://github.com/deepkit/deepkit-framework/commit/7206e7ef9c3728e2b60d9a6cd7ecdb167fca78d0))
- **type:** make sure inline returns a ref to the correct type program ([dc5d6dd](https://github.com/deepkit/deepkit-framework/commit/dc5d6ddf36cc8835d7b11684a004f247900ec65f))

### Features

- **type-compiler:** emit typeName for type only imports ([#501](https://github.com/deepkit/deepkit-framework/issues/501)) ([318d091](https://github.com/deepkit/deepkit-framework/commit/318d091b9418df0a77f85de18d37541c3f9e3428))

## [1.0.1-alpha.105](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.103...v1.0.1-alpha.105) (2023-10-23)

### Bug Fixes

- **type:** do not interfere with type checking when intersecting multiple type annotations. ([af85f1f](https://github.com/deepkit/deepkit-framework/commit/af85f1ff48c4be9fbd9a2ecd46e7f97b0bbb28c7))
- **type:** test ([c335466](https://github.com/deepkit/deepkit-framework/commit/c3354667f996586964643d561687ed246901091c))
