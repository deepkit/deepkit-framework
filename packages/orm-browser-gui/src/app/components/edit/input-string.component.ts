import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PropertySchema } from "@deepkit/type";

@Component({
    template: `
    <dui-input textured lightFocus [type]="getType()" focus 
        (focusChange)="$event ? false : done.emit()" 
        (enter)="done.emit()" (esc)="done.emit()"
        (keyDown)="keyDown.emit($event)"
        [(ngModel)]="row[property.name]"></dui-input>
    `
})
export class InputStringComponent {
    @Input() row: any;
    @Input() property!: PropertySchema;

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    getType(): string {
        if (this.property.type === 'number') return 'number';

        return 'text';
    }
}