import {ClassSchema, createXToClassFunction, getGlobalStore, jitPartial, PropertySchema} from "@super-hornet/marshal";
import {DatabaseQueryModel} from "./query";
import {ClassType} from "@super-hornet/core";
import {getInstanceState, IdentityMap, PKHash} from "./identity-map";
import {convertPrimaryKeyToClass} from "./utils";
import {getPrimaryKeyHashGenerator} from './converter';

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
    //its important to have for each formatter own proxyClasses since we attached to the prototype the database
    //session
    protected proxyClasses: Map<ClassType<any>, ClassType<any>> = new Map();

    protected instancePools: Map<ClassType<any>, Map<PKHash, any>> = new Map();

    public withIdentityMap: boolean = true;

    constructor(
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

    public hydrate<T>(classSchema: ClassSchema<T>, model: DatabaseQueryModel<T, any, any>, value: any): any {
        return this.hydrateModel(model, classSchema, value);
    }

    protected makeInvalidReference(item: any, propertySchema: PropertySchema) {
        Object.defineProperty(item, propertySchema.name, {
            enumerable: false,
            configurable: false,
            get() {
                if (this.hasOwnProperty(propertySchema.symbol)) {
                    return this[propertySchema.symbol];
                }

                if (getGlobalStore().unpopulatedCheckActive) {
                    throw new Error(`Reference ${propertySchema.name} was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.`);
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

    protected getProxyClass<T>(classSchema: ClassSchema<T>): ClassType<T> {
        if (!this.proxyClasses.has(classSchema.classType)) {
            const type = classSchema.classType as any;

            //note: this is necessary to give the anonymous class the same name when using toString().
            const temp: any = {};
            temp.Proxy = class extends type {
            };
            const Proxy = temp.Proxy;

            if (this.hydrator) {
                setHydratedDatabaseSession(Proxy.prototype, this.hydrator);
            }

            for (const property of classSchema.getClassProperties().values()) {
                if (property.isId) continue;

                const message = property.isReference || property.backReference ?
                    `Reference ${classSchema.getClassName()}.${property.name} was not loaded. Use joinWith(), useJoinWith(), etc to populate the reference.`
                    :
                    `Can not access '${property.name}' since class ${classSchema.getClassName()} was not completely hydrated. Use 'await hydrate(item)' to completely load it.`;

                Object.defineProperty(Proxy.prototype, property.name, {
                    enumerable: false,
                    configurable: true,
                    get() {
                        if (this.hasOwnProperty(property.symbol)) {
                            return this[property.symbol];
                        }

                        if (getGlobalStore().unpopulatedCheckActive) {
                            throw new Error(message);
                        }
                    },
                    set(v) {
                        if (!getGlobalStore().unpopulatedCheckActive) {
                            //when this check is off, this item is being constructed
                            //so we ignore initial set operations
                            return;
                        }

                        // when we set value, we just accept it and treat all
                        // properties accessors that don't throw the Error above as "updated"
                        Object.defineProperty(this, property.symbol, {
                            enumerable: false,
                            writable: true,
                            value: v
                        });
                    }
                });
            }
            this.proxyClasses.set(classSchema.classType, Proxy);
        }

        return this.proxyClasses.get(classSchema.classType)!;
    }

    protected getReference(
        classSchema: ClassSchema,
        dbItem: any,
        propertySchema: PropertySchema,
        isPartial: boolean
    ): object | undefined {
        const fkName = propertySchema.getForeignKeyName();

        if (undefined === dbItem[fkName] || null === dbItem[fkName]) {
            return;
        }

        const foreignSchema = propertySchema.getResolvedClassSchema();
        const foreignPrimaryFields = foreignSchema.getPrimaryFields();
        //note: foreign keys only support currently a single foreign key ...
        const foreignPrimaryKey = {[foreignPrimaryFields[0].name]: dbItem[fkName]};

        const pkHash = getPrimaryKeyHashGenerator(foreignSchema)(foreignPrimaryKey);

        const pool = this.getInstancePoolForClass(foreignSchema.classType);

        if (!isPartial) {
            if (this.identityMap) {
                const item = this.identityMap.getByHash(foreignSchema, pkHash);
                if (item) {
                    return item;
                }
            }
            if (pool.has(pkHash)) {
                return pool.get(pkHash);
            }
        }

        const args: any[] = [];
        const foreignPrimaryKeyAsClass = convertPrimaryKeyToClass(classSchema, this.serializerSourceName, foreignPrimaryKey);

        for (const prop of foreignSchema.getMethodProperties('constructor')) {
            args.push(foreignPrimaryKeyAsClass[prop.name]);
        }

        getGlobalStore().unpopulatedCheckActive = false;
        const ref = new (this.getProxyClass(foreignSchema))(...args);
        Object.assign(ref, foreignPrimaryKeyAsClass);

        getGlobalStore().unpopulatedCheckActive = true;
        getInstanceState(ref).markAsFromDatabase();

        if (!isPartial) {
            pool.set(pkHash, ref);
            if (this.identityMap) this.identityMap.store(foreignSchema, ref);
        }

        return ref;
    }

    protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, value: any) {
        const pkHash = getPrimaryKeyHashGenerator(classSchema, this.serializerSourceName)(value);
        const pool = this.getInstancePoolForClass(classSchema.classType);

        if (pool.has(pkHash)) {
            return pool.get(pkHash);
        }

        if (this.identityMap && !model.isPartial()) {
            const item = this.identityMap.getByHash(classSchema, pkHash);

            if (item) {
                const fromDatabase = getInstanceState(item).isFromDatabase();

                //if its proxy a unhydrated proxy then we update property values
                if (fromDatabase && !isHydrated(item)) {
                    //we automatically hydrate proxy object once someone fetches them from the database.
                    //or we update a stale instance
                    const converted = createXToClassFunction(classSchema, this.serializerSourceName)(value)

                    for (const propName of classSchema.propertyNames) {
                        if (propName === classSchema.idField) continue;

                        const prop = classSchema.getClassProperties().get(propName)!;
                        if (prop.isReference || prop.backReference) continue;

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

                            //todo: if current value is partial, we could

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
        const converted = model.isPartial() ?
            jitPartial(this.serializerSourceName, 'class', classSchema.classType, value) :
            createXToClassFunction(classSchema, this.serializerSourceName)(value);

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
                        this.makeInvalidReference(converted, join.propertySchema);
                    }
                }
            }
        }

        //all non-populated owning references will be just proxy references
        for (const propertySchema of classSchema.references.values()) {
            if (handledRelation[propertySchema.name]) continue;
            if (propertySchema.isReference) {
                const reference = this.getReference(classSchema, value, propertySchema, model.isPartial());
                if (reference) converted[propertySchema.name] = reference;
            } else {
                //unpopulated backReferences are inaccessible
                if (!model.isPartial()) {
                    this.makeInvalidReference(converted, propertySchema);
                }
            }
        }

        return converted;
    }
}
