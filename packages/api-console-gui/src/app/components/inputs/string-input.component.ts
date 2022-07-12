import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReflectionKind, Type } from '@deepkit/type';
import { DataStructure } from '../../store.js';
import { TypeDecoration } from '../../utils.js';

@Component({
    template: `
        <dui-input lightFocus [type]="getType()" style="width: 100%"
                   (keyDown)="keyDown.emit($event)"
                   [placeholder]="decoration ? String(decoration.name) : ''"
                   [(ngModel)]="model.value"
                   (ngModelChange)="modelChange.emit(this.model)"
        ></dui-input>
    `
})
export class StringInputComponent {
    String = String;
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();
    @Input() decoration?: TypeDecoration;
    @Input() type!: Type;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    getType(): string {
        if (this.type.kind === ReflectionKind.number || this.type.kind === ReflectionKind.bigint) return 'number';

        return 'text';
    }
}
