import { Component, Input } from '@angular/core';

@Component({
  selector: 'deepkit-box',
  template: `
    <div class="box">
      <div class="box-title" *ngIf="title" (click)="toggleOpen()">
        <div>
          <dui-icon
            *ngIf="toggleAble"
            clickable
            [name]="open ? 'arrow_down' : 'arrow_right'"
          ></dui-icon>
          {{ title }}
        </div>
      </div>

      <ng-container *ngIf="open">
        <ng-content></ng-content>
      </ng-container>
    </div>
  `,
  styleUrls: ['./box.component.scss'],
})
export class DeepkitBoxComponent {
  @Input() title: string = '';
  @Input() toggleAble: boolean = false;

  open = true;

  toggleOpen() {
    if (!this.toggleAble) return;
    this.open = !this.open;
  }
}
