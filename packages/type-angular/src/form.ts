
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

export interface TypedFormGroupConditionalValidators<T> {
    [path: string]: (value: T) => ValidatorFn | ValidatorFn[] | void;
}

export class TypedFormGroup<T> extends FormGroup {
    public classType?: ClassType<T>;
    public typedValue?: T;
    protected lastSyncSub?: Subscription;

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

            for (const [i, fieldValue] of eachPair(v as any)) {
                if (this.controls[i]) {
                    this.controls[i].setValue(fieldValue);
                }
            }

            //this comes after `setValue` so we don't get old values
            this.lastSyncSub = this.valueChanges.subscribe(() => {
                this.updateEntity(v);
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

    static fromEntityClass<T>(
        classType: ClassType<T>,
        validation?: (control: TypedFormGroup<T>) => ValidationErrors | null,
        conditionalValidators?: TypedFormGroupConditionalValidators<T>,
        path?: string,
    ): TypedFormGroup<T> {
        const controls: { [name: string]: AbstractControl | TypedFormGroup<any> } = {};

        const entitySchema = getClassSchema(classType);

        for (const [name, prop] of entitySchema.classProperties.entries()) {
            const propPath = path ? path + '.' + name : name;

            const validator = (control: AbstractControl): ValidationErrors | null => {
                const rootFormGroup = control.root as TypedFormGroup<T>;

                if (!rootFormGroup.value) {
                    //not yet initialized
                    return null;
                }

                const errors: ValidationError[] = [];
                if (conditionalValidators && conditionalValidators[propPath]) {
                    const res = conditionalValidators[propPath](rootFormGroup.value);
                    if (res) {
                        console.log('errors', propPath, rootFormGroup.value, res);
                        const validators: ValidatorFn[] = Array.isArray(res) ? res : [res];
                        for (const val of validators) {
                            const errors = val(control);
                            if (errors) {
                                return errors;
                            }
                        }
                    }
                }

                jitValidateProperty(entitySchema.getProperty(name))(control.value, name, errors);
                if (errors.length) {
                    const res: ValidationErrors = {};

                    for (const e of errors) {
                        res[e.code] = e.message;
                    }

                    return res;
                }

                return null;
            };

            if (prop.type === 'class' && !prop.isArray && !prop.isMap) {
                controls[name] = TypedFormGroup.fromEntityClass(prop.getResolvedClassType(), validator, conditionalValidators, propPath);
            } else {
                controls[name] = new FormControl(undefined, validator);
            }
        }

        const t = new TypedFormGroup<T>(controls, validation as ValidatorFn);
        t.classType = classType;
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

    printDeepErrors(path?: string) {
        for (const [name, control] of Object.entries(this.controls)) {
            if (control.invalid) {
                console.log('invalid', (path ? path + '.' : '') + name, control.errors, control.status, control.value, control);
            } else if (control instanceof TypedFormGroup) {
                control.printDeepErrors((path ? path + '.' : '') + name);
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
        for (const [name, c] of eachPair(this.controls)) {
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
