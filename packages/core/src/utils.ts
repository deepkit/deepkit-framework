import {v4} from 'uuid';

export function uuid(): string {
    return v4();
}

export function capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
