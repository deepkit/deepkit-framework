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
import { DuiWindowModule } from '../window';
import {
    CloseDialogDirective,
    DialogActionsComponent,
    DialogComponent,
    DialogDirective,
    DialogErrorComponent,
    DialogWrapperComponent, OpenDialogDirective,
} from './dialog.component';
import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { DuiDialog, DuiDialogAlert, DuiDialogConfirm, DuiDialogConfirmDirective, DuiDialogPrompt } from './dialog';
import { DuiButtonModule } from '../button';
import { DuiCoreModule } from '../core';
import { DuiInputModule } from '../input';
import { FormsModule } from '@angular/forms';
import { DuiDialogProgress } from './progress-dialog.component';

export * from "./dialog.component";
export * from "./dialog";
export * from "./progress-dialog.component";

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
