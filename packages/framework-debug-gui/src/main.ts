import { provideRpcWebSocketClient } from '@deepkit/rpc';
import { provideState } from '@deepkit/desktop-ui';
import { State } from './app/state';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app/routes';
import { provideApiConsoleRegistry, routes as apiConsoleRoutes } from '@deepkit/api-console-gui';
import { provideOrmBrowserRegistry, routes as ormBrowserRoutes } from '@deepkit/orm-browser-gui';

bootstrapApplication(AppComponent, {
    providers: [
        provideRpcWebSocketClient(undefined, { 4200: 8000 }),
        provideState(State),
        provideRouter([
            ...routes,
            ...apiConsoleRoutes,
            ...ormBrowserRoutes,
        ], withHashLocation()),
        provideApiConsoleRegistry(),
        provideOrmBrowserRegistry(),
    ],
})
    .catch(err => console.error(err));
