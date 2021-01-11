import { NgModule } from "@angular/core";
import {
    ButtonComponent,
    ButtonGroupComponent,
    ButtonGroupsComponent,
    FileChooserDirective, FileDropDirective, FilePickerDirective
} from "./button.component";
import { CommonModule } from "@angular/common";
import { DuiIconModule } from "../icon";
import {
    DropdownComponent,
    DropdownItemComponent,
    DropdownSplitterComponent,
    OpenDropdownDirective,
    ContextDropdownDirective,
} from "./dropdown.component";
import { FormsModule } from "@angular/forms";
import { TabButtonComponent } from './tab-button.component'

export * from "./dropdown.component";
export * from './button.component'
export * from './tab-button.component'

@NgModule({
    declarations: [
        ButtonComponent,
        ButtonGroupComponent,
        ButtonGroupsComponent,
        DropdownComponent,
        DropdownItemComponent,
        DropdownSplitterComponent,
        OpenDropdownDirective,
        ContextDropdownDirective,
        FileChooserDirective,
        TabButtonComponent,
        FilePickerDirective,
        FileDropDirective,
    ],
    exports: [
        ButtonComponent,
        ButtonGroupComponent,
        ButtonGroupsComponent,
        DropdownComponent,
        DropdownItemComponent,
        DropdownSplitterComponent,
        OpenDropdownDirective,
        ContextDropdownDirective,
        FileChooserDirective,
        TabButtonComponent,
        FilePickerDirective,
        FileDropDirective,
    ],
    imports: [
        CommonModule,
        FormsModule,
        DuiIconModule,
    ]
})
export class DuiButtonModule {

}
