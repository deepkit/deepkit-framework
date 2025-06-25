import { Component } from '@angular/core';
import { ApiDocComponent } from '@app/app/pages/documentation/desktop-ui/api-doc.component.js';
import { AppTitle } from '@app/app/components/title.js';

@Component({
    host: { ngSkipHydration: 'true' },
    imports: [
        ApiDocComponent,
        AppTitle,

    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>App</h1>
        <app-title value="App"></app-title>

        <p>
          The service <code>DuiApp</code> allows to set some global application settings, such as the theme, dark mode, etc.
        </p>

        <api-doc component="DuiApp"></api-doc>
      </div>
    `,
})
export class DocDesktopUIAppComponent {
    code = `
    `;
}
