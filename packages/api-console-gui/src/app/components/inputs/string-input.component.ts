import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { DataStructure } from '../../store';


@Component({
    template: `
        <dui-input lightFocus [type]="getType()" style="width: 100%"
                   (keyDown)="keyDown.emit($event)"
                   [placeholder]="property.name === 'undefined' ? '' : property.name"
                   [(ngModel)]="model.value"
                   (ngModelChange)="modelChange.emit(this.model)"
        ></dui-input>
    `
})
export class StringInputComponent {
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    getType(): string {
        if (this.property.type === 'number') return 'number';

        return 'text';
    }
}
