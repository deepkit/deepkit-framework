import {getClassSchema, PropertyCompilerSchema} from './decorators';
import {arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64} from './core';
import {getClassToXFunction, getPartialClassToXFunction, getPartialXToClassFunction, getXToClassFunction} from './jit';
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from '@deepkit/core';
import {getDataConverterJS} from './serializer-compiler';
import {getSortedUnionTypes} from './union';
import {Serializer} from './serializer';
import {moment} from './moment';
import {typedArrayNamesMap} from './models';

export class JSONSerializer extends Serializer {
    constructor() {
        super('json');
    }
}

export const jsonSerializer = new JSONSerializer();

export function compilerToString(setter: string, accessor: string, property: PropertyCompilerSchema) {
    return `${setter} = typeof ${accessor} === 'string' ? ${accessor} : ''+${accessor};`;
}

jsonSerializer.toClass.register('string', compilerToString);

export function compilerToNumber(setter: string, accessor: string, property: PropertyCompilerSchema) {
    return `${setter} = typeof ${accessor} === 'number' ? ${accessor} : +${accessor};`;
}

jsonSerializer.toClass.register('number', compilerToNumber);
jsonSerializer.fromClass.register('number', compilerToNumber);

jsonSerializer.toClass.register('literal', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    const literalValue = '_literal_value_' + property.name;

    return {
        template: `${setter} = ${literalValue};`,
        context: {[literalValue]: property.literalValue}
    };
});

jsonSerializer.toClass.extend('undefined', (setter: string, accessor: string, property: PropertyCompilerSchema, compiler) => {
    if (property.type === 'literal' && !property.isOptional) {
        const literalValue = '_literal_value_' + property.name;
        return {template: `${setter} = ${literalValue};`, context: {[literalValue]: property.literalValue}};
    }
    return;
});

jsonSerializer.toClass.extend('null', (setter: string, accessor: string, property: PropertyCompilerSchema, compiler) => {
    if (property.type === 'literal' && !property.isNullable) {
        const literalValue = '_literal_value_' + property.name;
        return {template: `${setter} = ${literalValue};`, context: {[literalValue]: property.literalValue}};
    }
    return;
});

jsonSerializer.toClass.register('date', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = new Date(${accessor});`;
});

jsonSerializer.toClass.register('moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = moment(${accessor});`,
        context: {moment}
    };
});

jsonSerializer.toClass.register('boolean', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `
    if ('boolean' === typeof ${accessor}) {
        ${setter} = ${accessor};
    } else {
        if ('true' === ${accessor} || '1' === ${accessor} || 1 === ${accessor}) ${setter} = true;
        if ('false' === ${accessor} || '0' === ${accessor} || 0 === ${accessor}) ${setter} = false;
    }
    `;
});

jsonSerializer.toClass.register('enum', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable}) => {
    //this a candidate where we can extract ENUM information during build time and check very fast during
    //runtime, so we don't need a call to getResolvedClassTypeForValidType(), isValidEnumValue(), etc in runtime anymore.
    const allowLabelsAsValue = property.allowLabelsAsValue;
    const typeValue = reserveVariable();
    return {
        template: `
        var typeValue = ${typeValue};
        if (undefined !== ${accessor} && !isValidEnumValue(typeValue, ${accessor}, ${allowLabelsAsValue})) {
            const valids = getEnumValues(typeValue);
            if (${allowLabelsAsValue}) {
                for (const label of getEnumLabels(typeValue)) {
                    valids.push(label);
                }
            }
            throw new Error('Invalid ENUM given in property ${property.name}: ' + ${accessor} + ', valid: ' + valids.join(','));
        }
        ${setter} = getValidEnumValue(typeValue, ${accessor}, ${allowLabelsAsValue});
    `,
        context: {
            [typeValue]: property.resolveClassType,
            isValidEnumValue: isValidEnumValue,
            getEnumValues: getEnumValues,
            getEnumLabels: getEnumLabels,
            getValidEnumValue: getValidEnumValue
        }
    };
});

jsonSerializer.toClass.registerForBinary((setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = base64ToTypedArray(${accessor}, typedArrayNamesMap.get('${property.type}'));`,
        context: {
            base64ToTypedArray,
            typedArrayNamesMap
        }
    };
});

jsonSerializer.toClass.register('arrayBuffer', (setter, getter) => {
    return {
        template: `${setter} = base64ToArrayBuffer(${getter});`,
        context: {base64ToArrayBuffer}
    };
});

jsonSerializer.fromClass.registerForBinary((setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = typedArrayToBase64(${accessor});`,
        context: {
            typedArrayToBase64
        }
    };
});

