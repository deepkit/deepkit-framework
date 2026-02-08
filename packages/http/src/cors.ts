/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { eventDispatcher } from '@deepkit/event';
import { LoggerInterface } from '@deepkit/logger';

import { HttpWorkflowEvent, httpWorkflow } from './http.js';
import { HttpResponse } from './model.js';
import { CorsOptions, HttpConfig } from './module.config.js';

const DEFAULT_ALLOW_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
const DEFAULT_MAX_AGE = 86400; // 24 hours

export class CorsListener {
    private readonly corsConfig: CorsOptions | undefined;
    private readonly debug: boolean;

    constructor(
        config: HttpConfig,
        private logger: LoggerInterface,
    ) {
        this.corsConfig = config.cors;
        this.debug = config.debug;
    }

    /**
     * Handle CORS at request level (before routing).
     * Sets global CORS headers and handles preflight OPTIONS requests.
     */
    @eventDispatcher.listen(httpWorkflow.onRequest, 50)
    onRequest(event: typeof httpWorkflow.onRequest.event): void {
        // Fast path: no global CORS config
        if (!this.corsConfig) return;

        const origin = event.request.headers.origin;

        // Fast path: no origin header (same-origin request)
        if (!origin) return;

        const allowedOrigin = this.resolveOrigin(origin, this.corsConfig);

        if (allowedOrigin === false) {
            if (this.debug) {
                this.logger.debug(`CORS: Origin "${origin}" not allowed`);
            }
            return;
        }

        this.setCorsHeaders(event.response, allowedOrigin, this.corsConfig);

        // Handle preflight OPTIONS request
        if (event.request.method === 'OPTIONS') {
            this.handlePreflight(event, this.corsConfig);
        }
    }

    /**
     * Handle per-route CORS overrides (after routing).
     * Route config is pre-merged at registration time - zero allocation here.
     * Priority 101: runs AFTER HttpListener.onRoute (100) which resolves the route.
     */
    @eventDispatcher.listen(httpWorkflow.onRoute, 101)
    onRoute(event: typeof httpWorkflow.onRoute.event): void {
        if (!event.route) return;

        const origin = event.request.headers.origin;
        if (!origin) return;

        // Get pre-merged config from route (merged at registration time, not here)
        const routeCors = event.route.data.get('cors');

        // No route-level config - global headers already set in onRequest
        if (routeCors === undefined) return;

        // Route explicitly disables CORS
        if (routeCors === false) {
            this.removeCorsHeaders(event.response);
            if (this.debug) {
                this.logger.debug(`CORS: Disabled for route ${event.route.getFullPath()}`);
            }
            return;
        }

        // Route has config (already merged with controller at registration time)
        // Re-check origin - route might have different allowOrigin than global
        const allowedOrigin = this.resolveOrigin(origin, routeCors);

        if (allowedOrigin === false) {
            this.removeCorsHeaders(event.response);
            if (this.debug) {
                this.logger.debug(`CORS: Origin "${origin}" not allowed for route ${event.route.getFullPath()}`);
            }
            return;
        }

        // Re-apply headers with route config (overwrites global headers)
        this.setCorsHeaders(event.response, allowedOrigin, routeCors);
    }

    /**
     * Resolve whether the given origin is allowed.
     * Returns the origin string to use, or false if not allowed.
     * Zero allocation - only comparisons and function calls.
     */
    private resolveOrigin(origin: string, config: CorsOptions | Partial<CorsOptions>): string | false {
        const allowOrigin = config.allowOrigin;
        if (allowOrigin === undefined) return false;

        if (allowOrigin === true) return origin;
        if (allowOrigin === '*') return config.credentials ? origin : '*';
        if (typeof allowOrigin === 'string') return allowOrigin === origin ? origin : false;
        if (Array.isArray(allowOrigin)) return allowOrigin.includes(origin) ? origin : false;
        if (allowOrigin instanceof RegExp) return allowOrigin.test(origin) ? origin : false;
        if (typeof allowOrigin === 'function') {
            const result = allowOrigin(origin);
            return result === true ? origin : typeof result === 'string' ? result : false;
        }
        return false;
    }

    /**
     * Set CORS headers on the response.
     */
    private setCorsHeaders(response: HttpResponse, origin: string, config: CorsOptions | Partial<CorsOptions>): void {
        response.setHeader('Access-Control-Allow-Origin', origin);

        if (config.credentials) {
            response.setHeader('Access-Control-Allow-Credentials', 'true');
        }

        if (origin !== '*') {
            response.setHeader('Vary', 'Origin');
        }

        const exposeHeaders = config.exposeHeaders;
        if (exposeHeaders && exposeHeaders.length > 0) {
            response.setHeader('Access-Control-Expose-Headers', exposeHeaders.join(', '));
        }
    }

    /**
     * Remove CORS headers from the response.
     */
    private removeCorsHeaders(response: HttpResponse): void {
        response.removeHeader('Access-Control-Allow-Origin');
        response.removeHeader('Access-Control-Allow-Credentials');
        response.removeHeader('Access-Control-Expose-Headers');
        response.removeHeader('Vary');
    }

    /**
     * Handle preflight OPTIONS request.
     * Sends 204 No Content and ends the response.
     */
    private handlePreflight(event: HttpWorkflowEvent, config: CorsOptions | Partial<CorsOptions>): void {
        const response = event.response;
        const request = event.request;

        const allowMethods = config.allowMethods || DEFAULT_ALLOW_METHODS;
        response.setHeader('Access-Control-Allow-Methods', allowMethods.join(', '));

        const allowHeaders = config.allowHeaders;
        if (allowHeaders === true || allowHeaders === undefined) {
            const requestHeaders = request.headers['access-control-request-headers'];
            if (requestHeaders) {
                response.setHeader('Access-Control-Allow-Headers', requestHeaders);
            }
        } else if (Array.isArray(allowHeaders) && allowHeaders.length > 0) {
            response.setHeader('Access-Control-Allow-Headers', allowHeaders.join(', '));
        }

        response.setHeader('Access-Control-Max-Age', String(config.maxAge ?? DEFAULT_MAX_AGE));

        response.writeHead(204);
        response.end();
    }
}
