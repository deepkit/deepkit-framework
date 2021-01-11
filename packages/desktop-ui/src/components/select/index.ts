import { NgModule } from "@angular/core";
import { DynamicOptionDirective, OptionDirective, SelectboxComponent } from "./selectbox.component";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { DuiIconModule } from "../icon";
import { DuiButtonModule } from "../button";

export * from "./selectbox.component";

@NgModule({
    declarations: [
        SelectboxComponent,
        OptionDirective,
        DynamicOptionDirective,
    ],
    exports: [
        SelectboxComponent,
        OptionDirective,
        DynamicOptionDirective,
    ],
    imports: [
        FormsModule,
        CommonModule,
        DuiIconModule,
        DuiButtonModule,
    ]
})
export class DuiSelectModule {

}
