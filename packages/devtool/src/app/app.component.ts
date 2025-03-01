import { Component, ElementRef } from '@angular/core';
import { DuiApp, DuiWindowModule } from '@deepkit/desktop-ui';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    template: `
        <dui-window>
            <dui-window-content class="no-padding text-selection">
                <router-outlet></router-outlet>
            </dui-window-content>
        </dui-window>
    `,
    imports: [
        DuiWindowModule,
        RouterOutlet,
    ],
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {
    sidebarVisible: boolean = true;

    constructor(
        public duiApp: DuiApp,
        // public client: ControllerClient,
        public host: ElementRef<HTMLElement>,
    ) {
        // const controller = host.nativeElement.getAttribute('controller');
        // if (controller && controller !== 'APP_CONTROLLER_NAME') {
        //     this.client.setController(controller);
        // }
    }
}
