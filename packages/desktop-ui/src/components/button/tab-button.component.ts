/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, Input } from "@angular/core";

@Component({
    selector: 'dui-tab-button',
    template: `
        <ng-content></ng-content>
    `,
    host: {
        '[attr.tabindex]': '1',
        '[class.active]': 'active !== false',
    },
    styleUrls: ['./tab-button.component.scss']
})
export class TabButtonComponent {
    /**
     * Whether the button is active (pressed)
     */
    @Input() active: boolean | '' = false;
}
