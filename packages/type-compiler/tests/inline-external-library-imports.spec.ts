import { test, expect } from '@jest/globals';
import {ReflectionKind, TypeClass, TypeFunction, } from '@deepkit/type';

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
          ],
        }
    `);
});

test('declares scoped variable', () => {
    const res = transpile({
        app: `import { map } from 'rxjs/operators';

            type A = typeof map;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs/operators': ['map'],
        },
    });

    expect(res.app).toContain('__ɵΩrxjs_operators = {}');
})

test('function type alias', () => {
    const res = transpile({
        app: `import { map } from 'rxjs';

            type A = typeof map;
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['map'],
        },
    });

    expect(res.app).toContain('__ɵΩrxjs_operators.Ωmap = [');
    expect(res.app).toContain('() => __ɵΩrxjs_operators.Ωmap)');
});

test('typeOf function type alias', () => {
    const res = transpileAndRun({
        app: `import { map } from 'rxjs';
            import { typeOf } from '@deepkit/type';

            typeOf<typeof map>();
        `
    }, undefined, {
        inlineExternalLibraryImports: {
            'rxjs': ['map'],
        },
    }) as TypeFunction;

    expect(res.return.kind).not.toBe(ReflectionKind.never);

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
          "annotations": {},
          "id": 4,
          "implements": [
            {
              "annotations": {},
              "id": 2,
              "kind": 30,
              "typeArguments": [
                {
                  "classType": undefined,
                  "external": true,
                  "kind": 20,
                  "parent": {
                    "kind": 18,
                    "name": "source",
                    "parent": {
                      "kind": 35,
                      "parameters": [
                        [Circular],
                      ],
                      "parent": [Circular],
                      "return": {
                        "classType": undefined,
                        "external": true,
                        "kind": 20,
                        "parent": [Circular],
                        "typeArguments": [
                          {
                            "kind": 1,
                          },
                        ],
                        "types": [],
                      },
                    },
                    "type": [Circular],
                  },
                  "typeArguments": [
                    {
                      "kind": 1,
                    },
                  ],
                  "types": [],
                },
                {
                  "classType": undefined,
                  "external": true,
                  "kind": 20,
                  "parent": {
                    "kind": 35,
                    "parameters": [
                      {
                        "kind": 18,
                        "name": "source",
                        "parent": [Circular],
                        "type": {
                          "classType": undefined,
                          "external": true,
                          "kind": 20,
                          "parent": [Circular],
                          "typeArguments": [
                            {
                              "kind": 1,
                            },
                          ],
                          "types": [],
                        },
                      },
                    ],
                    "parent": [Circular],
                    "return": [Circular],
                  },
                  "typeArguments": [
                    {
                      "kind": 1,
                    },
                  ],
                  "types": [],
                },
              ],
              "typeName": "UnknownTypeName:() => __ɵΩrxjs.UnaryFunction",
              "types": [
                {
                  "kind": 35,
                  "parameters": [
                    {
                      "kind": 18,
                      "name": "source",
                      "parent": [Circular],
                      "type": {
                        "classType": undefined,
                        "external": true,
                        "kind": 20,
                        "parent": [Circular],
                        "typeArguments": [
                          {
                            "kind": 1,
                          },
                        ],
                        "types": [],
                      },
                    },
                  ],
                  "parent": [Circular],
                  "return": {
                    "classType": undefined,
                    "external": true,
                    "kind": 20,
                    "parent": [Circular],
                    "typeArguments": [
                      {
                        "kind": 1,
                      },
                    ],
                    "types": [],
                  },
                },
              ],
            },
          ],
          "kind": 30,
          "parent": [Circular],
          "typeArguments": [
            {
              "kind": 1,
            },
            {
              "kind": 1,
            },
          ],
          "typeName": "UnknownTypeName:() => __ɵΩrxjs.OperatorFunction",
          "types": [
            {
              "kind": 35,
              "parameters": [
                {
                  "kind": 18,
                  "name": "source",
                  "parent": [Circular],
                  "type": {
                    "classType": undefined,
                    "external": true,
                    "kind": 20,
                    "parent": [Circular],
                    "typeArguments": [
                      {
                        "kind": 1,
                      },
                    ],
                    "types": [],
                  },
                },
              ],
              "parent": [Circular],
              "return": {
                "classType": undefined,
                "external": true,
                "kind": 20,
                "parent": [Circular],
                "typeArguments": [
                  {
                    "kind": 1,
                  },
                ],
                "types": [],
              },
            },
          ],
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
    "annotations": {},
    "id": 4,
    "implements": [
      {
        "annotations": {},
        "id": 2,
        "kind": 30,
        "typeArguments": [
          {
            "classType": undefined,
            "external": true,
            "kind": 20,
            "parent": {
              "kind": 18,
              "name": "source",
              "parent": {
                "kind": 35,
                "parameters": [
                  [Circular],
                ],
                "parent": [Circular],
                "return": {
                  "classType": undefined,
                  "external": true,
                  "kind": 20,
                  "parent": [Circular],
                  "typeArguments": [
                    {
                      "kind": 1,
                    },
                  ],
                  "types": [],
                },
              },
              "type": [Circular],
            },
            "typeArguments": [
              {
                "kind": 1,
              },
            ],
            "types": [],
          },
          {
            "classType": undefined,
            "external": true,
            "kind": 20,
            "parent": {
              "kind": 35,
              "parameters": [
                {
                  "kind": 18,
                  "name": "source",
                  "parent": [Circular],
                  "type": {
                    "classType": undefined,
                    "external": true,
                    "kind": 20,
                    "parent": [Circular],
                    "typeArguments": [
                      {
                        "kind": 1,
                      },
                    ],
                    "types": [],
                  },
                },
              ],
              "parent": [Circular],
              "return": [Circular],
            },
            "typeArguments": [
              {
                "kind": 1,
              },
            ],
            "types": [],
          },
        ],
        "typeName": "UnknownTypeName:() => __ɵΩrxjs.UnaryFunction",
        "types": [
          {
            "kind": 35,
            "parameters": [
              {
                "kind": 18,
                "name": "source",
                "parent": [Circular],
                "type": {
                  "classType": undefined,
                  "external": true,
                  "kind": 20,
                  "parent": [Circular],
                  "typeArguments": [
                    {
                      "kind": 1,
                    },
                  ],
                  "types": [],
                },
              },
            ],
            "parent": [Circular],
            "return": {
              "classType": undefined,
              "external": true,
              "kind": 20,
              "parent": [Circular],
              "typeArguments": [
                {
                  "kind": 1,
                },
              ],
              "types": [],
            },
          },
        ],
      },
    ],
    "kind": 30,
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
    "typeArguments": [
      {
        "kind": 1,
      },
      {
        "kind": 1,
      },
    ],
    "typeName": "UnknownTypeName:() => __ɵΩrxjs.OperatorFunction",
    "types": [
      {
        "kind": 35,
        "parameters": [
          {
            "kind": 18,
            "name": "source",
            "parent": [Circular],
            "type": {
              "classType": undefined,
              "external": true,
              "kind": 20,
              "parent": [Circular],
              "typeArguments": [
                {
                  "kind": 1,
                },
              ],
              "types": [],
            },
          },
        ],
        "parent": [Circular],
        "return": {
          "classType": undefined,
          "external": true,
          "kind": 20,
          "parent": [Circular],
          "typeArguments": [
            {
              "kind": 1,
            },
          ],
          "types": [],
        },
      },
    ],
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

    expect(res.app).toMatchInlineSnapshot(`
""use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __ɵΩrxjs = {};
__ɵΩrxjs.Observable = ['T', () => __ɵΩrxjs.Observable, 'source', () => __ɵΩrxjs.Operator, 'operator', () => __ɵΩrxjs.Observable, 'this', () => __ɵΩrxjs.Subscriber, 'subscriber', () => __ɵΩrxjs.TeardownLogic, '', 'subscribe', 'constructor', 'args', 'create', () => __ɵΩrxjs.Operator, () => __ɵΩrxjs.Observable, 'lift', () => __ΩPartial, () => __ɵΩrxjs.Observer, 'observer', () => __ɵΩrxjs.Subscription, 'value', 'next', 'forEach', () => __ɵΩrxjs.Observable, 'pipe', 'toPromise', () => __ɵΩrxjs.Subscribable, 'Observable', 'b!PP"7"-J3#P"e"!o$#-J3%PPPe$!7&2\\'Pe$!7(2)n*/+2,8"0-P"@2."/+3/sPe"!"o0#2%8P"7102Pe"!o4"o3"258P760,PPe#!27$/+28$\`09PPe#!7:0;PPe#!-J\`0<5e!!o="x"w>y'];
const __ΩPartial = ['T', 'l+e#!e"!fRb!Pde"!gN#"y'];
__ɵΩrxjs.Operator = ['T', 'R', () => __ɵΩrxjs.Subscriber, 'subscriber', 'source', () => __ɵΩrxjs.TeardownLogic, 'call', 'b!b"PPPe$"7#2$"2%n&1\\'My'];
__ɵΩrxjs.Subscriber = ['T', 'x', '', 'next', 'e', 'error', 'complete', () => __ɵΩrxjs.Subscriber, 'create', 'isStopped', () => __ɵΩrxjs.Subscriber, () => __ɵΩrxjs.Observer, 'destination', () => __ɵΩrxjs.Subscriber, () => __ɵΩrxjs.Observer, 'constructor', 'value', 'err', 'unsubscribe', '_next', '_error', '_complete', () => __ɵΩrxjs.Observer, 'Subscriber', 'b!PPe#!2"8$/#2$8P"2%8$/#2&8P$/#2\\'8Pe#!7(0)s)3*<PP"7+"o,"J3-<PPP"7."o/"J2-8"00Pe"!218$0$P"228$0&P$0\\'P$03Pe"!21$04<P"22$05<P$06<5e!!o7"x"w8y'];
__ɵΩrxjs.TeardownLogic = [() => __ɵΩrxjs.Subscription, () => __ɵΩrxjs.Unsubscribable, '', 'PP7!n"P$/#$Jy'];
__ɵΩrxjs.Observer = ['T', 'value', '', 'next', 'err', 'error', 'complete', 'b!PPe#!2"$/#4$P"2%$/#4&P$/#4\\'My'];
__ɵΩrxjs.Subscription = [() => __ɵΩrxjs.Subscription, 'EMPTY', 'closed', '', 'initialTeardown', 'constructor', 'unsubscribe', () => __ɵΩrxjs.TeardownLogic, 'teardown', 'add', () => __ΩExclude, () => __ɵΩrxjs.TeardownLogic, 'remove', () => __ɵΩrxjs.SubscriptionLike, 'Subscription', 'P7!3"s)3#PPP$/$-J2%8"0&P$0\\'Pn(2)$0*Pn,$o+#2)$0-5n.x"w/y'];
__ɵΩrxjs.Subscribable = ['T', () => __ΩPartial, () => __ɵΩrxjs.Observer, 'observer', () => __ɵΩrxjs.Unsubscribable, 'subscribe', 'b!PPe#!o#"o""2$n%1&My'];
const __ΩExclude = ['T', 'U', 'l6!Re$!RPe#!e$"qk#%QRb!b"Pde"!p)y'];
__ɵΩrxjs.Unsubscribable = ['unsubscribe', 'PP$1!My'];
__ɵΩrxjs.SubscriptionLike = [() => __ɵΩrxjs.Unsubscribable, 'unsubscribe', 'closed', 'Pn!P$1")4#9My'];
function __assignType(fn, args) {
    fn.__type = args;
    return fn;
}
const rxjs_1 = require("rxjs");
const __ΩA = [() => __assignType(rxjs_1.Observable, __ɵΩrxjs.Observable), 'P#7!y'];
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

    expect(res.app).toContain('__ɵΩrxjs.Subscribable = [');
    expect(res.app).toContain('const __ΩSubscribable = [');
});

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

    console.log(res);

    expect(res).toMatchObject({
        external: true,
        classType: undefined,
    });

    expect(res.implements![0]).toMatchObject({
        kind: 30,
        typeName: 'Subscribable',
        // typeName: 'UnknownTypeName:() => __ɵΩrxjs.Subscribable',
    });
    // expect(res.typeArguments).toHaveLength(1);
    // expect(res.types).toHaveLength(1);
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

    expect(res.app).toContain('__ɵΩvite.ConfigEnv = [');
    expect(res.app).not.toContain('__ɵΩvite.CorsOrigin = [');
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

    expect(res.app).toContain('__ɵΩvite.ConfigEnv = [');
    expect(res.app).toContain('__ɵΩvite.CorsOrigin = [');
});
