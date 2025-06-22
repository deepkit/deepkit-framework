/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { booleanAttribute, Component, computed, HostListener, input, model } from '@angular/core';

@Component({
    selector: 'dui-splitter',
    template: '',
    styleUrls: ['./splitter.component.scss'],
    host: {
        '[class.splitter-right]': 'position() === "right"',
        '[class.splitter-left]': 'position() === "left"',
        '[class.splitter-top]': 'position() === "top"',
        '[class.splitter-bottom]': 'position() === "bottom"',
        '[class.splitter-with-indicator]': 'indicator() !== false',
    },
})
export class SplitterComponent {
    indicator = input(false, { transform: booleanAttribute });
    size = model(0);
    inverted = input(false);
    position = model<'left' | 'right' | 'top' | 'bottom'>('left');
    orientation = computed(() => this.position() === 'left' || this.position() === 'right' ? 'horizontal' : 'vertical');

    protected isDown = false;
    protected startSize = 0;
    protected startMousePosition = { x: 0, y: 0 };

    @HostListener('mousedown', ['$event'])
    onMouseDown(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        this.isDown = true;
        this.startSize = this.size();
        this.startMousePosition = { x: event.clientX, y: event.clientY };
    }

    @HostListener('window:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (!this.isDown) return;

        event.preventDefault();
        event.stopPropagation();

        const deltaX = event.clientX - this.startMousePosition.x;
        const deltaY = event.clientY - this.startMousePosition.y;
        if (this.orientation() === 'horizontal') {
            this.size.set(this.startSize + (this.inverted() ? deltaX : -deltaX));
        } else {
            this.size.set(this.startSize + (this.inverted() ? deltaY : -deltaY));
        }
    }

    @HostListener('window:mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {
        if (!this.isDown) return;
        event.preventDefault();
        event.stopPropagation();
        this.isDown = false;
    }
}
