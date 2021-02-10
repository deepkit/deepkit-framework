import { Component, EventEmitter, Input, Output } from '@angular/core';
import { jsonSerializer, PropertySchema } from '@deepkit/type';
import { DuiDialog } from '@deepkit/desktop-ui';

@Component({
    template: `
        <dui-dialog *ngIf="jsonEditor" class="class-field-dialog" noPadding [visible]="true" (closed)="done.emit()" [backDropCloses]="true"
                    [minWidth]="450" [minHeight]="350">
            <div class="json-editor">
                <h3>JSON</h3>
                <dui-input type="textarea" [(ngModel)]="jsonContent"></dui-input>
            </div>
            <dui-dialog-actions>
                <dui-button closeDialog>Cancel</dui-button>
                <dui-button (click)="jsonDone()">Ok</dui-button>
            </dui-dialog-actions>
        </dui-dialog>
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
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    jsonEditor = false;
    jsonContent = '';

    constructor(
        protected duiDialog: DuiDialog,
    ) {
    }

    getType(): string {
        if (this.property.type === 'number') return 'number';

        return 'text';
    }

    jsonDone() {
        try {
            const obj = JSON.parse(this.jsonContent);
            this.model = jsonSerializer.deserializeProperty(this.property, obj);
            this.modelChange.emit(this.model);

            this.jsonEditor = false;
            this.done.emit();
        } catch (error) {
            this.duiDialog.alert('Invalid JSON');
        }
    }

}
