import {NgModule} from "@angular/core";
import {RadioboxComponent} from "./radiobox.component";

export * from './radiobox.component';

@NgModule({
    declarations: [
        RadioboxComponent
    ],
    exports: [
        RadioboxComponent
    ]
})
export class DuiRadioboxModule {

}
