import { Component, Input } from '@angular/core';


@Component({
    selector: 'dui-label',
    template: `
        <label>{{label}}</label>
        <ng-content></ng-content>
    `,
    styles: [`
        :host {
            user-select: text;
            margin-bottom: 18px;
        }

        label {
            display: block;
            color: var(--text-light);
            margin-bottom: 6px;
            user-select: none;
        }
    `]
})
export class LabelComponent {
    @Input() label: string = '';
}


@Component({
    selector: 'dui-label-grid',
    template: `
        <ng-content></ng-content>
    `,
    styles: [`
        :host {
            display: grid;
            gap: 15px;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
    `],
    host: {
        '[style.grid-template-columns]': `templateColumns`
    }
})
export class LabelGridComponent {
    @Input() labelWidth: string | number = '150px';

    get templateColumns(){
        return `repeat(auto-fit, minmax(${this.labelWidth}, 1fr))`;
    }
}
