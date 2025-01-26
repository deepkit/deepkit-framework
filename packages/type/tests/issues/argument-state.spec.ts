import { expect, test } from '@jest/globals';
import { ReceiveType, resolveReceiveType } from '../../src/reflection/reflection';
import { Type } from '../../src/reflection/type';
import { forwardTypeArguments } from '@deepkit/core';

test('function default', () => {
    class Clazz {
        create<T>(sql: string, type?: ReceiveType<T>): Type {
            return resolveReceiveType(type);
        }
    }

    class Fascade {
        create: Clazz['create'];

        constructor() {
            this.create = (...args: any) => {
                const clazz = new Clazz;
                forwardTypeArguments(this.create, clazz.create);
                return clazz.create.apply(clazz, args);
            };
        }
    }

    const clazz = new Fascade();
    const t1 = clazz.create<{count1: string}>('');
    expect(() => clazz.create('')).toThrow('No type information received');
});
