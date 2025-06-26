import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class DuiDocument implements OnDestroy {
    document = inject(DOCUMENT, { optional: true });

    activeElement = signal<Element | undefined>(undefined);

    onFocus = () => {
        if (!this.document) return;
        this.activeElement.set(this.document.activeElement || undefined);
    };

    constructor() {
        this.document?.addEventListener('focusin', this.onFocus);
        this.document?.addEventListener('focusout', this.onFocus);
    }

    ngOnDestroy() {
        this.document?.removeEventListener('focusin', this.onFocus);
        this.document?.removeEventListener('focusout', this.onFocus);
    }
}
