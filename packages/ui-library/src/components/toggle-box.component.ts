import { Component, input, model } from '@angular/core';
import { IconComponent, SplitterComponent } from '@deepkit/desktop-ui';

@Component({
    selector: 'deepkit-toggle-box',
    template: `
      @if (visible()) {
        <dui-splitter (sizeChange)="changeHeight($event)" position="top"></dui-splitter>
      }

      <div class="actions">
        <dui-icon clickable (click)="toggleVisibility()"
                  [name]="visible() ? 'arrow_down' : 'arrow_right'"></dui-icon>
        <div class="actions-title" (click)="toggleVisibility()">
          {{ title() }}
        </div>

        <ng-content select="[header]"></ng-content>
      </div>

      @if (visible()) {
        <div class="output overlay-scrollbar-small">
          <ng-content></ng-content>
        </div>
      }
    `,
    host: {
        '[class.visible]': 'visible',
        '[style.flex-basis.px]': 'height',
    },
    imports: [
        SplitterComponent,
        IconComponent,
    ],
    styleUrls: ['./toggle-box.component.scss'],
})
export class ToggleBoxComponent {
    visible = model(false);
    height = model(170);

    title = input('');

    changeHeight(height: number) {
        this.height.set(height);
    }

    toggleVisibility() {
        this.visible.update(v => !v);
    }
}
