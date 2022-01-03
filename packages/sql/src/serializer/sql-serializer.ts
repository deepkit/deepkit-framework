/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    ContainerAccessor,
    executeTemplates,
    nodeBufferToArrayBuffer,
    referenceAnnotation,
    ReflectionClass,
    ReflectionKind,
    Serializer,
    TemplateState,
    Type,
    TypeArray,
    TypeClass,
    typedArrayToBuffer,
    TypeObjectLiteral,
    uuidAnnotation
} from '@deepkit/type';

export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

function isParentIsProperty(type: Type): boolean {
    if (!type.parent) return false;
    if (type.parent.kind === ReflectionKind.union) type = type.parent;
    if (!type.parent) return false;
    return type.parent.kind === ReflectionKind.propertySignature || type.parent.kind === ReflectionKind.property;
}

/**
 * For sql databases, objects will be serialised as JSON string.
 */
function serializeSqlArray(type: TypeArray, state: TemplateState) {
    if (undefined !== referenceAnnotation.getFirst(type)) return;

    if (!isParentIsProperty(type)) return;

    state.setContext({ stringify: JSON.stringify });
    state.addSetter(`state.depth === 0 ? stringify(${state.accessor}) : ${state.accessor}`);
}

/**
 * For sql databases, objects will be serialised as JSON string.
 */
function deserializeSqlArray(type: TypeArray, state: TemplateState) {
    if (undefined !== referenceAnnotation.getFirst(type)) return;

    if (!isParentIsProperty(type)) return;

    state.addSetter(`state.depth === 0 && 'string' === typeof ${state.accessor} ? JSON.parse(${state.accessor}) : ${state.accessor}`);
}

/**
 * For sql databases, objects will be serialised as JSON string.
 */
function serializeSqlObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    if (undefined !== referenceAnnotation.getFirst(type)) return;

    if (!isParentIsProperty(type)) return;

    state.setContext({ stringify: JSON.stringify });
    state.addSetter(`state.depth === 0 ? stringify(${state.accessor}) : ${state.accessor}`);
}

export class SqlSerializer extends Serializer {
    name = 'sql';

    protected registerSerializers() {
        super.registerSerializers();

        this.serializeRegistry.registerClass(Date, (type, state) => {
            //SQL escape does the job.
            state.addSetter(`${state.accessor}`);
        });

        this.deserializeRegistry.addDecorator(ReflectionKind.string, (type, state) => {
            if (undefined === uuidAnnotation.getFirst(type)) return;
            state.setContext({ uuid4Stringify });
            state.addCodeForSetter(`
                try {
                    ${state.setter} = 'string' === typeof ${state.accessor} ? ${state.accessor} : uuid4Stringify(${state.accessor});
                } catch (error) {
                    throw new TypeError('Invalid UUID v4: ' + error);
                }
            `);
        });

        this.serializeRegistry.addDecorator(ReflectionKind.string, (type, state) => {
            if (undefined === uuidAnnotation.getFirst(type)) return;
            state.setContext({ uuid4Binary });
            state.addCodeForSetter(`
                try {
                    ${state.setter} = uuid4Binary(${state.accessor});
                } catch (error) {
                    throw new TypeError('Invalid UUID v4: ' + error);
                }
            `);
        });

        this.serializeRegistry.append(ReflectionKind.class, serializeSqlObjectLiteral);
        this.serializeRegistry.append(ReflectionKind.objectLiteral, serializeSqlObjectLiteral);
        this.serializeRegistry.append(ReflectionKind.array, serializeSqlArray);
        this.deserializeRegistry.append(ReflectionKind.array, deserializeSqlArray);

        //for databases, types decorated with Reference will always only export the primary key.
        this.serializeRegistry.addDecorator(ReflectionKind.class, (type, state) => {
            if (undefined === referenceAnnotation.getFirst(type)) return;
            // state.setContext({ isObject, isReferenceType, isReferenceHydrated });
            const reflection = ReflectionClass.from(type.classType);
            //the primary key is serialised for unhydrated references
            state.template = `
                ${executeTemplates(state.fork(state.setter, new ContainerAccessor(state.accessor, JSON.stringify(reflection.getPrimary().getName()))), reflection.getPrimary().getType())}
            `;
        });

        this.serializeRegistry.registerBinary((type, state) => {
            if (type.classType === ArrayBuffer) {
                state.setContext({ Buffer });
                state.addSetter(`Buffer.from(${state.accessor})`);
            } else {
                state.setContext({ typedArrayToBuffer });
                state.addSetter(`typedArrayToBuffer(${state.accessor})`);
            }
        });

        this.deserializeRegistry.registerBinary((type, state) => {
            if (type.classType === ArrayBuffer) {
                state.setContext({ nodeBufferToArrayBuffer });
                state.addSetter(`nodeBufferToArrayBuffer(${state.accessor})`);
            } else {
                state.addSetter(`nodeBufferToTypedArray(${state.accessor}, ${state.setVariable('typeArray', type.classType)})`);
            }
        });
    }
}

