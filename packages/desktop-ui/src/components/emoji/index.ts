import {NgModule} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {EmojiDropdownComponent, EmojiDropdownDirective} from "./emoji-dropdown.component";
import {DuiInputModule} from "../input";
import {DuiButtonModule} from "../button";
import {EmojiComponent} from "./emoji.component";

export {EmojiComponent} from "./emoji.component";

export {EmojiDropdownComponent, EmojiDropdownDirective} from "./emoji-dropdown.component";

@NgModule({
    declarations: [
        EmojiDropdownComponent,
        EmojiDropdownDirective,
        EmojiComponent,
    ],
    exports: [
        EmojiDropdownComponent,
        EmojiDropdownDirective,
        EmojiComponent,
    ],
    entryComponents: [
        EmojiDropdownComponent,
    ],
    imports: [
        FormsModule,
        CommonModule,
        DuiInputModule,
        DuiButtonModule,
    ]
})
export class DuiEmojiModule {

}
