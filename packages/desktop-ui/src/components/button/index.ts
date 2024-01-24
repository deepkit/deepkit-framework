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
import { FormsModule } from '@angular/forms';

import { DuiIconModule } from '../icon';
import {
    ButtonComponent,
    ButtonGroupComponent,
    ButtonGroupsComponent,
    ButtonHotkeyComponent,
    FileChooserDirective,
    FileDropDirective,
    FilePickerDirective,
    HotkeyDirective,
} from './button.component';
import {
    ContextDropdownDirective,
    DropdownComponent,
    DropdownContainerDirective,
    DropdownItemComponent,
    DropdownSplitterComponent,
    OpenDropdownDirective,
    OpenDropdownHoverDirective,
} from './dropdown.component';
import { TabButtonComponent } from './tab-button.component';

export * from './dropdown.component';
export * from './button.component';
export * from './tab-button.component';

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
        HotkeyDirective,
        ButtonHotkeyComponent,
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
        HotkeyDirective,
        ButtonHotkeyComponent,
    ],
    imports: [CommonModule, FormsModule, DuiIconModule],
})
export class DuiButtonModule {}
