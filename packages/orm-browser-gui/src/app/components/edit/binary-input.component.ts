import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { FilePickerItem } from '@deepkit/desktop-ui';
import { isArray } from '@deepkit/core';

@Component({
    template: `
        <dui-button duiFilePicker [duiFileAutoOpen]="true" (duiFilePickerChange)="chosen($event)">
            Choose file
        </dui-button>
    `
})
export class BinaryInputComponent implements OnInit, OnChanges {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    chosen(event: FilePickerItem | FilePickerItem[]) {
        event = isArray(event) ? event : [event];
        const file = event[0];
        if (!file) return;

        this.model = this.property.type === 'arrayBuffer' ? file.data.buffer : file.data;
        this.modelChange.emit(this.model);

        this.done.emit();
    }

    ngOnChanges(): void {
    }

    ngOnInit(): void {
    }

}
