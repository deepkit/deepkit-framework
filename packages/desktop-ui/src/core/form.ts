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
    ChangeDetectorRef,
    Directive,
    EventEmitter,
    forwardRef,
    HostBinding,
    Inject,
    Injector,
    Input,
    OnDestroy,
    Output,
    SkipSelf,
    Type
} from "@angular/core";
import { ControlValueAccessor, NgControl, NG_VALUE_ACCESSOR } from "@angular/forms";
import { detectChangesNextFrame } from "../components/app/utils";
import { FormComponent } from "../components/form/form.component";

export function ngValueAccessor<T>(clazz: Type<T>) {
    return {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => clazz),
        multi: true
    };
}

/**
 * If you sub class this class and have own constructor or property initialization you need
 * to provide the dependencies of this class manually.
 *
 *
 constructor(
 protected injector: Injector,
 protected cd: ChangeDetectorRef,
 @SkipSelf() protected cdParent: ChangeDetectorRef,
 ) {
        super(injector, cd, cdParent);
    }
 *
 */
@Directive()
export class ValueAccessorBase<T> implements ControlValueAccessor, OnDestroy {
    /**
     * @hidden
     */
    private _innerValue: T | undefined;

    /**
     * @hidden
     */
    public readonly _changedCallback: ((value: T | undefined) => void)[] = [];

    /**
     * @hidden
     */
    public readonly _touchedCallback: (() => void)[] = [];

    private _ngControl?: NgControl;
    private _ngControlFetched = false;

    @Input() disabled?: boolean | '';

    @HostBinding('class.disabled')
    get isDisabled(): boolean {
        if (this.formComponent && this.formComponent.disabled) return true;

        if (undefined === this.disabled && this.ngControl) {
            return !!this.ngControl.disabled;
        }

        return this.disabled !== false && this.disabled !== undefined;
    }

    @Input() valid?: boolean;

    @HostBinding('class.valid')
    get isValid() {
        return this.valid === true;
    }

    @Input() error?: boolean;

    @HostBinding('class.error')
    get isError() {
        if (undefined === this.error && this.ngControl) {
            return (this.ngControl.dirty || this.ngControl.touched) && this.ngControl.invalid;
        }

        return this.error;
    }

    @HostBinding('class.required')
    @Input()
    required: boolean | '' = false;

    @Output()
    public readonly change = new EventEmitter<T>();

    protected formComponent?: FormComponent;

    constructor(
        @Inject(Injector) protected readonly injector: Injector,
        @Inject(ChangeDetectorRef) public readonly cd: ChangeDetectorRef,
        @Inject(ChangeDetectorRef) @SkipSelf() public readonly cdParent: ChangeDetectorRef,
    ) {
        try {
            this.formComponent = injector.get(FormComponent, undefined);
        } catch (e) {
        }

    }

    get ngControl(): NgControl | undefined {
        if (!this._ngControlFetched) {
            try {
                this._ngControl = this.injector.get(NgControl);
            } catch (e) {
            }
            this._ngControlFetched = true;
        }

        return this._ngControl;
    }

    /**
     * @hidden
     */
    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    /**
     * @hidden
     */
    ngOnDestroy(): void {
    }

    /**
     * @hidden
     */
    get innerValue(): T | undefined {
        return this._innerValue;
    }

    /**
     * Sets the internal value and signals Angular's form and other users (that subscribed via registerOnChange())
     * that a change happened.
     *
     * @hidden
     */
    set innerValue(value: T | undefined) {
        if (this._innerValue !== value) {
            this._innerValue = value;
            for (const callback of this._changedCallback) {
                callback(value);
            }
            this.onInnerValueChange().then(() => {
                detectChangesNextFrame(this.cd);
            });
            this.change.emit(value);
            detectChangesNextFrame(this.cd);
        }
    }

    /**
     * Internal note: This method is called from outside. Either from Angular's form or other users.
     *
     * @hidden
     */
    async writeValue(value?: T) {
        if (this._innerValue !== value) {
            this._innerValue = value;
        }
        detectChangesNextFrame(this.cd);
    }

    /**
     * This method can be overwritten to get easily notified when innerValue has been changed, either
     * by outside or inside.
     *
     * @hidden
     */
    async onInnerValueChange() {

    }

    /**
     * Call this method to signal Angular's form or other users that this widget has been touched.
     * @hidden
     */
    touch() {
        for (const callback of this._touchedCallback) {
            callback();
        }
    }

    /**
     * @hidden
     */
    registerOnChange(fn: (value: T | undefined) => void) {
        this._changedCallback.push(fn);
    }

    /**
     * @hidden
     */
    registerOnTouched(fn: () => void) {
        this._touchedCallback.push(fn);
    }
}
