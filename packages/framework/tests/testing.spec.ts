import { createTestingApp } from '../src/testing';
import { test } from '@jest/globals';
import { InjectorContext } from '@deepkit/injector';

test('not needed without controllers or publicDir', () => {
    // class MyClass {
    //     constructor(private j: InjectorContext) {
    //     }
    // }

    const testing = createTestingApp({
        // providers: [
        //     MyClass,
        //     { provide: RpcInjectorContext, scope: 'rpc', useValue: undefined }
        // ]
    });

    testing.app.get(InjectorContext);
});
