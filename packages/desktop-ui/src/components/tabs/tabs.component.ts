import { Component, Input } from '@angular/core';

@Component({
    selector: 'dui-tabs',
    template: `
        <ng-content></ng-content>`,
    styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
}