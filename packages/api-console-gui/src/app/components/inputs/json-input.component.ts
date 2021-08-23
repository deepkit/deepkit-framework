import { Component, EventEmitter, Input, Output } from '@angular/core';
import { jsonSerializer, PropertySchema } from '@deepkit/type';
import { DataStructure } from '../../store';

@Component({
    template: `
        <dui-input lightFocus type="textarea" style="width: 100%" [(ngModel)]="jsonContent" (ngModelChange)="jsonDone()"></dui-input>
    `,
    styles: [`
        .json-editor {
            height: 100%;
            padding: 0 12px;
            display: flex;
            flex-direction: column;
        }

        .json-editor dui-input {
            margin-top: 15px;
            width: 100%;
            flex: 1;
        }
    `]
})
export class JsonInputComponent {
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    jsonContent = '';

    getType(): string {
        if (this.property.type === 'number') return 'number';

        return 'text';
    }

    jsonDone() {
        try {
            const obj = JSON.parse(this.jsonContent);
            this.model.value = jsonSerializer.deserializeProperty(this.property, obj);
            this.modelChange.emit(this.model);

        } catch (error) {
        }
    }

}
