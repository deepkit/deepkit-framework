/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * @reflection never
 */
import { Subscription } from 'rxjs';
import { ChangeDetectorRef, EventEmitter, Inject, Injectable } from '@angular/core';
import { nextTick } from '@deepkit/core';
import { DOCUMENT } from '@angular/common';

const electron = 'undefined' === typeof window ? undefined : (window as any).electron || ((window as any).require ? (window as any).require('electron') : undefined);

export type ElectronOrBrowserWindow = Window & {
    setVibrancy?: (vibrancy: string) => void;
    addListener?: (event: string, listener: (...args: any[]) => void) => void;
    removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

@Injectable({ providedIn: 'root' })
export class BrowserWindow {
    constructor(@Inject(DOCUMENT) private window?: ElectronOrBrowserWindow) {
    }

    isElectron() {
        return !!this.window?.setVibrancy;
    }

    getWindow(): ElectronOrBrowserWindow | undefined {
        return this.window;
    }

    setVibrancy(vibrancy: string): void {
        if (!this.window) return;

        if (this.window.setVibrancy) {
            this.window.setVibrancy(vibrancy);
        } else {
            console.warn('setVibrancy is not supported by this window.');
        }
    }

    addListener(event: string, listener: (...args: any[]) => void): void {
        if (!this.window) return;

        if (this.window.addEventListener) {
            this.window.addEventListener(event, listener);
        } else if (this.window.addListener) {
            this.window.addListener(event, listener);
        }
    }

    removeListener(event: string, listener: (...args: any[]) => void): void {
        if (!this.window) return;

        if (this.window.removeEventListener) {
            this.window.removeEventListener(event, listener);
        } else if (this.window.removeListener) {
            this.window.removeListener(event, listener);
        }
    }
}

@Injectable({ providedIn: 'root' })
export class Electron {
    public static getRemote(): any {
        if (!electron) {
            throw new Error('No Electron available.');
        }

        return electron.remote;
    }

    public static getIpc(): any {
        if (!electron) {
            throw new Error('No Electron available.');
        }

        return electron.ipcRenderer;
    }

    public static isAvailable(): any {
        return !!electron;
    }

    public static getRemoteOrUndefined(): any {
        return electron ? electron.remote : undefined;
    }

    public static getProcess() {
        return Electron.getRemote().process;
    }
}

export class AsyncEventEmitter<T> extends EventEmitter<T> {
    emit(value?: T): void {
        super.emit(value);
    }

    subscribe(generatorOrNext?: any, error?: any, complete?: any): Subscription {
        return super.subscribe(generatorOrNext, error, complete);
    }
}


export class ExecutionState {
    public running = false;
    public error: string = '';

    constructor(
        protected readonly cd: ChangeDetectorRef,
        protected readonly func: (...args: any[]) => Promise<any> | any,
    ) {
    }

    public async execute(...args: any[]) {
        if (this.running) {
            throw new Error('Executor still running');
        }

        this.running = true;
        this.error = '';
        this.cd.detectChanges();

        try {
            return await this.func(...args);
        } catch (error: any) {
            this.error = error.message || error.toString();
            throw error;
        } finally {
            this.running = false;
            this.cd.detectChanges();
        }

    }
}

/**
 * Checks if `target` is children of `parent` or if `target` is `parent`.
 */
export function isTargetChildOf(target: HTMLElement | EventTarget | null, parent: HTMLElement): boolean {
    if (!target) return false;

    if (target === parent) return true;

    return parent.contains(target as Node);
}

export function isMacOs() {
    if ('undefined' === typeof navigator) return false;
    return navigator.platform.indexOf('Mac') > -1;
}

export function isWindows() {
    if ('undefined' === typeof navigator) return false;
    return navigator.platform.indexOf('Win') > -1;
}

/**
 * Checks if `target` is children of `parent` or if `target` is `parent`.
 */
export function findParentWithClass(start: HTMLElement, className: string): HTMLElement | undefined {
    let current: HTMLElement | null = start;
    do {
        if (current.classList.contains(className)) return current;
        current = current.parentElement;
    } while (current);

    return undefined;
}

export function triggerResize() {
    if ('undefined' === typeof window) return;
    nextTick(() => {
        window.dispatchEvent(new Event('resize'));
    });
}

export type FocusWatcherUnsubscribe = () => void;

/**
 * Observes focus changes on target elements and emits when focus is lost.
 *
 * This is used to track multi-element focus changes, such as when a user clicks from a dropdown toggle into the dropdown menu.
 */
export function focusWatcher(
    target: Element, allowedFocuses: Element[] = [],
    onBlur: (event: FocusEvent) => void,
    customChecker?: (currentlyFocused: Element | null) => boolean,
): FocusWatcherUnsubscribe {
    const doc = target.ownerDocument;
    if (doc.body.tabIndex === -1) doc.body.tabIndex = 1;

    let currentlyFocused: Element | null = target;

    let subscribed = true;

    function isFocusAllowed() {
        if (!currentlyFocused) {
            return false;
        }

        if (currentlyFocused === target || target.contains(currentlyFocused)) {
            return true;
        }

        for (const focus of allowedFocuses) {
            if (focus && currentlyFocused === focus || focus.contains(currentlyFocused)) {
                return true;
            }
        }

        return customChecker ? customChecker(currentlyFocused) : false;
    }

    function emitBlurIfNeeded(event: FocusEvent) {
        if (!currentlyFocused) {
            // Shouldn't be possible to have no element at all with focus.
            // This means usually that the item that had previously focus was deleted.
            currentlyFocused = target;
        }
        if (subscribed && !isFocusAllowed()) {
            onBlur(event);
            unsubscribe();
            return true;
        }
        return false;
    }

    function onFocusOut(event: FocusEvent) {
        currentlyFocused = null;
        emitBlurIfNeeded(event);
    }

    function onFocusIn(event: FocusEvent) {
        currentlyFocused = event.target as any;
        emitBlurIfNeeded(event);
    }

    function onMouseDown(event: FocusEvent) {
        currentlyFocused = event.target as any;
        if (emitBlurIfNeeded(event)) {
            event.stopImmediatePropagation();
            event.preventDefault();
        }
    }

    doc.addEventListener('mousedown', onMouseDown, true);
    doc.addEventListener('focusin', onFocusIn);
    doc.addEventListener('focusout', onFocusOut);

    function unsubscribe() {
        if (!subscribed) return;
        subscribed = false;
        doc.removeEventListener('mousedown', onMouseDown, true);
        doc.removeEventListener('focusin', onFocusIn);
        doc.removeEventListener('focusout', onFocusOut);
    }

    return unsubscribe;
}

export function redirectScrollableParentsToWindowResize(node: Element, passive = true) {
    const parents = getScrollableParents(node);

    function redirect() {
        window.dispatchEvent(new Event('resize'));
    }

    for (const parent of parents) {
        parent.addEventListener('scroll', redirect, { passive });
    }

    return () => {
        for (const parent of parents) {
            parent.removeEventListener('scroll', redirect);
        }
    };
}

export function getScrollableParents(node: Element): Element[] {
    const scrollableParents: Element[] = [];
    let parent = node.parentNode;

    while (parent) {
        if (!(parent instanceof Element)) {
            parent = parent.parentNode;
            continue;
        }
        const computedStyle = window.getComputedStyle(parent);
        const overflow = computedStyle.getPropertyValue('overflow');
        if (overflow === 'overlay' || overflow === 'scroll' || overflow === 'auto') {
            scrollableParents.push(parent);
        }

        parent = parent.parentNode;
    }

    return scrollableParents;
}

export function trackByIndex(index: number) {
    return index;
}
