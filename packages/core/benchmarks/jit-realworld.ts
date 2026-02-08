import { BenchSuite } from '@deepkit/bench';

import { arg, fnExec, fnJIT } from '../src/jit.js';

/**
 * Real-world JIT benchmark scenarios based on actual Deepkit package usage patterns.
 *
 * These benchmarks simulate the operations performed by:
 * - @deepkit/type (serialization, validation, type guards, change detection)
 * - @deepkit/bson (binary serialization with TypedArrays)
 * - @deepkit/injector (dependency resolution, factory functions)
 * - @deepkit/http (request parsing, parameter extraction)
 * - @deepkit/sql (row-to-entity mapping)
 * - @deepkit/workflow (state machine dispatch)
 */

// ============================================================================
// Test Data
// ============================================================================

// Entity-like object (ORM pattern)
const userEntity = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    createdAt: new Date('2024-01-15'),
    address: {
        street: '123 Main St',
        city: 'New York',
        country: 'USA',
    },
    roles: ['admin', 'user'],
};

// HTTP request-like object
const httpRequest = {
    method: 'POST',
    path: '/api/users/123/posts/456',
    query: { page: '1', limit: '20', sort: 'createdAt' },
    headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token123',
        'x-request-id': 'req-abc-123',
    },
    body: { title: 'New Post', content: 'Hello world' },
};

// SQL row (array-based like database drivers return)
const sqlRow = [1, 'John Doe', 'john@example.com', 30, true, '2024-01-15T00:00:00Z'];

// Array of SQL rows (100 items)
const sqlRows = Array.from({ length: 100 }, (_, i) => [
    i + 1,
    `User ${i}`,
    `user${i}@example.com`,
    20 + (i % 50),
    i % 2 === 0,
    '2024-01-15T00:00:00Z',
]);

// Union type test data
const unionData = [
    { type: 'user', id: 1, name: 'John' },
    { type: 'admin', id: 2, permissions: ['read', 'write'] },
    { type: 'guest', sessionId: 'sess-123' },
];

// Snapshot comparison data (for change detection)
const snapshotOld = { id: 1, name: 'John', age: 30, active: true };
const snapshotNew = { id: 1, name: 'John', age: 31, active: true }; // age changed

// ============================================================================
// Scenario 1: @deepkit/type - Serialization with Type Transformations
// ============================================================================

const dateToString = (d: Date) => d.toISOString();
const stringToDate = (s: string) => new Date(s);

// JIT: Serialize entity with Date → string transformation
const typeSerializerJIT = fnJIT(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        email: input.get('email'),
        age: input.get('age'),
        createdAt: b.call(dateToString, input.get('createdAt')),
        address: b.obj({
            street: input.get('address').get('street'),
            city: input.get('address').get('city'),
            country: input.get('address').get('country'),
        }),
        roles: input.get('roles'),
    });
});

const typeSerializerExec = fnExec(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        email: input.get('email'),
        age: input.get('age'),
        createdAt: b.call(dateToString, input.get('createdAt')),
        address: b.obj({
            street: input.get('address').get('street'),
            city: input.get('address').get('city'),
            country: input.get('address').get('country'),
        }),
        roles: input.get('roles'),
    });
});

function typeSerializerBaseline(input: any): any {
    return {
        id: input.id,
        name: input.name,
        email: input.email,
        age: input.age,
        createdAt: dateToString(input.createdAt),
        address: {
            street: input.address.street,
            city: input.address.city,
            country: input.address.country,
        },
        roles: input.roles,
    };
}

// ============================================================================
// Scenario 2: @deepkit/type - Validation with Error Collection
// ============================================================================

const isString = (v: any) => typeof v === 'string';
const isNumber = (v: any) => typeof v === 'number';
const isEmail = (v: any) => typeof v === 'string' && v.includes('@');
const minLength = (len: number) => (v: any) => typeof v === 'string' && v.length >= len;
const min = (n: number) => (v: any) => typeof v === 'number' && v >= n;

const validationRules = [
    { path: 'name', check: minLength(1), msg: 'name is required' },
    { path: 'email', check: isEmail, msg: 'invalid email' },
    { path: 'age', check: min(0), msg: 'age must be non-negative' },
];

const typeValidatorJIT = fnJIT(arg<any>(), (b, input) => {
    const errors = b.let(b.emptyArr());
    for (const rule of validationRules) {
        const value = input.get(rule.path);
        const valid = b.call(rule.check, value);
        b.if_(b.not(valid), () => {
            b.push(
                errors,
                b.obj({
                    path: b.lit(rule.path),
                    message: b.lit(rule.msg),
                }),
            );
        });
    }
    return errors;
});

const typeValidatorExec = fnExec(arg<any>(), (b, input) => {
    const errors = b.let(b.emptyArr());
    for (const rule of validationRules) {
        const value = input.get(rule.path);
        const valid = b.call(rule.check, value);
        b.if_(b.not(valid), () => {
            b.push(
                errors,
                b.obj({
                    path: b.lit(rule.path),
                    message: b.lit(rule.msg),
                }),
            );
        });
    }
    return errors;
});

