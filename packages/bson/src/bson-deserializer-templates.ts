import { isPropertyMemberType } from '@deepkit/type';
import {
    binaryBigIntAnnotation,
    BinaryBigIntType,
    buildFunction,
    callExtractedFunctionIfAvailable,
    collapsePath,
    ContainerAccessor,
    createTypeGuardFunction,
    embeddedAnnotation,
    EmbeddedOptions,
    excludedAnnotation,
    executeTemplates,
    extendTemplateLiteral,
    extractStateToFunctionAndCallIt,
    getIndexCheck,
    getNameExpression,
    getStaticDefaultCodeForProperty,
    hasDefaultValue,
    isNullable,
    isOptional,
    mongoIdAnnotation,
    ReflectionClass,
    ReflectionKind,
    resolveTypeMembers,
    RuntimeCode,
    sortSignatures,
    TemplateState,
    Type,
    TypeClass,
    TypeGuardRegistry,
    TypeIndexSignature,
    TypeLiteral,
    TypeObjectLiteral,
    TypeProperty,
    TypePropertySignature,
    TypeTemplateLiteral,
    TypeTuple,
    TypeUnion,
    uuidAnnotation
} from '@deepkit/type';
import { seekElementSize } from './continuation.js';
import { BSONType, digitByteSize, isSerializable } from './utils.js';

function getNameComparator(name: string): string {
    //todo: support utf8 names
    const bufferCompare: string[] = [];
    for (let i = 0; i < name.length; i++) {
        bufferCompare.push(`state.parser.buffer[state.parser.offset + ${i}] === ${name.charCodeAt(i)}`);
    }
    bufferCompare.push(`state.parser.buffer[state.parser.offset + ${name.length}] === 0`);

    return bufferCompare.join(' && ');
}

function throwInvalidBsonType(type: Type, state: TemplateState) {
    state.setContext({ BSONType });
    return state.throwCode(type, JSON.stringify('invalid BSON type'), `'bson type ' + BSONType[state.elementType]`);
}

