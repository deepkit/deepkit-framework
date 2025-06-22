import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Input</h2>

        <textarea codeHighlight>
        import {DuiInputModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <div>
                <dui-button-group>
                    <dui-button textured [disabled]="name === ''" (click)="name = ''">clear</dui-button>
                </dui-button-group>

                <p>
                    <dui-input placeholder="Username"></dui-input>
                    default with placeholder
                </p>

                <p>
                    <dui-input [(ngModel)]="name"></dui-input>
                    default
                </p>

                <p>
                    <dui-input clearer [(ngModel)]="name"></dui-input>
                    clearer
                </p>

                <p>
                    <dui-input textured [(ngModel)]="name"></dui-input>
                    textured
                </p>

                <p>
                    <dui-input round [(ngModel)]="name"></dui-input>
                    round
                </p>

                <p>
                    <dui-input round lightFocus [(ngModel)]="name"></dui-input>
                    round lightFocus
                </p>
                <p>
                    <dui-input round lightFocus semiTransparent [(ngModel)]="name"></dui-input>
                    round lightFocus semiTransparent
                </p>

                <p>
                    <dui-input icon="star" [(ngModel)]="name"></dui-input>
                </p>

                <p>
                    <dui-input icon="star" round clearer [(ngModel)]="name"></dui-input>
                </p>

                <p>
                    <dui-input icon="check" placeholder="Good job"></dui-input>
                </p>
            </div>
            <textarea codeHighlight="html">
                <dui-button-group>
                    <dui-button textured [disabled]="name === ''" (click)="name = ''">clear</dui-button>
                </dui-button-group>

                <p>
                    <dui-input placeholder="Username"></dui-input>
                    default with placeholder
                </p>

                <p>
                    <dui-input [(ngModel)]="name"></dui-input>
                    default
                </p>

                <p>
                    <dui-input clearer [(ngModel)]="name"></dui-input>
                    clearer
                </p>

                <p>
                    <dui-input textured [(ngModel)]="name"></dui-input>
                    textured
                </p>

                <p>
                    <dui-input round [(ngModel)]="name"></dui-input>
                    round
                </p>

                <p>
                    <dui-input round lightFocus [(ngModel)]="name"></dui-input>
                    round lightFocus
                </p>
                <p>
                    <dui-input round lightFocus semiTransparent [(ngModel)]="name"></dui-input>
                    round lightFocus semiTransparent
                </p>

                <p>
                    <dui-input icon="star" [(ngModel)]="name"></dui-input>
                </p>

                <p>
                    <dui-input icon="star" round clearer [(ngModel)]="name"></dui-input>
                </p>

                <p>
                    <dui-input icon="check" placeholder="Good job"></dui-input>
                </p>
            </textarea>
        </doc-code-frame>

        <api-doc module="components/input/input.component" component="InputComponent"></api-doc>
    `
})
export class DocDesktopUIInputComponent {
    name: string = 'Peter';
}
