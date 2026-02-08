/**
 * Head-to-head comparison with top runtime type libraries.
 *
 * All 4 benchmark categories from typescript-runtime-type-benchmarks:
 * - assertLoose: validate, allow extra keys (returns boolean)
 * - assertStrict: validate, reject extra keys (returns boolean)
 * - parseSafe: validate + clone, strip extra keys (returns new object)
 * - parseStrict: validate + clone, reject extra keys (returns new object)
 *
 * Run from benchmarks folder:
 *   npm install && npx typia generate --input typia-src --output typia-generated
 *   node --import @deepkit/run comparison.ts
 */
import {
    deserialize,
    getSerializeFunction,
    is,
    isStrict,
    isWeak,
    serialize,
    serializer,
    typeGuard,
    typeGuardStrict,
    typeGuardWeak,
    typeOf,
} from '@deepkit/type';

// ============================================================
// TYPIA (real, pre-generated)
// ============================================================

// Typia requires AOT compilation
// Generated via: npx typia generate --input typia-src --output typia-generated --project typia-src/tsconfig.json
let typiaIs: ((data: unknown) => boolean) | null = null;
let typiaEquals: ((data: unknown) => boolean) | null = null;
let typiaClone: ((data: any) => any) | null = null;

try {
    const typia = require('../../../../typia-generated/validators.js');
    typiaIs = typia.typiaIs;
    typiaEquals = typia.typiaEquals;
    typiaClone = typia.typiaClone;
} catch (e) {
    // Typia not generated - run: npx typia generate --input typia-src --output typia-generated --project typia-src/tsconfig.json
}

// ============================================================
// OTHER LIBRARIES (conditional imports)
// ============================================================

let typebox: any = null;
let typeboxCompiler: any = null;
let zod: any = null;
let valibot: any = null;
let arktype: any = null;

try {
    typebox = require('@sinclair/typebox');
    typeboxCompiler = require('@sinclair/typebox/compiler');
} catch {}

try {
    zod = require('zod');
} catch {}

try {
    valibot = require('valibot');
} catch {}

try {
    arktype = require('arktype');
} catch {}

// ============================================================
// TEST DATA (same as typescript-runtime-type-benchmarks)
// ============================================================

interface Model {
    number: number;
    negNumber: number;
    maxNumber: number;
    string: string;
    longString: string;
    boolean: boolean;
    deeplyNested: {
        foo: string;
        num: number;
        bool: boolean;
    };
}

const testData: Model = Object.freeze({
    number: 1,
    negNumber: -1,
    maxNumber: Number.MAX_VALUE,
    string: 'string',
    longString: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    boolean: true,
    deeplyNested: Object.freeze({
        foo: 'bar',
        num: 1,
        bool: false,
    }),
});

// Data with extra keys (for assertStrict tests)
const dataWithExtraKeys = {
    ...testData,
    extraKey: 'should be rejected',
    deeplyNested: {
        ...testData.deeplyNested,
        extraNested: 'also rejected',
    },
};

// ============================================================
// DEEPKIT
// ============================================================

const deepkitIs = typeGuard<Model>();
const deepkitIsStrict = typeGuardStrict<Model>();
const deepkitIsWeak = typeGuardWeak<Model>(); // Fastest mode (no NaN checks)
const type = typeOf<Model>();
const deepkitDeserialize = getSerializeFunction(type, serializer.deserializeRegistry);
const deepkitSerialize = getSerializeFunction(type, serializer.serializeRegistry);

// ============================================================
// TYPEBOX
// ============================================================

let typeboxCheck: ((data: unknown) => boolean) | null = null;
let typeboxCheckStrict: ((data: unknown) => boolean) | null = null;

if (typebox && typeboxCompiler) {
    const T = typebox.Type;
    const TypeBoxModel = T.Object({
        number: T.Number(),
        negNumber: T.Number(),
        maxNumber: T.Number(),
        string: T.String(),
        longString: T.String(),
        boolean: T.Boolean(),
        deeplyNested: T.Object({
            foo: T.String(),
            num: T.Number(),
            bool: T.Boolean(),
        }),
    });
    const TypeBoxModelStrict = T.Object(
        {
            number: T.Number(),
            negNumber: T.Number(),
            maxNumber: T.Number(),
            string: T.String(),
            longString: T.String(),
            boolean: T.Boolean(),
            deeplyNested: T.Object(
                {
                    foo: T.String(),
                    num: T.Number(),
                    bool: T.Boolean(),
                },
                { additionalProperties: false },
            ),
        },
        { additionalProperties: false },
    );

    const compiled = typeboxCompiler.TypeCompiler.Compile(TypeBoxModel);
    const compiledStrict = typeboxCompiler.TypeCompiler.Compile(TypeBoxModelStrict);
    typeboxCheck = (data: unknown) => compiled.Check(data);
    typeboxCheckStrict = (data: unknown) => compiledStrict.Check(data);
}

