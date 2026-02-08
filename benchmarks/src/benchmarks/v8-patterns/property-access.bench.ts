/**
 * V8 Property Access Patterns
 *
 * Tests different property access methods used in serialization/deserialization.
 * Critical for understanding hidden class transitions and inline cache behavior.
 *
 * Run: node --expose-gc --import @deepkit/run property-access.bench.ts
 */
import { BenchSuite } from '@deepkit/bench';

// Test objects with different shapes
const flatObject = {
    a: 1,
    b: 'hello',
    c: true,
    d: 42.5,
    e: null,
};

const nestedObject = {
    level1: {
        level2: {
            level3: {
                value: 'deep',
            },
        },
    },
};

const arrayObject = {
    items: [1, 2, 3, 4, 5],
    nested: [{ a: 1 }, { a: 2 }, { a: 3 }],
};

// Property names for dynamic access
const propName = 'b';
const propSymbol = Symbol('prop');
const objectWithSymbol = { [propSymbol]: 'symbol value', regular: 'regular value' };

// ═══════════════════════════════════════════════════════════════════════════════
// Direct vs computed property access
// ═══════════════════════════════════════════════════════════════════════════════

const accessSuite = new BenchSuite('property access methods');

accessSuite.add('direct: obj.prop', () => {
    return flatObject.b;
});

accessSuite.add('computed literal: obj["prop"]', () => {
    return flatObject['b'];
});

accessSuite.add('computed variable: obj[varName]', () => {
    return flatObject[propName];
});

accessSuite.add('symbol: obj[symbol]', () => {
    return objectWithSymbol[propSymbol];
});

// ═══════════════════════════════════════════════════════════════════════════════
// Nested property access
// ═══════════════════════════════════════════════════════════════════════════════

const nestedSuite = new BenchSuite('nested property access');

nestedSuite.add('1 level: obj.level1', () => {
    return nestedObject.level1;
});

nestedSuite.add('2 levels: obj.level1.level2', () => {
    return nestedObject.level1.level2;
});

nestedSuite.add('3 levels: obj.level1.level2.level3', () => {
    return nestedObject.level1.level2.level3;
});

nestedSuite.add('4 levels: obj.level1.level2.level3.value', () => {
    return nestedObject.level1.level2.level3.value;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Optional chaining vs guard patterns
// ═══════════════════════════════════════════════════════════════════════════════

const obj: any = nestedObject;

const optionalSuite = new BenchSuite('optional chaining vs guards');

optionalSuite.add('optional chain: obj?.level1?.level2?.level3?.value', () => {
    return obj?.level1?.level2?.level3?.value;
});

optionalSuite.add('guard: obj && obj.level1 && obj.level1.level2 && ...', () => {
    return obj && obj.level1 && obj.level1.level2 && obj.level1.level2.level3 && obj.level1.level2.level3.value;
});

optionalSuite.add('try-catch guard', () => {
    try {
        return obj.level1.level2.level3.value;
    } catch {
        return undefined;
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Array access patterns
// ═══════════════════════════════════════════════════════════════════════════════

const arraySuite = new BenchSuite('array access patterns');

arraySuite.add('array[0]', () => {
    return arrayObject.items[0];
});

arraySuite.add('array[array.length - 1]', () => {
    return arrayObject.items[arrayObject.items.length - 1];
});

arraySuite.add('array.at(0)', () => {
    return arrayObject.items.at(0);
});

arraySuite.add('array.at(-1)', () => {
    return arrayObject.items.at(-1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property existence checks
// ═══════════════════════════════════════════════════════════════════════════════

const existenceSuite = new BenchSuite('property existence checks');

existenceSuite.add('"prop" in obj', () => {
    return 'b' in flatObject;
});

existenceSuite.add('obj.hasOwnProperty("prop")', () => {
    return flatObject.hasOwnProperty('b');
});

existenceSuite.add('Object.hasOwn(obj, "prop")', () => {
    return Object.hasOwn(flatObject, 'b');
});

existenceSuite.add('obj.prop !== undefined', () => {
    return flatObject.b !== undefined;
});

existenceSuite.add('typeof obj.prop !== "undefined"', () => {
    return typeof flatObject.b !== 'undefined';
});

// ═══════════════════════════════════════════════════════════════════════════════
// Object iteration patterns (for serialization)
// ═══════════════════════════════════════════════════════════════════════════════

const iterationSuite = new BenchSuite('object iteration');

iterationSuite.add('for...in', () => {
    let sum = 0;
    for (const key in flatObject) {
        if (typeof flatObject[key as keyof typeof flatObject] === 'number') sum++;
    }
    return sum;
});

iterationSuite.add('Object.keys().forEach', () => {
    let sum = 0;
    Object.keys(flatObject).forEach(key => {
        if (typeof flatObject[key as keyof typeof flatObject] === 'number') sum++;
    });
    return sum;
});

iterationSuite.add('Object.entries()', () => {
    let sum = 0;
    for (const [, value] of Object.entries(flatObject)) {
        if (typeof value === 'number') sum++;
    }
    return sum;
});

iterationSuite.add('Object.values()', () => {
    let sum = 0;
    for (const value of Object.values(flatObject)) {
        if (typeof value === 'number') sum++;
    }
    return sum;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  V8 Property Access Patterns Benchmark                               ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    await accessSuite.runAsync();
    await nestedSuite.runAsync();
    await optionalSuite.runAsync();
    await arraySuite.runAsync();
    await existenceSuite.runAsync();
    await iterationSuite.runAsync();
}

main().catch(console.error);
