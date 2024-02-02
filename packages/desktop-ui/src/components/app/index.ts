/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ApplicationRef, Component, Directive, HostBinding, Inject, Injectable, Input, ModuleWithProviders, NgModule, Optional, Renderer2, RendererFactory2 } from '@angular/core';
import { MenuCheckboxDirective, MenuDirective, MenuItemDirective, MenuRadioDirective, MenuSeparatorDirective } from './menu.component';
import { detectChangesNextFrame, OpenExternalDirective, ZonelessChangeDetector } from './utils';
import { ViewDirective } from './dui-view.directive';
import { CdCounterComponent } from './cd-counter.component';
import { DuiResponsiveDirective } from './dui-responsive.directive';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Electron } from '../../core/utils';
import { ActivationEnd, NavigationEnd, Router } from '@angular/router';
import { WindowRegistry } from '../window/window-state';
import { ELECTRON_WINDOW, IN_DIALOG } from './token';
import { AsyncRenderPipe, HumanFileSizePipe, ObjectURLPipe } from './pipes';
import { ReactiveChangeDetectionModule } from './reactivate-change-detection';
import { arrayRemoveItem } from '@deepkit/core';
import { EventDispatcher } from '@deepkit/event';

export * from './reactivate-change-detection';
export * from './cd-counter.component';
export * from './dui-view.directive';
export * from './dui-responsive.directive';
export * from './utils';
export * from './menu.component';
export * from './pipes';
export * from './state';

if ('undefined' !== typeof window && 'undefined' === typeof (window as any)['global']) {
    (window as any).global = window;
}

@Directive()
export class BaseComponent {
    @Input() disabled?: boolean;

    @HostBinding('class.disabled')
    get isDisabled() {
        return this.disabled === true;
    }
}

@Component({
    selector: 'ui-component',
    template: `
        {{name}} disabled={{isDisabled}}
    `,
    styles: [`
        :host {
            display: inline-block;
        }

        :host.disabled {
            border: 1px solid red;
        }
    `],
    host: {
        '[class.is-textarea]': 'name === "textarea"',
    }
})
export class UiComponentComponent extends BaseComponent {
    @Input() name: string = '';
}

export class OverlayStackItem {
    constructor(public host: HTMLElement, protected stack: OverlayStackItem[], public release: () => void) {
    }

    getAllAfter(): OverlayStackItem[] {
        const result: OverlayStackItem[] = [];

        let flip = false;
        for (let i = 0; i < this.stack.length; i++) {
            if (flip) result.push(this.stack[i]);
            if (this.stack[i] === this) flip = true;
        }
        return result;
    }

    getPrevious(): OverlayStackItem | undefined {
        const before = this.getAllBefore();
        return before.length ? before[before.length - 1] : undefined;
    }

    isLast(): boolean {
        return this.getAllAfter().length === 0;
    }

    getAllBefore(): OverlayStackItem[] {
        const result: OverlayStackItem[] = [];

        for (let i = 0; i < this.stack.length; i++) {
            if (this.stack[i] === this) return result;
            result.push(this.stack[i]);
        }
        return result;
    }
}

export class OverlayStack {
    public stack: OverlayStackItem[] = [];

    public register(host: HTMLElement): OverlayStackItem {
        const item = new OverlayStackItem(host, this.stack, () => {
            const before = item.getPrevious();
            if (before) before.host.focus();
            arrayRemoveItem(this.stack, item);
        });
        this.stack.push(item);
        return item;
    }
}

@Injectable()
export class Storage {
    getItem(key: string): any {
        return 'undefined' === typeof localStorage ? undefined : localStorage.getItem(key);
    }

    setItem(key: string, value: any): void {
        if ('undefined' === typeof localStorage) return;
        localStorage.setItem(key, value);
    }

    removeItem(key: string): void {
        if ('undefined' === typeof localStorage) return;
        localStorage.removeItem(key);
    }
}

