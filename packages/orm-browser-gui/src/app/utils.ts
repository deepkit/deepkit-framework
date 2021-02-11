import { ClassSchema, PropertySchema } from '@deepkit/type';
import { DatabaseInfo } from '@deepkit/orm-browser-api';

export function trackByIndex(index: number, item: any) {
    return index;
}

export function filterEntitiesToList(schemas: ClassSchema[]): ClassSchema[] {
    return schemas.filter(v => v.name && !v.name.startsWith('@:embedded/'));
}

export function trackByDatabase(index: number, database: DatabaseInfo) {
    return database.name;
}

export function trackBySchema(index: number, schema: ClassSchema) {
    return schema.getName();
}

export function trackByProperty(index: number, property: PropertySchema) {
    return property.name;
}
