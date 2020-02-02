import {ClassSchema, getClassSchema, MarshalGlobal, PropertyCompilerSchema, PropertySchema, Types} from "./decorators";
import {getDecorator, isExcluded} from "./mapper";
import {ClassType, getClassName, getClassPropertyName} from "@marcj/estdlib";
import './compiler-templates';
import {compilerRegistry} from "./compiler-registry";

export let moment: any = () => {
    throw new Error('Moment.js not installed')
};

declare function require(moduleName: string): any;

try {
    moment = require('moment');
} catch (e) {
}

/**
 * This is used withing JIT functions.
 * @hidden
 */
export function findParent<T>(parents: any[], parentType: ClassType<T>): T | undefined {
    for (let i = parents.length - 1; i >= 0; i--) {
        if (parents[i] instanceof parentType) {
            return parents[i];
        }
    }
}

const JITToClassCache = new Map<any, any>();
export const JITToClassFN = new Map<any, any>();

const JITToPlainCache = new Map<any, any>();
export const JITToPlainCacheFN = new Map<any, any>();

export type TypeConverterCompilerContext = { [name: string]: any };
export type TypeConverterCompiler = (setter: string, accessor: string, property: PropertyCompilerSchema, reserveVariable: () => string) => string | { template: string, context: TypeConverterCompilerContext };


const resolvedReflectionCaches = new Map<ClassType<any>, { [path: string]: PropertyCompilerSchema }>();

export function printToClassJitFunction(classType: ClassType<any>) {
    console.log(getClassName(classType), 'jit ', JITToClassFN.has(classType) ? JITToClassFN.get(classType)!.toString() : undefined);
}

/**
 * This resolves the PropertyCompilerSchema for a property path.
 *
 * A property path can be a deep path, separated with dots. This function makes sure to return the
 * correct PropertyCompilerSchema so that a correct compiler can be built to convert this type.
 */
export function resolvePropertyCompilerSchema<T>(schema: ClassSchema<T>, propertyPath: string): PropertyCompilerSchema {
    if (schema.classProperties.has(propertyPath)) return schema.classProperties.get(propertyPath)!;

    let cache = resolvedReflectionCaches.get(schema.classType);
    if (!cache) {
        cache = {};
        resolvedReflectionCaches.set(schema.classType, cache);
    }

    if (cache[propertyPath]) {
        return cache[propertyPath];
    }

    const names = propertyPath === '' ? [] : propertyPath.split('.');
    if (names.length === 1) return schema.getProperty(names[0]);

    for (let i = 0; i < names.length; i++) {
        const name = names[i];

        if (!schema.hasProperty(name)) {
            throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
        }

        let prop = schema.getProperty(name);

        if (prop.type === 'class' && prop.isResolvedClassTypeIsDecorated()) {
            const foreignSchema = getClassSchema(prop.getResolvedClassType());
            prop = foreignSchema.getProperty(foreignSchema.decorator!);
        }

        if (prop.isMap || prop.isArray) {
            if (prop.type === 'class') {
                if (names[i + 2]) {
                    return cache[propertyPath] = resolvePropertyCompilerSchema(
                        getClassSchema(prop.getResolvedClassType()),
                        names.slice(i + 2).join('.')
                    );
                } else if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = PropertyCompilerSchema.createFromPropertySchema(prop, false, false, false);
                }
            } else {
                if (names[i + 1]) {
                    //we got a name or array index
                    return cache[propertyPath] = PropertyCompilerSchema.createFromPropertySchema(prop, false, false, false);
                }
            }
        } else {
            if (prop.type === 'class') {
                return cache[propertyPath] = resolvePropertyCompilerSchema(getClassSchema(prop.getResolvedClassType()), names.slice(i + 1).join('.'));
            } else {
                //`Property ${getClassPropertyName(classType, name)} is not an array or map, so can not resolve ${propertyPath}.`
                throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
            }
        }
    }

    throw new Error(`Invalid path ${propertyPath} in class ${schema.getClassName()}.`);
}

const cacheJitProperty = new Map<string, WeakMap<PropertySchema, any>>();
const cacheJitVirtualProperty = new Map<string, Map<string, any>>();

/**
 * Creates a new JIT compiled function to convert given property schema for certain paths.
 * Paths can be deep paths making it possible to convert patch-like/mongo structure
 *
 * Note: If fromFormat -> toFormat has no compiler templates registered,
 * the generated function does virtually nothing.
 */
class JitPropertyConverter {
    protected schema: ClassSchema<any>;
    protected cacheJitVirtualPropertyMap: Map<string, any>;
    protected cacheJitPropertyMap: WeakMap<PropertyCompilerSchema, any>;

