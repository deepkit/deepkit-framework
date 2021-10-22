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
import { BackReferenceOptions, ReferenceActions } from './reflection/reflection';

interface ValidatorFn {
    (value: any, type: Type): any;
}

interface SerializerFn {
    (value: any, type: Type): any;
}

class TData {
    validators: ValidatorFn[] = [];
    data: { [name: string]: any } = {};
    serializer?: SerializerFn;
    deserializer?: SerializerFn;
    excludeSerializerNames?: string[];
    groups?: string[];
    referenceOptions?: { onDelete: ReferenceActions, onUpdate: ReferenceActions };
    backReference?: BackReferenceOptions<any>;
}

class TDecorator {
    t = new TData();

    onDecorator(target?: any, property?: string, parameterIndexOrDescriptor?: any) {

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

    exclude(...serializerNames: string[]) {
        this.t.excludeSerializerNames = serializerNames;
    }

    groups(...groups: string[]) {
        if (!this.t.groups) this.t.groups = [];
        this.t.groups.push(...groups);
    }

    reference(options?: { onDelete: ReferenceActions, onUpdate: ReferenceActions }) {
        this.t.referenceOptions = options;
    }

    backReference(backReference?: BackReferenceOptions<any>) {
        this.t.backReference = backReference;
    }
}

export const t = createFreeDecoratorContext(TDecorator);

@t.data('name', 1)
class U {
    @t.data('name', 1)
    name!: string;

    constructor(@t.data('name', 1) param: string) {}
}
