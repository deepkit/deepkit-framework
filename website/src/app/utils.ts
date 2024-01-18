import { inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser, isPlatformServer } from "@angular/common";

export class PlatformHelper {
    platformId = inject(PLATFORM_ID);

    isBrowser() {
        return isPlatformBrowser(this.platformId);
    }

    isServer() {
        return isPlatformServer(this.platformId);
    }
}
