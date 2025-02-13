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
import { DuiApp, observe } from '@deepkit/desktop-ui';
import { Database, DebugRequest, Filesystem } from '@deepkit/framework-debug-api';
import { Collection } from '@deepkit/rpc';
import { ControllerClient } from './client';
import { Router } from '@angular/router';

@Component({
    selector: 'app-root',
    template: `
        <dui-window>
            <dui-window-header size="small">
                <dui-window-toolbar>
                    <dui-button-group>
                        <div style="position: relative; top: -2px; margin-right: 5px;">
                            <img class="logo visible-for-dark-mode" src="assets/deepkit_white.svg"/>
                            <img class="logo visible-for-white-mode" theme-white src="assets/deepkit_black.svg"/>
                            <span style="margin-left: 8px; display: inline-block; color: var(--text-grey)">Framework Debugger</span>
                        </div>
                    </dui-button-group>

                    <dui-button-group float="sidebar">
                        <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                    icon="toggle_sidebar"></dui-button>
                    </dui-button-group>

                    <dui-window-toolbar-container name="main"></dui-window-toolbar-container>
                    <dui-window-toolbar-container name="orm-browser"></dui-window-toolbar-container>

                    <div class="top-right">
                        <app-file-uploader></app-file-uploader>

                        <div class="connection-info">
                            <div class="connected" *ngIf="client.client.transporter.connection|asyncRender as connected">
                                Connected
                            </div>
                            <div class="disconnected" *ngIf="!(client.client.transporter.connection|asyncRender)">
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
            <dui-window-content [sidebarVisible]="sidebarVisible" [class.no-padding]="router.url.startsWith('/database/') || router.url.startsWith('/api/')">
                <dui-window-sidebar>
                    <dui-list>
                        <dui-list-title>Application</dui-list-title>
                        <dui-list-item routerLink="/configuration">Configuration</dui-list-item>
                        <dui-list-item routerLink="/http" [routerLinkExact]="true">HTTP</dui-list-item>
                        <dui-list-item routerLink="/rpc">RPC</dui-list-item>
                        <dui-list-item routerLink="/events">Events</dui-list-item>
                        <dui-list-item routerLink="/modules">Modules</dui-list-item>
                        <dui-list-item routerLink="/profiler">Profiler</dui-list-item>
                        <dui-list-item routerLink="/api/console">API</dui-list-item>
                        <dui-list-item routerLink="/broker">Broker</dui-list-item>
                        <dui-list-item routerLink="/http/request">HTTP Requests</dui-list-item>

                        <dui-list-title>Filesystem</dui-list-title>
                        <ng-container *ngFor="let filesystem of filesystems; let i = index">
                            <dui-list-item routerLink="/filesystem/{{i}}">{{filesystem.name}}</dui-list-item>
                        </ng-container>

                        <dui-list-title>Database</dui-list-title>
                        <orm-browser-list></orm-browser-list>

                        <ng-container *ngIf="requests|async as rs">
                            <ng-container *ngIf="rs.length > 0">
                                <dui-list-title>HTTP Requests</dui-list-title>
                                <ng-container *ngFor="let request of filterRequests(rs)">
                                    <dui-list-item routerLink="/http/request/{{request.id}}">
                                        <div class="request-line">
                                            <div class="id">#{{request.id}}</div>
                                            <div class="method">{{request.method}}</div>
                                            <div class="status">{{request.statusCode}}</div>
                                            <div class="icons"></div>
                                        </div>
                                        <div class="request-subline">
                                            {{request.url}}
                                        </div>
                                    </dui-list-item>
                                </ng-container>
                            </ng-container>
                        </ng-container>
                    </dui-list>
                </dui-window-sidebar>
                <router-outlet></router-outlet>
            </dui-window-content>
        </dui-window>
    `,
    styleUrls: ['./app.component.scss'],
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
    databases: Database[] = [];
    filesystems: Filesystem[] = [];

    sidebarVisible: boolean = true;

    @observe()
    requests?: Collection<DebugRequest>;

    constructor(
        public duiApp: DuiApp,
        public client: ControllerClient,
        protected cd: ChangeDetectorRef,
        public router: Router,
    ) {
        client.client.transporter.reconnected.subscribe(() => {
            this.load();
        });
    }

    ngOnDestroy(): void {
    }

    filterRequests(requests: DebugRequest[]): DebugRequest[] {
        requests.sort(function (a, b) {
            if (a.id > b.id) return -1;
            if (a.id < b.id) return +1;
            return 0;
        });
        return requests.slice(0, 10);
    }

    // get requestObservable(): Observable<DebugRequest[]> | undefined {
    //     return this.requests;
    // }

    async load() {
        this.databases = await this.client.debug.databases();
        this.filesystems = await this.client.debug.filesystems();
        // this.requests = await this.controllerClient.getHttpRequests();
        this.cd.detectChanges();
    }

    async ngOnInit() {
        await this.load();
    }

}
