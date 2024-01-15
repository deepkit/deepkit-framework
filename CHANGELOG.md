# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1-alpha.111](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.110...v1.0.1-alpha.111) (2024-01-15)


### Features

* **type:** add new fast path to resolveReceiveType and made it 5x faster on average use case. ([45d656c](https://github.com/deepkit/deepkit-framework/commit/45d656ccc0e4ba36fe362784e60ca58c6b2da31d))





## [1.0.1-alpha.110](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.109...v1.0.1-alpha.110) (2024-01-11)


### Bug Fixes

* **type-compiler:** make sure plugin is exported in new entrypoint + deps are correct ([22eb296](https://github.com/deepkit/deepkit-framework/commit/22eb296d0001c59ca6c6c928d5834f4329f394d0))





## [1.0.1-alpha.109](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.108...v1.0.1-alpha.109) (2024-01-10)


### Bug Fixes

* **bson:** tests ([607d369](https://github.com/deepkit/deepkit-framework/commit/607d3693a12deafd97c3f12e3b61a0985e6de76c))
* **create-app:** add missing filesystem dependency ([#533](https://github.com/deepkit/deepkit-framework/issues/533)) ([a70327c](https://github.com/deepkit/deepkit-framework/commit/a70327c8d936e3b184f5eb542c5df60f59f32437))
* **http:** use default values of route parameters if no http value was provided. ([fa74d16](https://github.com/deepkit/deepkit-framework/commit/fa74d166d5421f8459f64c9b2339b9cf272a1b18)), closes [#529](https://github.com/deepkit/deepkit-framework/issues/529)
* **injector:** allow to define scope in provide<T>({}) ([2f12c2e](https://github.com/deepkit/deepkit-framework/commit/2f12c2eba63cbe2bc1286c8b507045e34c0abbd3))
* **orm:** snapshot type `any` correctly ([4898e9b](https://github.com/deepkit/deepkit-framework/commit/4898e9bc067b655284b08aa7e9a75b0bffedcbf6))
* **rpc:** defer resolving class name ([68fe2a9](https://github.com/deepkit/deepkit-framework/commit/68fe2a9e7bef13462bd304d0d4b55f3afec1b5db))
* **rpc:** tests with controller path resolution based on reflection ([6909fa8](https://github.com/deepkit/deepkit-framework/commit/6909fa846a7880feeecf0323e5e507ba8f929a72))
* **sql:** serialize referenced types ([#528](https://github.com/deepkit/deepkit-framework/issues/528)) ([2f68991](https://github.com/deepkit/deepkit-framework/commit/2f689914f1ed0b6055289f1244a60cab0386c10e))
* **type-compiler:** arrow function receive type ([#521](https://github.com/deepkit/deepkit-framework/issues/521)) ([6bfb246](https://github.com/deepkit/deepkit-framework/commit/6bfb2466753bb99020d8f429097ad1cb3520e500))
* **type-compiler:** resolve reflection mode paths correctly ([acb2d72](https://github.com/deepkit/deepkit-framework/commit/acb2d72f242a742fe99fdcf9fba892faea701e08))
* **type-compiler:** set ts compiler options target to es2022 if higher than es20222 when resolving global lib files ([#516](https://github.com/deepkit/deepkit-framework/issues/516)) ([29a1a17](https://github.com/deepkit/deepkit-framework/commit/29a1a17c0092c6304497c28184d8c5b8790b35e5))
* **type:** make serializer API consistent ([5870005](https://github.com/deepkit/deepkit-framework/commit/587000526c1ca59e28eea3b107b882151aedb08b))


### Features

* **broker:** queue message deduplication ([#512](https://github.com/deepkit/deepkit-framework/issues/512)) ([2a8bf2c](https://github.com/deepkit/deepkit-framework/commit/2a8bf2cb2b50184cbe8d0134ec9047d80270f9ce))
* **injector:** add support for receive type in isProvided ([#511](https://github.com/deepkit/deepkit-framework/issues/511)) ([e405ed3](https://github.com/deepkit/deepkit-framework/commit/e405ed31e65fee1ab50fa752863cd3eb6b08f70f))
* **mongo,sql:** skip database field for inserts ([#527](https://github.com/deepkit/deepkit-framework/issues/527)) ([9fca388](https://github.com/deepkit/deepkit-framework/commit/9fca388be5efa03727a4f7e9b485dce572a66a51))





## [1.0.1-alpha.108](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.107...v1.0.1-alpha.108) (2023-11-21)


### Bug Fixes

* **app:** correctly end stopwatch frame ([86be2e1](https://github.com/deepkit/deepkit-framework/commit/86be2e11eef5e56da223fafbe1333d0aaa68bc35))
* **broker:** await disconnect ([0568378](https://github.com/deepkit/deepkit-framework/commit/056837833424d384bb3c9f43b44a787b70d0128d))
* **core:** make sure stringifyValueWithType does not print unlimited depth ([56fbef9](https://github.com/deepkit/deepkit-framework/commit/56fbef908eb5e0c4d4c244123637182bb94f7145))
* **framework:** don't enable profiler per default ([52a7e52](https://github.com/deepkit/deepkit-framework/commit/52a7e5216b8679c8ff7825979d12b00f7e9ad869))
* **framework:** dont throw when profiler package couldn't be built. ([3b165d6](https://github.com/deepkit/deepkit-framework/commit/3b165d69d91be1c86d9a9e09770411f5fbdc66c5))
* **framework:** provide always DebugBroker ([1b55b65](https://github.com/deepkit/deepkit-framework/commit/1b55b65b0f5105c4a555e95b5b166dbad0a3ae11))
* **http:** fix tests to reflect new error reporting ([1eb83ff](https://github.com/deepkit/deepkit-framework/commit/1eb83ff2ba669fc9410269023e23b863c44e4257))
* **injector:** make sure type cache is used when finding matching provider. ([8c79e4b](https://github.com/deepkit/deepkit-framework/commit/8c79e4b1d370c21f12c203a786608b6d39dc5c56))
* **rpc:** correctly load controller name ([9d603db](https://github.com/deepkit/deepkit-framework/commit/9d603dbf752cfe5335d2c89c4c785a23e8400e0e))
* **rpc:** race condition in disconnect() when connect is still in progress ([f2d708d](https://github.com/deepkit/deepkit-framework/commit/f2d708dfa0dbcfde218aaeea864eb323291ea45a))
* **template:** better typings to support `<element role="string">` ([efb1668](https://github.com/deepkit/deepkit-framework/commit/efb1668218ec98cb0b5436a4530126bf235c79cf))
* **type:** correctly check `X extends Date` and print validation errors with caused value. ([fde795e](https://github.com/deepkit/deepkit-framework/commit/fde795ee6998606b0791f936a25ee85921c6586a))
* **type:** correctly materialize Promise in runtime checks. ([aa66460](https://github.com/deepkit/deepkit-framework/commit/aa66460f9b125a7070645f64f34a5574cd9eb549)), closes [#495](https://github.com/deepkit/deepkit-framework/issues/495)
* **type:** make sure `typeof x` expression doesn't return the original type ([7206e7e](https://github.com/deepkit/deepkit-framework/commit/7206e7ef9c3728e2b60d9a6cd7ecdb167fca78d0))
* **type:** make sure inline returns a ref to the correct type program ([dc5d6dd](https://github.com/deepkit/deepkit-framework/commit/dc5d6ddf36cc8835d7b11684a004f247900ec65f))


### Features

* **rpc:** make controller decorator name optional ([#491](https://github.com/deepkit/deepkit-framework/issues/491)) ([525ed39](https://github.com/deepkit/deepkit-framework/commit/525ed39157334bab05c923fa9de6426d1c496d29))
* **type-compiler:** emit typeName for type only imports ([#501](https://github.com/deepkit/deepkit-framework/issues/501)) ([318d091](https://github.com/deepkit/deepkit-framework/commit/318d091b9418df0a77f85de18d37541c3f9e3428))





## [1.0.1-alpha.107](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.106...v1.0.1-alpha.107) (2023-10-23)

**Note:** Version bump only for package root





## [1.0.1-alpha.106](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.105...v1.0.1-alpha.106) (2023-10-23)

**Note:** Version bump only for package root





## [1.0.1-alpha.105](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.103...v1.0.1-alpha.105) (2023-10-23)


### Bug Fixes

* **filesystem-aws-s3:** use new type for ACL ([dd08c77](https://github.com/deepkit/deepkit-framework/commit/dd08c77c766d12bd52cc3f551ab65b4409c08891))
* **framework:** support esm environment for debug gui http routes ([5cb33cf](https://github.com/deepkit/deepkit-framework/commit/5cb33cfd7b98c3549ff30c42980c3d6e8f65a447))
* **mongo:** also check connection request for queued requests. ([6c6ca94](https://github.com/deepkit/deepkit-framework/commit/6c6ca94571775897edc62cd8dfa0d407b9695a98))
* **mongo:** fix off by one error in pool ([666ba86](https://github.com/deepkit/deepkit-framework/commit/666ba8614054db7deaf61fed195538e25fcee516))
* **orm:** correctly instantiate database class per module ([1ea2418](https://github.com/deepkit/deepkit-framework/commit/1ea24186232c73412bea8490f4b2eb4c30511122))
* **rpc:** move controllerAccess to handleAction to not call it twice. ([c68308d](https://github.com/deepkit/deepkit-framework/commit/c68308de9c28f8f72bc65c7e25fb08d6555f1383))
* **type-compiler:** wrong import ([caad2b3](https://github.com/deepkit/deepkit-framework/commit/caad2b39972d284e4eab9a8cedf9c3e95997c789))
* **type:** do not interfere with type checking when intersecting multiple type annotations. ([af85f1f](https://github.com/deepkit/deepkit-framework/commit/af85f1ff48c4be9fbd9a2ecd46e7f97b0bbb28c7))
* **type:** test ([c335466](https://github.com/deepkit/deepkit-framework/commit/c3354667f996586964643d561687ed246901091c))
