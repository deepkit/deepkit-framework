/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { HtmlResponse, httpWorkflow, RouteConfig } from '@deepkit/http';
import { eventDispatcher } from '@deepkit/event';
import { Logger } from '@deepkit/logger';
import { inject, injectable } from '@deepkit/injector';
import { config } from './config';
import { join } from 'path';
import { readFileSync } from 'fs';
import { Router } from '@angular/router';
import domino from 'domino';

(global as any).window = global;
Object.assign(global, domino.createWindow());

@injectable()
export class AngularUniversalListener {
    protected serverModule: any;
    protected renderModule: any;
    protected platformDynamicServer: any;
    protected INITIAL_CONFIG: any;
    protected Router: any;
    protected indexHtml: string;

    protected routesFound = new Map<string, boolean>();
    protected cachedResponses = new Map<string, string>();

    protected router?: Router;

    constructor(
        protected logger: Logger,
        @inject(config) protected fullConfig: typeof config.type,
    ) {
        this.indexHtml = readFileSync(join(this.fullConfig.browserPath, 'index.html')).toString('utf8');
    }

    protected async loadServer() {
        if (this.serverModule) return;
        const serverMainPath = join(this.fullConfig.serverPath, 'main');
        const server = await import(serverMainPath);
        if (!server[this.fullConfig.serverModuleName]) {
            throw new Error(`No export named ${this.fullConfig.serverModuleName} found in ${serverMainPath}`);
        }
        this.serverModule = server[this.fullConfig.serverModuleName];
        this.renderModule = server.renderModule;
        this.platformDynamicServer = server.platformDynamicServer;
        this.INITIAL_CONFIG = server.INITIAL_CONFIG;
        this.Router = server.Router;
    }

    protected createModule() {
        const options = { url: '_random_init/' + Date.now(), document: this.indexHtml };
        const platform = this.platformDynamicServer([
            { provide: this.INITIAL_CONFIG, useValue: options },
        ]);
        return platform.bootstrapModule(this.serverModule);
    }

    async render(url: string): Promise<HtmlResponse> {
        let response = this.cachedResponses.get(url);

        if (!response) {
            response = await this.renderModule(this.serverModule, {
                document: this.indexHtml,
                url: url,
            }) as string;
            this.cachedResponses.set(url, response);
        }

        return new HtmlResponse(response);
    }

    async getRouter(): Promise<Router> {
        if (this.router) return this.router;

        const module = await this.createModule();
        this.router = module.injector.get(this.Router);
        if (!this.router) {
            throw new Error('No Angular Router found');
        }

        return this.router;
    }

    //since angular can contain default routes (for 404 for example), we check our
    //routes after all framework controller.
    @eventDispatcher.listen(httpWorkflow.onRoute, 101)
    async onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.response.headersSent) return;
        if (event.route) return;

        await this.loadServer();

        const found = this.routesFound.get(event.url);
        if (found === false) return;

        if (found === undefined) {
            const router = await this.getRouter();

            try {
                if (await router.navigateByUrl(event.url, { skipLocationChange: true })) {
                    this.routesFound.set(event.url, true);
                } else {
                    this.routesFound.set(event.url, false);
                    return;
                }
            } catch (error) {
                //we ignore that
                this.logger.log('Error navigating to Angular route', event.url, error.toString());
            }
        }

        event.routeFound(
            new RouteConfig('angular', ['GET'], event.url, { controller: AngularUniversalListener, methodName: 'render' }),
            () => [event.url]
        );
    }
}