export function deserializeBinary(type: Type, state: TemplateState) {
    const typeVar = state.setVariable('type', type);
    state.addCode(`
        if (state.elementType === ${BSONType.BINARY}) {
            ${state.setter} = state.parser.parseBinary(${typeVar});
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeAny(type: Type, state: TemplateState) {
    state.addCode(`
        ${state.setter} = state.parser.parse(state.elementType);
    `);
}

export function deserializeNumber(type: Type, state: TemplateState) {
    const readBigInt = type.kind === ReflectionKind.bigint ? `state.parser.parseBinaryBigInt()` : `Number(state.parser.parseBinaryBigInt())`;

    state.addCode(`
        if (state.elementType === ${BSONType.INT}) {
            ${state.setter} = state.parser.parseInt();
        } else if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = 0;
        } else if (state.elementType === ${BSONType.NUMBER}) {
            ${state.setter} = state.parser.parseNumber();
        } else if (state.elementType === ${BSONType.LONG} || state.elementType === ${BSONType.TIMESTAMP}) {
            ${state.setter} = state.parser.parseLong();
        } else if (state.elementType === ${BSONType.BOOLEAN}) {
            ${state.setter} = state.parser.parseBoolean() ? 1 : 0;
        } else if (state.elementType === ${BSONType.BINARY}) {
            ${state.setter} = ${readBigInt};
        } else if (state.elementType === ${BSONType.STRING}) {
            ${state.setter} = Number(state.parser.parseString());
            if (isNaN(${state.setter})) {
                ${throwInvalidBsonType(type, state)}
            }
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeBigInt(type: Type, state: TemplateState) {
    const binaryBigInt = binaryBigIntAnnotation.getFirst(type);
    const parseBigInt = binaryBigInt === BinaryBigIntType.signed ? 'parseSignedBinaryBigInt' : 'parseBinaryBigInt';

    state.addCode(`
        if (state.elementType === ${BSONType.INT}) {
            ${state.setter} = BigInt(state.parser.parseInt());
        } else if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = 0n;
        } else if (state.elementType === ${BSONType.NUMBER}) {
            ${state.setter} = BigInt(state.parser.parseNumber());
        } else if (state.elementType === ${BSONType.LONG} || state.elementType === ${BSONType.TIMESTAMP}) {
            ${state.setter} = BigInt(state.parser.parseLong());
        } else if (state.elementType === ${BSONType.BOOLEAN}) {
            ${state.setter} = BigInt(state.parser.parseBoolean() ? 1 : 0);
        } else if (state.elementType === ${BSONType.BINARY} && ${binaryBigInt} !== undefined) {
            ${state.setter} = state.parser.${parseBigInt}();
        } else if (state.elementType === ${BSONType.STRING}) {
            ${state.setter} = BigInt(state.parser.parseString());
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeString(type: Type, state: TemplateState) {
    const branches: string[] = [];

    if (uuidAnnotation.getFirst(type)) {
        branches.push(`
         } else if (state.elementType === ${BSONType.BINARY}) {
            ${state.setter} = state.parser.parseBinary();
        `);
    } else if (mongoIdAnnotation.getFirst(type)) {
        branches.push(`
         } else if (state.elementType === ${BSONType.OID}) {
            ${state.setter} = state.parser.parseOid();
        `);
    }

    state.addCode(`
        if (state.elementType === ${BSONType.STRING}) {
            ${state.setter} = state.parser.parseString();
        } else if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = '';
        } else if (state.elementType === ${BSONType.INT}) {
            ${state.setter} = '' + state.parser.parseInt();
        } else if (state.elementType === ${BSONType.BOOLEAN}) {
            ${state.setter} = '' + state.parser.parseBoolean();
        } else if (state.elementType === ${BSONType.NUMBER}) {
            ${state.setter} = '' + state.parser.parseNumber();
        } else if (state.elementType === ${BSONType.LONG} || state.elementType === ${BSONType.TIMESTAMP}) {
            ${state.setter} = '' + state.parser.parseLong();
        ${branches.join('\n')}
        } else {
            ${throwInvalidBsonType(type, state)}
        }
        ${executeTemplates(state.fork(state.setter, state.setter).forRegistry(state.registry.serializer.deserializeRegistry), type)}
    `);
}

export function deserializeLiteral(type: TypeLiteral, state: TemplateState) {
    state.addCode(`
        ${state.setter} = ${state.setVariable('literal', type.literal)};
        seekElementSize(elementType, state.parser);
    `);
}

export function deserializeTemplateLiteral(type: TypeTemplateLiteral, state: TemplateState) {
    state.setContext({ extendTemplateLiteral: extendTemplateLiteral });
    const typeVar = state.setVariable('type', type);

    state.addCode(`
        if (state.elementType === ${BSONType.STRING}) {
            ${state.setter} = state.parser.parseString();
            if (!extendTemplateLiteral({kind: ${ReflectionKind.literal}, literal: ${state.setter}}, ${typeVar})) {
                 ${state.throwCode(type, '', state.setter)}
            }
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeNull(type: Type, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = null;
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeUndefined(type: Type, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = undefined;
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeBoolean(type: Type, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.BOOLEAN}) {
            ${state.setter} = state.parser.parseBoolean();
        } else if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = false;
        } else if (state.elementType === ${BSONType.INT}) {
            ${state.setter} = state.parser.parseInt() ? true : false;
        } else if (state.elementType === ${BSONType.NUMBER}) {
            ${state.setter} = state.parser.parseNumber() ? true : false;
        } else if (state.elementType === ${BSONType.LONG} || state.elementType === ${BSONType.TIMESTAMP}) {
            ${state.setter} = state.parser.parseLong() ? true : false;
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeDate(type: Type, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.DATE}) {
            ${state.setter} = state.parser.parseDate();
        } else if (state.elementType === ${BSONType.INT}) {
            ${state.setter} = new Date(state.parser.parseInt());
        } else if (state.elementType === ${BSONType.NUMBER}) {
            ${state.setter} = new Date(state.parser.parseNumber());
        } else if (state.elementType === ${BSONType.LONG} || state.elementType === ${BSONType.TIMESTAMP}) {
            ${state.setter} = new Date(state.parser.parseLong());
        } else if (state.elementType === ${BSONType.STRING}) {
            ${state.setter} = new Date(state.parser.parseString());
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeRegExp(type: Type, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.REGEXP}) {
            ${state.setter} = state.parser.parseRegExp();
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeUnion(bsonTypeGuards: TypeGuardRegistry, type: TypeUnion, state: TemplateState) {
    const lines: string[] = [];

    //see handleUnion from deepkit/type for more information
    const typeGuards = bsonTypeGuards.getSortedTemplateRegistries();

    for (const [specificality, typeGuard] of typeGuards) {
        for (const t of type.types) {
            const fn = createTypeGuardFunction(t, state.fork().forRegistry(typeGuard));
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `state.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${state.accessor || 'undefined'}, state, ${collapsePath(state.path)})) { //type = ${t.kind}, specificality=${specificality}
                ${executeTemplates(state.fork(state.setter, state.accessor).forPropertyName(state.propertyName), t)}
            }`);
        }
    }

    state.addCodeForSetter(`
    {
        if (!state.elementType) state.elementType = ${BSONType.OBJECT};
        const oldElementType = state.elementType;
        if (false) {
        } ${lines.join(' ')}
        else {
            ${throwInvalidBsonType(type, state)}
        }

        state.elementType = oldElementType;
    }
    `);
}

export function bsonTypeGuardUnion(bsonTypeGuards: TypeGuardRegistry, type: TypeUnion, state: TemplateState) {
    const lines: string[] = [];

    //see serializeTypeUnion from deepkit/type for more information
    const typeGuards = bsonTypeGuards.getSortedTemplateRegistries();

    for (const [specificality, typeGuard] of typeGuards) {
        for (const t of type.types) {
            const fn = createTypeGuardFunction(t, state.fork().forRegistry(typeGuard));
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `state.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${state.accessor || 'undefined'}, state)) { //type = ${t.kind}, specificality=${specificality}
                ${state.setter} = true;
            }`);
        }
    }

    state.addCodeForSetter(`
        {
            if (!state.elementType) state.elementType = ${BSONType.OBJECT};

            const oldElementType = state.elementType;
            if (false) {
            } ${lines.join(' ')}

            state.elementType = oldElementType;
        }
    `);
}

export function deserializeTuple(type: TypeTuple, state: TemplateState) {
    const result = state.compilerContext.reserveName('result');
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    const length = state.compilerContext.reserveName('length');
    state.setContext({ digitByteSize });
    const lines: string[] = [];

    let restEndOffset = 0;
    let restStart = 0;
    let hasRest = false;

    //when there are types behind a rest (e.g. [string, ...number[], boolean]), then we have to iterate overall items first to determine when to use the boolean code.
    let hasTypedBehindRest = false;
    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            hasRest = true;
            restStart = i;
            restEndOffset = type.types.length - (i + 1);
        } else if (hasRest) {
            hasTypedBehindRest = true;
        }
    }

    let j = 0;
    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            const check = hasTypedBehindRest ? `${i} >= ${j} && ${i} < ${length} - ${restEndOffset}` : `${i} >= ${j}`;
            lines.push(`
            //tuple rest item ${j}
            else if (${check}) {
                ${executeTemplates(state.fork(v).extendPath(member.name || new RuntimeCode(i)), member.type.type)}
                if (${v} !== undefined || ${isOptional(member)}) {
                    ${result}.push(${v});
                }
                ${i}++;
                continue;
            }
            `);
        } else {
            const offsetRight = type.types.length - j;
            const check = hasRest && j >= restStart ? `${length} - ${i} === ${offsetRight}` : `${i} === ${j}`;
            lines.push(`
            //tuple item ${j}
            else if (${check}) {
                ${executeTemplates(state.fork(v).extendPath(member.name || new RuntimeCode(i)), member.type)}
                if (${v} !== undefined || ${isOptional(member)}) {
                    ${result}.push(${v});
                }
                ${i}++;
                continue;
            }
            `);
        }
        j++;
    }

    let readLength = '';
    if (hasTypedBehindRest) {
        readLength = `
            const lengthStart = state.parser.offset;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                //arrays are represented as objects, so we skip the key name
                state.parser.seek(digitByteSize(${length}));

                seekElementSize(elementType, state.parser);

                ${length}++;
            }
            state.parser.offset = lengthStart;
        `;
    }

    state.addCode(`
        if (state.elementType && state.elementType !== ${BSONType.ARRAY}) ${throwInvalidBsonType({ kind: ReflectionKind.array, type: type }, state)}
        {
            var ${result} = [];
            let ${length} = 0;
            const end = state.parser.eatUInt32() + state.parser.offset;
            const oldElementType = state.elementType;

            ${readLength}

            let ${i} = 0;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                //arrays are represented as objects, so we skip the key name
                state.parser.seek(digitByteSize(${i}));
                let ${v};
                if (false) {} ${lines.join('\n')}
                ${i}++;

                //if no type match, seek
                seekElementSize(elementType, state.parser);
            }
            ${state.setter} = ${result};
            state.elementType = oldElementType;
        }
    `);
}

