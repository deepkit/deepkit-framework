/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Directive, ElementRef, HostListener, Input, OnInit } from '@angular/core';

@Directive({
    selector: '[duiClassMin]',
})
export class DuiResponsiveDirective implements OnInit {
    clazz: { [className: string]: boolean } = {};
    protected lastRequest: any;

    @Input() duiClassMin: { [className: string]: number } = {};

    constructor(
        private element: ElementRef,
    ) { }

    ngOnInit() {
        this.onResize();
    }

    @HostListener('window:resize')
    onResize() {
        if (this.lastRequest) {
            cancelAnimationFrame(this.lastRequest);
        }

        this.lastRequest = requestAnimationFrame(() => {
            const element: HTMLElement = this.element.nativeElement;
            for (const [name, number] of Object.entries(this.duiClassMin)) {
                const valid = element.offsetWidth > number;
                if (this.clazz[name] !== valid) {
                    this.clazz[name] = valid;
                    if (valid) {
                        element.classList.add(name);
                    } else {
                        element.classList.remove(name);
                    }
                }
            }
        });
    }
}
