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
import { EmojiDropdownComponent, EmojiDropdownDirective } from './emoji-dropdown.component.js';
import { DuiInputModule } from '../input/index.js';
import { DuiButtonModule } from '../button/index.js';
import { EmojiComponent } from './emoji.component.js';

export { EmojiComponent } from "./emoji.component.js";

export { EmojiDropdownComponent, EmojiDropdownDirective } from './emoji-dropdown.component.js';

@NgModule({
    declarations: [
        EmojiDropdownComponent,
        EmojiDropdownDirective,
        EmojiComponent,
    ],
    exports: [
        EmojiDropdownComponent,
        EmojiDropdownDirective,
        EmojiComponent,
    ],
    entryComponents: [
        EmojiDropdownComponent,
    ],
    imports: [
        FormsModule,
        CommonModule,
        DuiInputModule,
        DuiButtonModule,
    ]
})
export class DuiEmojiModule {

}
