/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    HostBinding,
    HostListener,
    Injector,
    SkipSelf
} from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';

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
})
export class CheckboxComponent extends ValueAccessorBase<any>  {
    @HostBinding('tabindex')
    get tabIndex() {
        return 1;
    }

    @HostBinding('class.checked')
    get isChecked() {
        return true === this.innerValue;
    }

    @HostListener('click')
    public onClick() {
        if (this.isDisabled) return;

        this.touch();
        this.innerValue = !this.innerValue;
    }

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
    ) {
        super(injector, cd, cdParent);
    }

}