@Injectable()
export class DuiApp {
    protected darkMode?: boolean = false;
    protected platform: 'web' | 'darwin' | 'linux' | 'win32' = 'darwin';
    public themeDetection: boolean = true;

    render: Renderer2;

    constructor(
        protected app: ApplicationRef,
        @Inject(DOCUMENT) protected document: Document,
        rendererFactory: RendererFactory2,
        protected storage: Storage,
        @Optional() protected windowRegistry?: WindowRegistry,
        @Optional() protected router?: Router
    ) {
        this.render = rendererFactory.createRenderer(null, null);
        ZonelessChangeDetector.app = app;
        if ('undefined' !== typeof window) {
            (window as any)['DuiApp'] = this;
        }
    }

    start() {
        if (Electron.isAvailable()) {
            this.render.addClass(this.document.body, 'electron');

            const remote = Electron.getRemote();

            this.setPlatform(remote.process.platform);
        } else {
            this.setPlatform('web');
        }

        if (this.themeDetection) {
            let overwrittenDarkMode = this.storage.getItem('duiApp/darkMode');
            if (overwrittenDarkMode) {
                this.setDarkMode(JSON.parse(overwrittenDarkMode));
            } else {
                this.setDarkMode();
            }

            if ('undefined' !== typeof window) {
                const mm = window.matchMedia('(prefers-color-scheme: dark)');
                const setTheme = () => {
                    if (!this.themeDetection) return;
                    if (this.storage.getItem('duiApp/darkMode') === null) {
                        this.setAutoDarkMode();
                        this.app.tick();
                    }
                };
                if (mm.addEventListener) {
                    mm.addEventListener('change', setTheme);
                } else {
                    //ios
                    mm.addListener(setTheme);
                }
            }
        }

        if ('undefined' !== typeof document) {
            document.addEventListener('click', () => detectChangesNextFrame());
            document.addEventListener('focus', () => detectChangesNextFrame());
            document.addEventListener('blur', () => detectChangesNextFrame());
            document.addEventListener('keydown', () => detectChangesNextFrame());
            document.addEventListener('keyup', () => detectChangesNextFrame());
            document.addEventListener('keypress', () => detectChangesNextFrame());
            document.addEventListener('mousedown', () => detectChangesNextFrame());
        }

        //necessary to render all router-outlet once the router changes
        if (this.router) {
            this.router.events.subscribe((event) => {
                if (event instanceof NavigationEnd || event instanceof ActivationEnd) {
                    detectChangesNextFrame();
                }
            }, () => undefined);
        }
    }

    setPlatform(platform: 'web' | 'darwin' | 'linux' | 'win32') {
        this.platform = platform;
        //deprecate these
        this.render.removeClass(this.document.body, 'platform-linux');
        this.render.removeClass(this.document.body, 'platform-darwin');
        this.render.removeClass(this.document.body, 'platform-win32');
        this.render.removeClass(this.document.body, 'platform-native');
        this.render.removeClass(this.document.body, 'platform-web');

        this.render.removeClass(this.document.body, 'dui-platform-linux');
        this.render.removeClass(this.document.body, 'dui-platform-darwin');
        this.render.removeClass(this.document.body, 'dui-platform-win32');
        this.render.removeClass(this.document.body, 'dui-platform-native');
        this.render.removeClass(this.document.body, 'dui-platform-web');

        if (this.platform !== 'web') {
            this.render.addClass(this.document.body, 'platform-native'); //todo: deprecate
            this.render.addClass(this.document.body, 'dui-platform-native');

        }
        this.render.addClass(this.document.body, 'platform-' + platform);//todo: deprecate
        this.render.addClass(this.document.body, 'dui-platform-' + platform);
    }

    getPlatform(): string {
        return this.platform;
    }

    isDarkMode(): boolean {
        return this.darkMode === true;
    }

    setAutoDarkMode(): void {
        this.setDarkMode();
    }

    get theme(): 'auto' | 'light' | 'dark' {
        if (this.isDarkModeOverwritten()) {
            return this.isDarkMode() ? 'dark' : 'light';
        }

        return 'auto';
    }

