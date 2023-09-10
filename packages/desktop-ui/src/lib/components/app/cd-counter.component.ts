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
    selector: 'dui-cd-counter',
    template: `{{counter}}`
})
export class CdCounterComponent {
    private i = 0;

    @Input() name?: string;

    get counter() {
        this.i++;
        return this.i;
    }
}
