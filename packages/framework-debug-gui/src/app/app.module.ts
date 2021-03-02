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
import { DuiAppModule, DuiButtonModule, DuiCheckboxModule, DuiFormComponent, DuiIconModule, DuiInputModule, DuiListModule, DuiRadioboxModule, DuiSelectModule, DuiTableModule, DuiWindowModule, } from '@deepkit/desktop-ui';
import { ConfigurationComponent } from './views/configuration/configuration.component';
import { HttpComponent } from './views/http/http.component';
import { ControllerClient } from './client';
import { FormsModule } from '@angular/forms';
import { RpcComponent } from './views/rpc/rpc.component';
import { WorkflowCardComponent, WorkflowComponent } from './components/workflow.component';
import { EventsComponent } from './views/events/events.component';
import { DeepkitClient } from '@deepkit/rpc';
import { OverlayModule } from '@angular/cdk/overlay';
import { HttpRequestComponent } from './views/http/request/http-request.component';
import { OrmBrowserModule } from '@deepkit/orm-browser-gui';
import { RouterModule } from '@angular/router';
import { ProfileComponent } from './views/profile/profile.component';

@NgModule({
    declarations: [
        AppComponent,
        ConfigurationComponent,
        HttpComponent,
        RpcComponent,
        ProfileComponent,
        WorkflowComponent,
        WorkflowCardComponent,
        EventsComponent,
        HttpRequestComponent,
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        FormsModule,
        RouterModule.forRoot([]),

        OrmBrowserModule,
        DuiAppModule.forRoot(),
        DuiWindowModule.forRoot(),
        OverlayModule,

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
        { provide: DeepkitClient, useFactory: () => new DeepkitClient('ws://' + ControllerClient.getServerHost()) },
        ControllerClient,
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
