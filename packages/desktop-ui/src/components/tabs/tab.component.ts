import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'dui-tab',
    template: `
        <div class="content">
            <ng-content></ng-content>
        </div>
        <dui-icon *ngIf="removable" class="closer" (click)="onClose()" clickable name="times"></dui-icon>
    `,
    host: {
        '[class.active]': 'active',
    },
    styleUrls: ['./tab.component.scss'],
})
export class TabComponent {
    @Input() active: boolean = false;
    @Input() removable: boolean = true;

    @Output() close = new EventEmitter();

    constructor() {}

    onClose() {
        this.close.emit();
    }
}
