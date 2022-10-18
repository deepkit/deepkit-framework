/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { NgModule } from '@angular/core';
import { DuiWindowModule } from '../window/index.js';
import {
    CloseDialogDirective,
    DialogActionsComponent,
    DialogComponent,
    DialogDirective,
    DialogErrorComponent,
    DialogWrapperComponent, OpenDialogDirective,
} from './dialog.component.js';
import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { DuiDialog, DuiDialogAlert, DuiDialogConfirm, DuiDialogConfirmDirective, DuiDialogPrompt } from './dialog.js';
import { DuiButtonModule } from '../button/index.js';
import { DuiCoreModule } from '../core/index.js';
import { DuiInputModule } from '../input/index.js';
import { FormsModule } from '@angular/forms';
import { DuiDialogProgress } from './progress-dialog.component.js';

export * from "./dialog.component.js";
export * from "./dialog.js";
export * from "./progress-dialog.component.js";

@NgModule({
    declarations: [
        DialogComponent,
        DialogDirective,
        DialogActionsComponent,
        CloseDialogDirective,
        DuiDialogConfirmDirective,
        DuiDialogAlert,
        DuiDialogConfirm,
        DuiDialogPrompt,
        DuiDialogProgress,
        DialogWrapperComponent,
        DialogErrorComponent,
        OpenDialogDirective,
    ],
    exports: [
        DialogDirective,
        DialogComponent,
        DialogActionsComponent,
        CloseDialogDirective,
        DuiDialogConfirmDirective,
        DuiDialogAlert,
        DuiDialogConfirm,
        DuiDialogPrompt,
        DuiDialogProgress,
        DialogErrorComponent,
        OpenDialogDirective,
    ],
    entryComponents: [
        DialogComponent,
        DuiDialogAlert,
        DuiDialogConfirm,
        DuiDialogPrompt,
        DialogWrapperComponent,
    ],
    providers: [
        DuiDialog,
    ],
    imports: [
        FormsModule,
        CommonModule,
        OverlayModule,
        DuiWindowModule,
        DuiButtonModule,
        DuiCoreModule,
        DuiInputModule,
    ]
})
export class DuiDialogModule {

}
