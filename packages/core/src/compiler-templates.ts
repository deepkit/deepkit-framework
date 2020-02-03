import {PropertyCompilerSchema, typedArrayNamesMap} from "./decorators";
import {arrayBufferToBase64, base64ToArrayBuffer, base64ToTypedArray, typedArrayToBase64} from "./core";
import {createClassToXFunction, createXToClassFunction, moment} from "./jit";
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from "@marcj/estdlib";
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
            template: `${setter} = createClassToXFunction(${classType}, '${toFormat}')(${accessor});`,
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

        return {
            template: `
            ${setter} = createXToClassFunction(${classType}, '${fromFormat}')(${accessor}, getParents(), _state);
        `,
            context: {
                [classType]: property.resolveClassType,
                createXToClassFunction
            }
        };
    }
}
registerConverterCompiler('plain', 'class', 'class', compilerXToClass('plain'));
