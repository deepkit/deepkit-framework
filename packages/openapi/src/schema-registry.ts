import camelcase from 'camelcase';

import {
    ReflectionKind,
    Type,
    TypeClass,
    TypeEnum,
    TypeObjectLiteral,
    TypeUnion,
    isSameType,
    metaAnnotation,
    stringifyType,
    typeOf,
} from '@deepkit/type';

import { OpenApiSchemaNameConflict } from './errors';
import { Schema } from './types';

export interface SchemeEntry {
    name: string;
    schema: Schema;
    type: Type;
}

export type RegistrableSchema = TypeClass | TypeObjectLiteral | TypeEnum | TypeUnion;

export type SchemaKeyFn = (t: RegistrableSchema) => string | undefined;

export class SchemaRegistry {
    store: Map<string, SchemeEntry> = new Map();

    constructor(private customSchemaKeyFn?: SchemaKeyFn) {}

    getSchemaKey(t: RegistrableSchema): string {
        const nameAnnotation = metaAnnotation.getAnnotations(t).find(t => t.name === 'openapi:name');

        // Handle user preferred name
        if (nameAnnotation?.options.kind === ReflectionKind.literal) {
            return nameAnnotation.options.literal as string;
        }

        // HttpQueries<T>
        if (
            t.typeName === 'HttpQueries' ||
            t.typeName === 'HttpBody' ||
            t.typeName === 'HttpBodyValidation'
        ) {
            return this.getSchemaKey(
                ((t as RegistrableSchema).typeArguments?.[0] ??
                    (t as RegistrableSchema).originTypes?.[0]) as RegistrableSchema,
            );
        }

        if (this.customSchemaKeyFn) {
            const customName = this.customSchemaKeyFn(t);
            if (customName) return customName;
        }

        const rootName = t.kind === ReflectionKind.class ? t.classType.name : (t.typeName ?? '');

        const args = t.kind === ReflectionKind.class ? (t.arguments ?? []) : (t.typeArguments ?? []);

        return camelcase([rootName, ...args.map(a => this.getTypeKey(a))], {
            pascalCase: true,
        });
    }

    getTypeKey(t: Type): string {
        if (
            t.kind === ReflectionKind.string ||
            t.kind === ReflectionKind.number ||
            t.kind === ReflectionKind.bigint ||
            t.kind === ReflectionKind.boolean ||
            t.kind === ReflectionKind.null ||
            t.kind === ReflectionKind.undefined
        ) {
            return stringifyType(t);
        } else if (
            t.kind === ReflectionKind.class ||
            t.kind === ReflectionKind.objectLiteral ||
            t.kind === ReflectionKind.enum ||
            t.kind === ReflectionKind.union
        ) {
            return this.getSchemaKey(t);
        } else if (t.kind === ReflectionKind.array) {
            return camelcase([this.getTypeKey(t.type), 'Array'], {
                pascalCase: false,
            });
        } else {
            // Complex types not named
            return '';
        }
    }

    registerSchema(name: string, type: Type, schema: Schema) {
        const currentEntry = this.store.get(name);

        if (currentEntry && !isSameType(type, currentEntry?.type)) {
            throw new OpenApiSchemaNameConflict(type, currentEntry.type, name);
        }

        this.store.set(name, {
            type,
            name,
            schema: {
                ...schema,
                nullable: undefined,
            },
        });
        schema.__registryKey = name;
    }
}
