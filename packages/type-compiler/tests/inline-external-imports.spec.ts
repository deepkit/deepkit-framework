import { test, expect } from '@jest/globals';

import { transpile, transpileAndRun } from './utils';

test('symbol type var', () => {
    const res = transpile({
        app: `import { config } from 'rxjs';

            type A = typeof config;
        `
    }, undefined, {
        inlineExternalImports: {
            'rxjs': ['config'],
        },
    });

    expect(res.app).toContain('const __Ωconfig = [');
    expect(res.app).toContain('() => __assignType(rxjs_1.config, __Ωconfig)');
});

test('symbol typeOf', () => {
    const res = transpileAndRun({
        app: `import { typeOf } from '@deepkit/type';
            import { config } from 'rxjs';

            typeOf<typeof config>();
        `
    }, undefined, {
        inlineExternalImports: {
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
                  "kind": 23,
                  "types": [
                    {
                      "function": [Function],
                      "kind": 17,
                      "name": "",
                      "parameters": [],
                      "return": {
                        "kind": 1,
                      },
                    },
                    {
                      "jit": {},
                      "kind": 5,
                      "origin": {
                        "kind": 13,
                        "literal": "n!",
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
    `);
});

test('function type var', () => {
    const res = transpile({
        app: `import { map } from 'rxjs/operators';

            type A = typeof map;
        `
    }, undefined, {
        inlineExternalImports: {
            'rxjs/operators': ['map'],
        },
    });

    expect(res.app).toContain('const __Ωmap = [');
    expect(res.app).toContain('() => __assignType(operators_1.map, __Ωmap)');
});

test('function typeOf', () => {
    const res = transpileAndRun({
        app: `import { map } from 'rxjs/operators';
            import { typeOf } from '@deepkit/type';

            typeOf<typeof map>();
        `
    }, undefined, {
        inlineExternalImports: {
            'rxjs/operators': ['map'],
        },
    });

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
        inlineExternalImports: {
            'rxjs': ['Observable'],
        },
    });

    expect(res.app).toContain('const __ΩObservable = [');
    expect(res.app).toContain('() => __assignType(rxjs_1.Observable, __ΩObservable)');
})
test('class typeOf', () => {
    const res = transpileAndRun({
        app: `import { Observable } from 'rxjs';
            import { typeOf } from '@deepkit/type';

            typeOf<Observable>();
        `
    }, undefined, {
        inlineExternalImports: {
            'rxjs': ['Subject'],
        },
    });

    expect(res).toMatchInlineSnapshot(`
        {
          "classType": [Function],
          "kind": 20,
          "typeArguments": [],
          "typeName": undefined,
          "types": [],
        }
    `);
})

test('only a single type is transformed', () => {
    const res = transpile({
        app: `import { ConfigEnv, CorsOrigin } from 'vite';

            type A = ConfigEnv;

            type B = CorsOrigin;
        `
    }, undefined, {
        inlineExternalImports: {
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
        inlineExternalImports: {
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
        inlineExternalImports: {
            'vite': true,
        },
    });

    expect(res.app).toContain('const __ΩConfigEnv = [');
    expect(res.app).toContain('const __ΩCorsOrigin = [');
});
