/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { NgModule } from "@angular/core";
import { RenderComponentDirective } from "./render-component.directive";

export * from './render-component.directive'

@NgModule({
    declarations: [
        RenderComponentDirective,
    ],
    exports: [
        RenderComponentDirective,
    ],
    providers: [],
    imports: [
    ]
})
export class DuiCoreModule {

}
