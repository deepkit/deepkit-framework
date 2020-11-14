/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {getClassSchema, PropertyCompilerSchema} from './model';
import {registerCheckerCompiler} from './jit-validation-registry';
import {getDataCheckerJS, jitValidate} from './jit-validation';
import {getEnumLabels, getEnumValues, getValidEnumValue, isValidEnumValue} from '@deepkit/core';
import {getSortedUnionTypes} from './union';

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
    } else if (!Number.isFinite(${accessor})) {
        ${utils.raise('invalid_number', 'No valid number given, got NaN')}
    }
    `;
});

registerCheckerCompiler('string', (accessor: string, property: PropertyCompilerSchema, utils) => {
    return `if ('string' !== typeof ${accessor}) ${utils.raise('invalid_string', 'No string given')};`;
});

registerCheckerCompiler('enum', (accessor: string, property: PropertyCompilerSchema, utils) => {
    //this is a candidate where we can extract ENUM information during build time and check very fast during
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

registerCheckerCompiler('class', (accessor: string, property: PropertyCompilerSchema, utils, jitStack) => {
    const jitValidateThis = utils.reserveVariable('jitValidate');
    const classSchema = getClassSchema(property.resolveClassType!);

    return {
        template: `
            if ('object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                if (!_stack.includes(${accessor})) {
                    ${jitValidateThis}.fn(${accessor}, ${utils.path}, _errors, _stack);
                }
            } else {
                ${utils.raise('invalid_type', 'Type is not an object')};
            }
        `,
        context: {
            [jitValidateThis]: jitStack.getOrCreate(classSchema, () => jitValidate(classSchema, jitStack))
        }
    };
});

registerCheckerCompiler('literal', (accessor: string, property: PropertyCompilerSchema, utils) => {
    //todo. really necessary? Because we force set the literal value always, no matter what value comes in.
    return '';
});

registerCheckerCompiler('union', (accessor: string, property: PropertyCompilerSchema, utils, jitStack) => {
    const context = new Map<string, any>();

    let discriminator: string[] = [`if (false) { }`];

    for (const unionType of getSortedUnionTypes(property)) {
        const guardVar = utils.reserveVariable('guard_' + unionType.property.type);
        context.set(guardVar, unionType.guard);

        discriminator.push(`
                //guard:${unionType.property.type}
                else if (${guardVar}(${accessor})) {
                    //validate this type: ${unionType.property.type}
                    ${getDataCheckerJS(utils.path, accessor, unionType.property, context, jitStack)}
                }
            `);
    }

    return {
        template: `
             ${discriminator.join('\n')}
             else {
                if (${accessor} === null) {
                    if (!${property.isNullable}) {
                        ${utils.raise('required', 'Required value is null')};
                    }
                } else if (${accessor} === undefined) {
                    if (!${property.isUndefinedAllowed()}) {
                        ${utils.raise('required', 'Required value is undefined')};
                    }
                } else {
                    ${utils.raise('invalid_union', 'No compatible type for union found')};
                }
             }
        `,
        context: context,
    };
});
