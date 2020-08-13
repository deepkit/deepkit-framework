import {ClassType} from '@super-hornet/core';
import {handleCustomValidator, ValidationError} from './validation';
import {ClassSchema, getClassSchema, PropertyCompilerSchema, PropertyValidator} from './decorators';
import {executeCheckerCompiler, TypeCheckerCompilerContext, validationRegistry} from './jit-validation-registry';
import './jit-validation-templates';
import {reserveVariable} from './compiler-registry';
import {JitStack, resolvePropertyCompilerSchema} from './jit';

const jitFunctions = new WeakMap<ClassSchema<any>, any>();
const CacheJitPropertyMap = new Map<PropertyCompilerSchema, any>();
const CacheValidatorInstances = new Map<ClassType<PropertyValidator>, PropertyValidator>();

export function getDataCheckerJS(
    path: string,
    accessor: string,
    property: PropertyCompilerSchema,
    rootContext: TypeCheckerCompilerContext,
    jitStack: JitStack
): string {
    let compiler = validationRegistry.get(property.type);

    const notOptionalCheckThrow = (property.isActualOptional() || property.hasDefaultValue) ? '' : `_errors.push(new ValidationError(${path}, 'required', 'Required value is undefined'));`;
    const notNullableCheckThrow = property.isNullable ? '' : `_errors.push(new ValidationError(${path}, 'required', 'Required value is null'));`;

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

    const depth = path.split('.').length;

    const i = `l${depth}`;
    rootContext.set(i, 0);

    if (property.isArray) {
        //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
        // const checkItem = compiler ? executeCheckerCompiler(`${path} + '.' + l`, rootContext, compiler, `${accessor}[l]`, property.getArrayOrMapType()) : '';

        return `
            //property ${property.name}, ${property.type} ${property.isActualOptional()}
            if (${accessor} === undefined) {
                ${notOptionalCheckThrow}
            } else if (${accessor} === null) {
                ${notNullableCheckThrow}
            } else if (${accessor}.length === undefined || 'string' === typeof ${accessor} || 'function' !== typeof ${accessor}.slice) {
                _errors.push(new ValidationError(${path}, 'invalid_type', 'Type is not an array'));
            } else {
                ${getCustomValidatorCode(`${accessor}`, `${path}`)}

                 ${i} = ${accessor}.length;
                 while (${i}--) {
                    //make sure all elements have the correct type
                    ${getDataCheckerJS(`${path} + '.' + ${i}`, `${accessor}[${i}]`, property.getSubType(), rootContext, jitStack)}
                 } 
            }
        `;
    } else if (property.isMap) {
        return `
            //property ${property.name}, ${property.type}
            if (${accessor} === undefined) {
                ${notOptionalCheckThrow}
            } else if (${accessor} === null) {
                ${notNullableCheckThrow}
            } else if (${accessor} && 'object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
                ${getCustomValidatorCode(`${accessor}`, `${path}`)}

                for (${i} in ${accessor}) {
                    if (!${accessor}.hasOwnProperty(${i})) continue;
                    ${getDataCheckerJS(`${path} + '.' + ${i}`, `${accessor}[${i}]`, property.getSubType(), rootContext, jitStack)}
                }
            } else {
                _errors.push(new ValidationError(${path}, 'invalid_type', 'Type is not an object'));
            }
        `;
    } else if (property.isPartial) {
        const varClassType = reserveVariable(rootContext);
        rootContext.set('jitValidatePartial', jitValidatePartial);
        rootContext.set(varClassType, property.getSubType().resolveClassType);
        return `
        //property ${property.name}, ${property.type}
        if (${accessor} === undefined) {
            ${notOptionalCheckThrow}
        } else if (${accessor} === null) {
            ${notNullableCheckThrow}
        } else if (${accessor} && 'object' === typeof ${accessor} && 'function' !== typeof ${accessor}.slice) {
            ${getCustomValidatorCode(`${accessor}`, `${path}`)}
            jitValidatePartial(${varClassType}, ${accessor}, _path, _errors);
        } else {
            _errors.push(new ValidationError(${path}, 'invalid_type', 'Type is not an object'));
        }
        `;
    } else if (compiler) {
        return `
        if (${accessor} === undefined) {
            ${notOptionalCheckThrow}
        } else if (${accessor} === null) {
            ${notNullableCheckThrow}
        } else {
            //property ${property.name}, ${property.type}
            ${executeCheckerCompiler(path, rootContext, jitStack, compiler, accessor, property)}
            ${getCustomValidatorCode(accessor, path)}
        }
        `;
    } else {
        return `
        if (${accessor} === undefined) {
            ${notOptionalCheckThrow}
        } else if (${accessor} === null) {
            ${notNullableCheckThrow}
        } else {
            ${getCustomValidatorCode(accessor, path)}
        }
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
    const jitStack = new JitStack();
    context.set('_classType', classType);
    context.set('ValidationError', ValidationError);

    const functionCode = `
        return function(_data, _path, _errors, _overwritePath) {
            _path = _path || '';
            _errors = _errors ? _errors : [];
            ${getDataCheckerJS(`(_overwritePath || _path  || '${property.name}')`, `_data`, property, context, jitStack)}
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

export function jitValidate<T>(schema: ClassType<T> | ClassSchema<T>, jitStack: JitStack = new JitStack()): (value: any, path?: string, errors?: ValidationError[]) => ValidationError[] {
    schema = schema instanceof ClassSchema ? schema : getClassSchema(schema);

    const jit = jitFunctions.get(schema);
    if (jit && jit.buildId === schema.buildId) return jit;

    const context = new Map<any, any>();
    const prepared = jitStack.prepare(schema);

    context.set('_classType', schema.classType);
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

        let valueGetter = `_data.${originProperty.name}`;
        if (isDecorated) {
            const resolvedClassType = 'resolvedClassType_' + originProperty.name;
            context.set(resolvedClassType, originProperty.resolveClassType);
            valueGetter = `_data.${originProperty.name} instanceof ${resolvedClassType} ? _data.${originProperty.name}.${property.name} : _data.${originProperty.name}`;
        }

        checks.push(`
            var value = ${valueGetter};
            ${getDataCheckerJS(`_path + '${originProperty.name}'`, `value`, property, context, jitStack)}
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

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    prepared(fn);
    fn.buildId = schema.buildId;
    jitFunctions.set(schema, fn);

    return fn;
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

