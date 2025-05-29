import { stat } from 'fs/promises';
import { dirname, join } from 'path';
import send from 'send';
import { stringify } from 'yaml';

import { urlJoin } from '@deepkit/core';
import { eventDispatcher } from '@deepkit/event';
import { HttpRequest, HttpResponse, RouteConfig, httpWorkflow, normalizeDirectory } from '@deepkit/http';

import { OpenAPIConfig } from './config';
import { OpenAPIModule } from './module';
import { OpenAPIService } from './service';

export class OpenApiStaticRewritingListener {
    constructor(
        private openApi: OpenAPIService,
        private config: OpenAPIConfig,
        private module: OpenAPIModule,
    ) {}

    serialize() {
        const openApi = this.openApi.serialize();

        openApi.info.title = this.config.title;
        openApi.info.description = this.config.description;
        openApi.info.version = this.config.version;

        this.module.configureOpenApiFunction(openApi);
        return openApi;
    }

    get staticDirectory() {
        return dirname(require.resolve('swagger-ui-dist'));
    }

    get prefix() {
        return normalizeDirectory(this.config.prefix);
    }

    get swaggerInitializer() {
        return `
          window.onload = function() {
            window.ui = SwaggerUIBundle({
              url: ${JSON.stringify(this.prefix + 'openapi.yml')},
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout"
            });

          };
        `;
    }

    // @ts-ignore
    serve(path: string, request: HttpRequest, response: HttpResponse) {
        if (path.endsWith('/swagger-initializer.js')) {
            response.setHeader('content-type', 'application/javascript; charset=utf-8');
            response.end(this.swaggerInitializer);
        } else if (path.endsWith('/openapi.json')) {
            const s = JSON.stringify(this.serialize(), undefined, 2);
            response.setHeader('content-type', 'application/json; charset=utf-8');
            response.end(s);
        } else if (path.endsWith('/openapi.yaml') || path.endsWith('/openapi.yml')) {
            const s = stringify(this.serialize(), {
                aliasDuplicateObjects: false,
            });
            response.setHeader('content-type', 'text/yaml; charset=utf-8');
            response.end(s);
        } else {
            return new Promise(async (resolve, reject) => {
                const relativePath = urlJoin('/', request.url!.substring(this.prefix.length));
                if (relativePath === '') {
                    response.setHeader('location', this.prefix + 'index.html');
                    response.status(301);
                    return;
                }
                const finalLocalPath = join(this.staticDirectory, relativePath);

                const statResult = await stat(finalLocalPath);
                if (statResult.isFile()) {
                    const res = send(request, path, { root: this.staticDirectory });
                    res.pipe(response);
                    res.on('end', resolve);
                } else {
                    response.write(`The static path ${request.url} is not found.`);
                    response.status(404);
                }
            });
        }
    }

    @eventDispatcher.listen(httpWorkflow.onRoute, 101)
    onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.sent) return;
        if (event.route) return;

        if (!event.request.url?.startsWith(this.prefix)) return;

        const relativePath = urlJoin('/', event.url.substring(this.prefix.length));

        event.routeFound(
            new RouteConfig('static', ['GET'], event.url, {
                type: 'controller',
                controller: OpenApiStaticRewritingListener,
                module: this.module,
                methodName: 'serve',
            }),
            () => ({ arguments: [relativePath, event.request, event.response], parameters: {} }),
        );
    }
}
