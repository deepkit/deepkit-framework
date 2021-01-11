import { NgModule } from "@angular/core";
import { FormComponent, FormRowComponent } from "./form.component";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";

export * from "./form.component";

@NgModule({
    declarations: [
        FormComponent,
        FormRowComponent,
    ],
    exports: [
        FormComponent,
        FormRowComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
    ]
})
export class DuiFormComponent {

}
