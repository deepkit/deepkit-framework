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
import { InputComponent } from './input.component';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { DuiIconModule } from '../icon';

export * from './input.component';

@NgModule({
    declarations: [
        InputComponent,
    ],
    exports: [
        InputComponent,
    ],
    providers: [
        DatePipe
    ],
    imports: [
        CommonModule,
        FormsModule,
        DuiIconModule,
    ]
})
export class DuiInputModule {

}
