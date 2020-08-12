import {ClassSchema, getGlobalStore, PropertySchema} from '@super-hornet/marshal';
import {getInstanceState} from './identity-map';

function createJITChangeDetectorForSnapshot(schema: ClassSchema): (lastSnapshot: any, currentSnapshot: any) => any {
    const context = new Map<any, any>();
    const props: string[] = [];

    function getComparator(property: PropertySchema, last: string, current: string, changedName: string, onChanged?: string): string {
        if (property.isArray) {
            return `
                if (!${current} && !${last}) {
                
                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes.${changedName} = true;
                    ${onChanged}
                } else if (${current}.length !== ${last}.length) {
                    changes.${changedName} = true;
                    ${onChanged}
                } else {
                    let l = ${last}.length;
                    ${onChanged ? '' : 'root:'}
                    while (l--) {
                         ${getComparator(property.getSubType(), `${last}[l]`, `${current}[l]`, changedName, 'break root;')}
                    }
                }
            `;

        } else if (property.isMap || property.isPartial) {
            return `
                if (!${current} && !${last}) {
                    
                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes.${changedName} = true;
                    ${onChanged}
                } else if (${current}.length !== ${last}.length) {
                    changes.${changedName} = true;
                    ${onChanged}
                } else {
                    ${onChanged ? '' : 'root:'}
                    for (let i in ${last}) {
                        if (!${last}.hasOwnProperty(i)) continue;
                         ${getComparator(property.getSubType(), `${last}[i]`, `${current}[i]`, changedName, 'break root;')}
                    }
                }
            `;
        } else if (property.type === 'class') {
            const propClassSchema = '_classSchema_' + property.name;
            context.set('jitChangeDetector', jitChangeDetector);
            context.set(propClassSchema, property.getResolvedClassSchema());
            return `
                if (!${current} && !${last}) {
                
                } else if ((${current} && !${last}) || (!${current} && ${last})) {
                    changes.${changedName} = true;
                    ${onChanged}
                } else {
                    const thisChanged = jitChangeDetector(${propClassSchema})(${last}, ${current});
                    if (Object.keys(thisChanged).length) {
                        changes.${changedName} = true;
                        ${onChanged}    
                    }
                }
            `;
        } else if (property.type === 'any' || property.type === 'union') {
            //generic purpose comparator necessary
            //encoded either as (number, boolean, string, array, or object)

        } else {
            //binary, boolean, etc are encoded as simple JSON objects (number, boolean, or string)
            //primitive
            return `
            if (${last} !== ${current}) {
                changes.${changedName} = true;
                ${onChanged}
            }`;
        }

        return '';
    }

    for (const property of schema.getClassProperties().values()) {
        if (property.isParentReference) continue;

        // if (property.isReference) {
        //     const referenceCode: string[] = [];
        //
        //     for (const pk of property.getResolvedClassSchema().getPrimaryFields()) {
        //         referenceCode.push(`
        //         //createJITConverterForSnapshot ${property.name}->${pk.name} class:snapshot:${property.type} reference
        //         ${getDataConverterJS(`_result.${property.name}.${pk.name}`, `_value.${property.name}.${pk.name}`, pk, 'class', 'plain', context)}
        //         `);
        //     }
        //
        //     setProperties.push(`
        //     //createJITChangeDetectorForSnapshot ${property.name} class:snapshot:${property.type} reference
        //     if (undefined === _value.${property.name}) {
        //         _result.${property.name} = null;
        //     } else if (null === _value.${property.name}) {
        //         _result.${property.name} = null;
        //     } else {
        //         _result.${property.name} = {};
        //         ${referenceCode.join('\n')}
        //     }
        //     `);
        //     continue;
        // }

        props.push(getComparator(property, `last.${property.name}`, `current.${property.name}`, property.name, ''));
    }

    const functionCode = `
        return function(last, current) {
            var changes = {};
            ${props.join('\n')}
            return changes;
        }
        `;

    // console.log('functionCode', functionCode);
    try {
        const compiled = new Function('_global', ...context.keys(), functionCode);
        const fn = compiled.bind(undefined, getGlobalStore(), ...context.values())();
        fn.buildId = schema.buildId;
        return fn;
    } catch (error) {
        console.log('functionCode', functionCode);
        throw error;
    }
}

const changeDetectorSymbol = Symbol('changeDetector');

export function jitChangeDetector(classSchema: ClassSchema): (last: any, current: any) => { [name: string]: any } {
    return classSchema.getJit(changeDetectorSymbol, () => createJITChangeDetectorForSnapshot(classSchema));
}

export function buildChanges<T>(item: T) {
    const state = getInstanceState(item);
    const lastSnapshot = state.getSnapshot();
    const currentSnapshot = state.doSnapshot(item);
    const changes: { [path: string]: any } = {};
    const changed = state.changeDetector(lastSnapshot, currentSnapshot);
    for (let i in changed) {
        changes[i] = (item as any)[i];
    }
    return changes;
}

export function buildChangeOld<T>(item: T) {
    const state = getInstanceState(item);
    const lastSnapshot = state.getSnapshot();
    const currentSnapshot = state.doSnapshot(item);
    const changes: { [path: string]: any } = {};

    for (const property of state.classSchema.getClassProperties().values()) {
        const last = lastSnapshot[property.name as keyof T & string];
        const current = currentSnapshot[property.name as keyof T & string];

        if (property.isReference) {
            //currentSnapshot[property.name] is always an object or undefined
            if (last && !current) {
                changes[property.name] = current;
                continue;
            }

            if (!last && current) {
                changes[property.name] = current;
                continue;
            }

            for (const pkField of property.getResolvedClassSchema().getPrimaryFields()) {
                if (last[pkField.name] !== current[pkField.name]) {
                    changes[property.name] = current;
                    break;
                }
            }
            continue;
        }

        if (property.backReference) {
            //we dont track back references. They are not stored in the database on this side, so why should we?
            continue;
        }

        if (property.isArray) {

        }

        if (property.isMap || property.isPartial) {
            //todo implement that shit
            continue;
        }

        if (property.type === 'class') {
            //todo implement that shit
            continue;
        }

        //last and current are in JSON format, so we can compare directly.
        if (last !== current) {
            changes[property.name] = current;
        }
    }

    return changes;
}