export function bsonTypeGuardTuple(type: TypeTuple, state: TemplateState) {
    const valid = state.compilerContext.reserveName('valid');
    const i = state.compilerContext.reserveName('i');
    const length = state.compilerContext.reserveName('length');
    state.setContext({ digitByteSize, seekElementSize });
    const lines: string[] = [];

    let restEndOffset = 0;
    let restStart = 0;
    let hasRest = false;

    //when there are types behind a rest (e.g. [string, ...number[], boolean]), then we have to iterate overall items first to determine when to use the boolean code.
    let hasTypedBehindRest = false;
    for (let i = 0; i < type.types.length; i++) {
        if (type.types[i].type.kind === ReflectionKind.rest) {
            hasRest = true;
            restStart = i;
            restEndOffset = type.types.length - (i + 1);
        } else if (hasRest) {
            hasTypedBehindRest = true;
        }
    }

    let j = 0;
    for (const member of type.types) {
        if (member.type.kind === ReflectionKind.rest) {
            const check = hasTypedBehindRest ? `${i} >= ${j} && ${i} < ${length} - ${restEndOffset}` : `${i} >= ${j}`;
            lines.push(`
            //tuple rest item ${j}
            else if (${check}) {
                ${executeTemplates(state.fork(valid).extendPath(new RuntimeCode(i)), member.type.type)}
                if (!${valid}) {
                    break;
                }
                ${i}++;
                seekElementSize(elementType, state.parser);
                continue;
            }
            `);
        } else {
            const offsetRight = type.types.length - j;
            const check = hasRest && j >= restStart ? `${length} - ${i} === ${offsetRight}` : `${i} === ${j}`;
            lines.push(`
            //tuple item ${j}
            else if (${check}) {
                ${executeTemplates(state.fork(valid).extendPath(new RuntimeCode(i)), member.type)}
                if (!${valid}) {
                    break;
                }
                ${i}++;
                seekElementSize(elementType, state.parser);
                continue;
            }
            `);
        }
        j++;
    }

    let readLength = '';
    if (hasTypedBehindRest) {
        readLength = `
            const lengthStart = state.parser.offset;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                //arrays are represented as objects, so we skip the key name
                state.parser.seek(digitByteSize(${length}));

                seekElementSize(elementType, state.parser);

                ${length}++;
            }
            state.parser.offset = lengthStart;
        `;
    }

    state.addCode(`
        let ${valid} = state.elementType && state.elementType === ${BSONType.ARRAY};
        if (${valid}){
            let ${length} = 0;
            const start = state.parser.offset;
            const end = state.parser.eatUInt32() + state.parser.offset;
            const oldElementType = state.elementType;

            ${readLength}

            let ${i} = 0;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;
                //arrays are represented as objects, so we skip the key name
                state.parser.seek(digitByteSize(${i}));

                if (false) {} ${lines.join('\n')}

                //if no type match, seek
                ${i}++;
                seekElementSize(elementType, state.parser);
            }
            state.elementType = oldElementType;
            state.parser.offset = start;
        }
        ${state.setter} = ${valid};
    `);
}

