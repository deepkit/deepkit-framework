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
import { ButtonComponent, ButtonGroupComponent, ButtonGroupsComponent, FileChooserDirective, FileDropDirective, FilePickerDirective } from './button.component.js';
import { CommonModule } from '@angular/common';
import { DuiIconModule } from '../icon.js';
import {
    ContextDropdownDirective,
    DropdownComponent,
    DropdownContainerDirective,
    DropdownItemComponent,
    DropdownSplitterComponent,
    OpenDropdownDirective,
    OpenDropdownHoverDirective,
} from './dropdown.component.js';
import { FormsModule } from '@angular/forms';
import { TabButtonComponent } from './tab-button.component.js';

export * from "./dropdown.component.js";
export * from './button.component.js'
export * from './tab-button.component.js'

@NgModule({
    declarations: [
        ButtonComponent,
        ButtonGroupComponent,
        ButtonGroupsComponent,
        DropdownComponent,
        DropdownItemComponent,
        DropdownSplitterComponent,
        DropdownContainerDirective,
        OpenDropdownDirective,
        OpenDropdownHoverDirective,
        ContextDropdownDirective,
        FileChooserDirective,
        TabButtonComponent,
        FilePickerDirective,
        FileDropDirective,
    ],
    exports: [
        ButtonComponent,
        ButtonGroupComponent,
        ButtonGroupsComponent,
        DropdownComponent,
        DropdownItemComponent,
        DropdownSplitterComponent,
        DropdownContainerDirective,
        OpenDropdownDirective,
        OpenDropdownHoverDirective,
        ContextDropdownDirective,
        FileChooserDirective,
        TabButtonComponent,
        FilePickerDirective,
        FileDropDirective,
    ],
    imports: [
        CommonModule,
        FormsModule,
        DuiIconModule,
    ]
})
export class DuiButtonModule {

}
