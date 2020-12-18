import {NgModule} from "@angular/core";
import {CommonModule} from "@angular/common";
import {IndicatorComponent} from "./indicator.component";

export * from './indicator.component';

@NgModule({
    declarations: [
        IndicatorComponent,
    ],
    exports: [
        IndicatorComponent,
    ],
    imports: [
        CommonModule,
    ]
})
export class DuiIndicatorModule {

}
