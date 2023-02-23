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
    ChangeDetectorRef,
    Component,
    ContentChild,
    ContentChildren,
    Directive,
    ElementRef,
    HostBinding,
    HostListener,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    QueryList,
    SimpleChanges,
    SkipSelf,
    TemplateRef,
    ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { Overlay } from '@angular/cdk/overlay';
import { DropdownComponent } from '../button/dropdown.component';
import { ButtonComponent } from '../button/button.component';

/**
 * Necessary directive to get a dynamic rendered option.
 *
 * ```html
 * <dui-option>
 *     <ng-container *dynamicOption>
 *          {{item.fieldName | date}}
 *     </ng-container>
 * </dui-option>
 * ```
 */
@Directive({
    selector: '[dynamicOption]',
})
export class DynamicOptionDirective {
    constructor(
        public template: TemplateRef<any>
    ) {
    }
}

@Component({
    selector: 'dui-option',
    template: `<ng-content></ng-content>`
})
export class OptionDirective {
    @Input() value: any;

    @Input() disabled: boolean = false;

    @ContentChild(DynamicOptionDirective, { static: false }) dynamic?: DynamicOptionDirective;

    constructor(public readonly element: ElementRef) {
    }
}

@Directive({
    selector: 'dui-option-separator',
    providers: [{ provide: OptionDirective, useExisting: OptionSeparatorDirective }],
})
export class OptionSeparatorDirective {
    constructor() { }
}

class NotSelected { }

@Component({
    selector: 'dui-select',
    template: `
        <ng-container *ngIf="button">
            <dui-button-group padding="none">
                <ng-content select="dui-button"></ng-content>
                <dui-button class="split-knob"
                            style="padding: 0 2px;"
                            [openDropdown]="dropdown" tight textured icon="arrow_down"></dui-button>
            </dui-button-group>
        </ng-container>

        <ng-container *ngIf="!button">
            <div class="placeholder" *ngIf="!isSelected">{{placeholder}}</div>
            <div class="value">
                <ng-container *ngIf="innerValue !== undefined && optionsValueMap.get(innerValue) as option">
                    <ng-container *ngIf="option.dynamic" [ngTemplateOutlet]="option.dynamic.template"></ng-container>
                    <div *ngIf="!option.dynamic">
                        <div [innerHTML]="option.element.nativeElement.innerHTML"></div>
                    </div>
                </ng-container>
            </div>

            <div class="knob">
                <dui-icon [size]="12" name="arrows"></dui-icon>
            </div>
        </ng-container>

        <dui-dropdown #dropdown [host]="element.nativeElement">
            <ng-container *ngIf="options">
                <ng-container *ngFor="let option of options.toArray()">
                    <dui-dropdown-separator *ngIf="isSeparator(option)"></dui-dropdown-separator>
                    <dui-dropdown-item
                        *ngIf="!isSeparator(option)"
                        (click)="select(option.value)"
                        [selected]="innerValue === option.value"
                    >
                        <ng-container *ngIf="option.dynamic" [ngTemplateOutlet]="option.dynamic.template"></ng-container>
                        <div *ngIf="!option.dynamic">
                            <div [innerHTML]="option.element.nativeElement.innerHTML"></div>
                        </div>
                    </dui-dropdown-item>
                </ng-container>
            </ng-container>
        </dui-dropdown>
    `,
    styleUrls: ['./selectbox.component.scss'],
    host: {
        '[attr.tabIndex]': '1',
        '[class.split]': '!!button',
        '[class.textured]': 'textured !== false',
        '[class.small]': 'small !== false',
    },
    providers: [ngValueAccessor(SelectboxComponent)]
})
export class SelectboxComponent<T> extends ValueAccessorBase<T | NotSelected> implements AfterViewInit, OnDestroy, OnChanges {
    @Input() placeholder: string = '';

    /**
     * Different textured styled.
     */
    @Input() textured: boolean | '' = false;

    /**
     * Smaller text and height.
     */
    @Input() small: boolean | '' = false;

    @ContentChild(ButtonComponent, { static: false }) button?: ButtonComponent;

    @ContentChildren(OptionDirective, { descendants: true }) options?: QueryList<OptionDirective>;
    @ViewChild('dropdown', { static: false }) dropdown!: DropdownComponent;

    public label: string = '';
    public optionsValueMap = new Map<T | NotSelected, OptionDirective>();

    protected changeSubscription?: Subscription;

    constructor(
        protected overlay: Overlay,
        protected injector: Injector,
        public element: ElementRef,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
    ) {
        super(injector, cd, cdParent);
        this.innerValue = new NotSelected;
    }

    isSeparator(item: any): boolean {
        return item instanceof OptionSeparatorDirective;
    }

    ngAfterViewInit(): void {
        if (this.options) {
            this.changeSubscription = this.options.changes.subscribe(() => this.updateMap());

            setTimeout(() => {
                this.updateMap();
            });
        }
    }

    public select(value: T) {
        this.innerValue = value;
        this.touch();
        this.dropdown.close();
    }

    @HostListener('mousedown')
    public onClick() {
        if (this.disabled) return;
        if (this.button) return;

        this.dropdown.toggle();
    }

    ngOnChanges(changes: SimpleChanges) {
    }

    open() {
        if (this.dropdown) this.dropdown.open();
    }

    async writeValue(value?: T | NotSelected): Promise<void> {
        super.writeValue(value);
    }

    @HostBinding('class.selected')
    get isSelected(): boolean {
        return !(this.innerValue instanceof NotSelected);
    }

    protected updateMap() {
        this.optionsValueMap.clear();
        if (!this.options) return;

        for (const option of this.options.toArray()) {
            this.optionsValueMap.set(option.value, option);
        }

        this.cd.detectChanges();
    }

    ngOnDestroy(): void {
        if (this.changeSubscription) {
            this.changeSubscription.unsubscribe();
        }
    }
}