export function deserializeArray(elementType: Type, state: TemplateState) {
    const result = state.compilerContext.reserveName('result');
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    state.setContext({ digitByteSize });

    state.addCode(`
        if (state.elementType && state.elementType !== ${BSONType.ARRAY}) ${throwInvalidBsonType({ kind: ReflectionKind.array, type: elementType }, state)}
        {
            var ${result} = [];
            const end = state.parser.eatUInt32() + state.parser.offset;
            const oldElementType = state.elementType;

            let ${i} = 0;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                //arrays are represented as objects, so we skip the key name
                state.parser.seek(digitByteSize(${i}));

                let ${v};
                ${executeTemplates(state.fork(v, '').extendPath(new RuntimeCode(i)), elementType)}
                ${result}.push(${v});
                ${i}++;
            }
            ${state.setter} = ${result};
            state.elementType = oldElementType;
        }
    `);
}

/**
 * This array type guard goes through all array elements in order to determine the correct type.
 * This is only necessary when a union has at least 2 array members, otherwise a simple array check is enough.
 */
export function bsonTypeGuardArray(elementType: Type, state: TemplateState) {
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    state.setContext({ digitByteSize, seekElementSize });

    const typeGuardCode = executeTemplates(state.fork(v, '').extendPath(new RuntimeCode(i)), elementType);

    state.addCode(`
        ${state.setter} = state.elementType && state.elementType === ${BSONType.ARRAY};

        if (${state.setter}) {
            const start = state.parser.offset;
            const oldElementType = state.elementType;
            const end = state.parser.eatUInt32() + state.parser.offset;

            let ${i} = 0;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                //arrays are represented as objects, so we skip the key name
                state.parser.seek(digitByteSize(${i}));

                let ${v};
                ${typeGuardCode}
                if (!${v}) {
                    ${state.setter} = false;
                    break;
                }

                //since type guards don't eat, we seek automatically forward
                seekElementSize(elementType, state.parser);
                ${i}++;
            }

            state.parser.offset = start;
            state.elementType = oldElementType;
        }
    `);
}

