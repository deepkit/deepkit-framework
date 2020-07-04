import {getClassSchema, PropertyCompilerSchema, typedArrayNamesMap} from "./decorators";
import {arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64} from "./core";
import {createClassToXFunction, createXToClassFunction, moment} from "./jit";
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from "@super-hornet/core";
import {registerConverterCompiler} from "./compiler-registry";

export function compilerToString(setter: string, accessor: string, property: PropertyCompilerSchema) {
    return `${setter} = typeof ${accessor} === 'string' ? ${accessor} : String(${accessor});`;
}

registerConverterCompiler('plain', 'class', 'string', compilerToString);
registerConverterCompiler('class', 'plain', 'string', compilerToString);


export function compilerToNumber(setter: string, accessor: string, property: PropertyCompilerSchema) {
    return `${setter} = typeof ${accessor} === 'number' ? ${accessor} : +${accessor};`;
}

registerConverterCompiler('plain', 'class', 'number', compilerToNumber);
registerConverterCompiler('class', 'plain', 'number', compilerToNumber);

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

const convertArrayBufferToPlain = (setter, getter) => {
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

export function compilerConvertClassToX(toFormat: string) {
    return (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
        const classType = reserveVariable();
        return {
            template: `${setter} = createClassToXFunction(${classType}, '${toFormat}')(${accessor}, _options);`,
            context: {
                [classType]: property.resolveClassType,
                createClassToXFunction,
            }
        }
    }
}
registerConverterCompiler('class', 'plain', 'class', compilerConvertClassToX('plain'));

export function compilerXToClass(fromFormat: string) {
    return (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
        const classType = reserveVariable();
        const context = {
            [classType]: property.resolveClassType,
            createXToClassFunction
        };

        const foreignSchema = getClassSchema(property.resolveClassType!);
        if (foreignSchema.decorator) {
            //the actual type checking happens within createXToClassFunction()'s constructor param
            //so we dont check here for object.
            return {
                template: `${setter} = createXToClassFunction(${classType}, '${fromFormat}')(${accessor}, _options, getParents(), _state);`,
                context
            };
        }

        return {
            template: `
            //object and not an array
            if ('object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                ${setter} = createXToClassFunction(${classType}, '${fromFormat}')(${accessor}, _options, getParents(), _state);
            }
        `, context};
    }
}
registerConverterCompiler('plain', 'class', 'class', compilerXToClass('plain'));

export function compilerXToUnionClass(fromFormat: string) {
    return (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable) => {
        const context = {
            createXToClassFunction
        };

        const discriminatorClassVarName = reserveVariable();
        let discriminator = `${discriminatorClassVarName} = undefined;\n`;
        const discriminants: string[] = [];

        for (const type of property.resolveUnionTypes) {
            const typeSchema = getClassSchema(type);
            typeSchema.loadDefaults();

            const discriminant = typeSchema.getDiscriminantPropertySchema();
            if (discriminant.defaultValue === null || discriminant.defaultValue === undefined) {
                throw new Error(`Discriminant ${discriminant.name} has no default value.`);
            }

            discriminants.push(`${discriminant.name}=${JSON.stringify(discriminant.defaultValue)}`)
            const typeVarName = reserveVariable();
            context[typeVarName] = type;
            discriminator += `if (${accessor}.${discriminant.name} === ${JSON.stringify(discriminant.defaultValue)}) ${discriminatorClassVarName} = ${typeVarName};\n`;
        }

        return {
            template: `
            if (${accessor}) {
                ${discriminator}
                if (!${discriminatorClassVarName}) {
                    throw new Error('No valid discriminant was found, so could not determine class type. discriminants: [${discriminants.join(',')}].');
                }
                ${setter} = createXToClassFunction(${discriminatorClassVarName}, '${fromFormat}')(${accessor}, _options, getParents(), _state);
            }
        `, context};
    };
}

registerConverterCompiler('plain', 'class', 'union', compilerXToUnionClass('plain'));
