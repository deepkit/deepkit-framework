import { ClassType, getClassName } from '@deepkit/core';
import { isMongoIdType, isSetType, isUUIDType, ReflectionKind, TypeRegistry } from '@deepkit/type';
import { ClassCellComponent } from './components/cell/class-cell.component';
import { DateCellComponent } from './components/cell/date-cell.component';
import { EnumCellComponent } from './components/cell/enum-cell.component';
import { StringCellComponent } from './components/cell/string-cell.component';
import { ClassInputComponent } from './components/edit/class-input.component';
import { DateInputComponent } from './components/edit/date-input.component';
import { EnumInputComponent } from './components/edit/enum-input.component';
import { StringInputComponent } from './components/edit/string-input.component';
import { ArrayInputComponent } from './components/edit/array-input.component';
import { ArrayCellComponent } from './components/cell/array-cell.component';
import { JsonInputComponent } from './components/edit/json-input.component';
import { JsonCellComponent } from './components/cell/json-cell.component';
import { BinaryInputComponent } from './components/edit/binary-input.component';
import { BinaryCellComponent } from './components/cell/binary-cell.component';

export const inputRegistry = new TypeRegistry<ClassType>();

inputRegistry.set(ReflectionKind.string, StringInputComponent);
inputRegistry.set(ReflectionKind.number, StringInputComponent);
inputRegistry.set(ReflectionKind.bigint, StringInputComponent);
// inputRegistry.set(ReflectionKind.union, UnionInputComponent);
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
// inputRegistry.set(type => {
//     if (type.kind === ReflectionKind.objectLiteral && type.types.length && type.types.every(v => v.kind === ReflectionKind.indexSignature)) return true;
//     return isMapType(type);
// }, MapInputComponent);
inputRegistry.set(type => {
    return type.kind === ReflectionKind.class && getClassName(type.classType) === 'UploadedFile';
}, BinaryInputComponent);








export const cellRegistry = new TypeRegistry<ClassType>();

cellRegistry.set(ReflectionKind.string, StringCellComponent);
cellRegistry.set(ReflectionKind.number, StringCellComponent);
cellRegistry.set(ReflectionKind.bigint, StringCellComponent);
// cellRegistry.set(ReflectionKind.union, UnionCellComponent);
cellRegistry.set(type => type.kind === ReflectionKind.array || isSetType(type), ArrayCellComponent);
cellRegistry.set(ReflectionKind.any, JsonCellComponent);

//todo: needs new component
cellRegistry.set(ReflectionKind.literal, JsonCellComponent);
cellRegistry.set(ReflectionKind.rest, JsonCellComponent);
cellRegistry.set(ReflectionKind.promise, JsonCellComponent);
cellRegistry.set(ReflectionKind.tuple, JsonCellComponent);
cellRegistry.set(ReflectionKind.regexp, JsonCellComponent);

cellRegistry.set([ReflectionKind.object, ReflectionKind.unknown], JsonCellComponent);
cellRegistry.setClass(Date, DateCellComponent);
cellRegistry.setBinary(BinaryCellComponent);
cellRegistry.set(ReflectionKind.enum, EnumCellComponent);
cellRegistry.set([ReflectionKind.class, ReflectionKind.objectLiteral], ClassCellComponent);
cellRegistry.set(isUUIDType, StringCellComponent);
cellRegistry.set(isMongoIdType, StringCellComponent);
// cellRegistry.set(type => {
//     if (type.kind === ReflectionKind.objectLiteral && type.types.length && type.types.every(v => v.kind === ReflectionKind.indexSignature)) return true;
//     return isMapType(type);
// }, MapCellComponent);
cellRegistry.set(type => {
    return type.kind === ReflectionKind.class && getClassName(type.classType) === 'UploadedFile';
}, BinaryCellComponent);
