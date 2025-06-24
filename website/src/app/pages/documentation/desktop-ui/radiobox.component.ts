import { Component } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/doc.module.js';
import { FormsModule } from '@angular/forms';
import { RadioButtonComponent, RadioGroupComponent } from '@deepkit/desktop-ui';

@Component({
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        FormsModule,
        ApiDocComponent,
        RadioGroupComponent,
        RadioButtonComponent,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Radiobox</h1>

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
              Chosen: {{ radioValue }}
            </p>

            <dui-radio-group [(ngModel)]="radioValue">
              <dui-radio-button [(ngModel)]="radioValue" disabled value="a">Radio A</dui-radio-button>
              <br />
              <dui-radio-button [(ngModel)]="radioValue" disabled value="b">Radio B</dui-radio-button>
              <br />
              <dui-radio-button [(ngModel)]="radioValue" disabled value="c">Radio C</dui-radio-button>
            </dui-radio-group>
          </div>
          <code-highlight lang="html" [code]="code" />
        </doc-code-frame>

        <api-doc module="components/radiobox/radiobox.component" component="RadioboxComponent"></api-doc>
      </div>
    `,
})
export class DocDesktopUIRadioboxComponent {
    radioValue = 'a';
    code = `
<dui-radio-group [(ngModel)]="radioValue">
  <dui-radio-button value="a">Radio A</dui-radio-button>
  <br />
  <dui-radio-button value="b">Radio B</dui-radio-button>
  <br />
  <dui-radio-button value="c">Radio C</dui-radio-button>
</dui-radio-group>
<p>
  Chosen: {{ radioValue }}
</p>

<dui-radio-group [(ngModel)]="radioValue">
  <dui-radio-button [(ngModel)]="radioValue" disabled value="a">Radio A</dui-radio-button>
  <br />
  <dui-radio-button [(ngModel)]="radioValue" disabled value="b">Radio B</dui-radio-button>
  <br />
  <dui-radio-button [(ngModel)]="radioValue" disabled value="c">Radio C</dui-radio-button>
</dui-radio-group>
`;
}
