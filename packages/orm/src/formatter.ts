/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    ClassSchema,
    createReferenceClass,
    getGlobalStore,
    getPrimaryKeyHashGenerator,
    getReferenceInfo,
    isReferenceHydrated,
    markAsHydrated,
    PropertySchema,
    Serializer,
    UnpopulatedCheck,
    unpopulatedSymbol
} from '@deepkit/type';
import { DatabaseQueryModel } from './query';
import { capitalize, ClassType } from '@deepkit/core';
import { ClassState, getClassState, getInstanceState, IdentityMap, PKHash } from './identity-map';
import { getReference } from './reference';

export type HydratorFn = (item: any) => Promise<void>;

export function setHydratedDatabaseSession(item: any, hydrator: (item: any) => Promise<void>) {
    const info = getReferenceInfo(item);
    if (info) info.hydrator = hydrator;
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

    protected rootClassState: ClassState<any> = getClassState(this.rootClassSchema);

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
        const foreignSchema = propertySchema.getResolvedClassSchema();
        const pool = this.getInstancePoolForClass(foreignSchema.classType);

        const foreignPrimaryFields = foreignSchema.getPrimaryFields();
        const foreignPrimaryKey: { [name: string]: any } = {};

        let allFilled = foreignPrimaryFields.length;
        for (const property of foreignPrimaryFields) {
            const foreignKey = foreignPrimaryFields.length === 1 ? propertySchema.name : propertySchema.name + capitalize(property.name);
            if (property.isReference) {
                foreignPrimaryKey[property.name] = this.getReference(property.getResolvedClassSchema(), dbRecord, propertySchema, isPartial);
            } else {
                const v = this.serializer.deserializeProperty(property, dbRecord[foreignKey]);
                if (v === undefined || v === null) allFilled--;
                foreignPrimaryKey[property.name] = v;
            }
        }

        //empty reference
        if (allFilled === 0) return undefined;

        const ref = getReference(
            foreignSchema,
            foreignPrimaryKey,
            isPartial ? undefined : this.identityMap,
            isPartial ? undefined : pool,
            this.getReferenceClass(foreignSchema)
        );

        getInstanceState(getClassState(foreignSchema), ref).markAsFromDatabase();

        return ref;
    }

    protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, dbRecord: DBRecord) {
        let pool: Map<PKHash, any> | undefined = undefined;
        let pkHash: any = undefined;
        const partial = model.isPartial();
        const classState = classSchema === this.rootClassSchema ? this.rootClassState : getClassState(classSchema);

        const singleTableInheritanceMap = classSchema.getAssignedSingleTableInheritanceSubClassesByIdentifier();
        if (singleTableInheritanceMap) {
            const discriminant = classSchema.getSingleTableInheritanceDiscriminant();
            const subClassSchema = singleTableInheritanceMap[dbRecord[discriminant.name]];
            if (!subClassSchema) {
                throw new Error(`${classSchema.getClassName()} has no sub class with discriminator value ${JSON.stringify(dbRecord[discriminant.name])} for field ${discriminant.name}`);
            }
            classSchema = subClassSchema;
        }

        if (this.rootClassSchema.references.size > 0) {
            //the pool is only necessary when the root class has actually references
            pkHash = classSchema === this.rootClassSchema ? this.rootPkHash(dbRecord) : getPrimaryKeyHashGenerator(classSchema, this.serializer)(dbRecord);
            pool = this.getInstancePoolForClass(classSchema.classType);

            if (pool.has(pkHash)) {
                return pool.get(pkHash);
            }
        }

        if (this.identityMap && !partial) {
            if (!pkHash) {
                pkHash = classSchema === this.rootClassSchema ? this.rootPkHash(dbRecord) : getPrimaryKeyHashGenerator(classSchema, this.serializer)(dbRecord);
            }
            const item = this.identityMap.getByHash(classSchema, pkHash);

            if (item) {
                const fromDatabase = getInstanceState(classState, item).isFromDatabase();

                //if its proxy a unhydrated proxy then we update property values
                if (fromDatabase && !isReferenceHydrated(item)) {
                    //we automatically hydrate proxy object once someone fetches them from the database.
                    //or we update a stale instance
                    const converted = this.serializer.for(classSchema).deserialize(dbRecord);

                    for (const propName of classSchema.propertyNames) {
                        if (classSchema.getProperty(propName).isId) continue;

                        const prop = classSchema.getPropertiesMap().get(propName)!;
                        if (propName in item) continue;

                        if (prop.isReference || prop.backReference) {
                            if (prop.isArray) continue;

                            Object.defineProperty(item, propName, {
                                enumerable: true,
                                configurable: true,
                                value: this.getReference(classSchema, dbRecord, prop, partial),
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

        const converted = this.createObject(model, classState, classSchema, dbRecord);

        if (!partial) {
            getInstanceState(classState, converted).markAsPersisted();
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

    protected createObject(model: DatabaseQueryModel<any, any, any>, classState: ClassState, classSchema: ClassSchema, dbRecord: DBRecord) {
        const partial = model.isPartial();

        const converted = classSchema === this.rootClassSchema
            ? (partial ? this.rootSerializer.partialDeserialize(dbRecord) : this.rootSerializer.deserialize(dbRecord))
            : (partial ? this.serializer.for(classSchema).partialDeserialize(dbRecord) : this.serializer.for(classSchema).deserialize(dbRecord));

        if (!partial) {
            getInstanceState(classState, converted).markAsFromDatabase();
        }

        if (classSchema.references.size > 0) {
            const handledRelation = model.joins.length ? this.assignJoins(model, classSchema, dbRecord, converted) : undefined;

            //all non-populated owning references will be just proxy references
            for (const propertySchema of classSchema.references.values()) {
                if (model.select.size && !model.select.has(propertySchema.name)) continue;
                if (handledRelation && handledRelation[propertySchema.name]) continue;
                if (propertySchema.isReference) {
                    converted[propertySchema.name] = this.getReference(classSchema, dbRecord, propertySchema, partial);
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!partial) {
                        this.makeInvalidReference(converted, classSchema, propertySchema);
                    }
                }
            }
        }

        return converted;
    }
}
