/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Observable, Subscription } from 'rxjs';
import { ChangeDetectorRef, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { nextTick } from '@deepkit/core';

const electron = 'undefined' === typeof window ? undefined : (window as any).electron || ((window as any).require ? (window as any).require('electron') : undefined);

export async function getHammer() {
    if ('undefined' === typeof window) return;
    //@ts-ignore
    const { default: Hammer } = await import('hammerjs');
    return Hammer;
}

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

    if (target instanceof HTMLElement) {
        let targetElement: HTMLElement = target;
        while (targetElement.parentElement) {
            if (targetElement.parentElement === parent) {
                return true;
            }
            targetElement = targetElement.parentElement;
        }
    }

    return false;
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

export function focusWatcher(target: HTMLElement, allowedFocuses: HTMLElement[] = [], customChecker?: (currentlyFocused: HTMLElement | null) => boolean): Observable<void> {
    if (target.ownerDocument!.body.tabIndex === -1) target.ownerDocument!.body.tabIndex = 1;

    return new Observable<void>((observer) => {
        let currentlyFocused: HTMLElement | null = target;

        function isFocusAllowed() {
            if (!currentlyFocused) {
                return false;
            }

            if (isTargetChildOf(currentlyFocused, target)) {
                return true;
            }

            for (const focus of allowedFocuses) {
                if (isTargetChildOf(currentlyFocused, focus)) {
                    return true;
                }
            }

            return customChecker ? customChecker(currentlyFocused) : false;
        }

        function check() {
            if (!currentlyFocused) {
                //shouldn't be possible to have no element at all with focus.
                //this means usually that the item that had previously focus was deleted.
                currentlyFocused = target;
            }
            if (!isFocusAllowed()) {
                observer.next();
                observer.complete();
            }
        }

        function onFocusOut() {
            currentlyFocused = null;
            check();
        }

        function onFocusIn(event: FocusEvent) {
            currentlyFocused = event.target as any;
            check();
        }

        function onMouseDown(event: FocusEvent) {
            currentlyFocused = event.target as any;
            check();
        }

        target.ownerDocument!.addEventListener('mousedown', onMouseDown, true);
        target.ownerDocument!.addEventListener('focusin', onFocusIn);
        target.ownerDocument!.addEventListener('focusout', onFocusOut);

        function unsubscribe(): void {
            target.ownerDocument!.removeEventListener('mousedown', onMouseDown);
            target.ownerDocument!.removeEventListener('focusin', onFocusIn);
            target.ownerDocument!.removeEventListener('focusout', onFocusOut);
        }

        return { unsubscribe: unsubscribe };
    });
}

export function isRouteActive(route: { routerLink?: string | UrlTree | any[]; routerLinkExact?: boolean; router?: Router, activatedRoute?: ActivatedRoute }): boolean {
    if (!route.router) return false;

    if ('string' === typeof route.routerLink) {
        return route.router.isActive(route.routerLink, route.routerLinkExact === true);
    } else if (Array.isArray(route.routerLink)) {
        return route.router.isActive(route.router.createUrlTree(route.routerLink, { relativeTo: route.activatedRoute }), route.routerLinkExact === true);
    } else {
        return route.router.isActive(route.routerLink!, route.routerLinkExact === true);
    }
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
