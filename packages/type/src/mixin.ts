import { ExtractClassType } from '@deepkit/core';
import { ClassType } from '@deepkit/core';
import { AbstractClassType } from '@deepkit/core';
import { ReflectionClass } from './reflection/reflection.js';

type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

/**
 * Function to mixin multiple classes together and create a new class, which can be extended from.
 *
 * The first entry of the mixin() call will be used as base class.
 *
 * @example
 * ```typescript
 *
 *   class Timestampable {
 *       createdAt: Date = new Date;
 *       updatedAt: Date = new Date;
 *   }
 *
 *   class SoftDeleted {
 *       deletedAt?: Date;
 *       deletedBy?: string;
 *   }
 *
 *   class User extends mixin(Timestampable, SoftDeleted) {
 *       id: number = 0;
 *       constructor(public username: string) {}
 *   }
 * ```
 */
export function mixin<T extends AbstractClassType[]>(...classTypes: T): ClassType<UnionToIntersection<ExtractClassType<T[number]>>> {
    const base = classTypes.shift();
    if (!base) throw new Error('No classes given');

    const constructors: Function[] = [];
    const newClassType: any = class extends base {
        constructor(...args: any[]) {
            super();
            for (const c of constructors) {
                c.call(this, ...args);
            }
        }
    };
    const schema = ReflectionClass.from(newClassType);

    for (const classType of classTypes) {
        const foreignSchema = ReflectionClass.from(classType);

        for (const i of Object.getOwnPropertyNames(classType.prototype)) {
            if (i === 'constructor') continue;
            newClassType.prototype[i] = classType.prototype[i];
        }

        for (const prop of foreignSchema.getProperties()) {
            schema.registerProperty(prop.clone());
        }

        constructors.push(function (this: any, ...args: any[]) {
            const item = new (classType as any)(...args);
            for (const prop of foreignSchema.getProperties()) {
                this[prop.name] = item[prop.name];
            }
        });
    }
    return newClassType as any;
}