// ============================================================
// ZOD
// ============================================================

let zodSafeParse: ((data: unknown) => boolean) | null = null;
let zodSafeParseStrict: ((data: unknown) => boolean) | null = null;
let zodParse: ((data: unknown) => any) | null = null;

if (zod) {
    const z = zod.z;
    const ZodModel = z.object({
        number: z.number(),
        negNumber: z.number(),
        maxNumber: z.number(),
        string: z.string(),
        longString: z.string(),
        boolean: z.boolean(),
        deeplyNested: z.object({
            foo: z.string(),
            num: z.number(),
            bool: z.boolean(),
        }),
    });
    const ZodModelStrict = z
        .object({
            number: z.number(),
            negNumber: z.number(),
            maxNumber: z.number(),
            string: z.string(),
            longString: z.string(),
            boolean: z.boolean(),
            deeplyNested: z
                .object({
                    foo: z.string(),
                    num: z.number(),
                    bool: z.boolean(),
                })
                .strict(),
        })
        .strict();

    zodSafeParse = (data: unknown) => ZodModel.safeParse(data).success;
    zodSafeParseStrict = (data: unknown) => ZodModelStrict.safeParse(data).success;
    zodParse = (data: unknown) => ZodModel.parse(data);
}

// ============================================================
// VALIBOT
// ============================================================

let valibotIs: ((data: unknown) => boolean) | null = null;
let valibotParse: ((data: unknown) => any) | null = null;

if (valibot) {
    const v = valibot;
    const ValibotModel = v.object({
        number: v.number(),
        negNumber: v.number(),
        maxNumber: v.number(),
        string: v.string(),
        longString: v.string(),
        boolean: v.boolean(),
        deeplyNested: v.object({
            foo: v.string(),
            num: v.number(),
            bool: v.boolean(),
        }),
    });
    valibotIs = (data: unknown) => v.is(ValibotModel, data);
    valibotParse = (data: unknown) => v.parse(ValibotModel, data);
}

// ============================================================
// ARKTYPE
// ============================================================

let arktypeIs: ((data: unknown) => boolean) | null = null;

if (arktype) {
    const { type: arkType } = arktype;
    const ArkModel = arkType({
        number: 'number',
        negNumber: 'number',
        maxNumber: 'number',
        string: 'string',
        longString: 'string',
        boolean: 'boolean',
        deeplyNested: {
            foo: 'string',
            num: 'number',
            bool: 'boolean',
        },
    });
    arktypeIs = (data: unknown) => !(ArkModel(data) instanceof arktype.type.errors);
}

// ============================================================
// BENCHMARK UTILITIES
// ============================================================

function benchmark(name: string, fn: () => any, iterations: number = 1_000_000): number {
    const acc: any[] = [];

    // Warmup
    for (let i = 0; i < 50000; i++) acc.push(fn());
    acc.length = 0;

    // Run 5 times, take best
    const runs: number[] = [];
    for (let run = 0; run < 5; run++) {
        const start = performance.now();
        for (let i = 0; i < iterations; i++) acc.push(fn());
        const end = performance.now();
        runs.push(iterations / ((end - start) / 1000));
        acc.length = 0;
    }

    runs.sort((a, b) => b - a);
    return Math.round(runs[0]);
}

function formatOps(ops: number): string {
    if (ops >= 1e6) return (ops / 1e6).toFixed(1) + 'M';
    if (ops >= 1e3) return (ops / 1e3).toFixed(0) + 'K';
    return ops.toString();
}

function printResults(title: string, results: Array<{ name: string; ops: number | null }>) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(` ${title}`);
    console.log(`${'═'.repeat(70)}`);

    const sorted = results.filter(r => r.ops !== null).sort((a, b) => (b.ops || 0) - (a.ops || 0));

    const maxOps = sorted[0]?.ops || 1;

    console.log('┌────────────────────────────────┬───────────────┬──────────┬──────────┐');
    console.log('│ Library                        │ ops/sec       │ Rank     │ vs best  │');
    console.log('├────────────────────────────────┼───────────────┼──────────┼──────────┤');

    sorted.forEach((r, i) => {
        const pct = (((r.ops || 0) / maxOps) * 100).toFixed(0) + '%';
        const rank = `#${i + 1}`;
        console.log(
            `│ ${r.name.padEnd(30)} │ ${formatOps(r.ops || 0).padStart(11)} │ ${rank.padStart(8)} │ ${pct.padStart(8)} │`,
        );
    });

    console.log('└────────────────────────────────┴───────────────┴──────────┴──────────┘');

    const notInstalled = results.filter(r => r.ops === null);
    if (notInstalled.length > 0) {
        console.log(`\nNot available: ${notInstalled.map(r => r.name).join(', ')}`);
    }
}

