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
    createReferenceClass,
    deserialize,
    getPartialSerializeFunction,
    getPrimaryKeyHashGenerator,
    getReferenceInfo,
    getSerializeFunction,
    isReferenceHydrated,
    isReferenceInstance,
    markAsHydrated,
    ReflectionClass,
    ReflectionProperty,
    resolveForeignReflectionClass,
    SerializeFunction,
    Serializer,
    typeSettings,
    UnpopulatedCheck,
    unpopulatedSymbol
} from '@deepkit/type';
import { DatabaseQueryModel } from './query.js';
import { capitalize, ClassType } from '@deepkit/core';
import { ClassState, getClassState, getInstanceState, IdentityMap, PKHash } from './identity-map.js';
import { getReference } from './reference.js';

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
    protected referenceClasses: Map<ReflectionClass<any>, ClassType> = new Map();

    protected instancePools: Map<ClassType, Map<PKHash, any>> = new Map();

    public withIdentityMap: boolean = true;
    protected rootPkHash: (value: any) => string = getPrimaryKeyHashGenerator(this.rootClassSchema, this.serializer);

    protected deserialize: SerializeFunction;
    protected partialDeserialize: SerializeFunction;

    protected rootClassState: ClassState = getClassState(this.rootClassSchema);

    constructor(
        protected rootClassSchema: ReflectionClass<any>,
        protected serializer: Serializer,
        protected hydrator?: HydratorFn,
        protected identityMap?: IdentityMap,
    ) {
        this.deserialize = getSerializeFunction(rootClassSchema.type, serializer.deserializeRegistry);
        this.partialDeserialize = getPartialSerializeFunction(rootClassSchema.type, serializer.deserializeRegistry);
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

    protected makeInvalidReference(item: any, classSchema: ReflectionClass<any>, propertySchema: ReflectionProperty) {
        Object.defineProperty(item, propertySchema.name, {
            enumerable: true,
            configurable: false,
            get() {
                if (this.hasOwnProperty(propertySchema.symbol)) {
                    return this[propertySchema.symbol];
                }

                if (typeSettings.unpopulatedCheck === UnpopulatedCheck.Throw) {
                    throw new Error(`Reference ${classSchema.getClassName()}.${propertySchema.name} was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.`);
                }

                if (typeSettings.unpopulatedCheck === UnpopulatedCheck.ReturnSymbol) {
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

    protected getReferenceClass<T>(classSchema: ReflectionClass<T>): ClassType<T> {
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
        classSchema: ReflectionClass<any>,
        dbRecord: DBRecord,
        propertySchema: ReflectionProperty,
        isPartial: boolean
    ): object | undefined | null {
        const foreignSchema = propertySchema.getResolvedReflectionClass();
        const pool = this.getInstancePoolForClass(foreignSchema.getClassType());

        let foreignPrimaryKey: { [name: string]: any } = {};

        if (isReferenceInstance(dbRecord[propertySchema.name])) {
            //reference instances have already all primary keys
            foreignPrimaryKey = dbRecord[propertySchema.name];
        } else {
            const foreignPrimaryFields = foreignSchema.getPrimaries();
            let allFilled = foreignPrimaryFields.length;
            for (const property of foreignPrimaryFields) {
                const foreignKey = foreignPrimaryFields.length === 1 ? propertySchema.name : propertySchema.name + capitalize(property.name);
                if (property.isReference()) {
                    foreignPrimaryKey[property.name] = this.getReference(property.getResolvedReflectionClass(), dbRecord, propertySchema, isPartial);
                } else {
                    if (dbRecord[foreignKey] === undefined || dbRecord[foreignKey] === null) {
                        allFilled--;
                    } else {
                        const v = deserialize(dbRecord[foreignKey], undefined, this.serializer, undefined, property.type);
                        if (v === undefined || v === null) allFilled--;
                        foreignPrimaryKey[property.name] = v;
                    }
                }
            }

            //empty reference
            if (allFilled === 0) return undefined;
        }

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

    protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ReflectionClass<any>, dbRecord: DBRecord) {
        let pool: Map<PKHash, any> | undefined = undefined;
        let pkHash: any = undefined;
        const partial = model.isPartial();
        const classState = classSchema === this.rootClassSchema ? this.rootClassState : getClassState(classSchema);

        const singleTableInheritanceMap = classSchema.getAssignedSingleTableInheritanceSubClassesByIdentifier();
        if (singleTableInheritanceMap) {
            const discriminant = classSchema.getSingleTableInheritanceDiscriminantName();
            const subClassSchema = singleTableInheritanceMap[dbRecord[discriminant]];
            if (!subClassSchema) {
                const availableValues = Array.from(Object.keys(singleTableInheritanceMap));
                throw new Error(
                    `${classSchema.getClassName()} has no sub class with discriminator value ${JSON.stringify(dbRecord[discriminant])} for field ${discriminant}.` +
                    `Available discriminator values ${availableValues.map(v => JSON.stringify(v)).join(',')}`
                );
            }
            classSchema = subClassSchema;
        }

        if (this.rootClassSchema.getReferences().length > 0) {
            //the pool is only necessary when the root class has actually references
            pkHash = classSchema === this.rootClassSchema ? this.rootPkHash(dbRecord) : getPrimaryKeyHashGenerator(classSchema, this.serializer)(dbRecord);
            pool = this.getInstancePoolForClass(classSchema.getClassType());

            const found = pool.get(pkHash);
            //When in a record is a reference found, it will be put into the pool.
            //If a subsequent record has the same PK as that reference, it would return that
            //reference instead of the full record - which is wrong. This makes sure
            //that references are excluded from the pool. However, that also breaks for
            //references the identity. We could improve that with a more complex resolution algorithm,
            //that involves changing already populated objects.
            if (found && !isReferenceInstance(found)) {
                return found;
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
                    const converted: any = deserialize(dbRecord, undefined, this.serializer, undefined, classSchema.type);

                    for (const propName of classSchema.getPropertyNames()) {
                        const property = classSchema.getProperty(propName);
                        if (property.isPrimaryKey()) continue;

                        if (propName in item) continue;

                        if (property.isReference() || property.isBackReference()) {
                            if (property.isArray()) continue;

                            Object.defineProperty(item, propName, {
                                enumerable: true,
                                configurable: true,
                                value: this.getReference(classSchema, dbRecord, property, partial),
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
            if (model.withChangeDetection) getInstanceState(classState, converted).markAsPersisted();
            if (pool) pool.set(pkHash, converted);
            if (this.identityMap) this.identityMap.store(classSchema, converted);
        }

        return converted;
    }

    protected assignJoins(model: DatabaseQueryModel<any, any, any>, classSchema: ReflectionClass<any>, dbRecord: DBRecord, item: any): { [name: string]: true } {
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
                if (join.propertySchema.isBackReference() && join.propertySchema.isArray()) {
                    if (hasValue) {
                        item[join.propertySchema.name] = dbRecord[refName].map((item: any) => {
                            return this.hydrateModel(join.query.model, resolveForeignReflectionClass(join.propertySchema), item);
                        });
                    } else {
                        item[join.propertySchema.name] = [];
                    }
                } else if (hasValue) {
                    item[join.propertySchema.name] = this.hydrateModel(
                        join.query.model, resolveForeignReflectionClass(join.propertySchema), dbRecord[refName]
                    );
                } else {
                    item[join.propertySchema.name] = undefined;
                }
            } else {
                //not populated
                if (join.propertySchema.isReference()) {
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

    protected createObject(model: DatabaseQueryModel<any, any, any>, classState: ClassState, classSchema: ReflectionClass<any>, dbRecord: DBRecord) {
        const partial = model.isPartial();

        const converted = classSchema === this.rootClassSchema
            ? (partial ? this.partialDeserialize(dbRecord) : this.deserialize(dbRecord))
            : (partial ? getPartialSerializeFunction(classSchema.type, this.serializer.deserializeRegistry)(dbRecord) : getSerializeFunction(classSchema.type, this.serializer.deserializeRegistry)(dbRecord));

        if (!partial) {
            if (model.withChangeDetection) getInstanceState(classState, converted).markAsFromDatabase();
        }

        if (classSchema.getReferences().length > 0) {
            const handledRelation = model.joins.length ? this.assignJoins(model, classSchema, dbRecord, converted) : undefined;

            //all non-populated owning references will be just proxy references
            for (const property of classSchema.getReferences()) {
                if (model.select.size && !model.select.has(property.name)) continue;
                if (handledRelation && handledRelation[property.name]) continue;
                if (property.isReference()) {
                    converted[property.name] = this.getReference(classSchema, dbRecord, property, partial);
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!partial) {
                        this.makeInvalidReference(converted, classSchema, property);
                    }
                }
            }
        }

        return converted;
    }
}
