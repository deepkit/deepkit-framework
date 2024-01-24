import { Component } from '@angular/core';

import { DuiApp } from '@deepkit/desktop-ui';
import { DeepkitClient } from '@deepkit/rpc';

@Component({
    selector: 'deepkit-header-status-bar',
    template: `
        <div class="connection-info">
            <div class="connected" *ngIf="client.transporter.connection | asyncRender as connected">Connected</div>
            <div class="disconnected" *ngIf="!(client.transporter.connection | asyncRender)">Disconnected</div>
        </div>

        <dui-icon clickable name="color-theme" [openDropdown]="darkModeDropdown"></dui-icon>
        <dui-dropdown #darkModeDropdown>
            <dui-dropdown-item (click)="duiApp.setDarkMode(undefined)" [selected]="!duiApp.isDarkModeOverwritten()"
                >Auto</dui-dropdown-item
            >
            <dui-dropdown-item
                (click)="duiApp.setDarkMode(false)"
                [selected]="duiApp.isDarkModeOverwritten() && !duiApp.isDarkMode()"
                >Light</dui-dropdown-item
            >
            <dui-dropdown-item
                (click)="duiApp.setDarkMode(true)"
                [selected]="duiApp.isDarkModeOverwritten() && duiApp.isDarkMode()"
                >Dark</dui-dropdown-item
            >
        </dui-dropdown>
    `,
    styles: [
        `
            :host {
                display: flex;
                align-items: center;
            }
            .connection-info {
                margin-right: 3px;
                font-size: 10px;
                text-transform: uppercase;
            }

            .connected {
                color: var(--color-green);
            }

            .disconnected {
                color: var(--color-red);
            }
        `,
    ],
})
export class HeaderStatusBarComponent {
    constructor(
        public client: DeepkitClient,
        public duiApp: DuiApp,
    ) {}
}
