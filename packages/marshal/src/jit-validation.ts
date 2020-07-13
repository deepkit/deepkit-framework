import {ClassType} from "@super-hornet/core";
import {handleCustomValidator, ValidationError} from "./validation";
import {getClassSchema, PropertyCompilerSchema, PropertyValidator} from "./decorators";
import {executeCheckerCompiler, TypeCheckerCompilerContext, validationRegistry} from "./jit-validation-registry";
import './jit-validation-templates';
import {reserveVariable} from "./compiler-registry";
import {resolvePropertyCompilerSchema} from "./jit";

const jitFunctions = new WeakMap<ClassType<any>, any>();
const CacheJitPropertyMap = new Map<PropertyCompilerSchema, any>();
const CacheValidatorInstances = new Map<ClassType<PropertyValidator>, PropertyValidator>();

export function getDataCheckerJS(
    path: string,
    accessor: string,
    property: PropertyCompilerSchema,
    rootContext: TypeCheckerCompilerContext
): string {
    let compiler = validationRegistry.get(property.type);

    const requiredThrown = property.isActualOptional() ? '' : `_errors.push(new ValidationError(${path}, 'required', 'Required value is undefined or null'));`;

    function getCustomValidatorCode(accessor: string, path: string) {
        if (!property.validators.length) return '';

        const propertySchemaVar = reserveVariable(rootContext, 'schema_' + property.name);
        rootContext.set(propertySchemaVar, property);
        rootContext.set('handleCustomValidator', handleCustomValidator);

        const checks: string[] = [];

        for (const validator of property.validators) {
            let instance = CacheValidatorInstances.get(validator);
            if (!instance) {
                instance = new validator;
                CacheValidatorInstances.set(validator, instance);
            }

            const validatorsVar = reserveVariable(rootContext, 'validator');
            rootContext.set(validatorsVar, instance);
            checks.push(`handleCustomValidator(${propertySchemaVar}, ${validatorsVar}, ${accessor}, ${path}, _errors, _classType);`);
        }

        return checks.join('\n');
    }

    if (property.isArray) {
        //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
        const checkItem = compiler ? executeCheckerCompiler(`${path} + '.' + l`, rootContext, compiler, `${accessor}[l]`, property) : '';

        return `
            //property ${property.name}, ${property.type} ${property.isActualOptional()}
            if (${accessor}.length === undefined || 'string' === typeof ${accessor} || 'function' !== typeof ${accessor}.slice) {
                if (${accessor} === null || ${accessor} === undefined) {
                    ${requiredThrown}
                } else {
                    _errors.push(new ValidationError(${path}, 'invalid_type', 'Type is not an array'));
                }
            } else {
                 var l = ${accessor}.length;
                 while (l--) {
                    //make sure all elements have the correct type
                    if (${accessor}[l] !== undefined && ${accessor}[l] !== null) {
                        ${checkItem}
                        ${getCustomValidatorCode(`${accessor}[l]`, `${path} + '.' + l`)}
                    } else if (!${property.isActualOptional()}) {
                        //this checks needs its own property attribute: 'optionalItem'
                        _errors.push(new ValidationError(${path} + '.' + l, 'required', 'Required value is undefined or null'));
                    }
                 } 
            }
        `;
    } else if (property.isMap) {
        const line = compiler ? executeCheckerCompiler(`${path} + '.' + i`, rootContext, compiler, `${accessor}[i]`, property) : ``;
        return `
            //property ${property.name}, ${property.type}
            if (${accessor} && 'object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                for (var i in ${accessor}) {
                    if (!${accessor}.hasOwnProperty(i)) continue;
                    if (${accessor}[i] !== undefined && ${accessor}[i] !== null) {
                        ${line}
                        ${getCustomValidatorCode(`${accessor}[i]`, `${path} + '.' + i`)}
                    } else if (!${property.isActualOptional()}) {
                        //this checks needs its own property attribute: 'optionalItem'
                        _errors.push(new ValidationError(${path} + '.' + i, 'required', 'Required value is undefined or null'));
                    }
                }
            } else {
                if (${accessor} === null || ${accessor} === undefined) {
                    ${requiredThrown}
                } else {
                    _errors.push(new ValidationError(${path}, 'invalid_type', 'Type is not an object'));
                }
            }
        `;
    } else if (property.isPartial) {
        const varClassType = reserveVariable(rootContext);
        rootContext.set('jitValidatePartial', jitValidatePartial);
        rootContext.set(varClassType, property.resolveClassType);
        return `
        //property ${property.name}, ${property.type}
        jitValidatePartial(${varClassType}, ${accessor}, _path, _errors);
        `;
    } else if (compiler) {
        return `
            //property ${property.name}, ${property.type}
            ${executeCheckerCompiler(path, rootContext, compiler, accessor, property)}
            ${getCustomValidatorCode(accessor, path)}
        `;
    } else {
        return `
        ${getCustomValidatorCode(accessor, path)}
        `;
    }
}

