# Getting Started

```sh
npm install @deepkit/desktop-ui @angular/cdk
```

Next you need to path alias it to point to @deepkit/desktop-ui/dist since desktop-ui is a TypeScript only package per default.


```json
{
    "paths": {
        "@deepkit/desktop-ui": ["@deepkit/desktop-ui/dist"]
    }
}
```

Include the styles and icons:

```json
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
}
```

Now use it either in a module:

```typescript
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
```

or use it with newer Angular without modules:

```typescript
import { ApplicationConfig, importProvidersFrom, ɵprovideZonelessChangeDetection } from '@angular/core';
import { DuiAppModule, DuiWindowModule } from "@deepkit/desktop-ui";

export const appConfig: ApplicationConfig = {
    providers: [
        importProvidersFrom(DuiAppModule.forRoot()),
        importProvidersFrom(DuiWindowModule.forRoot()),
    ],
};

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DuiWindowModule } from "@deepkit/desktop-ui";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        RouterOutlet,
        DuiWindowModule,
    ],
    template: `
        <dui-window>
            <dui-window-content>
                <router-outlet/>
            </dui-window-content>
        </dui-window>
        
    `,
    styles: [],
})
export class RootComponent {
    constructor() {
    }
}
```

# Disable Zone.js

To get better performance it's recommended to disable Zone.js.
This library implemented some workarounds to make most other libraries work without Zonejs, but that's not guaranteed.

It's best to update your dependencies that support zoneless already.

Open `main.ts` and adjust accordingly. The important part is `ngZone: 'noop'.

```typescript
export const appConfig: ApplicationConfig = {
    providers: [
        ApiClient,
        { provide: RpcWebSocketClient, useFactory: () => new RpcWebSocketClient(ApiClient.getServerHost()) },
        provideRouter(routes),
        ɵprovideZonelessChangeDetection()
    ]
};
```

Then use Signals, RxJS, or ChangeDetectorRef to trigger change detection.

# Window

```angular2html

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
```

Please note that you need at least one and max one `dui-window` element.
Multiple windows are currently not supported except if you use a new Electron Window instance (and thus bootstrap the whole Angular application again). This is currently a limitation with Angular itself not supporting multiple HTML documents.

