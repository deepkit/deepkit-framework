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
  DuiDialogModule,
  DuiSliderModule,
  DuiEmojiModule,
} from '@marcj/angular-desktop-ui';
import {ConfigurationComponent} from './views/configuration/configuration.component';
import {HttpComponent} from './views/http/http.component';
import {ControllerClient} from './client';
import {FormsModule} from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent,
    ConfigurationComponent,
    HttpComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,

    DuiAppModule.forRoot(),
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
  providers: [
    ControllerClient,
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
