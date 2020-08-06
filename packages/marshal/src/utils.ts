import {v4} from 'uuid';

export function uuid(): string {
    return v4();
}

export function isArray(v: any): v is Array<any> {
    if (v && (v as any).length && (v as any).reduce) return true;
    return false;
}

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;