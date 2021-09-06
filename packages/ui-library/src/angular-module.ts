import { DeepkitBoxComponent } from './components/box/box.component';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeHighlightComponent } from './components/code-highlight.component';
import { DuiAppModule, DuiButtonModule, DuiIconModule, DuiSplitterModule } from '@deepkit/desktop-ui';
import { HeaderStatusBarComponent } from './components/header-status-bar.component';
import { HeaderLogoComponent } from './components/header-logo.component';
import { ToggleBoxComponent } from './components/toggle-box.component';

@NgModule({
    declarations: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
        HeaderStatusBarComponent,
        HeaderLogoComponent,
        ToggleBoxComponent,
    ],
    exports: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
        HeaderStatusBarComponent,
        HeaderLogoComponent,
        ToggleBoxComponent,
    ],
    imports: [
        CommonModule,
        DuiIconModule,
        DuiButtonModule,
        DuiSplitterModule,
        DuiAppModule,
    ]
})
export class DeepkitUIModule {
    static forRoot(): ModuleWithProviders<DeepkitUIModule> {
        return {
            ngModule: DuiAppModule,
            providers: []
        };
    }
}
