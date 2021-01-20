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

import { SplitterComponent } from './splitter.component';

export * from './splitter.component';

@NgModule({
    imports: [],
    exports: [SplitterComponent],
    declarations: [SplitterComponent],
    providers: [],
})
export class DuiSplitterModule {
}
