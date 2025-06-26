/*
 * Copyright (c) Marc J. Schmidt <marc@marcjschmidt.de>
 * This file is part of Deepkit and licensed under GNU GPL v3. See the LICENSE file for more information.
 */

import { booleanAttribute, Component, input } from '@angular/core';

@Component({
    selector: 'dui-section-header',
    template: `
        <div class="title">
            <ng-content></ng-content>
        </div>
        <div class="line"></div>
    `,
    host: {
        '[class.center]': 'center()'
    },
    styleUrls: ['./section-header.component.scss']
})
export class SectionHeaderComponent {
    center = input(false, { transform: booleanAttribute });
}
