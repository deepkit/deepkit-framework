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
import { AppRoutingModule } from './app-routing.module.js';
import { AppComponent } from './app.component.js';
import {
    DuiAppModule,
    DuiButtonModule,
    DuiCheckboxModule,
    DuiFormComponent,
    DuiIconModule,
    DuiInputModule,
    DuiListModule,
    DuiRadioboxModule,
    DuiSelectModule,
    DuiTableModule,
    DuiWindowModule,
} from '@deepkit/desktop-ui';
import { ConfigurationComponent } from './views/configuration/configuration.component.js';
import { HttpComponent } from './views/http/http.component.js';
import { ControllerClient } from './client.js';
import { FormsModule } from '@angular/forms';
import { RpcComponent } from './views/rpc/rpc.component.js';
import { WorkflowCardComponent, WorkflowComponent } from './components/workflow.component.js';
import { EventsComponent } from './views/events/events.component.js';
import { DeepkitClient } from '@deepkit/rpc';
import { OverlayModule } from '@angular/cdk/overlay';
import { HttpRequestComponent } from './views/http/request/http-request.component.js';
import { OrmBrowserModule } from '@deepkit/orm-browser-gui';
import { ApiConsoleModule } from '@deepkit/api-console-gui';
import { ProfileComponent } from './views/profile/profile.component.js';
import { ProfileTimelineComponent } from './views/profile/timeline.component.js';
import { ModulesComponent } from './views/modules/modules.component.js';
import { ModuleDetailComponent, ModuleDetailServiceComponent } from './views/modules/module-detail.component.js';
import { DeepkitUIModule } from '@deepkit/ui-library';

@NgModule({
    declarations: [
        AppComponent,
        ConfigurationComponent,
        HttpComponent,
        RpcComponent,
        ProfileComponent,
        ProfileTimelineComponent,
        WorkflowComponent,
        WorkflowCardComponent,
        EventsComponent,
        HttpRequestComponent,
        ModulesComponent,
        ModuleDetailComponent,
        ModuleDetailServiceComponent,
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        FormsModule,

        DuiAppModule.forRoot(),
        DuiWindowModule.forRoot(),
        OrmBrowserModule.forRoot(),
        ApiConsoleModule,
        OverlayModule,

        DeepkitUIModule,
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
        { provide: DeepkitClient, useFactory: () => new DeepkitClient(ControllerClient.getServerHost()) },
        ControllerClient,
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
