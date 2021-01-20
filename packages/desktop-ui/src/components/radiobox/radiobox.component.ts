/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectorRef, Component, HostBinding, HostListener, Injector, Input, SkipSelf } from "@angular/core";
import { ngValueAccessor, ValueAccessorBase } from "../../core/form";

@Component({
    selector: 'dui-radiobox',
    template: `
        <span class="box"><div class="circle"></div></span>
        <ng-content></ng-content>
    `,
    styleUrls: ['./radiobox.component.scss'],
    providers: [ngValueAccessor(RadioboxComponent)]
})
export class RadioboxComponent<T> extends ValueAccessorBase<T> {
    @Input() value?: T;

    @HostBinding('tabindex')
    get tabIndex() {
        return 1;
    }

    @HostBinding('class.checked')
    get isChecked() {
        return this.value === this.innerValue;
    }

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
    ) {
        super(injector, cd, cdParent);
    }

    @HostListener('click')
    public onClick() {
        if (this.isDisabled) return;

        this.innerValue = this.value;
        this.touch();
    }
}
