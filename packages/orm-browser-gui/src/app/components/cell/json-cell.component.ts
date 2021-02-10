import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { isArray } from '@deepkit/core';
import { ClassSchema, PropertySchema } from '@deepkit/type';
import { BrowserState } from 'src/app/browser-state';

@Component({
    template: `{{label}}`
})
export class JsonCellComponent implements OnChanges, OnInit {
    @Input() model: any;
    @Input() property!: PropertySchema;

    label: string = '';

    constructor(public state: BrowserState, protected cd: ChangeDetectorRef) {
    }

    ngOnChanges() {
        this.setLabel();
    }

    ngOnInit() {
        this.setLabel();
    }

    setLabel(): void {
        this.label = JSON.stringify(this.model);
    }
}
