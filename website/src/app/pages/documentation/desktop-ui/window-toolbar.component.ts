import { Component } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import {
    ButtonComponent,
    ButtonGroupComponent,
    InputComponent, ListComponent, ListItemComponent, ListTitleComponent,
    WindowComponent, WindowContentComponent,
    WindowHeaderComponent, WindowSidebarComponent,
    WindowToolbarComponent,
} from '@deepkit/desktop-ui';
import { CodeFrameComponent } from './doc.module.js';

@Component({
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Toolbar</h1>

        <doc-code-frame>
          <div class="window-frame">
            <dui-window>
              <dui-window-header>
                Angular Desktop UI

                <dui-window-toolbar>
                  <dui-button-group>
                    <dui-button textured icon="envelop"></dui-button>
                  </dui-button-group>

                  <dui-button-group float="sidebar">
                    <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                icon="toggle_sidebar"></dui-button>
                  </dui-button-group>

                  <dui-button-group padding="none">
                    <dui-button textured>Cool</dui-button>
                    <dui-button [active]="true" textured>Right</dui-button>
                    <dui-button textured>Yes</dui-button>
                  </dui-button-group>

                  <dui-button-group>
                    <dui-input style="width: 80px;" textured round placeholder="What up?"></dui-input>
                  </dui-button-group>

                  <dui-input textured icon="search" placeholder="Search" round clearer
                             style="margin-left: auto;"></dui-input>
                </dui-window-toolbar>
              </dui-window-header>

              <dui-window-content [sidebarVisible]="sidebarVisible">
                <dui-window-sidebar>
                  <dui-list>
                    <dui-list-title>Form controls</dui-list-title>
                    <dui-list-item value="button">Button</dui-list-item>
                    <dui-list-item value="button-group">Button Group</dui-list-item>
                  </dui-list>
                </dui-window-sidebar>

                Content
              </dui-window-content>
            </dui-window>
          </div>
          <code-highlight lang="html" [code]="code"></code-highlight>
        </doc-code-frame>
      </div>
    `,
    styleUrls: ['./window.scss'],
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        WindowComponent,
        WindowHeaderComponent,
        WindowToolbarComponent,
        ButtonGroupComponent,
        ButtonComponent,
        InputComponent,
        WindowContentComponent,
        WindowSidebarComponent,
        ListComponent,
        ListTitleComponent,
        ListItemComponent,
    ],
})
export class DocDesktopUIWindowToolbarComponent {
    sidebarVisible = true;

    code = `
    <dui-window>
        <dui-window-header>
            Angular Desktop UI
    
            <dui-window-toolbar>
                <dui-button-group>
                    <dui-button textured icon="envelop"></dui-button>
                </dui-button-group>
    
                <dui-button-group float="sidebar">
                    <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                icon="toggle_sidebar"></dui-button>
                </dui-button-group>
    
                <dui-button-group padding="none">
                    <dui-button textured>Cool</dui-button>
                    <dui-button [active]="true" textured>Right</dui-button>
                    <dui-button textured>Yes</dui-button>
                </dui-button-group>
    
                <dui-button-group>
                    <dui-input style="width: 80px;" textured round placeholder="What up?"></dui-input>
                </dui-button-group>
    
                <dui-input textured icon="search" placeholder="Search" round clearer
                           style="margin-left: auto;"></dui-input>
            </dui-window-toolbar>
        </dui-window-header>
    
        <dui-window-content [sidebarVisible]="sidebarVisible">
            <dui-window-sidebar>
                Sidebar
            </dui-window-sidebar>
    
            Content
        </dui-window-content>
    </dui-window>
`;
}
