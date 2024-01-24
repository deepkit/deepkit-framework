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
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { FormComponent, FormRowComponent } from './form.component';

export * from './form.component';

@NgModule({
    declarations: [FormComponent, FormRowComponent],
    exports: [FormComponent, FormRowComponent],
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class DuiFormComponent {}
