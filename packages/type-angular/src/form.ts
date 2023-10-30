/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AbstractControl, FormArray, FormControl, FormControlOptions, FormControlState, FormGroup, ValidationErrors, ValidatorFn } from "@angular/forms";
import { ClassType, isClass, isFunction } from "@deepkit/core";
import {
    deserialize,
    getValidatorFunction,
    hasDefaultValue,
    isCustomTypeClass,
    isOptional,
    ReceiveType,
    ReflectionClass,
    ReflectionKind,
    ReflectionProperty,
    resolveReceiveType,
    serialize,
    Type,
    typeSettings,
    UnpopulatedCheck,
    validationAnnotation,
    ValidationErrorItem
} from "@deepkit/type";

type PropPath = string | (() => string);

function getLastProp(propPath?: PropPath): string {
    propPath = isFunction(propPath) ? propPath() : propPath;
    if (!propPath) return '';
    return propPath.split('.').pop() || '';
}

function getPropPath(propPath?: PropPath, append?: string | number): string {
    propPath = isFunction(propPath) ? propPath() : propPath;

    if (propPath && append !== undefined) {
        return propPath + '.' + append;
    }
    if (propPath) {
        return propPath;
    }
    if (append !== undefined) {
        return String(append);
    }
    return '';
}

function isRequired(type: Type) {
    const val = validationAnnotation.getFirst(type);
    if (val && val.name === 'minLength') {
        return true;
    }

    if (type.parent && (type.parent.kind === ReflectionKind.property || type.parent.kind === ReflectionKind.propertySignature)) {
        return !isOptional(type.parent) && !hasDefaultValue(type.parent);
    }
    return !isOptional(type);
}

function errorsToAngularErrors(errors: ValidationErrorItem[]): any {
    if (errors.length) {
        const res: ValidationErrors = {};

        for (const e of errors) {
            res[e.code] = e.message;
        }

        return res;
    }

    return null;
}

export class TypedFormControl2<T = any> extends FormControl {
    deepkitErrors?: ValidationErrorItem[];

    constructor(propPath: PropPath, public type: Type, value: FormControlState<T> | T, validatorOrOpts?: ValidatorFn | ValidatorFn[] | FormControlOptions | null) {
        super(value, validatorOrOpts);

        Object.defineProperty(this, 'value', {
            get: () => {
                if (this.parent) {
                    return this.parent.value ? this.parent.value[getLastProp(propPath)] : undefined;
                }
                return value;
            },
            set: (v: any) => {
                if (this.parent) {
                    if (this.parent.value) {
                        this.parent.value[getLastProp(propPath)] = v;
                    }
                }
                value = v;
            }
        });
    }

    isRequired() {
        return isRequired(this.type);
    }
}

type WithDeepkitErrors = { deepkitErrors?: ValidationErrorItem[] };

function createControl<T>(
    propPath: PropPath,
    propName: string,
    prop: Type,
    parent?: FormGroup | FormArray,
): AbstractControl {
    const type = prop.kind === ReflectionKind.property || prop.kind === ReflectionKind.propertySignature ? prop.type : prop;

    let control: AbstractControl & WithDeepkitErrors;

    const validator = (control: AbstractControl & WithDeepkitErrors): ValidationErrors | null => {
        const rootFormGroup = control.root as TypedFormGroup<any>;

        if (!rootFormGroup.value) {
            // not yet initialized
            return null;
        }

        let parent = control.parent;
        while (parent) {
            if (parent instanceof TypedFormGroup) {
                //null/undefined values are handled by the parent
                if (!parent.value) {
                    return null;
                }
            }
            parent = parent.parent;
        }

        const errors: ValidationErrorItem[] = [];

        if (prop && (prop.kind === ReflectionKind.property || prop.kind === ReflectionKind.propertySignature)) {
            if (!control.value) {
                if (!isRequired(prop)) {
                    return null;
                }
            }

            if (type.kind === ReflectionKind.class && isCustomTypeClass(type)) {
                return null; //handled in sub controls
            }
        }

        const fn = getValidatorFunction(undefined, prop);
        control.deepkitErrors = errors;
        (fn as any)(control.value, { errors }, getPropPath(propPath));
        return errorsToAngularErrors(errors);
    };

    // if (type.kind === ReflectionKind.array) {
    //     throw new Error('Array not supported yet');
    // } else {
    if (type.kind === ReflectionKind.class && isCustomTypeClass(type)) {
        control = TypedFormGroup.fromEntityClass(type, undefined, propPath);
    } else {
        control = new TypedFormControl2(propPath, prop, undefined, validator);
    }
    // }

    if (parent) {
        control.setParent(parent);
    }

    return control;
}

