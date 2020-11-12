/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {ClassType, isFunction, isObject} from '@deepkit/core';
import {Subscription} from 'rxjs';
import {AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn} from '@angular/forms';
import {getClassSchema, handleCustomValidator, jitValidateProperty, PropertySchema, PropertyValidator, PropertyValidatorError, ValidationFailedItem} from '@deepkit/type';

export function requiredIfValidator(predicate: () => boolean, validator: ValidatorFn) {
    return (formControl: AbstractControl) => {
        if (!formControl.parent) {
            return null;
        }
        if (predicate()) {
            return validator(formControl);
        }
        return null;
    };
}

type PropPath = string | (() => string);

function getPropPath(propPath?: PropPath, append?: string | number): string {
    propPath = isFunction(propPath) ? propPath() : propPath;

    if (propPath && append !== undefined) return propPath + '.' + append;
    if (propPath) return propPath;
    if (append !== undefined) return String(append);
    return '';
}

function createControl<T>(
    propPath: PropPath,
    prop: PropertySchema,
    parent?: FormGroup | FormArray,
    conditionalValidators: TypedFormGroupConditionalValidators<any, any> = {},
    limitControls: LimitControls<T> = {}
): AbstractControl {
    const validator = (control: AbstractControl): ValidationErrors | null => {
        const rootFormGroup = control.root as TypedFormGroup<any>;

        if (!rootFormGroup.value) {
            //not yet initialized
            return null;
        }

        function errorsToAngularErrors(errors: ValidationFailedItem[]) {
            if (errors.length) {
                const res: ValidationErrors = {};

                for (const e of errors) {
                    res[e.code] = e.message;
                }

                return res;
            }

            return null;
        }

        const errors: ValidationFailedItem[] = [];
        const val = conditionalValidators[prop.name];
        if (isConditionalValidatorFn(val)) {
            const res = val(rootFormGroup.value, control.parent.value);
            if (res) {
                const validators: ValidatorType[] = Array.isArray(res) ? res : [res];
                for (const val of validators) {
                    handleCustomValidator(prop, new class implements PropertyValidator {
                        validate<T>(value: any): PropertyValidatorError | void {
                            return val(value);
                        }
                    }, control.value, getPropPath(propPath), errors);
                    if (errors.length) {
                        return errorsToAngularErrors(errors);
                    }
                }
            }
        }

        jitValidateProperty(prop)(control.value, getPropPath(propPath), errors);
        return errorsToAngularErrors(errors);
    };

    let control: AbstractControl;

    const t = prop.name ? conditionalValidators[prop.name] : conditionalValidators;
    const conditionalValidatorsForProp = isConditionalValidatorFn(t) ? {} : t;
    if (prop.isArray) {
        control = new TypedFormArray(propPath, prop.getSubType(), limitControls, conditionalValidatorsForProp);
    } else if (prop.isMap) {
        throw new Error('Map not supported');
    } else {
        if (prop.type === 'class') {
            control = TypedFormGroup.fromEntityClass(prop.getResolvedClassType(), limitControls, undefined, conditionalValidatorsForProp, propPath);
        } else {
            control = new FormControl(undefined, validator);
        }
    }

    if (parent && conditionalValidators[prop.name]) {
        parent.root.valueChanges.subscribe((v) => {
            //todo: rework to apply validity status sync. find our why here is a race condition.
            setTimeout(() => {
                control.updateValueAndValidity({emitEvent: false});
            });
        });
    }

    if (parent) {
        control.setParent(parent);
    }

    return control;
}

type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
type ValidatorType = ((value: any) => PropertyValidatorError | void);

type ConditionalValidatorFn<RT, PT> = (rootValue: RT, parentValue: PT) => ValidatorType | ValidatorType[] | void | undefined;

function isConditionalValidatorFn(obj: any): obj is ConditionalValidatorFn<any, any> {
    return isFunction(obj);
}

