import { AsyncEventSubscription, ClassType } from "@deepkit/core";
import { ClassSchema, getClassSchema, t } from "@deepkit/type";
import { Entity } from "../type";
import { Database, DatabaseAdapter } from "../database";
import { GenericQuery } from "../query";

interface SoftDeleteEntity extends Entity {
    deletedAt?: Date;
    deletedBy?: any;
}

const deletedAtName = 'deletedAt';

export class SoftDeleteQuery<T extends SoftDeleteEntity> extends GenericQuery<T> {
    includeSoftDeleted: boolean = false;
    setDeletedBy?: T['deletedBy'];

    clone(): this {
        const c = super.clone();
        c.includeSoftDeleted = this.includeSoftDeleted;
        c.setDeletedBy = this.setDeletedBy;
        return c;
    }

    /**
     * Enables fetching, updating, and deleting of soft-deleted records.
     */
    withSoftDeleted(): this {
        const m = this.clone();
        m.includeSoftDeleted = true;
        return m;
    }

    deletedBy(value: T['deletedBy']): this {
        const c = this.clone();
        c.setDeletedBy = value;
        return c;
    }

    async restoreOne() {
        const patch = { [deletedAtName]: undefined } as Partial<T>;
        if (this.classSchema.hasProperty('deletedBy')) patch['deletedBy'] = undefined;
        await this.withSoftDeleted().patchOne(patch);
    }

    async restoreMany() {
        const patch = { [deletedAtName]: undefined } as Partial<T>;
        if (this.classSchema.hasProperty('deletedBy')) patch['deletedBy'] = undefined;
        await this.withSoftDeleted().patchMany(patch);
    }

    async hardDeleteOne() {
        await this.withSoftDeleted().deleteOne();
    }

    async hardDeleteMany() {
        await this.withSoftDeleted().deleteMany();
    }
}

export class SoftDelete {
    protected listeners = new Map<ClassSchema, {
        queryFetch: AsyncEventSubscription, queryPatch: AsyncEventSubscription,
        queryDelete: AsyncEventSubscription, uowDelete: AsyncEventSubscription
    }>();

    constructor(protected database: Database<DatabaseAdapter>) {
    }

    enable<T extends SoftDeleteEntity>(...classSchemaOrTypes: (ClassSchema<T> | ClassType<T>)[]) {
        for (const type of classSchemaOrTypes) this.enableForSchema(type);
    }

    disable(...classSchemaOrTypes: (ClassSchema | ClassType)[]) {
        for (const type of classSchemaOrTypes) this.disableForSchema(type);
    }

    protected disableForSchema(classSchemaOrType: ClassSchema | ClassType) {
        const schema = getClassSchema(classSchemaOrType);
        const listener = this.listeners.get(schema);
        if (listener) {
            listener.queryFetch.unsubscribe();
            listener.queryPatch.unsubscribe();
            listener.queryDelete.unsubscribe();
            listener.uowDelete.unsubscribe();
            this.listeners.delete(schema);
        }
    }

    protected enableForSchema<T extends SoftDeleteEntity>(classSchemaOrType: ClassSchema<T> | ClassType<T>) {
        const schema = getClassSchema(classSchemaOrType);
        const hasDeletedBy = schema.hasProperty('deletedBy');

        if (!schema.hasProperty(deletedAtName)) {
            throw new Error(`Entity ${schema.getClassName()} has no ${deletedAtName} property. Please define one as type '${deletedAtName}: t.date.optional'`);
        }

        function queryFilter(event: { classSchema: ClassSchema, query: GenericQuery<any> }) {
            //this is for each query method: count, find, findOne(), etc.

            //we don't change SoftDeleteQuery instances as they operate on the raw records without filter
            if (event.query instanceof SoftDeleteQuery && event.query.includeSoftDeleted === true) return;

            if (event.classSchema !== schema) return; //do nothing

            //attach the filter to exclude deleted records
            event.query = event.query.addFilter(deletedAtName, undefined);
        }

        const queryFetch = this.database.queryEvents.onFetch.subscribe(queryFilter);
        const queryPatch = this.database.queryEvents.onPatchPre.subscribe(queryFilter);

        const queryDelete = this.database.queryEvents.onDeletePre.subscribe(async event => {
            if (event.classSchema !== schema) return; //do nothing

            //we don't change SoftDeleteQuery instances as they operate on the raw records without filter
            if (event.query instanceof SoftDeleteQuery && event.query.includeSoftDeleted === true) return;

            //stop actual query delete query and all subsequent running event listener
            event.stop();

            const patch = { [deletedAtName]: new Date } as Partial<T>;
            if (hasDeletedBy && event.query instanceof SoftDeleteQuery && event.query.setDeletedBy !== undefined) {
                patch.deletedBy = event.query.setDeletedBy;
            }

            await event.query.patchMany(patch);
        });

        const uowDelete = this.database.unitOfWorkEvents.onDeletePre.subscribe(async event => {
            if (event.classSchema !== schema) return; //do nothing

            //stop actual query delete query and all subsequent running event listener
            event.stop();

            const patch = { [deletedAtName]: new Date } as Partial<T>;
            if (hasDeletedBy) {
                // patch.deletedBy = 
            }

            await event.databaseSession.query(schema).filter({
                [schema.getPrimaryFieldName()]: event.getPrimaryKeys()
            }).patchMany(patch);
        });

        this.listeners.set(schema, { queryFetch, queryPatch, queryDelete, uowDelete });
    }
}