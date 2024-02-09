# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1-alpha.131](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.130...v1.0.1-alpha.131) (2024-02-09)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.128](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.127...v1.0.1-alpha.128) (2024-02-06)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.127](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.126...v1.0.1-alpha.127) (2024-02-06)

### Bug Fixes

- **sql:** wrong ESM import ([08996bb](https://github.com/deepkit/deepkit-framework/commit/08996bb2606b48164c727ceb5a7366185efa13a1))

## [1.0.1-alpha.124](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.123...v1.0.1-alpha.124) (2024-02-04)

### Bug Fixes

- **type:** handle more circular types ([5f6bd12](https://github.com/deepkit/deepkit-framework/commit/5f6bd124aaf9c546014b81dbded8110312f4e819)), closes [#477](https://github.com/deepkit/deepkit-framework/issues/477)

### Features

- **orm:** better Error handling + UniqueConstraintFailure ([f1845ee](https://github.com/deepkit/deepkit-framework/commit/f1845ee84eb61a894155944a6efae6b926a4a47d))
- **orm:** new API to configure a join query ([64cc55e](https://github.com/deepkit/deepkit-framework/commit/64cc55e812a6be555515e036de4e6b18d147b4f0))

## [1.0.1-alpha.123](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.122...v1.0.1-alpha.123) (2024-02-02)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.122](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.121...v1.0.1-alpha.122) (2024-01-31)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.121](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.120...v1.0.1-alpha.121) (2024-01-31)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.120](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.119...v1.0.1-alpha.120) (2024-01-29)

### Features

- **sql:** support more union types and add new performance abstraction ([03067fa](https://github.com/deepkit/deepkit-framework/commit/03067fae3490603e1cb5ee28abd95521caeea24b)), closes [#525](https://github.com/deepkit/deepkit-framework/issues/525)

## [1.0.1-alpha.119](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.118...v1.0.1-alpha.119) (2024-01-28)

### Features

- **sql:** support embedded union object literals ([29da45c](https://github.com/deepkit/deepkit-framework/commit/29da45cd45c809d7b0ce029392c20d30b8260a9f))

## [1.0.1-alpha.118](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.117...v1.0.1-alpha.118) (2024-01-27)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.117](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.116...v1.0.1-alpha.117) (2024-01-26)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.116](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.115...v1.0.1-alpha.116) (2024-01-22)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.115](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.114...v1.0.1-alpha.115) (2024-01-21)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.114](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.113...v1.0.1-alpha.114) (2024-01-21)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.113](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.112...v1.0.1-alpha.113) (2024-01-17)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.112](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.111...v1.0.1-alpha.112) (2024-01-16)

### Features

- **app:** improve CLI outputs/parsing by removing [@oclif](https://github.com/oclif) ([e38bbd1](https://github.com/deepkit/deepkit-framework/commit/e38bbd143daa2c856c57eca07a4fd29e884fe97e))

## [1.0.1-alpha.111](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.110...v1.0.1-alpha.111) (2024-01-15)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.110](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.109...v1.0.1-alpha.110) (2024-01-11)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.109](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.108...v1.0.1-alpha.109) (2024-01-10)

### Bug Fixes

- **orm:** snapshot type `any` correctly ([4898e9b](https://github.com/deepkit/deepkit-framework/commit/4898e9bc067b655284b08aa7e9a75b0bffedcbf6))
- **sql:** serialize referenced types ([#528](https://github.com/deepkit/deepkit-framework/issues/528)) ([2f68991](https://github.com/deepkit/deepkit-framework/commit/2f689914f1ed0b6055289f1244a60cab0386c10e))
- **type:** make serializer API consistent ([5870005](https://github.com/deepkit/deepkit-framework/commit/587000526c1ca59e28eea3b107b882151aedb08b))

### Features

- **mongo,sql:** skip database field for inserts ([#527](https://github.com/deepkit/deepkit-framework/issues/527)) ([9fca388](https://github.com/deepkit/deepkit-framework/commit/9fca388be5efa03727a4f7e9b485dce572a66a51))

## [1.0.1-alpha.108](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.107...v1.0.1-alpha.108) (2023-11-21)

**Note:** Version bump only for package @deepkit/sql

## [1.0.1-alpha.105](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.103...v1.0.1-alpha.105) (2023-10-23)

**Note:** Version bump only for package @deepkit/sql