    constructor(
        public readonly fromFormat: string,
        public readonly toFormat: string,
        classType: ClassType<any>
    ) {
        this.schema = getClassSchema(classType);
        this.schema.initializeProperties();

        this.cacheJitPropertyMap = cacheJitProperty.get(fromFormat + ':' + toFormat)!;
        if (!this.cacheJitPropertyMap) {
            this.cacheJitPropertyMap = new WeakMap<PropertySchema, any>();
            cacheJitProperty.set(fromFormat + ':' + toFormat, this.cacheJitPropertyMap);
        }

        this.cacheJitVirtualPropertyMap = cacheJitVirtualProperty.get(fromFormat + ':' + toFormat)!;
        if (!this.cacheJitVirtualPropertyMap) {
            this.cacheJitVirtualPropertyMap = new Map<string, any>();
            cacheJitVirtualProperty.set(fromFormat + ':' + toFormat, this.cacheJitVirtualPropertyMap);
        }
    }

    convert(path: string, value: any, parents?: any[]): any {
        let property: PropertyCompilerSchema = this.schema.classProperties.get(path) || resolvePropertyCompilerSchema(this.schema, path);

        const jit = property.isRealProperty()
            ? this.cacheJitPropertyMap.get(property) : this.cacheJitVirtualPropertyMap.get(property.getCacheKey());

        if (jit) {
            return jit(value, parents);
        }

        const context = new Map<any, any>();

        const functionCode = `
        var result;
        return function(value, _parents) {
            if (!_parents) _parents = [];
            ${getDataConverterJS('result', 'value', property, this.fromFormat, this.toFormat, context)}
            return result;
        }
        `;

        const compiled = new Function(...context.keys(), functionCode);
        const fn = compiled.bind(undefined, ...context.values())();
        if (property.isRealProperty()) {
            this.cacheJitPropertyMap.set(property, fn);
        } else {
            this.cacheJitVirtualPropertyMap.set(property.getCacheKey(), fn);
        }

        return fn(value, parents);
    }
}

/**
 *
 * @param fromFormat
 * @param toFormat
 * @param property
 */
export function createJITConverterFromPropertySchema(
    fromFormat: string,
    toFormat: string,
    property: PropertySchema
): (value: any, parents?: any[]) => any {
    let cacheJitPropertyMap = cacheJitProperty.get(fromFormat + ':' + toFormat)!;
    if (!cacheJitPropertyMap) {
        cacheJitPropertyMap = new WeakMap<PropertySchema, any>();
        cacheJitProperty.set(fromFormat + ':' + toFormat, cacheJitPropertyMap);
    }

    const jit = cacheJitPropertyMap.get(property);

    if (jit) {
        return jit;
    }

    const context = new Map<any, any>();

    const functionCode = `
        var result;
        return function(value, _parents) {
            if (!_parents) _parents = [];
            ${getDataConverterJS('result', 'value', property, fromFormat, toFormat, context)}
            return result;
        }
        `;

    const compiled = new Function(...context.keys(), functionCode);
    const fn = compiled.bind(undefined, ...context.values())();
    cacheJitPropertyMap.set(property, fn);

    return fn;
}

function reserveVariable(
    rootContext: Map<string, any>,
) {
    for (let i = 0; i < 10000; i++) {
        const candidate = 'var_' + i;
        if (!rootContext.has(candidate)) {
            rootContext.set(candidate, undefined);
            return candidate;
        }
    }
    throw new Error('Too many context variables');
}

function getParentResolverJS<T>(
    classType: ClassType<T>,
    setter: string,
    property: PropertySchema,
    context: Map<string, any>
): string {
    context.set('findParent', findParent);
    const varClassType = reserveVariable(context);
    context.set(varClassType, property.resolveClassType);

    const code = `${setter} = findParent(_parents, ${varClassType});`;

    if (property.isOptional) {
        return code;
    }

    return `
    ${code}
    if (!${setter})
        throw new Error('${getClassPropertyName(classType, property.name)} is defined as @ParentReference() and ' +
                    'NOT @f.optional(), but no parent found. Add @f.optional() or provide ${property.name} in parents to fix that.');
    `;
}

function executeCompiler(
    rootContext: Map<string, any>,
    compiler: TypeConverterCompiler,
    setter: string,
    getter: string,
    property: PropertyCompilerSchema,
): string {

    const res = compiler(setter, getter, property, reserveVariable.bind(undefined, rootContext));
    if ('string' === typeof res) {
        return res;
    } else {
        for (const i in res.context) {
            if (!res.context.hasOwnProperty(i)) continue;
            rootContext.set(i, res.context[i]);
        }
        return res.template;
    }
}

