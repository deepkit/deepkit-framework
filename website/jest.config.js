const {pathsToModuleNameMapper} = require('ts-jest');
// import {pathsToModuleNameMapper} from 'ts-jest';
// import tsconfig from './tsconfig.json' assert {type: 'json'};
const tsconfig = require('./tsconfig.json');

// export default {
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    "transform": {
        "^.+\\.(ts|tsx)$": ["ts-jest", {
            "tsconfig": "tsconfig.server.json"
        }]
    },
    moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {prefix: '<rootDir>/'})
};
