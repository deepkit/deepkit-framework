import { Component } from '@angular/core';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/api-doc.component.js';
import { CheckboxComponent } from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';

@Component({
    imports: [
        CodeHighlightComponent,
        CodeFrameComponent,
        CheckboxComponent,
        ApiDocComponent,
        FormsModule,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Checkbox</h1>

        <doc-code-frame>
          <div>
            <p>
              <dui-checkbox [(ngModel)]="active">Disable all</dui-checkbox>
              <br />
              Active: {{ active }}
            </p>
            <p>
              <dui-checkbox [(ngModel)]="active" [disabled]="true">Disabled</dui-checkbox>
              <br />
            </p>
          </div>
          <code-highlight lang="html" [code]="code" />
        </doc-code-frame>

        <api-doc component="CheckboxComponent"></api-doc>
      </div>
    `,
})
export class DocDesktopUICheckboxComponent {
    active = false;

    code = `
    <p>
        <dui-checkbox [(ngModel)]="active">Disable all</dui-checkbox>
        <br/>
        Active: {{active}}
    </p>
    <p>
        <dui-checkbox [(ngModel)]="active" [disabled]="true">Disabled</dui-checkbox>
        <br/>
    </p>
`;
}
