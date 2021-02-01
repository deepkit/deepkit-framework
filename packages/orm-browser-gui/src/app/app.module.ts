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
} from '@deepkit/desktop-ui';
import { ControllerClient } from './client';
import { FormsModule } from '@angular/forms';
import { DeepkitClient } from '@deepkit/rpc';
import { OverlayModule } from '@angular/cdk/overlay';
import { DatabaseComponent } from './views/database.component';
import { DatabaseGraphComponent } from './components/database-graph.component';

@NgModule({
  declarations: [
    AppComponent,
    DatabaseComponent,
    DatabaseGraphComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
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
    ControllerClient,
    { provide: DeepkitClient, useFactory: () => new DeepkitClient('ws://' + (location.port === "4200" ? location.hostname + ":9090" : location.host)) },
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
