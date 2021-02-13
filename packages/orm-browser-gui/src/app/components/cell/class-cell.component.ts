import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { ClassSchema, PropertySchema } from '@deepkit/type';
import { objToString } from './utils';
import { BrowserState } from '../../browser-state';

@Component({
    template: `{{label}}`
})
export class ClassCellComponent implements OnChanges, OnInit {
    @Input() model: any;
    @Input() property!: PropertySchema;

    foreignSchema?: ClassSchema;

    label: string = '';

    constructor(public state: BrowserState, protected cd: ChangeDetectorRef) {
    }

    ngOnChanges() {
        this.foreignSchema = this.property.getResolvedClassSchema();
        this.setLabel();
    }

    ngOnInit() {
        this.setLabel();
    }

    setLabel(): void {
        if (!this.foreignSchema) this.foreignSchema = this.property.getResolvedClassSchema();

        this.label = '';
        if (this.model === undefined || this.model === null) return;

        const value = this.model;

        if (this.property.isReference) {
            if (value === undefined) return;
            if (this.state.isIdWrapper(value)) {
                this.label = '#new-' + this.state.extractIdWrapper(value);
            } else {
                this.label = this.foreignSchema.getClassName() + '#' + value[this.foreignSchema.getPrimaryFields()[0].name];
            }
        } else {
            this.label = objToString(value);
        }
    }
}
