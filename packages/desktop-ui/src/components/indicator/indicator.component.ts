import { Component, Input } from "@angular/core";

@Component({
    selector: 'dui-indicator',
    template: `
        <div [class.invisible]="step <= 0" [style.width.%]="step * 100" class="active"></div>
    `,
    styleUrls: ['./indicator.component.scss']
})
export class IndicatorComponent {
    @Input() step = 0;
}