function isTypedFormGroupConditionalValidators(obj: any): obj is TypedFormGroupConditionalValidators<any, any> {
    return isObject(obj);
}

type TypedFormGroupConditionalValidators<RT, T> = {
    [P in keyof T & string]?: ConditionalValidatorFn<RT, T> | (FlattenIfArray<T[P]> extends object ? TypedFormGroupConditionalValidators<RT, FlattenIfArray<T[P]>> : undefined);
}

interface TypedAbstractControl<T> extends AbstractControl {
    value: T;
}

type TypedControl<T> = T extends Array<any> ? TypedFormArray<FlattenIfArray<T>> : (T extends object ? TypedFormGroup<T> : TypedAbstractControl<T>);
type Controls<T> = { [P in keyof T & string]: TypedControl<T[P]> };

type LimitControls<T> = {
    [P in keyof T & string]?: 1 | (FlattenIfArray<T[P]> extends object ? LimitControls<FlattenIfArray<T[P]>> : 1)
};

export class TypedFormArray<T> extends FormArray {
    _value: T[] = [];

    constructor(
        private propPath: PropPath,
        private prop: PropertySchema,
        private limitControls: LimitControls<T> = {},
        private conditionalValidators: TypedFormGroupConditionalValidators<any, any> = {}
    ) {
        super([], []);
    }

    get typedControls(): TypedControl<T>[] {
        return this.controls as any;
    }

    protected createControl(value?: T) {
        const prop = this.prop.clone();
        let control: AbstractControl;
        control = createControl(() => getPropPath(this.propPath, this.controls.indexOf(control)), prop, this, this.conditionalValidators, this.limitControls);
        (control.value as any) = value;
        return control;
    }

    addItem(item: T) {
        this.push(this.createControl(item));
    }

    // @ts-ignore
    get value(): T[] {
        return this._value;
    }

    setRefValue(v: T[]) {
        this._value = v;
        this.setValue(v);
    }

    set value(v: T[]) {
        if (this._value) {
            this._value.splice(0, this._value.length);
            this._value.push(...v);
        } else {
            this._value = v;
        }
    }

    removeItem(item: T) {
        const index = this.value.indexOf(item);
        if (index !== -1) {
            this.controls.splice(index, 1);
            this.value.splice(index, 1);
        }
    }

    removeItemAtIndex(item: T, index: number) {
        if (index !== -1 && this.controls[index]) {
            this.controls.splice(index, 1);
            this.value.splice(index, 1);
        }
    }

    push(control?: AbstractControl) {
        super.push(control || this.createControl());
    }

    setValue(value: any[], options?: { onlySelf?: boolean; emitEvent?: boolean }) {
        //note: this.push modifies the ref `value`, so we need to (shallow) copy the
        // array (not the content) and reassign the content (by not changing the
        // array ref) later.
        const copy = value.slice(0);
        this.clear();
        for (const item of copy) {
            this.push(this.createControl(item));
        }

        //here the value is empty, but we make sure to remove any content,
        // and reassign from our copied array.
        value.splice(0, value.length, ...copy);
        super.setValue(value, options);
    }

    printDeepErrors(path?: string) {
        for (const control of this.controls) {
            if (control instanceof TypedFormGroup || control instanceof TypedFormArray) {
                control.printDeepErrors(getPropPath(path, this.controls.indexOf(control)));
            } else if (control.invalid) {
                console.log('invalid', getPropPath(path, this.controls.indexOf(control)), control.errors, control.value, control.status, control.value, control);
            }
        }
    }
}

export class TypedFormGroup<T extends object> extends FormGroup {
    public classType?: ClassType<T>;
    public typedValue?: T;
    protected lastSyncSub?: Subscription;

    get typedControls(): Controls<T> {
        return this.controls as any;
    }

    // @ts-ignore
    get value(): T {
        return this.typedValue!;
    }

