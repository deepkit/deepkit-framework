import { Component, EventEmitter, input, model, Output } from '@angular/core';
import { TypeClass } from '@deepkit/type';
import { DataStructure } from '../../store';
import { InputComponent } from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';
import { TypeDecoration } from '../../utils.js';

@Component({
    template: `
      <dui-input round lightFocus type="datetime-local" style="width: 100%"
                 (keyDown)="keyDown.emit($event)"
                 [(ngModel)]="model().value" />
    `,
    imports: [
        InputComponent,
        FormsModule,
    ],
})
export class DateInputComponent {
    model = model.required<DataStructure>();
    decoration = input<TypeDecoration>();
    type = input.required<TypeClass>();

    @Output() keyDown = new EventEmitter<KeyboardEvent>();
}
