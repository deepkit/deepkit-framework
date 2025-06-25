import { Component, signal } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/api-doc.component.js';
import { FormsModule } from '@angular/forms';
import { RadioButtonComponent, RadioGroupComponent } from '@deepkit/desktop-ui';
import { AppTitle } from '@app/app/components/title.js';

@Component({
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        FormsModule,
        ApiDocComponent,
        RadioGroupComponent,
        RadioButtonComponent,
        AppTitle,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Radio Button</h1>
        <app-title value="Radio Button"></app-title>

        <doc-code-frame>
          <div>
            <dui-radio-group [(ngModel)]="radioValue">
              <dui-radio-button value="a">Radio A</dui-radio-button>
              <br />
              <dui-radio-button value="b">Radio B</dui-radio-button>
              <br />
              <dui-radio-button value="c">Radio C</dui-radio-button>
            </dui-radio-group>
            <p>
              Chosen: {{ radioValue() }}
            </p>

            <dui-radio-group [(ngModel)]="radioValue">
              <dui-radio-button [disabled]="true" value="a">Radio A</dui-radio-button>
              <br />
              <dui-radio-button [disabled]="true" value="b">Radio B</dui-radio-button>
              <br />
              <dui-radio-button [disabled]="true" value="c">Radio C</dui-radio-button>
            </dui-radio-group>
          </div>
          <code-highlight lang="html" [code]="code" />
        </doc-code-frame>

        <api-doc component="RadioGroupComponent"></api-doc>
        <api-doc component="RadioButtonComponent"></api-doc>
      </div>
    `,
})
export class DocDesktopUIRadioButtonComponent {
    radioValue = signal('a');

    code = `
  <div>
    <dui-radio-group [(ngModel)]="radioValue">
      <dui-radio-button value="a">Radio A</dui-radio-button>
      <br />
      <dui-radio-button value="b">Radio B</dui-radio-button>
      <br />
      <dui-radio-button value="c">Radio C</dui-radio-button>
    </dui-radio-group>
    <p>
      Chosen: {{ radioValue() }}
    </p>

    <dui-radio-group [(ngModel)]="radioValue">
      <dui-radio-button [disabled]="true" value="a">Radio A</dui-radio-button>
      <br />
      <dui-radio-button [disabled]="true" value="b">Radio B</dui-radio-button>
      <br />
      <dui-radio-button [disabled]="true" value="c">Radio C</dui-radio-button>
    </dui-radio-group>
  </div>
`;
}
