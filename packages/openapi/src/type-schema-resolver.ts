import { getParentClass } from '@deepkit/core';
import {
    ReflectionKind,
    Type,
    TypeClass,
    TypeEnum,
    TypeLiteral,
    TypeObjectLiteral,
    isDateType,
    reflect,
    validationAnnotation,
} from '@deepkit/type';

import { LiteralSupported, TypeError, TypeErrors, TypeNotSupported } from './errors';
import { SchemaRegistry } from './schema-registry';
import { AnySchema, Schema } from './types';
import { validators } from './validators';

export class TypeSchemaResolver {
    result: Schema = { ...AnySchema };
    errors: TypeError[] = [];

    constructor(
        public t: Type,
        public schemaRegistry: SchemaRegistry,
    ) {}

    resolveBasic() {
        switch (this.t.kind) {
            case ReflectionKind.never:
                this.result.not = AnySchema;
                return;
            case ReflectionKind.any:
            case ReflectionKind.unknown:
            case ReflectionKind.void:
                this.result = AnySchema;
                return;
            case ReflectionKind.object:
                this.result.type = 'object';
                return;
            case ReflectionKind.string:
                this.result.type = 'string';
                return;
            case ReflectionKind.number:
                this.result.type = 'number';
                return;
            case ReflectionKind.boolean:
                this.result.type = 'boolean';
                return;
            case ReflectionKind.bigint:
                this.result.type = 'number';
                return;
            case ReflectionKind.null:
                this.result.nullable = true;
                return;
            case ReflectionKind.undefined:
                this.result.__isUndefined = true;
                return;
            case ReflectionKind.literal:
                const type = mapSimpleLiteralToType(this.t.literal);
                if (type) {
                    this.result.type = type;
                    this.result.enum = [this.t.literal as any];
                } else {
                    this.errors.push(new LiteralSupported(typeof this.t.literal));
                }

                return;
            case ReflectionKind.templateLiteral:
                this.result.type = 'string';
                this.errors.push(new TypeNotSupported(this.t, 'Literal is treated as string for simplicity'));

                return;
            case ReflectionKind.class:
            case ReflectionKind.objectLiteral:
                this.resolveClassOrObjectLiteral();
                return;
            case ReflectionKind.array:
                this.result.type = 'array';
                const itemsResult = resolveTypeSchema(this.t.type, this.schemaRegistry);

                this.result.items = itemsResult.result;
                this.errors.push(...itemsResult.errors);
                return;
            case ReflectionKind.enum:
                this.resolveEnum();
                return;
            case ReflectionKind.union:
                this.resolveUnion();
                return;
            default:
                this.errors.push(new TypeNotSupported(this.t));
                return;
        }
    }

    resolveClassOrObjectLiteral() {
        if (this.t.kind !== ReflectionKind.class && this.t.kind !== ReflectionKind.objectLiteral) {
            return;
        }

        // Dates will be serialized to string
        if (isDateType(this.t)) {
            this.result.type = 'string';
            return;
        }

        this.result.type = 'object';

        let typeClass: TypeClass | TypeObjectLiteral | undefined = this.t;
        this.result.properties = {};

        const typeClasses: (TypeClass | TypeObjectLiteral | undefined)[] = [this.t];

        const required: string[] = [];

        if (this.t.kind === ReflectionKind.class) {
            // Build a list of inheritance, from root to current class.
            while (true) {
                const parentClass = getParentClass((typeClass as TypeClass).classType);
                if (parentClass) {
                    typeClass = reflect(parentClass) as any;
                    typeClasses.unshift(typeClass);
                } else {
                    break;
                }
            }
        }

        // Follow the order to override properties.
        for (const typeClass of typeClasses) {
            for (const typeItem of typeClass!.types) {
                if (typeItem.kind === ReflectionKind.property || typeItem.kind === ReflectionKind.propertySignature) {
                    const typeResolver = resolveTypeSchema(typeItem.type, this.schemaRegistry);

                    if (!typeItem.optional && !required.includes(String(typeItem.name))) {
                        required.push(String(typeItem.name));
                    }

                    this.result.properties[String(typeItem.name)] = typeResolver.result;
                    this.errors.push(...typeResolver.errors);
                }
            }
        }

        if (required.length) {
            this.result.required = required;
        }

        const registryKey = this.schemaRegistry.getSchemaKey(this.t);

        if (registryKey) {
            this.schemaRegistry.registerSchema(registryKey, this.t, this.result);
        }
    }

