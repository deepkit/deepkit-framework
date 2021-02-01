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
import { DatabaseInfo } from '@deepkit/orm-browser-api';
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
              <span style="margin-left: 8px; display: inline-block; color: var(--text-grey)">ORM Browser</span>
            </div>
          </dui-button-group>

          <dui-window-toolbar-container name="browser"></dui-window-toolbar-container>
        </dui-window-toolbar>
      </dui-window-header>
      <dui-window-content>
        <dui-window-sidebar>
          <dui-list>
            <dui-list-title>Database</dui-list-title>
            <dui-list-item *ngFor="let db of databases" routerLink="/db/{{db.name}}">{{db.name}} ({{db.adapter}})</dui-list-item>
          </dui-list>
        </dui-window-sidebar>
        <router-outlet></router-outlet>
      </dui-window-content>
    </dui-window>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  databases: DatabaseInfo[] = [];

  constructor(
    protected controllerClient: ControllerClient,
    protected cd: ChangeDetectorRef
  ) {
  }

  ngOnDestroy(): void {
  }

  async ngOnInit() {
    this.databases = await this.controllerClient.browser.getDatabases();
    this.cd.detectChanges();
  }
}
