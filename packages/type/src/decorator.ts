/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { createFreeDecoratorContext } from './decorator-builder';
import { Type } from './reflection/type';
import { BackReferenceOptions, ReceiveType, ReferenceActions, ReflectionClass, SerializerFn, TData, ValidatorFn } from './reflection/reflection';
import { ClassType } from '@deepkit/core';

class TDecorator {
    t = new TData();

    onDecorator(target?: any, property?: string, parameterIndexOrDescriptor?: any) {
        if (undefined === target) return;

        const reflection = ReflectionClass.from(target);

        if (property === undefined && parameterIndexOrDescriptor === undefined) {
            reflection.applyDecorator(this.t);
        } else if (property !== undefined && parameterIndexOrDescriptor === undefined) {

            //todo, could also be a method
            const reflectionProperty = reflection.getProperty(property);
            if (reflectionProperty) reflectionProperty.applyDecorator(this.t);

        } else if (parameterIndexOrDescriptor !== undefined) {
            const reflectionMethod = reflection.getMethod(property || 'constructor');
            if (reflectionMethod) reflectionMethod.getParameters()[parameterIndexOrDescriptor].applyDecorator(this.t);
        }
    }

    //todo: index

    type<T>(type: ReceiveType<T> | ClassType) {
        this.t.type = type;
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

    /**
     * Excludes this property and given serializers or all if none serializer name is provided.
     * This includes serialization and deserialization(cast).
     */
    exclude(...serializerNames: string[]) {
        if (!this.t.excludeSerializerNames) this.t.excludeSerializerNames = [];
        if (!serializerNames.length) serializerNames = ['*'];
        this.t.excludeSerializerNames.push(...serializerNames);
    }

    group(...groups: string[]) {
        if (!this.t.groups) this.t.groups = [];
        this.t.groups.push(...groups);
    }

    // reference(options?: { onDelete: ReferenceActions, onUpdate: ReferenceActions }) {
    //     this.t.referenceOptions = options;
    // }

    backReference(backReference?: BackReferenceOptions<any>) {
        this.t.backReference = backReference;
    }
}

export const t = createFreeDecoratorContext(TDecorator);
