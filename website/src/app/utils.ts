import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';

export class PlatformHelper {
    platformId = inject(PLATFORM_ID);

    isBrowser() {
        return isPlatformBrowser(this.platformId);
    }

    isServer() {
        return isPlatformServer(this.platformId);
    }
}
