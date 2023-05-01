/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Injector, Input, SkipSelf, ViewChild } from '@angular/core';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import Hammer from 'hammerjs';

@Component({
    selector: 'dui-slider',
    template: `
        <div class="bg"></div>
        <div class="knob-container">
            <div [style.width.%]="getWidth() * 100" class="active-line"></div>
            <div #knob [style.left.%]="getWidth() * 100" class="knob"></div>
        </div>
    `,
    host: {
        '[class.mini]': 'mini !== false'
    },
    styleUrls: ['./slider.component.scss'],
    providers: [ngValueAccessor(SliderComponent)]
})
export class SliderComponent extends ValueAccessorBase<number> implements AfterViewInit {
    @ViewChild('knob', { static: true }) knob?: ElementRef;

    @Input() min = 0;
    @Input() steps = 0.01;
    @Input() max = 1;

    @Input() mini: boolean | '' = false;

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
        protected element: ElementRef,
    ) {
        super(injector, cd, cdParent);
    }

    getWidth(): number {
        return Math.max(0, Math.min(1, ((this.innerValue || this.min) - this.min) / (this.max - this.min)));
    }

    ngAfterViewInit() {
        //move to next render frame, so all newly created sliders are rendered at the same time and don't block he DOM
        requestAnimationFrame(() => {
            this.initEvents();
        });
    }

    initEvents() {
        const mc = new Hammer(this.knob!.nativeElement);
        mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 1 }));

        const mcTab = new Hammer(this.element.nativeElement);
        mcTab.add(new Hammer.Tap({}));
        mcTab.add(new Hammer.Pan({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 0 }));
        mcTab.add(new Hammer.Press({ threshold: 1 }));

        let startXInPixels = 0;
        let knobSize = this.knob!.nativeElement.offsetWidth;
        let width = (this.element!.nativeElement.offsetWidth - knobSize);
        let lastRequest: any;

        mc.on('panstart', (event: HammerInput) => {
            startXInPixels = this.getWidth() * width;
            knobSize = this.knob!.nativeElement.offsetWidth;
            width = (this.element!.nativeElement.offsetWidth - knobSize);
        });

        mcTab.on('panstart', (event: HammerInput) => {
            const rect = (this.element!.nativeElement as HTMLElement).getBoundingClientRect();
            startXInPixels = event.center.x - (knobSize / 2) - rect.x;
            knobSize = this.knob!.nativeElement.offsetWidth;
            width = (this.element!.nativeElement.offsetWidth - knobSize);
        });

        const handleNewLeft = (newLeft: number) => {
            if (newLeft === 1.0) {
                this.innerValue = this.max;
                return;
            }

            let newPotentialValue = this.min + (newLeft * ((this.max - this.min)));
            const shift = (newPotentialValue % this.steps);
            this.innerValue = Math.max(this.min, newPotentialValue - shift);
        };

        const setOnMousePos = (event: HammerInput) => {
            const rect = (this.element!.nativeElement as HTMLElement).getBoundingClientRect();
            const x = event.center.x - (knobSize / 2) - rect.x;
            const newLeft = Math.min(width, Math.max(0, x)) / width;
            handleNewLeft(newLeft);
        };
        mcTab.on('tap', setOnMousePos);
        mcTab.on('press', setOnMousePos);

        function pan(event: HammerInput) {
            if (lastRequest) {
                cancelAnimationFrame(lastRequest);
            }

            lastRequest = requestAnimationFrame(() => {
                const newLeft = Math.min(width, Math.max(0, (startXInPixels + event.deltaX))) / width;
                handleNewLeft(newLeft);
            });
        }

        mc.on('pan', pan);
        mcTab.on('pan', pan);
    }
}
