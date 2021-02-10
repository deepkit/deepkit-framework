/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, TemplateRef, ViewChild } from '@angular/core';

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
