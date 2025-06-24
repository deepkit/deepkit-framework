import { Component, EventEmitter, input, model, OnChanges, OnInit, Output } from '@angular/core';
import { TypeClass } from '@deepkit/type';
import { ButtonComponent, FilePickerDirective, FilePickerItem } from '@deepkit/desktop-ui';
import { DataStructure } from '../../store';
import { TypeDecoration } from '../../utils.js';

@Component({
    template: `
      <dui-button duiFilePicker (duiFilePickerChange)="chosen($event)">
        Choose file
      </dui-button>
    `,
    imports: [
        ButtonComponent,
        FilePickerDirective,
    ],
})
export class BinaryInputComponent implements OnInit, OnChanges {
    model = model.required<DataStructure>();
    decoration = input<TypeDecoration>();
    type = input.required<TypeClass>();

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    chosen(event: FilePickerItem[]) {
        const file = event[0];
        if (!file) return;

        this.model().value.set(this.type().classType === ArrayBuffer ? file.data.buffer : file.data);
    }

    ngOnChanges(): void {
    }

    ngOnInit(): void {
    }

}
