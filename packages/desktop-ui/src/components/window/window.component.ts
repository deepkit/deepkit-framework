/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectionStrategy, Component, contentChild, inject, input, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { WindowContentComponent } from './window-content.component';
import { Win, WindowRegistry, WindowState } from './window-state';
import { WindowMenuState } from './window-menu';
import { WindowHeaderComponent } from './window-header.component';
import { DuiApp } from '../app/app';
import { BrowserWindow } from '../../core/utils';

/**
 * This is only for documentation purposes.
 */
@Component({
    selector: 'dui-window-frame',
    template: '<ng-content></ng-content>',
    styleUrls: ['./window-frame.component.scss'],
    host: {
        '[style.height]': `height() ? height() + 'px' : 'auto'`,
        '[class.dui-normalized]': 'true',
    },
})
export class WindowFrameComponent {
    height = input<number>(350);
}

@Component({
    selector: 'dui-window',
    template: '<ng-content></ng-content>@if (windowState.disableInputs()) {<div (mousedown)="$event.preventDefault();" class="disable-inputs"></div>}',
    styleUrl: './window.component.scss',
    host: {
        '[class.in-dialog]': 'dialog()',
        '[class.dui-theme-light]': '!app.themeDetection',
        '[class.dui-body]': 'true',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        WindowState,
        WindowMenuState,
    ],
})
export class WindowComponent implements OnInit, OnDestroy, Win {
    public id = 0;

    content = contentChild(WindowContentComponent);
    header = contentChild(WindowHeaderComponent);

    closable = input(true);
    maximizable = input(true);
    minimizable = input(true);
    dialog = input(false);

    protected onBlur = () => {
        this.registry.blur(this);
    };

    protected onFocus = () => {
        this.registry.focus(this);
    };

    registry = inject(WindowRegistry);
    windowState = inject(WindowState);
    app = inject(DuiApp);
    viewContainerRef = inject(ViewContainerRef);
    windowMenuState = inject(WindowMenuState);
    parentWindow = inject(WindowComponent, { optional: true, skipSelf: true });
    browserWindow = inject(BrowserWindow);

    constructor() {
        this.registry.register(this, this.windowState, this.windowMenuState, this.viewContainerRef);
        this.registry.focus(this);
    }

    ngOnInit() {
        if (this.browserWindow && !this.dialog()) {
            this.browserWindow.addListener('blur', this.onBlur);
            this.browserWindow.addListener('focus', this.onFocus);
            this.browserWindow.setVibrancy(this.app.getVibrancy());
        }
    }

    ngOnDestroy() {
        if (this.browserWindow && !this.dialog()) {
            this.browserWindow.removeListener('blur', this.onBlur);
            this.browserWindow.removeListener('focus', this.onFocus);
        }
        this.registry.unregister(this);
    }

    public getClosestNonDialogWindow(): WindowComponent | undefined {
        if (!this.dialog()) {
            return this;
        }

        if (this.parentWindow) {
            if (this.parentWindow.dialog()) {
                return this.parentWindow.getClosestNonDialogWindow();
            }
            return this.parentWindow;
        }
    }
}
