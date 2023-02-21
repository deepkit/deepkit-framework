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
import { WindowContentComponent } from './window-content.component.js';
import { WindowComponent, WindowFrameComponent } from './window.component.js';
import { WindowFooterComponent } from './window-footer.component.js';
import {
    WindowHeaderComponent,
    WindowToolbarComponent,
    WindowToolbarContainerComponent
} from './window-header.component.js';
import { CommonModule } from '@angular/common';
import { WindowSidebarComponent } from './window-sidebar.component.js';
import { DuiSplitterModule } from '../splitter.js';
import { DuiIconModule } from '../icon.js';
import { WindowRegistry } from './window-state.js';

import {
    ExternalDialogDirective,
    ExternalDialogWrapperComponent,
    ExternalWindowComponent
} from './external-window.component.js';
import { DuiExternalWindow } from './external-window.js';
import { DuiCoreModule } from '../core.js';

export * from "./window.component.js";
export * from "./external-window.js";
export * from "./external-window.component.js";
export * from "./window-content.component.js";
export * from "./window-header.component.js";
export * from "./window-footer.component.js";
export * from "./window-menu.js";
export * from "./window-sidebar.component.js";

@NgModule({
    declarations: [
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
    entryComponents: [
        ExternalWindowComponent,
    ],
    providers: [
        DuiExternalWindow,
    ],
    imports: [
        CommonModule,
        DuiSplitterModule,
        DuiIconModule,
        DuiCoreModule,
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
