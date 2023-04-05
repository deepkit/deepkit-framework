/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
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
    @Input() active: boolean | '' = false;

    @Input() value?: any;

    @Input() model?: any;
    @Output() modelChange = new EventEmitter<any>();

    @HostListener('click')
    onClick() {
        if (this.value === undefined) return;
        this.model = this.value;
        this.modelChange.emit(this.value);
    }

    isActive(): boolean {
        if (this.value !== undefined) return this.value === this.innerValue || this.value === this.model;
        return this.active !== false
    }
}
