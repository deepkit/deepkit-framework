import { Inject, Injectable } from "@angular/core";
import { PageResponseModel } from "./page-response-model";

@Injectable()
export class PageResponse {
    constructor(@Inject('page-response-model') private model: PageResponseModel) {
    }

    notFound() {
        this.model.statusCode = 404;
    }

    redirect(url: string) {
        this.model.redirect = url;
    }
}
