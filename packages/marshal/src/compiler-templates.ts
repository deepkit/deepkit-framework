import {getClassSchema, PropertyCompilerSchema, typedArrayNamesMap} from './decorators';
import {arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64} from './core';
import {createClassToXFunction, createXToClassFunction, moment} from './jit';
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from '@super-hornet/core';
import {getConverterCompiler, getDataConverterJS, registerConverterCompiler, TypeConverterCompiler} from './compiler-registry';
import {getSortedUnionTypes} from './union';

export function compilerToString(setter: string, accessor: string, property: PropertyCompilerSchema) {
    return `${setter} = typeof ${accessor} === 'string' ? ${accessor} : ''+${accessor};`;
}

//number class->plain is not necessary since typescript's typesystem already made sure its a number
registerConverterCompiler('plain', 'class', 'string', compilerToString);

export function compilerToNumber(setter: string, accessor: string, property: PropertyCompilerSchema) {
    return `${setter} = typeof ${accessor} === 'number' ? ${accessor} : +${accessor};`;
}

//number class->plain is not necessary since typescript's typesystem already made sure its a number
registerConverterCompiler('plain', 'class', 'number', compilerToNumber);

registerConverterCompiler('plain', 'class', 'literal', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    const literalValue = '_literal_value_' + property.name;

    return {
        template: `${setter} = ${literalValue};`,
        context: {[literalValue]: property.literalValue}
    };
});

const originalUndefined = getConverterCompiler('plain', 'class', 'undefined');
registerConverterCompiler('plain', 'class', 'undefined', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context, jitStack) => {
    if (property.type === 'literal' && !property.isOptional) {
        const literalValue = '_literal_value_' + property.name;
        return {template: `${setter} = ${literalValue};`, context: {[literalValue]: property.literalValue}};
    }

    return originalUndefined(setter, accessor, property, reserveVariable, context, jitStack);
});

const originalNull = getConverterCompiler('plain', 'class', 'null');
registerConverterCompiler('plain', 'class', 'null', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context, jitStack) => {
    if (property.type === 'literal' && !property.isNullable) {
        const literalValue = '_literal_value_' + property.name;
        return {template: `${setter} = ${literalValue};`, context: {[literalValue]: property.literalValue}};
    }

    return originalNull(setter, accessor, property, reserveVariable, context, jitStack);
});

registerConverterCompiler('plain', 'class', 'date', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = new Date(${accessor});`;
});

registerConverterCompiler('plain', 'class', 'moment', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = moment(${accessor});`,
        context: {moment}
    };
});

registerConverterCompiler('plain', 'class', 'boolean', (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `
    if ('boolean' === typeof ${accessor}) {
        ${setter} = ${accessor};
    } else {
        if ('true' === ${accessor} || '1' === ${accessor} || 1 === ${accessor}) ${setter} = true;
        if ('false' === ${accessor} || '0' === ${accessor} || 0 === ${accessor}) ${setter} = false;
    }
    `;
});

