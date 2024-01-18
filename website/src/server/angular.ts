import { HtmlResponse, httpWorkflow, Redirect, RouteConfig } from '@deepkit/http';
import { join } from 'node:path';
// @ts-ignore
import type { CommonEngine, RenderOptions } from '@angular/ssr';
// @ts-ignore
import type { Router } from '@angular/router';
import { eventDispatcher } from '@deepkit/event';
import { Logger } from '@deepkit/logger';
import { ApplicationServer } from '@deepkit/framework';
import { findParentPath } from '@deepkit/app';
import { PageResponseModel } from "@app/app/page-response-model";

Error.stackTraceLimit = 1500;

export class AngularListener {
    protected routesFound = new Map<string, boolean>();
    protected cachedResponses = new Map<string, { html: string, statusCode: number, redirect: string }>();

    protected router?: Router;
    protected engine?: CommonEngine;
    protected renderOptions: RenderOptions = {};

    constructor(
        private logger: Logger,
        private server: ApplicationServer,
    ) {
    }

    protected async getServer(): Promise<{ router: Router, engine: CommonEngine }> {
        if (this.router && this.engine) {
            return { router: this.router, engine: this.engine };
        }
        const dir = findParentPath('dist/app/', __dirname);
        if (!dir) throw new Error('Could not find dist/app/server folder');

        const serverModule = (await require(join(dir, 'server/main.js')));
        this.engine = new serverModule.CommonEngine(() => serverModule.bootstrap(
            this.server.getWorker().rpcKernel
        ), []);
        const indexHtml = join(join(dir, 'browser'), 'index.html');
        this.renderOptions.documentFilePath = indexHtml;

        return { router: this.router!, engine: this.engine! };
    }

    //since angular can contain default routes (for 404 for example), we check our
    //routes after all framework controller.
    @eventDispatcher.listen(httpWorkflow.onRoute, 102)
    async onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.response.headersSent) return;
        if (event.route) return;

        try {
            let response = this.cachedResponses.get(event.url);
            if (!response) {
                const server = await this.getServer();
                const page = new PageResponseModel();
                const renderOptions: RenderOptions = {
                    ...this.renderOptions, url: event.url, providers: [
                        { provide: 'page-response-model', useValue: page }
                        // { provide: RpcWebSocketClient, useValue: new DirectClient(this.server.getWorker().rpcKernel) },
                    ]
                };
                const html = await server.engine.render(renderOptions);

                response = { html: page.redirect ? '' : html, statusCode: page.statusCode ?? 200, redirect: page.redirect };
                this.cachedResponses.set(event.url, response);
            }

            event.routeFound(
                new RouteConfig('angular', ['GET'], event.url, {
                    type: 'function', fn() {
                        if (response!.redirect) {
                            return Redirect.toUrl(response!.redirect, 301);
                        }
                        return new HtmlResponse(response!.html || '', response!.statusCode);
                    }
                }),
                () => ({ arguments: [], parameters: {} })
            );
        } catch (error) {
            console.log(error);
        }
    }
}
