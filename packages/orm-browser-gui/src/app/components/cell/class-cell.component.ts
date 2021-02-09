import {ChangeDetectorRef, Component, Input, OnChanges, OnInit} from '@angular/core';
import {isArray} from '@deepkit/core';
import {ClassSchema, PropertySchema} from '@deepkit/type';
import {BrowserState} from 'src/app/browser-state';

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
        const value = this.model;

        if (this.property.isReference) {
            if (value === undefined) return;
            if (this.state.isIdWrapper(value)) {
                this.label = '#new-' + this.state.extractIdWrapper(value);
            } else {
                this.label = this.foreignSchema.getClassName() + '#' + value[this.foreignSchema.getPrimaryFields()[0].name];
            }
        } else {
            const fields: string[] = [];
            for (const property of this.foreignSchema.getClassProperties().values()) {
                const v = value[property.name];

                fields.push(property.name + ': ' + (
                    property.isArray && isArray(v) ? '[' + v.join(',') + ']' : v
                ));
            }
            this.label = fields.join(', ');
        }
    }
}
