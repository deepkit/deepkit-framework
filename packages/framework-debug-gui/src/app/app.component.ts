import {Component} from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <dui-window>
      <dui-window-header size="small">
        <dui-window-toolbar>
          <dui-button-group>
            <div style="position: relative; top: -2px;">
              <img style="width: 16px; vertical-align: text-bottom; margin-left: 4px;" src="/assets/deepkit_white.svg" />
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
            <dui-list-item routerLink="/cli">CLI</dui-list-item>

            <dui-list-title>Database</dui-list-title>
            <dui-list-item routerLink="/database/sqlite">sqlite (SQLite)</dui-list-item>

            <dui-list-title>Log</dui-list-title>
            <dui-list-item routerLink="/logs">Logs</dui-list-item>
            <dui-list-item routerLink="/message-bus">Message bus</dui-list-item>
            <dui-list-item routerLink="/http-requests">HTTP requests</dui-list-item>

            <dui-list-title>RPC Live</dui-list-title>
            <dui-list-item routerLink="/rpc-client/1">Client 1</dui-list-item>
            <dui-list-item routerLink="/rpc-client/2">Client 2</dui-list-item>
          </dui-list>
        </dui-window-sidebar>
        <router-outlet></router-outlet>
      </dui-window-content>
    </dui-window>
  `,
  styles: []
})
export class AppComponent {
}
