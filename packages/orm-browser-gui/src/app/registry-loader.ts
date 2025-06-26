import { isMongoIdType, isSetType, isUUIDType, ReflectionKind } from '@deepkit/type';
import { getClassName } from '@deepkit/core';
import { StringInputComponent } from './components/edit/string-input.component';
import { ArrayInputComponent } from './components/edit/array-input.component';
import { JsonInputComponent } from './components/edit/json-input.component';
import { DateInputComponent } from './components/edit/date-input.component';
import { BinaryInputComponent } from './components/edit/binary-input.component';
import { EnumInputComponent } from './components/edit/enum-input.component';
import { ClassInputComponent } from './components/edit/class-input.component';
import { StringCellComponent } from './components/cell/string-cell.component';
import { ArrayCellComponent } from './components/cell/array-cell.component';
import { JsonCellComponent } from './components/cell/json-cell.component';
import { DateCellComponent } from './components/cell/date-cell.component';
import { BinaryCellComponent } from './components/cell/binary-cell.component';
import { EnumCellComponent } from './components/cell/enum-cell.component';
import { ClassCellComponent } from './components/cell/class-cell.component';
import { ComponentRegistry } from './registry';

export function loadRegistry(registry: ComponentRegistry) {
    registry.inputRegistry.set(ReflectionKind.string, StringInputComponent);
    registry.inputRegistry.set(ReflectionKind.number, StringInputComponent);
    registry.inputRegistry.set(ReflectionKind.bigint, StringInputComponent);
    // registry.inputRegistry.set(ReflectionKind.union, UnionInputComponent);
    registry.inputRegistry.set(type => type.kind === ReflectionKind.array || isSetType(type), ArrayInputComponent);
    registry.inputRegistry.set(ReflectionKind.any, JsonInputComponent);

    //todo: needs new component
    registry.inputRegistry.set(ReflectionKind.literal, JsonInputComponent);
    registry.inputRegistry.set(ReflectionKind.rest, JsonInputComponent);
    registry.inputRegistry.set(ReflectionKind.promise, JsonInputComponent);
    registry.inputRegistry.set(ReflectionKind.tuple, JsonInputComponent);
    registry.inputRegistry.set(ReflectionKind.regexp, JsonInputComponent);

    registry.inputRegistry.set([ReflectionKind.object, ReflectionKind.unknown], JsonInputComponent);
    registry.inputRegistry.setClass(Date, DateInputComponent);
    registry.inputRegistry.setBinary(BinaryInputComponent);
    registry.inputRegistry.set(ReflectionKind.enum, EnumInputComponent);
    registry.inputRegistry.set([ReflectionKind.class, ReflectionKind.objectLiteral], ClassInputComponent);
    registry.inputRegistry.set(isUUIDType, StringInputComponent);
    registry.inputRegistry.set(isMongoIdType, StringInputComponent);
    // registry.inputRegistry.set(type => {
    //     if (type.kind === ReflectionKind.objectLiteral && type.types.length && type.types.every(v => v.kind === ReflectionKind.indexSignature)) return true;
    //     return isMapType(type);
    // }, MapInputComponent);
    registry.inputRegistry.set(type => {
        return type.kind === ReflectionKind.class && getClassName(type.classType) === 'UploadedFile';
    }, BinaryInputComponent);

    registry.cellRegistry.set(ReflectionKind.string, StringCellComponent);
    registry.cellRegistry.set(ReflectionKind.number, StringCellComponent);
    registry.cellRegistry.set(ReflectionKind.bigint, StringCellComponent);
    // registry.cellRegistry.set(ReflectionKind.union, UnionCellComponent);
    registry.cellRegistry.set(type => type.kind === ReflectionKind.array || isSetType(type), ArrayCellComponent);
    registry.cellRegistry.set(ReflectionKind.any, JsonCellComponent);

    //todo: needs new component
    registry.cellRegistry.set(ReflectionKind.literal, JsonCellComponent);
    registry.cellRegistry.set(ReflectionKind.rest, JsonCellComponent);
    registry.cellRegistry.set(ReflectionKind.promise, JsonCellComponent);
    registry.cellRegistry.set(ReflectionKind.tuple, JsonCellComponent);
    registry.cellRegistry.set(ReflectionKind.regexp, JsonCellComponent);

    registry.cellRegistry.set([ReflectionKind.object, ReflectionKind.unknown], JsonCellComponent);
    registry.cellRegistry.setClass(Date, DateCellComponent);
    registry.cellRegistry.setBinary(BinaryCellComponent);
    registry.cellRegistry.set(ReflectionKind.enum, EnumCellComponent);
    registry.cellRegistry.set([ReflectionKind.class, ReflectionKind.objectLiteral], ClassCellComponent);
    registry.cellRegistry.set(isUUIDType, StringCellComponent);
    registry.cellRegistry.set(isMongoIdType, StringCellComponent);
    // registry.cellRegistry.set(type => {
    //     if (type.kind === ReflectionKind.objectLiteral && type.types.length && type.types.every(v => v.kind === ReflectionKind.indexSignature)) return true;
    //     return isMapType(type);
    // }, MapCellComponent);
    registry.cellRegistry.set(type => {
        return type.kind === ReflectionKind.class && getClassName(type.classType) === 'UploadedFile';
    }, BinaryCellComponent);
}