export function jitValidateProperty(property: PropertyCompilerSchema, classType?: ClassType<any>): (value: any, path?: string, errors?: ValidationError[], overwritePah?: string) => ValidationError[] {
    if (property.type === 'class') {
        const foreignSchema = getClassSchema(property.resolveClassType!);
        if (foreignSchema.decorator) {
            //given property is actually a decorated one, so
            //we fast forward to its property, since the actual structure is defined in the resolvedClassType.
            property = foreignSchema.getProperty(foreignSchema.decorator);
        }
    }

    const jit = CacheJitPropertyMap.get(property);
    if (jit) return jit;

    const context = new Map<any, any>();
    context.set('_classType', classType);
    context.set('ValidationError', ValidationError);

    const notOptionalCheckThrow = property.isActualOptional() || property.hasDefaultValue ? ''
        : `_errors.push(new ValidationError(_overwritePath || _path || '${property.name}', 'required', 'Required value is undefined or null'));`;

    const check = `
        if (undefined !== _data && null !== _data) {
            ${getDataCheckerJS(`(_overwritePath || _path  || '${property.name}')`, `_data`, property, context)}
        } else {
            ${notOptionalCheckThrow}
        }
    `;

    const functionCode = `
        return function(_data, _path, _errors, _overwritePath) {
            _path = _path || '';
            _errors = _errors ? _errors : [];
            ${check}
            return _errors;
        }
        `;

    try {
        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled.bind(undefined, ...context.values())();
        // console.log('jit', property.name, compiled.toString());
        CacheJitPropertyMap.set(property, fn);

        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}

export function jitValidate<T>(classType: ClassType<T>): (value: any, path?: string, errors?: ValidationError[]) => ValidationError[] {
    const jit = jitFunctions.get(classType);
    if (jit) return jit;

    const context = new Map<any, any>();
    const schema = getClassSchema(classType);

    context.set('_classType', classType);
    context.set('ValidationError', ValidationError);

    const checks: string[] = [];

    schema.loadDefaults();
    for (let property of schema.getClassProperties().values()) {
        const originProperty = property;
        let isDecorated = false;
        if (property.type === 'class') {
            const foreignSchema = property.getResolvedClassSchema();
            if (foreignSchema.decorator) {
                //given property is actually a decorated one, so
                //we fast forward to its property, since the actual structure is defined in the resolvedClassType.
                property = foreignSchema.getProperty(foreignSchema.decorator);
                isDecorated = true;
            }
        }

        const notOptionalCheckThrow = property.isActualOptional() || property.hasDefaultValue ? '' : `_errors.push(new ValidationError(_path + '${property.name}', 'required', 'Required value is undefined or null'));`;
        let valueGetter = `_data.${originProperty.name}`;
        if (isDecorated) {
            const resolvedClassType = 'resolvedClassType_' + originProperty.name;
            context.set(resolvedClassType, originProperty.resolveClassType);
            valueGetter = `_data.${originProperty.name} instanceof ${resolvedClassType} ? _data.${originProperty.name}.${property.name} : _data.${originProperty.name}`;
        }
        checks.push(`
        var value = ${valueGetter};
        if (undefined !== value && null !== value) {
            ${getDataCheckerJS(`_path + '${originProperty.name}'`, `value`, property, context)}
        } else {
            ${notOptionalCheckThrow}
        }
        `);
    }

    const functionCode = `
        return function(_data, _path, _errors) {
            _path = _path ? _path + '.' : '';
            _errors = _errors || [];
            ${checks.join('\n')}
            return _errors;
        }
        `;

    try {
        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled.bind(undefined, ...context.values())();
        jitFunctions.set(classType, fn);
        // console.log('jit validation', schema.getClassName(), fn.toString());

        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}


export function jitValidatePartial<T, K extends keyof T>(
    classType: ClassType<T>,
    partial: { [name: string]: any },
    path?: string,
    errors?: ValidationError[],
): ValidationError[] {
    errors = errors ? errors : [];
    const schema = getClassSchema(classType);
    schema.loadDefaults();

    for (const i in partial) {
        if (!partial.hasOwnProperty(i)) continue;
        const thisPath = path ? path + '.' + i : i;
        jitValidateProperty(
            schema.getClassProperties().get(i) || resolvePropertyCompilerSchema(schema, i),
            classType,
        )(partial[i],
            '',
            errors,
            thisPath,
        );
    }

    return errors;
}

