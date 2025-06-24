/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Injectable, Signal, signal, TemplateRef, ViewContainerRef } from '@angular/core';
import { arrayRemoveItem } from '@deepkit/core';
import { WindowMenuState } from './window-menu';
import { BrowserWindow } from '../../core/utils';

export interface WinHeader {
    getBottomPosition(): number;
}

export interface Win {
    id: number;
    browserWindow: BrowserWindow;

    getClosestNonDialogWindow(): Win | undefined;

    header: Signal<WinHeader | undefined>;
    viewContainerRef: ViewContainerRef;
}

@Injectable({ providedIn: 'root' })
export class WindowRegistry {
    id = 0;

    registry = new Map<Win, {
        state: WindowState,
        menu: WindowMenuState,
        viewContainerRef: ViewContainerRef
    }>();

    windowHistory: Win[] = [];
    activeWindow?: Win;

    getAllElectronWindows(): BrowserWindow[] {
        return [...this.registry.keys()].filter(v => v.browserWindow.isElectron()).map(v => v.browserWindow);
    }

    register(win: Win, state: WindowState, menu: WindowMenuState, viewContainerRef: ViewContainerRef) {
        this.id++;
        win.id = this.id;

        this.registry.set(win, { state, menu, viewContainerRef });
    }

    /**
     * Finds the activeWindow and returns its most outer parent.
     */
    getOuterActiveWindow(): Win | undefined {
        if (this.activeWindow) return this.activeWindow.getClosestNonDialogWindow();
    }

    getCurrentViewContainerRef(): ViewContainerRef {
        if (this.activeWindow) {
            return this.activeWindow.viewContainerRef;
            // const reg = this.registry.get(this.activeWindow);
            // if (reg) {
            //     return reg.viewContainerRef;
            // }
        }

        throw new Error('No active window');
    }

    focus(win: Win) {
        if (this.activeWindow === win) return;

        const reg = this.registry.get(win);
        if (!reg) throw new Error('Window not registered');

        this.activeWindow = win;

        arrayRemoveItem(this.windowHistory, win);
        this.windowHistory.push(win);

        reg.state.focus.set(true);
        reg.menu.focus();
    }

    blur(win: Win) {
        const reg = this.registry.get(win);
        if (reg) {
            reg.state.focus.set(false);
        }
        if (this.activeWindow === win) {
            this.activeWindow = undefined;
        }
    }

    unregister(win: Win) {
        const reg = this.registry.get(win);
        if (reg) {
            reg.state.focus.set(false);
        }

        this.registry.delete(win);
        arrayRemoveItem(this.windowHistory, win);

        if (this.windowHistory.length) {
            this.focus(this.windowHistory[this.windowHistory.length - 1]);
        }
    }
}

export interface AlignedButtonGroup {
    activateOneTimeAnimation: () => void;
}

@Injectable()
export class WindowState {
    public buttonGroupAlignedToSidebar = signal<AlignedButtonGroup | undefined>(undefined);
    public focus = signal(false);
    public disableInputs = signal(false);

    public toolbars = signal<{ [name: string]: TemplateRef<any>[] }>({});

    public addToolbarContainer(forName: string, template: TemplateRef<any>) {
        let toolbars = this.toolbars()[forName];
        if (!toolbars) {
            toolbars = [];
        }

        toolbars.push(template);
        this.toolbars.update(v => ({ ...v, [forName]: toolbars.slice() }));
    }

    public removeToolbarContainer(forName: string, template: TemplateRef<any>) {
        const toolbars = this.toolbars()[forName];
        if (!toolbars) return;
        arrayRemoveItem(toolbars, template);
        this.toolbars.update(v => ({ ...v, [forName]: toolbars.slice() }));
    }
}
