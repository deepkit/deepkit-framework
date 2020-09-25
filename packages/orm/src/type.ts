
export type ExtractPrimaryKey<T> = string;

export interface Entity {
}

export type PatchResult<T, K extends (keyof T) | never = never> = { modified: number, returning: { [name in K]: T[name][] }, primaryKeys: ExtractPrimaryKey<T>[] };
export type DeleteResult<T> = { modified: number, primaryKeys: ExtractPrimaryKey<T>[] };
