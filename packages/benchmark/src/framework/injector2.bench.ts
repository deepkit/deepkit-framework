/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import 'reflect-metadata';
import { InjectorContext, InjectorModule } from '@deepkit/injector';
import { BenchSuite } from '../bench';
import { GetOptimizationStatus } from '../utils';

export async function main() {
    const bench = new BenchSuite('injector2', 1);

    {
        class Service1 {
        }

        class Service2 {
        }

        class ScopedService {
        }

        const module1 = new InjectorModule([Service1, Service2, { provide: ScopedService, scope: 'http' }]);

        const context = new InjectorContext(module1);
        const injector = context.getInjector(module1);
        const scoped = context.createChildScope('http');

        console.log((injector as any).resolver.toString());

        console.log('injector1 resolver', GetOptimizationStatus((injector as any).resolver));

        for (let i = 0; i < 100_000; i++) {
            injector.get(Service1);
            injector.get(Service2);
            const s = scoped.get(ScopedService, module1);
        }
        console.log('injector1 resolver', GetOptimizationStatus((injector as any).resolver));

        bench.add('injector.get(Service)', () => {
            const s = injector.get(Service1);
        });

        bench.add('scoped.get(ScopedService)', () => {
            const s = scoped.get(ScopedService, module1);
        });

        bench.add('context.getInjector(module1).get(Service)', () => {
            const s = context.getInjector(module1).get(Service1);
        });

        bench.add('context.createChildScope(\'http\')', () => {
            const s = context.createChildScope('http');
        });

        bench.add('context.createChildScope(\'http\').getInjector(module1)', () => {
            const s = context.createChildScope('http').getInjector(module1);
        });
    }

    // {
    //     class Router {
    //     }
    //
    //     @injectable
    //     class Controller {
    //         constructor(public router: Router) {
    //         }
    //     }
    //
    //     const module1 = new InjectorModule([Router]);
    //     const module2 = new InjectorModule([{ provide: Controller, scope: 'http' }], module1);
    //
    //     const context = new InjectorContext(module1);
    //
    //     const scope = context.createChildScope('http');
    //
    //     const injector1 = context.getInjector(module1);
    //     const injector2 = context.getInjector(module2);
    //     // console.log((injector1 as any).resolver.toString());
    //     // console.log((injector2 as any).resolver.toString());
    //
    //     bench.add('get(Router) ', () => {
    //         const s = scope.get(Router);
    //     });
    //
    //     const router: Router = scope.get(Router);
    //     bench.add('new Controller(router)', () => {
    //         const s = new Controller(router);
    //     });
    //
    //     bench.add('createChildScope', () => {
    //         const scope = context.createChildScope('http');
    //     });
    //
    //     bench.add('new Controller', () => {
    //         const scope = { name: 'http', instances: {} };
    //         const c = new Controller(injector1.get(Router, scope));
    //         (scope.instances as any).i2 = c;
    //     });
    //
    //     bench.add('get(Controller), new scope manually', () => {
    //         const c = context.getInjector(module2).get(Controller, { name: 'http', instances: {} });
    //     });
    //
    //     bench.add('createChildScope().get(Controller)', () => {
    //         const scope = context.createChildScope('http');
    //         const c = scope.get(Controller, module2);
    //     });
    // }

    //
    // bench.add('new Service()', () => {
    //     const s = new Service();
    // });
    //
    // let store: {[name: string]: any} = {};
    // bench.add('new Service() dict store', () => {
    //     if (!store.service) store.service = new Service();
    //     const s = store.service;
    // });
    //
    // bench.add('empty', () => {
    // });
    //
    // function resolve1(token: any, resolved: { [name: string]: any }) {
    //     switch (token) {
    //         case Service: {
    //             if (resolved.first !== undefined) return resolved.first;
    //             resolved.first = new Service();
    //             return resolved.first;
    //         }
    //     }
    // }
    //
    // function resolve2(token: any, resolved: any) {
    //     switch (token) {
    //         case Service: {
    //             if (resolved[0] !== null) return resolved[0];
    //             resolved[0] = new Service();
    //             return resolved[0];
    //         }
    //     }
    // }
    //
    // let resolved_0: any;
    // function resolve3(token: any) {
    //     switch (token) {
    //         case Service: {
    //             if (resolved_0 !== undefined) return resolved_0;
    //             resolved_0 = new Service();
    //             return resolved_0;
    //         }
    //     }
    // }
    //
    // // const resolved1: any = { first: undefined };
    // const resolved1: any = { };
    // bench.add('resolve1(Service)', () => {
    //     resolve1(Service, resolved1);
    // });
    //
    // const resolved2: any = [];
    // // resolved2.push(null);
    // bench.add('resolve2(Service)', () => {
    //     resolve2(Service, resolved2);
    // });
    //
    // bench.add('resolve3(Service)', () => {
    //     resolve3(Service);
    // });

    // const fixedArray = new Array(1);
    // bench.add('array access', () => {
    //     if (!fixedArray[0]) fixedArray[0] = 1;
    //     let v = fixedArray[0];
    // });
    //
    // class Service{}
    // const resolved3: any = [0];
    // bench.add('array access', () => {
    //     if (!resolved3[0]) resolved3[0] = new Service();
    //     let v = resolved3[0];
    // });
    //
    // const resolved4: any = {};
    // resolved4.key = 1;
    // delete resolved4.key; //trigger dictionary mode
    // const name = 'key' + '33';
    // bench.add('object access', () => {
    //     if (!resolved4[name]) resolved4[name] = new Service();
    //     let v = resolved4[name];
    // });
    //
    // const resolved5: any = {};
    // bench.add('object2 access', () => {
    //     if (!resolved5.key2) resolved5.key2 = new Service();
    //     let v = resolved5.key2;
    // });

    bench.run();
}
