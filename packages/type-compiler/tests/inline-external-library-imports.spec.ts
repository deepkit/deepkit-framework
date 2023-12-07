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

import { map } from 'rxjs';

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
          "id": 6,
          "implements": [
            {
              "annotations": {},
              "id": 4,
              "kind": 30,
              "typeArguments": [
                {
                  "annotations": {},
                  "id": 1,
                  "kind": 30,
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
                        "annotations": {},
                        "id": 2,
                        "kind": 30,
                        "parent": [Circular],
                        "types": [],
                      },
                    },
                    "type": [Circular],
                  },
                  "types": [],
                },
                {
                  "annotations": {},
                  "id": 2,
                  "kind": 30,
                  "parent": {
                    "kind": 35,
                    "parameters": [
                      {
                        "kind": 18,
                        "name": "source",
                        "parent": [Circular],
                        "type": {
                          "annotations": {},
                          "id": 1,
                          "kind": 30,
                          "parent": [Circular],
                          "types": [],
                        },
                      },
                    ],
                    "parent": [Circular],
                    "return": [Circular],
                  },
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
                        "annotations": {},
                        "id": 1,
                        "kind": 30,
                        "parent": [Circular],
                        "types": [],
                      },
                    },
                  ],
                  "parent": [Circular],
                  "return": {
                    "annotations": {},
                    "id": 2,
                    "kind": 30,
                    "parent": [Circular],
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
                    "annotations": {},
                    "id": 1,
                    "kind": 30,
                    "parent": [Circular],
                    "types": [],
                  },
                },
              ],
              "parent": [Circular],
              "return": {
                "annotations": {},
                "id": 2,
                "kind": 30,
                "parent": [Circular],
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
    "id": 6,
    "implements": [
      {
        "annotations": {},
        "id": 4,
        "kind": 30,
        "typeArguments": [
          {
            "annotations": {},
            "id": 1,
            "kind": 30,
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
                  "annotations": {},
                  "id": 2,
                  "kind": 30,
                  "parent": [Circular],
                  "types": [],
                },
              },
              "type": [Circular],
            },
            "types": [],
          },
          {
            "annotations": {},
            "id": 2,
            "kind": 30,
            "parent": {
              "kind": 35,
              "parameters": [
                {
                  "kind": 18,
                  "name": "source",
                  "parent": [Circular],
                  "type": {
                    "annotations": {},
                    "id": 1,
                    "kind": 30,
                    "parent": [Circular],
                    "types": [],
                  },
                },
              ],
              "parent": [Circular],
              "return": [Circular],
            },
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
                  "annotations": {},
                  "id": 1,
                  "kind": 30,
                  "parent": [Circular],
                  "types": [],
                },
              },
            ],
            "parent": [Circular],
            "return": {
              "annotations": {},
              "id": 2,
              "kind": 30,
              "parent": [Circular],
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
              "annotations": {},
              "id": 1,
              "kind": 30,
              "parent": [Circular],
              "types": [],
            },
          },
        ],
        "parent": [Circular],
        "return": {
          "annotations": {},
          "id": 2,
          "kind": 30,
          "parent": [Circular],
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
__ɵΩrxjs.Observable = ['source', () => __ɵΩrxjs.Operator, 'operator', 'this', 'subscriber', () => __ɵΩrxjs.TeardownLogic, '', 'subscribe', 'new', 'args', 'create', () => __ɵΩrxjs.Operator, 'lift', () => __ΩPartial, () => __ɵΩrxjs.Observer, 'observer', 'value', 'next', 'error', 'complete', 'forEach', () => __ΩPromiseConstructorLike, 'promiseCtor', 'pipe', () => __ɵΩrxjs.OperatorFunction, 'op1', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op2', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op3', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op4', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op5', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op6', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op7', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op8', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'op9', () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, () => __ɵΩrxjs.OperatorFunction, 'operations', 'toPromise', () => Promise, 'PromiseCtor', () => __ΩPromiseConstructorLike, 'PPP"M-J4!P"!o"#-J4#PPP!M2$P!M2%n&/\\'2(8"1)P"@2*"/\\'4+P!"o,#2#8P"M1-P!o/"o."208PM1(PP!21$/\\'22PM1(PPP!21$/\\',J228PP"23$/\\',J238PP$/\\',J248PM1(PP!21$/\\'22$\`15PP!21$/\\'22n627$\`15PP!M18P!"o9#2:P"M18P!"o;#2:""o<#2=P"M18P!"o>#2:""o?#2=""o@#2AP"M18P!"oB#2:""oC#2=""oD#2A""oE#2FP"M18P!"oG#2:""oH#2=""oI#2A""oJ#2F""oK#2LP"M18P!"oM#2:""oN#2=""oO#2A""oP#2F""oQ#2L""oR#2SP"M18P!"oT#2:""oU#2=""oV#2A""oW#2F""oX#2L""oY#2S""oZ#2[P"M18P!"o\\\\#2:""o]#2=""o^#2A""o_#2F""o\`#2L""oa#2S""ob#2[""oc#2dP"M18P!"oe#2:""of#2=""og#2A""oh#2F""oi#2L""oj#2S""ok#2[""ol#2d""om#2nP"M18P!"oo#2:""op#2=""oq#2A""or#2F""os#2L""ot#2S""ou#2[""ov#2d""ow#2n""ox#@2yP#M18PP!-J\`1zPi{2|P!-J\`1zPn}2|P!-J\`1zMy'];
const __ΩPartial = ['T', 'l+e#!e"!fRb!Pde"!gN#"y'];
const __ΩPromiseConstructorLike = [() => __ΩPromiseLike, 'value', '', 'resolve', 'reason', 'reject', 'executor', () => __ΩPromiseLike, 'new', 'PPPP""o!"J2"$/#2$P"2%8$/#2&$/#2\\'"o("/)y'];
__ɵΩrxjs.Operator = ['T', 'R', 'subscriber', 'source', () => __ɵΩrxjs.TeardownLogic, 'call', 'b!b"PPPe$"M2#"2$n%1&My'];
__ɵΩrxjs.Subscriber = ['x', '', 'next', 'e', 'error', 'complete', 'create', 'isStopped', () => __ɵΩrxjs.Observer, 'destination', () => __ɵΩrxjs.Observer, 'new', 'value', 'err', 'unsubscribe', '_next', '_error', '_complete', 'PPMPP"2!8$/"2#8P"2$8$/"2%8P$/"2&8P"M1\\')4(PP"M"o)"J4*PPP"M"o+"J2*8"1,P!2-8$1#P"2.8$1%P$1&P$1/P!2-$10P"2.$11P$12My'];
__ɵΩrxjs.TeardownLogic = [() => __ɵΩrxjs.Unsubscribable, '', 'PPMn!P$/"$Jy'];
__ɵΩrxjs.Observer = ['T', 'value', '', 'next', 'err', 'error', 'complete', 'b!PPe#!2"$/#4$P"2%$/#4&P$/#4\\'My'];
__ɵΩrxjs.Subscription = ['EMPTY', 'closed', '', 'initialTeardown', 'new', 'unsubscribe', () => __ɵΩrxjs.TeardownLogic, 'teardown', 'add', () => __ΩExclude, () => __ɵΩrxjs.TeardownLogic, 'remove', 'PPM4!)4"PPP$/#-J2$8"1%P$1&Pn\\'2($1)Pn+$o*#2($1,My'];
__ɵΩrxjs.OperatorFunction = ['T', 'R', () => __ɵΩrxjs.UnaryFunction, 'b!b"PPe#!MPe#"Mo##My'];
const __ΩPromiseLike = ['T', 'value', 0, '', 'onfulfilled', 'reason', 0, 'onrejected', 0, 'then', 'b!PPPPe%!2"P""o#"J/$-,J2%8PP"2&P""o\\'"J/$-,J2(8P""Jo)"1*My'];
const __ΩExclude = ['T', 'U', 'l6!Re$!RPe#!e$"qk#%QRb!b"Pde"!p)y'];
__ɵΩrxjs.Unsubscribable = ['unsubscribe', 'PP$1!My'];
__ɵΩrxjs.UnaryFunction = ['T', 'R', 'source', '', 'b!b"PPe#!2#e#"v$My'];
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

    expect(res.implements![0]).toMatchObject({
        kind: 30,
        typeName: 'Subscribable',
        // typeName: 'UnknownTypeName:() => __ɵΩrxjs.Subscribable',
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
