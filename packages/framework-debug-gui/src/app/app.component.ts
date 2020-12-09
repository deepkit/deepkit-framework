import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {Database} from '@deepkit/framework-debug-shared';
import {ControllerClient} from './client';

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
        </dui-window-toolbar>
      </dui-window-header>
      <dui-window-content>
        <dui-window-sidebar>
          <dui-list>
            <dui-list-title>Application</dui-list-title>
            <dui-list-item routerLink="/configuration">Configuration</dui-list-item>
            <dui-list-item routerLink="/http">HTTP</dui-list-item>
            <dui-list-item routerLink="/rpc">RPC</dui-list-item>
            <dui-list-item routerLink="/events">Events</dui-list-item>
<!--            <dui-list-item routerLink="/message-bus">Message bus</dui-list-item>-->

<!--            <dui-list-title>Database</dui-list-title>-->
<!--            <ng-container *ngIf="databases.length">-->
<!--              <ng-container *ngFor="let db of databases">-->
<!--                <dui-list-item style="padding-left: 10px;" routerLink="/database/{{db.name}}">-->
<!--                  <dui-icon style="position: relative; top: -1px; color: var(&#45;&#45;text-grey);" name="triangle_down"></dui-icon>-->
<!--                  {{db.name}} ({{db.adapter}})-->
<!--                </dui-list-item>-->

<!--                <ng-container>-->
<!--                  <dui-list-item-->
<!--                    *ngFor="let entity of db.entities"-->
<!--                    style="padding-left: 32px;">{{entity.className}} ({{entity.name}})</dui-list-item>-->
<!--                </ng-container>-->
<!--              </ng-container>-->
<!--            </ng-container>-->

<!--            <dui-list-title>HTTP Requests</dui-list-title>-->
<!--            <dui-list-item routerLink="/rpc-client/1">Request 3</dui-list-item>-->
<!--            <dui-list-item routerLink="/rpc-client/1">Request 2</dui-list-item>-->
<!--            <dui-list-item routerLink="/rpc-client/1">Request 1</dui-list-item>-->

<!--            <dui-list-title>RPC Clients</dui-list-title>-->
<!--            <dui-list-item routerLink="/rpc-client/1">Client 1</dui-list-item>-->
<!--            <dui-list-item routerLink="/rpc-client/2">Client 2</dui-list-item>-->
          </dui-list>
        </dui-window-sidebar>
        <router-outlet></router-outlet>
      </dui-window-content>
    </dui-window>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  databases: Database[] = [];

  constructor(
    protected controllerClient: ControllerClient,
    protected cd: ChangeDetectorRef
  ) {
  }

  async ngOnInit() {
    this.databases = await this.controllerClient.debug.databases();
    this.cd.detectChanges();
  }

}
