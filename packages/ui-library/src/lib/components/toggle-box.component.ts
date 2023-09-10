import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  SkipSelf,
} from '@angular/core';

@Component({
  selector: 'deepkit-toggle-box',
  template: `
    <dui-splitter
      *ngIf="visible"
      (modelChange)="changeHeight($event)"
      position="top"
    ></dui-splitter>

    <div class="actions">
      <dui-icon
        clickable
        (click)="toggleVisibility()"
        [name]="this.visible ? 'arrow_down' : 'arrow_right'"
      ></dui-icon>
      <div class="actions-title" (click)="toggleVisibility()">
        {{ title }}
      </div>

      <ng-content select="[header]"></ng-content>
    </div>

    <div *ngIf="visible" class="output overlay-scrollbar-small">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    '[class.visible]': 'visible',
    '[style.flexBasis.px]': 'height',
  },
  styleUrls: ['./toggle-box.component.scss'],
})
export class ToggleBoxComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() height: number = 170;
  @Output() heightChange = new EventEmitter<number>();

  @Input() title: string = '';

  constructor(@SkipSelf() private parentCd: ChangeDetectorRef) {}

  changeHeight(height: number) {
    this.height = height;
    this.heightChange.emit(this.height);
    this.parentCd.detectChanges();
  }

  toggleVisibility() {
    this.visible = !this.visible;
    this.visibleChange.emit(this.visible);
  }
}
