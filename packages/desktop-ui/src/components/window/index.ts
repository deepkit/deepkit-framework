/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';

import { DuiCoreModule } from '../core';
import { DuiIconModule } from '../icon';
import { DuiSplitterModule } from '../splitter';
import { DuiExternalWindow } from './external-window';
import {
    ExternalDialogDirective,
    ExternalDialogWrapperComponent,
    ExternalWindowComponent,
} from './external-window.component';
import { WindowContentComponent } from './window-content.component';
import { WindowFooterComponent } from './window-footer.component';
import {
    WindowHeaderComponent,
    WindowToolbarComponent,
    WindowToolbarContainerComponent,
} from './window-header.component';
import { WindowSidebarComponent } from './window-sidebar.component';
import { WindowRegistry } from './window-state';
import { WindowComponent, WindowFrameComponent } from './window.component';

export * from './window.component';
export * from './external-window';
export * from './external-window.component';
export * from './window-content.component';
export * from './window-header.component';
export * from './window-footer.component';
export * from './window-menu';
export * from './window-sidebar.component';

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
    providers: [DuiExternalWindow],
    imports: [CommonModule, DuiSplitterModule, DuiIconModule, DuiCoreModule],
})
export class DuiWindowModule {
    static forRoot(): ModuleWithProviders<DuiWindowModule> {
        return {
            ngModule: DuiWindowModule,
            providers: [WindowRegistry],
        };
    }
}
