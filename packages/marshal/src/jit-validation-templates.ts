import {getClassSchema, PropertyCompilerSchema} from "./decorators";
import {registerCheckerCompiler} from "./jit-validation-registry";
import {jitValidate} from "./jit-validation";
import {isValidEnumValue, getEnumValues, getEnumLabels, getValidEnumValue} from "@super-hornet/core";

registerCheckerCompiler('number', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return `
    if ('number' !== typeof ${accessor}) {
        if ('string' === typeof ${accessor}) {
            if (!Number.isFinite(parseFloat(${accessor}))) {
                ${utils.raise('invalid_number', 'No number given')}
            }
        } else {
            ${utils.raise('invalid_number', 'No number given')}
        }
    }
    `;
});

registerCheckerCompiler('string', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return `if ('string' !== typeof ${accessor}) ${utils.raise('invalid_string', 'No string given')};`;
});

registerCheckerCompiler('enum', (accessor: string, property: PropertyCompilerSchema, utils) => {
    //this a candidate where we can extract ENUM information during build time and check very fast during
    //runtime, so we don't need a call to getResolvedClassTypeForValidType(), isValidEnumValue(), etc in runtime anymore.
    const allowLabelsAsValue = property.allowLabelsAsValue;
    const typeValue = utils.reserveVariable();

    const valids = getEnumValues(property.resolveClassType);
    if (allowLabelsAsValue) {
        for (const label of getEnumLabels(property.resolveClassType)) {
            valids.push(label);
        }
    }
    return {
        template: `
        var typeValue = ${typeValue};
        if (undefined !== ${accessor} && !isValidEnumValue(typeValue, ${accessor}, ${allowLabelsAsValue})) {
            ${utils.raise('invalid_enum', `Invalid enum value received. Allowed: ${valids.join(',')}`)};
        }
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

registerCheckerCompiler('boolean', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return `
    if ('boolean' !== typeof ${accessor}) {
        if (${accessor} === '1' || ${accessor} === '0' || ${accessor} === 'true' || ${accessor} === 'false' || ${accessor} === 0 || ${accessor} === 1) {
        } else {
            ${utils.raise('invalid_boolean', 'No Boolean given')};
        }
    }`;
});

registerCheckerCompiler('uuid', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return {
        template: `
        if ('string' !== typeof ${accessor} || !${accessor}.match(uuidValidation)) {
            ${utils.raise('invalid_uuid', 'No UUID given')};
        }
        `,
        context: {
            uuidValidation: new RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        }
    };
});

registerCheckerCompiler('objectId', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return {
        template: `
        if ('string' !== typeof ${accessor} || !${accessor}.match(objectIdValidation)) {
            ${utils.raise('invalid_objectId', 'No Mongo ObjectID given')};
        }
        `,
        context: {
            objectIdValidation: new RegExp(/^[a-fA-F0-9]{24}$/)
        }
    };
});

registerCheckerCompiler('date', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return `
    if (${accessor} instanceof Date) {
        if (isNaN(new Date(${accessor}).getTime())) {
            ${utils.raise('invalid_date', 'No valid Date given')};
        }
    } else if ('string' !== typeof ${accessor} || !${accessor}) {
        ${utils.raise('invalid_date', 'No Date string given')};
    } else if (isNaN(new Date(${accessor}).getTime())) {
        ${utils.raise('invalid_date', 'No valid Date string given')};
    }
    `;
});

registerCheckerCompiler('class', (accessor: string, property: PropertyCompilerSchema, utils) => {
    const classType = utils.reserveVariable();
    return {
        template: `
            if ('object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                jitValidate(${classType})(${accessor}, ${utils.path}, _errors);
            } else {
                ${utils.raise('invalid_type', 'Type is not an object')};
            }
        `,
        context: {
            [classType]: property.resolveClassType,
            jitValidate
        }
    };
});

registerCheckerCompiler('union', (accessor: string, property: PropertyCompilerSchema, utils) => {
    const discriminatorClassVarName = utils.reserveVariable();
    let discriminator = `${discriminatorClassVarName} = undefined;\n`;
    const context: {[key: string]: any} = {
        jitValidate
    };

    for (const type of property.resolveUnionTypes) {
        const typeSchema = getClassSchema(type);
        typeSchema.loadDefaults();

        const discriminant = typeSchema.getDiscriminantPropertySchema();
        if (discriminant.defaultValue === null || discriminant.defaultValue === undefined) {
            throw new Error(`Discriminant ${typeSchema.getClassName()}.${discriminant.name} has no default value.`);
        }

        const typeVarName = utils.reserveVariable();
        context[typeVarName] = type;
        discriminator += `if (${accessor}.${discriminant.name} === ${JSON.stringify(discriminant.defaultValue)}) ${discriminatorClassVarName} = ${typeVarName};\n`;
    }

    return {
        template: `
            if ('object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                ${discriminator}
                if (!${discriminatorClassVarName}) {
                    ${utils.raise('invalid_type', 'Invalid union type given. No valid discriminant was found.')};
                } else {
                    jitValidate(${discriminatorClassVarName})(${accessor}, ${utils.path}, _errors);
                }
            } else {
                ${utils.raise('invalid_type', 'Type is not an object')};
            }
        `,
        context: context
    };
});