export class TypedFormGroup<T extends object, TRawValue extends T = T> extends FormGroup {
    public value!: T;

    protected reflection: ReflectionClass<any>;

    deepkitErrors?: ValidationErrorItem[];

    init(value?: T): this {
        const old = typeSettings.unpopulatedCheck;
        typeSettings.unpopulatedCheck = UnpopulatedCheck.None;
        try {
            this.reset(value);
            if (value) this.setValue(value);
            return this;
        } finally {
            typeSettings.unpopulatedCheck = old;
        }
    }

    _updateValue(): void {
        //angular forms works normally in the way that controls updates the value,
        //but we change that. The real values change controls.
    }

    getDeepkitErrors() {
        return this.getAllDeepkitErrors().map(v => v.path + ': ' + v.message).join(', ');
    }

    getAllDeepkitErrors() {
        //go through all controls and collect errors
        const errors: ValidationErrorItem[] = [];
        for (const control of Object.values(this.controls)) {
            if (control instanceof TypedFormGroup) {
                if (control.deepkitErrors) {
                    errors.push(...control.deepkitErrors);
                }
            } else if (control instanceof TypedFormControl2) {
                if (control.deepkitErrors) {
                    errors.push(...control.deepkitErrors);
                }
            }
        }
        return errors;
    }

    setValue(value: T, options: { onlySelf?: boolean; emitEvent?: boolean } = {}) {
        if (value) {
            const o: any = {};
            const set = (target: any, prop: ReflectionProperty, newValue: any, d?: PropertyDescriptor) => {
                if (d && d.set) {
                    d.set(newValue);
                } else {
                    o[prop.name] = newValue;
                }
                if (prop.type.kind === ReflectionKind.union) {
                    //figure out the type and see if it changed.
                    //if so, change the control if we need to (from object to array, or array to primitive, etc)
                }

                if (prop.isOptional() && newValue === undefined) {
                    //remove control
                    this.controls[prop.name].disable();
                } else {
                    this.controls[prop.name].enable();
                }
            };
            Object.assign(o, value);
            for (const prop of this.reflection.getProperties()) {
                const d = Object.getOwnPropertyDescriptor(value, prop.name);
                Object.defineProperty(value, prop.name, {
                    // configurable: false,
                    set: (newValue: any) => set(value, prop, newValue, d),
                    get: () => d?.get ? d.get() : (o as any)[prop.name],
                });
            }
            (this as any).value = value;
            Object.keys(value).forEach(name => {
                if (!this.controls[name]) return;
                const property = this.reflection.getProperty(name);

                if (property.isOptional() && (value as any)[name] === undefined) return;

                this.controls[name].setValue((value as any)[name], { onlySelf: true, emitEvent: options.emitEvent });
            });
        } else {
            (this as any).value = undefined;
        }
        this.updateValueAndValidity(options);
    }

    constructor(public type: Type, public path?: PropPath) {
        super({}, null);
        this.reflection = ReflectionClass.from(type);
        for (const prop of this.reflection.getProperties()) {
            this.registerControl(prop.name, createControl(() => getPropPath(path, prop.name), prop.name, prop.property, this));
        }
    }

    storeLocalStorage(key: string): this {
        this.valueChanges.subscribe(() => {
            const v = this.value;
            if (!v) return;
            localStorage.setItem(key, JSON.stringify(serialize(v, undefined, undefined, undefined, this.type)));
        });

        const ch = localStorage.getItem(key);
        if (ch) {
            this.markAsDirty();
            const loaded: any = deserialize(JSON.parse(ch), undefined, undefined, undefined, this.type);
            this.setValue(loaded);
        }
        return this;
    }

    static fromEntityClass<T extends object>(
        type?: ClassType<T> | Type | ReceiveType<T>,
        value?: T,
        path?: PropPath,
    ): TypedFormGroup<T> {
        type = isClass(type) ? ReflectionClass.from(type).type : resolveReceiveType(type);
        return new TypedFormGroup<T>(type, path).init(value);
    }
}
