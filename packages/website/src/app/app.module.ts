import {BrowserModule} from '@angular/platform-browser';
import {Inject, NgModule, Optional} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {SocketClient} from '@super-hornet/framework-client';
import {environment} from '../environments/environment';
import {DOCUMENT} from '@angular/common';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule.withServerTransition({appId: 'serverApp'}),
    AppRoutingModule
  ],
  providers: [
    {
      provide: SocketClient,
      deps: [[new Optional(), new Inject(DOCUMENT)]],
      useFactory: (document: Document) => {
        if (document) {
          return new SocketClient('ws://' + (environment.production ? document.location.host : document.location.hostname + ':5200') + '/api');
        }
        throw new Error('SocketClient: Not in browser environment');
      }
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
