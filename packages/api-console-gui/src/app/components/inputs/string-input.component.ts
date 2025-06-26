import { Component, computed, EventEmitter, input, model, Output } from '@angular/core';
import { ReflectionKind, Type } from '@deepkit/type';
import { DataStructure } from '../../store';
import { TypeDecoration } from '../../utils';
import { InputComponent } from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';

@Component({
    template: `
      <dui-input lightFocus [type]="getType()" style="width: 100%"
                 (keyDown)="keyDown.emit($event)"
                 [placeholder]="placeholder()"
                 [(ngModel)]="model().value"
      ></dui-input>
    `,
    imports: [
        InputComponent,
        FormsModule,
    ],
})
export class StringInputComponent {
    String = String;
    model = model.required<DataStructure>();
    decoration = input<TypeDecoration>();
    type = input.required<Type>();

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    placeholder = computed(() => {
        const decoration = this.decoration();
        return decoration ? String(decoration.name) : '';
    })

    getType(): string {
        const type = this.type();
        if (type.kind === ReflectionKind.number || type.kind === ReflectionKind.bigint) return 'number';

        return 'text';
    }
}