export function getEmbeddedClassesForProperty(type: Type): { type: TypeClass, options: EmbeddedOptions }[] {
    if (type.kind === ReflectionKind.propertySignature || type.kind === ReflectionKind.property) type = type.type;
    const res: { type: TypeClass, options: EmbeddedOptions }[] = [];

    if (type.kind === ReflectionKind.union) {
        for (const t of type.types) {
            if (t.kind === ReflectionKind.class) {
                const embedded = embeddedAnnotation.getFirst(t);
                if (embedded) res.push({ options: embedded, type: t });
            }
        }
    } else if (type.kind === ReflectionKind.class) {
        const embedded = embeddedAnnotation.getFirst(type);
        if (embedded) res.push({ options: embedded, type: type });
    }

    return res;
}

export function deserializeObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    //emdedded for the moment disabled. treat it as normal property.
    // const embedded = embeddedAnnotation.getFirst(type);
    // if (type.kind === ReflectionKind.class && embedded) {
    //     const container = state.compilerContext.reserveName('container');
    //
    //     const embedded = deserializeEmbedded(type, state.fork(undefined, container).forRegistry(state.registry.serializer.deserializeRegistry));
    //     if (embedded) {
    //         state.addCode(`
    //             const ${container} = state.parser.parse(state.elementType);
    //             console.log('container data', '${state.setter}', ${container});
    //             ${embedded}
    //         `);
    //         return;
    //     }
    // }

    if (callExtractedFunctionIfAvailable(state, type)) return;
    const extract = extractStateToFunctionAndCallIt(state, type);
    state = extract.state;

    const lines: string[] = [];
    const signatures: TypeIndexSignature[] = [];
    const object = state.compilerContext.reserveName('object');

    const resetDefaultSets: string[] = [];

    //run code for properties that had no value in the BSON. either set static values (literal, or null), or throw an error.
    const setDefaults: string[] = [];

    interface HandleEmbedded {
        type: TypeClass;
        valueSetVar: string;
        property: TypeProperty | TypePropertySignature;
        containerVar: string;
    }

    const handleEmbeddedClasses: HandleEmbedded[] = [];

    for (const member of resolveTypeMembers(type)) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        }
        if (!isPropertyMemberType(member)) continue;
        if (!isSerializable(member.type)) continue;
        if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

        const nameInBson = String(state.namingStrategy.getPropertyName(member, state.registry.serializer.name));
        const valueSetVar = state.compilerContext.reserveName('valueSetVar');

        // //since Embedded<T> can have arbitrary prefix, we have to collect all fields first, and then after the loop, build everything together.
        // const embeddedClasses = getEmbeddedClassesForProperty(member);
        // //todo:
        // // 1. Embedded in a union need for each entry in the union (there can be multiple Embedded in one union) to collect all possible values. We collect them into own container
        // // then run the typeGuardObjectLiteral on it at the end of the loop, if the member was not already set. this works the same for non-union members as well, right?
        // // 2. we have to delay detecting the union, right? Otherwise `Embedded<T, {prefix: 'p'}> | string` will throw an error that it can't convert undefined to string, when
        // // ${member.name} is not provided.
        // // 3. we could also collect all values in a loop earlier?
        // if (embeddedClasses.length) {
        //     for (const embedded of embeddedClasses) {
        //         const constructorProperties = getConstructorProperties(embedded.type);
        //         if (!constructorProperties.properties.length) throw new BSONError(`Can not embed class ${getClassName(embedded.type.classType)} since it has no constructor properties`);
        //
        //         const containerVar = state.compilerContext.reserveName('container');
        //         const handleEmbedded: HandleEmbedded = {
        //             type: embedded.type, containerVar, property: member, valueSetVar
        //         };
        //         handleEmbeddedClasses.push(handleEmbedded);
        //
        //         for (const property of constructorProperties.properties) {
        //             const setter = getEmbeddedPropertyName(state.namingStrategy, property, embedded.options);
        //             const accessor = getEmbeddedAccessor(embedded.type, constructorProperties.properties.length !== 1, nameInBson, state.namingStrategy, property, embedded.options);
        //             //todo: handle explicit undefined and non-existing
        //             lines.push(`
        //             if (${getNameComparator(accessor)}) {
        //                 state.parser.offset += ${accessor.length} + 1;
        //                 ${executeTemplates(state.fork(new ContainerAccessor(containerVar, JSON.stringify(setter)), ''), property.type)};
        //                 continue;
        //             }
        //             `);
        //         }
        //     }
        // }

        resetDefaultSets.push(`var ${valueSetVar} = false;`);
        const setter = new ContainerAccessor(object, JSON.stringify(member.name));
        const staticDefault = getStaticDefaultCodeForProperty(member, setter, state);
        let throwInvalidTypeError = '';
        if (!isOptional(member) && !hasDefaultValue(member)) {
            throwInvalidTypeError = state.fork().extendPath(member.name).throwCode(member.type as Type, '', `'undefined value'`);
        }
        setDefaults.push(`if (!${valueSetVar}) { ${staticDefault || throwInvalidTypeError} } `);

        let seekOnExplicitUndefined = '';
        //handle explicitly set `undefined`, by jumping over the registered deserializers. if `null` is given and the property has no null type, we treat it as undefined.
        if (isOptional(member) || hasDefaultValue(member)) {
            const setUndefined = isOptional(member) ? `${setter} = undefined;` : hasDefaultValue(member) ? `` : `${setter} = undefined;`;
            const check = isNullable(member) ? `elementType === ${BSONType.UNDEFINED}` : `elementType === ${BSONType.UNDEFINED} || elementType === ${BSONType.NULL}`;
            seekOnExplicitUndefined = `
            if (${check}) {
                ${setUndefined}
                seekElementSize(elementType, state.parser);
                continue;
            }`;
        }

        const setterTemplate = executeTemplates(state.fork(setter, '').extendPath(member.name), member.type);

        lines.push(`
            //property ${String(member.name)} (${member.type.kind})
            else if (!${valueSetVar} && ${getNameComparator(nameInBson)}) {
                state.parser.offset += ${nameInBson.length} + 1;
                ${valueSetVar} = true;

                ${seekOnExplicitUndefined}
                ${setterTemplate}
                continue;
            }
        `);
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const signatureLines: string[] = [];

        sortSignatures(signatures);

        for (const signature of signatures) {
            const check = isOptional(signature.type) ? `` : `elementType !== ${BSONType.UNDEFINED} &&`;
            signatureLines.push(`else if (${check} ${getIndexCheck(state, i, signature.index)}) {
                ${executeTemplates(state.fork(`${object}[${i}]`).extendPath(new RuntimeCode(i)).forPropertyName(new RuntimeCode(i)), signature.type)}
                continue;
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`else {
        let ${i} = state.parser.eatObjectPropertyName();

        if (false) {} ${signatureLines.join(' ')}

        //if no index signature matches, we skip over it
        seekElementSize(elementType, state.parser);
        continue;
        }`);
    }

    state.setContext({ seekElementSize });

    let initializeObject = `{}`;
    let createClassInstance = ``;
    if (type.kind === ReflectionKind.class && type.classType !== Object) {
        const reflection = ReflectionClass.from(type.classType);
        const constructor = reflection.getConstructorOrUndefined();
        if (constructor && constructor.parameters.length) {
            const constructorArguments: string[] = [];
            for (const parameter of constructor.getParameters()) {
                const name = getNameExpression(parameter.getName(), state);
                constructorArguments.push(parameter.getVisibility() === undefined ? 'undefined' : `${object}[${name}]`);
            }

            createClassInstance = `
                ${state.setter} = new ${state.compilerContext.reserveConst(type.classType, 'classType')}(${constructorArguments.join(', ')});
                Object.assign(${state.setter}, ${object});
            `;
        } else {
            initializeObject = `new ${state.compilerContext.reserveConst(type.classType, 'classType')}()`;
        }
    }

    const handleEmbeddedClassesLines: string[] = [];
    // for (const handle of handleEmbeddedClasses) {
    //     // const constructorProperties = getConstructorProperties(handle.type);
    //     const setter = new ContainerAccessor(object, JSON.stringify(handle.property.name));
    //     handleEmbeddedClassesLines.push(`
    //         ${deserializeEmbedded(handle.type, state.fork(setter, handle.containerVar).forRegistry(state.registry.serializer.deserializeRegistry), handle.containerVar)}
    //         if (${inAccessor(setter)}) {
    //             ${handle.valueSetVar} = true;
    //         }
    //     `);
    // }

    state.addCode(`
        if (state.elementType && state.elementType !== ${BSONType.OBJECT}) ${throwInvalidBsonType(type, state)}
        var ${object} = ${initializeObject};
        ${handleEmbeddedClasses.map(v => `const ${v.containerVar} = {};`).join('\n')}
        {
            const end = state.parser.eatUInt32() + state.parser.offset;

            ${resetDefaultSets.join('\n')}

            const oldElementType = state.elementType;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                if (false) {} ${lines.join('\n')}

                //jump over this property when not registered in schema
                while (state.parser.offset < end && state.parser.buffer[state.parser.offset++] != 0);

                //seek property value
                if (state.parser.offset >= end) break;
                seekElementSize(elementType, state.parser);
            }

            ${handleEmbeddedClassesLines.join('\n')}
            ${setDefaults.join('\n')}
            ${state.setter} = ${object};
            ${createClassInstance}

            state.elementType = oldElementType;
        }
    `);

    extract.setFunction(buildFunction(state, type));
}

export function bsonTypeGuardObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    //emdedded for the moment disabled. treat it as normal property.
    // const embedded = embeddedAnnotation.getFirst(type);
    // if (type.kind === ReflectionKind.class && embedded && state.target === 'deserialize') {
    //     const container = state.compilerContext.reserveName('container');
    //     const sub = state.fork(undefined, container).forRegistry(state.registry.serializer.typeGuards.getRegistry(1));
    //     typeGuardEmbedded(type, sub, embedded);
    //     state.addCode(`
    //         const ${container} = state.parser.read(state.elementType);
    //         console.log('container data', '${state.setter}', ${container});
    //         ${sub.template}
    //     `);
    //     return;
    // }

    if (callExtractedFunctionIfAvailable(state, type)) return;
    const extract = extractStateToFunctionAndCallIt(state, type);
    state = extract.state;

    const lines: string[] = [];
    const signatures: TypeIndexSignature[] = [];
    const valid = state.compilerContext.reserveName('valid');

    const resetDefaultSets: string[] = [];

    //run code for properties that had no value in the BSON. either set static values (literal, or null), or throw an error.
    const setDefaults: string[] = [];

    for (const member of resolveTypeMembers(type)) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        }
        if (!isPropertyMemberType(member)) continue;
        if (!isSerializable(member.type)) continue;
        if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

        const nameInBson = String(state.namingStrategy.getPropertyName(member, state.registry.serializer.name));

        const valueSetVar = state.compilerContext.reserveName('valueSetVar');
        resetDefaultSets.push(`var ${valueSetVar} = false;`);
        let invalidType = '';
        if (!isOptional(member) && !hasDefaultValue(member)) {
            invalidType = `${valid} = false`;
        }
        setDefaults.push(`if (!${valueSetVar}) { ${invalidType} } `);

        let seekOnExplicitUndefined = '';
        //handle explicitly set `undefined`, by jumping over the registered deserializers. if `null` is given and the property has no null type, we treat it as undefined.
        if (isOptional(member) || hasDefaultValue(member)) {
            const check = isNullable(member) ? `elementType === ${BSONType.UNDEFINED}` : `elementType === ${BSONType.UNDEFINED} || elementType === ${BSONType.NULL}`;
            seekOnExplicitUndefined = `
            if (${check}) {
                seekElementSize(elementType, state.parser);
                continue;
            }`;
        }

        const template = executeTemplates(state.fork(valid).extendPath(member.name), member.type);

        lines.push(`
            //property ${String(member.name)} (${member.type.kind})
            else if (!${valueSetVar} && ${getNameComparator(nameInBson)}) {
                state.parser.offset += ${nameInBson.length} + 1;
                ${valueSetVar} = true;

                ${seekOnExplicitUndefined}
                ${template}

                if (!${valid}) break;
                //guards never eat/parse parser, so we jump over the value automatically
                seekElementSize(elementType, state.parser);
                continue;
            }
        `);
    }

    if (signatures.length) {
        const i = state.compilerContext.reserveName('i');
        const signatureLines: string[] = [];

        sortSignatures(signatures);

        for (const signature of signatures) {
            signatureLines.push(`else if (${getIndexCheck(state, i, signature.index)}) {
                ${executeTemplates(state.fork(valid).extendPath(new RuntimeCode(i)).forPropertyName(new RuntimeCode(i)), signature.type)}

                if (!${valid}) break;
                //guards never eat/parse parser, so we jump over the value automatically
                seekElementSize(elementType, state.parser);
                continue;
            }`);
        }

        //the index signature type could be: string, number, symbol.
        //or a literal when it was constructed by a mapped type.
        lines.push(`else {
        let ${i} = state.parser.eatObjectPropertyName();

        if (false) {} ${signatureLines.join(' ')}

        //if no index signature matches, we skip over it
        seekElementSize(elementType, state.parser);
        }`);
    }

    state.setContext({ seekElementSize });

    state.addCode(`
        ${state.setter} = state.elementType && state.elementType === ${BSONType.OBJECT};
        if (${state.setter}) {
            let ${valid} = true;
            const start = state.parser.offset;
            const end = state.parser.eatUInt32() + state.parser.offset;

            ${resetDefaultSets.join('\n')}

            const oldElementType = state.elementType;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                if (false) {} ${lines.join('\n')}

                //jump over this property when not registered in schema
                while (state.parser.offset < end && state.parser.buffer[state.parser.offset++] != 0);

                //seek property value
                if (state.parser.offset >= end) break;
                seekElementSize(elementType, state.parser);
            }

            ${setDefaults.join('\n')}

            state.elementType = oldElementType;
            state.parser.offset = start;

            ${state.setter} = ${valid};
        }
    `);

    extract.setFunction(buildFunction(state, type));
}

