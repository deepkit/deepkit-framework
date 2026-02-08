/**
 * @deepkit/type Validation Performance Regression Tests
 *
 * Canonical performance benchmark for the type validator and typeguard.
 * Uses pre-resolved validator functions to measure actual JIT performance.
 * Separate section tracks convenience API (validate<T>) overhead.
 *
 * Run standalone: cd packages/type && node --import @deepkit/run --test tests/perf-regression-validation.spec.ts
 */
import { describe, test } from 'node:test';

import { BenchSuite } from '@deepkit/bench';

import { getValidatorFunction, is, serializer, validate } from '../index.js';
import { typeOf } from '../src/reflection/reflection.js';
import { Email, MaxLength, MinLength, Positive, integer } from '../src/type-annotations.js';

function assertMinOps(name: string, ops: number, minOps: number) {
    const mOps = ops / 1e6;
    const mMin = minOps / 1e6;
    console.log(`${name.padEnd(40)} ${mOps.toFixed(2).padStart(8)}M ops/sec  (min: ${mMin.toFixed(2)}M)`);
    if (ops < minOps) {
        throw new Error(`${name}: ${mOps.toFixed(2)}M ops/sec is below minimum ${mMin.toFixed(2)}M`);
    }
}

// ============================================================================
// Test Types
// ============================================================================

interface User {
    name: string;
    age: number;
    email: string & Email;
    active: boolean;
}

interface Address {
    street: string;
    city: string;
    zip: string;
}
interface Person {
    name: string;
    address: Address;
}

interface Config {
    host: string;
    port: number;
    secure: boolean;
    timeout: number;
}

interface TextMsg {
    type: 'text';
    content: string;
}
interface ImageMsg {
    type: 'image';
    url: string;
    width: number;
}
type Message = TextMsg | ImageMsg;

enum Status {
    Active = 'active',
    Inactive = 'inactive',
    Pending = 'pending',
}

// ============================================================================
// Pre-resolved functions
// ============================================================================

const validateUser = getValidatorFunction(undefined, typeOf<User>());
const validatePerson = getValidatorFunction(undefined, typeOf<Person>());
const validateConfig = getValidatorFunction(undefined, typeOf<Config>());
const validateMessage = getValidatorFunction(undefined, typeOf<Message>());
const validateEmail = getValidatorFunction(undefined, typeOf<Email>());
const validateStatus = getValidatorFunction(undefined, typeOf<Status>());

type Username = string & MinLength<3> & MaxLength<20>;
const validateUsername = getValidatorFunction(undefined, typeOf<Username>());

type PosInt = number & Positive & integer;
const validatePosInt = getValidatorFunction(undefined, typeOf<PosInt>());

// ============================================================================
// Test Data
// ============================================================================

const validUser = { name: 'Alice', age: 30, email: 'alice@example.com', active: true };
const invalidUser = { name: 123, age: 'thirty', email: 'bad', active: 'yes' };

const validPerson = { name: 'Bob', address: { street: '123 Main', city: 'NYC', zip: '10001' } };
const invalidPerson = { name: 'Bob', address: { street: 123, city: null, zip: 10001 } };

const validConfig = { host: 'localhost', port: 8080, secure: true, timeout: 5000 };
const invalidConfig = { host: 123, port: 'abc', secure: 'yes', timeout: null };

const textValid: Message = { type: 'text', content: 'hello' };
const imageValid: Message = { type: 'image', url: 'https://img.jpg', width: 800 };

// ============================================================================
// Tests — Pre-resolved Functions (JIT Performance)
// ============================================================================

