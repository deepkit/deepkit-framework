import { DatabaseInfo } from "@deepkit/orm-browser-api";
import { getInstanceState } from "@deepkit/orm";
import { getChangeDetector, Changes, ClassSchema, getConverterForSnapshot, getPrimaryKeyHashGenerator } from "@deepkit/type";

export type ChangesStore = { [pkHash: string]: Changes<any> };

export class BrowserState {
    databases: DatabaseInfo[] = [];
    database?: DatabaseInfo;
    entity?: ClassSchema;

    addedItems: { [entityName: string]: any[] } = {};

    changes: { [entityName: string]: ChangesStore } = {};

    getEntity(dbName: string, name: string): ClassSchema {
        for (const db of this.databases) {
            for (const entity of db.getClassSchemas()) {
                if (entity.name === name) return entity;
            }
        }

        throw new Error(`No entity ${name} in db ${dbName} found`)
    }

    getChangeStore(dbName: string, entityName: string): ChangesStore {
        return this.changes[dbName + ':::' + entityName] ||= {};
    }

    changed(dbName: string, entityName: string, item: any) {
        const entity = this.getEntity(dbName, entityName);
        const changes = this.getChangeStore(dbName, entityName);

        const state = getInstanceState(item);

        const lastSnapshot = state.getSnapshot();
        const changeDetector = getChangeDetector(entity);
        const doSnapshot = getConverterForSnapshot(entity);

        const currentSnapshot = doSnapshot(item);
        const changeSet = changeDetector(lastSnapshot, currentSnapshot, item);
        const pkHash = state.getLastKnownPKHash();

        if (changeSet) {
            changes[pkHash] = changeSet;
        } else if (changes[pkHash]) {
            delete changes[pkHash];
        }

        // const entity = this.getEntity(dbName, entityName);

        // const snapshots = this.snapshots[entityName];
        // if (!snapshots) return;

        // const primaryKeyHashGen = getPrimaryKeyHashGenerator(this.getEntity(dbName, entityName));

        // // this doesn't work when PK is allowed to change. we need InstanteState as well
        // const pkHash = primaryKeyHashGen(item);

        // const changes = this.changes[entityName] ||= {};

        // changes[pkHash] = buildChanges(entity, snapshots[pkHash], item);
    }
}