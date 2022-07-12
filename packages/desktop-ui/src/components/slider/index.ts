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
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DuiIconModule } from '../icon/index.js';
import { DuiButtonModule } from '../button/index.js';
import { SliderComponent } from './slider.component.js';

export * from './slider.component.js';

@NgModule({
    declarations: [
        SliderComponent,
    ],
    exports: [
        SliderComponent,
    ],
    imports: [
        FormsModule,
        CommonModule,
        DuiIconModule,
        DuiButtonModule,
    ]
})
export class DuiSliderModule {

}
