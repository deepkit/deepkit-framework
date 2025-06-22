/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, HostListener, input } from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';

@Component({
    selector: 'dui-tab-button',
    template: `
        <ng-content></ng-content>
    `,
    host: {
        '[attr.tabindex]': '1',
        '[class.active]': 'isActive()',
    },
    styleUrls: ['./tab-button.component.scss'],
    providers: [ngValueAccessor(TabButtonComponent)]
})
export class TabButtonComponent extends ValueAccessorBase<any> {
    /**
     * Whether the button is active (pressed).
     *
     * Use alternatively form API, e.g. <dui-tab-button [(ngModel)]="chosen" value="overview"></dui-tab-button>
     */
    active = input(false, { transform: booleanAttribute });

    value = input<any>();

    @HostListener('click')
    onClick() {
        const value = this.value();
        if (value === undefined) return;
        this.innerValue = value;
    }

    isActive(): boolean {
        const value = this.value();
        if (value !== undefined) return value === this.innerValue;
        return this.active() !== false
    }
}