// ============================================================
// RUN BENCHMARKS
// ============================================================

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║     DEEPKIT vs COMPETITORS - Same Machine Comparison                 ║');
console.log('╠══════════════════════════════════════════════════════════════════════╣');
console.log('║  All 4 benchmark categories from typescript-runtime-type-benchmarks  ║');
console.log('║  Model: 6 primitives + 1 nested object (3 primitives)                ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

// Verify correctness
console.log('\n--- Correctness Check ---');
console.log(`Deepkit is():        ${deepkitIs(testData)} (valid), ${deepkitIs(dataWithExtraKeys)} (with extra keys)`);
console.log(
    `Deepkit isStrict():  ${deepkitIsStrict(testData)} (valid), ${deepkitIsStrict(dataWithExtraKeys)} (with extra keys)`,
);
if (typiaIs)
    console.log(`Typia is():          ${typiaIs(testData)} (valid), ${typiaIs(dataWithExtraKeys)} (with extra keys)`);
if (typiaEquals)
    console.log(`Typia eq:    ${typiaEquals(testData)} (valid), ${typiaEquals(dataWithExtraKeys)} (with extra keys)`);
if (typeboxCheck)
    console.log(`TypeBox:     ${typeboxCheck(testData)} (valid), ${typeboxCheck(dataWithExtraKeys)} (with extra keys)`);
if (zodSafeParse)
    console.log(`Zod:         ${zodSafeParse(testData)} (valid), ${zodSafeParse(dataWithExtraKeys)} (with extra keys)`);
if (valibotIs)
    console.log(`Valibot:     ${valibotIs(testData)} (valid), ${valibotIs(dataWithExtraKeys)} (with extra keys)`);
if (arktypeIs)
    console.log(`ArkType:     ${arktypeIs(testData)} (valid), ${arktypeIs(dataWithExtraKeys)} (with extra keys)`);

// ============================================================
// 1. assertLoose - Type Guard (allow extra keys)
// ============================================================

const assertLooseResults = [
    { name: 'Typia is()', ops: typiaIs ? benchmark('typia', () => typiaIs!(testData)) : null },
    { name: 'Deepkit isWeak<T>()', ops: benchmark('deepkit-weak', () => deepkitIsWeak(testData)) },
    { name: 'Deepkit is<T>()', ops: benchmark('deepkit', () => deepkitIs(testData)) },
    { name: 'TypeBox (compiled)', ops: typeboxCheck ? benchmark('typebox', () => typeboxCheck!(testData)) : null },
    { name: 'ArkType', ops: arktypeIs ? benchmark('arktype', () => arktypeIs!(testData)) : null },
    { name: 'Valibot is()', ops: valibotIs ? benchmark('valibot', () => valibotIs!(testData)) : null },
    { name: 'Zod safeParse()', ops: zodSafeParse ? benchmark('zod', () => zodSafeParse!(testData)) : null },
];

printResults('assertLoose - Type Guard (allow extra keys)', assertLooseResults);
console.log('Note: isWeak<T>() skips NaN checks for maximum speed (same as Typia)');

// ============================================================
// 2. assertStrict - Type Guard (reject extra keys)
// ============================================================

const assertStrictResults = [
    { name: 'Typia equals()', ops: typiaEquals ? benchmark('typia-eq', () => typiaEquals!(testData)) : null },
    { name: 'Deepkit isStrict<T>()', ops: benchmark('deepkit-strict', () => deepkitIsStrict(testData)) },
    {
        name: 'TypeBox strict',
        ops: typeboxCheckStrict ? benchmark('typebox-strict', () => typeboxCheckStrict!(testData)) : null,
    },
    {
        name: 'Zod strict',
        ops: zodSafeParseStrict ? benchmark('zod-strict', () => zodSafeParseStrict!(testData)) : null,
    },
];

printResults('assertStrict - Type Guard (reject extra keys)', assertStrictResults);

// ============================================================
// 3. parseSafe - Parse/Clone (strip extra keys)
// ============================================================

// parseSafe in benchmark repo: is() + clone()
const typiaParseSafe =
    typiaIs && typiaClone
        ? (data: unknown) => {
              if (!typiaIs!(data)) throw new Error('Invalid');
              return typiaClone!(data);
          }
        : null;

const parseSafeResults = [
    {
        name: 'Typia is() + clone()',
        ops: typiaParseSafe ? benchmark('typia-parse', () => typiaParseSafe!(testData)) : null,
    },
    { name: 'Deepkit deserialize()', ops: benchmark('deepkit', () => deepkitDeserialize(testData, {})) },
    { name: 'Valibot parse()', ops: valibotParse ? benchmark('valibot', () => valibotParse!(testData)) : null },
    { name: 'Zod parse()', ops: zodParse ? benchmark('zod', () => zodParse!(testData)) : null },
];

printResults('parseSafe - Parse/Deserialize (strip extra keys)', parseSafeResults);

// ============================================================
// 4. parseStrict - Parse/Clone (reject extra keys)
// ============================================================

// parseStrict in benchmark repo: equals() - just validate strictly, return same data (no clone)
// For Deepkit we can use isStrict() + deserialize() pattern
const deepkitParseStrict = (data: unknown) => {
    if (!deepkitIsStrict(data)) throw new Error('Invalid');
    return deepkitDeserialize(data, {});
};

const parseStrictResults = [
    {
        name: 'Typia equals()',
        ops: typiaEquals
            ? benchmark('typia-strict', () => {
                  if (!typiaEquals!(testData)) throw new Error('Invalid');
                  return testData;
              })
            : null,
    },
    {
        name: 'Deepkit isStrict() + deserialize()',
        ops: benchmark('deepkit-strict', () => deepkitParseStrict(testData)),
    },
];

printResults('parseStrict - Parse/Deserialize (reject extra keys)', parseStrictResults);

// ============================================================
// BONUS: serialize
// ============================================================

const serializeResults = [
    { name: 'Deepkit serialize()', ops: benchmark('deepkit', () => deepkitSerialize(testData, {})) },
];

printResults('serialize - Serialize to plain object', serializeResults);

// ============================================================
// SUMMARY
// ============================================================

console.log('\n' + '═'.repeat(70));
console.log(' SUMMARY');
console.log('═'.repeat(70));

const deepkitWeakOps = assertLooseResults.find(r => r.name.includes('isWeak'))?.ops || 0;
const deepkitAssertOps = assertLooseResults.find(r => r.name.includes('is<T>()'))?.ops || 0;
const typiaAssertOps = assertLooseResults.find(r => r.name.includes('Typia'))?.ops || 0;
const typeboxAssertOps = assertLooseResults.find(r => r.name.includes('TypeBox'))?.ops || 0;

console.log('\nassertLoose ranking (isWeak vs Typia):');
if (typiaAssertOps && deepkitWeakOps) {
    const ratio = deepkitWeakOps / typiaAssertOps;
    if (ratio > 1) {
        console.log(`  Deepkit isWeak is ${((ratio - 1) * 100).toFixed(0)}% FASTER than Typia`);
    } else {
        console.log(`  Deepkit isWeak is ${((1 - ratio) * 100).toFixed(0)}% slower than Typia`);
    }
}
console.log('\nassertLoose ranking (is vs Typia):');
if (typiaAssertOps && deepkitAssertOps) {
    const ratio = deepkitAssertOps / typiaAssertOps;
    if (ratio > 1) {
        console.log(`  Deepkit is ${((ratio - 1) * 100).toFixed(0)}% FASTER than Typia`);
    } else {
        console.log(`  Deepkit is ${((1 - ratio) * 100).toFixed(0)}% slower than Typia`);
    }
}
if (typeboxAssertOps && deepkitAssertOps) {
    const ratio = deepkitAssertOps / typeboxAssertOps;
    if (ratio > 1) {
        console.log(`  Deepkit is ${((ratio - 1) * 100).toFixed(0)}% FASTER than TypeBox`);
    } else {
        console.log(`  Deepkit is ${((1 - ratio) * 100).toFixed(0)}% slower than TypeBox`);
    }
}

console.log('\nAbsolute Performance:');
console.log(`  Deepkit isWeak<T>():      ${formatOps(deepkitWeakOps)} ops/s (no NaN check)`);
console.log(`  Deepkit is<T>():          ${formatOps(deepkitAssertOps)} ops/s (with NaN check)`);
if (typiaAssertOps) console.log(`  Typia is():               ${formatOps(typiaAssertOps)} ops/s`);
if (typeboxAssertOps) console.log(`  TypeBox Check():          ${formatOps(typeboxAssertOps)} ops/s`);

const deepkitParseOps = parseSafeResults.find(r => r.name.includes('Deepkit'))?.ops || 0;
console.log(`  Deepkit deserialize():    ${formatOps(deepkitParseOps)} ops/s`);

const deepkitSerOps = serializeResults.find(r => r.name.includes('Deepkit'))?.ops || 0;
console.log(`  Deepkit serialize():      ${formatOps(deepkitSerOps)} ops/s`);

// Show generated code
console.log('\n' + '═'.repeat(70));
console.log(' GENERATED CODE COMPARISON');
console.log('═'.repeat(70));

console.log('\n--- Deepkit isWeak<T>() (no NaN checks) ---');
console.log(deepkitIsWeak.toString());

console.log('\n--- Deepkit is<T>() (with NaN checks) ---');
console.log(deepkitIs.toString());

if (typiaIs) {
    console.log('\n--- Typia is() ---');
    console.log(typiaIs.toString());
}
