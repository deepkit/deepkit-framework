import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TypeClass } from '@deepkit/type';
import { DataStructure } from '../../store.js';

@Component({
    template: `
        <dui-input round lightFocus type="datetime-local" style="width: 100%"
                   (keyDown)="keyDown.emit($event)"
                   [(ngModel)]="model.value"
                   (ngModelChange)="modelChange.emit(this.model)"
        ></dui-input>
    `
})
export class DateInputComponent {
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    @Input() type!: TypeClass;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();
}
