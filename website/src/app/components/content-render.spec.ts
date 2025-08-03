import { Component, provideZonelessChangeDetection } from '@angular/core';
import { test } from '@jest/globals';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

TestBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    // ts error: Type 'EnvironmentProviders' is not assignable to type 'StaticProvider'.
    platformBrowserDynamicTesting([provideZonelessChangeDetection()]),
    {
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true,
    },
);
@Component({
    template: `Hi there`,
})
class ComponentA {
}

test('asd', () => {
    const test = TestBed.configureTestingModule({
    });
    const ref = test.createComponent(ComponentA);
    console.log('ref', ref);
});
