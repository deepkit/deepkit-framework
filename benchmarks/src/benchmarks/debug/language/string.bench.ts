/**
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BenchSuite } from '@deepkit/bench';

/**
 * String operations benchmark - compares various string creation and type checking methods
 */

export default async function () {
    const suite = new BenchSuite('debug/language-string');

    const literal = 'a';
    const object = new String('a');

    class EscapedString extends String {}
    const escaped = new EscapedString('a');

    const escapedS = Symbol('escaped');
    const FakeString = { [Symbol.toStringTag]: 'a', [escapedS]: true };

    function myTag(strings: TemplateStringsArray) {
        return strings[0];
    }

    const ts = `a`;
    const tsTag = myTag`a`;

    suite.add('literal concat', () => {
        const s = literal + '1';
    });

    suite.add('template concat', () => {
        const s = ts + '1';
    });

    suite.add('template tag concat', () => {
        const s = tsTag + '1';
    });

    suite.add('String.toString concat', () => {
        const s = object.toString() + '1';
    });

    suite.add('EscapedString.toString concat', () => {
        const s = escaped.toString() + '1';
    });

    suite.add('FakeString concat', () => {
        const s = FakeString + '1';
    });

    suite.add('template creation', () => {
        const s = `a`;
    });

    suite.add('template tag creation', () => {
        const s = myTag`a`;
    });

    suite.add('String creation', () => {
        const s = new String('a2');
    });

    suite.add('EscapedString creation', () => {
        const s = new EscapedString('a2');
    });

    suite.add('FakeString creation', () => {
        const s = {
            toString() {
                return 'a';
            },
            [escapedS]: true,
        };
    });

    suite.add('typeof literal', () => {
        const t = typeof literal;
    });

    suite.add('instanceof String', () => {
        const t = object instanceof String;
    });

    return suite;
}
