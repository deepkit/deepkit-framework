import { DeepkitBoxComponent } from './components/box/box.component';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeHighlightComponent } from './components/code-highlight.component';
import { DuiAppModule, DuiButtonModule, DuiIconModule } from '@deepkit/desktop-ui';
import { HeaderStatusBarComponent } from './components/header-status-bar.component';
import { HeaderLogoComponent } from './components/header-logo.component';

@NgModule({
    declarations: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
        HeaderStatusBarComponent,
        HeaderLogoComponent,
    ],
    exports: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
        HeaderStatusBarComponent,
        HeaderLogoComponent
    ],
    imports: [
        CommonModule,
        DuiIconModule,
        DuiButtonModule,
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
