/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectorRef, Component, ElementRef, HostBinding, OnDestroy, OnInit, SkipSelf, TemplateRef, ViewChild, forwardRef, input } from '@angular/core';
import { WindowState } from './window-state';
import { Electron } from '../../core/utils';
import { IconComponent } from '../icon/icon.component';
import { NgTemplateOutlet } from '@angular/common';

@Component({
    selector: 'dui-window-header',
    template: `
        <div class="title">
          <ng-content></ng-content>
          <div class="closer">
            <div (click)="minimize()">
              <dui-icon [size]="18" name="gnome_minimize"></dui-icon>
            </div>
            <div (click)="maximize()">
              <dui-icon [size]="18" name="gnome_maximize"></dui-icon>
            </div>
            <div (click)="close()" class="highlight">
              <dui-icon [size]="18" name="gnome_close"></dui-icon>
            </div>
          </div>
        </div>
        @if (windowState.toolbars['default']) {
          <div class="toolbar">
            <dui-window-toolbar-container></dui-window-toolbar-container>
          </div>
        }
        `,
    host: {
        '[class.inactive]': '!windowState.focus.value',
        '[class.size-default]': `size() === 'default'`,
        '[class.size-small]': `size() === 'small'`,
    },
    styleUrls: ['./window-header.component.scss'],
    imports: [IconComponent, forwardRef(() => WindowToolbarContainerComponent)]
})
export class WindowHeaderComponent implements OnDestroy {
    public size = input<'small' | 'default'>('default');

    @HostBinding('class.with-toolbar')
    get withToolbar() {
        return this.windowState.toolbars['default'] && this.windowState.toolbars['default'].length;
    }

    protected focusSub: any = this.windowState.focus.subscribe((v) => {
        this.cdParent.markForCheck();
    });

    constructor(
        public windowState: WindowState,
        protected element: ElementRef,
    ) {
        this.windowState = windowState;
    }

    ngOnDestroy() {
        this.focusSub.unsubscribe();
    }

    public getBottomPosition(): number {
        const rect = this.element.nativeElement.getBoundingClientRect();
        return rect.y + rect.height;
    }

    maximize() {
        const win = Electron.getRemote().BrowserWindow.getFocusedWindow();
        if (!win.isMaximized()) {
            Electron.getRemote().BrowserWindow.getFocusedWindow().maximize();
        } else {
            Electron.getRemote().BrowserWindow.getFocusedWindow().unmaximize();
        }
    }

    minimize() {
        Electron.getRemote().BrowserWindow.getFocusedWindow().minimize();
    }

    close() {
        Electron.getRemote().BrowserWindow.getFocusedWindow().close();
    }
}

@Component({
    selector: 'dui-window-toolbar',
    template: `
        <ng-template #templateRef>
            <ng-content></ng-content>
        </ng-template>
    `
})
export class WindowToolbarComponent implements OnDestroy, OnInit {
    for = input<string>('default');
    @ViewChild('templateRef', { static: true }) template!: TemplateRef<any>;

    constructor(protected windowState: WindowState) {
    }

    ngOnInit() {
        this.windowState.addToolbarContainer(this.for(), this.template);
    }

    ngOnDestroy(): void {
        this.windowState.removeToolbarContainer(this.for(), this.template);
    }
}

@Component({
    selector: 'dui-window-toolbar-container',
    template: `
        @if (windowState.toolbars[name()]) {
          @for (template of windowState.toolbars[name()]; track template) {
            <ng-container [ngTemplateOutlet]="template" [ngTemplateOutletContext]="{}"></ng-container>
          }
        }
        `,
    styles: [`
        :host {
            display: flex;
        }
    `],
    imports: [
    NgTemplateOutlet
],
})
export class WindowToolbarContainerComponent implements OnInit, OnDestroy {
    name = input<string>('default');

    constructor(
        public windowState: WindowState,
        protected cd: ChangeDetectorRef,
    ) {
    }

    ngOnInit() {
        const name = this.name();
        if (this.windowState.toolbarContainers[this.name()] && name === 'default') {
            console.warn(`You have multiple <dui-window-toolbar-container> with no name. This is not allowed.`);
        }
        this.windowState.toolbarContainers[name] = this;
    }

    public toolbarsUpdated() {
        this.cd.detectChanges();
    }

    ngOnDestroy(): void {
        delete this.windowState.toolbarContainers[this.name()];
    }
}
