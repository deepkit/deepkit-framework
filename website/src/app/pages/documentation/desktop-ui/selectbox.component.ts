import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Selectbox</h2>
        
        <textarea codeHighlight>
          import {DuiSelectModule} from '@deepkit/desktop-ui';
        </textarea>
        
        <doc-code-frame>
          <div>
            <p>
              <dui-select [(ngModel)]="radioValue" placeholder="Please choose">
                <dui-option value="a">Option A</dui-option>
                <dui-option value="b">Option B</dui-option>
                <dui-option value="c">Option C</dui-option>
              </dui-select>
              <dui-select small [(ngModel)]="radioValue" placeholder="Please choose">
                <dui-option value="a">Option A</dui-option>
                <dui-option value="b">Option B</dui-option>
                <dui-option value="c">Option C</dui-option>
              </dui-select>
            </p>
            <dui-select [(ngModel)]="radioValue" textured placeholder="Please choose">
              <dui-option value="a">Option A</dui-option>
              <dui-option value="b">Option B</dui-option>
              <dui-option value="c">Option C</dui-option>
            </dui-select>
            <dui-select disabled [(ngModel)]="radioValue" textured placeholder="Please choose">
              <dui-option value="a">Option A</dui-option>
              <dui-option value="b">Option B</dui-option>
              <dui-option value="c">Option C</dui-option>
            </dui-select>
            <dui-select small [(ngModel)]="radioValue" textured placeholder="Please choose">
              <dui-option value="a">Option A</dui-option>
              <dui-option value="b">Option B</dui-option>
              <dui-option value="c">Option C</dui-option>
            </dui-select>
            <p>
              Chosen: {{radioValue}}
            </p>
            <dui-select [(ngModel)]="radioValue" placeholder="Please choose">
              <dui-option value="a">
                <ng-container *dynamicOption>
                  Option A
                </ng-container>
              </dui-option>
              <dui-option value="b">
                <ng-container *dynamicOption>
                  Option B
                </ng-container>
              </dui-option>
              <dui-option value="c">
                <ng-container *dynamicOption>
                  Option CCCCCCCCCC
                </ng-container>
              </dui-option>
            </dui-select>
            <p>
              <dui-select [(ngModel)]="radioValue">
                <dui-button textured (click)="radioValue = ''">Reset</dui-button>
                <dui-option value="a">Option A</dui-option>
                <dui-option value="b">Option B</dui-option>
                <dui-option value="c">Option C</dui-option>
              </dui-select>
            </p>
            <p>
              <dui-select placeholder="Many items">
                @for (item of manyItems; track item) {
                  <dui-option [value]="item">Option #{{item}}</dui-option>
                }
              </dui-select>
            </p>
          </div>
          <textarea codeHighlight="html">
            <p>
              <dui-select [(ngModel)]="radioValue" placeholder="Please choose">
                <dui-option value="a">Option A</dui-option>
                <dui-option value="b">Option B</dui-option>
                <dui-option value="c">Option C</dui-option>
              </dui-select>
              <dui-select small [(ngModel)]="radioValue" placeholder="Please choose">
                <dui-option value="a">Option A</dui-option>
                <dui-option value="b">Option B</dui-option>
                <dui-option value="c">Option C</dui-option>
              </dui-select>
            </p>
            <dui-select [(ngModel)]="radioValue" textured placeholder="Please choose">
              <dui-option value="a">Option A</dui-option>
              <dui-option value="b">Option B</dui-option>
              <dui-option value="c">Option C</dui-option>
            </dui-select>
            <dui-select disabled [(ngModel)]="radioValue" textured placeholder="Please choose">
              <dui-option value="a">Option A</dui-option>
              <dui-option value="b">Option B</dui-option>
              <dui-option value="c">Option C</dui-option>
            </dui-select>
            <dui-select small [(ngModel)]="radioValue" textured placeholder="Please choose">
              <dui-option value="a">Option A</dui-option>
              <dui-option value="b">Option B</dui-option>
              <dui-option value="c">Option C</dui-option>
            </dui-select>
            <p>
              Chosen: {{"{{"}}radioValue{{"}}"}}
            </p>
            <dui-select [(ngModel)]="radioValue" placeholder="Please choose">
              <dui-option value="a">
                <ng-container *dynamicOption>
                  <dui-emoji name="slightly_smiling_face"></dui-emoji>
                  Option A
                </ng-container>
              </dui-option>
              <dui-option value="b">
                <ng-container *dynamicOption>
                  <dui-emoji name="sunglasses"></dui-emoji>
                  Option B
                </ng-container>
              </dui-option>
              <dui-option value="c">
                <ng-container *dynamicOption>
                  Option CCCCCCCCCC
                </ng-container>
              </dui-option>
            </dui-select>
            <p>
              <dui-select [(ngModel)]="radioValue">
                <dui-button textured (click)="radioValue = ''">Reset</dui-button>
                <dui-option value="a">Option A</dui-option>
                <dui-option value="b">Option B</dui-option>
                <dui-option value="c">Option C</dui-option>
              </dui-select>
            </p>
            <p>
              <dui-select placeholder="Many items">
                <dui-option *ngFor="let item of manyItems" [value]="item">Option #{{"{{"}}item{{"}}"}}</dui-option>
              </dui-select>
            </p>
          </textarea>
        </doc-code-frame>
        
        <api-doc module="components/select/selectbox.component" component="SelectboxComponent"></api-doc>
        `
})
export class DocDesktopUISelectboxComponent {
    manyItems = [...Array(255).keys()].map(x => x + 1);
    radioValue = 'a';
}
