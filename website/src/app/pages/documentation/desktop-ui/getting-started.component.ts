import { Component } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';

@Component({
    template: `
      <div class="app-pre-headline">Desktop UI</div>
      <h1>Getting started</h1>

      <p>
        The library angular-desktop-ui is available in NPM. Install it with its dependencies in an already existing
        angular project.
      </p>

      <code-highlight lang="bash" code="npm install @deepkit/desktop-ui @angular/cdk"/>

      <p>
        Include the scss files in your <code>angular.json</code>.
        Importing it via <code>&#64;import "..."</code> in <code>src/style.scss</code> does not work.
        If you use a custom icon font as described in the Icon chapter, don't import the <code>icon.scss</code>
        here.
      </p>

      <code-highlight lang="json" title="angular.json" [code]="angularJson"></code-highlight>

      <h2>Start using the library</h2>

      <p>
        Open now your <code>app.component.html</code> and create your first desktop app.
      </p>

      <code-highlight lang title="app.component.html" [code]="appComponentHtml"></code-highlight>

      Please note that you need at least one and max one <code>dui-window</code> element in your hierarchy. You usually put a
      <code>router-outlet</code>
      inside the <code>dui-window-content</code> element, so that you can navigate to different pages of your application.
      Multiple windows are currently not supported except if you use a new Electron Window instance (and thus bootstrap the whole Angular application again).
      This is currently a limitation with Angular itself not supporting multiple HTML documents.
    `,
    imports: [
        CodeHighlightComponent,
    ],
})
export class DocDesktopUIGettingStartedComponent {
    angularJson = `
{
  "projects": {
    "test-dui": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/test-dui",
            "index": "src/index.html",
            "main": "src/main.ts",
            "styles": [
              "node_modules/@deepkit/desktop-ui/src/scss/reset.scss",
              "node_modules/@deepkit/desktop-ui/src/scss/all.scss",
              "node_modules/@deepkit/desktop-ui/src/scss/icon.scss",
              "src/styles.scss"
            ]
          }
        }
      }
    }
  }`;

    appComponentHtml = `
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
`;

}
