import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {DuiIconModule} from "../icon";
import {DuiButtonModule} from "../button";
import {SliderComponent} from "./slider.component";

export * from './slider.component';

@NgModule({
    declarations: [
        SliderComponent,
    ],
    exports: [
        SliderComponent,
    ],
    imports: [
        FormsModule,
        CommonModule,
        DuiIconModule,
        DuiButtonModule,
    ]
})
export class DuiSliderModule {

}
