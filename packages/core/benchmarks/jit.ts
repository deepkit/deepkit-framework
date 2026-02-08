import { BenchSuite } from '@deepkit/bench';

import { arg, fnExec, fnJIT } from '../src/jit.js';

// ============================================================================
// Test Data
// ============================================================================

const simpleObject = { id: 1, name: 'John', email: 'john@example.com' };

const mediumObject = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    active: true,
    score: 95.5,
    tags: ['developer', 'typescript', 'nodejs'],
    address: {
        street: '123 Main St',
        city: 'New York',
        zip: '10001',
        country: 'USA',
    },
};

const largeObject = {
    id: 1,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    age: 30,
    active: true,
    verified: true,
    score: 95.5,
    rating: 4.8,
    balance: 1234.56,
    tags: ['developer', 'typescript', 'nodejs', 'react', 'graphql'],
    roles: ['admin', 'user', 'moderator'],
    permissions: ['read', 'write', 'delete', 'admin'],
    address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
        coordinates: { lat: 40.7128, lng: -74.006 },
    },
    company: {
        name: 'Tech Corp',
        industry: 'Technology',
        employees: 500,
        public: true,
    },
    metadata: {
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-15T12:30:00Z',
        version: 42,
        source: 'api',
    },
};

const arrayOfObjects = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    active: i % 2 === 0,
}));

// ============================================================================
// Benchmark 1: Simple Property Copy (3 properties)
// ============================================================================

const simpleProps = ['id', 'name', 'email'] as const;

// JIT mode with object syntax (cleanest)
const simpleSerializerJIT = fnJIT(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        email: input.get('email'),
    });
});

// JIT mode with dynamic props (loop unrolling)
const simpleSerializerJITLoop = fnJIT(arg<any>(), (b, input) => {
    return b.obj(simpleProps.map(prop => [prop, input.get(prop)] as [string, any]));
});

// Exec mode
const simpleSerializerExec = fnExec(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        email: input.get('email'),
    });
});

// Baseline: hand-written
function simpleSerializerBaseline(input: any): any {
    return {
        id: input.id,
        name: input.name,
        email: input.email,
    };
}

// ============================================================================
// Benchmark 2: Medium Object (10 properties, nested)
// ============================================================================

// JIT mode with object syntax and chained .get()
const mediumSerializerJIT = fnJIT(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        email: input.get('email'),
        age: input.get('age'),
        active: input.get('active'),
        score: input.get('score'),
        tags: input.get('tags'),
        address: b.obj({
            street: input.get('address').get('street'),
            city: input.get('address').get('city'),
            zip: input.get('address').get('zip'),
            country: input.get('address').get('country'),
        }),
    });
});

// Exec mode
const mediumSerializerExec = fnExec(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        name: input.get('name'),
        email: input.get('email'),
        age: input.get('age'),
        active: input.get('active'),
        score: input.get('score'),
        tags: input.get('tags'),
        address: b.obj({
            street: input.get('address').get('street'),
            city: input.get('address').get('city'),
            zip: input.get('address').get('zip'),
            country: input.get('address').get('country'),
        }),
    });
});

// Baseline
function mediumSerializerBaseline(input: any): any {
    return {
        id: input.id,
        name: input.name,
        email: input.email,
        age: input.age,
        active: input.active,
        score: input.score,
        tags: input.tags,
        address: {
            street: input.address.street,
            city: input.address.city,
            zip: input.address.zip,
            country: input.address.country,
        },
    };
}

// ============================================================================
// Benchmark 3: Large Object (20+ properties, deeply nested)
// ============================================================================

// JIT mode with object syntax and deep chaining
const largeSerializerJIT = fnJIT(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        uuid: input.get('uuid'),
        name: input.get('name'),
        email: input.get('email'),
        phone: input.get('phone'),
        age: input.get('age'),
        active: input.get('active'),
        verified: input.get('verified'),
        score: input.get('score'),
        rating: input.get('rating'),
        balance: input.get('balance'),
        tags: input.get('tags'),
        roles: input.get('roles'),
        permissions: input.get('permissions'),
        address: b.obj({
            street: input.get('address').get('street'),
            city: input.get('address').get('city'),
            state: input.get('address').get('state'),
            zip: input.get('address').get('zip'),
            country: input.get('address').get('country'),
            coordinates: b.obj({
                lat: input.get('address').get('coordinates').get('lat'),
                lng: input.get('address').get('coordinates').get('lng'),
            }),
        }),
        company: b.obj({
            name: input.get('company').get('name'),
            industry: input.get('company').get('industry'),
            employees: input.get('company').get('employees'),
            public: input.get('company').get('public'),
        }),
        metadata: b.obj({
            createdAt: input.get('metadata').get('createdAt'),
            updatedAt: input.get('metadata').get('updatedAt'),
            version: input.get('metadata').get('version'),
            source: input.get('metadata').get('source'),
        }),
    });
});

