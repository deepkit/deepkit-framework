# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