export const sqlSerializer: Serializer = new SqlSerializer;

export function uuid4Binary(u: any): Buffer {
    return 'string' === typeof u ? Buffer.from(u.replace(/-/g, ''), 'hex') : Buffer.alloc(0);
}

export function uuid4Stringify(buffer: Buffer): string {
    return hexTable[buffer[0]] + hexTable[buffer[1]] + hexTable[buffer[2]] + hexTable[buffer[3]]
        + '-'
        + hexTable[buffer[4]] + hexTable[buffer[5]]
        + '-'
        + hexTable[buffer[6]] + hexTable[buffer[7]]
        + '-'
        + hexTable[buffer[8]] + hexTable[buffer[9]]
        + '-'
        + hexTable[buffer[10]] + hexTable[buffer[11]] + hexTable[buffer[12]] + hexTable[buffer[13]] + hexTable[buffer[14]] + hexTable[buffer[15]]
        ;
}

//
// sqlSerializer.toClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
//     //when property is a reference, then we stored in the database the actual primary key and used this
//     //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
//     const classSchema = getClassSchema(property.resolveClassType!);
//
//     //note: jsonSerializer already calls JSON.parse if data is a string
//
//     if (property.isReference) {
//         const primary = classSchema.getPrimaryField();
//         state.addCodeForSetter(getDataConverterJS(state.setter, state.accessor, primary, state.serializerCompilers, state.compilerContext, state.jitStack));
//         state.forceEnd();
//     }
//
//     return;
// });

// sqlSerializer.fromClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
//     //When property is a reference we store the actual primary (as foreign key) of the referenced instance instead of the actual instance.
//     //This way we implemented basically relations in the database
//     const classSchema = getClassSchema(property.resolveClassType!);
//
//     if (property.isReference) {
//         const classType = state.setVariable('classType', property.resolveClassType);
//         state.compilerContext.context.set('isObject', isObject);
//         const primary = classSchema.getPrimaryField();
//
//         state.addCodeForSetter(`
//             if (isObject(${state.accessor})) {
//                 ${getDataConverterJS(state.setter, `${state.accessor}.${primary.name}`, primary, state.serializerCompilers, state.compilerContext, state.jitStack)}
//             } else {
//                 //we treat the input as if the user gave the primary key directly
//                 ${getDataConverterJS(state.setter, `${state.accessor}`, primary, state.serializerCompilers, state.compilerContext, state.jitStack)}
//             }
//             `
//         );
//         state.forceEnd();
//     }
// });

// sqlSerializer.fromClass.append('class', (property: PropertySchema, state: CompilerState) => {
//     if (property.isReference) return;
//
//     //we don't stringify non-root properties
//     if (property.parent) return;
//
//     //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
//     //but only on root properties.
//     state.setContext({ stringify: JSON.stringify });
//     state.addSetter(`_depth === 1 ? stringify(${state.accessor}) : ${state.accessor}`);
// });

// sqlSerializer.toClass.prepend('class', (property: PropertySchema, state: CompilerState) => {
//     //when property is a reference, then we stored in the database the actual primary key and used this
//     //field as foreignKey. This makes it necessary to convert it differently (concretely we treat it as the primary)
//     const classSchema = getClassSchema(property.resolveClassType!);
//
//     //note: jsonSerializer already calls JSON.parse if data is a string
//
//     if (property.isReference) {
//         const primary = classSchema.getPrimaryField();
//         state.addCodeForSetter(getDataConverterJS(state.setter, state.accessor, primary, state.serializerCompilers, state.compilerContext, state.jitStack));
//         state.forceEnd();
//     }
//
//     return;
// });

// sqlSerializer.fromClass.register('array', (property: PropertySchema, state: CompilerState) => {
//     if (property.isReference) return;
//
//     //we don't stringify non-root properties
//     if (property.parent) return;
//
//     //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
//     //but only on root properties.
//     state.setContext({ stringify: JSON.stringify });
//     state.addSetter(`_depth === 1 ? stringify(${state.accessor}) : ${state.accessor}`);
// });

// sqlSerializer.toClass.prepend('array', (property: PropertySchema, state: CompilerState) => {
//     if (property.parent) return;
//
//     state.addSetter(`'string' === typeof ${state.accessor} ? JSON.parse(${state.accessor}) : ${state.accessor}`);
// });
//
// sqlSerializer.fromClass.append('record', (property: PropertySchema, state: CompilerState) => {
//     //we don't stringify non-root properties
//     if (property.parent) return;
//
//     //we need to convert the structure to JSON-string after it has been converted to JSON values from the previous compiler
//     //but only on root properties.
//     state.setContext({ stringify: JSON.stringify });
//     state.addSetter(`_depth === 1 ? stringify(${state.accessor}) : ${state.accessor}`);
// });

// sqlSerializer.toClass.prepend('record', (property: PropertySchema, state: CompilerState) => {
//     if (property.parent) return;
//
//     state.addSetter(`'string' === typeof ${state.accessor} ? JSON.parse(${state.accessor}) : ${state.accessor}`);
// });
