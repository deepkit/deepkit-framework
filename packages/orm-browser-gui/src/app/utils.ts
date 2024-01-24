import { DatabaseInfo } from '@deepkit/orm-browser-api';
import {
    ReflectionClass,
    ReflectionKind,
    Type,
    TypeProperty,
    TypePropertySignature,
    getTypeJitContainer,
    isNullable,
    isOptional,
    stringifyType,
} from '@deepkit/type';

export function trackByIndex(index: number, item: any) {
    return index;
}

export function trackByDatabase(index: number, database: DatabaseInfo) {
    return database.name;
}

export function trackBySchema(index: number, schema: ReflectionClass<any>) {
    return schema.getName();
}

export function trackByProperty(index: number, property: TypeProperty | TypePropertySignature) {
    return property.name;
}

export function isRequired(type: Type): boolean {
    return !(isOptional(type) || isNullable(type));
}

export function isProperty(type: Type): type is TypeProperty | TypePropertySignature {
    return type.kind === ReflectionKind.property || type.kind === ReflectionKind.propertySignature;
}

export function showTypeString(type: Type, options: { defaultIsOptional?: boolean } = {}): string {
    if (type.kind === ReflectionKind.promise) type = type.type;
    const id = options.defaultIsOptional ? 'showTypeStringDefaultOptional' : 'showTypeString';
    const jit = getTypeJitContainer(type);
    if (jit[id]) return jit[id];
    return (jit[id] = stringifyType(type, { ...options, showNames: true, showFullDefinition: false }));
}

export function getParentProperty(type: Type): TypeProperty | TypePropertySignature | undefined {
    if (
        type.parent &&
        (type.parent.kind === ReflectionKind.property || type.parent.kind === ReflectionKind.propertySignature)
    )
        return type.parent;
    return;
}
