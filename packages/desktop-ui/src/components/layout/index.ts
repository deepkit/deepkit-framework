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
import { LabelComponent, LabelGridComponent } from './label.component';
import { SectionHeaderComponent } from './section-header.component';

@NgModule({
    imports: [],
    exports: [
        LabelComponent,
        LabelGridComponent,
        SectionHeaderComponent,
    ],
    declarations: [
        LabelComponent,
        LabelGridComponent,
        SectionHeaderComponent,
    ],
    providers: [],
})
export class DuiLayoutModule {
}
