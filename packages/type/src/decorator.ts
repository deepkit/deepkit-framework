/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassDecoratorResult, createClassDecoratorContext, createPropertyDecoratorContext } from './decorator-builder';
import { EntityData, ReceiveType, ReflectionClass, SerializerFn, TData, ValidatorFn } from './reflection/reflection';
import { ClassType } from '@deepkit/core';
import { IndexOptions } from './reflection/type';

class TDecorator {
    t = new TData();

    onDecorator(target: any, property?: string, parameterIndexOrDescriptor?: any) {
        if (undefined === target) return;

        const reflection = ReflectionClass.from(target);

        if (property !== undefined && parameterIndexOrDescriptor === undefined) {
            const reflectionProperty = reflection.getProperty(property);
            if (reflectionProperty) reflectionProperty.applyDecorator(this.t);

            const reflectionMethod = reflection.getMethod(property);
            if (reflectionMethod) reflectionMethod.applyDecorator(this.t);

        } else if (parameterIndexOrDescriptor !== undefined) {
            const reflectionMethod = reflection.getMethod(property || 'constructor');
            if (reflectionMethod) {
                const params = reflectionMethod.getParameters();
                const param = params[parameterIndexOrDescriptor];
                param.applyDecorator(this.t);
            }
        }
    }

    type<T>(type: ReceiveType<T> | ClassType) {
        this.t.type = type;
    }

    /**
     * Marks the method as validator. Is executed for each is/validate call.
     *
     * ```typescript
     *
     * class MyClass {
     *     field1: string;
     *     field2: string;
     *
     *     @t.validator
     *     validate(): ValidatorError | undefined {
     *          return new ValidatorError('invalid', 'MyClass is invalid');
     *     }
     * }
     *
     * ```
     */
    get validator() {
        this.t.validator = true;
        return;
    }

    validate(...validators: ValidatorFn[]) {
        this.t.validators.push(...validators);
    }

    serialize(serializer: SerializerFn) {
        this.t.serializer = serializer;
    }

    deserialize(deserializer: SerializerFn) {
        this.t.deserializer = deserializer;
    }

    data(name: string, value: any) {
        this.t.data[name] = value;
    }
}

export const t = createPropertyDecoratorContext(TDecorator);

class EntityDecorator {
    t = new EntityData();

    onDecorator(target: any) {
        if (undefined === target) return;

        const reflection = ReflectionClass.from(target);
        reflection.applyDecorator(this.t);
    }

    name(name: string) {
        this.t.name = name;
    }

    collection(name: string) {
        this.t.collectionName = name;
    }

    index(names: string[], options: IndexOptions = {}) {
        this.t.indexes.push({ names, options });
    }

    data(name: string, value: any) {
        this.t.data[name] = value;
    }
}

export const entity: ClassDecoratorResult<typeof EntityDecorator> = createClassDecoratorContext(EntityDecorator);
