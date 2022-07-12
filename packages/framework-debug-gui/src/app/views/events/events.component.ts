/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ControllerClient } from '../../client.js';
import { Event } from '@deepkit/framework-debug-api';

@Component({
  template: `
    <div class="header">
      <h4>Events</h4>
      <dui-input placeholder="Filter" round semiTransparent lightFocus [(ngModel)]="filterQuery"></dui-input>
    </div>
    <dui-table
      style="flex: 1 1"
      [items]="filter(events, filterQuery)" selectable defaultSort="path" noFocusOutline>
      <dui-table-column [width]="220" name="event"></dui-table-column>
      <dui-table-column [width]="250" name="controller"></dui-table-column>
      <dui-table-column [width]="220" name="methodName"></dui-table-column>
      <dui-table-column [width]="100" name="priority"></dui-table-column>
    </dui-table>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .header {
      display: flex;
      margin-bottom: 15px;
    }

    .header dui-input {
      margin-left: auto;
    }
  `]
})
export class EventsComponent implements OnInit {
  public events: Event[] = [];

  public filterQuery: string = '';

  constructor(
    private controllerClient: ControllerClient,
    public cd: ChangeDetectorRef,
  ) {
  }

  filter(items: Event[], filter: string): any[] {
    if (!filter) return items;

    return items.filter(v => (v.controller.includes(filter) || v.methodName.includes(filter)));
  }

  async ngOnInit(): Promise<void> {
    this.events = await this.controllerClient.debug.events();

    this.cd.detectChanges();
  }

}
