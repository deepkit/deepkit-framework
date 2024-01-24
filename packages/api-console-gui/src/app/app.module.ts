import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { DuiAppModule, DuiButtonModule, DuiIconModule, DuiWindowModule } from '@deepkit/desktop-ui';
import { DeepkitUIModule } from '@deepkit/ui-library';

import { ApiConsoleModule } from './api-console.module';
import { AppComponent } from './app.component';

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        CommonModule,
        RouterModule.forRoot([], { useHash: true }),
        ApiConsoleModule,

        DeepkitUIModule,
        DuiAppModule.forRoot(),
        DuiWindowModule.forRoot(),
        DuiButtonModule,
        DuiIconModule,
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
