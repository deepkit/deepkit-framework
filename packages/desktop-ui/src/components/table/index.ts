/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DuiButtonModule } from '../button';
import { DuiIconModule } from '../icon';
import { DuiSplitterModule } from '../splitter';
import {
    TableCellDirective,
    TableColumnDirective,
    TableComponent,
    TableCustomHeaderContextMenuDirective,
    TableCustomRowContextMenuDirective,
    TableHeaderDirective,
} from './table.component';

export * from './table.component';

@NgModule({
    exports: [
        TableCellDirective,
        TableColumnDirective,
        TableHeaderDirective,
        TableComponent,
        TableCustomRowContextMenuDirective,
        TableCustomHeaderContextMenuDirective,
    ],
    declarations: [
        TableCellDirective,
        TableColumnDirective,
        TableHeaderDirective,
        TableComponent,
        TableCustomRowContextMenuDirective,
        TableCustomHeaderContextMenuDirective,
    ],
    providers: [],
    imports: [CommonModule, DuiIconModule, DuiSplitterModule, ScrollingModule, DuiButtonModule],
})
export class DuiTableModule {}
