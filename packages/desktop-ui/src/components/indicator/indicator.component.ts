/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, Input } from '@angular/core';

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
