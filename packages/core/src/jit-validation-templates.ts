import {PropertyCompilerSchema} from "./decorators";
import {registerCheckerCompiler} from "./jit-validation-registry";
import {jitValidate} from "./jit-validation";

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
