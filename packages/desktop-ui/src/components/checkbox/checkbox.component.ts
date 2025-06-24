/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectionStrategy, Component, HostBinding, HostListener } from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { IconComponent } from '../icon/icon.component';

/**
 * Checkbox component to toggle boolean values.
 *
 * ```html
 * <dui-checkbox [(ngModel)]="myValue">Check me!</dui-checkbox>
 * ```
 */
@Component({
    selector: 'dui-checkbox',
    template: `
      <span class="box">
        <dui-icon [size]="12" name="check"></dui-icon>
      </span>
      <ng-content></ng-content>
    `,
    styleUrls: ['./checkbox.component.scss'],
    providers: [ngValueAccessor(CheckboxComponent)],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    host: {
        '[class.dui-normalized]': 'true',
    },
})
export class CheckboxComponent extends ValueAccessorBase<boolean> {
    @HostBinding('tabindex')
    protected get tabIndex() {
        return 1;
    }

    @HostBinding('class.checked')
    protected get isChecked() {
        return true === this.value();
    }

    @HostListener('click')
    protected onClick() {
        if (this.isDisabled) return;

        this.touch();
        this.value.update(v => !v);
    }

    constructor() {
        super();
        this.value.set(false);
    }
}
