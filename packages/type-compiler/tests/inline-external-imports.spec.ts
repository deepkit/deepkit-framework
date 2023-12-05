import { test, expect } from '@jest/globals';
import { ReflectionKind, TypeClass, TypeFunction } from '@deepkit/type';

import { transpile, transpileAndRun } from './utils';

test('string type alias', () => {
    const res = transpile({
        app: `import { NIL } from 'uuid';

            type T = typeof NIL;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'uuid': ['NIL'],
        },
    });

    expect(res.app).not.toContain('const __ΩNIL = [');
    expect(res.app).not.toContain('() => __assignType(uuid_1.NIL, __ΩNIL)');
    expect(res.app).toContain('() => uuid_1.NIL');
});

test('typeOf string type alias', () => {
    const res = transpileAndRun({
        app: `import { typeOf } from '@deepkit/type';
            import { NIL } from 'uuid';

            typeOf<typeof NIL>();
        `
    });

    expect(res).toMatchInlineSnapshot(`
        {
          "kind": 13,
          "literal": "00000000-0000-0000-0000-000000000000",
          "typeName": undefined,
        }
    `);
});

test('object type alias', () => {
    const res = transpile({
        app: `import { config } from 'rxjs';

            type A = typeof config;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['config'],
        },
    });

    expect(res.app).not.toContain('const __Ωconfig = [');
    expect(res.app).not.toContain('() => __assignType(rxjs_1.config, __Ωconfig)');
    expect(res.app).toContain('() => rxjs_1.config');
});

test('typeOf object type alias', () => {
    const res = transpileAndRun({
        app: `import { typeOf } from '@deepkit/type';
            import { config } from 'rxjs';

            typeOf<typeof config>();
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['config'],
        },
    });

    expect(res).toMatchInlineSnapshot(`
        {
          "annotations": {},
          "id": 2,
          "kind": 30,
          "typeName": undefined,
          "types": [
            {
              "kind": 32,
              "name": "onUnhandledError",
              "parent": [Circular],
              "type": {
                "kind": 10,
                "parent": [Circular],
              },
            },
            {
              "kind": 32,
              "name": "onStoppedNotification",
              "parent": [Circular],
              "type": {
                "kind": 10,
                "parent": [Circular],
              },
            },
            {
              "kind": 32,
              "name": "Promise",
              "parent": [Circular],
              "type": {
                "kind": 11,
                "parent": [Circular],
              },
            },
            {
              "kind": 32,
              "name": "useDeprecatedSynchronousErrorHandling",
              "parent": [Circular],
              "type": {
                "jit": {},
                "kind": 7,
                "origin": {
                  "kind": 13,
                  "literal": false,
                },
                "parent": [Circular],
              },
            },
            {
              "kind": 32,
              "name": "useDeprecatedNextContext",
              "parent": [Circular],
              "type": {
                "jit": {},
                "kind": 7,
                "origin": {
                  "kind": 13,
                  "literal": false,
                },
                "parent": [Circular],
              },
            },
            {
              "kind": 32,
              "name": "__type",
              "parent": [Circular],
              "type": {
                "kind": 25,
                "parent": [Circular],
                "type": {
                  "jit": {},
                  "kind": 5,
                  "origin": {
                    "kind": 13,
                    "literal": "!",
                  },
                },
              },
            },
          ],
        }
    `);
});

test('function type alias', () => {
    const res = transpile({
        app: `import { map } from 'rxjs/operators';

            type A = typeof map;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs/operators': ['map'],
        },
    });

    expect(res.app).toContain('const __Ωmap = [');
    expect(res.app).toContain('() => __assignType(operators_1.map, __Ωmap)');
});

