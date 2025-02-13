/*
 * Copyright (c) Marc J. Schmidt <marc@marcjschmidt.de>
 * This file is part of Deepkit and licensed under GNU GPL v3. See the LICENSE file for more information.
 */

import { Component, Input } from '@angular/core';

@Component({
    selector: 'dui-section-header',
    standalone: false,
    template: `
        <div class="title">
            <ng-content></ng-content>
        </div>
        <div class="line"></div>
    `,
    host: {
        '[class.center]': 'center !== false'
    },
    styleUrls: ['./section-header.component.scss']
})
export class SectionHeaderComponent {
    @Input() center: boolean | '' = false;
}
