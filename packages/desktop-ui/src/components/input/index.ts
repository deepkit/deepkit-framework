/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { CommonModule, DatePipe } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DuiIconModule } from '../icon';
import { InputComponent } from './input.component';

export * from './input.component';

@NgModule({
    declarations: [InputComponent],
    exports: [InputComponent],
    providers: [DatePipe],
    imports: [CommonModule, FormsModule, DuiIconModule],
})
export class DuiInputModule {}
