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
import { observe } from '@deepkit/desktop-ui';
import { Database, DebugRequest } from '@deepkit/framework-debug-api';
import { Collection } from '@deepkit/rpc';
import { Observable } from 'rxjs';
import { ControllerClient } from './client';

@Component({
    selector: 'app-root',
    template: `
        <dui-window>
            <dui-window-header size="small">
                <dui-window-toolbar>
                    <dui-button-group>
                        <div style="position: relative; top: -2px;">
                            <img style="width: 16px; vertical-align: text-bottom; margin-left: 4px;" src="assets/deepkit_white.svg"/>
                            <span style="margin-left: 8px; display: inline-block; color: var(--text-grey)">Framework Debugger</span>
                        </div>
                    </dui-button-group>

                    <dui-button-group float="sidebar">
                        <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                    icon="toggle_sidebar"></dui-button>
                    </dui-button-group>

                    <dui-window-toolbar-container name="main"></dui-window-toolbar-container>
                    <dui-window-toolbar-container name="orm-browser"></dui-window-toolbar-container>
                </dui-window-toolbar>
            </dui-window-header>
            <dui-window-content [sidebarVisible]="sidebarVisible">
                <dui-window-sidebar>
                    <dui-list>
                        <dui-list-title>Application</dui-list-title>
                        <dui-list-item routerLink="/configuration">Configuration</dui-list-item>
                        <dui-list-item routerLink="/http" [routerLinkExact]="true">HTTP</dui-list-item>
                        <dui-list-item routerLink="/rpc">RPC</dui-list-item>
                        <dui-list-item routerLink="/events">Events</dui-list-item>
                        <dui-list-item routerLink="/timeline">Timeline</dui-list-item>

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
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
    databases: Database[] = [];

    sidebarVisible: boolean = true;

    @observe()
    requests?: Collection<DebugRequest>;

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef
    ) {
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

    get requestObservable(): Observable<DebugRequest[]> | undefined {
        return this.requests;
    }

    async ngOnInit() {
        this.databases = await this.controllerClient.debug.databases();
        // this.requests = await this.controllerClient.getHttpRequests();
        this.cd.detectChanges();
    }

}
