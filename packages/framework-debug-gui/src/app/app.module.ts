import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
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
} from '@deepkit/desktop-ui';
import {ConfigurationComponent} from './views/configuration/configuration.component';
import {HttpComponent} from './views/http/http.component';
import {ControllerClient} from './client';
import {FormsModule} from '@angular/forms';
import {RpcComponent} from './views/rpc/rpc.component';
import {WorkflowCardComponent, WorkflowComponent} from './components/workflow.component';
import {EventsComponent} from './views/events/events.component';
import {DeepkitClient} from '@deepkit/rpc';
import {OverlayModule} from '@angular/cdk/overlay';
import {HttpRequestComponent} from './views/http/request/http-request.component';

@NgModule({
  declarations: [
    AppComponent,
    ConfigurationComponent,
    HttpComponent,
    RpcComponent,
    WorkflowComponent,
    WorkflowCardComponent,
    EventsComponent,
    HttpRequestComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,

    DuiAppModule.forRoot(),
    DuiWindowModule.forRoot(),
    OverlayModule,

    DuiCheckboxModule,
    DuiButtonModule,
    DuiInputModule,
    DuiFormComponent,
    DuiRadioboxModule,
    DuiSelectModule,
    DuiIconModule,
    DuiListModule,
    DuiTableModule,
  ],
  providers: [
    ControllerClient,
    {provide: DeepkitClient, useFactory: () => new DeepkitClient('ws://' + location.host)},
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
