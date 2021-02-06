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
import { BrowserState } from './browser-state';
import { ClassSchema } from '@deepkit/type';

@Component({
  selector: 'app-root',
  template: `
    <dui-window>
      <dui-window-header size="small">
        {{state.entity ? state.entity.getClassName() : ''}}
        <dui-window-toolbar>
          <dui-button-group>
                <div style="position: relative; top: 0px;">
                  <img class="logo visible-for-dark-mode" src="assets/deepkit_white.svg"/>
                  <img class="logo visible-for-white-mode" theme-white src="assets/deepkit_black.svg"/>

                  <span style="margin-left: 8px; display: inline-block; color: var(--text-grey)">ORM Browser</span>
                </div>
            </dui-button-group>

          <dui-button-group float="sidebar">
              <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                          icon="toggle_sidebar"></dui-button>
          </dui-button-group>

          <dui-window-toolbar-container name="browser"></dui-window-toolbar-container>
        </dui-window-toolbar>
      </dui-window-header>
      <dui-window-content [sidebarVisible]="sidebarVisible">
        <dui-window-sidebar>
          <dui-list>
            <dui-list-title>Database</dui-list-title>
            <orm-browser-list></orm-browser-list>
            
          </dui-list>
        </dui-window-sidebar>
        <orm-browser-database *ngIf="state.database && !state.entity" [database]="state.database"></orm-browser-database>
        <orm-browser-database-browser *ngIf="state.database && state.entity" [database]="state.database" [entity]="state.entity"></orm-browser-database-browser>
      </dui-window-content>
    </dui-window>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  sidebarVisible: boolean = true;

  constructor(
    protected controllerClient: ControllerClient,
    protected cd: ChangeDetectorRef,
    public state: BrowserState,
  ) {
  }

  ngOnDestroy(): void {
  }

  async ngOnInit() {
    this.state.databases = await this.controllerClient.browser.getDatabases();
    this.cd.detectChanges();
  }
}
