import type { Config } from 'jest';

export default {
    displayName: 'mongo',
    preset: '../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: '../../coverage/packages/mongo',
} as Config;
