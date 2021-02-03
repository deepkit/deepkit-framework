import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PropertySchema } from "@deepkit/type";

@Component({
    template: `{{row[property.name]}}`
})
export class StringCellComponent {
    @Input() row: any;
    @Input() property!: PropertySchema;
}