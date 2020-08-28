import {ClassSchema, getXToClassFunction, getGlobalStore, jitPartial, PropertySchema, JitConverterOptions, ToClassState, createPartialXToXFunction} from '@super-hornet/marshal';
import {DatabaseQueryModel} from './query';
import {ClassType} from '@super-hornet/core';
import {getInstanceState, IdentityMap, PKHash} from './identity-map';
import {convertPrimaryKeyToClass} from './utils';
import {getPrimaryKeyHashGenerator} from './converter';
import {createReferenceClass, getReference} from './reference';

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

/**
 * Every query resolving gets its own formatter.
 */
export class Formatter {
    //its important to have for each formatter own proxyClasses since we attached to Proxy's prototype the database session
    protected referenceClasses: Map<ClassSchema, ClassType<any>> = new Map();

    protected instancePools: Map<ClassType<any>, Map<PKHash, any>> = new Map();

    public withIdentityMap: boolean = true;
    protected rootToClass: (data: any) => any = getXToClassFunction(this.rootClassSchema, this.serializerSourceName);
    protected rootPartialToClass: (data: any) => any = createPartialXToXFunction(this.rootClassSchema, this.serializerSourceName, 'class');
    protected rootPkHash: (value: any) => string = getPrimaryKeyHashGenerator(this.rootClassSchema, this.serializerSourceName);

    constructor(
        protected rootClassSchema: ClassSchema,
        protected serializerSourceName: string,
        protected hydrator?: HydratorFn,
        protected identityMap?: IdentityMap,
    ) {
    }

    protected getInstancePoolForClass(classType: ClassType<any>): Map<PKHash, any> {
        if (!this.instancePools.has(classType)) {
            this.instancePools.set(classType, new Map());
        }

        return this.instancePools.get(classType)!;
    }

    public hydrate<T>(model: DatabaseQueryModel<T, any, any>, value: any): any {
        return this.hydrateModel(model, this.rootClassSchema, value);
    }

