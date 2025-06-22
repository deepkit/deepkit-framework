import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Checkbox</h2>

        <textarea codeHighlight>
        import {DuiCheckboxModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <div>
                <p>
                    <dui-checkbox [(ngModel)]="active">Disable all</dui-checkbox>
                    <br/>
                    Active: {{active}}
                </p>
                <p>
                    <dui-checkbox [(ngModel)]="active" disabled>Disabled</dui-checkbox>
                    <br/>
                </p>
            </div>
            <textarea codeHighlight="html">
                <p>
                    <dui-checkbox [(ngModel)]="active">Disable all</dui-checkbox>
                    <br/>
                    Active: {{active}}
                </p>
                <p>
                    <dui-checkbox [(ngModel)]="active" disabled>Disabled</dui-checkbox>
                    <br/>
                </p>
            </textarea>
        </doc-code-frame>

        <api-doc module="components/checkbox/checkbox.component" component="CheckboxComponent"></api-doc>
    `
})
export class DocDesktopUICheckboxComponent {
    active = false;
}
