/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import {
    DuiAppModule,
    DuiButtonModule,
    DuiCheckboxModule,
    DuiDialogModule,
    DuiFormComponent,
    DuiIconModule,
    DuiInputModule,
    DuiListModule,
    DuiRadioboxModule,
    DuiSelectModule,
    DuiTableModule,
    DuiWindowModule,
} from '@deepkit/desktop-ui';
import { ControllerClient } from './client';
import { BrowserState } from './browser-state';
import { FormsModule } from '@angular/forms';
import { DeepkitClient } from '@deepkit/rpc';
import { OverlayModule } from '@angular/cdk/overlay';
import { DatabaseComponent } from './views/database.component';
import { DatabaseGraphComponent } from './components/database-graph.component';
import { InputEditingComponent } from './components/edit/input.component';
import { StringInputComponent } from './components/edit/string-input.component';
import { DateInputComponent } from './components/edit/date-input.component';
import { CellComponent } from './components/cell/cell.component';
import { StringCellComponent } from './components/cell/string-cell.component';
import { DateCellComponent } from './components/cell/date-cell.component';
import { DatabaseBrowserComponent } from './views/database-browser.component';
import { DatabaseBrowserListComponent } from './components/list.component';
import { ClassCellComponent } from './components/cell/class-cell.component';
import { ClassInputComponent } from './components/edit/class-input.component';
import { Registry } from './registry';
import { EnumCellComponent } from './components/cell/enum-cell.component';
import { EnumInputComponent } from './components/edit/enum-input.component';
import { DatabaseCommitComponent } from './views/database-commit.component';
import { FilterComponent, FilterItemComponent } from './components/filter.compoment';
import { JsonEditDialogComponent } from './components/dialog/json-edit-dialog.component';
import { ArrayInputComponent } from './components/edit/array-input.component';
import { ArrayCellComponent } from './components/cell/array-cell.component';

@NgModule({
    declarations: [
        AppComponent,
        DatabaseComponent,
        DatabaseBrowserComponent,
        DatabaseGraphComponent,
        InputEditingComponent,
        StringInputComponent,
        DateInputComponent,
        CellComponent,
        StringCellComponent,
        DateCellComponent,
        DatabaseBrowserListComponent,
        ClassCellComponent,
        ClassInputComponent,
        EnumCellComponent,
        EnumInputComponent,
        DatabaseCommitComponent,
        FilterComponent,
        FilterItemComponent,
        JsonEditDialogComponent,
        ArrayInputComponent,
        ArrayCellComponent,
    ],
    imports: [
        BrowserModule,
        FormsModule,

        DuiAppModule.forRoot(),
        DuiWindowModule.forRoot(),
        OverlayModule,
        DuiDialogModule,

        DuiCheckboxModule,
        DuiButtonModule,
        DuiInputModule,
        DuiFormComponent,
        DuiRadioboxModule,
        DuiSelectModule,
        DuiIconModule,
        DuiListModule,
        DuiTableModule,
    ],
    providers: [
        BrowserState,
        Registry,
        ControllerClient,
        {
            provide: DeepkitClient,
            useFactory: () => new DeepkitClient('ws://' + (location.port === '4200' ? location.hostname + ':9090' : location.host))
        },
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