describe('Validation Performance Regression', () => {
    describe('Constrained types', () => {
        test('Email', () => {
            const suite = new BenchSuite('email');
            suite.add('valid', () => validateEmail('user@example.com'));
            suite.add('invalid', () => validateEmail('not-an-email'));
            const results = suite.run({ verbose: false });
            assertMinOps('Email valid', results['valid'].hz, 5_000_000);
            assertMinOps('Email invalid', results['invalid'].hz, 5_000_000);
        });

        test('MinLength + MaxLength', () => {
            const suite = new BenchSuite('minmax');
            suite.add('valid', () => validateUsername('alice'));
            suite.add('too short', () => validateUsername('ab'));
            const results = suite.run({ verbose: false });
            assertMinOps('MinMax valid', results['valid'].hz, 5_000_000);
            assertMinOps('MinMax invalid', results['too short'].hz, 5_000_000);
        });

        test('Positive integer', () => {
            const suite = new BenchSuite('posint');
            suite.add('valid', () => validatePosInt(42));
            suite.add('invalid neg', () => validatePosInt(-5));
            const results = suite.run({ verbose: false });
            assertMinOps('PosInt valid', results['valid'].hz, 5_000_000);
            assertMinOps('PosInt invalid', results['invalid neg'].hz, 5_000_000);
        });
    });

    describe('Object validation', () => {
        test('simple interface (4 fields)', () => {
            const suite = new BenchSuite('obj valid');
            suite.add('valid', () => validateUser(validUser));
            suite.add('invalid', () => validateUser(invalidUser));
            const results = suite.run({ verbose: false });
            assertMinOps('User valid', results['valid'].hz, 2_000_000);
            assertMinOps('User invalid', results['invalid'].hz, 1_000_000);
        });

        test('nested objects', () => {
            const suite = new BenchSuite('nested valid');
            suite.add('valid', () => validatePerson(validPerson));
            suite.add('invalid', () => validatePerson(invalidPerson));
            const results = suite.run({ verbose: false });
            assertMinOps('nested valid', results['valid'].hz, 2_000_000);
            assertMinOps('nested invalid', results['invalid'].hz, 2_000_000);
        });

        test('is() typeguard for interface', () => {
            const suite = new BenchSuite('is obj');
            suite.add('valid', () => validateConfig(validConfig));
            suite.add('invalid', () => validateConfig(invalidConfig));
            const results = suite.run({ verbose: false });
            assertMinOps('Config valid', results['valid'].hz, 2_000_000);
            assertMinOps('Config invalid', results['invalid'].hz, 2_000_000);
        });
    });

    describe('Union types', () => {
        test('discriminated union validation', () => {
            const suite = new BenchSuite('union valid');
            suite.add('text', () => validateMessage(textValid));
            suite.add('image', () => validateMessage(imageValid));
            const results = suite.run({ verbose: false });
            assertMinOps('union text valid', results['text'].hz, 100_000_000);
            assertMinOps('union image valid', results['image'].hz, 100_000_000);
        });
    });

    describe('Enum types', () => {
        test('string enum validation', () => {
            const suite = new BenchSuite('enum valid');
            suite.add('valid', () => validateStatus(Status.Active));
            suite.add('invalid', () => validateStatus('unknown' as any));
            const results = suite.run({ verbose: false });
            assertMinOps('enum valid', results['valid'].hz, 2_000_000);
            assertMinOps('enum invalid', results['invalid'].hz, 2_000_000);
        });
    });

    // ========================================================================
    // Convenience API overhead — tracks resolveReceiveType + cache lookup
    // ========================================================================

    describe('Convenience API overhead', () => {
        test('validate<T>() vs pre-resolved fn()', () => {
            validate<User>(validUser);

            const suite = new BenchSuite('validate overhead');
            suite.add('validate<T>()', () => validate<User>(validUser));
            suite.add('fn()', () => validateUser(validUser));
            const results = suite.run({ verbose: false });

            const convenienceOps = results['validate<T>()'].hz;
            const directOps = results['fn()'].hz;
            const overhead = directOps / convenienceOps;
            console.log(`  Overhead factor: ${overhead.toFixed(1)}x (${(1e9 / convenienceOps - 1e9 / directOps).toFixed(0)}ns per call)`);

            // After Ω optimization + singleton NamingStrategy
            assertMinOps('validate<T>()', convenienceOps, 3_000_000);
        });

        test('is<T>() vs pre-resolved fn()', () => {
            is<Config>(validConfig);

            const suite = new BenchSuite('is overhead');
            suite.add('is<T>()', () => is<Config>(validConfig));
            suite.add('fn()', () => validateConfig(validConfig));
            const results = suite.run({ verbose: false });

            const convenienceOps = results['is<T>()'].hz;
            const directOps = results['fn()'].hz;
            const overhead = directOps / convenienceOps;
            console.log(`  Overhead factor: ${overhead.toFixed(1)}x (${(1e9 / convenienceOps - 1e9 / directOps).toFixed(0)}ns per call)`);

            // After Ω optimization
            assertMinOps('is<T>()', convenienceOps, 4_000_000);
        });
    });
});
