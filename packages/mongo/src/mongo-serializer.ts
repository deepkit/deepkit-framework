/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BSONBinarySerializer, ValueWithBSONSerializer } from '@deepkit/bson';
import {
    ContainerAccessor,
    EmptySerializer,
    ReflectionClass,
    ReflectionKind,
    TemplateState,
    Type,
    executeTemplates,
    isBinaryBigIntType,
    isMongoIdType,
    isReferenceType,
    isUUIDType,
} from '@deepkit/type';

/**
 * Serializer class from BSONBinarySerializer with a few adjustments to make sure
 * it works correctly with MongoDB.
 */
class MongoBinarySerializer extends BSONBinarySerializer {
    //import to set name so `Excluded<'mongo'>` is correctly handled
    name = 'mongo';

    constructor() {
        super({ forMongoDatabase: true });
    }
}

export const mongoBinarySerializer = new MongoBinarySerializer();

function wrapValueWithBsonSerializer(type: Type, state: TemplateState): string {
    state.setContext({ ValueWithBSONSerializer });
    return `new ValueWithBSONSerializer(${state.accessor}, ${state.setVariable('type', type)})`;
}

/**
 * A serializer that converts class type values to a wrapped value so
 * that the actual BSON serializer (MongoBinarySerializer/BSONBinarySerializer) knows how to serialize
 * them in a `any` type. (any type is used in filter & patch, since the type would be too complex otherwise).
 */
class MongoAnySerializer extends EmptySerializer {
    name = 'mongo';

    protected registerSerializers() {
        super.registerSerializers();
        this.serializeRegistry.register(ReflectionKind.string, (type, state) => {
            if (isUUIDType(type) || isMongoIdType(type)) {
                state.addSetter(wrapValueWithBsonSerializer(type, state));
            } else {
                state.addSetter(state.accessor);
            }
        });
        this.serializeRegistry.register(ReflectionKind.bigint, (type, state) => {
            if (isBinaryBigIntType(type)) {
                state.addSetter(wrapValueWithBsonSerializer(type, state));
            } else {
                state.addSetter(state.accessor);
            }
        });

        this.serializeRegistry.append(ReflectionKind.class, (type, state) => {
            if (isReferenceType(type)) {
                if (type.kind !== ReflectionKind.class && type.kind !== ReflectionKind.objectLiteral) return;
                const reflection = ReflectionClass.from(type);
                state.setContext({ ValueWithBSONSerializer });
                //the primary key is serialised for unhydrated references
                state.template = `
                    if (isObject(${state.accessor}) && !(${state.accessor} instanceof ValueWithBSONSerializer)) {
                        ${executeTemplates(state.fork(state.setter, new ContainerAccessor(state.accessor, JSON.stringify(reflection.getPrimary().getName()))), reflection.getPrimary().getType())}
                    } else {
                        ${state.setter} = ${state.accessor};
                    }
                `;
            }
        });

        this.serializeRegistry.register(ReflectionKind.undefined, (type, state) => state.addSetter(`null`));
        this.deserializeRegistry.register(ReflectionKind.undefined, (type, state) => state.addSetter(`undefined`));
    }
}

export const mongoSerializer = new MongoAnySerializer();
