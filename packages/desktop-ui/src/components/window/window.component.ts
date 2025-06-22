/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  Inject,
  OnChanges,
  OnDestroy,
  Optional,
  SimpleChanges,
  SkipSelf,
  ViewContainerRef,
  input
} from '@angular/core';
import { WindowContentComponent } from './window-content.component';
import { WindowRegistry, WindowState } from './window-state';
import { DOCUMENT, AsyncPipe } from '@angular/common';
import { WindowMenuState } from './window-menu';
import { WindowHeaderComponent } from './window-header.component';
import { ELECTRON_WINDOW, IN_DIALOG } from '../app/token';
import { DuiApp } from '../app';

/**
 * This is only for documentation purposes.
 */
@Component({
    selector: 'dui-window-frame',
    template: '<ng-content></ng-content>',
    styleUrls: ['./window-frame.component.scss'],
    host: {
        '[style.height]': `height() ? height() + 'px' : 'auto'`
    }
})
export class WindowFrameComponent {
    height = input<number>(350);
}

@Component({
    selector: 'dui-window',
    template: '<ng-content></ng-content>@if (windowState.disableInputs|async) {<div (mousedown)="$event.preventDefault();" class="disable-inputs"></div>}',
    styleUrls: ['./window.component.scss'],
    host: {
        '[class.in-dialog]': 'isInDialog()',
        '[class.dui-theme-light]': '!app.themeDetection',
        '[class.dui-body]': 'true',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        WindowState,
        WindowMenuState,
    ],
    imports: [AsyncPipe]
})
export class WindowComponent implements OnChanges, OnDestroy {
    public id = 0;

    @ContentChild(WindowContentComponent, { static: false }) public content?: WindowContentComponent;
    @ContentChild(WindowHeaderComponent, { static: false }) public header?: WindowHeaderComponent;

    closable = input(true);
    maximizable = input(true);
    minimizable = input(true);

    protected onBlur = () => {
        this.registry.blur(this);
    };

    protected onFocus = () => {
        this.registry.focus(this);
    };

    constructor(
        @Inject(DOCUMENT) document: Document,
        protected registry: WindowRegistry,
        public windowState: WindowState,
        cd: ChangeDetectorRef,
        public app: DuiApp,
        windowMenuState: WindowMenuState,
        public viewContainerRef: ViewContainerRef,
        @Inject(IN_DIALOG) protected inDialog: boolean,
        @SkipSelf() @Optional() protected parentWindow?: WindowComponent,
        @Inject(ELECTRON_WINDOW) public electronWindow?: any
    ) {
        registry.register(this, cd, windowState, windowMenuState, viewContainerRef);

        if (this.electronWindow && !this.isInDialog()) {
            this.electronWindow.addListener('blur', this.onBlur);
            this.electronWindow.addListener('focus', this.onFocus);
            this.electronWindow.setVibrancy(app.getVibrancy());
        }

        this.registry.focus(this);
    }

    ngOnDestroy() {
        if (this.electronWindow && !this.isInDialog()) {
            this.electronWindow.removeListener('blur', this.onBlur);
            this.electronWindow.removeListener('focus', this.onFocus);
        }
        this.registry.unregister(this);
    }

    public isInDialog(): boolean {
        return this.inDialog;
    }

    public getClosestNonDialogWindow(): WindowComponent | undefined {
        if (!this.isInDialog()) {
            return this;
        }

        if (this.parentWindow) {
            if (this.parentWindow.isInDialog()) {
                return this.parentWindow.getClosestNonDialogWindow();
            }
            return this.parentWindow;
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        this.windowState.closable = this.closable();
        this.windowState.minimizable = this.minimizable();
        this.windowState.maximizable = this.maximizable();
    }
}
