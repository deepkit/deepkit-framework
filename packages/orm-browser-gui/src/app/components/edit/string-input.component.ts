import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReflectionKind, Type } from '@deepkit/type';

@Component({
    template: `
        <dui-input round textured lightFocus [type]="getType()" focus style="width: 100%"
                   (focusChange)="$event ? false : done.emit()"
                   (enter)="done.emit()" (esc)="done.emit()"
                   (keyDown)="keyDown.emit($event)"
                   [(ngModel)]="model"
                   (ngModelChange)="modelChange.emit(this.model)"
        ></dui-input>
    `,
    standalone: false
})
export class StringInputComponent {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() type!: Type;

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    getType(): string {
        if (this.type.kind === ReflectionKind.number || this.type.kind === ReflectionKind.bigint) return 'number';

        return 'text';
    }
}
