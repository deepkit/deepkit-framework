import { expect, test } from '@jest/globals';

import { CompilerContext } from '@deepkit/core';

import { ReflectionKind } from '../src/reflection/type.js';
import { cast, deserialize } from '../src/serializer-facade.js';
import { EmptySerializer, Serializer, TemplateRegistry, TemplateState, TypeGuardRegistry, executeTemplates, serializer } from '../src/serializer.js';

test('remove guard for string', () => {
    //if the original value (before convert to string) is null, it should stay null
    serializer.deserializeRegistry.append(ReflectionKind.string, (type, state) => {
        state.addSetter(`null === ${state.originalAccessor} ? null : ${state.accessor}`);
    });
    expect(() => cast<string>(null)).toThrow('Not a string');
});

test('TypeGuardRegistry', () => {
    const serializer = new Serializer();
    serializer.clear();

    function number1() {}

    function number2() {}

    serializer.typeGuards.register(2, ReflectionKind.number, number2);
    serializer.typeGuards.register(1, ReflectionKind.number, number1);

    const registries = serializer.typeGuards.getSortedTemplateRegistries();

    expect(registries[0][1].get({ kind: ReflectionKind.number })[0]).toBe(number1);
    expect(registries[1][1].get({ kind: ReflectionKind.number })[0]).toBe(number2);
});

test('asd', () => {
    const registry = new TemplateRegistry();
    registry.register(ReflectionKind.string, (type, state) => {
        state.addSetter(`String(${state.accessor})`);
    });
    registry.append(ReflectionKind.string, (type, state) => {
        state.addSetter(`${state.accessor}.slice(0, 10)`);
    });
    const state = new TemplateState('output', 'input', new CompilerContext(), registry);

    const code = `
    function (input) {
        let output = undefined;
        ${executeTemplates(state, { kind: ReflectionKind.string })}
        return output;
    }
    `;

    console.log(code);
});

test('new serializer', () => {
    class User {
        name: string = '';
        created: Date = new Date();
    }

    const mySerializer = new EmptySerializer('mySerializer');

    mySerializer.deserializeRegistry.registerClass(Date, (type, state) => {
        state.addSetter(`new Date(${state.accessor})`);
    });

    mySerializer.serializeRegistry.registerClass(Date, (type, state) => {
        state.addSetter(`${state.accessor}.toJSON()`);
    });

    const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
    expect(user.created).toBeInstanceOf(Date);
});

test('new serializer easy mode', () => {
    class User {
        name: string = '';
        created: Date = new Date();
    }

    const mySerializer = new EmptySerializer('mySerializer');

    mySerializer.deserializeRegistry.registerClass(Date, (type, state) => {
        state.convert(v => new Date(v));
    });

    mySerializer.serializeRegistry.registerClass(Date, (type, state) => {
        state.convert(v => v.toJSON());
    });

    const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
    expect(user.created).toBeInstanceOf(Date);
});
