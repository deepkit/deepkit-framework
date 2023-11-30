import { test, expect } from '@jest/globals';
import { isCustomTypeClass } from '@deepkit/type';

import { transpile, transpileAndRun } from './utils';
test('class type', () => {
    const res = transpile({
        app: `import { Observable } from 'rxjs';

            type A = Observable<unknown>;
        `
    }, undefined, {
        external: {
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
        external: {
            'rxjs': ['Subject'],
        },
    });

    expect(isCustomTypeClass(res)).toBe(true);
})

// Not supported yet
test.todo('function'/*, () => {
    const res = transpileAndRun({
        app: `import { preview } from 'vite';
            import { typeOf } from '@deepkit/type';

            typeOf<typeof preview>();
        `
    }, undefined, {
        external: {
            'vite': ['preview'],
        },
    });
}*/)

test('only a single type is transformed', () => {
    const res = transpile({
        app: `import { ConfigEnv, CorsOrigin } from 'vite';

            type A = ConfigEnv;

            type B = CorsOrigin;
        `
    }, undefined, {
        external: {
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
        external: {
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

test('all exports marked as external', () => {
    const res = transpile({
        app: `import { ConfigEnv, CorsOrigin } from 'vite';
            import { typeOf } from '@deepkit/type';

            type A = ConfigEnv;
            type B = CorsOrigin;
        `
    }, undefined, {
        external: {
            'vite': '*',
        },
    });
    expect(res.app).toContain('const __ΩConfigEnv = [');
    expect(res.app).toContain('const __ΩCorsOrigin = [');
});
