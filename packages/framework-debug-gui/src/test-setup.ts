// https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
import type { TestEnvironmentOptions } from '@angular/core/testing';

globalThis.ngJest = {
    testEnvironmentOptions: {
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true,
    } as TestEnvironmentOptions,
};

import 'jest-preset-angular/setup-jest';