test('typeOf function type alias', () => {
    const res = transpileAndRun({
        app: `import { map } from 'rxjs/operators';
            import { typeOf } from '@deepkit/type';

            typeOf<typeof map>();
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs/operators': ['map', 'OperatorFunction'],
        },
    }) as TypeFunction;

    expect(res.return.kind).not.toBe(ReflectionKind.never);

    console.log(res.return);

    expect(res).toMatchInlineSnapshot(`
        {
          "function": [Function],
          "inlined": true,
          "kind": 17,
          "name": "map",
          "parameters": [
            {
              "kind": 18,
              "name": "project",
              "parent": {
                "function": [Function],
                "kind": 17,
                "name": "map",
                "parameters": [Circular],
                "return": {
                  "kind": 0,
                  "parent": [Circular],
                },
                "typeName": undefined,
              },
              "type": {
                "kind": 17,
                "name": undefined,
                "parameters": [
                  {
                    "kind": 18,
                    "name": "value",
                    "parent": [Circular],
                    "type": {
                      "kind": 1,
                      "parent": [Circular],
                    },
                  },
                  {
                    "kind": 18,
                    "name": "index",
                    "parent": [Circular],
                    "type": {
                      "kind": 6,
                      "parent": [Circular],
                    },
                  },
                ],
                "parent": [Circular],
                "return": {
                  "kind": 1,
                  "parent": [Circular],
                },
              },
            },
          ],
          "return": {
            "kind": 0,
            "parent": {
              "function": [Function],
              "kind": 17,
              "name": "map",
              "parameters": [
                {
                  "kind": 18,
                  "name": "project",
                  "parent": [Circular],
                  "type": {
                    "kind": 17,
                    "name": undefined,
                    "parameters": [
                      {
                        "kind": 18,
                        "name": "value",
                        "parent": [Circular],
                        "type": {
                          "kind": 1,
                          "parent": [Circular],
                        },
                      },
                      {
                        "kind": 18,
                        "name": "index",
                        "parent": [Circular],
                        "type": {
                          "kind": 6,
                          "parent": [Circular],
                        },
                      },
                    ],
                    "parent": [Circular],
                    "return": {
                      "kind": 1,
                      "parent": [Circular],
                    },
                  },
                },
              ],
              "return": [Circular],
              "typeName": undefined,
            },
          },
          "typeName": undefined,
        }
    `);
})

test('class type var', () => {
    const res = transpile({
        app: `import { Observable } from 'rxjs';

            type A = Observable<unknown>;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['Observable'],
        },
    });

    // TODO: how to resolve the typeof imports? -> __assignType(Subscriber_1.Subscriber, __ΩSubscriber)
    //     "use strict";
    //     Object.defineProperty(exports, "__esModule", { value: true });
    //     exports.__ΩUnsubscribable = exports.__ΩSubscribable = exports.__ΩSubscription = exports.__ΩObserver = exports.__ΩTeardownLogic = exports.__ΩSubscriber = exports.__ΩOperator = exports.__ΩObservable = void 0;
    //     const __ΩObservable = ['T', () => Observable, 'source', () => __ΩOperator, 'operator', () => Observable, 'this', () => __assignType(Subscriber_1.Subscriber, __ΩSubscriber), 'subscriber', () => __ΩTeardownLogic, '', 'subscribe', 'constructor', 'args', 'create', () => __ΩOperator, () => Observable, 'lift', () => __ΩPartial, () => __ΩObserver, 'observer', () => __assignType(Subscription_1.Subscription, __ΩSubscription), 'value', 'next', 'forEach', () => Observable, 'pipe', 'toPromise', () => __ΩSubscribable, 'Observable', 'b!PP"7"-J3#P"e"!o$#-J3%PPPe$!7&2\'Pe$!7(2)n*/+2,8"0-P"@2."/+3/sPe"!"o0#2%8P"7102Pe"!o4"o3"258P760,PPe#!27$/+28$`09PPe#!7:0;PPe#!-J`0<5e!!o="x"w>y'];
    //     exports.__ΩObservable = __ΩObservable;
    //     const __ΩOperator = ['T', 'R', () => Subscriber_2.Subscriber, 'subscriber', 'source', () => __ΩTeardownLogic, 'call', 'b!b"PPPe$"7#2$"2%n&1\'My'];
    //     exports.__ΩOperator = __ΩOperator;
    //     const __ΩSubscriber = ['T', () => Subscription_2.Subscription, 'x', '', 'next', 'e', 'error', 'complete', () => Subscriber, 'create', 'isStopped', () => Subscriber, () => __ΩObserver, 'destination', () => Subscriber, () => __ΩObserver, 'constructor', 'value', 'err', 'unsubscribe', '_next', '_error', '_complete', () => __ΩObserver, 'Subscriber', 'b!P7"PPe#!2#8$/$2%8P"2&8$/$2\'8P$/$2(8Pe#!7)0*s)3+<PP"7,"o-"J3.<PPP"7/"o0"J2.8"01Pe"!228$0%P"238$0\'P$0(P$04Pe"!22$05<P"23$06<P$07<5e!!o8"x"w9y'];
    //     exports.__ΩSubscriber = __ΩSubscriber;
    //     const __ΩTeardownLogic = [() => Subscription_3.Subscription, () => __ΩUnsubscribable, '', 'PP7!n"P$/#$Jy'];
    //     exports.__ΩTeardownLogic = __ΩTeardownLogic;
    //     const __ΩPartial = ['T', 'l+e#!e"!fRb!Pde"!gN#"y'];
    //     const __ΩObserver = ['T', 'value', '', 'next', 'err', 'error', 'complete', 'b!PPe#!2"$/#4$P"2%$/#4&P$/#4\'My'];
    //     exports.__ΩObserver = __ΩObserver;
    //     const __ΩSubscription = [() => Subscription, 'EMPTY', 'closed', '', 'initialTeardown', 'constructor', 'unsubscribe', () => __ΩTeardownLogic, 'teardown', 'add', () => __ΩExclude, () => __ΩTeardownLogic, 'remove', 'Subscription', 'P7!3"s)3#PPP$/$-J2%8"0&P$0\'Pn(2)$0*Pn,$o+#2)$0-5x"w.y'];
    //     exports.__ΩSubscription = __ΩSubscription;
    //     const __ΩSubscribable = ['T', () => __ΩPartial, () => __ΩObserver, 'observer', () => __ΩUnsubscribable, 'subscribe', 'b!PPe#!o#"o""2$n%1&My'];
    //     exports.__ΩSubscribable = __ΩSubscribable;
    //     const __ΩUnsubscribable = ['unsubscribe', 'PP$1!My'];
    //     exports.__ΩUnsubscribable = __ΩUnsubscribable;
    //     const __ΩExclude = ['T', 'U', 'l6!Re$!RPe#!e$"qk#%QRb!b"Pde"!p)y'];
    //     function __assignType(fn, args) {
    //         fn.__type = args;
    //         return fn;
    //     }
    //     const rxjs_1 = require("rxjs");
    //     const __ΩA = [() => __assignType(rxjs_1.Observable, __ΩObservable), 'P#7!y'];

    expect(res.app).toContain('const __ΩObservable = [');
    expect(res.app).toContain('() => __assignType(rxjs_1.Observable, __ΩObservable)');
})
test('class typeOf', () => {
    const res = transpileAndRun({
        app: `import { Observable } from 'rxjs';
            import { typeOf } from '@deepkit/type';

            typeOf<Observable<unknown>>();
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['Observable'],
        },
    }) as TypeClass;

    expect(res.implements![0]).toMatchObject({
        kind: 30,
        typeName: 'Subscribable',
    });
    expect(res.typeArguments).toHaveLength(1);
    expect(res.types).toHaveLength(1);
})

test('only a single type is transformed', () => {
    const res = transpile({
        app: `import { ConfigEnv, CorsOrigin } from 'vite';

            type A = ConfigEnv;

            type B = CorsOrigin;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'vite': ['ConfigEnv'],
        },
    });

    expect(res.app).toContain('const __ΩConfigEnv = [');
    expect(res.app).not.toContain('const __ΩCorsOrigin = [');
})

