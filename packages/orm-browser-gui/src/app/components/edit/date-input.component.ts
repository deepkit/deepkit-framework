import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Type } from '@deepkit/type';
import { InputComponent } from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';

@Component({
    template: `
      <dui-input round textured lightFocus type="datetime-local" focus style="width: 100%"
                 (blur)="done.emit()"
                 (enter)="done.emit()" (esc)="done.emit()"
                 (keyDown)="keyDown.emit($event)"
                 [(ngModel)]="model"
                 (ngModelChange)="modelChange.emit(this.model)"
      ></dui-input>
    `,
    imports: [InputComponent, FormsModule],
})
export class DateInputComponent {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() type!: Type;

    @Output() done = new EventEmitter<void>();
    @Output() change = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();
}
