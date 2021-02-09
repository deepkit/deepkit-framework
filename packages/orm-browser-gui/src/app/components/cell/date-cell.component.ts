import { Component, Input } from '@angular/core';
import { PropertySchema } from '@deepkit/type';

@Component({
    template: `
        <div class="monospace">
            {{model|date:'M/d/yy, h:mm:ss'}}<span>{{model|date:'.SSS'}}</span>
        </div>
    `,
    styles: [`
        span {
            color: var(--text-light);
        }
    `]
})
export class DateCellComponent {
    @Input() model: any;
    @Input() property!: PropertySchema;
}
