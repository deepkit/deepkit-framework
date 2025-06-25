import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppTitle } from '@app/app/components/title.js';

@Component({
    imports: [
        RouterOutlet,
        AppTitle,
    ],
    template: `
      <app-title value="Desktop UI"></app-title>
      <router-outlet />
    `,
})
export class DesktopUIIndexComponent {
}
