import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { TypeClass } from '@deepkit/type';
import { FilePickerItem } from '@deepkit/desktop-ui';
import { isArray } from '@deepkit/core';

@Component({
    template: `
        <dui-button duiFilePicker (duiFilePickerChange)="chosen($event)">
            Choose file
        </dui-button>
    `,
    standalone: false
})
export class BinaryInputComponent implements OnInit, OnChanges {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() type!: TypeClass;

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    chosen(event: FilePickerItem | FilePickerItem[]) {
        event = isArray(event) ? event : [event];
        const file = event[0];
        if (!file) return;

        this.model = this.type.classType === ArrayBuffer ? file.data.buffer : file.data;
        this.modelChange.emit(this.model);
    }

    ngOnChanges(): void {
    }

    ngOnInit(): void {
    }

}