    protected makeInvalidReference(item: any, classSchema: ClassSchema, propertySchema: PropertySchema) {
        Object.defineProperty(item, propertySchema.name, {
            enumerable: false,
            configurable: false,
            get() {
                if (this.hasOwnProperty(propertySchema.symbol)) {
                    return this[propertySchema.symbol];
                }

                if (getGlobalStore().unpopulatedCheckActive) {
                    throw new Error(`Reference ${classSchema.getClassName()}.${propertySchema.name} was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.`);
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
        dbItem: any,
        propertySchema: PropertySchema,
        isPartial: boolean
    ): object | undefined | null {
        const fkName = propertySchema.getForeignKeyName();

        if (undefined === dbItem[fkName] || null === dbItem[fkName]) {
            if (propertySchema.isNullable) return null;
            return;
        }

        const foreignSchema = propertySchema.getResolvedClassSchema();
        const pool = this.getInstancePoolForClass(foreignSchema.classType);

        //note: foreign keys only support currently a single foreign key ...
        const foreignPrimaryFields = foreignSchema.getPrimaryFields();
        const foreignPrimaryKey = {[foreignPrimaryFields[0].name]: dbItem[fkName]};
        const foreignPrimaryKeyAsClass = convertPrimaryKeyToClass(classSchema, this.serializerSourceName, foreignPrimaryKey);

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

    protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, value: any) {
        const pkHash = getPrimaryKeyHashGenerator(classSchema, this.serializerSourceName)(value);
        const pool = this.getInstancePoolForClass(classSchema.classType);

        if (pool.has(pkHash)) {
            return pool.get(pkHash);
        }

        if (this.identityMap && !model.isPartial()) {
            const pkHash = classSchema === this.rootClassSchema ? this.rootPkHash(value) : getPrimaryKeyHashGenerator(classSchema, this.serializerSourceName)(value);
            const item = this.identityMap.getByHash(classSchema, pkHash);

            if (item) {
                const fromDatabase = getInstanceState(item).isFromDatabase();

                //if its proxy a unhydrated proxy then we update property values
                if (fromDatabase && !isHydrated(item)) {
                    //we automatically hydrate proxy object once someone fetches them from the database.
                    //or we update a stale instance
                    const converted = getXToClassFunction(classSchema, this.serializerSourceName)(value);

                    for (const propName of classSchema.propertyNames) {
                        if (propName === classSchema.idField) continue;

                        const prop = classSchema.getClassProperties().get(propName)!;
                        if (prop.isReference || prop.backReference) {
                            //todo: assign Reference
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
                    for (const join of model.joins) {
                        if (join.populate) {
                            const refName = join.as || join.propertySchema.name;

                            //When the item is NOT from the database or property was overwritten, we don't overwrite it again.
                            if (item.hasOwnProperty(join.propertySchema.symbol)) {
                                continue;
                            }

                            if (value[refName] !== undefined && value[refName] !== null) {
                                let joinValue: any;

                                if (join.propertySchema.isArray) {
                                    joinValue = value[refName].map((item: any) => {
                                        return this.hydrateModel(join.query.model, join.propertySchema.getResolvedClassSchema(), item);
                                    });
                                } else {
                                    joinValue = this.hydrateModel(join.query.model, join.propertySchema.getResolvedClassSchema(), value[refName]);
                                }

                                item[join.propertySchema.symbol] = joinValue;
                            }
                        }
                    }
                }

                return item;
            }
        }

        const converted = this.createObject(model, classSchema, value);

        if (!model.isPartial()) {
            getInstanceState(converted).markAsPersisted();
            pool.set(pkHash, converted);

            if (this.identityMap) {
                this.identityMap.store(classSchema, converted);
            }
        }

        return converted;
    }

    protected createObject(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, value: any) {
        const converted = classSchema === this.rootClassSchema ?
            (model.isPartial() ? this.rootPartialToClass(value) : this.rootToClass(value))
            :
            (model.isPartial() ?
                jitPartial(classSchema, this.serializerSourceName, 'class', value) :
                getXToClassFunction(classSchema, this.serializerSourceName)(value));

        if (!model.isPartial()) {
            getInstanceState(converted).markAsFromDatabase();
        }

        const handledRelation: { [name: string]: true } = {};

        for (const join of model.joins) {
            handledRelation[join.propertySchema.name] = true;
            const refName = join.as || join.propertySchema.name;

            if (join.populate) {
                const hasValue = value[refName] !== undefined && value[refName] !== null;
                if (join.propertySchema.backReference && join.propertySchema.isArray) {
                    if (hasValue) {
                        converted[join.propertySchema.name] = value[refName].map((item: any) => {
                            return this.hydrateModel(join.query.model, join.propertySchema.getResolvedClassSchema(), item);
                        });
                    } else {
                        converted[join.propertySchema.name] = [];
                    }
                } else if (hasValue) {
                    converted[join.propertySchema.name] = this.hydrateModel(
                        join.query.model, join.propertySchema.getResolvedClassSchema(), value[refName]
                    );
                } else {
                    converted[join.propertySchema.name] = undefined;
                }
            } else {
                //not populated
                if (join.propertySchema.isReference) {
                    const reference = this.getReference(classSchema, value, join.propertySchema, model.isPartial());
                    if (reference) converted[join.propertySchema.name] = reference;
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!model.isPartial()) {
                        this.makeInvalidReference(converted, classSchema, join.propertySchema);
                    }
                }
            }
        }

        //all non-populated owning references will be just proxy references
        for (const propertySchema of classSchema.references.values()) {
            if (handledRelation[propertySchema.name]) continue;
            if (propertySchema.isReference) {
                converted[propertySchema.name] = this.getReference(classSchema, value, propertySchema, model.isPartial());
            } else {
                //unpopulated backReferences are inaccessible
                if (!model.isPartial()) {
                    this.makeInvalidReference(converted, classSchema, propertySchema);
                }
            }
        }

        return converted;
    }
}
