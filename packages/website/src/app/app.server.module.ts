import {NgModule} from '@angular/core';
import {ServerModule} from '@angular/platform-server';

import {AppModule} from './app.module';
import {AppComponent} from './app.component';
import {SocketClient} from '@deepkit/framework-client';

@NgModule({
  imports: [
    AppModule,
    ServerModule,
  ],
  providers: [
    //todo, place InternalClient
    {provide: SocketClient, useValue: new SocketClient('ws://localhost:5200/api')}
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {
}
