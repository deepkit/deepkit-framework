# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1-alpha.140](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.139...v1.0.1-alpha.140) (2024-03-02)

### Bug Fixes

- **framework:** also disconnect broker/stopwatch onServerShutdown ([69c56eb](https://github.com/deepkit/deepkit-framework/commit/69c56ebaa4c80bc612d784b84011d4a557f2853c))

### Features

- **sql:** support per-field name remapping ([63b8aaf](https://github.com/deepkit/deepkit-framework/commit/63b8aaface420a98f14511b22efaffc9628be41d))

## [1.0.1-alpha.139](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.138...v1.0.1-alpha.139) (2024-02-29)

### Bug Fixes

- **create-app:** adjust example app to new API changes ([d2b1c26](https://github.com/deepkit/deepkit-framework/commit/d2b1c260d557ab46f2ad5b467927e7fd5e1a88cd))
- **rpc:** only print warning text, not error ([ed8cfe7](https://github.com/deepkit/deepkit-framework/commit/ed8cfe7733a36b79a8802afec9280f74d51a6b1b))
- **type-compiler:** mark the right SourceFile object as processed ([38cfdf0](https://github.com/deepkit/deepkit-framework/commit/38cfdf06910cfbd01755805022f97ed6afa8dd4d))
- **type:** better error message when fast path type resolution fails due to undefined symbols ([0ef082d](https://github.com/deepkit/deepkit-framework/commit/0ef082d4b474b7d36d7668cf21ad8a9922469189))

## [1.0.1-alpha.138](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.137...v1.0.1-alpha.138) (2024-02-27)

### Bug Fixes

- **type:** make sure methods are not part of deserialization/type guard union resolver ([eb08a73](https://github.com/deepkit/deepkit-framework/commit/eb08a73db15c4d66f69646fe9f34b3c884e602a6))

## [1.0.1-alpha.137](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.136...v1.0.1-alpha.137) (2024-02-26)

### Bug Fixes

- **app:** allow to inject optional services ([52fd21f](https://github.com/deepkit/deepkit-framework/commit/52fd21ff2214a0fa87e314751f4e0a82a78fc908))
- **desktop-ui:** correctly unregister destroyed sidebar ([8613ae4](https://github.com/deepkit/deepkit-framework/commit/8613ae495d9727df04a996dc5803d903b4a7b571))
- **framework:** order of scoped services to allow injecting HttpRequest in RpcKernelSecurity ([9a5e300](https://github.com/deepkit/deepkit-framework/commit/9a5e300906feebb20a4b5169984e68e9fa14a057))
- **type:** correctly type guard `null` in optional properties ([c0adcb0](https://github.com/deepkit/deepkit-framework/commit/c0adcb00ce100b4c01bc6a1d793396b806464f3c))

## [1.0.1-alpha.136](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.135...v1.0.1-alpha.136) (2024-02-20)

### Bug Fixes

- **desktop-ui:** correctly publish package.json ([23f14ac](https://github.com/deepkit/deepkit-framework/commit/23f14aca049007bf18d16e2d4d6d01ca6079b5a4))

## [1.0.1-alpha.135](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.134...v1.0.1-alpha.135) (2024-02-16)

### Features

- **rpc:** reuse type cache across connections + made strictSerialization(false) less strict ([1b55b08](https://github.com/deepkit/deepkit-framework/commit/1b55b085aee23a53070daa3d179cd86734608b57))

## [1.0.1-alpha.134](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.133...v1.0.1-alpha.134) (2024-02-15)

### Bug Fixes

- **bson:** allow to serialize null to optional property ([77b0020](https://github.com/deepkit/deepkit-framework/commit/77b0020cae3af636937577458d5b584c3d6864bf))

### Features

- **rpc:** allow to disable strict serialization and validation ([d7a8155](https://github.com/deepkit/deepkit-framework/commit/d7a8155328dca9dca16c3bea88794002fa6f5cba))
- **rpc:** use rpc.logValidationErrors also for strict serializer ([78f57e9](https://github.com/deepkit/deepkit-framework/commit/78f57e92dd457004644d2fa717e6550782a06d3c))

## [1.0.1-alpha.133](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.132...v1.0.1-alpha.133) (2024-02-15)

### Bug Fixes

- **bson:** fix surrogate pair decoding ([cb9f648](https://github.com/deepkit/deepkit-framework/commit/cb9f648cb587c6c0553fceaf0dc57d90ac34321c))

### Features

- **app:** allow array flags in object literal ([690927c](https://github.com/deepkit/deepkit-framework/commit/690927cc5015419e445a43df8b2729a9e496994b))
- **bson:** export new wrapObjectId/wrapUUId for faster any serialization ([718839b](https://github.com/deepkit/deepkit-framework/commit/718839b00c404239c7b666fe1e5e2d8c2e084d99))
- **mongo:** add readPreference support ([6275c37](https://github.com/deepkit/deepkit-framework/commit/6275c377a557c5eda3d50b35f2b8ab5e868861dc))
- **rpc:** allow serialization of unknown Observable type ([0014074](https://github.com/deepkit/deepkit-framework/commit/00140743b3cec674f7eda89a034c46720c5c96ae))

## [1.0.1-alpha.132](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.131...v1.0.1-alpha.132) (2024-02-10)

### Bug Fixes

- **rpc:** better error message when no observable type can be extracted ([5e7ecf1](https://github.com/deepkit/deepkit-framework/commit/5e7ecf12adf526b103757ede04ed7ec6923a7af6))
- **sql:** strings should be nullable without casting as JSON ([#552](https://github.com/deepkit/deepkit-framework/issues/552)) ([fe55b7f](https://github.com/deepkit/deepkit-framework/commit/fe55b7feb3dc312c31b8dd6dd671ca0150ff5dee))
- **type:** intersection of two different primitive types always return never ([#549](https://github.com/deepkit/deepkit-framework/issues/549)) ([20d3dc8](https://github.com/deepkit/deepkit-framework/commit/20d3dc83a00431db99f6feb0f41da890fa422f48))

### Features

- **mongo:** export custom command API ([d82ccd1](https://github.com/deepkit/deepkit-framework/commit/d82ccd19df86f84e8feacbe124e1d473ff481b8c))

## [1.0.1-alpha.131](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.130...v1.0.1-alpha.131) (2024-02-09)

### Bug Fixes

- **http:** make sure all path parameters are available in HttpRequestParser ([e215420](https://github.com/deepkit/deepkit-framework/commit/e215420edf4889d116b01ca0f52109e7167e7b63))
- **rpc:** error Observable Subscribers when no Observable Next type can be detected ([e207fea](https://github.com/deepkit/deepkit-framework/commit/e207fea1d9abbb61f8e33d8253fe3ce5e23022d0))
- **type:** make sure cast<string> throws when null/undefined is passed ([1bb3641](https://github.com/deepkit/deepkit-framework/commit/1bb3641f3db8196c9bcab64ef17004dc5e1f9f4c))

## [1.0.1-alpha.130](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.129...v1.0.1-alpha.130) (2024-02-07)

### Bug Fixes

- **http:** don't include resolver/DI objects into HttpRequestParser ([be189c5](https://github.com/deepkit/deepkit-framework/commit/be189c5bcf8d5d57e5c9a1738e458e370bff2b50))

### Features

- **http:** allow to fetch unused path parameters in HttpRequestParser ([cc3cd3b](https://github.com/deepkit/deepkit-framework/commit/cc3cd3bc4a0a75906e43ae764bff473a81b09d1b))

## [1.0.1-alpha.129](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.128...v1.0.1-alpha.129) (2024-02-07)

### Features

- **http:** also read path parameters in HttpRequestParser<T> ([888d058](https://github.com/deepkit/deepkit-framework/commit/888d058b900b29fa39a2d77a6aa5e8946f2ee5e7))

## [1.0.1-alpha.128](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.127...v1.0.1-alpha.128) (2024-02-06)

### Bug Fixes

- **framework:** esm import ([a9927c2](https://github.com/deepkit/deepkit-framework/commit/a9927c2507be69b59ee13c45ae315e95aef84898))
- **injector:** correctly label symbols ([ac07f21](https://github.com/deepkit/deepkit-framework/commit/ac07f2134ec21fd0f114bc9751d700f46e0f5607))
- **postgres:** don't crash when no index can be extracted ([c80e88f](https://github.com/deepkit/deepkit-framework/commit/c80e88f2379a8c956d4921922b177685547e7278))

### Features

- **http:** add new HttpRequestParser<T> injection token ([6101f83](https://github.com/deepkit/deepkit-framework/commit/6101f830897e071e72b8e873bda6dbeee69cdc1e))

## [1.0.1-alpha.127](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.126...v1.0.1-alpha.127) (2024-02-06)

### Bug Fixes

- **framework:** wrong ESM import ([9ec0df2](https://github.com/deepkit/deepkit-framework/commit/9ec0df218ddd42dba52b2ac892701b9d9bff216a))
- **sql:** wrong ESM import ([08996bb](https://github.com/deepkit/deepkit-framework/commit/08996bb2606b48164c727ceb5a7366185efa13a1))

## [1.0.1-alpha.126](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.125...v1.0.1-alpha.126) (2024-02-06)

### Bug Fixes

- **rpc:** wrong ESM import ([1426627](https://github.com/deepkit/deepkit-framework/commit/14266273c30414513aed4ae7667697f19d852098))

## [1.0.1-alpha.125](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.124...v1.0.1-alpha.125) (2024-02-05)

### Bug Fixes

- **mongo:** export error symbols ([5841a5a](https://github.com/deepkit/deepkit-framework/commit/5841a5a35927bf34d4187d047e43e2ec6317beb3))

## [1.0.1-alpha.124](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.123...v1.0.1-alpha.124) (2024-02-04)

### Bug Fixes

- **desktop-ui:** -webkit-scrollbar is not supported in chrome anymore ([68fca4f](https://github.com/deepkit/deepkit-framework/commit/68fca4f393d170e2ce5b4bfa17539d06d6ab1cb0))
- **desktop-ui:** dont ignore dist/ in npm package ([e6e6faa](https://github.com/deepkit/deepkit-framework/commit/e6e6faa77f2e30d741dfe0bf77a0d79c5410a7dd))
- **orm:** make sure getJoin operates on existing join model ([03b2428](https://github.com/deepkit/deepkit-framework/commit/03b242832adac48b7163e1fcf8902e7f1b197e8a))
- **type:** handle more circular types ([5f6bd12](https://github.com/deepkit/deepkit-framework/commit/5f6bd124aaf9c546014b81dbded8110312f4e819)), closes [#477](https://github.com/deepkit/deepkit-framework/issues/477)

### Features

- **orm:** better Error handling + UniqueConstraintFailure ([f1845ee](https://github.com/deepkit/deepkit-framework/commit/f1845ee84eb61a894155944a6efae6b926a4a47d))
- **orm:** new API to configure a join query ([64cc55e](https://github.com/deepkit/deepkit-framework/commit/64cc55e812a6be555515e036de4e6b18d147b4f0))

## [1.0.1-alpha.123](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.122...v1.0.1-alpha.123) (2024-02-02)

### Bug Fixes

- **desktop-ui:** resolve various circular imports ([3f5c676](https://github.com/deepkit/deepkit-framework/commit/3f5c676f49678361707be5334222a08efdde65ba))
- **injector:** resolve deps of exported providers correctly ([c185b38](https://github.com/deepkit/deepkit-framework/commit/c185b383c3314f08c92b65c76776864a2065a2b8))

### Features

- **orm:** onDatabaseError event ([cdb7256](https://github.com/deepkit/deepkit-framework/commit/cdb7256b34f1d9de16145dd79b307ccf45f7c72f))

## [1.0.1-alpha.122](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.121...v1.0.1-alpha.122) (2024-01-31)

### Features

- **injector:** new Module.configureProvider<T>(Fn) with configuration callback ([1739b95](https://github.com/deepkit/deepkit-framework/commit/1739b9564dcf4d254dd3041dc71945290e06ad4c))

## [1.0.1-alpha.121](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.120...v1.0.1-alpha.121) (2024-01-31)

### Bug Fixes

- **core:** clear timeouts correctly in ProcessLock ([89cd2d5](https://github.com/deepkit/deepkit-framework/commit/89cd2d5631e09555562a2a25d1c098f70406a469))
- **sqlite:** correctly quote column renaming ([e555ac8](https://github.com/deepkit/deepkit-framework/commit/e555ac8992e9f4ebbbf49f4c88f5e9df05954eef))
- **topsort:** circular reference detection ([1c01cc1](https://github.com/deepkit/deepkit-framework/commit/1c01cc1794ebece3b5633eee3957dcc81d16228d))

### Features

- **broker:** `await using BrokerLockItem.hold()` for better resource management ([7917fb1](https://github.com/deepkit/deepkit-framework/commit/7917fb14a58a7c0a211107ddd34746e8ffafb9fd))
- **http:** allow using unknown/any/never types that are nominal ([3221ff0](https://github.com/deepkit/deepkit-framework/commit/3221ff05ad2a2d426aa8da24c94678a672942831))

## [1.0.1-alpha.120](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.119...v1.0.1-alpha.120) (2024-01-29)

### Features

- **mysql:** upgrade mariadb dependency to 3.2.3 ([558ca17](https://github.com/deepkit/deepkit-framework/commit/558ca17cd7c3f8b22f7fcba2ebfe7e5569097fda))
- **sql:** support more union types and add new performance abstraction ([03067fa](https://github.com/deepkit/deepkit-framework/commit/03067fae3490603e1cb5ee28abd95521caeea24b)), closes [#525](https://github.com/deepkit/deepkit-framework/issues/525)
- **type:** preserve modifiers in homomorphic mapped types ([f2091d0](https://github.com/deepkit/deepkit-framework/commit/f2091d0beeb7360d0bdcc7475d0c88e53dee5de2)), closes [#515](https://github.com/deepkit/deepkit-framework/issues/515) [#514](https://github.com/deepkit/deepkit-framework/issues/514)

## [1.0.1-alpha.119](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.118...v1.0.1-alpha.119) (2024-01-28)

### Features

- **sql:** support embedded union object literals ([29da45c](https://github.com/deepkit/deepkit-framework/commit/29da45cd45c809d7b0ce029392c20d30b8260a9f))
- **type:** provide parent types in serializer template state ([d65dfc0](https://github.com/deepkit/deepkit-framework/commit/d65dfc0f80ee429e1f74af05e3a3fda385855ce5))

## [1.0.1-alpha.118](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.117...v1.0.1-alpha.118) (2024-01-27)

### Features

- **app:** support Reference in cli object flags ([b436af2](https://github.com/deepkit/deepkit-framework/commit/b436af264ae7e06860c93f1d834eb3164cfb51a5))
- **framework:** support multi-host broker setup ([6daa19e](https://github.com/deepkit/deepkit-framework/commit/6daa19e379edde04d08e7e9404fbc8cfa7ecc114))

## [1.0.1-alpha.117](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.116...v1.0.1-alpha.117) (2024-01-26)

### Bug Fixes

- **broker:** invalid type in Bus.publish ([fb99dbe](https://github.com/deepkit/deepkit-framework/commit/fb99dbe06cc6f7b56486a3d5a59ecbed319bb401))
- **type-compiler:** embed external class/functions ([ad6973d](https://github.com/deepkit/deepkit-framework/commit/ad6973dfbe32f9399ceabb39b6499255287cdb22))
- **type-compiler:** merge compilerOptions from ConfigResolver ([7b00789](https://github.com/deepkit/deepkit-framework/commit/7b0078913e5ab381c23dc807fcc86648777ff096))
- **type-compiler:** pattern match exclusion for globs ([#543](https://github.com/deepkit/deepkit-framework/issues/543)) ([30e3319](https://github.com/deepkit/deepkit-framework/commit/30e331942978e528fb5ae3cda2a37541748f562b))
- **type:** correct type guard ([272cff9](https://github.com/deepkit/deepkit-framework/commit/272cff92292043c4b76bd61bc4abe3c9a63509c9))

### Features

- **app:** allow object literals as flags ([488247a](https://github.com/deepkit/deepkit-framework/commit/488247aae86ef77950d28784bf6bf71f63b7da0e))
- **app:** allow passing command function without name ([6796414](https://github.com/deepkit/deepkit-framework/commit/67964145bede869afc88f2e9885334d9a847b755))
- **app:** more color in CLI validation error ([9231b7c](https://github.com/deepkit/deepkit-framework/commit/9231b7cb27b00b89f4badd007e23792814419c82))
- **http:** support non-class types as DI tokens in route actions ([a296570](https://github.com/deepkit/deepkit-framework/commit/a296570e015df1d3b5539ec66ea5723843178c1b))
- **type-compiler:** improve perf by 10x ([6eb0436](https://github.com/deepkit/deepkit-framework/commit/6eb0436c67c11e69c4f694ed9c6ab931c6d840de))
- **type-compiler:** support local export syntax + improve logging ([993cffa](https://github.com/deepkit/deepkit-framework/commit/993cffaa822a76963ed5185d8b1d0a7c1de28069))

## [1.0.1-alpha.116](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.115...v1.0.1-alpha.116) (2024-01-22)

### Features

- **injector:** throw error when both forRoot and exports are used in module ([#539](https://github.com/deepkit/deepkit-framework/issues/539)) ([7faa60d](https://github.com/deepkit/deepkit-framework/commit/7faa60da2a9351253ba65340add99451cbdb6594))
- **type:** refactor typeName embedding ([48a2994](https://github.com/deepkit/deepkit-framework/commit/48a29944064d03d108988949a1ff5b6e42395b57))

## [1.0.1-alpha.115](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.114...v1.0.1-alpha.115) (2024-01-21)

### Bug Fixes

- **create-app:** update code to newest deepkit version ([7f85620](https://github.com/deepkit/deepkit-framework/commit/7f856206c77b724ff0d0c326d8b6ced3c22043c0))
- **framework:** stopwatch store last sync report error ([bc15c06](https://github.com/deepkit/deepkit-framework/commit/bc15c06bdb8c620c0553a41e483c07b55c390852))
- **rpc-tcp:** make sure unixsocket folder is created ([00fd4ed](https://github.com/deepkit/deepkit-framework/commit/00fd4ed43a098e15e8fc922c138bdc9df932908b))
- **website:** add [@latest](https://github.com/latest) to npm init ([f182de5](https://github.com/deepkit/deepkit-framework/commit/f182de57040726c813bccaf7a2ee728ae0c2bd91))

## [1.0.1-alpha.114](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.113...v1.0.1-alpha.114) (2024-01-21)

### Bug Fixes

- **http:** make sure HttpHeader options is defined ([ea251ed](https://github.com/deepkit/deepkit-framework/commit/ea251ed2c6a2500633ec8d5c1593c29887e31868))
- **type-compiler:** support nodenext/node16 module type ([5e40fae](https://github.com/deepkit/deepkit-framework/commit/5e40faef6c72687853cdd877c1d4b0d98756e3ab))

### Features

- **type-compiler:** improve performance drastically ([1d80c1a](https://github.com/deepkit/deepkit-framework/commit/1d80c1a44f8ff0b3f07bc801992ce570cb4f5962))

## [1.0.1-alpha.113](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.112...v1.0.1-alpha.113) (2024-01-17)

### Bug Fixes

- **framework:** make sure profiler is only activated when debug/profile is true. ([c1d9357](https://github.com/deepkit/deepkit-framework/commit/c1d9357dba3b0a5568592fd5d61c8853bfe9b25e))

### Features

- **orm:** remove rxjs dependency ([0d9dfe1](https://github.com/deepkit/deepkit-framework/commit/0d9dfe1f80bfc34bfa12a4ffaa2fd203865d942b))

## [1.0.1-alpha.112](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.111...v1.0.1-alpha.112) (2024-01-16)

### Bug Fixes

- **framework:** make sure configured var/debug folder is created when ([3383504](https://github.com/deepkit/deepkit-framework/commit/3383504b3375d03d9f0f421e19f16e0ebc6721ae))

### Features

- **app:** improve CLI outputs/parsing by removing [@oclif](https://github.com/oclif) ([e38bbd1](https://github.com/deepkit/deepkit-framework/commit/e38bbd143daa2c856c57eca07a4fd29e884fe97e))
- **rpc:** make kernel connection available in kernel security ([#536](https://github.com/deepkit/deepkit-framework/issues/536)) ([32252b0](https://github.com/deepkit/deepkit-framework/commit/32252b0c1327ec093215602c936d287c20f0a66e))

## [1.0.1-alpha.111](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.110...v1.0.1-alpha.111) (2024-01-15)

### Features

- **type:** add new fast path to resolveReceiveType and made it 5x faster on average use case. ([45d656c](https://github.com/deepkit/deepkit-framework/commit/45d656ccc0e4ba36fe362784e60ca58c6b2da31d))

## [1.0.1-alpha.110](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.109...v1.0.1-alpha.110) (2024-01-11)

### Bug Fixes

- **type-compiler:** make sure plugin is exported in new entrypoint + deps are correct ([22eb296](https://github.com/deepkit/deepkit-framework/commit/22eb296d0001c59ca6c6c928d5834f4329f394d0))

## [1.0.1-alpha.109](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.108...v1.0.1-alpha.109) (2024-01-10)

### Bug Fixes

- **bson:** tests ([607d369](https://github.com/deepkit/deepkit-framework/commit/607d3693a12deafd97c3f12e3b61a0985e6de76c))
- **create-app:** add missing filesystem dependency ([#533](https://github.com/deepkit/deepkit-framework/issues/533)) ([a70327c](https://github.com/deepkit/deepkit-framework/commit/a70327c8d936e3b184f5eb542c5df60f59f32437))
- **http:** use default values of route parameters if no http value was provided. ([fa74d16](https://github.com/deepkit/deepkit-framework/commit/fa74d166d5421f8459f64c9b2339b9cf272a1b18)), closes [#529](https://github.com/deepkit/deepkit-framework/issues/529)
- **injector:** allow to define scope in provide<T>({}) ([2f12c2e](https://github.com/deepkit/deepkit-framework/commit/2f12c2eba63cbe2bc1286c8b507045e34c0abbd3))
- **orm:** snapshot type `any` correctly ([4898e9b](https://github.com/deepkit/deepkit-framework/commit/4898e9bc067b655284b08aa7e9a75b0bffedcbf6))
- **rpc:** defer resolving class name ([68fe2a9](https://github.com/deepkit/deepkit-framework/commit/68fe2a9e7bef13462bd304d0d4b55f3afec1b5db))
- **rpc:** tests with controller path resolution based on reflection ([6909fa8](https://github.com/deepkit/deepkit-framework/commit/6909fa846a7880feeecf0323e5e507ba8f929a72))
- **sql:** serialize referenced types ([#528](https://github.com/deepkit/deepkit-framework/issues/528)) ([2f68991](https://github.com/deepkit/deepkit-framework/commit/2f689914f1ed0b6055289f1244a60cab0386c10e))
- **type-compiler:** arrow function receive type ([#521](https://github.com/deepkit/deepkit-framework/issues/521)) ([6bfb246](https://github.com/deepkit/deepkit-framework/commit/6bfb2466753bb99020d8f429097ad1cb3520e500))
- **type-compiler:** resolve reflection mode paths correctly ([acb2d72](https://github.com/deepkit/deepkit-framework/commit/acb2d72f242a742fe99fdcf9fba892faea701e08))
- **type-compiler:** set ts compiler options target to es2022 if higher than es20222 when resolving global lib files ([#516](https://github.com/deepkit/deepkit-framework/issues/516)) ([29a1a17](https://github.com/deepkit/deepkit-framework/commit/29a1a17c0092c6304497c28184d8c5b8790b35e5))
- **type:** make serializer API consistent ([5870005](https://github.com/deepkit/deepkit-framework/commit/587000526c1ca59e28eea3b107b882151aedb08b))

### Features

- **broker:** queue message deduplication ([#512](https://github.com/deepkit/deepkit-framework/issues/512)) ([2a8bf2c](https://github.com/deepkit/deepkit-framework/commit/2a8bf2cb2b50184cbe8d0134ec9047d80270f9ce))
- **injector:** add support for receive type in isProvided ([#511](https://github.com/deepkit/deepkit-framework/issues/511)) ([e405ed3](https://github.com/deepkit/deepkit-framework/commit/e405ed31e65fee1ab50fa752863cd3eb6b08f70f))
- **mongo,sql:** skip database field for inserts ([#527](https://github.com/deepkit/deepkit-framework/issues/527)) ([9fca388](https://github.com/deepkit/deepkit-framework/commit/9fca388be5efa03727a4f7e9b485dce572a66a51))

## [1.0.1-alpha.108](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.107...v1.0.1-alpha.108) (2023-11-21)

### Bug Fixes

- **app:** correctly end stopwatch frame ([86be2e1](https://github.com/deepkit/deepkit-framework/commit/86be2e11eef5e56da223fafbe1333d0aaa68bc35))
- **broker:** await disconnect ([0568378](https://github.com/deepkit/deepkit-framework/commit/056837833424d384bb3c9f43b44a787b70d0128d))
- **core:** make sure stringifyValueWithType does not print unlimited depth ([56fbef9](https://github.com/deepkit/deepkit-framework/commit/56fbef908eb5e0c4d4c244123637182bb94f7145))
- **framework:** don't enable profiler per default ([52a7e52](https://github.com/deepkit/deepkit-framework/commit/52a7e5216b8679c8ff7825979d12b00f7e9ad869))
- **framework:** dont throw when profiler package couldn't be built. ([3b165d6](https://github.com/deepkit/deepkit-framework/commit/3b165d69d91be1c86d9a9e09770411f5fbdc66c5))
- **framework:** provide always DebugBroker ([1b55b65](https://github.com/deepkit/deepkit-framework/commit/1b55b65b0f5105c4a555e95b5b166dbad0a3ae11))
- **http:** fix tests to reflect new error reporting ([1eb83ff](https://github.com/deepkit/deepkit-framework/commit/1eb83ff2ba669fc9410269023e23b863c44e4257))
- **injector:** make sure type cache is used when finding matching provider. ([8c79e4b](https://github.com/deepkit/deepkit-framework/commit/8c79e4b1d370c21f12c203a786608b6d39dc5c56))
- **rpc:** correctly load controller name ([9d603db](https://github.com/deepkit/deepkit-framework/commit/9d603dbf752cfe5335d2c89c4c785a23e8400e0e))
- **rpc:** race condition in disconnect() when connect is still in progress ([f2d708d](https://github.com/deepkit/deepkit-framework/commit/f2d708dfa0dbcfde218aaeea864eb323291ea45a))
- **template:** better typings to support `<element role="string">` ([efb1668](https://github.com/deepkit/deepkit-framework/commit/efb1668218ec98cb0b5436a4530126bf235c79cf))
- **type:** correctly check `X extends Date` and print validation errors with caused value. ([fde795e](https://github.com/deepkit/deepkit-framework/commit/fde795ee6998606b0791f936a25ee85921c6586a))
- **type:** correctly materialize Promise in runtime checks. ([aa66460](https://github.com/deepkit/deepkit-framework/commit/aa66460f9b125a7070645f64f34a5574cd9eb549)), closes [#495](https://github.com/deepkit/deepkit-framework/issues/495)
- **type:** make sure `typeof x` expression doesn't return the original type ([7206e7e](https://github.com/deepkit/deepkit-framework/commit/7206e7ef9c3728e2b60d9a6cd7ecdb167fca78d0))
- **type:** make sure inline returns a ref to the correct type program ([dc5d6dd](https://github.com/deepkit/deepkit-framework/commit/dc5d6ddf36cc8835d7b11684a004f247900ec65f))

### Features

- **rpc:** make controller decorator name optional ([#491](https://github.com/deepkit/deepkit-framework/issues/491)) ([525ed39](https://github.com/deepkit/deepkit-framework/commit/525ed39157334bab05c923fa9de6426d1c496d29))
- **type-compiler:** emit typeName for type only imports ([#501](https://github.com/deepkit/deepkit-framework/issues/501)) ([318d091](https://github.com/deepkit/deepkit-framework/commit/318d091b9418df0a77f85de18d37541c3f9e3428))

## [1.0.1-alpha.107](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.106...v1.0.1-alpha.107) (2023-10-23)

**Note:** Version bump only for package root

## [1.0.1-alpha.106](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.105...v1.0.1-alpha.106) (2023-10-23)

**Note:** Version bump only for package root

## [1.0.1-alpha.105](https://github.com/deepkit/deepkit-framework/compare/v1.0.1-alpha.103...v1.0.1-alpha.105) (2023-10-23)

### Bug Fixes

- **filesystem-aws-s3:** use new type for ACL ([dd08c77](https://github.com/deepkit/deepkit-framework/commit/dd08c77c766d12bd52cc3f551ab65b4409c08891))
- **framework:** support esm environment for debug gui http routes ([5cb33cf](https://github.com/deepkit/deepkit-framework/commit/5cb33cfd7b98c3549ff30c42980c3d6e8f65a447))
- **mongo:** also check connection request for queued requests. ([6c6ca94](https://github.com/deepkit/deepkit-framework/commit/6c6ca94571775897edc62cd8dfa0d407b9695a98))
- **mongo:** fix off by one error in pool ([666ba86](https://github.com/deepkit/deepkit-framework/commit/666ba8614054db7deaf61fed195538e25fcee516))
- **orm:** correctly instantiate database class per module ([1ea2418](https://github.com/deepkit/deepkit-framework/commit/1ea24186232c73412bea8490f4b2eb4c30511122))
- **rpc:** move controllerAccess to handleAction to not call it twice. ([c68308d](https://github.com/deepkit/deepkit-framework/commit/c68308de9c28f8f72bc65c7e25fb08d6555f1383))
- **type-compiler:** wrong import ([caad2b3](https://github.com/deepkit/deepkit-framework/commit/caad2b39972d284e4eab9a8cedf9c3e95997c789))
- **type:** do not interfere with type checking when intersecting multiple type annotations. ([af85f1f](https://github.com/deepkit/deepkit-framework/commit/af85f1ff48c4be9fbd9a2ecd46e7f97b0bbb28c7))
- **type:** test ([c335466](https://github.com/deepkit/deepkit-framework/commit/c3354667f996586964643d561687ed246901091c))
