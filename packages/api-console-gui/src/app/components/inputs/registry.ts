import { isMapType, isMongoIdType, isSetType, isUUIDType, ReflectionKind, TypeRegistry } from '@deepkit/type';
import { ClassType, getClassName } from '@deepkit/core';
import { StringInputComponent } from './string-input.component.js';
import { ArrayInputComponent } from './array-input.component.js';
import { EnumInputComponent } from './enum-input.component.js';
import { DateInputComponent } from './date-input.component.js';
import { JsonInputComponent } from './json-input.component.js';
import { BinaryInputComponent } from './binary-input.component.js';
import { ClassInputComponent } from './class-input.component.js';
import { MapInputComponent } from './map-input.component.js';
import { UnionInputComponent } from './union-input.component.js';

export const inputRegistry = new TypeRegistry<ClassType>();

inputRegistry.set(ReflectionKind.string, StringInputComponent);
inputRegistry.set(ReflectionKind.number, StringInputComponent);
inputRegistry.set(ReflectionKind.bigint, StringInputComponent);
inputRegistry.set(ReflectionKind.union, UnionInputComponent);
inputRegistry.set(type => type.kind === ReflectionKind.array || isSetType(type), ArrayInputComponent);
inputRegistry.set(ReflectionKind.any, JsonInputComponent);

//todo: needs new component
inputRegistry.set(ReflectionKind.literal, JsonInputComponent);
inputRegistry.set(ReflectionKind.rest, JsonInputComponent);
inputRegistry.set(ReflectionKind.promise, JsonInputComponent);
inputRegistry.set(ReflectionKind.tuple, JsonInputComponent);
inputRegistry.set(ReflectionKind.regexp, JsonInputComponent);

inputRegistry.set([ReflectionKind.object, ReflectionKind.unknown], JsonInputComponent);
inputRegistry.setClass(Date, DateInputComponent);
inputRegistry.setBinary(BinaryInputComponent);
inputRegistry.set(ReflectionKind.enum, EnumInputComponent);
inputRegistry.set([ReflectionKind.class, ReflectionKind.objectLiteral], ClassInputComponent);
inputRegistry.set(isUUIDType, StringInputComponent);
inputRegistry.set(isMongoIdType, StringInputComponent);
inputRegistry.set(type => {
    if (type.kind === ReflectionKind.objectLiteral && type.types.length && type.types.every(v => v.kind === ReflectionKind.indexSignature)) return true;
    return isMapType(type);
}, MapInputComponent);
inputRegistry.set(type => {
    return type.kind === ReflectionKind.class && getClassName(type.classType) === 'UploadedFile';
}, BinaryInputComponent);
