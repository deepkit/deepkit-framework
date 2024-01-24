import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';

import { DuiAppModule, DuiButtonModule, DuiIconModule, DuiSplitterModule } from '@deepkit/desktop-ui';

import { DeepkitBoxComponent } from './components/box/box.component';
import { CodeHighlightComponent } from './components/code-highlight.component';
import { HeaderLogoComponent } from './components/header-logo.component';
import { HeaderStatusBarComponent } from './components/header-status-bar.component';
import { LoadingSpinnerComponent } from './components/loading-spinner.component';
import { ToggleBoxComponent } from './components/toggle-box.component';

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
    imports: [CommonModule, DuiIconModule, DuiButtonModule, DuiSplitterModule, DuiAppModule],
})
export class DeepkitUIModule {
    static forRoot(): ModuleWithProviders<DeepkitUIModule> {
        return {
            ngModule: DuiAppModule,
            providers: [],
        };
    }
}
