import {v4} from 'uuid';

export function uuid(): string {
    return v4();
}

export function capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function isArray(v: any): v is Array<any> {
    if (v && (v as any).length && (v as any).reduce) return true;
    return false;
}
