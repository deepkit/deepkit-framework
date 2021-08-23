import { Component } from '@angular/core';
import { DuiApp } from '@deepkit/desktop-ui';
import { ControllerClient } from './client';

@Component({
    selector: 'app-root',
    template: `
        <dui-window>
            <dui-window-header size="small">
                <dui-window-toolbar>
                    <dui-button-group>
                        <div style="position: relative; top: -2px;">
                            <img class="logo visible-for-dark-mode" src="assets/deepkit_white.svg"/>
                            <img class="logo visible-for-white-mode" theme-white src="assets/deepkit_black.svg"/>
                            <span style="margin-left: 8px; display: inline-block; color: var(--text-grey)">API Console</span>
                        </div>
                    </dui-button-group>

                    <dui-window-toolbar-container name="main"></dui-window-toolbar-container>
                    <div class="top-right">
                        <div>
                            <a routerLink="/api">OVERVIEW</a>
                        </div>

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
            <dui-window-content [sidebarVisible]="sidebarVisible" class="no-padding">
                <router-outlet></router-outlet>
            </dui-window-content>
        </dui-window>
    `,
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    sidebarVisible: boolean = true;

    constructor(public duiApp: DuiApp, public client: ControllerClient) {
        client.client.transporter.disconnected.subscribe(() => {
            this.tryToConnect();
        });
    }

    tryToConnect() {
        this.client.client.connect().catch(() => {
            setTimeout(() => {
                this.tryToConnect();
            }, 1_000);
        });
    }
}
