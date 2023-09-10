/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectorRef, Injectable, TemplateRef, ViewContainerRef } from '@angular/core';
import { ButtonGroupComponent } from '../button/button.component';
import { WindowHeaderComponent, WindowToolbarContainerComponent } from './window-header.component';
import { arrayRemoveItem } from '@deepkit/core';
import { WindowComponent } from './window.component';
import { WindowMenuState } from './window-menu';
import { BehaviorSubject } from 'rxjs';
import { detectChangesNextFrame } from '../app/utils';

@Injectable()
export class WindowRegistry {
    id = 0;

    registry = new Map<WindowComponent, {
        state: WindowState,
        menu: WindowMenuState,
        cd: ChangeDetectorRef,
        viewContainerRef: ViewContainerRef
    }>();

    windowHistory: WindowComponent[] = [];
    activeWindow?: WindowComponent;

    /**
     * When BrowserWindow of electron is focused.
     */
    public focused = new BehaviorSubject(false);

    constructor() {
        this.focused.subscribe((v) => {
            for (const win of this.registry.values()) {
                win.state.focus.next(v);
            }
            detectChangesNextFrame();
        });
    }

    getAllElectronWindows(): any[] {
        return [...this.registry.keys()].filter(v => !!v.electronWindow).map(v => v.electronWindow);
    }

    register(win: WindowComponent, cd: ChangeDetectorRef, state: WindowState, menu: WindowMenuState, viewContainerRef: ViewContainerRef) {
        this.id++;
        win.id = this.id;

        this.registry.set(win, {
            state, menu, cd, viewContainerRef
        });
    }

    /**
     * Finds the activeWindow and returns its most outer parent.
     */
    getOuterActiveWindow(): WindowComponent | undefined {
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

    focus(win: WindowComponent) {
        if (this.activeWindow === win) return;

        const reg = this.registry.get(win);
        if (!reg) throw new Error('Window not registered');

        this.activeWindow = win;

        arrayRemoveItem(this.windowHistory, win);
        this.windowHistory.push(win);

        reg.state.focus.next(true);
        reg.menu.focus();
        detectChangesNextFrame();
    }

    blur(win: WindowComponent) {
        const reg = this.registry.get(win);
        if (reg) {
            reg.state.focus.next(false);
        }
        if (this.activeWindow === win) {
            delete this.activeWindow;
        }

        detectChangesNextFrame();
    }

    unregister(win: WindowComponent) {
        const reg = this.registry.get(win);
        if (reg) {
            reg.state.focus.next(false);
        }

        this.registry.delete(win);
        arrayRemoveItem(this.windowHistory, win);

        if (this.windowHistory.length) {
            this.focus(this.windowHistory[this.windowHistory.length - 1]);
        }
        detectChangesNextFrame();
    }
}

@Injectable()
export class WindowState {
    public buttonGroupAlignedToSidebar?: ButtonGroupComponent;
    public header?: WindowHeaderComponent;
    public focus = new BehaviorSubject<boolean>(false);
    public disableInputs = new BehaviorSubject<boolean>(false);

    public toolbars: { [name: string]: TemplateRef<any>[] } = {};
    public toolbarContainers: { [name: string]: WindowToolbarContainerComponent } = {};

    closable = true;
    maximizable = true;
    minimizable = true;

    constructor() {
    }

    public addToolbarContainer(forName: string, template: TemplateRef<any>) {
        if (!this.toolbars[forName]) {
            this.toolbars[forName] = []
        }

        this.toolbars[forName].push(template);

        if (this.toolbarContainers[forName]) {
            this.toolbarContainers[forName].toolbarsUpdated();
        }
    }

    public removeToolbarContainer(forName: string, template: TemplateRef<any>) {
        arrayRemoveItem(this.toolbars[forName], template);
        if (this.toolbarContainers[forName]) {
            this.toolbarContainers[forName].toolbarsUpdated();
        }
    }
}