function getDataConverterJS(
    setter: string,
    accessor: string,
    property: PropertyCompilerSchema,
    fromFormat: string,
    toFormat: string,
    rootContext: Map<string, any>
): string {
    let compiler = compilerRegistry.get(fromFormat + ':' + toFormat + ':' + property.type);

    if (property.isArray) {
        //we just use `a.length` to check whether its array-like, because Array.isArray() is way too slow.
        if (!compiler) {
            return `
                if (${accessor} && ${accessor}.length) {
                     ${setter} = ${accessor}.slice();
                }
            `
        }
        return `
            if (${accessor} && ${accessor}.length) {
                 var l = ${accessor}.length;
                 var a = ${accessor}.slice();
                 while (l--) {
                    //make sure all elements have the correct type
                    ${executeCompiler(rootContext, compiler, `a[l]`, `a[l]`, property)}
                 } 
                 ${setter} = a;
            }
        `;
    } else if (property.isMap) {
        const line = compiler ? executeCompiler(rootContext, compiler, `a[i]`, `${accessor}[i]`, property) : `a[i] = ${accessor}[i];`;
        return `
            var a = {};
            if (${accessor} && 'object' === typeof ${accessor}) {
                for (var i in ${accessor}) {
                    if (!${accessor}.hasOwnProperty(i)) continue;
                    ${line}
                }
                ${setter} = a;
            }
        `;
    } else if (property.isPartial) {
        const varClassType = reserveVariable(rootContext);
        rootContext.set('jitPartial', jitPartial);
        rootContext.set(varClassType, property.resolveClassType);
        return `${setter} = jitPartial('${fromFormat}', '${toFormat}', ${varClassType}, ${accessor})`;
    } else if (compiler) {
        return executeCompiler(rootContext, compiler, setter, accessor, property);
    } else {
        return `${setter} = ${accessor};`;
    }
}

export class ToClassState {
    onFullLoadCallbacks: (() => void)[] = [];
}

