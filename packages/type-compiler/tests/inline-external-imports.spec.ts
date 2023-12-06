import { test, expect } from '@jest/globals';
import { ReflectionKind, TypeClass, TypeFunction } from '@deepkit/type';
import { Unsubscribable } from 'rxjs';

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

    expect(res.app).toContain('const __ɵΩObservable = [');
    expect(res.app).toContain('() => __assignType(rxjs_1.Observable, __ɵΩObservable)');

    expect(res.app).toContain('const __ɵΩUnsubscribable = [');

    expect(res.app).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.__ɵΩSubscriptionLike = exports.__ɵΩUnsubscribable = exports.__ɵΩSubscribable = exports.__ɵΩSubscription = exports.__ɵΩObserver = exports.__ɵΩTeardownLogic = exports.__ɵΩSubscriber = exports.__ɵΩOperator = exports.__ɵΩObservable = void 0;
        const __ɵΩObservable = ['T', () => __ɵΩObservable, 'source', () => __ΩOperator, 'operator', () => __ɵΩObservable, 'this', () => __assignType(Subscriber_1.Subscriber, __ɵΩSubscriber), 'subscriber', () => __ΩTeardownLogic, '', 'subscribe', 'constructor', 'args', 'create', () => __ɵΩOperator, () => __ɵΩObservable, 'lift', () => __ΩPartial, () => __ΩObserver, 'observer', () => __assignType(Subscription_1.Subscription, __ɵΩSubscription), 'value', 'next', 'forEach', () => __ɵΩObservable, 'pipe', 'toPromise', () => __ΩSubscribable, 'Observable', 'b!PP"7"-J3#P"e"!o$#-J3%PPPe$!7&2\\'Pe$!7(2)n*/+2,8"0-P"@2."/+3/sPe"!"o0#2%8P"7102Pe"!o4"o3"258P760,PPe#!27$/+28$\`09PPe#!7:0;PPe#!-J\`0<5e!!o="x"w>y'];
        exports.__ɵΩObservable = __ɵΩObservable;
        const __ɵΩOperator = ['T', 'R', () => __assignType(Subscriber_2.Subscriber, __ɵΩSubscriber), 'subscriber', 'source', () => __ɵΩTeardownLogic, 'call', 'b!b"PPPe$"7#2$"2%n&1\\'My'];
        exports.__ɵΩOperator = __ɵΩOperator;
        const __ɵΩSubscriber = ['T', () => Subscription_2.Subscription, 'x', '', 'next', 'e', 'error', 'complete', () => __ɵΩSubscriber, 'create', 'isStopped', () => __ɵΩSubscriber, () => __ɵΩObserver, 'destination', () => __ɵΩSubscriber, () => __ɵΩObserver, 'constructor', 'value', 'err', 'unsubscribe', '_next', '_error', '_complete', () => __ɵΩObserver, 'Subscriber', 'b!P7"PPe#!2#8$/$2%8P"2&8$/$2\\'8P$/$2(8Pe#!7)0*s)3+<PP"7,"o-"J3.<PPP"7/"o0"J2.8"01Pe"!228$0%P"238$0\\'P$0(P$04Pe"!22$05<P"23$06<P$07<5e!!o8"x"w9y'];
        exports.__ɵΩSubscriber = __ɵΩSubscriber;
        const __ɵΩTeardownLogic = [() => __assignType(Subscription_3.Subscription, __ɵΩSubscription), () => __ΩUnsubscribable, '', 'PP7!n"P$/#$Jy'];
        exports.__ɵΩTeardownLogic = __ɵΩTeardownLogic;
        const __ΩPartial = ['T', 'l+e#!e"!fRb!Pde"!gN#"y'];
        const __ɵΩObserver = ['T', 'value', '', 'next', 'err', 'error', 'complete', 'b!PPe#!2"$/#4$P"2%$/#4&P$/#4\\'My'];
        exports.__ɵΩObserver = __ɵΩObserver;
        const __ɵΩSubscription = [() => __ɵΩSubscription, 'EMPTY', 'closed', '', 'initialTeardown', 'constructor', 'unsubscribe', () => __ɵΩTeardownLogic, 'teardown', 'add', () => __ΩExclude, () => __ɵΩTeardownLogic, 'remove', () => __ΩSubscriptionLike, 'Subscription', 'P7!3"s)3#PPP$/$-J2%8"0&P$0\\'Pn(2)$0*Pn,$o+#2)$0-5n.x"w/y'];
        exports.__ɵΩSubscription = __ɵΩSubscription;
        const __ɵΩSubscribable = ['T', () => __ΩPartial, () => __ɵΩObserver, 'observer', () => __ɵΩUnsubscribable, 'subscribe', 'b!PPe#!o#"o""2$n%1&My'];
        exports.__ɵΩSubscribable = __ɵΩSubscribable;
        const __ɵΩSubscriber = ['T', () => Subscription_2.Subscription, 'x', '', 'next', 'e', 'error', 'complete', () => __ɵΩSubscriber, 'create', 'isStopped', () => __ɵΩSubscriber, () => __ɵΩObserver, 'destination', () => __ɵΩSubscriber, () => __ɵΩObserver, 'constructor', 'value', 'err', 'unsubscribe', '_next', '_error', '_complete', () => __ɵΩObserver, 'Subscriber', 'b!P7"PPe#!2#8$/$2%8P"2&8$/$2\\'8P$/$2(8Pe#!7)0*s)3+<PP"7,"o-"J3.<PPP"7/"o0"J2.8"01Pe"!228$0%P"238$0\\'P$0(P$04Pe"!22$05<P"23$06<P$07<5e!!o8"x"w9y'];
        exports.__ɵΩSubscriber = __ɵΩSubscriber;
        const __ɵΩSubscription = [() => __ɵΩSubscription, 'EMPTY', 'closed', '', 'initialTeardown', 'constructor', 'unsubscribe', () => __ɵΩTeardownLogic, 'teardown', 'add', () => __ΩExclude, () => __ɵΩTeardownLogic, 'remove', () => __ɵΩSubscriptionLike, 'Subscription', 'P7!3"s)3#PPP$/$-J2%8"0&P$0\\'Pn(2)$0*Pn,$o+#2)$0-5n.x"w/y'];
        exports.__ɵΩSubscription = __ɵΩSubscription;
        const __ɵΩUnsubscribable = ['unsubscribe', 'PP$1!My'];
        exports.__ɵΩUnsubscribable = __ɵΩUnsubscribable;
        const __ΩExclude = ['T', 'U', 'l6!Re$!RPe#!e$"qk#%QRb!b"Pde"!p)y'];
        const __ɵΩSubscriptionLike = [() => __ɵΩUnsubscribable, 'unsubscribe', 'closed', 'Pn!P$1")4#9My'];
        exports.__ɵΩSubscriptionLike = __ɵΩSubscriptionLike;
        function __assignType(fn, args) {
            fn.__type = args;
            return fn;
        }
        const rxjs_1 = require("rxjs");
        const __ΩA = [() => __assignType(rxjs_1.Observable, __ɵΩObservable), 'P#7!y'];
        "
    `);
})

test('runtime type name clashing', () => {
    const res = transpile({
        app: `import { Observable } from 'rxjs';

            type Subscribable = any;

            type A = Observable<unknown>;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['Observable'],
        },
    });

    expect(res.app).toContain('const __ɵΩSubscribable = [');
    expect(res.app).toContain('const __ΩSubscribable = [');
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
