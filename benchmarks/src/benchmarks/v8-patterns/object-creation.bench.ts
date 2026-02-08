/**
 * V8 Object Creation Patterns
 *
 * Tests different object creation and cloning methods used in deserialization.
 * Understanding hidden class allocation is crucial for optimal JIT code.
 *
 * Run: node --expose-gc --import @deepkit/run object-creation.bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

// Source objects for cloning tests
const smallObj = { a: 1, b: 'hello' };
const mediumObj = { a: 1, b: 'hello', c: true, d: 42.5, e: null };
const largeObj = {
    a: 1,
    b: 'hello',
    c: true,
    d: 42.5,
    e: null,
    f: 'world',
    g: false,
    h: 100,
    i: 'test',
    j: 0,
};

const nestedObj = {
    user: { name: 'John', age: 30 },
    meta: { created: Date.now(), active: true },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Object literal creation
// ═══════════════════════════════════════════════════════════════════════════════

const literalSuite = new BenchSuite('object literal creation');

literalSuite.add('empty object {}', () => {
    return {};
});

literalSuite.add('2 properties', () => {
    return { a: 1, b: 'hello' };
});

literalSuite.add('5 properties', () => {
    return { a: 1, b: 'hello', c: true, d: 42.5, e: null };
});

literalSuite.add('10 properties', () => {
    return {
        a: 1,
        b: 'hello',
        c: true,
        d: 42.5,
        e: null,
        f: 'world',
        g: false,
        h: 100,
        i: 'test',
        j: 0,
    };
});

literalSuite.add('nested object', () => {
    return {
        user: { name: 'John', age: 30 },
        meta: { created: Date.now(), active: true },
    };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Object.create patterns
// ═══════════════════════════════════════════════════════════════════════════════

const createSuite = new BenchSuite('Object.create patterns');

createSuite.add('Object.create(null)', () => {
    return Object.create(null);
});

createSuite.add('Object.create(Object.prototype)', () => {
    return Object.create(Object.prototype);
});

createSuite.add('{} (literal)', () => {
    return {};
});

// ═══════════════════════════════════════════════════════════════════════════════
// Object cloning patterns
// ═══════════════════════════════════════════════════════════════════════════════

const cloneSuite = new BenchSuite('object cloning (shallow)');

cloneSuite.add('spread {...obj} - small', () => {
    return { ...smallObj };
});

cloneSuite.add('spread {...obj} - medium', () => {
    return { ...mediumObj };
});

cloneSuite.add('spread {...obj} - large', () => {
    return { ...largeObj };
});

cloneSuite.add('Object.assign({}, obj) - medium', () => {
    return Object.assign({}, mediumObj);
});

cloneSuite.add('manual copy - medium', () => {
    return {
        a: mediumObj.a,
        b: mediumObj.b,
        c: mediumObj.c,
        d: mediumObj.d,
        e: mediumObj.e,
    };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Deep cloning patterns
// ═══════════════════════════════════════════════════════════════════════════════

const deepCloneSuite = new BenchSuite('deep cloning');

deepCloneSuite.add('structuredClone', () => {
    return structuredClone(nestedObj);
});

deepCloneSuite.add('JSON.parse(JSON.stringify())', () => {
    return JSON.parse(JSON.stringify(nestedObj));
});

deepCloneSuite.add('nested spread', () => {
    return {
        user: { ...nestedObj.user },
        meta: { ...nestedObj.meta },
    };
});

deepCloneSuite.add('manual deep copy', () => {
    return {
        user: { name: nestedObj.user.name, age: nestedObj.user.age },
        meta: { created: nestedObj.meta.created, active: nestedObj.meta.active },
    };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property assignment patterns
// ═══════════════════════════════════════════════════════════════════════════════

const assignSuite = new BenchSuite('property assignment');

assignSuite.add('obj.prop = value (5 props)', () => {
    const obj: any = {};
    obj.a = 1;
    obj.b = 'hello';
    obj.c = true;
    obj.d = 42.5;
    obj.e = null;
    return obj;
});

assignSuite.add('obj["prop"] = value (5 props)', () => {
    const obj: any = {};
    obj['a'] = 1;
    obj['b'] = 'hello';
    obj['c'] = true;
    obj['d'] = 42.5;
    obj['e'] = null;
    return obj;
});

assignSuite.add('literal { prop: value } (5 props)', () => {
    return { a: 1, b: 'hello', c: true, d: 42.5, e: null };
});

// ═══════════════════════════════════════════════════════════════════════════════
// Array creation patterns
// ═══════════════════════════════════════════════════════════════════════════════

const arraySuite = new BenchSuite('array creation');

arraySuite.add('[] literal', () => {
    return [];
});

arraySuite.add('[1,2,3,4,5] literal', () => {
    return [1, 2, 3, 4, 5];
});

arraySuite.add('new Array(5)', () => {
    return new Array(5);
});

arraySuite.add('Array.from({length: 5})', () => {
    return Array.from({ length: 5 });
});

arraySuite.add('[...arr] clone', () => {
    return [...[1, 2, 3, 4, 5]];
});

arraySuite.add('arr.slice() clone', () => {
    return [1, 2, 3, 4, 5].slice();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Object merging patterns
// ═══════════════════════════════════════════════════════════════════════════════

const mergeSuite = new BenchSuite('object merging');

const defaults = { a: 0, b: '', c: false };
const overrides = { a: 1, b: 'hello' };

mergeSuite.add('{...defaults, ...overrides}', () => {
    return { ...defaults, ...overrides };
});

mergeSuite.add('Object.assign({}, defaults, overrides)', () => {
    return Object.assign({}, defaults, overrides);
});

mergeSuite.add('Object.assign(Object.create(null), defaults, overrides)', () => {
    return Object.assign(Object.create(null), defaults, overrides);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  V8 Object Creation Patterns Benchmark                               ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    await literalSuite.runAsync();
    await createSuite.runAsync();
    await cloneSuite.runAsync();
    await deepCloneSuite.runAsync();
    await assignSuite.runAsync();
    await arraySuite.runAsync();
    await mergeSuite.runAsync();
}

main().catch(console.error);
