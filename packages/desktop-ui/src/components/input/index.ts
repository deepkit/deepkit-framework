import { NgModule } from "@angular/core";
import { InputComponent } from "./input.component";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { DuiIconModule } from "../icon";
import { DatePipe } from '@angular/common';

export * from './input.component';

@NgModule({
    declarations: [
        InputComponent,
    ],
    exports: [
        InputComponent,
    ],
    providers: [
        DatePipe
    ],
    imports: [
        CommonModule,
        FormsModule,
        DuiIconModule,
    ]
})
export class DuiInputModule {

}
