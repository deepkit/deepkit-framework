import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Button group</h2>

        <textarea codeHighlight>
import {DuiButtonModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <dui-button textured [openDropdown]="dropdown1">Toggle dropdown</dui-button>
            <dui-dropdown #dropdown1>
                <div style="padding: 5px 25px;">
                    Hi there!
                </div>
            </dui-dropdown>
            
            <p>
                <dui-button-group padding="none">
                    <dui-button textured>Split button</dui-button>
                    <dui-button textured tight icon="arrow_down" [openDropdown]="dropdown2"></dui-button>
                </dui-button-group>
                <dui-dropdown #dropdown2>
                    <div style="padding: 5px 25px;">
                        Hi there!
                        <a (click)="dropdown2.close()">Close</a>
                    </div>
                </dui-dropdown>
            </p>
            <textarea codeHighlight="html">
            <dui-button textured [openDropdown]="dropdown1">Toggle dropdown</dui-button>
            <dui-dropdown #dropdown1>
                <div style="padding: 5px 25px;">
                    Hi there!
                </div>
            </dui-dropdown>
            
            <p>
                <dui-button-group padding="none">
                    <dui-button textured>Split button</dui-button>
                    <dui-button textured tight icon="arrow_down" [openDropdown]="dropdown2"></dui-button>
                </dui-button-group>
                <dui-dropdown #dropdown2>
                    <div style="padding: 5px 25px;">
                        Hi there!
                        <a (click)="dropdown1.close()">Close</dui-button>
                    </div>
                </dui-dropdown>
            </p>
            </textarea>
        </doc-code-frame>

        <api-doc module="components/button/dropdown.component" component="DropdownComponent"></api-doc>
    `
})
export class DocDesktopUIButtonDropdownComponent {
}
