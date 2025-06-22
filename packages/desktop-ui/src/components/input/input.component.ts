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
    AfterViewInit,
    booleanAttribute,
    Component,
    computed,
    ElementRef,
    EventEmitter,
    HostBinding,
    input,
    Output,
    ViewChild,
} from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { formatDate } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { FormsModule } from '@angular/forms';

const dateTimeTypes: string[] = ['time', 'date', 'datetime', 'datetime-local'];

@Component({
    selector: 'dui-input',
    template: `
      @if (icon(); as icon) {
        <dui-icon class="icon" [size]="iconSize()" [name]="icon"></dui-icon>
      } @if (type() === 'textarea') {
        <textarea
          #input
          [readOnly]="readonly() !== false"
          (focus)="onFocus()"
          (blur)="onBlur()"
          [placeholder]="placeholder()" (keyup)="onKeyUp($event)" (keydown)="onKeyDown($event)"
          [disabled]="isDisabled"
          [ngModel]="normalizeValue()" (ngModelChange)="writeValue($event)"></textarea>
      } @else {
        @if (type() !== 'textarea') {
          <input
            #input
            [step]="step()"
            [readOnly]="readonly() !== false"
            [attr.min]="min()"
            [attr.max]="max()"
            [attr.minLength]="minLength()"
            [attr.maxLength]="maxLength()"
            [type]="type()" (focus)="onFocus()" (blur)="onBlur()"
            (change)="handleFileInput($event)"
            [placeholder]="placeholder()" (keyup)="onKeyUp($event)" (keydown)="onKeyDown($event)"
            [disabled]="isDisabled"
            [ngModel]="type() === 'file' ? undefined : normalizeValue"
            (ngModelChange)="writeValue($event)"
          />
        }
      } @if (clearer()) {
        @if (hasClearer) {
          <dui-icon class="clearer" name="clear" (click)="clear()"></dui-icon>
        }
      }
    `,
    styleUrls: ['./input.component.scss'],
    host: {
        '[class.is-textarea]': 'type() === "textarea"',
        '[class.light-focus]': 'lightFocus()',
        '[class.semi-transparent]': 'semiTransparent()',
        '[class.no-controls]': 'noControls()',
        '[class.has-clearer]': 'clearer()',
        '[class.filled]': 'value()',
        '[class.round]': 'round()',
        '[class.textured]': 'textured()',
        '[class.has-icon]': 'icon()',
    },
    providers: [ngValueAccessor(InputComponent)],
    imports: [IconComponent, FormsModule],
})
export class InputComponent extends ValueAccessorBase<any> implements AfterViewInit {
    type = input<string>('text');

    step = input<number>(1);

    placeholder = input<string>('');

    icon = input<string>('');

    min = input<number>();
    max = input<number>();
    maxLength = input<number>();
    minLength = input<number>();

    iconSize = input<number>(17);

    /**
     * Focuses this element once created (AfterViewInit).
     */
    focus = input(false, { transform: booleanAttribute });

    /**
     * Uses a more decent focus border.
     */
    lightFocus = input(false, { transform: booleanAttribute });

    /**
     * Disables input controls (like for type=number the arrow buttons)
     */
    noControls = input(false, { transform: booleanAttribute });

    /**
     * Appears a little bit transparent. Perfect for blurry background.
     */
    semiTransparent = input(false, { transform: booleanAttribute });

    @Output() esc = new EventEmitter<KeyboardEvent>();
    @Output() enter = new EventEmitter<KeyboardEvent>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();
    @Output() keyUp = new EventEmitter<KeyboardEvent>();

    @ViewChild('input', { static: false }) input?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

    textured = input(false, { transform: booleanAttribute });

    = input(false, { transform: booleanAttribute });

    @Output() focusChange = new EventEmitter<boolean>();

    @HostBinding('class.focused')
    get isFocused() {
        if ('undefined' === typeof document) return false;
        return this.input ? document.activeElement === this.input!.nativeElement : false;
    }

    round = input(false, { transform: booleanAttribute });

    clearer = input(false, { transform: booleanAttribute });

    normalizeValue = computed(() => {
        if (dateTimeTypes.includes(this.type())) {
            if (this.value() instanceof Date) {
                if (this.type() === 'date') return formatDate(this.value(), `yyyy-MM-dd`, navigator.language);
                return formatDate(this.value(), 'yyyy-MM-ddThh:mm:ss.SSS', navigator.language);
            } else if ('string' === typeof this.value()) {
                return formatDate(new Date(this.value()), 'yyyy-MM-ddThh:mm:ss.SSS', navigator.language);
            }
        }
        return this.value();
    });


    constructor() {
        super();
        this.value.set('');
    }

    onBlur() {
        this.focusChange.next(false);
    }

    onFocus() {
        this.focusChange.next(true);
    }

    public clear() {
        this.writeValue('');
    }

    writeValue(value: any | undefined) {
        if (this.type() === 'file' && !value && this.input) {
            //we need to manually reset the field, since writing to it via ngModel is not supported.
            this.input.nativeElement.value = '';
        }

        value = value === undefined || value === null ? '' : value;

        if (this.type() === 'file') return;
        if (this.type() === 'text') {

        } else if (this.type() === 'number') {
            if (value && 'number' !== typeof value) {
                value = parseFloat(value);
            }
        } else if (dateTimeTypes.includes(this.type())) {
            if ('string' === typeof value) {
                value = new Date(value);
            }
        }
        super.writeValue(value);
    }

    onKeyDown(event: KeyboardEvent) {
        this.touch();
        this.keyDown.emit(event);
    }

    onKeyUp(event: KeyboardEvent) {
        if (event.key.toLowerCase() === 'enter' && this.type() !== 'textarea') {
            this.enter.emit(event);
        }

        if (event.key.toLowerCase() === 'esc' || event.key.toLowerCase() === 'escape') {
            this.esc.emit(event);
        }

        this.keyUp.emit(event);
    }

    focusInput() {
        setTimeout(() => {
            this.input!.nativeElement.focus();
        });
    }

    ngAfterViewInit() {
        if (this.focus() && this.input) {
            setTimeout(() => {
                this.input!.nativeElement.focus();
            });
        }
    }

    public async handleFileInput(event: any) {
        const files = event.target.files;
        this.touch();

        const readFile = (file: File): Promise<ArrayBuffer | undefined> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (reader.result) {
                        if (reader.result instanceof ArrayBuffer) {
                            resolve(reader.result);
                        } else {
                            resolve(undefined);
                        }
                    }
                };
                reader.onerror = (error) => {
                    console.log('Error: ', error);
                    reject();
                };

                reader.readAsArrayBuffer(file);
            });
        };

        if (files) {
            if (files.length > 1) {
                const value: any[] = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files.item(i);
                    if (file) {
                        value.push(await readFile(file));
                    }
                }
                this.writeValue(value);
            } else if (files.length === 1) {
                this.writeValue(await readFile(files.item(0)));
            }
        }
    }
}
