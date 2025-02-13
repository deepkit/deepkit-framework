import { inject, Injectable, RESPONSE_INIT } from '@angular/core';

@Injectable()
export class PageResponse {
    response = inject(RESPONSE_INIT, {optional: true});

    notFound() {
        if (!this.response) return;;
        this.response.status = 404;
    }

    redirect(url: string) {
        if (!this.response) return;
        this.response.status = 302;
        this.response.headers = { Location: url };
    }
}
