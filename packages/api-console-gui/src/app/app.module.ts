import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { ApiConsoleModule } from './api-console.module';
import { CommonModule } from '@angular/common';
import {
    WindowComponent,
    WindowContentComponent,
    WindowHeaderComponent,
    WindowToolbarComponent,
    WindowToolbarContainerComponent,
} from '@deepkit/desktop-ui';
import { HeaderLogoComponent, HeaderStatusBarComponent } from '@deepkit/ui-library';
import { CodeHighlightComponent } from '@deepkit/ui-library';

@NgModule({
    declarations: [
        AppComponent,
    ],
    imports: [
        BrowserModule,
        CommonModule,
        RouterModule.forRoot([], { useHash: true }),
        ApiConsoleModule,
        WindowComponent,
        WindowHeaderComponent,
        WindowToolbarComponent,
        HeaderLogoComponent,
        WindowToolbarContainerComponent,
        HeaderStatusBarComponent,
        WindowContentComponent,
        CodeHighlightComponent
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
