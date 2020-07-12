import {getClassSchema, getClassTypeFromInstance} from "@super-hornet/marshal";
import {DatabaseAdapter} from "./database";
import {
    EntityRegistry,
    getLastKnownPKInDatabase,
    isItemKnownInDatabase,
    markItemAsKnownInDatabase,
    unmarkItemAsKnownInDatabase
} from "./entity-register";

let SESSION_IDS = 0;

export class DatabaseSession<ADAPTER extends DatabaseAdapter> {

    public readonly id = SESSION_IDS++;
    public withEntityTracking = true;

    public readonly entityRegistry = new EntityRegistry();

    /**
     * Creates a new DatabaseQuery instance which can be used to query data.
     */
    public readonly query: ReturnType<this['adapter']['queryFactory']>['createQuery'];

    constructor(
        public readonly adapter: ADAPTER
    ) {
        const queryFactory = this.adapter.queryFactory(this);
        this.query = queryFactory.createQuery.bind(queryFactory);
    }

    // public async hydrateEntity<T>(item: T) {
    //     const classSchema = getClassSchema(getClassTypeFromInstance(item));
    //
    //     const dbItem = await (await this.connection.getCollection(classSchema.classType))
    //         .findOne(this.buildFindCriteria(classSchema.classType, item));
    //
    //     for (const property of classSchema.classProperties.values()) {
    //         if (property.isId) continue;
    //         if (property.isReference || property.backReference) continue;
    //
    //         //todo, what about its relations?
    //         // currently the entity item is not correctly instantiated, since access to relations result in an error.
    //
    //         Object.defineProperty(item, property.name, {
    //             enumerable: true,
    //             configurable: true,
    //             value: propertyMongoToClass(classSchema.classType, property.name, dbItem[property.name]),
    //         });
    //     }
    //
    //     markAsHydrated(item);
    // }

    /**
     * Adds or updates the item in the database.
     *
     * WARNING: This is an early stage implementation.
     * Modifying back-references are not detected. You have to persist the owning side of the reference separately.
     *
     *  - Populates primary key if necessary.
     *  - Persists references recursively if necessary.
     *  - Removes unlinked reference items from the database (when cascade is enabled).
     */
    // public async persist<T>(item: T): Promise<void> {
    //     if (this.disabledInstancePooling) {
    //         throw new Error(`DatabaseSession.persist is not possible with disabled instance pooling.`);
    //     }
    //
    //     const classSchema = getClassSchema(getClassTypeFromInstance(item));
    //     await this.ensureRelationsAreStored(classSchema, item);
    //
    //     const collection = await this.getCollection(classSchema.classType);
    //     const mongoItem = classToMongo(classSchema.classType, item);
    //
    //     //we can not use entityRegistry.isKnown as we allow
    //     //cross session entity item assignment.
    //     if (!isItemKnownInDatabase(item)) {
    //         await this.add(item);
    //         const result = await collection.insertOne(mongoItem);
    //
    //         if (result.insertedId) {
    //             if (classSchema.getPrimaryField().type === 'objectId' && result.insertedId && result.insertedId.toHexString) {
    //                 (<any>item)[classSchema.getPrimaryField().name] = result.insertedId.toHexString();
    //             }
    //         }
    //         this.entityRegistry.store(classSchema, item);
    //         return;
    //     }
    //
    //     this.update(item);
    //     const updateStatement: { [name: string]: any } = {};
    //     updateStatement['$set'] = mongoItem;
    //     const filterQuery = this.buildFindCriteria(classSchema.classType, item);
    //     await collection.updateOne(filterQuery, updateStatement);
    //
    //     markItemAsKnownInDatabase(classSchema, item);
    // }

    // protected async ensureRelationsAreStored<T>(classSchema: ClassSchema<T>, item: T) {
    //     //make sure all owning references are persisted as well
    //     for (const relation of classSchema.references) {
    //         if (relation.isReference) {
    //             if (item[relation.name]) {
    //                 if (relation.isArray) {
    //                     // (item[relation.name] as any[]).forEach(v => this.add(v));
    //                     //todo, implement that feature, and create a foreignKey as (primaryKey)[].
    //                     throw new Error('Owning reference as arrays are not possible.');
    //                 } else {
    //                     if (isHydrated(item[relation.name])) {
    //                         //no proxy instances will be saved.
    //                         await this.persist(item[relation.name]);
    //                     }
    //                 }
    //             } else if (!relation.isOptional) {
    //                 throw new Error(`Relation ${relation.name} in ${classSchema.getClassName()} is not set. If its optional, use @f.optional().`)
    //             }
    //         }
    //     }
    // }

    /**
     * Low level: add one item to the database.
     *  - Populates primary key if necessary.
     *  - DOES NOT add references automatically. You have to call on each new reference add() in order to save it.
     *  - DOES NOT update back-references.
     *  - No repository events are triggered.
     *
     * You should usually work with persist() instead, except if you know what you are doing.
     */
    public async add<T>(item: T): Promise<boolean> {

        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        await this.adapter.add(classSchema, item);

        markItemAsKnownInDatabase(classSchema, item);

        if (this.withEntityTracking) this.entityRegistry.store(classSchema, item);

        return true;
    }

    /**
     * Low level: updates one item in the database.
     *  - DOES NOT update referenced items. You have to call on each changed reference update() in order to save it.
     *  - DOES NOT update back-references when primary key changes.
     *  - No repository events are triggered.
     *
     * You should usually work with persist() instead, except if you know what you are doing.
     */
    public async update<T>(item: T): Promise<boolean> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        const pk = isItemKnownInDatabase(item) ? getLastKnownPKInDatabase(item) : classSchema.getPrimaryFieldRepresentation(item);

        await this.adapter.update(classSchema, pk, item);

        markItemAsKnownInDatabase(classSchema, item);

        if (this.withEntityTracking) {
            this.entityRegistry.store(classSchema, item);
        }

        return true;
    }

    /**
     * Low level: removes one item from the database that has the given id.
     *  - DOES NOT remove referenced items. You have to call on each reference delete() in order to remove it.
     *  - DOES NOT update back-references.
     *  - No repository events are triggered.
     *
     * You should usually work with persist() instead, except if you know what you are doing.
     */
    public async remove<T>(item: T): Promise<boolean> {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        const pk = isItemKnownInDatabase(item) ? getLastKnownPKInDatabase(item) : classSchema.getPrimaryFieldRepresentation(item);
        await this.adapter.remove(classSchema, pk);

        unmarkItemAsKnownInDatabase(item);

        if (this.withEntityTracking) {
            this.entityRegistry.delete(classSchema, classSchema.getPrimaryFieldRepresentation(item));
        }

        return true;
    }
}
