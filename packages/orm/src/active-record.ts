import {ClassType, getClassName} from '@deepkit/core';
import {Database} from './database';
import {getClassSchema} from '@deepkit/type';

export interface ActiveRecordType {
    new(...args: any[]): ActiveRecord;

    getDatabase(): Database<any>;

    registerDatabase(database: Database<any>): void;

    query(): any;
}

export function isActiveRecordType(entity: any): entity is ActiveRecordType {
    return 'function' === entity.getDatabase || 'function' === entity.registerDatabase || 'function' === entity.query;
}

export class ActiveRecord {
    public static getDatabase(): Database<any> {
        const database = getClassSchema(this).data['orm.database'] as Database<any> | undefined;
        if (!database) throw new Error(`No database assigned to ${getClassName(this)}. Use Database.registerEntity(${getClassName(this)}) first.`);
        return database;
    }

    public static registerDatabase(database: Database<any>): void {
        getClassSchema(this).data['orm.database'] = database;
    }

    public async save(): Promise<void> {
        const db = ((this as any).constructor as ActiveRecordType).getDatabase();
        await db.persist(this);
    }

    public async remove(): Promise<void> {
        const db = ((this as any).constructor as ActiveRecordType).getDatabase();
        await db.remove(this);
    }

    public static query() {
        return this.getDatabase().query(this);
    }
}
