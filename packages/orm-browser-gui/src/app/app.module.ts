import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { OrmBrowserModule } from './orm-browser.module';
import { RouterModule } from '@angular/router';
import { DuiAppModule, DuiButtonModule, DuiIconModule, DuiListModule, DuiWindowModule } from '@deepkit/desktop-ui';

@NgModule({
    declarations: [
        AppComponent,
    ],
    imports: [
        BrowserModule,
        RouterModule.forRoot([], {useHash: true}),
        OrmBrowserModule.forRoot(),
        DuiAppModule.forRoot(),
        DuiWindowModule.forRoot(),
        DuiButtonModule,
        DuiListModule,
        DuiIconModule,
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
