/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export * from './src/core.js';
export * from './src/decorators.js';
export * from './src/enum.js';
export * from './src/iterators.js';
export * from './src/timer.js';
export * from './src/process-locker.js';
export * from './src/network.js';
export * from './src/perf.js';
export * from './src/compiler.js';
export * from './src/string.js';
export * from './src/emitter.js';
export * from './src/reactive.js';
export * from './src/reflection.js';
export * from './src/url.js';
export * from './src/array.js';
export * from './src/types.js';
export * from './src/buffer.js';

// export * does not work for some reason
// we get: packages/framework/src/debug/media.controller.ts:14:25 - error TS2305: Module '"@deepkit/core"' has no exported member 'pathJoin'.
// exporting it explicitly works.
export { pathDirectory, pathJoin, pathExtension, pathNormalize, pathBasename } from './src/path.js';
