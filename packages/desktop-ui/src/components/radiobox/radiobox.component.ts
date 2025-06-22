/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, HostBinding, HostListener, inject, input } from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';

@Component({
    selector: 'dui-radio-group',
    providers: [ngValueAccessor(RadioGroupComponent)],
    template: `
      <ng-content></ng-content>`,
})
export class RadioGroupComponent extends ValueAccessorBase<any> {
}

@Component({
    selector: 'dui-radio-button',
    template: `
      <span class="box"><div class="circle"></div></span>
      <ng-content></ng-content>
    `,
    styleUrls: ['./radiobox.component.scss'],
})
export class RadioButtonComponent {
    value = input<any>();

    group = inject(RadioGroupComponent);

    @HostBinding('tabindex')
    get tabIndex() {
        return 1;
    }

    @HostBinding('class.checked')
    get isChecked() {
        return this.value() === this.group.value();
    }

    @HostListener('click')
    public onClick() {
        if (this.group.isDisabled) return;

        this.group.writeValue(this.value());
        this.group.touch();
    }
}
