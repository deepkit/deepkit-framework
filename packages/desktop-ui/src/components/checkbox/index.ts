import { NgModule } from "@angular/core";
import { CheckboxComponent } from "./checkbox.component";
import { DuiIconModule } from "../icon";

export * from './checkbox.component'

@NgModule({
    declarations: [
        CheckboxComponent
    ],
    exports: [
        CheckboxComponent
    ],
    imports: [
        DuiIconModule,
    ]
})
export class DuiCheckboxModule {

}
