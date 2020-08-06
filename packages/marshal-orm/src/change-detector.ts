import {getClassSchema} from '@super-hornet/marshal';
import {getInstanceState} from './identity-map';
import {getJITConverterForSnapshot} from './converter';

export function buildChanges<T>(item: T) {
    const state = getInstanceState(item);
    const schema = getClassSchema(item);

    const lastSnapshot = state.getSnapshot();
    const currentSnapshot = getJITConverterForSnapshot(schema)(item);

    const changes: {[path: string]: any} = {};
    for (const property of schema.getClassProperties().values()) {
        if (property.isReference) {
            //extract primaryKey hashes and compare
            continue;
        }

        if (property.backReference) {
            continue;
        }

        if (property.isArray || property.isMap || property.isPartial) {
            continue;
        }

        if (lastSnapshot[property.name as keyof T & string] !== currentSnapshot[property.name as keyof T & string]) {
            changes[property.name] = currentSnapshot[property.name as keyof T & string];
        }
    }

    return changes;
}
