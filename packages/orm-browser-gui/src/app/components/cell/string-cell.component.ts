import { Component, Input } from '@angular/core';
import { PropertySchema } from '@deepkit/type';

@Component({
    template: `{{model}}`
})
export class StringCellComponent {
    @Input() model: any;
    @Input() property!: PropertySchema;
}
