/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { QueryDatabaseDeleteEvent, QueryDatabasePatchEvent, UnitOfWorkEvent, UnitOfWorkUpdateEvent } from './event';
import { ClassSchema, PropertySchema } from '@deepkit/type';
import { Database } from './database';

type IncomingReference = { classSchema: ClassSchema, property: PropertySchema };

/**
 * For database adapter that are not capable of having foreign key constraints
 * this provides a virtual implementation that covers most of the same functionality.
 */
export class VirtualForeignKeyConstraint {
    constructor(protected database: Database) {
    }

    protected resolveReferencesTo(fromClassSchema: ClassSchema): IncomingReference[] {
        //note: not all relations have a backReference defined, so we need to go through all registered class schemas
        const references = fromClassSchema.jit['orm/incoming-references'];
        if (references) return references;

        const res: IncomingReference[] = [];

        for (const classSchema of this.database.entities.values()) {
            for (const reference of classSchema.references.values()) {
                if (reference.referenceOptions.onDelete === 'NO ACTION') continue;

                if (reference.getResolvedClassSchema().isSchemaOf(fromClassSchema)) {
                    res.push({ classSchema, property: reference });
                }
            }
        }

        fromClassSchema.jit['orm/incoming-references'] = res;
        return res;
    }

    async onQueryDelete(event: QueryDatabaseDeleteEvent<any>) {
        const references = this.resolveReferencesTo(event.classSchema);
        if (!references.length) return;
        if (!event.deleteResult.primaryKeys.length) return;

        for (const { classSchema, property } of references) {
            const query = event.databaseSession.query(classSchema).filter({ [property.name]: { $in: event.deleteResult.primaryKeys } });
            if (property.referenceOptions.onDelete === 'CASCADE') {
                await query.deleteMany();
            } else if (property.referenceOptions.onDelete === 'SET NULL') {
                await query.patchMany({ [property.name]: null });
            } else if (property.referenceOptions.onDelete === 'SET DEFAULT') {
                await query.patchMany({ [property.name]: property.getDefaultValue() });
            }
        }
    }

    async onQueryPatch(event: QueryDatabasePatchEvent<any>) {
        const references = this.resolveReferencesTo(event.classSchema);
        if (!references.length) return;
        if (!event.patchResult.primaryKeys.length) return;
        const primaryKeyName = event.classSchema.getPrimaryField().name;

        for (const { classSchema, property } of references) {
            if (!event.patch.has(property.name)) continue;

            const query = event.databaseSession.query(classSchema).filter({ [property.name]: { $in: event.patchResult.primaryKeys } });
            if (property.referenceOptions.onDelete === 'CASCADE') {
                await query.patchMany({ [property.name]: event.patch.$set[primaryKeyName] });
            } else if (property.referenceOptions.onDelete === 'SET NULL') {
                await query.patchMany({ [property.name]: null });
            } else if (property.referenceOptions.onDelete === 'SET DEFAULT') {
                await query.patchMany({ [property.name]: property.getDefaultValue() });
            }
        }
    }

    async onUoWDelete(event: UnitOfWorkEvent<any>) {
        const references = this.resolveReferencesTo(event.classSchema);
        if (!references.length) return;

        const primaryKeys: any[] = [];
        const primaryKeyName = event.classSchema.getPrimaryField().name;
        for (const item of event.items) {
            primaryKeys.push(item[primaryKeyName]);
        }

        for (const { classSchema, property } of references) {
            const query = event.databaseSession.query(classSchema).filter({ [property.name]: { $in: primaryKeys } });
            if (property.referenceOptions.onDelete === 'CASCADE') {
                await query.deleteMany();
            } else if (property.referenceOptions.onDelete === 'SET NULL') {
                await query.patchMany({ [property.name]: null });
            } else if (property.referenceOptions.onDelete === 'SET DEFAULT') {
                await query.patchMany({ [property.name]: property.getDefaultValue() });
            }
            //RESTRICT needs to be handled in Pre
        }
    }

    async onUoWUpdate(event: UnitOfWorkUpdateEvent<any>) {
        const references = this.resolveReferencesTo(event.classSchema);
        if (!references.length) return;

        const primaryKeys: { oldPK: any, newPK: any }[] = [];

        const primaryKeyName = event.classSchema.getPrimaryField().name;
        for (const changeSet of event.changeSets) {
            if (changeSet.changes.has(primaryKeyName)) {
                primaryKeys.push({
                    oldPK: changeSet.primaryKey[primaryKeyName],
                    newPK: changeSet.item.primaryKey[primaryKeyName],
                });
            }
        }

        for (const { classSchema, property } of references) {
            for (const { oldPK, newPK } of primaryKeys) {
                const query = await event.databaseSession.query(classSchema).filter({ [property.name]: oldPK });

                if (property.referenceOptions.onDelete === 'CASCADE') {
                    await query.patchMany({ [property.name]: newPK });
                } else if (property.referenceOptions.onDelete === 'SET NULL') {
                    await query.patchMany({ [property.name]: null });
                } else if (property.referenceOptions.onDelete === 'SET DEFAULT') {
                    await query.patchMany({ [property.name]: property.getDefaultValue() });
                }
            }
            //RESTRICT needs to be handled in Pre
        }
    }
}
