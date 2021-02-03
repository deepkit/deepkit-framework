import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PropertySchema } from "@deepkit/type";

@Component({
    template: `
        <div class="monospace">
            {{row[property.name]|date:'M/d/yy, h:mm:ss'}}<span>{{row[property.name]|date:'.SSS'}}</span>
        </div>
        `,
    styles: [`
        span {
            color: var(--text-light);
        }
    `]
})
export class DateCellComponent {
@Input() row: any;
    @Input() property!: PropertySchema;
}