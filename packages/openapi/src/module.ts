import { createModuleClass } from '@deepkit/app';
import { HttpRouteFilter } from '@deepkit/http';

import { OpenAPIConfig } from './config';
import { OpenAPIService } from './service';
import { OpenApiStaticRewritingListener } from './static-rewriting-listener';
import { SerializedOpenAPI } from './types';

export class OpenAPIModule extends createModuleClass({
    config: OpenAPIConfig,
    providers: [OpenAPIService],
    exports: [OpenAPIService],
    listeners: [OpenApiStaticRewritingListener],
}) {
    protected routeFilter = new HttpRouteFilter().excludeRoutes({
        group: 'app-static',
    });

    configureOpenApiFunction: (openApi: SerializedOpenAPI) => void = () => {};

    configureOpenApi(configure: (openApi: SerializedOpenAPI) => void) {
        this.configureOpenApiFunction = configure;
        return this;
    }

    configureHttpRouteFilter(configure: (filter: HttpRouteFilter) => void) {
        configure(this.routeFilter);
        return this;
    }

    override process() {
        this.addProvider({ provide: HttpRouteFilter, useValue: this.routeFilter });
    }
}
