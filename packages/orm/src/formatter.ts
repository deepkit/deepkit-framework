/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, getGlobalStore, PropertySchema, Serializer, UnpopulatedCheck, unpopulatedSymbol } from '@deepkit/type';
import { DatabaseQueryModel } from './query';
import { ClassType } from '@deepkit/core';
import { getInstanceState, IdentityMap, PKHash } from './identity-map';
import { getPrimaryKeyHashGenerator } from './converter';
import { createReferenceClass, getReference } from './reference';

const sessionHydratorSymbol = Symbol('sessionHydratorSymbol');

export type HydratorFn = (item: any) => Promise<void>;

/**
 * Returns true if item is hydrated. Returns false when its a unpopulated proxy/reference.
 */
export function isHydrated(item: any) {
    return !!(item[sessionHydratorSymbol]);
}

export function setHydratedDatabaseSession(item: any, hydrator: HydratorFn) {
    Object.defineProperty(item, sessionHydratorSymbol, {
        enumerable: false,
        configurable: false,
        writable: true,
        value: hydrator,
    });
}

export function markAsHydrated(item: any) {
    item[sessionHydratorSymbol] = undefined;
}

export function getDatabaseSessionHydrator(item: any): HydratorFn {
    return item[sessionHydratorSymbol];
}

type DBRecord = { [name: string]: any };

/**
 * Every query resolving gets its own formatter.
 */
export class Formatter {
    //its important to have for each formatter own proxyClasses since we attached to Proxy's prototype the database session
    protected referenceClasses: Map<ClassSchema, ClassType> = new Map();

    protected instancePools: Map<ClassType, Map<PKHash, any>> = new Map();

    public withIdentityMap: boolean = true;
    protected rootSerializer = this.serializer.for(this.rootClassSchema);
    protected rootPkHash: (value: any) => string = getPrimaryKeyHashGenerator(this.rootClassSchema, this.serializer);

    constructor(
        protected rootClassSchema: ClassSchema,
        protected serializer: Serializer,
        protected hydrator?: HydratorFn,
        protected identityMap?: IdentityMap,
    ) {
    }

    protected getInstancePoolForClass(classType: ClassType): Map<PKHash, any> {
        if (!this.instancePools.has(classType)) {
            this.instancePools.set(classType, new Map());
        }

        return this.instancePools.get(classType)!;
    }

    public hydrate<T>(model: DatabaseQueryModel<T, any, any>, dbRecord: DBRecord): any {
        return this.hydrateModel(model, this.rootClassSchema, dbRecord);
    }

    protected makeInvalidReference(item: any, classSchema: ClassSchema, propertySchema: PropertySchema) {
        Object.defineProperty(item, propertySchema.name, {
            enumerable: false,
            configurable: false,
            get() {
                if (this.hasOwnProperty(propertySchema.symbol)) {
                    return this[propertySchema.symbol];
                }

                if (getGlobalStore().unpopulatedCheck === UnpopulatedCheck.Throw) {
                    throw new Error(`Reference ${classSchema.getClassName()}.${propertySchema.name} was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.`);
                }

                if (getGlobalStore().unpopulatedCheck === UnpopulatedCheck.ReturnSymbol) {
                    return unpopulatedSymbol;
                }
            },
            set(v: any) {
                Object.defineProperty(item, propertySchema.symbol, {
                    enumerable: false,
                    writable: true,
                    value: v
                });
            }
        });
    }

    protected getReferenceClass<T>(classSchema: ClassSchema<T>): ClassType<T> {
        let Reference = this.referenceClasses.get(classSchema);
        if (Reference) return Reference;

        Reference = createReferenceClass(classSchema);

        if (this.hydrator) {
            setHydratedDatabaseSession(Reference.prototype, this.hydrator);
        }

        this.referenceClasses.set(classSchema, Reference);
        return Reference;
    }

    protected getReference(
        classSchema: ClassSchema,
        dbRecord: DBRecord,
        propertySchema: PropertySchema,
        isPartial: boolean
    ): object | undefined | null {
        const fkName = propertySchema.getForeignKeyName();

        if (undefined === dbRecord[fkName] || null === dbRecord[fkName]) {
            if (propertySchema.isNullable) return null;
            return;
        }

        const foreignSchema = propertySchema.getResolvedClassSchema();
        const pool = this.getInstancePoolForClass(foreignSchema.classType);

        //note: foreign keys only support currently a single foreign key ...
        const foreignPrimaryFields = foreignSchema.getPrimaryFields();
        const foreignPrimaryKey = { [foreignPrimaryFields[0].name]: dbRecord[fkName] };
        const foreignPrimaryKeyAsClass = this.serializer.for(classSchema).partialDeserialize(foreignPrimaryKey);

        const ref = getReference(
            foreignSchema,
            foreignPrimaryKeyAsClass,
            isPartial ? undefined : this.identityMap,
            isPartial ? undefined : pool,
            this.getReferenceClass(foreignSchema)
        );

        getInstanceState(ref).markAsFromDatabase();

        return ref;
    }

    protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, dbRecord: DBRecord) {
        let pool: Map<PKHash, any> | undefined = undefined;
        let pkHash: any = undefined;
        if (this.rootClassSchema.references.size > 0) {
            //the pool is only necessary when the root class has actually references
            pkHash = classSchema === this.rootClassSchema ? this.rootPkHash(dbRecord) : getPrimaryKeyHashGenerator(classSchema, this.serializer)(dbRecord);
            pool = this.getInstancePoolForClass(classSchema.classType);

            if (pool.has(pkHash)) {
                return pool.get(pkHash);
            }
        }

        if (this.identityMap && !model.isPartial()) {
            if (!pkHash) {
                pkHash = classSchema === this.rootClassSchema ? this.rootPkHash(dbRecord) : getPrimaryKeyHashGenerator(classSchema, this.serializer)(dbRecord);
            }
            const item = this.identityMap.getByHash(classSchema, pkHash);

            if (item) {
                const fromDatabase = getInstanceState(item).isFromDatabase();

                //if its proxy a unhydrated proxy then we update property values
                if (fromDatabase && !isHydrated(item)) {
                    //we automatically hydrate proxy object once someone fetches them from the database.
                    //or we update a stale instance
                    const converted = this.serializer.for(classSchema).deserialize(dbRecord);

                    for (const propName of classSchema.propertyNames) {
                        if (propName === classSchema.idField) continue;

                        const prop = classSchema.getClassProperties().get(propName)!;
                        if (propName in item) continue;

                        if (prop.isReference || prop.backReference) {
                            if (prop.isArray) continue;

                            Object.defineProperty(item, propName, {
                                enumerable: true,
                                configurable: true,
                                value: this.getReference(classSchema, dbRecord, prop, model.isPartial()),
                            });
                            continue;
                        }

                        Object.defineProperty(item, propName, {
                            enumerable: true,
                            configurable: true,
                            value: converted[propName],
                        });
                    }

                    markAsHydrated(item);
                }

                if (fromDatabase) {
                    //check if we got new reference data we can apply to the instance
                    this.assignJoins(model, classSchema, dbRecord, item);
                }

                return item;
            }
        }

        const converted = this.createObject(model, classSchema, dbRecord);

        if (!model.isPartial()) {
            getInstanceState(converted).markAsPersisted();
            if (pool) pool.set(pkHash, converted);

            if (this.identityMap) {
                this.identityMap.store(classSchema, converted);
            }
        }

        return converted;
    }

    protected assignJoins(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, dbRecord: DBRecord, item: any): { [name: string]: true } {
        const handledRelation: { [name: string]: true } = {};

        for (const join of model.joins) {
            handledRelation[join.propertySchema.name] = true;
            const refName = join.as || join.propertySchema.name;

            //When the item is NOT from the database or property was overwritten, we don't overwrite it again.
            if (item.hasOwnProperty(join.propertySchema.symbol)) {
                continue;
            }

            if (join.populate) {
                const hasValue = dbRecord[refName] !== undefined && dbRecord[refName] !== null;
                if (join.propertySchema.backReference && join.propertySchema.isArray) {
                    if (hasValue) {
                        item[join.propertySchema.name] = dbRecord[refName].map((item: any) => {
                            return this.hydrateModel(join.query.model, join.propertySchema.getResolvedClassSchema(), item);
                        });
                    } else {
                        item[join.propertySchema.name] = [];
                    }
                } else if (hasValue) {
                    item[join.propertySchema.name] = this.hydrateModel(
                        join.query.model, join.propertySchema.getResolvedClassSchema(), dbRecord[refName]
                    );
                } else {
                    item[join.propertySchema.name] = undefined;
                }
            } else {
                //not populated
                if (join.propertySchema.isReference) {
                    const reference = this.getReference(classSchema, dbRecord, join.propertySchema, model.isPartial());
                    if (reference) item[join.propertySchema.name] = reference;
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!model.isPartial()) {
                        this.makeInvalidReference(item, classSchema, join.propertySchema);
                    }
                }
            }
        }

        return handledRelation;
    }

    protected createObject(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, dbRecord: DBRecord) {
        const partial = model.isPartial();

        const converted = classSchema === this.rootClassSchema
            ? (partial ? this.rootSerializer.partialDeserialize(dbRecord) : this.rootSerializer.deserialize(dbRecord))
            : (partial ? this.serializer.for(classSchema).partialDeserialize(dbRecord) : this.serializer.for(classSchema).deserialize(dbRecord));

        if (!model.isPartial()) {
            getInstanceState(converted).markAsFromDatabase();
        }

        if (classSchema.references.size > 0) {
            const handledRelation = model.joins.length ? this.assignJoins(model, classSchema, dbRecord, converted) : undefined;

            //all non-populated owning references will be just proxy references
            for (const propertySchema of classSchema.references.values()) {
                if (handledRelation && handledRelation[propertySchema.name]) continue;
                if (propertySchema.isReference) {
                    converted[propertySchema.name] = this.getReference(classSchema, dbRecord, propertySchema, model.isPartial());
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!model.isPartial()) {
                        this.makeInvalidReference(converted, classSchema, propertySchema);
                    }
                }
            }
        }

        return converted;
    }
}