export function createClassToXFunction<T>(classType: ClassType<T>, toFormat: string | 'plain')
    : (instance: T) => any {
    let jit = JITToPlainCache.get(classType);
    if (jit) return jit;

    const schema = getClassSchema(classType);
    const context = new Map<string, any>();

    const decoratorName = getDecorator(classType);
    let functionCode = '';
    if (decoratorName) {
        const property = schema.getProperty(decoratorName);

        functionCode = `
            if (_instance.${decoratorName} === null) return null;
            if (_instance.${decoratorName} === undefined) return;
            var result;
            ${getDataConverterJS(`result`, `_instance.${decoratorName}`, property, 'class', toFormat, context)}
            return result;
        `;
        // return propertyClassToPlain(classType, decoratorName, (target as any)[decoratorName]);
    } else {

        const convertProperties: string[] = [];

        // const excludeReferences = options ? options.excludeReferences === true : false;
        const excludeReferences = true;

        for (const property of schema.classProperties.values()) {
            if (property.isParentReference) {
                //we do not export parent references, as this would lead to an circular reference
                continue;
            }
            if (excludeReferences && (property.isReference || property.backReference || property.isReferenceKey)) continue;

            if (isExcluded(classType, property.name, toFormat)) {
                continue
            }

            convertProperties.push(`
                if (_instance.${property.name} === null) {
                    _data.${property.name} = null;
                } else if (_instance.${property.name} !== undefined){
                    ${getDataConverterJS(`_data.${property.name}`, `_instance.${property.name}`, property, 'class', toFormat, context)}
                }
        `);
        }

        functionCode = `
        return function(_instance) {
            const _data = {};
            MarshalGlobal.unpopulatedCheckActive = false;
            ${convertProperties.join('\n')}
            MarshalGlobal.unpopulatedCheckActive = true;
            return _data;
        }
        `;
    }


    try {
        const compiled = new Function('_classType', 'MarshalGlobal', ...context.keys(), functionCode);
        const fn = compiled(classType, MarshalGlobal, ...context.values());
        JITToPlainCache.set(classType, fn);

        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}

export function createXToClassFunction<T>(classType: ClassType<T>, fromTarget: string | 'plain')
    : (data: { [name: string]: any }, parents?: any[], state?: ToClassState) => T {
    let jit = JITToClassCache.get(classType);
    if (jit) return jit;

    const schema = getClassSchema(classType);
    const context = new Map<string, any>();

    const setProperties: string[] = [];
    const constructorArguments: string[] = [];
    const constructorArgumentNames: string[] = [];
    const assignedViaConstructor: { [propertyName: string]: boolean } = {};
    const constructorParameter = schema.getMethodProperties('constructor');

    for (const property of constructorParameter) {
        assignedViaConstructor[property.name] = true;

        if (schema.decorator && property.name === schema.decorator) {
            constructorArguments.push(`var c_${property.name} = _data;
                if (undefined !== c_${property.name} && null !== c_${property.name}) {
                    ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, fromTarget, 'class', context)}
                }
            `);
        } else if (property.isParentReference) {
            //parent resolver
            setProperties.push(`var c_${property.name}; ` + getParentResolverJS(classType, `_${property.name}`, property, context));
        } else {
            constructorArguments.push(`var c_${property.name} = _data.${property.name}; 
                if (undefined !== c_${property.name} && null !== c_${property.name}) {
                    ${getDataConverterJS(`c_${property.name}`, `c_${property.name}`, property, fromTarget, 'class', context)}
                }
            `);
        }

        constructorArgumentNames.push(`c_${property.name}`);
    }

    for (const property of schema.classProperties.values()) {
        if (assignedViaConstructor[property.name]) continue;
        if (property.isReference || property.backReference) continue;

        if (property.isParentReference) {
            setProperties.push(getParentResolverJS(classType, `_instance.${property.name}`, property, context));
        } else {
            setProperties.push(`
            if (undefined !== _data.${property.name} && null !== _data.${property.name}) {
                ${getDataConverterJS(`_instance.${property.name}`, `_data.${property.name}`, property, fromTarget, 'class', context)}
            }
            `);
        }
    }

    const registerLifeCircleEvents: string[] = [];
    for (const onLoad of schema.onLoad) {
        if (onLoad.options.fullLoad) {
            registerLifeCircleEvents.push(`
                _state.onFullLoadCallbacks.push(_instance.${onLoad.methodName}.bind(_instance));
            `)
        } else {
            registerLifeCircleEvents.push(`
                _instance.${onLoad.methodName}();
            `)
        }
    }

    let fullLoadHookPre = '';
    let fullLoadHookPost = '';
    if (schema.hasFullLoadHooks()) {
        fullLoadHookPre = `var hadInstance = !!_state;`;
        fullLoadHookPost = `
            if (!hadInstance) {
                //we are at the end, so call fullLoad hooks
                for (const cb of _state.onFullLoadCallbacks) cb();
            }
        `;
    }

    const functionCode = `
        return function(_data, _parents, _state) {
            ${fullLoadHookPre}
            _state = _state || new ToClassState();
            ${constructorArguments.join('\n')}
            const _instance = new _classType(${constructorArgumentNames.join(', ')});
            ${setProperties.join('\n')}
            ${registerLifeCircleEvents.join('\n')}
            ${fullLoadHookPost}
            return _instance;
        }
    `;

    try {
        const compiled = new Function('_classType', 'ToClassState', ...context.keys(), functionCode);
        const fn = compiled(classType, ToClassState, ...context.values());
        JITToClassCache.set(classType, fn);

        return fn;
    } catch (error) {
        console.log('jit code', functionCode);
        throw error;
    }
}

export function jitPlainToClass<T>(classType: ClassType<T>, data: any, parents?: any[]): T {
    return createXToClassFunction(classType, 'plain')(data, parents);
}


export function jitClassToPlain<T>(classType: ClassType<T>, instance: T): Partial<T> {
    if (!(instance instanceof classType)) {
        throw new Error(`Could not classToPlain since target is not a class instance of ${getClassName(classType)}`);
    }

    return createClassToXFunction(classType, 'plain')(instance);
}

export function jitPartial<T, K extends keyof T>(
    fromFormat: string,
    toFormat: string,
    classType: ClassType<T>,
    partial: { [name: string]: any },
    parents?: any[]
): Partial<{ [F in K]: any }> {
    const result: Partial<{ [F in K]: any }> = {};
    const jitConverter = new JitPropertyConverter(fromFormat, toFormat, classType);

    for (const i in partial) {
        if (!partial.hasOwnProperty(i)) continue;
        result[i] =
            result[i] = jitConverter.convert(i, partial[i], parents);
    }

    return result;
}


export function jitPartialClassToPlain<T, K extends keyof T>(classType: ClassType<T>, partial: { [name: string]: any }): Partial<{ [F in K]: any }> {
    return jitPartial('class', 'plain', classType, partial);
}

export function jitPartialPlainToClass<T, K extends keyof T>(classType: ClassType<T>, partial: { [name: string]: any }, parents?: any[]): Partial<{ [F in K]: any }> {
    return jitPartial('plain', 'class', classType, partial, parents);
}
