import { DeepkitBoxComponent } from './components/box/box.component';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { CodeHighlightComponent } from './components/code-highlight.component';
import { DuiAppModule, DuiButtonModule, DuiIconModule, DuiSplitterModule } from '@deepkit/desktop-ui';
import { HeaderStatusBarComponent } from './components/header-status-bar.component';
import { HeaderLogoComponent } from './components/header-logo.component';
import { ToggleBoxComponent } from './components/toggle-box.component';
import { LoadingSpinnerComponent } from './components/loading-spinner.component';
import { NgIf } from '@angular/common';

@NgModule({
    declarations: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
        HeaderStatusBarComponent,
        HeaderLogoComponent,
        ToggleBoxComponent,
        LoadingSpinnerComponent,
    ],
    exports: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
        HeaderStatusBarComponent,
        HeaderLogoComponent,
        ToggleBoxComponent,
        LoadingSpinnerComponent,
    ],
    imports: [
        DuiIconModule,
        DuiButtonModule,
        DuiSplitterModule,
        DuiAppModule,
        NgIf,
    ],
})
export class DeepkitUIModule {
    static forRoot(): ModuleWithProviders<DeepkitUIModule> {
        return {
            ngModule: DuiAppModule,
            providers: []
        };
    }
}
