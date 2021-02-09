import { ClassType } from '@deepkit/core';
import { Types } from '../../../rpc/node_modules/@deepkit/type';
import { ClassCellComponent } from './components/cell/class-cell.component';
import { DateCellComponent } from './components/cell/date-cell.component';
import { EnumCellComponent } from './components/cell/enum-cell.component';
import { StringCellComponent } from './components/cell/string-cell.component';
import { ClassInputComponent } from './components/edit/class-input.component';
import { DateInputComponent } from './components/edit/date-input.component';
import { EnumInputComponent } from './components/edit/enum-input.component';
import { StringInputComponent } from './components/edit/string-input.component';
import {ArrayInputComponent} from './components/edit/array-input.component';
import { ArrayCellComponent } from './components/cell/array-cell.component';

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
    };

}
