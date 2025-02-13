import { Component } from '@angular/core';

@Component({
    selector: 'dui-tabs',
    standalone: false,
    template: `
        <ng-content></ng-content>`,
    styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
}
