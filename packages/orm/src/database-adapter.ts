/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { OrmEntity } from './type';
import { AbstractClassType, arrayRemoveItem, ClassType, getClassName, getClassTypeFromInstance, isClass, stringifyValueWithType } from '@deepkit/core';
import { is, isSameType, ItemChanges, PrimaryKeyFields, ReceiveType, ReflectionClass, ReflectionKind, stringifyType, Type } from '@deepkit/type';
import { Query } from './query';
import { DatabaseSession, DatabaseTransaction } from './database-session';

export abstract class DatabaseAdapterQueryFactory {
    abstract createQuery<T extends OrmEntity>(type?: ReceiveType<T> | AbstractClassType<T> | ReflectionClass<T>): Query<T>;
}

export interface DatabasePersistenceChangeSet<T> {
    changes: ItemChanges<T>;
    item: T;
    primaryKey: PrimaryKeyFields<T>;
}

export abstract class DatabasePersistence {
    abstract remove<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void>;

    abstract insert<T extends OrmEntity>(classSchema: ReflectionClass<T>, items: T[]): Promise<void>;

    abstract update<T extends OrmEntity>(classSchema: ReflectionClass<T>, changeSets: DatabasePersistenceChangeSet<T>[]): Promise<void>;

    /**
     * When DatabasePersistence instance is not used anymore, this function will be called.
     * Good place to release a connection for example.
     */
    abstract release(): void;
}

export class RawFactory<A extends Array<any>> {
    create(...args: A): any {
        throw new Error(`Current database adapter does not support raw mode.`);
    }
}

/**
 * A generic database adapter you can use if the API of `Query` is sufficient.
 *
 * You can specify a more specialized adapter like MysqlDatabaseAdapter/MongoDatabaseAdapter with special API for MySQL/Mongo.
 */
export abstract class DatabaseAdapter {
    abstract queryFactory(session: DatabaseSession<this>): DatabaseAdapterQueryFactory;

    rawFactory(session: DatabaseSession<this>): RawFactory<any> {
        return new RawFactory();
    };

    abstract createPersistence(session: DatabaseSession<this>): DatabasePersistence;

    abstract createTransaction(session: DatabaseSession<this>): DatabaseTransaction;

    abstract disconnect(force?: boolean): void;

    abstract migrate(entityRegistry: DatabaseEntityRegistry): Promise<void>;

    abstract getName(): string;

    abstract getSchemaName(): string;

    abstract isNativeForeignKeyConstraintSupported(): boolean;
}

/**
 * This is a container knowing what entities are registered. It is able to register and resolve based on Type | ReflectionClass | ClassType.
 *
 * This container is necessary since TypeScript interfaces have no identity (TypeObjectLiteral) and property types are not equal by identity.
 * This means there can be multiple ReflectionClass describing the same structure/type.
 * We need to do type comparison to get always the correct (registered) ReflectionClass.
 */
export class DatabaseEntityRegistry {
    public readonly entities: ReflectionClass<any>[] = [];

    static from(items: (Type | ReflectionClass<any> | ClassType)[]) {
        const e = new DatabaseEntityRegistry();
        e.add(...items);
        return e;
    }

    add(...types: (Type | ReflectionClass<any> | ClassType)[]): void {
        for (const type of types) {
            const reflection = ReflectionClass.from(type);

            if (this.entities.indexOf(reflection) === -1) this.entities.push(reflection);
        }
    }

    remove(type: Type | ReflectionClass<any> | ClassType): void {
        const reflection = ReflectionClass.from(type);

        arrayRemoveItem(this.entities, reflection);
    }

    getFromInstance<T>(item: T): ReflectionClass<any> {
        if ((item as any).constructor === Object) {
            //search using type guards
            for (const entity of this.entities) {
                if (is(item, undefined, undefined, entity.type)) return entity;
            }

        } else {
            //its a regular class
            return ReflectionClass.from(getClassTypeFromInstance(item));
        }

        throw new Error(`No entity for item ${stringifyValueWithType(item)} registered.`);
    }

    get(type: Type | ReflectionClass<any> | ClassType): ReflectionClass<any> {
        if (isClass(type)) {
            for (const entity of this.entities) {
                if (entity.type.kind === ReflectionKind.class && entity.type.classType === type) return entity;
            }
            throw new Error(`No entity for ${getClassName(type)} registered`);
        }

        type = type instanceof ReflectionClass ? type.type : type;
        if (type.kind !== ReflectionKind.class && type.kind !== ReflectionKind.objectLiteral) throw new Error(`Only TypeClass|TypeObjectLiteral expected`);

        for (const entity of this.entities) {
            if (entity.type === type) return entity;
            if (type.kind === ReflectionKind.class && entity.type.kind === ReflectionKind.class) {
                if (type.classType === entity.type.classType) {
                    //if both don't use generic, return directly
                    if (!type.typeArguments && !entity.type.typeArguments) return entity;

                    //check if generic type is compatible
                    //we could cache the result for faster lookups
                    if (isSameType(type, entity.type)) return entity;
                }
            }
            if (type.kind === ReflectionKind.objectLiteral && entity.type.kind === ReflectionKind.objectLiteral) {
                //check if type is compatible
                if (type.types.length === entity.type.types.length) {
                    //we could cache the result for faster lookups
                    if (isSameType(type, entity.type)) return entity;
                }
            }
        }
        throw new Error(`No entity for ${stringifyType(type)} registered`);
    }
}
