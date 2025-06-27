import { Component, signal } from '@angular/core';
import { ApiDocComponent, CodeFrameComponent } from '@app/app/pages/documentation/desktop-ui/api-doc.component.js';
import { CodeHighlightComponent } from '@deepkit/ui-library';
import { FormsModule } from '@angular/forms';
import { AppTitle } from '@app/app/components/title.js';
import { AdaptiveContainerComponent, ButtonComponent, CheckboxComponent, RadioButtonComponent, RadioGroupComponent, SplitterComponent } from '@deepkit/desktop-ui';

@Component({
    selector: 'app-desktop-ui-button',
    imports: [
        CodeFrameComponent,
        CodeHighlightComponent,
        FormsModule,
        AppTitle,
        AdaptiveContainerComponent,
        ButtonComponent,
        SplitterComponent,
        RadioButtonComponent,
        CheckboxComponent,
        RadioGroupComponent,
        ApiDocComponent,

    ],
    host: { ngSkipHydration: 'true' },
    template: `
      <div class="app-content normalize-text">
        <div class="app-pre-headline">Desktop UI</div>
        <h1>Adaptive Container</h1>
        <app-title value="Adaptive Container"></app-title>
        <doc-code-frame>
          <div class="layout" [class.fill-space]="fillSpace()">
            <div #left class="left">
              <div #leftTop>
                <dui-adaptive-container #container [direction]="direction()">
                  <dui-button>Button 1</dui-button>
                  <dui-button>Big Button 2</dui-button>
                  <dui-button icon="check"></dui-button>
                  <dui-button>Button 4</dui-button>
                  <dui-button>Button 5</dui-button>
                </dui-adaptive-container>
              </div>
              <dui-splitter horizontal [(size)]="leftTopSize" [element]="leftTop"></dui-splitter>
              <div>Resize the areas to see how the adaptive container adjusts.</div>
            </div>
            <dui-splitter [(size)]="leftSize" [element]="left"></dui-splitter>
            <div class="actions">
              <dui-radio-group [(ngModel)]="direction">
                <dui-radio-button value="row">Row</dui-radio-button>
                <dui-radio-button value="row-reverse">Row Reverse</dui-radio-button>
                <dui-radio-button value="column">Column</dui-radio-button>
                <dui-radio-button value="column-reverse">Column Reverse</dui-radio-button>
              </dui-radio-group>
              <dui-checkbox [(ngModel)]="fillSpace">Stretch Buttons</dui-checkbox>
            </div>
          </div>
          <code-highlight lang="html" [code]="code" />
        </doc-code-frame>
        
        <api-doc component="AdaptiveContainerComponent"></api-doc>
      </div>
    `,
    styles: [`
      dui-radio-group {
        display: flex;
        gap: 8px;
      }

      .layout {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 250px;
      }

      .left {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      dui-adaptive-container {
        gap: 4px;
      }

      .fill-space dui-button {
        flex: 1;
        min-width: fit-content;
        min-height: fit-content;
      }

      dui-adaptive-container {
        height: 23px;
      }

      dui-adaptive-container.column, dui-adaptive-container.column-reverse {
        height: 100%;

        > * {
          width: 100%;
        }
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .layout div {
        padding: 8px;
        background-color: #444444aa;
        flex: 1;
        overflow: hidden;
      }

    `],
})
export class DocDesktopUIAdaptiveContainerComponent {
    fillSpace = signal(false);
    leftTopSize = signal(150);
    leftSize = signal(280);
    direction = signal<'row' | 'column' | 'row-reverse' | 'column-reverse'>('row');

    code = `
`;
}
