import { Component, Input, OnChanges } from "@angular/core";
import { ClassSchema, PropertySchema } from "@deepkit/type";
import { BrowserState } from "src/app/browser-state";

@Component({
    template: `{{label()}}`
})
export class ClassCellComponent implements OnChanges {
    @Input() row: any;
    @Input() property!: PropertySchema;

    foreignSchema?: ClassSchema;

    constructor(public state: BrowserState) { }

    ngOnChanges() {
        this.foreignSchema = this.property.getResolvedClassSchema();
    }

    label(): string {
        if (!this.foreignSchema) this.foreignSchema = this.property.getResolvedClassSchema();;

        const value = this.row[this.property.name];

        if (value !== undefined && this.property.isReference) {
            if (this.property.isArray) {

            } else {
                if (this.state.isIdWrapper(value)) {
                    return '#new-' + this.state.extractIdWrapper(value);
                } else {
                    return value[this.foreignSchema.getPrimaryFields()[0].name];
                }
            }
        }

        return JSON.stringify(value);
    }
}