# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1-alpha.153](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.152...v1.0.1-alpha.153) (2024-06-06)

### Bug Fixes

- **rpc:** add interface for fetch ([6035736](https://github.com/deepkit/deepkit-framework/commit/60357366ec1db553789909889bf3489dea17a269))
- **rpc:** http adapter wrong authorization + remove OPTIONS method ([3ff8955](https://github.com/deepkit/deepkit-framework/commit/3ff89556961864ceffea188e33e0af0404cd44b3))
- **rpc:** make sure Error is chained and ValidationError correctly handled ([5c49778](https://github.com/deepkit/deepkit-framework/commit/5c49778da68baaab6e7d9588acb03af7d891bf3a))

### Features

- **rpc:** add http transport ([3b2c6cc](https://github.com/deepkit/deepkit-framework/commit/3b2c6cc6c75d70e3b6bfac7d53e3e7606696baf4))

## [1.0.1-alpha.152](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.151...v1.0.1-alpha.152) (2024-05-16)

### Features

- **rpc:** client.transporter.errored subject ([0fc2bd4](https://github.com/deepkit/deepkit-framework/commit/0fc2bd4aa904bdae9398f4e4c7db602afd3bcbc4))

## [1.0.1-alpha.151](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.150...v1.0.1-alpha.151) (2024-05-14)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.150](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.149...v1.0.1-alpha.150) (2024-05-09)

### Bug Fixes

- **rpc:** ensure data is not chunked twice in server->client controllers ([6c59f9b](https://github.com/deepkit/deepkit-framework/commit/6c59f9bda5830dc11f85b555e7ecd618e10708f8))

## [1.0.1-alpha.149](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.148...v1.0.1-alpha.149) (2024-05-07)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.148](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.147...v1.0.1-alpha.148) (2024-05-04)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.147](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.146...v1.0.1-alpha.147) (2024-05-04)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.146](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.145...v1.0.1-alpha.146) (2024-04-17)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.145](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.144...v1.0.1-alpha.145) (2024-04-08)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.143](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.142...v1.0.1-alpha.143) (2024-03-17)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.142](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.141...v1.0.1-alpha.142) (2024-03-06)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.141](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.140...v1.0.1-alpha.141) (2024-03-05)

### Bug Fixes

- **rpc:** maintain strictSerialization option also in new observables ([273330b](https://github.com/deepkit/deepkit-framework/commit/273330b102c30f62895bd7d3b8b6d6762e080740))

## [1.0.1-alpha.140](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.139...v1.0.1-alpha.140) (2024-03-02)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.139](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.138...v1.0.1-alpha.139) (2024-02-29)

### Bug Fixes

- **rpc:** only print warning text, not error ([ed8cfe7](https://github.com/deepkit/deepkit-framework/commit/ed8cfe7733a36b79a8802afec9280f74d51a6b1b))

## [1.0.1-alpha.138](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.137...v1.0.1-alpha.138) (2024-02-27)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.137](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.136...v1.0.1-alpha.137) (2024-02-26)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.135](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.134...v1.0.1-alpha.135) (2024-02-16)

### Features

- **rpc:** reuse type cache across connections + made strictSerialization(false) less strict ([1b55b08](https://github.com/deepkit/deepkit-framework/commit/1b55b085aee23a53070daa3d179cd86734608b57))

## [1.0.1-alpha.134](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.133...v1.0.1-alpha.134) (2024-02-15)

### Features

- **rpc:** allow to disable strict serialization and validation ([d7a8155](https://github.com/deepkit/deepkit-framework/commit/d7a8155328dca9dca16c3bea88794002fa6f5cba))
- **rpc:** use rpc.logValidationErrors also for strict serializer ([78f57e9](https://github.com/deepkit/deepkit-framework/commit/78f57e92dd457004644d2fa717e6550782a06d3c))

## [1.0.1-alpha.133](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.132...v1.0.1-alpha.133) (2024-02-15)

### Features

- **rpc:** allow serialization of unknown Observable type ([0014074](https://github.com/deepkit/deepkit-framework/commit/00140743b3cec674f7eda89a034c46720c5c96ae))

## [1.0.1-alpha.132](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.131...v1.0.1-alpha.132) (2024-02-10)

### Bug Fixes

- **rpc:** better error message when no observable type can be extracted ([5e7ecf1](https://github.com/deepkit/deepkit-framework/commit/5e7ecf12adf526b103757ede04ed7ec6923a7af6))

## [1.0.1-alpha.131](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.130...v1.0.1-alpha.131) (2024-02-09)

### Bug Fixes

- **rpc:** error Observable Subscribers when no Observable Next type can be detected ([e207fea](https://github.com/deepkit/deepkit-framework/commit/e207fea1d9abbb61f8e33d8253fe3ce5e23022d0))

## [1.0.1-alpha.128](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.127...v1.0.1-alpha.128) (2024-02-06)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.126](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.125...v1.0.1-alpha.126) (2024-02-06)

### Bug Fixes

- **rpc:** wrong ESM import ([1426627](https://github.com/deepkit/deepkit-framework/commit/14266273c30414513aed4ae7667697f19d852098))

## [1.0.1-alpha.124](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.123...v1.0.1-alpha.124) (2024-02-04)

### Bug Fixes

- **type:** handle more circular types ([5f6bd12](https://github.com/deepkit/deepkit-framework/commit/5f6bd124aaf9c546014b81dbded8110312f4e819)), closes [#477](https://github.com/deepkit/deepkit-framework/issues/477)

## [1.0.1-alpha.123](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.122...v1.0.1-alpha.123) (2024-02-02)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.122](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.121...v1.0.1-alpha.122) (2024-01-31)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.121](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.120...v1.0.1-alpha.121) (2024-01-31)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.120](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.119...v1.0.1-alpha.120) (2024-01-29)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.119](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.118...v1.0.1-alpha.119) (2024-01-28)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.117](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.116...v1.0.1-alpha.117) (2024-01-26)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.116](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.115...v1.0.1-alpha.116) (2024-01-22)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.114](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.113...v1.0.1-alpha.114) (2024-01-21)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.113](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.112...v1.0.1-alpha.113) (2024-01-17)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.112](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.111...v1.0.1-alpha.112) (2024-01-16)

### Features

- **rpc:** make kernel connection available in kernel security ([#536](https://github.com/deepkit/deepkit-framework/issues/536)) ([32252b0](https://github.com/deepkit/deepkit-framework/commit/32252b0c1327ec093215602c936d287c20f0a66e))

## [1.0.1-alpha.111](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.110...v1.0.1-alpha.111) (2024-01-15)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.110](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.109...v1.0.1-alpha.110) (2024-01-11)

**Note:** Version bump only for package @deepkit/rpc

## [1.0.1-alpha.109](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.108...v1.0.1-alpha.109) (2024-01-10)

### Bug Fixes

- **rpc:** defer resolving class name ([68fe2a9](https://github.com/deepkit/deepkit-framework/commit/68fe2a9e7bef13462bd304d0d4b55f3afec1b5db))
- **rpc:** tests with controller path resolution based on reflection ([6909fa8](https://github.com/deepkit/deepkit-framework/commit/6909fa846a7880feeecf0323e5e507ba8f929a72))

## [1.0.1-alpha.108](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.107...v1.0.1-alpha.108) (2023-11-21)

### Bug Fixes

- **rpc:** correctly load controller name ([9d603db](https://github.com/deepkit/deepkit-framework/commit/9d603dbf752cfe5335d2c89c4c785a23e8400e0e))
- **rpc:** race condition in disconnect() when connect is still in progress ([f2d708d](https://github.com/deepkit/deepkit-framework/commit/f2d708dfa0dbcfde218aaeea864eb323291ea45a))

### Features

- **rpc:** make controller decorator name optional ([#491](https://github.com/deepkit/deepkit-framework/issues/491)) ([525ed39](https://github.com/deepkit/deepkit-framework/commit/525ed39157334bab05c923fa9de6426d1c496d29))

## [1.0.1-alpha.105](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.103...v1.0.1-alpha.105) (2023-10-23)

### Bug Fixes

- **rpc:** move controllerAccess to handleAction to not call it twice. ([c68308d](https://github.com/deepkit/deepkit-framework/commit/c68308de9c28f8f72bc65c7e25fb08d6555f1383))