jsonSerializer.fromClass.register('arrayBuffer', (setter: string, getter: string) => {
    return {
        template: `${setter} = arrayBufferToBase64(${getter});`,
        context: {arrayBufferToBase64}
    };
});

const convertToPlainUsingToJson = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toJSON();`;
};

jsonSerializer.fromClass.register('date', convertToPlainUsingToJson);
jsonSerializer.fromClass.register('moment', convertToPlainUsingToJson);

jsonSerializer.fromClass.register('class', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, serializerCompilers, jitStack}) => {
    const classSchemaVar = reserveVariable('classSchema');
    const classSchema = getClassSchema(property.resolveClassType!);
    const classToX = reserveVariable('classToX');

    return {
        template: `${setter} = ${classToX}.fn(${accessor}, _options);`,
        context: {
            [classSchemaVar]: classSchema,
            [classToX]: jitStack.getOrCreate(classSchema, () => getClassToXFunction(classSchema, serializerCompilers.serializer, jitStack))
        }
    };
});

jsonSerializer.toClass.register('class', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, serializerCompilers, jitStack}) => {
    const classSchemaVar = reserveVariable('classSchema');
    const classSchema = getClassSchema(property.resolveClassType!);
    const xToClass = reserveVariable('xToClass');
    const context = {
        [classSchemaVar]: classSchema,
        [xToClass]: jitStack.getOrCreate(classSchema, () => getXToClassFunction(classSchema, serializerCompilers.serializer, jitStack))
    };

    const foreignSchema = getClassSchema(property.resolveClassType!);
    if (foreignSchema.decorator) {
        //the actual type checking happens within getXToClassFunction()'s constructor param
        //so we dont check here for object.

        return {
            template: `${setter} = ${xToClass}.fn(${accessor}, _options, getParents(), _state);`,
            context
        };
    }

    return {
        template: `
            //object and not an array
            if ('object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                ${setter} = ${xToClass}.fn(${accessor}, _options, getParents(), _state);
            }
        `, context
    };
});

jsonSerializer.toClass.register('union', (setter: string, accessor: string, property: PropertyCompilerSchema, {reserveVariable, rootContext, jitStack, serializerCompilers}) => {

    let discriminator: string[] = [`if (false) { }`];
    const discriminants: string[] = [];
    let elseBranch = `throw new Error('No valid discriminant was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

    if (property.isOptional) {
        elseBranch = '';
    } else if (property.isNullable) {
        elseBranch = `${setter} = null;`;
    } else if (property.hasManualDefaultValue()) {
        const defaultVar = reserveVariable();
        rootContext.set(defaultVar, property.defaultValue);
        elseBranch = `${setter} = ${defaultVar};`;
    }

    for (const unionType of getSortedUnionTypes(property)) {
        const guardVar = reserveVariable('guard_' + unionType.property.type);
        rootContext.set(guardVar, unionType.guard);

        discriminants.push(unionType.property.type);

        discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(${accessor})) {
                    ${getDataConverterJS(setter, accessor, unionType.property, serializerCompilers, rootContext, jitStack)}
                }
            `);
    }

    return `
            ${discriminator.join('\n')}
            else {
                ${elseBranch}
                
            }
        `;
});

jsonSerializer.toClass.register('partial', (setter, accessor, property, compiler) => {
    const partialXToClass = compiler.reserveVariable('partialXToClass');
    const classSchema = getClassSchema(property.getSubType().resolveClassType!);

    return {
        template: `${setter} = ${partialXToClass}.fn(${accessor}, _options, getParents(), _state);`,
        context: {
            [partialXToClass]: compiler.jitStack.getOrCreate(classSchema, () => getPartialXToClassFunction(classSchema, compiler.serializerCompilers.serializer))
        }
    };
});

jsonSerializer.fromClass.register('partial', (setter, accessor, property, compiler) => {
    const partialClassToX = compiler.reserveVariable('partialClassToX');
    const classSchema = getClassSchema(property.getSubType().resolveClassType!);

    return {
        template: `${setter} = ${partialClassToX}.fn(${accessor}, _options);`,
        context: {
            [partialClassToX]: compiler.jitStack.getOrCreate(classSchema, () => getPartialClassToXFunction(classSchema, compiler.serializerCompilers.serializer))
        }
    };
});
