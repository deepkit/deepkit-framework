import {Component, Input} from "@angular/core";

@Component({
    selector: 'dui-tab-button',
    template: `
        <ng-content></ng-content>
    `,
    host: {
        '[attr.tabindex]': '1',
        '[class.active]': 'active !== false',
    },
    styleUrls: ['./tab-button.component.scss']
})
export class TabButtonComponent {
    /**
     * Whether the button is active (pressed)
     */
    @Input() active: boolean | '' = false;
}
