import {NgModule} from "@angular/core";
import {RenderComponentDirective} from "./render-component.directive";

export * from './render-component.directive'

@NgModule({
    declarations: [
        RenderComponentDirective,
    ],
    exports: [
        RenderComponentDirective,
    ],
    providers: [],
    imports: [
    ]
})
export class DuiCoreModule {

}