// Exec mode
const largeSerializerExec = fnExec(arg<any>(), (b, input) => {
    return b.obj({
        id: input.get('id'),
        uuid: input.get('uuid'),
        name: input.get('name'),
        email: input.get('email'),
        phone: input.get('phone'),
        age: input.get('age'),
        active: input.get('active'),
        verified: input.get('verified'),
        score: input.get('score'),
        rating: input.get('rating'),
        balance: input.get('balance'),
        tags: input.get('tags'),
        roles: input.get('roles'),
        permissions: input.get('permissions'),
        address: b.obj({
            street: input.get('address').get('street'),
            city: input.get('address').get('city'),
            state: input.get('address').get('state'),
            zip: input.get('address').get('zip'),
            country: input.get('address').get('country'),
            coordinates: b.obj({
                lat: input.get('address').get('coordinates').get('lat'),
                lng: input.get('address').get('coordinates').get('lng'),
            }),
        }),
        company: b.obj({
            name: input.get('company').get('name'),
            industry: input.get('company').get('industry'),
            employees: input.get('company').get('employees'),
            public: input.get('company').get('public'),
        }),
        metadata: b.obj({
            createdAt: input.get('metadata').get('createdAt'),
            updatedAt: input.get('metadata').get('updatedAt'),
            version: input.get('metadata').get('version'),
            source: input.get('metadata').get('source'),
        }),
    });
});

// Baseline
function largeSerializerBaseline(input: any): any {
    return {
        id: input.id,
        uuid: input.uuid,
        name: input.name,
        email: input.email,
        phone: input.phone,
        age: input.age,
        active: input.active,
        verified: input.verified,
        score: input.score,
        rating: input.rating,
        balance: input.balance,
        tags: input.tags,
        roles: input.roles,
        permissions: input.permissions,
        address: {
            street: input.address.street,
            city: input.address.city,
            state: input.address.state,
            zip: input.address.zip,
            country: input.address.country,
            coordinates: {
                lat: input.address.coordinates.lat,
                lng: input.address.coordinates.lng,
            },
        },
        company: {
            name: input.company.name,
            industry: input.company.industry,
            employees: input.company.employees,
            public: input.company.public,
        },
        metadata: {
            createdAt: input.metadata.createdAt,
            updatedAt: input.metadata.updatedAt,
            version: input.metadata.version,
            source: input.metadata.source,
        },
    };
}

// ============================================================================
// Benchmark 4: Array Iteration (100 items)
// ============================================================================

// JIT mode with map + obj
const arraySerializerJIT = fnJIT(arg<any[]>(), (b, input) => {
    return b.map(input, elem => {
        return b.obj({
            id: elem.get('id'),
            name: elem.get('name'),
            active: elem.get('active'),
        });
    });
});

// Exec mode
const arraySerializerExec = fnExec(arg<any[]>(), (b, input) => {
    return b.map(input, elem => {
        return b.obj({
            id: elem.get('id'),
            name: elem.get('name'),
            active: elem.get('active'),
        });
    });
});

// Baseline
function arraySerializerBaseline(input: any[]): any[] {
    return input.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
    }));
}

// ============================================================================
// Benchmark 5: Validation with conditionals
// ============================================================================

const isNonEmpty = (v: any) => typeof v === 'string' && v.length > 0;
const isPositive = (v: any) => typeof v === 'number' && v > 0;
const isEmail = (v: any) => typeof v === 'string' && v.includes('@');

const validationRules = [
    { prop: 'name', check: isNonEmpty, msg: 'name required' },
    { prop: 'email', check: isEmail, msg: 'invalid email' },
    { prop: 'id', check: isPositive, msg: 'id must be positive' },
] as const;

// JIT mode
const validatorJIT = fnJIT(arg<any>(), (b, input) => {
    const errors = b.let(b.emptyArr());
    for (const rule of validationRules) {
        const valid = b.call(rule.check, input.get(rule.prop));
        b.if_(b.not(valid), () => {
            b.push(errors, b.lit(rule.msg));
        });
    }
    return errors;
});

// Exec mode
const validatorExec = fnExec(arg<any>(), (b, input) => {
    const errors = b.let(b.emptyArr());
    for (const rule of validationRules) {
        const valid = b.call(rule.check, input.get(rule.prop));
        b.if_(b.not(valid), () => {
            b.push(errors, b.lit(rule.msg));
        });
    }
    return errors;
});

// Baseline
function validatorBaseline(input: any): string[] {
    const errors: string[] = [];
    for (const rule of validationRules) {
        if (!rule.check(input[rule.prop])) {
            errors.push(rule.msg);
        }
    }
    return errors;
}

// ============================================================================
// Benchmark 6: Type checking with guards
// ============================================================================

// JIT mode
const typeGuardJIT = fnJIT(arg<any>(), (b, input) => {
    b.if_(b.isNullish(input), () => b.lit(false));
    b.if_(b.not(b.isType(input, 'object')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'id')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('id'), 'number')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'name')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('name'), 'string')), () => b.lit(false));
    return b.lit(true);
});

