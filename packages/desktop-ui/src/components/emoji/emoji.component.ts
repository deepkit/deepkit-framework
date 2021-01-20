/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Component, Input } from "@angular/core";
import { Emoji, emojis } from "./emojis";

@Component({
    selector: 'dui-emoji',
    template: `
        <div class="emoji-image"
             *ngIf="emoji as em"
             [style.transform]="'scale(' + (1/32*size) +')'"
             [style.backgroundPosition]="-((em.x * 34) + 1) + 'px ' + -((em.y * 34) + 1) + 'px'">
        </div>
    `,
    host: {
        '[style.height.px]': 'size',
        '[style.width.px]': 'size',
    },
    styleUrls: ['./emoji.component.scss']
})
export class EmojiComponent {
    @Input() name!: string;
    @Input() size: number = 16;

    get emoji(): Emoji | undefined {
        if (this.name) {
            if (this.name[0] === ':') return emojis[this.name.substring(1, this.name.length - 1)];
            return emojis[this.name]
        }
    }
}
