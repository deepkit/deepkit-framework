/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Directive, ElementRef, HostListener, inject, Input, input, OnChanges, OnDestroy, OnInit, output } from '@angular/core';
import { nextTick } from '@deepkit/core';
import { Electron } from '../../core/utils';
import { DOCUMENT } from '@angular/common';

export function injectDocument(): Document | undefined {
    return inject(DOCUMENT, { optional: true }) || undefined;
}

export function injectElementRef(): ElementRef<HTMLElement> {
    return inject(ElementRef);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

@Directive({ selector: '[openExternal], a[href]' })
export class OpenExternalDirective implements OnChanges {
    openExternal = input<string>('');
    href = input<string>('');

    constructor(private element: ElementRef) {
        // this.element.nativeElement.href = '#';
    }

    ngOnChanges(): void {
        // this.element.nativeElement.href = this.getLink();
        if (this.element.nativeElement instanceof HTMLAnchorElement) {
            this.element.nativeElement.setAttribute('href', this.getLink());
        }
    }

    getLink() {
        return this.openExternal() || this.href();
    }

    @HostListener('click', ['$event'])
    onClick(event: Event) {
        event.stopPropagation();
        event.preventDefault();

        if (Electron.isAvailable()) {
            event.preventDefault();
            Electron.getRemote().shell.openExternal(this.getLink());
        } else {
            window.open(this.getLink(), '_blank');
        }
    }
}

let lastScheduleResize: any;

export function scheduleWindowResizeEvent() {
    if (lastScheduleResize) cancelAnimationFrame(lastScheduleResize);
    lastScheduleResize = nextTick(() => {
        window.dispatchEvent(new Event('resize'));
        lastScheduleResize = undefined;
    });
}

@Directive({ selector: 'ng-template[templateType]' })
export class TemplateContextTypeDirective<T> {
    @Input() protected templateType!: T;

    public static ngTemplateContextGuard<T>(dir: TemplateContextTypeDirective<T>, ctx: unknown,
    ): ctx is T {
        return true;
    }
}


@Directive({ selector: '[onDomCreation]' })
export class OnDomCreationDirective implements OnInit, OnDestroy {
    onDomCreation = output<Element>();
    onDomCreationDestroy = output<Element>();
    private element: ElementRef<HTMLElement> = injectElementRef();

    ngOnInit() {
        this.onDomCreation.emit(this.element.nativeElement);
    }

    ngOnDestroy() {
        this.onDomCreationDestroy.emit(this.element.nativeElement);
    }
}

export type RegisterEventListenerRemove = () => void;

export function registerEventListener<
    T extends Element | Document | Window,
    K extends keyof KeyMap,
    KeyMap extends GlobalEventHandlersEventMap = T extends Document ? DocumentEventMap : T extends Window ? WindowEventMap : HTMLElementEventMap,
>(
    element: T,
    type: K,
    listener: (ev: KeyMap[K]) => any,
    options?: AddEventListenerOptions,
): RegisterEventListenerRemove {
    element.addEventListener(type as string, listener as EventListenerOrEventListenerObject, options);
    return () => element.removeEventListener(type as string, listener as EventListenerOrEventListenerObject, options);
}
