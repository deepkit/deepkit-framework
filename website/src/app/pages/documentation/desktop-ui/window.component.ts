import { Component } from '@angular/core';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/doc.module.js';
import {
    ButtonComponent,
    ButtonGroupComponent,
    InputComponent,
    ListComponent,
    ListItemComponent,
    ListTitleComponent,
    WindowComponent,
    WindowContentComponent,
    WindowFooterComponent,
    WindowHeaderComponent,
    WindowSidebarComponent,
    WindowToolbarComponent,
} from '@deepkit/desktop-ui';
import { CodeHighlightComponent } from '@deepkit/ui-library';

@Component({
    host: {ngSkipHydration: 'true'},
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Window</h1>

        <p>
          A window is built of multiple key components, you need for almost all of your desktop applications. The frame,
          header, header toolbar, content, footer.
        </p>

        <p>
          If you use electron, you need to make sure the electron window is rendering without borders. You do this by setting to
          titleBarStyle to none.
          To work correctly, this library requires you to set certain window options correctly. Following is an example:
        </p>

        <code-highlight lang="typescript" [code]="codeNewWindow" />

        <h3>Simple</h3>
        <doc-code-frame>
          <div class="window-frame">
            <dui-window>
              <dui-window-header>
                Angular Desktop UI
              </dui-window-header>
              <dui-window-content>
                <div>
                  This is the window content
                </div>
              </dui-window-content>
            </dui-window>
          </div>
          <code-highlight lang="html" [code]="\`
        <dui-window>
            <dui-window-header>
                Angular Desktop UI
            </dui-window-header>
            <dui-window-content>
                <div>
                    This is the window content
                </div>
            </dui-window-content>
        </dui-window>
        \`" />
        </doc-code-frame>

        <h3>Toolbar</h3>
        <doc-code-frame>
          <div class="window-frame">
            <dui-window>
              <dui-window-header>
                Angular Desktop UI
                <dui-window-toolbar>
                  <dui-button-group>
                    <dui-button textured icon="envelop"></dui-button>
                  </dui-button-group>
                  <dui-button-group float="right">
                    <dui-input textured icon="search" placeholder="Search" round clearer></dui-input>
                  </dui-button-group>
                </dui-window-toolbar>
              </dui-window-header>
              <dui-window-content>
                <div>
                  This is the window content
                </div>
              </dui-window-content>
            </dui-window>
          </div>

          <code-highlight lang="html" [code]='\`
        <dui-window>
            <dui-window-header>
                Angular Desktop UI
                <dui-window-toolbar>
                    <dui-button-group>
                        <dui-button textured icon="envelop"></dui-button>
                    </dui-button-group>
                    <dui-button-group float="right">
                        <dui-input textured icon="search" placeholder="Search" round clearer></dui-input>
                    </dui-button-group>
                </dui-window-toolbar>
            </dui-window-header>
            <dui-window-content>
                <div>
                    This is the window content
                </div>
            </dui-window-content>
        </dui-window>
       \`' />
        </doc-code-frame>

        <h3>Footer</h3>
        <doc-code-frame>
          <div class="window-frame">
            <dui-window>
              <dui-window-header>
                Angular Desktop UI
                <dui-window-toolbar>
                  <dui-button-group>
                    <dui-button textured icon="envelop"></dui-button>
                  </dui-button-group>
                  <dui-button-group float="right">
                    <dui-input textured icon="search" placeholder="Search" round clearer></dui-input>
                  </dui-button-group>
                </dui-window-toolbar>
              </dui-window-header>
              <dui-window-content>
                <div>
                  This is the window content
                </div>
              </dui-window-content>
              <dui-window-footer>
                This is the footer.
              </dui-window-footer>
            </dui-window>
          </div>
          <code-highlight lang="html" [code]='\`
        <dui-window>
            <dui-window-header>
                Angular Desktop UI
                <dui-window-toolbar>
                    <dui-button-group>
                        <dui-button textured icon="envelop"></dui-button>
                    </dui-button-group>
                    <dui-button-group float="right">
                        <dui-input textured icon="search" placeholder="Search" round clearer></dui-input>
                    </dui-button-group>
                </dui-window-toolbar>
            </dui-window-header>
            <dui-window-content>
                <div>
                    This is the window content
                </div>
            </dui-window-content>
            <dui-window-footer>
                This is the footer.
            </dui-window-footer>
        </dui-window>
        \`' />
        </doc-code-frame>

        <h3>Sidebar</h3>
        <doc-code-frame>
          <div class="window-frame">
            <dui-window>
              <dui-window-header>
                Angular Desktop UI
                <dui-window-toolbar>
                  <dui-button-group float="sidebar">
                    <dui-button textured (click)="sidebarVisible = !sidebarVisible;"
                                icon="toggle_sidebar"></dui-button>
                  </dui-button-group>
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
                <div>
                  This is the window content
                </div>
              </dui-window-content>
            </dui-window>
          </div>
        </doc-code-frame>

        <api-doc module="components/window/window.component" component="WindowComponent"></api-doc>

        <api-doc module="components/window/window-content.component" component="WindowContentComponent"></api-doc>

        <api-doc module="components/window/window-header.component" component="WindowHeaderComponent"></api-doc>

        <api-doc module="components/window/window-header.component" component="WindowToolbarComponent"></api-doc>

        <api-doc module="components/window/window-sidebar.component" component="WindowSidebarComponent"></api-doc>

        <api-doc module="components/window/window-footer.component" component="WindowFooterComponent"></api-doc>
      </div>
    `,
    styleUrls: ['./window.scss'],
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        WindowComponent,
        WindowHeaderComponent,
        WindowComponent,
        WindowHeaderComponent,
        ApiDocComponent,
        ListItemComponent,
        ListTitleComponent,
        WindowSidebarComponent,
        WindowContentComponent,
        ListComponent,
        ButtonComponent,
        ButtonGroupComponent,
        WindowToolbarComponent,
        WindowFooterComponent,
        InputComponent,
    ],
})
export class DocDesktopUIWindowComponent {
    sidebarVisible = true;

    codeNewWindow = `
    win = new BrowserWindow({
        center: true,
        width: 750,
        height: 750,
        vibrancy: 'window',
        transparent: true, //necessary for vibrancy fix on macos
        backgroundColor: "#80FFFFFF", //necessary for vibrancy fix on macos
        webPreferences: {
        scrollBounce: true,
        allowRunningInsecureContent: false,
        preload: __dirname + '/../../node_modules/@deepkit/desktop-ui/preload.js',
        nativeWindowOpen: true,
        },
        titleBarStyle: 'hidden',
        icon: path.join(assetsPath, 'icons/64x64.png')
    });
`;
}
