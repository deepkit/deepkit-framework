import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Radiobox</h2>

        <textarea codeHighlight>
        import {DuiRadioboxModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <div>
                <dui-radiobox [(ngModel)]="radioValue" value="a">Radio A</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" value="b">Radio B</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" value="c">Radio C</dui-radiobox>
                <p>
                    Chosen: {{radioValue}}
                </p>

                <dui-radiobox [(ngModel)]="radioValue" disabled value="a">Radio A</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" disabled value="b">Radio B</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" disabled value="c">Radio C</dui-radiobox>
            </div>
            <textarea codeHighlight="html">
                <dui-radiobox [(ngModel)]="radioValue" value="a">Radio A</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" value="b">Radio B</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" value="c">Radio C</dui-radiobox>
                <p>
                    Chosen: {{radioValue}}
                </p>

                <dui-radiobox [(ngModel)]="radioValue" disabled value="a">Radio A</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" disabled value="b">Radio B</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" disabled value="c">Radio C</dui-radiobox>
            </textarea>
        </doc-code-frame>

        <api-doc module="components/radiobox/radiobox.component" component="RadioboxComponent"></api-doc>
    `
})
export class DocDesktopUIRadioboxComponent {
    radioValue = 'a';
}
