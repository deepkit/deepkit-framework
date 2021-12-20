import {
    binaryBigIntAnnotation,
    BinaryBigIntType,
    collapsePath,
    createTypeGuardFunction,
    excludedAnnotation,
    executeTemplates,
    extendTemplateLiteral,
    getNameExpression,
    getStaticDefaultCodeForProperty,
    hasDefaultValue,
    isNullable,
    isOptional,
    OuterType,
    ReflectionClass,
    ReflectionKind,
    RuntimeCode,
    SerializationError,
    stringifyType,
    TemplateState,
    TypeClass,
    TypeGuardRegistry,
    TypeIndexSignature,
    TypeLiteral,
    TypeObjectLiteral,
    TypeTemplateLiteral,
    TypeTuple,
    TypeUnion
} from '@deepkit/type';
import { seekElementSize } from './continuation';
import { BSONType, digitByteSize } from './utils';

function getNameComparator(name: string): string {
    //todo: support utf8 names
    const bufferCompare: string[] = [];
    for (let i = 0; i < name.length; i++) {
        bufferCompare.push(`state.parser.buffer[state.parser.offset + ${i}] === ${name.charCodeAt(i)}`);
    }
    bufferCompare.push(`state.parser.buffer[state.parser.offset + ${name.length}] === 0`);

    return bufferCompare.join(' && ');
}

function throwInvalidBsonType(type: OuterType, state: TemplateState) {
    state.setContext({ BSONType });
    return state.throwCode(type, JSON.stringify('invalid BSON type'), `'bson type ' + BSONType[state.elementType]`);
}

