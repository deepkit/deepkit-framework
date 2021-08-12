import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { OverlayModule } from '@angular/cdk/overlay';
import {
    DuiAppModule,
    DuiButtonModule,
    DuiCheckboxModule,
    DuiFormComponent,
    DuiIconModule,
    DuiInputModule,
    DuiListModule,
    DuiRadioboxModule,
    DuiSelectModule,
    DuiTableModule,
    DuiTabsModule,
    DuiWindowModule
} from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';
import { HttpComponent } from './views/http.component';
import { DeepkitClient } from '@deepkit/rpc';
import { ControllerClient } from './client';

@NgModule({
    declarations: [
        AppComponent,
        HttpComponent,
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
        DuiTabsModule,
        DuiRadioboxModule,
        DuiSelectModule,
        DuiIconModule,
        DuiListModule,
        DuiTableModule,
    ],
    providers: [
        { provide: DeepkitClient, useFactory: () => new DeepkitClient(ControllerClient.getServerHost()) },
        ControllerClient,
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
