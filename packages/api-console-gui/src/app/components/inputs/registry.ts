import { Types } from '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { StringInputComponent } from './string-input.component';
import { ArrayInputComponent } from './array-input.component';
import { EnumInputComponent } from './enum-input.component';
import { DateInputComponent } from './date-input.component';
import { JsonInputComponent } from './json-input.component';
import { BinaryInputComponent } from './binary-input.component';
import { ClassInputComponent } from './class-input.component';
import { MapInputComponent } from './map-input.component';
import { UnionInputComponent } from './union-input.component';

export class InputRegistry {
    inputComponents: { [name in Types]?: ClassType } = {
        string: StringInputComponent,
        array: ArrayInputComponent,
        number: StringInputComponent,
        uuid: StringInputComponent,
        objectId: StringInputComponent,
        class: ClassInputComponent,
        date: DateInputComponent,
        enum: EnumInputComponent,
        map: MapInputComponent,
        union: UnionInputComponent,
        any: StringInputComponent,
        partial: ClassInputComponent,
        literal: JsonInputComponent,
        patch: ClassInputComponent,
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
    }
}
