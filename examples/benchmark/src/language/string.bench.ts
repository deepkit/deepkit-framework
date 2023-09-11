/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BenchSuite } from '../bench.js';

export function main() {
    const bench = new BenchSuite('string');

    const literal = 'a';
    const object = new String('a');

    class EscapedString extends String {}
    const escaped = new EscapedString('a');

    const escapedS = Symbol('escaped');
    const FakeString = {[Symbol.toStringTag]: 'a', [escapedS]: true};

    function myTag(strings) {
        return strings[0];
    }

    const ts = `a`;
    const tsTag = myTag`a`;

    const titles: string[] = ['a'];

    bench.add('asd', () => {
        const a = 'asd';
        const s = [{'\u0000s': "<div>"}, a, {'\u0000s': "</div>"}];
    });

    bench.add('asd 2', () => {
        const a = 'asd';
        const s = [{[escapedS]: "<div>"}, a, {[escapedS]: "</div>"}];
    });

    bench.add('asd literal', () => {
        const s = [{}, "asd", {}];
    });

    bench.add('literal', () => {
        const s = literal + '1';
    });

    bench.add('template', () => {
        const s = ts + '1';
    });

    bench.add('template tsTag', () => {
        const s = tsTag + '1';
    });

    bench.add('String', () => {
        const s = object.toString() + '1';
    });

    bench.add('EscapedString', () => {
        const s = escaped.toString() + '1';
    });

    bench.add('FakeString', () => {
        const s = FakeString + '1';
    });

    bench.add('template creation', () => {
        const s = `a`;
    });

    bench.add('template tag creation', () => {
        const s = myTag`a`;
    });

    bench.add('String creation', () => {
        const s = new String('a2');
    });

    bench.add('EscapedString creation', () => {
        const s = new EscapedString('a2');
    });

    bench.add('FakeString creation', () => {
        const s = {toString() { return 'a'}, [escapedS]: true};
    });

    bench.add('typeof literal', () => {
        const t = typeof literal;
    });

    bench.add('typeof String', () => {
        const t = object instanceof String;
    });

    bench.run();
}