// Exec mode
const typeGuardExec = fnExec(arg<any>(), (b, input) => {
    b.if_(b.isNullish(input), () => b.lit(false));
    b.if_(b.not(b.isType(input, 'object')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'id')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('id'), 'number')), () => b.lit(false));
    b.if_(b.not(b.has(input, 'name')), () => b.lit(false));
    b.if_(b.not(b.isType(input.get('name'), 'string')), () => b.lit(false));
    return b.lit(true);
});

// Baseline
function typeGuardBaseline(input: any): boolean {
    if (input == null) return false;
    if (typeof input !== 'object') return false;
    if (!('id' in input)) return false;
    if (typeof input.id !== 'number') return false;
    if (!('name' in input)) return false;
    if (typeof input.name !== 'string') return false;
    return true;
}

// ============================================================================
// Benchmark 7: Class Instantiation with constructor args and property setting
// ============================================================================

class User {
    email: string = '';
    active: boolean = false;

    constructor(
        public id: number,
        public name: string,
    ) {}
}

// JIT mode
const classInstantiatorJIT = fnJIT(arg<any>(), (b, input) => {
    const instance = b.let(b.new_(User, input.get('id'), input.get('name')));
    b.set(instance, 'email', input.get('email'));
    b.set(instance, 'active', input.get('active'));
    return instance;
});

// Exec mode
const classInstantiatorExec = fnExec(arg<any>(), (b, input) => {
    const instance = b.let(b.new_(User, input.get('id'), input.get('name')));
    b.set(instance, 'email', input.get('email'));
    b.set(instance, 'active', input.get('active'));
    return instance;
});

// Baseline
function classInstantiatorBaseline(input: any): User {
    const instance = new User(input.id, input.name);
    instance.email = input.email;
    instance.active = input.active;
    return instance;
}

const classTestData = { id: 1, name: 'John', email: 'john@example.com', active: true };

// ============================================================================
// Run Benchmarks
// ============================================================================

async function main() {
    console.log('JIT vs Exec Mode Performance Comparison\n');
    console.log('Each benchmark runs for 1 second per variant.\n');

    // Simple serialization
    const simple = new BenchSuite('Simple Object (3 props)', 1, true);
    simple.add('baseline (hand-written)', () => simpleSerializerBaseline(simpleObject));
    simple.add('fnJIT (obj {})', () => simpleSerializerJIT(simpleObject));
    simple.add('fnJIT (loop)', () => simpleSerializerJITLoop(simpleObject));
    simple.add('fnExec', () => simpleSerializerExec(simpleObject));
    await simple.runAsync();

    // Medium serialization
    const medium = new BenchSuite('Medium Object (10 props, nested)', 1, true);
    medium.add('baseline (hand-written)', () => mediumSerializerBaseline(mediumObject));
    medium.add('fnJIT', () => mediumSerializerJIT(mediumObject));
    medium.add('fnExec', () => mediumSerializerExec(mediumObject));
    await medium.runAsync();

    // Large serialization
    const large = new BenchSuite('Large Object (20+ props, deep nesting)', 1, true);
    large.add('baseline (hand-written)', () => largeSerializerBaseline(largeObject));
    large.add('fnJIT', () => largeSerializerJIT(largeObject));
    large.add('fnExec', () => largeSerializerExec(largeObject));
    await large.runAsync();

    // Array iteration
    const array = new BenchSuite('Array of 100 Objects', 1, true);
    array.add('baseline (hand-written)', () => arraySerializerBaseline(arrayOfObjects));
    array.add('fnJIT', () => arraySerializerJIT(arrayOfObjects));
    array.add('fnExec', () => arraySerializerExec(arrayOfObjects));
    await array.runAsync();

    // Validation
    const validation = new BenchSuite('Validation (3 rules with conditionals)', 1, true);
    validation.add('baseline (hand-written)', () => validatorBaseline(simpleObject));
    validation.add('fnJIT', () => validatorJIT(simpleObject));
    validation.add('fnExec', () => validatorExec(simpleObject));
    await validation.runAsync();

    // Type guard
    const typeGuard = new BenchSuite('Type Guard (6 checks)', 1, true);
    typeGuard.add('baseline (hand-written)', () => typeGuardBaseline(simpleObject));
    typeGuard.add('fnJIT', () => typeGuardJIT(simpleObject));
    typeGuard.add('fnExec', () => typeGuardExec(simpleObject));
    await typeGuard.runAsync();

    // Class instantiation
    const classInst = new BenchSuite('Class Instantiation (2 ctor args + 2 props)', 1, true);
    classInst.add('baseline (hand-written)', () => classInstantiatorBaseline(classTestData));
    classInst.add('fnJIT', () => classInstantiatorJIT(classTestData));
    classInst.add('fnExec', () => classInstantiatorExec(classTestData));
    await classInst.runAsync();
}

main().catch(console.error);
