import { Component } from '@angular/core';

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

                    <dui-button-group>
                    </dui-button-group>

                    <dui-window-toolbar-container name="main"></dui-window-toolbar-container>
                    <dui-window-toolbar-container name="orm-browser"></dui-window-toolbar-container>
                </dui-window-toolbar>
            </dui-window-header>
            <dui-window-content [sidebarVisible]="sidebarVisible" class="no-padding">
                <router-outlet></router-outlet>
            </dui-window-content>
        </dui-window>
    `,
    styles: [`
        .logo {
            width: 16px;
            vertical-align: text-bottom;
            margin-left: 4px;
        }

        :host ::ng-deep dui-window-content.no-padding > .content {
            padding: 0 !important;
        }
    `]
})
export class AppComponent {
    sidebarVisible: boolean = true;
}
