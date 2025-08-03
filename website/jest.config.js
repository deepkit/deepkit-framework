const { pathsToModuleNameMapper, ESM_TS_TRANSFORM_PATTERN } = require('ts-jest');
// import {pathsToModuleNameMapper} from 'ts-jest';
// import tsconfig from './tsconfig.json' assert {type: 'json'};
const tsconfig = require('./tsconfig.json');

// export default {
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    'transform': {
        ESM_TS_TRANSFORM_PATTERN: ['ts-jest', {
            'useESM': true,
            'tsconfig': 'tsconfig.server.json',
        }],
    },
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: '<rootDir>/' }),
};