    set theme(theme: 'auto' | 'light' | 'dark') {
        if (theme === 'auto') {
            this.setAutoDarkMode();
            return;
        }

        this.setDarkMode(theme === 'dark');
    }

    isDarkModeOverwritten(): boolean {
        return this.storage.getItem('duiApp/darkMode') !== null;
    }

    setGlobalDarkMode(darkMode: boolean): void {
        if (Electron.isAvailable()) {
            const remote = Electron.getRemote();
            for (const win of remote.BrowserWindow.getAllWindows()) {
                win.webContents.executeJavaScript(`DuiApp.setDarkMode(${darkMode})`);
            }
        }
    }

    getVibrancy(): 'ultra-dark' | 'light' {
        return this.darkMode ? 'ultra-dark' : 'light';
    }

    disableThemeDetection() {
        this.render.removeClass(this.document.body, 'dui-theme-dark');
        this.render.removeClass(this.document.body, 'dui-theme-light');
        this.themeDetection = false;
    }

    setDarkMode(darkMode?: boolean) {
        if (darkMode === undefined) {
            this.darkMode = this.isPreferDarkColorSchema();
            this.storage.removeItem('duiApp/darkMode');
        } else {
            this.storage.setItem('duiApp/darkMode', JSON.stringify(darkMode));
            this.darkMode = darkMode;
        }

        if (this.windowRegistry) {
            for (const win of this.windowRegistry.getAllElectronWindows()) {
                win.setVibrancy(this.getVibrancy());
            }
        }

        this.render.removeClass(this.document.body, 'dui-theme-dark');
        this.render.removeClass(this.document.body, 'dui-theme-light');
        this.render.addClass(this.document.body, this.darkMode ? 'dui-theme-dark' : 'dui-theme-light');

        if ('undefined' !== typeof window) window.dispatchEvent(new Event('theme-changed'));
    }

    protected isPreferDarkColorSchema() {
        if ('undefined' === typeof window) return true;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
}

@NgModule({
    declarations: [
        UiComponentComponent,
        MenuDirective,
        MenuSeparatorDirective,
        MenuRadioDirective,
        MenuCheckboxDirective,
        MenuItemDirective,
        OpenExternalDirective,
        ViewDirective,
        CdCounterComponent,
        DuiResponsiveDirective,
        AsyncRenderPipe,
        ObjectURLPipe,
        HumanFileSizePipe,
    ],
    exports: [
        UiComponentComponent,
        MenuDirective,
        MenuSeparatorDirective,
        MenuRadioDirective,
        MenuCheckboxDirective,
        MenuItemDirective,
        OpenExternalDirective,
        ViewDirective,
        CdCounterComponent,
        DuiResponsiveDirective,
        AsyncRenderPipe,
        ObjectURLPipe,
        HumanFileSizePipe,
    ],
    providers: [
        OverlayStack,
    ],
    imports: [
        CommonModule,
        ReactiveChangeDetectionModule,
    ]
})
export class DuiAppModule {
    constructor(app: DuiApp, @Inject(DOCUMENT) @Optional() document: Document) {
        app.start();
        if (document && Electron.isAvailable()) {
            document.addEventListener('click', (event: MouseEvent) => {
                if (event.target) {
                    const target = event.target as HTMLElement;
                    if (target.tagName.toLowerCase() === 'a') {
                        event.preventDefault();
                        event.stopPropagation();
                        Electron.getRemote().shell.openExternal((target as any).href);
                    }
                }
            });
        }
    }

    static forRoot(): ModuleWithProviders<DuiAppModule> {
        return {
            ngModule: DuiAppModule,
            providers: [
                DuiApp,
                Storage,
                { provide: EventDispatcher, useValue: new EventDispatcher().fork() },
                { provide: IN_DIALOG, useValue: false },
                {
                    provide: ELECTRON_WINDOW,
                    useValue: Electron.isAvailable() ? Electron.getRemote().BrowserWindow.getAllWindows()[0] : undefined
                },
            ]
        };
    }
}
