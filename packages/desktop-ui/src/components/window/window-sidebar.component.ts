import { Component, TemplateRef, ViewChild } from "@angular/core";

@Component({
    selector: 'dui-window-sidebar',
    template: `
        <ng-template #templateRef>
            <ng-content></ng-content>
        </ng-template>
    `,
    styleUrls: ['./window-sidebar.component.scss'],
})
export class WindowSidebarComponent {
    @ViewChild('templateRef', { static: true }) public template!: TemplateRef<any>;
}
