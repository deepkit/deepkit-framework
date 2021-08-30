import { DeepkitBoxComponent } from './components/box/box.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeHighlightComponent } from './components/code-highlight.component';
import { DuiIconModule } from '@deepkit/desktop-ui';

@NgModule({
    declarations: [
        DeepkitBoxComponent,
        CodeHighlightComponent,
    ],
    exports: [
        DeepkitBoxComponent,
        CodeHighlightComponent
    ],
    imports: [
        CommonModule,
        DuiIconModule,
    ]
})
export class DeepkitUIModule {

}
