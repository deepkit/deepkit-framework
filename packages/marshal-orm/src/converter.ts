import {ClassSchema, getDataConverterJS, getGlobalStore, PropertySchema} from '@super-hornet/marshal';
import {PrimaryKey} from './identity-map';

const jitSnapshotConverter = new Map<ClassSchema<any>, (value: any) => any>();
const jitPrimaryKeyExtractor = new Map<ClassSchema<any>, (value: any) => PrimaryKey<any>>();
const jitPrimaryKeyHashGenerator = new Map<string, Map<ClassSchema<any>, (value: any) => string>>();

/**
 */
function createJITConverterForSnapshot(
    properties: Iterable<PropertySchema>
): (value: any) => any {
    const context = new Map<any, any>();
    const setProperties: string[] = [];

    for (const property of properties) {
        if (property.isParentReference) continue;

        if (property.isReference) {
            const referenceCode: string[] = [];

            for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
                referenceCode.push(`
                //createJITConverterForSnapshot ${property.name}->${pk.name} class:snapshot:${property.type} reference
                if (undefined !== _value.${property.name}.${pk.name} && null !== _value.${property.name}.${pk.name}) {
                    ${getDataConverterJS(`_result.${property.name}.${pk.name}`, `_value.${property.name}.${pk.name}`, pk, 'class', 'plain', context)}
                }
            `);
            }

            setProperties.push(`
            //createJITConverterForSnapshot ${property.name} class:snapshot:${property.type} reference
            if (undefined !== _value.${property.name} && null !== _value.${property.name}) {
                _result.${property.name} = {};
                ${referenceCode.join('\n')}
            }
            `);
            continue;
        }

        setProperties.push(`
            //createJITConverterForSnapshot ${property.name} class:snapshot:${property.type}
            if (undefined !== _value.${property.name} && null !== _value.${property.name}) {
                ${getDataConverterJS(`_result.${property.name}`, `_value.${property.name}`, property, 'class', 'plain', context)}
            }
            `);
    }

    const functionCode = `
        return function(_value, _parents, _options) {
            var _state;
            function getParents() {
                return [];
            }
            var _result = {};
            var _oldCheckActive = _global.unpopulatedCheckActive;
            _global.unpopulatedCheckActive = false;
            ${setProperties.join('\n')}
            _global.unpopulatedCheckActive = _oldCheckActive;
            return _result;
        }
        `;

    const compiled = new Function('_global', ...context.keys(), functionCode);
    return compiled.bind(undefined, getGlobalStore(), ...context.values())();
}

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
    let jit = jitSnapshotConverter.get(classSchema);
    if (!jit) {
        jit = createJITConverterForSnapshot(classSchema.getClassProperties().values())
        jitSnapshotConverter.set(classSchema, jit);
    }

    return jit;
}

export function getPrimaryKeyExtractor<T>(
    classSchema: ClassSchema<T>
): (value: any) => PrimaryKey<T> {
    let jit = jitPrimaryKeyExtractor.get(classSchema);
    if (!jit) {
        jit = createJITConverterForSnapshot(classSchema.getPrimaryFields())
        jitPrimaryKeyExtractor.set(classSchema, jit);
    }

    return jit;
}

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
    if (jit) return jit;

    const context = new Map<any, any>();
    const setProperties: string[] = [];

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
                var referencePkValue;
                if (undefined !== _value.${property.name}.${pk.name} && null !== _value.${property.name}.${pk.name}) {
                    referencePkValue = '';
                    ${getDataConverterJS(`referencePkValue`, `_value.${property.name}.${pk.name}`, pk, fromFormat, 'plain', context)}
                    _result += ',' + referencePkValue;
                } else {
                    _result += ',';
                }
            `);
            }

            setProperties.push(`
            //getPrimaryKeyExtractor ${property.name} class:snapshot:${property.type} reference
            if (undefined !== _value.${property.name} && null !== _value.${property.name}) {
                ${referenceCode.join('\n')}
            } else {
                _result += ',';
            }
            `);
            continue;
        }

        if (property.type === 'class') {
            throw new Error(`Class as primary key (${classSchema.getClassName()}.${property.name}) is not supported`);
        }

        setProperties.push(`
            //getPrimaryKeyHashGenerator ${property.name} class:plain:${property.type}
            if (undefined !== _value.${property.name} && null !== _value.${property.name}) {
                lastValue = '';
                ${getDataConverterJS(`lastValue`, `_value.${property.name}`, property, fromFormat, 'plain', context)}
                _result += ',' + lastValue;
            } else {
                _result += ',';
            }
            `);
    }

    const functionCode = `
        return function(_value, _parents, _options) {
            var _state;
            function getParents() {
                return [];
            }
            var _result = '', lastValue;
            _global.unpopulatedCheckActive = false;
            ${setProperties.join('\n')}
            _global.unpopulatedCheckActive = true;
            return _result;
        }
        `;

    const compiled = new Function('_global', ...context.keys(), functionCode);
    map.set(classSchema, compiled.bind(undefined, getGlobalStore(), ...context.values())());

    return map.get(classSchema)!;
}
