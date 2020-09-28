import {FlattenIfArray} from './utils';

export const isPrimaryKey = Symbol('primaryKey');
export type PrimaryKey<T> = T & { [isPrimaryKey]?: T };

const isReference = Symbol('reference');
export type Reference<T> = T & { [isReference]?: T };

const isBackReference = Symbol('backReference');
export type BackReference<T> = T & { [isBackReference]?: T } & { [isReference]?: T };

export type ExtractPrimaryKeys<T, R = Required<T>> = { [K in keyof R]: R[K] extends { [isPrimaryKey]?: infer PKT } ? K : never }[keyof R];
export type ExtractPrimaryKeyType<T> = ExtractPrimaryKeys<T> extends never ? any : ExtractPrimaryKeys<T>;

type _references<T> = { [K in keyof T]: T[K] extends { [isReference]?: any } ? K : never }[keyof T];

type isProbablyReference<T> = FlattenIfArray<T> extends number | string | Date | boolean ? false : true;

type _referencesFromClasses<T> = { [P in keyof T]: isProbablyReference<T[P]> extends true ? P : never }[keyof T];

type _referencesOrAllClassTypes<T> = _references<T> extends never ? _referencesFromClasses<T> : _references<T>;

export type ExtractReferences<T> = _referencesOrAllClassTypes<Required<T>>;

export type ExtractPrimaryKeyOrReferenceType<T> = T extends PrimaryKey<infer PT> ? PT : T extends Reference<infer RT> ? RT : T;

export type PrimaryKeyFields<T> = Record<ExtractPrimaryKeys<T>, T>;
