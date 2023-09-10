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
import { RadioboxComponent } from './radiobox.component';

export * from './radiobox.component';

@NgModule({
    declarations: [
        RadioboxComponent
    ],
    exports: [
        RadioboxComponent
    ]
})
export class DuiRadioboxModule {

}