export function deserializeBinary(type: OuterType, state: TemplateState) {
    const typeVar = state.setVariable('type', type);
    state.addCode(`
        if (state.elementType === ${BSONType.BINARY}) {
            ${state.setter} = state.parser.parseBinary(${typeVar});
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeNumber(type: OuterType, state: TemplateState) {
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

export function deserializeBigInt(type: OuterType, state: TemplateState) {
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

export function deserializeString(type: OuterType, state: TemplateState) {
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

export function deserializeNull(type: OuterType, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = null;
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeUndefined(type: OuterType, state: TemplateState) {
    state.addCode(`
        if (state.elementType === ${BSONType.NULL} || state.elementType === ${BSONType.UNDEFINED}) {
            ${state.setter} = undefined;
        } else {
            ${throwInvalidBsonType(type, state)}
        }
    `);
}

export function deserializeBoolean(type: OuterType, state: TemplateState) {
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

export function deserializeDate(type: OuterType, state: TemplateState) {
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

export function deserializeRegExp(type: OuterType, state: TemplateState) {
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

    //see serializeTypeUnion from deepkit/type for more information
    const typeGuards = bsonTypeGuards.getSortedTemplateRegistries();

    for (const [specificality, typeGuard] of typeGuards) {
        for (const t of type.types) {
            const fn = createTypeGuardFunction({ type: t, registry: typeGuard });
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `state.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${state.accessor || 'undefined'}, state)) { //type = ${ReflectionKind[t.kind]}, specificality=${specificality}
                ${executeTemplates(state.fork(state.setter, state.accessor).forPropertyName(state.propertyName), t)}
            }`);
        }
    }

    state.addCodeForSetter(`
    {
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
            const fn = createTypeGuardFunction({ type: t, registry: typeGuard });
            if (!fn) continue;
            const guard = state.setVariable('guard' + t.kind, fn);
            const looseCheck = specificality <= 0 ? `state.loosely && ` : '';

            lines.push(`else if (${looseCheck}${guard}(${state.accessor || 'undefined'}, state)) { //type = ${ReflectionKind[t.kind]}, specificality=${specificality}
                ${state.setter} = true;
            }`);
        }
    }

    state.addCodeForSetter(`
        {
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
                ${executeTemplates(state.fork(v).extendPath(new RuntimeCode(i)), member.type.type)}
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
                ${executeTemplates(state.fork(v).extendPath(new RuntimeCode(i)), member.type)}
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
        /*
            Deserialize tuple: ${stringifyType(type)}
        */
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
        /*
            Type guard tuple: ${stringifyType(type)}
        */
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

export function deserializeArray(elementType: OuterType, state: TemplateState) {
    const result = state.compilerContext.reserveName('result');
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    state.setContext({ digitByteSize });

    state.addCode(`
        /*
            Deserialize array: ${stringifyType(elementType)}
        */
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
export function bsonTypeGuardArray(elementType: OuterType, state: TemplateState) {
    const v = state.compilerContext.reserveName('v');
    const i = state.compilerContext.reserveName('i');
    state.setContext({ digitByteSize, seekElementSize });

    const typeGuardCode = executeTemplates(state.fork(v, '').extendPath(new RuntimeCode(i)), elementType);
    if (!typeGuardCode) throw new SerializationError('No template registered for ' + stringifyType(elementType), collapsePath(state.path));

    state.addCode(`
        /*
            Type guard for array: ${stringifyType(elementType)}
        */
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

export function deserializeObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    const lines: string[] = [];
    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];
    const object = state.compilerContext.reserveName('object');

    const resetDefaultSets: string[] = [];

    //run code for properties that had no value in the BSON. either set static values (literal, or null), or throw an error.
    const setDefaults: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        }
        if (member.kind !== ReflectionKind.property && member.kind !== ReflectionKind.propertySignature) continue;
        if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

        const nameInBson = String(state.namingStrategy.getPropertyName(member));
        existing.push(JSON.stringify(nameInBson));

        const valueSetVar = state.setVariable('valueSetVar', false);
        resetDefaultSets.push(`${valueSetVar} = false;`);
        const setter = `${object}[${JSON.stringify(member.name)}]`;
        const staticDefault = getStaticDefaultCodeForProperty(member, setter, state);
        let throwInvalidTypeError = '';
        if (!isOptional(member) && !hasDefaultValue(member)) {
            throwInvalidTypeError = state.throwCode(member.type as OuterType, '', `'undefined value'`);
        }
        setDefaults.push(`if (!${valueSetVar}) { ${staticDefault || throwInvalidTypeError} } `);

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

        lines.push(`
            //property ${String(member.name)} (${member.type.kind})
            if (!${valueSetVar} && ${getNameComparator(nameInBson)}) {
                state.parser.offset += ${nameInBson.length} + 1;
                ${valueSetVar} = true;

                ${seekOnExplicitUndefined}
                ${executeTemplates(state.fork(setter, '').extendPath(member.name), member.type) || `throw new Error('No template found for ${member.kind}')`}
                continue;
            }
        `);
    }

    state.setContext({ seekElementSize });

    let initializeObject = `{}`;
    let createClassInstance = ``;
    if (type.kind === ReflectionKind.class && type.classType !== Object) {
        const reflection = ReflectionClass.from(type.classType);
        const constructor = reflection.getConstructor();
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

    state.addCode(`
        /*
            Deserialize object: ${stringifyType(type)}
        */
        if (state.elementType && state.elementType !== ${BSONType.OBJECT}) ${throwInvalidBsonType(type, state)}
        var ${object} = ${initializeObject};
        {
            const end = state.parser.eatUInt32() + state.parser.offset;

            ${resetDefaultSets.join('\n')}

            const oldElementType = state.elementType;
            while (state.parser.offset < end) {
                const elementType = state.elementType = state.parser.eatByte();
                if (elementType === 0) break;

                ${lines.join('\n')}

                //jump over this property when not registered in schema
                while (state.parser.offset < end && state.parser.buffer[state.parser.offset++] != 0);

                //seek property value
                if (state.parser.offset >= end) break;
                seekElementSize(elementType, state.parser);
            }

            ${setDefaults.join('\n')}
            ${state.setter} = ${object};
            ${createClassInstance};

            state.elementType = oldElementType;
        }
    `);
}

export function bsonTypeGuardObjectLiteral(type: TypeClass | TypeObjectLiteral, state: TemplateState) {
    const lines: string[] = [];
    const signatures: TypeIndexSignature[] = [];
    const existing: string[] = [];
    const valid = state.compilerContext.reserveName('valid');

    const resetDefaultSets: string[] = [];

    //run code for properties that had no value in the BSON. either set static values (literal, or null), or throw an error.
    const setDefaults: string[] = [];

    for (const member of type.types) {
        if (member.kind === ReflectionKind.indexSignature) {
            if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;
            signatures.push(member);
        }
        if (member.kind !== ReflectionKind.property && member.kind !== ReflectionKind.propertySignature) continue;
        if (excludedAnnotation.isExcluded(member.type, state.registry.serializer.name)) continue;

        const nameInBson = String(state.namingStrategy.getPropertyName(member));
        existing.push(JSON.stringify(nameInBson));

        const valueSetVar = state.setVariable('valueSetVar', false);
        resetDefaultSets.push(`${valueSetVar} = false;`);
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

        lines.push(`
            //property ${String(member.name)} (${member.type.kind})
            if (!${valueSetVar} && ${getNameComparator(nameInBson)}) {
                state.parser.offset += ${nameInBson.length} + 1;
                ${valueSetVar} = true;

                ${seekOnExplicitUndefined}
                ${executeTemplates(state.fork(valid).extendPath(member.name), member.type) || `throw new Error('No template found for ${member.kind}')`}

                if (!${valid}) break;
                //guards never eat/parse parser, so we jump over the value automatically
                seekElementSize(elementType, state.parser);
                continue;
            }
        `);
    }

    state.setContext({ seekElementSize });

    state.addCode(`
        /*
            Deserialize object: ${stringifyType(type)}
        */
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

                ${lines.join('\n')}

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
}

export function bsonTypeGuardForBsonTypes(types: BSONType[]): (type: OuterType, state: TemplateState) => void {
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