registerConverterCompiler('plain', 'class', 'enum', (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
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

const convertTypedArrayToClass = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = base64ToTypedArray(${accessor}, typedArrayNamesMap.get('${property.type}'));`,
        context: {
            base64ToTypedArray,
            typedArrayNamesMap
        }
    };
};

registerConverterCompiler('plain', 'class', 'Int8Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint8Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint8Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint8ClampedArray', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Int16Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint16Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Int32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Int32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Uint32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Float32Array', convertTypedArrayToClass);
registerConverterCompiler('plain', 'class', 'Float64Array', convertTypedArrayToClass);

registerConverterCompiler('plain', 'class', 'arrayBuffer', (setter, getter) => {
    return {
        template: `${setter} = base64ToArrayBuffer(${getter});`,
        context: {base64ToArrayBuffer}
    };
});

const convertTypedArrayToPlain = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return {
        template: `${setter} = typedArrayToBase64(${accessor});`,
        context: {
            typedArrayToBase64
        }
    };
};
registerConverterCompiler('class', 'plain', 'Int8Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint8Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint8Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint8ClampedArray', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Int16Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint16Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Int32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Int32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Uint32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Float32Array', convertTypedArrayToPlain);
registerConverterCompiler('class', 'plain', 'Float64Array', convertTypedArrayToPlain);

const convertArrayBufferToPlain = (setter: string, getter: string) => {
    return {
        template: `${setter} = arrayBufferToBase64(${getter});`,
        context: {arrayBufferToBase64}
    };
};
registerConverterCompiler('class', 'plain', 'arrayBuffer', convertArrayBufferToPlain);

const convertToPlainUsingToJson = (setter: string, accessor: string, property: PropertyCompilerSchema) => {
    return `${setter} = ${accessor}.toJSON();`;
};

registerConverterCompiler('class', 'plain', 'date', convertToPlainUsingToJson);
registerConverterCompiler('class', 'plain', 'moment', convertToPlainUsingToJson);

export function compilerConvertClassToX(toFormat: string): TypeConverterCompiler {
    return (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, rootContext, jitStack) => {
        const classSchemaVar = reserveVariable('classSchema');
        const classSchema = getClassSchema(property.resolveClassType!);
        const classToX = reserveVariable('classToX');

        return {
            template: `${setter} = ${classToX}.fn(${accessor}, _options);`,
            context: {
                [classSchemaVar]: classSchema,
                [classToX]: jitStack.getOrCreate(classSchema, () => createClassToXFunction(classSchema, toFormat, jitStack))
            }
        };
    };
}

registerConverterCompiler('class', 'plain', 'class', compilerConvertClassToX('plain'));

export function compilerXToClass(fromFormat: string): TypeConverterCompiler {
    return (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, rootContext, jitStack) => {
        const classSchemaVar = reserveVariable('classSchema');
        const classSchema = getClassSchema(property.resolveClassType!);
        const xToClass = reserveVariable('xToClass');
        const context = {
            [classSchemaVar]: classSchema,
            [xToClass]: jitStack.getOrCreate(classSchema, () => createXToClassFunction(classSchema, fromFormat, jitStack))
        };

        const foreignSchema = getClassSchema(property.resolveClassType!);
        if (foreignSchema.decorator) {
            //the actual type checking happens within createXToClassFunction()'s constructor param
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
    };
}

registerConverterCompiler('plain', 'class', 'class', compilerXToClass('plain'));

export function compilerXToUnionClass(fromFormat: string): TypeConverterCompiler {
    return (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable, context, jitStack) => {

        let discriminator: string[] = [`if (false) { }`];
        const discriminants: string[] = [];
        let elseBranch = `throw new Error('No valid discriminant was found, so could not determine class type. Guard tried: [${discriminants.join(',')}].');`;

        if (property.isOptional) {
            elseBranch = '';
        } else if (property.isNullable) {
            elseBranch = `${setter} = null;`;
        } else if (property.hasManualDefaultValue()) {
            const defaultVar = reserveVariable();
            context.set(defaultVar, property.defaultValue);
            elseBranch = `${setter} = ${defaultVar};`;
        }

        for (const unionType of getSortedUnionTypes(property)) {
            const guardVar = reserveVariable('guard_' + unionType.property.type);
            context.set(guardVar, unionType.guard);

            discriminants.push(unionType.property.type);

            discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(${accessor})) {
                    //its the correct type. what now?
                    ${getDataConverterJS(setter, accessor, unionType.property, fromFormat, 'class', context, jitStack)}
                }
            `);
        }

        return {
            template: `
            ${discriminator.join('\n')}
            else {
                ${elseBranch}
                
            }
        `, context
        };
    };
}

registerConverterCompiler('plain', 'class', 'union', compilerXToUnionClass('plain'));