test('interface typeOf', () => {
    const res = transpileAndRun({
        app: `import { ConfigEnv, CorsOrigin } from 'vite';
            import { typeOf } from '@deepkit/type';

            typeOf<ConfigEnv>();
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'vite': ['ConfigEnv'],
        },
    });

    expect(res).toMatchInlineSnapshot(`
        {
          "annotations": {},
          "id": 2,
          "kind": 30,
          "typeArguments": undefined,
          "typeName": "ConfigEnv",
          "types": [
            {
              "kind": 32,
              "name": "command",
              "parent": [Circular],
              "type": {
                "kind": 23,
                "parent": [Circular],
                "types": [
                  {
                    "kind": 13,
                    "literal": "build",
                    "parent": [Circular],
                  },
                  {
                    "kind": 13,
                    "literal": "serve",
                    "parent": [Circular],
                  },
                ],
              },
            },
            {
              "kind": 32,
              "name": "mode",
              "parent": [Circular],
              "type": {
                "kind": 5,
                "parent": [Circular],
              },
            },
            {
              "kind": 32,
              "name": "ssrBuild",
              "optional": true,
              "parent": [Circular],
              "type": {
                "kind": 7,
                "parent": [Circular],
              },
            },
          ],
        }
    `);
});

test('inline all external type imports for package', () => {
    const res = transpile({
        app: `import { ConfigEnv, CorsOrigin } from 'vite';
            import { typeOf } from '@deepkit/type';

            type A = ConfigEnv;
            type B = CorsOrigin;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'vite': true,
        },
    });

    expect(res.app).toContain('const __ΩConfigEnv = [');
    expect(res.app).toContain('const __ΩCorsOrigin = [');
});
