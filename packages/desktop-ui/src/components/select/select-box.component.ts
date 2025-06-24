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
    booleanAttribute,
    Component,
    computed,
    contentChild,
    ContentChild,
    contentChildren,
    Directive,
    ElementRef,
    HostBinding,
    HostListener,
    input,
    OnDestroy,
    TemplateRef,
    viewChild,
} from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { DropdownComponent, DropdownItemComponent, DropdownSplitterComponent, OpenDropdownDirective } from '../button/dropdown.component';
import { ButtonComponent, ButtonGroupComponent } from '../button/button.component';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { injectElementRef } from '../app/utils';

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
@Directive({ selector: '[dynamicOption]' })
export class DynamicOptionDirective {
    constructor(
        public template: TemplateRef<any>,
    ) {
    }
}

/**
 * Directive to create an option in the select dropdown.
 *
 * ```html
 * <dui-select>
 *     <dui-option value="1">Option 1</dui-option>
 * </dui-select>
 */
@Component({
    selector: 'dui-option',
    template: `
      <ng-content></ng-content>`,
})
export class OptionDirective {
    value = input<any>();

    disabled = input<boolean>(false);

    @ContentChild(DynamicOptionDirective, { static: false }) dynamic?: DynamicOptionDirective;

    constructor(public element: ElementRef) {
    }
}

/**
 * Directive to create a separator in the select dropdown.
 *
 * ```html
 * <dui-select>
 *     <dui-option value="1">Option 1</dui-option>
 *     <dui-option-separator></dui-option-separator>
 *     <dui-option value="2">Option 2</dui-option>
 * </dui-select>
 */
@Directive({
    selector: 'dui-option-separator',
    providers: [{ provide: OptionDirective, useExisting: OptionSeparatorDirective }],
})
export class OptionSeparatorDirective {
    constructor() {
    }
}

class NotSelected {
}

@Component({
    selector: 'dui-select',
    template: `
      @if (button()) {
        <dui-button-group padding="none">
          <ng-content select="dui-button"></ng-content>
          <dui-button class="split-knob"
                      style="padding: 0 2px;"
                      [openDropdown]="dropdown" tight textured icon="arrow_down"></dui-button>
        </dui-button-group>
      } @else {
        @if (!isSelected) {
          <div class="placeholder">{{ placeholder() }}</div>
        }
        <div class="value">
          @if (optionsValueMap().get(value()); as option) {
            @if (option.dynamic) {
              <ng-container [ngTemplateOutlet]="option.dynamic.template"></ng-container>
            } @else {
              <div>
                <div [innerHTML]="option.element.nativeElement.innerHTML"></div>
              </div>
            }
          }
        </div>
        <div class="knob">
          <dui-icon [size]="12" name="arrows"></dui-icon>
        </div>
      }

      <dui-dropdown #dropdown [host]="element.nativeElement">
        @for (option of options(); track option) {
          @if (isSeparator(option)) {
            <dui-dropdown-separator></dui-dropdown-separator>
          } @else {
            <dui-dropdown-item
              (click)="select(option.value())"
              [selected]="value() === option.value()"
            >
              @if (option.dynamic) {
                <ng-container [ngTemplateOutlet]="option.dynamic.template"></ng-container>
              }
              @if (!option.dynamic) {
                <div>
                  <div [innerHTML]="option.element.nativeElement.innerHTML"></div>
                </div>
              }
            </dui-dropdown-item>
          }
        }
      </dui-dropdown>
    `,
    styleUrls: ['./select-box.component.scss'],
    host: {
        '[attr.tabIndex]': '1',
        '[class.split]': '!!button()',
        '[class.textured]': 'textured()',
        '[class.small]': 'small()',
    },
    providers: [ngValueAccessor(SelectBoxComponent)],
    imports: [
        ButtonGroupComponent,
        ButtonComponent,
        OpenDropdownDirective,
        NgTemplateOutlet,
        IconComponent,
        DropdownComponent,
        DropdownSplitterComponent,
        DropdownItemComponent,
    ],
})
export class SelectBoxComponent<T> extends ValueAccessorBase<T | NotSelected> implements OnDestroy {
    placeholder = input<string>('');

    /**
     * Different textured styled.
     */
    textured = input(false, { transform: booleanAttribute });

    /**
     * Smaller text and height.
     */
    small = input(false, { transform: booleanAttribute });

    button = contentChild(ButtonComponent);
    options = contentChildren(OptionDirective, { descendants: true });
    dropdown = viewChild.required('dropdown', { read: DropdownComponent });

    public label: string = '';

    optionsValueMap = computed(() => {
        const map = new Map<T | NotSelected | undefined, OptionDirective>();
        for (const option of this.options()) {
            map.set(option.value(), option);
        }
        return map;
    });

    element = injectElementRef();

    constructor() {
        super();
        this.writeValue(new NotSelected);
    }

    protected isSeparator(item: any): boolean {
        return item instanceof OptionSeparatorDirective;
    }

    select(value: T) {
        this.writeValue(value);
        this.touch();
        this.dropdown().close();
    }

    @HostListener('mousedown')
    protected onClick() {
        if (this.disabled()) return;
        if (this.button()) return;

        this.dropdown().toggle();
    }

    open() {
        this.dropdown()?.open();
    }

    writeValue(value?: T | NotSelected): void {
        super.writeValue(value);
    }

    @HostBinding('class.selected')
    protected get isSelected(): boolean {
        return !(this.value() instanceof NotSelected);
    }
}
