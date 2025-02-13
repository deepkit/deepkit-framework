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
    Component,
    ContentChild,
    EventEmitter,
    HostListener,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    SkipSelf,
} from '@angular/core';
import { FormGroup, NgControl } from '@angular/forms';
import { detectChangesNextFrame } from '../app';

@Component({
    selector: 'dui-form-row',
    standalone: false,
    template: `
        <div class="label" [style.width.px]="labelWidth">{{label}}<div class="description" *ngIf="description">{{description}}</div></div>
        <div class="field">
            <ng-content></ng-content>

            <div class="error" *ngIf="ngControl && ngControl.errors && ngControl.touched">
                <div *ngFor="let kv of ngControl.errors|keyvalue">
                    {{isString(kv.value) ? '' : kv.key}}{{isString(kv.value) ? kv.value : ''}}
                </div>
            </div>
        </div>`,
    host: {
        '[class.left-aligned]': 'left !== false'
    },
    styleUrls: ['./form-row.component.scss']
})
export class FormRowComponent {
    @Input() label: string = '';
    @Input() description: string = '';

    @Input() labelWidth?: number;
    @Input() left: boolean | '' = false;

    @ContentChild(NgControl, {static: false}) ngControl?: NgControl;

    isString(v: any) {
        return 'string' === typeof v;
    }
}

@Component({
    selector: 'dui-form',
    standalone: false,
    template: `
        <form [formGroup]="formGroup" (submit)="$event.preventDefault();submitForm()">
            <ng-content></ng-content>
            <div *ngIf="errorText" class="error">{{errorText}}</div>
        </form>
    `,
    styleUrls: ['./form.component.scss']
})
export class FormComponent implements OnChanges {
    @Input() formGroup: FormGroup = new FormGroup({});

    @Input() disabled: boolean = false;

    @Input() submit?: () => Promise<any> | any;

    @Output() success = new EventEmitter();
    @Output() error = new EventEmitter();

    @Output() disableChange = new EventEmitter();

    public errorText = '';
    public submitting = false;

    constructor(
        protected cd: ChangeDetectorRef,
        @SkipSelf() protected cdParent: ChangeDetectorRef,
    ) {
    }

    @HostListener('keyup', ['$event'])
    onEnter(event: KeyboardEvent) {
        if (this.submit && event.key.toLowerCase() === 'enter'
            && event.target && (event.target as HTMLElement).tagName.toLowerCase() === 'input') {
            this.submitForm();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.disabled) {
            this.disableChange.emit(this.disabled);
        }
    }

    get invalid() {
        return this.formGroup.invalid;
    }

    async submitForm() {
        if (this.disabled) return;
        if (this.submitting) return;
        if (this.formGroup.invalid) return;
        this.errorText = '';

        this.submitting = true;
        detectChangesNextFrame(this.cd);

        try {
            if (this.submit) {
                try {
                    await this.submit();
                    this.success.emit();
                } catch (error: any) {
                    this.error.emit(error);

                    if (error.errors && error.errors[0]) {
                        //we got a validation-like error object
                        for (const item of error.errors) {
                            const control = this.formGroup.get(item.path);
                            if (control) {
                                control.setErrors({
                                    ...control.errors,
                                    [item.code]: item.message,
                                });
                            }
                        }
                    } else {
                        this.errorText = error.message || error;
                    }
                    console.log('form error', error);
                }
            }
        } finally {
            this.submitting = false;
            detectChangesNextFrame(this.cd);
        }
    }
}
