import { Directive, forwardRef, HostBinding, Injector, Input, OnDestroy, Type, input, model, inject, effect } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { FormComponent } from '../components/form/form.component';

export function ngValueAccessor<T>(clazz: Type<T>) {
    return {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => clazz),
        multi: true
    };
}

@Directive()
export class ValueAccessorBase<T> implements ControlValueAccessor, OnDestroy {
    private _ngControl?: NgControl;
    private _ngControlFetched = false;

    value = model<T | undefined>();

    disabled = model<boolean | '' | undefined>(undefined);

    @Input() valid?: boolean;
    @Input() error?: boolean;

    protected formComponent?: FormComponent;
    readonly _changedCallback: ((value: T | undefined) => void)[] = [];
    readonly _touchedCallback: (() => void)[] = [];

    @HostBinding('class.disabled')
    get isDisabled(): boolean {
        if (this.formComponent && this.formComponent.disabled()) return true;

        if (undefined === this.disabled && this.ngControl) {
            return !!this.ngControl.disabled;
        }

        return this.disabled() !== false && this.disabled() !== undefined;
    }

    @HostBinding('class.valid')
    get isValid() {
        return this.valid === true;
    }

    @HostBinding('class.error')
    get isError() {
        if (undefined === this.error && this.ngControl) {
            return (this.ngControl.dirty || this.ngControl.touched) && this.ngControl.invalid;
        }

        return this.error;
    }

    @HostBinding('class.required')
    required = input(false);

    protected injector = inject(Injector);

    constructor() {
        effect(() => {
            const value = this.value();
            for (const callback of this._changedCallback) {
                callback(value);
            }
        });
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

    setDisabledState(isDisabled: boolean): void {
        this.disabled.set(isDisabled);
    }

    ngOnDestroy(): void {
    }

    /**
     * Internal note: This method is called from outside. Either from Angular's form or other users.
     */
    writeValue(value?: T) {
        this.value.set(value);
    }

    /**
     * Call this method to signal Angular's form or other users that this widget has been touched.
     */
    touch() {
        for (const callback of this._touchedCallback) {
            callback();
        }
    }

    registerOnChange(fn: (value: T | undefined) => void) {
        this._changedCallback.push(fn);
    }

    registerOnTouched(fn: () => void) {
        this._touchedCallback.push(fn);
    }
}
