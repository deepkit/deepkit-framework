import {ClassSchema, getDataConverterJS, getGlobalStore, JitStack, PropertySchema} from '@super-hornet/marshal';
import {PrimaryKey} from './identity-map';

/**
 */
function createJITConverterForSnapshot(
    classSchema: ClassSchema,
    properties: Iterable<PropertySchema>
) {
    const context = new Map<any, any>();
    const jitStack = new JitStack();
    const setProperties: string[] = [];

    for (const property of properties) {
        if (property.isParentReference) continue;

        if (property.isReference) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
                referenceCode.push(`
                //createJITConverterForSnapshot ${property.name}->${pk.name} class:snapshot:${property.type} reference
                ${getDataConverterJS(`_result.${property.name}.${pk.name}`, `_value.${property.name}.${pk.name}`, pk, 'class', 'plain', context, jitStack)}
                `);
            }

            setProperties.push(`
            //createJITConverterForSnapshot ${property.name} class:snapshot:${property.type} reference
            if (undefined === _value.${property.name}) {
                _result.${property.name} = null;
            } else if (null === _value.${property.name}) {
                _result.${property.name} = null;
            } else {
                _result.${property.name} = {};
                ${referenceCode.join('\n')}
            }
            `);
            continue;
        }

        setProperties.push(`
            //createJITConverterForSnapshot ${property.name} class:snapshot:${property.type}
            ${getDataConverterJS(
            `_result.${property.name}`, `_value.${property.name}`, property, 'class', 'plain', context, jitStack,
            `_result.${property.name} = null`, `_result.${property.name} = null`,
        )}
            `);
    }

    const functionCode = `
        return function(_value, _parents, _options) {
            var _result = {};
            var _oldCheckActive = _global.unpopulatedCheckActive;
            _global.unpopulatedCheckActive = false;
            ${setProperties.join('\n')}
            _global.unpopulatedCheckActive = _oldCheckActive;
            return _result;
        }
        `;

    // console.log('functionCode', functionCode);
    const compiled = new Function('_global', ...context.keys(), functionCode);
    const fn = compiled.bind(undefined, getGlobalStore(), ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}

const snapshots = new Map<ClassSchema, any>();

/**
 * Creates a new JIT compiled function to convert the class instance to a snapshot.
 * A snapshot is essentially the class instance as `plain` serialization while references are
 * stored only as primary keys.
 *
 * Generated function is cached.
 */
export function getJITConverterForSnapshot(
    classSchema: ClassSchema<any>
): (value: any) => any {
    let jit = snapshots.get(classSchema);
    if (jit && jit.buildId === classSchema.buildId) return jit;
    jit = createJITConverterForSnapshot(classSchema, classSchema.getClassProperties().values());
    snapshots.set(classSchema, jit);
    return jit;
}

const primaryKeyExtractors = new Map<ClassSchema, any>();

export function getPrimaryKeyExtractor<T>(
    classSchema: ClassSchema<T>
): (value: any) => PrimaryKey<T> {
    let jit = primaryKeyExtractors.get(classSchema);
    if (jit && jit.buildId === classSchema.buildId) return jit;
    jit = createJITConverterForSnapshot(classSchema, classSchema.getPrimaryFields());
    primaryKeyExtractors.set(classSchema, jit);
    return jit;
}

const jitPrimaryKeyHashGenerator = new Map<string, Map<ClassSchema<any>, any>>();
export function getPrimaryKeyHashGenerator(
    classSchema: ClassSchema<any>,
    fromFormat: string = 'class'
): (value: any) => string {
    let map = jitPrimaryKeyHashGenerator.get(fromFormat);
    if (!map) {
        map = new Map();
        jitPrimaryKeyHashGenerator.set(fromFormat, map);
    }

    let jit = map.get(classSchema);
    if (jit && jit.buildId === classSchema.buildId) return jit;

    jit = createPrimaryKeyHashGenerator(classSchema, fromFormat);

    map.set(classSchema, jit);
    return jit;
}

function createPrimaryKeyHashGenerator(
    classSchema: ClassSchema<any>,
    fromFormat: string = 'class'
) {
    const context = new Map<any, any>();
    const setProperties: string[] = [];
    const jitStack = new JitStack();

    for (const property of classSchema.getPrimaryFields()) {
        if (property.isParentReference) continue;

        if (property.isReference) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
                if (pk.type === 'class') {
                    throw new Error(`Class as primary key (${property.getResolvedClassSchema().getClassName()}.${pk.name}) is not supported`);
                }

                referenceCode.push(`
                //getPrimaryKeyExtractor ${property.name}->${pk.name} class:snapshot:${property.type} reference
                lastValue = '';
                ${getDataConverterJS(`lastValue`, `_value.${property.name}.${pk.name}`, pk, fromFormat, 'plain', context, jitStack)}
                _result += '\\0' + lastValue;
            `);
            }

            setProperties.push(`
            //getPrimaryKeyExtractor ${property.name} class:snapshot:${property.type} reference
            if (undefined !== _value.${property.name} && null !== _value.${property.name}) {
                ${referenceCode.join('\n')}
            } else {
                _result += '\\0';
            }
            `);
            continue;
        }

        if (property.type === 'class') {
            throw new Error(`Class as primary key (${classSchema.getClassName()}.${property.name}) is not supported`);
        }

        setProperties.push(`
            //getPrimaryKeyHashGenerator ${property.name} class:plain:${property.type}
            lastValue = '';
            ${getDataConverterJS(`lastValue`, `_value.${property.name}`, property, fromFormat, 'plain', context, jitStack)}
            _result += '\\0' + lastValue;
        `);
    }

    const functionCode = `
        return function(_value) {
            var _result = '';
            var lastValue;
            ${setProperties.join('\n')}
            return _result;
        }
    `;

    const compiled = new Function('_global', ...context.keys(), functionCode);
    const fn = compiled.bind(undefined, getGlobalStore(), ...context.values())();
    fn.buildId = classSchema.buildId;
    return fn;
}
