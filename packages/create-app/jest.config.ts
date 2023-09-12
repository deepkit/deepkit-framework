import type { Config } from 'jest';

export default {
    displayName: 'create-app',
    preset: '../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    },
    testPathIgnorePatterns: ['<rootDir>/src/files/'],
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: '../../coverage/packages/create-app',
} as Config;