function typeValidatorBaseline(input: any): any[] {
    const errors: any[] = [];
    for (const rule of validationRules) {
        if (!rule.check(input[rule.path])) {
            errors.push({ path: rule.path, message: rule.msg });
        }
    }
    return errors;
}

// ============================================================================
// Scenario 3: @deepkit/sql - SQL Row to Entity Mapping
// ============================================================================

const columnMap = ['id', 'name', 'email', 'age', 'active', 'createdAt'];

const sqlMapperJIT = fnJIT(arg<any[]>(), (b, row) => {
    return b.obj({
        id: row.at(0),
        name: row.at(1),
        email: row.at(2),
        age: row.at(3),
        active: row.at(4),
        createdAt: b.call(stringToDate, row.at(5)),
    });
});

const sqlMapperExec = fnExec(arg<any[]>(), (b, row) => {
    return b.obj({
        id: row.at(0),
        name: row.at(1),
        email: row.at(2),
        age: row.at(3),
        active: row.at(4),
        createdAt: b.call(stringToDate, row.at(5)),
    });
});

function sqlMapperBaseline(row: any[]): any {
    return {
        id: row[0],
        name: row[1],
        email: row[2],
        age: row[3],
        active: row[4],
        createdAt: stringToDate(row[5]),
    };
}

// Batch mapping (100 rows)
const sqlBatchMapperJIT = fnJIT(arg<any[][]>(), (b, rows) => {
    return b.map(rows, row => {
        return b.obj({
            id: row.at(0),
            name: row.at(1),
            email: row.at(2),
            age: row.at(3),
            active: row.at(4),
            createdAt: b.call(stringToDate, row.at(5)),
        });
    });
});

const sqlBatchMapperExec = fnExec(arg<any[][]>(), (b, rows) => {
    return b.map(rows, row => {
        return b.obj({
            id: row.at(0),
            name: row.at(1),
            email: row.at(2),
            age: row.at(3),
            active: row.at(4),
            createdAt: b.call(stringToDate, row.at(5)),
        });
    });
});

function sqlBatchMapperBaseline(rows: any[][]): any[] {
    return rows.map(row => ({
        id: row[0],
        name: row[1],
        email: row[2],
        age: row[3],
        active: row[4],
        createdAt: stringToDate(row[5]),
    }));
}

// ============================================================================
// Scenario 4: @deepkit/http - Request Parameter Extraction
// ============================================================================

const parseInt_ = (s: string) => parseInt(s, 10);

const httpParamsJIT = fnJIT(arg<any>(), (b, req) => {
    return b.obj({
        method: req.get('method'),
        contentType: req.get('headers').get('content-type'),
        auth: req.get('headers').get('authorization'),
        page: b.call(parseInt_, req.get('query').get('page')),
        limit: b.call(parseInt_, req.get('query').get('limit')),
        sort: req.get('query').get('sort'),
        body: req.get('body'),
    });
});

const httpParamsExec = fnExec(arg<any>(), (b, req) => {
    return b.obj({
        method: req.get('method'),
        contentType: req.get('headers').get('content-type'),
        auth: req.get('headers').get('authorization'),
        page: b.call(parseInt_, req.get('query').get('page')),
        limit: b.call(parseInt_, req.get('query').get('limit')),
        sort: req.get('query').get('sort'),
        body: req.get('body'),
    });
});

function httpParamsBaseline(req: any): any {
    return {
        method: req.method,
        contentType: req.headers['content-type'],
        auth: req.headers.authorization,
        page: parseInt_(req.query.page),
        limit: parseInt_(req.query.limit),
        sort: req.query.sort,
        body: req.body,
    };
}

// ============================================================================
// Scenario 5: @deepkit/type - Type Guard with Multiple Checks
// ============================================================================

const typeGuardJIT = fnJIT(arg<any>(), (b, input) => {
    // Check if null/undefined
    b.if_(b.isNullish(input), () => b.lit(false));

    // Check if object
    b.if_(b.not(b.isType(input, 'object')), () => b.lit(false));

    // Check required properties exist and have correct types
    b.if_(b.not(b.has(input, 'id')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('id'), 'number')), () => b.lit(false));

    b.if_(b.not(b.has(input, 'name')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('name'), 'string')), () => b.lit(false));

    b.if_(b.not(b.has(input, 'email')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('email'), 'string')), () => b.lit(false));

    b.if_(b.not(b.has(input, 'age')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('age'), 'number')), () => b.lit(false));

    return b.lit(true);
});

const typeGuardExec = fnExec(arg<any>(), (b, input) => {
    b.if_(b.isNullish(input), () => b.lit(false));
    b.if_(b.not(b.isType(input, 'object')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'id')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('id'), 'number')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'name')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('name'), 'string')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'email')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('email'), 'string')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'age')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('age'), 'number')), () => b.lit(false));
    return b.lit(true);
});

