import { booleanAttribute, Component, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { DuiApp } from './app';
import { DOCUMENT } from '@angular/common';

@Component({
    selector: 'dui-style',
    template: '',
    styleUrl: '../../scss/dui.css',
    encapsulation: ViewEncapsulation.None,
})
export class DuiStyleComponent {
    // required to call DuiApp.start
    duiApp = inject(DuiApp);
    document = inject(DOCUMENT, { optional: true });

    /**
     * If true, the body applies the 'dui-normalized' class to normalize all elements.
     */
    normalizeStyle = input(false, { alias: 'normalize-style', transform: booleanAttribute });

    constructor() {
        effect(() => {
            const document = this.document;
            if (!document) return;
            if (this.normalizeStyle()) {
                document.body.classList.add('dui-normalized');
            } else {
                document.body.classList.remove('dui-normalized');
            }
        });
    }
}
