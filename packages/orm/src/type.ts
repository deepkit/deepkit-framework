import {ExtractPrimaryKeyType} from '@deepkit/type';

export interface Entity {
}

export type PatchResult<T, K extends (keyof T) | never = never> = { modified: number, returning: { [name in K]: T[name][] }, primaryKeys: ExtractPrimaryKeyType<T>[] };
export type DeleteResult<T> = { modified: number, primaryKeys: ExtractPrimaryKeyType<T>[] };