    set value(v: T) {
        if (this.classType && v instanceof this.classType) {
            if (!this.typedValue || this.typedValue !== v) {
                //is needed since angular wont set `this.value` to `value`, but it simply iterates.
                //we need however the actual reference.
                this.typedValue = v;
            }

            if (this.lastSyncSub) {
                this.lastSyncSub.unsubscribe();
            }

            for (const [name, control] of Object.entries(this.controls)) {
                // const control = this.controls[i as keyof T & string];
                if (control instanceof TypedFormArray) {
                    control.setRefValue((v as any)[name]);
                } else {
                    control.setValue((v as any)[name]);
                }
            }

            //this comes after `setValue` so we don't get old values
            this.lastSyncSub = this.valueChanges.subscribe(() => {
                this.updateEntity(v);
                this.updateValueAndValidity({emitEvent: false});
            });
            this.updateValueAndValidity();
        } else {
            //angular tries to set via _updateValue() `this.value` again using `{}`, which we simply ignore.
            //except when its resetted
            if (v === undefined) {
                this.typedValue = undefined;
                this.updateValueAndValidity();
            }
        }
    }

    static fromEntityClass<T extends object>(
        classType: ClassType<T>,
        limitControls: LimitControls<T> = {},
        validation?: (control: TypedFormGroup<T>) => ValidationErrors | null,
        conditionalValidators: TypedFormGroupConditionalValidators<T, T> = {},
        path?: PropPath
    ): TypedFormGroup<T> {
        const entitySchema = getClassSchema(classType);

        const t = new TypedFormGroup<T>({}, validation as ValidatorFn);
        t.classType = classType;
        const validNames = Object.keys(limitControls);

        for (const [name, prop] of entitySchema.getClassProperties().entries()) {

            if (validNames.length && !validNames.includes(name as keyof T & string)) {
                continue;
            }

            const limitControlsForProp = limitControls[name as keyof T & string] === 1 ? {} : limitControls[name as keyof T & string];
            t.registerControl(name, createControl(() => getPropPath(path, name), prop, t, conditionalValidators, limitControlsForProp));
        }
        return t;
    }

    updateValueAndValidity(opts?: { onlySelf?: boolean; emitEvent?: boolean }): void {
        super.updateValueAndValidity(opts);

        if (this.validator && !this.value && !this.disabled) {
            //we have no valid, so our validator decides whether its valid or not
            (this.status as any) = this.validator(this) ? 'INVALID' : 'VALID';
        }
    }

    reset(value?: any, options?: { onlySelf?: boolean; emitEvent?: boolean }): void {
        if (value && this.classType && value instanceof this.classType) {
            this.syncEntity(value);
        }

        super.reset(value, options);
    }

    setValue(value: { [p: string]: any }, options?: { onlySelf?: boolean; emitEvent?: boolean }): void {
        this.value = value as any;
        // super.setValue(value, options);
    }

    getControls(): Controls<any> {
        return this.controls as Controls<any>;
    }

    printDeepErrors(path?: string) {
        for (const [name, control] of Object.entries(this.controls)) {
            if (control instanceof TypedFormGroup || control instanceof TypedFormArray) {
                control.printDeepErrors(getPropPath(path, name));
            } else if (control.invalid) {
                console.log('invalid', getPropPath(path, name), control.errors, control.value, control.status, control.value, control);
            }
        }
    }

    /**
     * Sets the current form values from the given entity and syncs changes automatically back to the entity.
     */
    public syncEntity(entity: T) {
        this.value = entity;
    }

    /**
     * Saves the current values from this form into the given entity.
     */
    public updateEntity(entity: T) {
        for (const [name, c] of Object.entries(this.controls)) {
            if (c.touched || c.dirty) {
                if (c instanceof TypedFormGroup) {
                    if ((entity as any)[name]) {
                        c.updateEntity((entity as any)[name]);
                    }
                } else {
                    (entity as any)[name] = c.value;
                }
            }
        }
    }
}
