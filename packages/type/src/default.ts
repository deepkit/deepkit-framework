import { binaryTypes, getClassType, ReflectionKind, resolveTypeMembers, Type } from './reflection/type.js';
import { ClassType } from '@deepkit/core';

/**
 * Returns a sensible default value for a given type.
 * Sensible means it satisfies the type checker, but not necessarily attached validators.
 */
export function defaultValue(type: Type): any {
    switch (type.kind) {
        case ReflectionKind.void:
        case ReflectionKind.any:
        case ReflectionKind.never:
        case ReflectionKind.unknown:
        case ReflectionKind.undefined:
            return undefined;
        case ReflectionKind.null:
            return null;
        case ReflectionKind.string:
            return '';
        case ReflectionKind.number:
            return 0;
        case ReflectionKind.boolean:
            return false;
        case ReflectionKind.bigint:
            return BigInt(0);
        case ReflectionKind.object:
            return {};
        case ReflectionKind.union: {
            if (type.types.length) return defaultValue(type.types[0]);
            break;
        }
        case ReflectionKind.promise:
            return defaultValue(type.type);
        case ReflectionKind.array:
            return [];
        case ReflectionKind.rest: {
            return [defaultValue(type.type)];
        }
        case ReflectionKind.tupleMember: {
            if (type.optional) return;
            return defaultValue(type.type);
        }
        case ReflectionKind.tuple: {
            const result: any[] = [];
            for (const sub of type.types) {
                const value = defaultValue(sub);
                if (value === undefined) continue;
                if (sub.type.kind === ReflectionKind.rest) {
                    result.push(...value);
                } else {
                    result.push(value);
                }
            }
            return result;
        }
        case ReflectionKind.enum: {
            return type.values[0];
        }
        case ReflectionKind.objectLiteral: {
            const result: any = {};
            const types = resolveTypeMembers(type);
            for (const type of types) {
                if (type.kind === ReflectionKind.propertySignature) {
                    if (type.optional) continue;
                    result[type.name] = defaultValue(type.type);
                }
            }

            return result;
        }
        case ReflectionKind.class: {
            if (type.classType === Date) return new Date;
            if (type.classType === Set) return new Set;
            if (type.classType === Map) return new Map;
            if (binaryTypes.includes(type.classType)) return new type.classType;

            const result: any = {};
            const types = resolveTypeMembers(type);
            for (const type of types) {
                if (type.kind === ReflectionKind.property) {
                    if (type.optional) continue;
                    result[type.name] = defaultValue(type.type);
                }
            }

            return result;
        }
    }
}
