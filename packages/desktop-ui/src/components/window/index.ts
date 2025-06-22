/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ModuleWithProviders, NgModule } from '@angular/core';
import { WindowContentComponent } from './window-content.component';
import { WindowComponent, WindowFrameComponent } from './window.component';
import { WindowFooterComponent } from './window-footer.component';
import {
    WindowHeaderComponent,
    WindowToolbarComponent,
    WindowToolbarContainerComponent
} from './window-header.component';
import { CommonModule } from '@angular/common';
import { WindowSidebarComponent } from './window-sidebar.component';


import { WindowRegistry } from './window-state';

import {
    ExternalDialogDirective,
    ExternalDialogWrapperComponent,
    ExternalWindowComponent
} from './external-window.component';
import { DuiExternalWindow } from './external-window';


export * from "./window.component";
export * from "./external-window";
export * from "./external-window.component";
export * from "./window-content.component";
export * from "./window-header.component";
export * from "./window-footer.component";
export * from "./window-menu";
export * from "./window-sidebar.component";

@NgModule({
    exports: [
        WindowContentComponent,
        WindowComponent,
        WindowFrameComponent,
        WindowFooterComponent,
        WindowHeaderComponent,
        WindowToolbarComponent,
        WindowToolbarContainerComponent,
        WindowSidebarComponent,
        ExternalWindowComponent,
        ExternalDialogWrapperComponent,
        ExternalDialogDirective,
    ],
    providers: [
        DuiExternalWindow,
    ],
    imports: [
    CommonModule,
    WindowContentComponent,
    WindowComponent,
    WindowFrameComponent,
    WindowFooterComponent,
    WindowHeaderComponent,
    WindowToolbarComponent,
    WindowToolbarContainerComponent,
    WindowSidebarComponent,
    ExternalWindowComponent,
    ExternalDialogWrapperComponent,
    ExternalDialogDirective,
]
})
export class DuiWindowModule {
    static forRoot(): ModuleWithProviders<DuiWindowModule> {
        return {
            ngModule: DuiWindowModule,
            providers: [WindowRegistry]
        }
    }
}