    resolveEnum() {
        if (this.t.kind !== ReflectionKind.enum) {
            return;
        }

        let types = new Set<string>();

        for (const value of this.t.values) {
            const currentType = mapSimpleLiteralToType(value);

            if (currentType === undefined) {
                this.errors.push(new TypeNotSupported(this.t, `Enum with unsupported members. `));
                continue;
            }

            types.add(currentType);
        }

        this.result.type = types.size > 1 ? undefined : [...types.values()][0];
        this.result.enum = this.t.values as any;

        const registryKey = this.schemaRegistry.getSchemaKey(this.t);
        if (registryKey) {
            this.schemaRegistry.registerSchema(registryKey, this.t, this.result);
        }
    }

    resolveUnion() {
        if (this.t.kind !== ReflectionKind.union) {
            return;
        }

        const hasNull = this.t.types.some(t => t.kind === ReflectionKind.null);
        if (hasNull) {
            this.result.nullable = true;
            this.t = { ...this.t, types: this.t.types.filter(t => t.kind !== ReflectionKind.null) };
        }

        // if there's only one type left in the union, pull it up a level and go back to resolveBasic
        if (this.t.types.length === 1) {
            this.t = this.t.types[0];
            return this.resolveBasic();
        }

        // Find out whether it is a union of literals. If so, treat it as an enum
        if (
            this.t.types.every(
                (t): t is TypeLiteral =>
                    t.kind === ReflectionKind.literal &&
                    ['string', 'number'].includes(mapSimpleLiteralToType(t.literal) as any),
            )
        ) {
            const enumType: TypeEnum = {
                ...this.t,
                kind: ReflectionKind.enum,
                enum: Object.fromEntries(this.t.types.map(t => [t.literal, t.literal as any])),
                values: this.t.types.map(t => t.literal as any),
                indexType: this.t,
            };

            const { result, errors } = resolveTypeSchema(enumType, this.schemaRegistry);
            this.result = result;
            this.errors.push(...errors);
            if (hasNull) {
                this.result.enum!.push(null);
                this.result.nullable = true;
            }
            return;
        }

        this.result.type = undefined;
        this.result.oneOf = [];

        for (const t of this.t.types) {
            const { result, errors } = resolveTypeSchema(t, this.schemaRegistry);
            this.result.oneOf?.push(result);
            this.errors.push(...errors);
        }
    }

    resolveValidators() {
        for (const annotation of validationAnnotation.getAnnotations(this.t)) {
            const { name, args } = annotation;

            const validator = validators[name];

            if (!validator) {
                this.errors.push(new TypeNotSupported(this.t, `Validator ${name} is not supported. `));
            } else {
                try {
                    this.result = validator(this.result, ...(args as [any]));
                } catch (e) {
                    if (e instanceof TypeNotSupported) {
                        this.errors.push(e);
                    } else {
                        throw e;
                    }
                }
            }
        }
    }

    resolve() {
        this.resolveBasic();
        this.resolveValidators();

        return this;
    }
}

export const mapSimpleLiteralToType = (literal: any) => {
    if (typeof literal === 'string') {
        return 'string';
    } else if (typeof literal === 'bigint') {
        return 'integer';
    } else if (typeof literal === 'number') {
        return 'number';
    } else if (typeof literal === 'boolean') {
        return 'boolean';
    } else {
        return;
    }
};

export const unwrapTypeSchema = (t: Type, r: SchemaRegistry = new SchemaRegistry()) => {
    const resolver = new TypeSchemaResolver(t, new SchemaRegistry()).resolve();

    if (resolver.errors.length === 0) {
        return resolver.result;
    } else {
        throw new TypeErrors(resolver.errors, 'Errors with input type. ');
    }
};

export const resolveTypeSchema = (t: Type, r: SchemaRegistry = new SchemaRegistry()) => {
    return new TypeSchemaResolver(t, r).resolve();
};
