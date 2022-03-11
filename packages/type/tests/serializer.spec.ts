import { expect, test } from '@jest/globals';
import { executeTemplates, Serializer, TemplateRegistry, TemplateState, TypeGuardRegistry } from '../src/serializer';
import { ReflectionKind } from '../src/reflection/type';
import { CompilerContext } from '@deepkit/core';

test('TypeGuardRegistry', () => {
    const serializer = new Serializer();
    serializer.clear();

    function number1() {
    }

    function number2() {
    }

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
