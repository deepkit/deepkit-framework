import { ClassType } from '@deepkit/core';
import { Types } from '@deepkit/type';
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

export class Registry {
    inputComponents: { [name in Types]?: ClassType } = {
        string: StringInputComponent,
        array: ArrayInputComponent,
        number: StringInputComponent,
        uuid: StringInputComponent,
        objectId: StringInputComponent,
        class: ClassInputComponent,
        date: DateInputComponent,
        enum: EnumInputComponent,
        map: JsonInputComponent,
        union: JsonInputComponent,
        any: JsonInputComponent,
        partial: ClassInputComponent,
        literal: JsonInputComponent,
        patch: JsonInputComponent,
        arrayBuffer: BinaryInputComponent,
        Uint8Array: BinaryInputComponent,
        Int8Array: BinaryInputComponent,
        Uint8ClampedArray: BinaryInputComponent,
        Int16Array: BinaryInputComponent,
        Uint16Array: BinaryInputComponent,
        Int32Array: BinaryInputComponent,
        Uint32Array: BinaryInputComponent,
        Float32Array: BinaryInputComponent,
        Float64Array: BinaryInputComponent,
    };

    cellComponents: { [name in Types]?: ClassType } = {
        string: StringCellComponent,
        array: ArrayCellComponent,
        number: StringCellComponent,
        uuid: StringCellComponent,
        objectId: StringCellComponent,
        date: DateCellComponent,
        class: ClassCellComponent,
        enum: EnumCellComponent,
        map: JsonCellComponent,
        union: JsonCellComponent,
        any: JsonCellComponent,
        partial: ClassInputComponent,
        literal: JsonCellComponent,
        patch: JsonCellComponent,
        arrayBuffer: BinaryCellComponent,
        Uint8Array: BinaryCellComponent,
        Uint8ClampedArray: BinaryCellComponent,
        Int16Array: BinaryCellComponent,
        Uint16Array: BinaryCellComponent,
        Int32Array: BinaryCellComponent,
        Uint32Array: BinaryCellComponent,
        Float32Array: BinaryCellComponent,
        Float64Array: BinaryCellComponent,
    };

}