export function bsonTypeGuardForBsonTypes(types: BSONType[]): (type: Type, state: TemplateState) => void {
    return (type, state) => {
        state.addSetter(types.map(v => `state.elementType === ${v}`).join(' || '));

        const decoratorTemplates = state.registry.getDecorator(type).slice();
        decoratorTemplates.push(...state.registry.serializer.typeGuards.getRegistry(1).getDecorator(type));
        if (decoratorTemplates.length) {
            const value = state.compilerContext.reserveName('value');
            const decoratorState = state.fork(undefined, value);
            for (const template of decoratorTemplates) template(type, decoratorState);
            if (!decoratorState.template) return;

            state.addCode(`
                let ${value} = state.parser.read(state.elementType, ${decoratorState.compilerContext.reserveConst(type, 'type')});
                ${decoratorState.template}
            `);
        }
    };
}

export function bsonTypeGuardLiteral(type: TypeLiteral, state: TemplateState) {
    const literal = state.setVariable('literal', type.literal);
    state.addSetter(`state.parser.read(state.elementType) === ${literal}`);
}

export function bsonTypeGuardTemplateLiteral(type: TypeTemplateLiteral, state: TemplateState) {
    state.setContext({ extendTemplateLiteral: extendTemplateLiteral });
    const typeVar = state.setVariable('type', type);
    state.addSetterAndReportErrorIfInvalid('type', 'Invalid literal', `state.elementType === ${BSONType.STRING} && extendTemplateLiteral({kind: ${ReflectionKind.literal}, literal: state.parser.read(state.elementType)}, ${typeVar})`);
}
