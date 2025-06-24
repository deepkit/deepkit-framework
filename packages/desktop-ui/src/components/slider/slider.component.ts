/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { booleanAttribute, Component, computed, ElementRef, HostListener, input, viewChild } from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { clamp, injectElementRef } from '../app/utils';

/**
 * Slider component allows users to select a value from a range by dragging a knob along a track.
 *
 * ```html
 * <dui-slider [(ngModel)]="value" [min]="0" [max]="100" [steps]="1"></dui-slider>
 * ```
 */
@Component({
    selector: 'dui-slider',
    template: `
      <div class="bg"></div>
      <div class="knob-container">
        <div [style.width.%]="knobLeft()" class="active-line"></div>
        <div #dragKnob [style.left.%]="knobLeft()" class="knob"></div>
      </div>
    `,
    host: {
        '[class.mini]': 'mini()',
    },
    styleUrls: ['./slider.component.scss'],
    providers: [ngValueAccessor(SliderComponent)],
})
export class SliderComponent extends ValueAccessorBase<number> {
    /**
     * The minimum value of the slider.
     */
    min = input(0);

    /**
     * The maximum value of the slider.
     */
    max = input(1);

    /**
     * The step size for the slider. The value will be rounded to the nearest step.
     */
    steps = input(0.01);

    /**
     * How many fractional digits to display.
     */
    fractionalDigits = input(2);

    /**
     * If true, the slider will be displayed in a compact form.
     */
    mini = input(false, { transform: booleanAttribute });

    dragKnob = viewChild<ElementRef<HTMLElement>>('dragKnob');

    normalizedValue = computed(() => this.value() || 0);

    element = injectElementRef();
    dragContainer = this.element.nativeElement;
    knobWidth = computed(() => {
        const knob = this.dragKnob()?.nativeElement;
        return knob ? knob.clientWidth : 0;
    });

    knobLeft = computed(() => {
        return (this.normalizedValue() - this.min()) / (this.max() - this.min()) * 100;
    });

    private down = false;

    private valueFromMouse(event: MouseEvent) {
        const x = event.clientX - this.dragContainer.getBoundingClientRect().x;
        this.updateValueFromX(x);
    }

    @HostListener('window:mouseup', ['$event'])
    protected containerMouseUp(event: MouseEvent) {
        if (!this.down) return;
        this.valueFromMouse(event);
        this.down = false;
    }

    @HostListener('window:mousedown', ['$event'])
    protected containerMouseDown(event: MouseEvent) {
        const container = this.dragContainer;
        const knob = this.dragKnob()?.nativeElement;
        if (!knob || !container || !event.target) return;
        // Check if event.target is either container or child of container
        if (event.target !== container && !container.contains(event.target as Node)) {
            return;
        }

        this.down = true;
        this.valueFromMouse(event);
    }

    @HostListener('window:mousemove', ['$event'])
    protected containerMouseMove(event: MouseEvent) {
        if (!this.down) return;
        this.valueFromMouse(event);
    }

    writeValue(value?: number) {
        value = clamp(value || 0, this.min(), this.max());
        super.setValue(value);
    }

    protected updateValueFromX(x: number) {
        const container = this.dragContainer;
        if (!container) return 0;
        // Shift x by knobWidth/2, so handle is centered
        x -= this.knobWidth() / 2;
        if (x < 0) x = 0;
        const width = container.clientWidth - this.knobWidth(); // aligned with knob size
        if (x > width) x = width;
        const percent = x / width;
        let value = this.min() + percent * (this.max() - this.min());
        const shift = (value % this.steps());
        if (shift > this.steps() / 2) {
            value += this.steps() - shift; // round up
        } else {
            value -= shift; // round down
        }
        super.setValue(parseFloat(value.toFixed(this.fractionalDigits())));
    }
}
