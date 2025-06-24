import { Component } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { OpenExternalDirective } from '@deepkit/desktop-ui';
import { ApiDocComponent } from '@app/app/pages/documentation/desktop-ui/api-doc.component.js';

@Component({
    imports: [
        CodeHighlightComponent,
        OpenExternalDirective,
        ApiDocComponent,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Window Menu</h1>

        <p>
          Directives to manipulate the application's and windows's OS menu bar.
          This only works when the app is running in Electron.
        </p>

        <p>
          See Electron documentation to check what property values are available.<br />
          <a openExternal="https://electronjs.org/docs/api/menu-item">electronjs.org/docs/api/menu-item</a>
        </p>

        <code-highlight lang="html" [code]="code"></code-highlight>
        
        <api-doc component="MenuDirective"></api-doc>
        <api-doc component="MenuItemDirective"></api-doc>
        <api-doc component="MenuCheckboxDirective"></api-doc>
        <api-doc component="MenuRadioDirective"></api-doc>
        <api-doc component="MenuSeparatorDirective"></api-doc>
      </div>
    `,
})
export class DocDesktopUIWindowMenuComponent {
    code = `
    <dui-menu role="appMenu" onlyMacOs></dui-menu>
    <dui-menu role="fileMenu">
        <dui-menu-item label="Test"></dui-menu-item>
    </dui-menu>
    <dui-menu label="Menu 2" *ngIf="showMenu2">
        <dui-menu-item label="Hi =)"></dui-menu-item>
    </dui-menu>
`;
}

