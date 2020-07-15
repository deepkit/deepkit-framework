import {
    ClassSchema,
    createXToClassFunction,
    getGlobalStore, jitPartial,
    jitPartialClassToPlain,
    PropertySchema
} from "@super-hornet/marshal";
import {DatabaseQueryModel} from "./query";
import {ClassType} from "@super-hornet/core";
import {DatabaseSession} from "./database-session";
import {getInstanceState, PKHash} from "./identity-map";
import {convertPrimaryKeyToClass} from "./utils";

const proxyDatabaseSessionSymbol = Symbol('proxyDatabaseSessionSymbol');

/**
 * Returns true if item is hydrated. Returns false when its a unpopulated proxy/reference.
 */
export function isHydrated(item: any) {
    return !!(item[proxyDatabaseSessionSymbol]);
}

export function setHydratedDatabaseSession(item: any, databaseSession: DatabaseSession<any>) {
    Object.defineProperty(item, proxyDatabaseSessionSymbol, {
        enumerable: false,
        configurable: false,
        writable: true,
        value: databaseSession,
    });
}

export function markAsHydrated(item: any) {
    item[proxyDatabaseSessionSymbol] = undefined;
}

export function getHydratedDatabaseSession(item: any): DatabaseSession<any> {
    return item[proxyDatabaseSessionSymbol];
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
        protected session: DatabaseSession<any>,
        protected serializerSourceName: string,
    ) {
    }

    protected getInstancePoolForClass(classType: ClassType<any>): Map<PKHash, any> {
        if (!this.instancePools.has(classType)) {
            this.instancePools.set(classType, new Map());
        }

        return this.instancePools.get(classType)!;
    }

    public hydrate<T>(classSchema: ClassSchema<T>, model: DatabaseQueryModel<T, any, any>, value: any): any {
        this.withIdentityMap = model.withIdentityMap && !model.isPartial();
        return this.hydrateModel(model, classSchema, value);
    }

    protected isWithIdentityMap() {
        return this.session.withIdentityMap && this.withIdentityMap;
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

            setHydratedDatabaseSession(Proxy.prototype, this.session);

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
                        if (getGlobalStore().unpopulatedCheckActive) {
                            throw new Error(message);
                        }
                    },
                    set() {
                        if (getGlobalStore().unpopulatedCheckActive) {
                            throw new Error(message);
                        }
                    }
                });
            }
            this.proxyClasses.set(classSchema.classType, Proxy);
        }

        return this.proxyClasses.get(classSchema.classType)!;
    }

    protected setProxyClassOfReference(
        classSchema: ClassSchema,
        converted: any,
        dbItem: any,
        propertySchema: PropertySchema,
        isPartial: boolean
    ): void {
        if (undefined === dbItem[propertySchema.getForeignKeyName()]) {
            if (propertySchema.isOptional) return;
            throw new Error(`Foreign key for ${propertySchema.name} is not projected.`);
        }

        const foreignSchema = propertySchema.getResolvedClassSchema();
        const fkName = propertySchema.getForeignKeyName();

        if (undefined === dbItem[fkName] || null === dbItem[fkName]) {
            //nothing to do when we got no item.
            return;
        }

        const foreignPrimaryFields = foreignSchema.getPrimaryFields();
        //note: foreign keys only support currently a single foreign key ...
        const foreignPrimaryKey = {[foreignPrimaryFields[0].name]: dbItem[fkName]};

        const pkHash = classSchema.getPrimaryFieldHash(foreignPrimaryKey, this.serializerSourceName);

        const pool = this.getInstancePoolForClass(foreignSchema.classType);

        if (!isPartial) {
            if (this.isWithIdentityMap()) {
                const item = this.session.identityMap.getByHash(foreignSchema, pkHash);
                if (item) {
                    converted[propertySchema.name] = item;
                    return;
                }
            }
            if (pool.has(pkHash)) {
                converted[propertySchema.name] = pool.get(pkHash);
                return;
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

        converted[propertySchema.name] = ref;
        getGlobalStore().unpopulatedCheckActive = true;
        getInstanceState(ref).markAsFromDatabase();

        if (!isPartial) {
            pool.set(pkHash, ref);
            if (this.isWithIdentityMap()) this.session.identityMap.store(foreignSchema, ref);
        }
    }

    protected hydrateModel(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, value: any) {
        const pkHash = classSchema.getPrimaryFieldHash(value, this.serializerSourceName);
        const pool = this.getInstancePoolForClass(classSchema.classType);

        if (pool.has(pkHash)) {
            return pool.get(pkHash);
        }

        if (this.isWithIdentityMap() && !model.isPartial()) {
            const item = this.session.identityMap.getByHash(classSchema, pkHash);

            if (item) {
                const fromDatabase = getInstanceState(item).isFromDatabase();

                //if its proxy a unhydrated proxy then we update property values
                if (fromDatabase && !isHydrated(item)) {
                    //we automatically hydrate proxy object once someone fetches them from the database.
                    //or we update a stale instance
                    const converted = createXToClassFunction(classSchema.classType, this.serializerSourceName)(value)

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

            if (this.isWithIdentityMap()) {
                this.session.identityMap.store(classSchema, converted);
            }
        }

        return converted;
    }

    protected createObject(model: DatabaseQueryModel<any, any, any>, classSchema: ClassSchema, value: any) {
        const converted = model.isPartial() ?
            jitPartial(this.serializerSourceName, 'class', classSchema.classType, value) :
            createXToClassFunction(classSchema.classType, this.serializerSourceName)(value);

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
                    this.setProxyClassOfReference(classSchema, converted, value, join.propertySchema, model.isPartial());
                } else {
                    //unpopulated backReferences are inaccessible
                    if (!model.isPartial()) {
                        this.makeInvalidReference(converted, join.propertySchema);
                    }
                }
            }
        }

        //all non-populated relations will be
        for (const propertySchema of classSchema.references.values()) {
            if (handledRelation[propertySchema.name]) continue;
            if (propertySchema.isReference) {
                this.setProxyClassOfReference(classSchema, converted, value, propertySchema, model.isPartial());
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
