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
    OnChanges,
    Output,
    SimpleChanges,
    SkipSelf,
    input, booleanAttribute,
} from '@angular/core';
import { FormGroup, NgControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { detectChangesNextFrame } from '../app';
import { KeyValuePipe } from '@angular/common';

@Component({
    selector: 'dui-form-row',
    template: `
        <div class="label" [style.width.px]="labelWidth()">{{label()}}@if (description()) {
          <div class="description">{{description()}}</div>
        }</div>
        <div class="field">
          <ng-content></ng-content>
        
          @if (ngControl && ngControl.errors && ngControl.touched) {
            <div class="error">
              @for (kv of ngControl.errors|keyvalue; track kv) {
                <div>
                  {{isString(kv.value) ? '' : kv.key}}{{isString(kv.value) ? kv.value : ''}}
                </div>
              }
            </div>
          }
        </div>`,
    host: {
        '[class.left-aligned]': 'left() !== false'
    },
    styleUrls: ['./form-row.component.scss'],
    imports: [KeyValuePipe]
})
export class FormRowComponent {
    label = input<string>('');
    description = input<string>('');

    labelWidth = input<number>();
    left = input(false, { transform: booleanAttribute });

    @ContentChild(NgControl, {static: false}) ngControl?: NgControl;

    isString(v: any) {
        return 'string' === typeof v;
    }
}

@Component({
    selector: 'dui-form',
    template: `
        <form [formGroup]="formGroup()" (submit)="$event.preventDefault();submitForm()">
          <ng-content></ng-content>
          @if (errorText) {
            <div class="error">{{errorText}}</div>
          }
        </form>
        `,
    styleUrls: ['./form.component.scss'],
    imports: [FormsModule, ReactiveFormsModule]
})
export class FormComponent implements OnChanges {
    formGroup = input<FormGroup>(new FormGroup({}));

    disabled = input<boolean>(false);

    submit = input<() => Promise<any> | any>();

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
        if (this.submit() && event.key.toLowerCase() === 'enter'
            && event.target && (event.target as HTMLElement).tagName.toLowerCase() === 'input') {
            this.submitForm();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.disabled) {
            this.disableChange.emit(this.disabled());
        }
    }

    get invalid() {
        return this.formGroup().invalid;
    }

    async submitForm() {
        if (this.disabled()) return;
        if (this.submitting) return;
        const formGroup = this.formGroup();
        if (formGroup.invalid) return;
        this.errorText = '';

        this.submitting = true;
        detectChangesNextFrame(this.cd);

        try {
            const submit = this.submit();
            if (submit) {
                try {
                    await submit();
                    this.success.emit();
                } catch (error: any) {
                    this.error.emit(error);

                    if (error.errors && error.errors[0]) {
                        //we got a validation-like error object
                        for (const item of error.errors) {
                            const control = formGroup.get(item.path);
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
