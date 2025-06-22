import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Form</h2>

        <textarea codeHighlight>
        import {DuiFormComponent} from '@deepkit/desktop-ui';
        </textarea>

        <dui-form style="max-width: 450px;" [disabled]="disabledAll">
            <dui-form-row label="Username">
                <dui-input [disabled]="disabled" clearer></dui-input>
            </dui-form-row>

            <dui-form-row label="Name">
                <dui-input placeholder="Your full name"></dui-input>
            </dui-form-row>

            <dui-form-row label="Nope">
                <dui-input disabled placeholder="Disabled"></dui-input>
            </dui-form-row>

            <dui-form-row label="Textured">
                <dui-input textured round placeholder="and round"></dui-input>
            </dui-form-row>

            <dui-form-row label="Really?">
                <dui-checkbox>Checkbox A</dui-checkbox>
            </dui-form-row>

            <dui-form-row label="Which one">
                <dui-radiobox [(ngModel)]="radioValue" value="a">Radio A</dui-radiobox>
                <br/>
                <dui-radiobox [(ngModel)]="radioValue" value="b">Radio B</dui-radiobox>
                <p>
                    Chosen: {{radioValue}}
                </p>
            </dui-form-row>

            <dui-form-row label="Search">
                <dui-input icon="search" round clearer></dui-input>
            </dui-form-row>

            <dui-form-row label="Another one">
                <dui-select [(ngModel)]="radioValue" placeholder="Please choose">
                    <dui-option value="a">Option A</dui-option>
                    <dui-option value="b">Option B</dui-option>
                </dui-select>
            </dui-form-row>

            <dui-form-row label="Empty">
                <dui-select style="width: 100px;" [(ngModel)]="selectBox1" placeholder="Please choose">
                    <dui-option value="x">Option X</dui-option>
                    <dui-option value="y">Option Y</dui-option>
                </dui-select>
            </dui-form-row>

            <dui-form-row label="Textured">
                <dui-select textured [(ngModel)]="radioValue" placeholder="Please choose">
                    <dui-option value="a">Option A</dui-option>
                    <dui-option value="b">Option B</dui-option>
                </dui-select>
            </dui-form-row>

            <dui-form-row label="">
                <dui-button
                        (click)="i = i + 1"
                >
                    <dui-icon name="star"></dui-icon>
                    Button
                </dui-button>
                {{i}}
            </dui-form-row>

            <dui-form-row label="">
                <dui-button textured>Textured Button</dui-button>
            </dui-form-row>

            <dui-form-row label="">
                <dui-button square>Square button</dui-button>
            </dui-form-row>

            <dui-form-row label="">
                <dui-checkbox [(ngModel)]="disabledAll" [disabled]="true">Disabled</dui-checkbox>
            </dui-form-row>
        </dui-form>

        <dui-form-row label="">
            <dui-checkbox [(ngModel)]="disabledAll">Disable all</dui-checkbox>
        </dui-form-row>

        <api-doc module="components/form/form.component" component="FormComponent"></api-doc>

        <api-doc module="components/form/form.component" component="FormRowComponent"></api-doc>
    `
})
export class DocDesktopUIFormComponent {
    disabled = false;
    disabledAll = false;
    i = 0;
    radioValue?: string;
    selectBox1?: string;
}
