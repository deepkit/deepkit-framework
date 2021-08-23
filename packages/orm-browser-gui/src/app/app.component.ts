/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { DuiApp } from '@deepkit/desktop-ui';
import { BrowserState } from './browser-state';
import { ControllerClient } from './client';

@Component({
    selector: 'app-root',
    template: `
        <dui-window>
            <dui-window-header size="small">
                <dui-window-toolbar>
                    <dui-button-group>
                        <div style="position: relative; top: 0px;">
                            <img class="logo visible-for-dark-mode" src="assets/deepkit_white.svg"/>
                            <img class="logo visible-for-white-mode" theme-white src="assets/deepkit_black.svg"/>

                            <span class="app-label">ORM Browser</span>
                        </div>
                    </dui-button-group>

                    <dui-button-group float="sidebar">
                        <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                    icon="toggle_sidebar"></dui-button>
                    </dui-button-group>

                    <dui-window-toolbar-container name="orm-browser"></dui-window-toolbar-container>

                    <div class="top-right">
                        <div class="connection-info">
                            <div class="connected" *ngIf="client.client.transporter.connection|async as connected">
                                Connected
                            </div>
                            <div class="disconnected" *ngIf="!(client.client.transporter.connection|async)">
                                Disconnected
                            </div>
                        </div>

                        <dui-icon clickable name="color-theme" [openDropdown]="darkModeDropdown"></dui-icon>
                        <dui-dropdown #darkModeDropdown>
                            <dui-dropdown-item (click)="duiApp.setDarkMode(undefined)" [selected]="!duiApp.isDarkModeOverwritten()">Auto</dui-dropdown-item>
                            <dui-dropdown-item (click)="duiApp.setDarkMode(false)" [selected]="duiApp.isDarkModeOverwritten() && !duiApp.isDarkMode()">Light</dui-dropdown-item>
                            <dui-dropdown-item (click)="duiApp.setDarkMode(true)" [selected]="duiApp.isDarkModeOverwritten() && duiApp.isDarkMode()">Dark</dui-dropdown-item>
                        </dui-dropdown>
                    </div>
                </dui-window-toolbar>
            </dui-window-header>
            <dui-window-content [sidebarVisible]="sidebarVisible">
                <dui-window-sidebar>
                    <dui-list>
                        <dui-list-title>Database</dui-list-title>
                        <orm-browser-list></orm-browser-list>

                    </dui-list>
                </dui-window-sidebar>
                <router-outlet></router-outlet>
            </dui-window-content>
        </dui-window>
    `,
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
    sidebarVisible: boolean = true;

    constructor(
        public duiApp: DuiApp,
        public client: ControllerClient,
        protected cd: ChangeDetectorRef,
        public state: BrowserState,
    ) {
    }

    ngOnDestroy(): void {
    }

    async ngOnInit() {
        this.cd.detectChanges();
    }
}
