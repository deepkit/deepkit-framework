import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Getting started</h2>

        <p>
            The library angular-desktop-ui is available in NPM. Install it with its dependencies in an already existing
            angular project.
        </p>

        <textarea codeHighlight="bash">
        npm install @deepkit/desktop-ui @angular/cdk
        </textarea>

        <p>
            Next you need to include the Typescript source of this library into your <code>tsconfig.app.json</code> and
            <code>tsconfig.spec.json</code>,
            since this library is a Typescript only library.
        </p>

        <textarea codeHighlight="json" title="tsconfig.app.json">
            {
                "include": [
                    "src/**/*.d.ts",
                    "node_modules/@deepkit/desktop-ui/src/**/*.ts"
              ]
            }
        </textarea>

        Also activate <code>allowSyntheticDefaultImports</code> in your
        <code>tsconfig.json</code> since this library uses some external dependencies that requires that.

        <textarea codeHighlight="json" title="tsconfig.json">
            {
              "compilerOptions": {
                "allowSyntheticDefaultImports": true
              }
            }
        </textarea>

        <p>
            Include the scss files in your <code>angular.json</code>.
            Importing it via <code>&#64;import "..."</code> in <code>src/style.scss</code> does not work.
            If you use a custom icon font as described in the Icon chapter, don't import the <code>icon.scss</code>
            here.
        </p>

        <textarea codeHighlight="json" title="angular.json">
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
              "node_modules/@deepkit/desktop-ui/src/scss/all.scss",
              "node_modules/@deepkit/desktop-ui/src/scss/icon.scss",
              "src/styles.scss"
            ]
          }
        }
      }
    }
  }
        </textarea>

        <p>
        Then you can import the modules of angular-desktop-ui. Make sure to import only what you need, but you have to import at least
        <code>DuiAppModule</code> and <code>DuiWindowModule</code>.
        </p>

        <textarea codeHighlight title="app.module.ts">
import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {
    DuiButtonModule,
    DuiCheckboxModule,
    DuiFormComponent,
    DuiInputModule,
    DuiRadioboxModule,
    DuiSelectModule,
    DuiWindowModule,
    DuiIconModule,
    DuiListModule,
    DuiTableModule,
    DuiAppModule,
    DuiDialogModule,
    DuiSliderModule,
    DuiEmojiModule,
} from '@deepkit/desktop-ui';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";

@NgModule({
    declarations: [
        AppComponent,
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        BrowserModule,
        AppRoutingModule,
        
        DuiAppModule.forRoot(), //<--- important#
        DuiWindowModule.forRoot(),
        
        DuiCheckboxModule,
        DuiButtonModule,
        DuiInputModule,
        DuiFormComponent,
        DuiRadioboxModule,
        DuiSelectModule,
        DuiIconModule,
        DuiListModule,
        DuiTableModule,
        DuiButtonModule,
        DuiDialogModule,
        DuiEmojiModule,
        DuiSliderModule,
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
        </textarea>

        <h2>Disable Zone.js</h2>

        <p>
        To get better performance it's recommended to disable Zone.js.
        This library implemented some workarounds to make most other libraries work without Zonejs, but that's not guaranteed.
        </p>

        <p>
        Open <code>main.ts</code> and adjust accordingly. The important part is <code>ngZone: 'noop'</code>.
        </p>

        <textarea codeHighlight title="main.ts">
import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';

if (environment.production) {
    enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule, {
    ngZone: 'noop'
})
.catch(err => console.error(err));
        </textarea>

        <p>
        Open now <code>polyfills.ts</code> and uncomment the import of zone.js. 
        Make sure to provide a simple noop implementation as follows:
        </p>

        <textarea codeHighlight>
        // import 'zone.js/dist/zone';  // Included with Angular CLI.
        (window as any)['Zone'] = {
            current: {
                get: function() {}
            }
        };
        </textarea>

        <p>
        This changes requires you to use <code>ChangeDetectorRef</code> more often to reflect async operations by the 
        user to your application. For example:
        </p>

        <textarea codeHighlight>
        @Component({
            template: '<div *ngIf=loggingIn>Logging in ...</div>'
        })
        export class MyLoginComponent {
            public loggingIn = false;
    
            constructor(protected cd: ChangeDetectorRef) {}
    
            async doLogin() {
                this.loggingIn = true;
                this.cd.detectChanges();
        
                await this.httpClient.post('/login', ...);
        
                this.loggingIn = false;
                this.cd.detectChanges();
            }
        }
        </textarea>

        <h2>Start using the library</h2>

        <p>
        Open now your <code>app.component.html</code> and create your first desktop app.
        </p>

        <textarea codeHighlight title="app.component.html">
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
        </textarea>

        Please note that you need at least one and max one <code>dui-window</code> element.
        Multiple windows are currently not supported except if you use a new Electron Window instance (and thus bootstrap the whole Angular application again).
        This is currently a limitation with Angular itself not supporting multiple HTML documents.
    `
})
export class DocDesktopUIGettingStartedComponent {
}
