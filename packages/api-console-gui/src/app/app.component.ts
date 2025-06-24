import { Component, ElementRef } from '@angular/core';
import { DuiApp, DuiStyleComponent, WindowComponent, WindowContentComponent, WindowHeaderComponent, WindowToolbarComponent, WindowToolbarContainerComponent } from '@deepkit/desktop-ui';
import { ControllerClient } from './client';
import { HeaderLogoComponent, HeaderStatusBarComponent } from '@deepkit/ui-library';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    template: `
      <dui-style />
      <dui-window class="dui-normalized">
        <dui-window-header size="small">
          <dui-window-toolbar>
            <deepkit-header-logo title="API Console"></deepkit-header-logo>

            <dui-window-toolbar-container name="main"></dui-window-toolbar-container>
            <div class="top-right">
              <div>
                <a routerLink="/api">OVERVIEW</a>
              </div>
              <deepkit-header-status-bar [client]="client.client"></deepkit-header-status-bar>
            </div>
          </dui-window-toolbar>
        </dui-window-header>
        <dui-window-content [sidebarVisible]="sidebarVisible" class="no-padding">
          <router-outlet></router-outlet>
        </dui-window-content>
      </dui-window>
    `,
    imports: [
        WindowComponent,
        DuiStyleComponent,
        WindowHeaderComponent,
        WindowToolbarComponent,
        HeaderLogoComponent,
        WindowToolbarContainerComponent,
        HeaderStatusBarComponent,
        WindowContentComponent,
        RouterOutlet,
        RouterLink,
    ],
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {
    sidebarVisible: boolean = true;

    constructor(
        public duiApp: DuiApp,
        public client: ControllerClient,
        public host: ElementRef<HTMLElement>,
    ) {
        const controller = host.nativeElement.getAttribute('controller');
        if (controller && controller !== 'APP_CONTROLLER_NAME') {
            this.client.setController(controller);
        }
    }
}
