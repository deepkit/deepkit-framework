/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, HostBinding, OnChanges, OnInit, input, booleanAttribute } from '@angular/core';

@Component({
    selector: 'dui-icon',
    template: `{{name()}}`,
    host: {
        '[class.ui-icon]': 'true',
        '[style.fontSize.px]': 'usedSize',
        '[style.height.px]': 'usedSize',
        '[style.width.px]': 'usedSize',
        '[style.color]': 'color()',
    },
    styleUrls: ['./icon.component.scss']
})
export class IconComponent implements OnInit, OnChanges {
    /**
     * The icon for this button. Either a icon name same as for dui-icon, or an image path.
     */
    name = input<string>();

    /**
     * Change in the icon size. Should not be necessary usually.
     */
    size = input<number>();

    clickable = input(false, { transform: booleanAttribute });

    color = input<string>();

    public usedSize = 17;

    @HostBinding('class.clickable')
    get isClickable() {
        return false !== this.clickable();
    }

    disabled = input<boolean>(false);
    @HostBinding('class.disabled')
    get isDisabled() {
        return false !== this.disabled();
    }

    constructor() {
    }

    ngOnChanges(): void {
        const size = this.size();
        if (size) {
            this.usedSize = size;
        }

        const name = this.name();
        if (!size && name) {
            const pos = name.indexOf('_');
            if (pos !== -1) {
                const potentialNumber = parseInt(name.slice(0, pos), 10);
                if (potentialNumber) {
                    this.usedSize = potentialNumber;
                }
            }
        }
    }

    ngOnInit() {
    }
}
