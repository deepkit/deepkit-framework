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

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {
  DuiButtonModule,
  DuiCheckboxModule,
  DuiFormComponent,
  DuiInputModule,
  DuiRadioboxModule,
  DuiSelectModule,
  DuiWindowModule,
  DuiIconModule,
  DuiListModule,
  DuiTableModule,
  DuiAppModule,
  DuiDialogModule,
  ListComponent,
} from '@deepkit/desktop-ui';
import { ControllerClient } from './client';
import { BrowserState } from './browser-state';
import { FormsModule } from '@angular/forms';
import { DeepkitClient } from '@deepkit/rpc';
import { OverlayModule } from '@angular/cdk/overlay';
import { DatabaseComponent } from './views/database.component';
import { DatabaseGraphComponent } from './components/database-graph.component';
import { InputEditing } from './components/edit/input-editing.component';
import { InputStringComponent } from './components/edit/input-string.component';
import { InputDateComponent } from './components/edit/input-date.component';
import { CellComponent } from './components/cell/cell.component';
import { StringCellComponent } from './components/cell/string-cell.component';
import { DateCellComponent } from './components/cell/date-cell.component';
import { DatabaseBrowserComponent } from './views/database-browser.component';
import { DatabaseBrowserListComponent } from './components/list.component';

@NgModule({
  declarations: [
    AppComponent,
    DatabaseComponent,
    DatabaseBrowserComponent,
    DatabaseGraphComponent,
    InputEditing,
    InputStringComponent,
    InputDateComponent,
    CellComponent,
    StringCellComponent,
    DateCellComponent,
    DatabaseBrowserListComponent,
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
    ControllerClient,
    { provide: DeepkitClient, useFactory: () => new DeepkitClient('ws://' + (location.port === "4200" ? location.hostname + ":9090" : location.host)) },
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