function typeGuardBaseline(input: any): boolean {
    if (input == null) return false;
    if (typeof input !== 'object') return false;
    if (!('id' in input)) return false;
    if (typeof input.id !== 'number') return false;
    if (!('name' in input)) return false;
    if (typeof input.name !== 'string') return false;
    if (!('email' in input)) return false;
    if (typeof input.email !== 'string') return false;
    if (!('age' in input)) return false;
    if (typeof input.age !== 'number') return false;
    return true;
}

// ============================================================================
// Scenario 6: Change Detection (Snapshot Comparison)
// ============================================================================

const propsToCheck = ['id', 'name', 'age', 'active'];

const changeDetectorJIT = fnJIT(arg<any>(), arg<any>(), (b, oldObj, newObj) => {
    const changes = b.let(b.emptyArr());
    for (const prop of propsToCheck) {
        const oldVal = oldObj.get(prop);
        const newVal = newObj.get(prop);
        b.if_(b.neq(oldVal, newVal), () => {
            b.push(
                changes,
                b.obj({
                    prop: b.lit(prop),
                    old: oldVal,
                    new: newVal,
                }),
            );
        });
    }
    return changes;
});

const changeDetectorExec = fnExec(arg<any>(), arg<any>(), (b, oldObj, newObj) => {
    const changes = b.let(b.emptyArr());
    for (const prop of propsToCheck) {
        const oldVal = oldObj.get(prop);
        const newVal = newObj.get(prop);
        b.if_(b.neq(oldVal, newVal), () => {
            b.push(
                changes,
                b.obj({
                    prop: b.lit(prop),
                    old: oldVal,
                    new: newVal,
                }),
            );
        });
    }
    return changes;
});

function changeDetectorBaseline(oldObj: any, newObj: any): any[] {
    const changes: any[] = [];
    for (const prop of propsToCheck) {
        if (oldObj[prop] !== newObj[prop]) {
            changes.push({ prop, old: oldObj[prop], new: newObj[prop] });
        }
    }
    return changes;
}

// ============================================================================
// Run Benchmarks
// ============================================================================

async function main() {
    console.log('Real-World JIT Benchmark Scenarios\n');
    console.log('Simulating actual Deepkit package operations.\n');

    // Type Serialization
    const typeSer = new BenchSuite('@deepkit/type Serialization', 1, true);
    typeSer.add('baseline', () => typeSerializerBaseline(userEntity));
    typeSer.add('fnJIT', () => typeSerializerJIT(userEntity));
    typeSer.add('fnExec', () => typeSerializerExec(userEntity));
    await typeSer.runAsync();

    // Type Validation
    const typeVal = new BenchSuite('@deepkit/type Validation', 1, true);
    typeVal.add('baseline', () => typeValidatorBaseline(userEntity));
    typeVal.add('fnJIT', () => typeValidatorJIT(userEntity));
    typeVal.add('fnExec', () => typeValidatorExec(userEntity));
    await typeVal.runAsync();

    // SQL Row Mapping (single)
    const sqlSingle = new BenchSuite('@deepkit/sql Row Mapping (single)', 1, true);
    sqlSingle.add('baseline', () => sqlMapperBaseline(sqlRow));
    sqlSingle.add('fnJIT', () => sqlMapperJIT(sqlRow));
    sqlSingle.add('fnExec', () => sqlMapperExec(sqlRow));
    await sqlSingle.runAsync();

    // SQL Row Mapping (batch 100)
    const sqlBatch = new BenchSuite('@deepkit/sql Row Mapping (100 rows)', 1, true);
    sqlBatch.add('baseline', () => sqlBatchMapperBaseline(sqlRows));
    sqlBatch.add('fnJIT', () => sqlBatchMapperJIT(sqlRows));
    sqlBatch.add('fnExec', () => sqlBatchMapperExec(sqlRows));
    await sqlBatch.runAsync();

    // HTTP Parameter Extraction
    const httpParams = new BenchSuite('@deepkit/http Parameter Extraction', 1, true);
    httpParams.add('baseline', () => httpParamsBaseline(httpRequest));
    httpParams.add('fnJIT', () => httpParamsJIT(httpRequest));
    httpParams.add('fnExec', () => httpParamsExec(httpRequest));
    await httpParams.runAsync();

    // Type Guard
    const guard = new BenchSuite('@deepkit/type Type Guard', 1, true);
    guard.add('baseline', () => typeGuardBaseline(userEntity));
    guard.add('fnJIT', () => typeGuardJIT(userEntity));
    guard.add('fnExec', () => typeGuardExec(userEntity));
    await guard.runAsync();

    // Change Detection
    const changes = new BenchSuite('@deepkit/type Change Detection', 1, true);
    changes.add('baseline', () => changeDetectorBaseline(snapshotOld, snapshotNew));
    changes.add('fnJIT', () => changeDetectorJIT(snapshotOld, snapshotNew));
    changes.add('fnExec', () => changeDetectorExec(snapshotOld, snapshotNew));
    await changes.runAsync();
}

main().catch(console.error);
