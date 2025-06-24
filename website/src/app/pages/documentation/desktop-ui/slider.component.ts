import { Component } from '@angular/core';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/doc.module.js';
import { SliderComponent } from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';
import { CodeHighlightComponent } from '@deepkit/ui-library';

@Component({
    imports: [
        CodeFrameComponent,
        SliderComponent,
        FormsModule,
        CodeHighlightComponent,
        ApiDocComponent,
    ],
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Slider</h1>

        <doc-code-frame>
          <div class="examples">
            <div>
              <dui-slider [(ngModel)]="value"></dui-slider>
              <div>{{ value }}</div>
            </div>
            <div>
              <dui-slider [min]="50" [max]="200" [(ngModel)]="value2"></dui-slider>
              <div>{{ value2 }}</div>
            </div>

            <div>
              <dui-slider [min]="50" [steps]="25" [max]="200" [(ngModel)]="value3"></dui-slider>
              <div>{{ value3 }}</div>
            </div>

            <div>
              <dui-slider mini></dui-slider>
            </div>
          </div>
          <code-highlight lang="html" [code]="code"></code-highlight>
        </doc-code-frame>

        <api-doc module="components/slider/slider.component" component="SliderComponent"></api-doc>
      </div>
    `,
    styles: `
        .examples > div {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            margin-bottom: 24px;
        }
    `
})
export class DocDesktopUISliderComponent {
    value = 0.30;
    value2 = 60;
    value3 = 75;

    code = `
      <div>
        <dui-slider [(ngModel)]="value"></dui-slider>
        <div>{{ value }}</div>
      </div>
      <div>
        <dui-slider [min]="50" [max]="200" [(ngModel)]="value2"></dui-slider>
        <div>{{ value2 }}</div>
      </div>

      <div>
        <dui-slider [min]="50" [steps]="25" [max]="200" [(ngModel)]="value3"></dui-slider>
        <div>{{ value3 }}</div>
      </div>

      <div>
        <dui-slider mini></dui-slider>
      </div>
`;
}
