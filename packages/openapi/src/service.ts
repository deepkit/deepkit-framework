import { HttpRouteFilter, HttpRouterFilterResolver } from '@deepkit/http';
import { ScopedLogger } from '@deepkit/logger';

import { OpenAPIConfig } from './config';
import { OpenAPIDocument } from './document';

export class OpenAPIService {
    constructor(
        private routerFilter: HttpRouteFilter,
        protected filterResolver: HttpRouterFilterResolver,
        private logger: ScopedLogger,
        private config: OpenAPIConfig,
    ) {}

    serialize() {
        const routes = this.filterResolver.resolve(this.routerFilter.model);
        const openApiDocument = new OpenAPIDocument(routes, this.logger, this.config);
        return openApiDocument.serializeDocument();
    }
}
