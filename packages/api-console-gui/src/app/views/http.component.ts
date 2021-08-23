import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ControllerClient } from '../client';
import { ApiRoute } from '../../api';
import { classSchemaToTSInterface, headerStatusCodes, propertyToTSInterface, trackByIndex } from '../utils';
import { ClassSchema } from '@deepkit/type';
import { Environment, extractDataStructure, extractDataStructureFromSchema, Request, RouteState, Store } from '../store';
import { copy, isArray, isObject } from '@deepkit/core';
import { Subscription } from 'rxjs';
import { DuiDialog } from '@deepkit/desktop-ui';
import { EnvironmentDialogComponent } from '../components/environment-dialog.component';
import { filterAndSortRoutes } from './view-helper';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
    templateUrl: './http.component.html',
    styleUrls: ['./http.component.scss']
})
export class HttpComponent implements OnInit, OnDestroy {
    headerStatusCodes = headerStatusCodes;
    propertyToTSInterface = propertyToTSInterface;
    classSchemaToTSInterface = classSchemaToTSInterface;
    trackByIndex = trackByIndex;
    public filteredRoutes: ApiRoute[] = [];
    public routes: ApiRoute[] = [];

    public requests: Request[] = [];

    routeTab: 'query' | 'body' | 'header' = 'query';

    routesWidth: number = 320;

    codeGenerated: string = '';

    codeGenerators: { [name: string]: (r: ApiRoute, s: RouteState) => string } = {
        'curl': (r: ApiRoute, s: RouteState) => {
            const args: string[] = [];
            for (const h of s.fullHeaders) {
                if (!h.name) continue;
                args.push(`-H '${h.name}: ${h.value}'`);
            }

            if (s.resolvedBody) {
                args.push(`-H 'Content-Type: application/json'`);
                args.push(`-d '${JSON.stringify(s.resolvedBody)}'`);
            }

            if (s.method === 'GET') return `curl ${args.join(' ')} '${s.fullUrl}'`;
            return `curl -X ${s.method} ${args.join(' ')}  '${s.fullUrl}'`;
        },
        'http': (r: ApiRoute, s: RouteState) => {
            const headers: string[] = [];

            for (const h of s.fullHeaders) {
                if (!h.name) continue;
                headers.push(`${h.name}: ${h.value}`);
            }

            let body = '';
            if (s.resolvedBody) {
                body = JSON.stringify(s.resolvedBody);
            }

            return `${s.method} ${s.fullUrl}${headers.length ? '\n' : ''}${headers.join('\n')}\n\n${body}`;
        }
    };

    public methods: string[] = [
        'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'
    ];

    public categories: string[] = [];
    public groups: string[] = [];

    protected reconnectedSub: Subscription;
    protected routeParamsSub: Subscription;

    constructor(
        protected client: ControllerClient,
        public store: Store,
        public cd: ChangeDetectorRef,
        public activatedRoute: ActivatedRoute,
        protected dialog: DuiDialog,
        protected router: Router,
    ) {
        this.reconnectedSub = client.client.transporter.reconnected.subscribe(async () => {
            await this.loadRoutes();
        });

        this.routeParamsSub = this.activatedRoute.queryParams.subscribe(() => {
            this.selectRouteFromRoute();
        });
    }

    ngOnDestroy(): void {
        this.reconnectedSub.unsubscribe();
        this.routeParamsSub.unsubscribe();
    }

    async ngOnInit() {
        await this.loadRoutes();
    }

    openRequest(r: Request) {
        window.open(r.url, '_blank');
    }

    isOpen(r: Request, i: number): boolean {
        return r.open === undefined ? i === 0 : r.open;
    }

    async newEnvironment() {
        const a = await this.dialog.prompt('Environment name', '');
        if (!a) return;
        this.store.state.environments.push(new Environment(a));
        this.store.state.environments = copy(this.store.state.environments);
        this.store.state.activeEnvironmentIndex = this.store.state.environments.length - 1;
    }

    async openEnvironment() {
        const environment = this.store.state.activeEnvironment;
        if (!environment) return;
        await this.dialog.open(EnvironmentDialogComponent, { environment }).close;
        if (this.store.state.route) {
            this.updateRouteState(this.store.state.route);
        }
    }

    removeRequest(index: number): void {
        this.store.set(state => {
            const removed = state.requests.splice(index, 1);
            for (const r of removed) {
                localStorage.removeItem('@deepkit/api-console/request/result/' + r.bodyStoreId);
                localStorage.removeItem('@deepkit/api-console/request/json/' + r.bodyStoreId);
            }
        });

        this.updateRequests();
    }

    filterBodies(bodies: ClassSchema[]): ClassSchema[] {
        return bodies.filter(v => {
            if (v.name === '@deepkit/UploadedFile') return false;
            return true;
        });
    }

    isOrange(status: number): boolean {
        return status >= 400 && status < 500;
    }

    isRed(status: number): boolean {
        return status >= 500;
    }

    isParameter(s: string): boolean {
        return s[0] === ':';
    }

    switchViewRequest(view: 'all' | 'selected'): void {
        this.store.set(state => {
            state.viewHttp.viewRequests = view;
        });

        this.updateRequests();
    }

    consoleInputKeyDown(event: KeyboardEvent, route: ApiRoute) {
        if (event.key.toLowerCase() === 'enter') {
            this.execute(route);
        }
    }

    updateRequests() {
        if (this.store.state.viewHttp.viewRequests === 'all') {
            this.requests = this.store.state.requests;
        } else {
            const route = this.store.state.route;
            if (route) {
                this.requests = this.store.state.requests.filter(r => {
                    return route.id === r.id;
                });
            } else {
                if (this.requests.length > 0) this.requests = [];
            }
        }
    }

    toggleServerStatsVisibility() {
        this.store.set(state => {
            state.viewHttp.serverStatsVisible = !state.viewHttp.serverStatsVisible;
        });
    }

    toggleCodeGenerationVisibility() {
        this.store.set(state => {
            state.viewHttp.codeGenerationVisible = !state.viewHttp.codeGenerationVisible;
        });
    }

    updateFilter() {
        this.filteredRoutes = filterAndSortRoutes(this.routes, this.store.state.viewHttp);
        this.store.store();
        this.cd.detectChanges();
    }

    navigateToRoute(route?: ApiRoute) {
        this.router.navigate(['api/http'], { queryParams: { route: route?.id } });
    }

    setRoute(route?: ApiRoute) {
        if (route) {
            let routeState: RouteState | undefined = this.store.state.routeStates[route.id];
            if (!routeState) {
                routeState = new RouteState(route.id, 'GET');
                if (route.httpMethods.length) routeState.method = route.httpMethods[0];
                this.store.set(state => {
                    state.routeStates[route.id] = routeState!;
                });
            }

            this.updateRouteState(route);
        }

        this.store.set(state => {
            state.route = route;
        });

        this.updateRequests();
        this.cd.detectChanges();
    }

    async loadRoutes() {
        this.routes = await this.client.api.getRoutes();

        const categories = new Set<string>();
        const groups = new Set<string>();
        for (const route of this.routes) {
            if (route.category) categories.add(route.category);
            for (const group of route.groups) if (group) groups.add(group);
        }

        this.selectRouteFromRoute(true);

        this.categories = [...categories];
        this.groups = [...groups];

        console.log('this.routes', this.routes);
        this.updateFilter();
    }

    protected selectRouteFromRoute(force: boolean = false) {
        const selectedRoute = this.activatedRoute.snapshot.queryParams.route;
        if (force || selectedRoute && (!this.store.state.route || this.store.state.route.id !== selectedRoute)) {
            const route = this.routes.find(v => v.id === selectedRoute);
            if (!route) return;
            this.setRoute(route);
        }
    }

    static getUrl(): string {
        return location.protocol + '//' + (location.port === '4200' ? location.hostname + ':8080' : location.host);
    }

    updateRouteState(route?: ApiRoute): void {
        route = route || this.store.state.route;
        if (!route) return;
        const routeState = this.store.state.routeStates[route.id];
        const environment = this.store.state.activeEnvironment;
        if (!routeState) return;

        let url = route.path;

        const query: string[] = [];

        function extract(name: string, value: any) {
            if (value === undefined || value === '') return;
            if (isObject(value)) {
                for (const [k, v] of Object.entries(value)) {
                    extract(name + '[' + k + ']', v);
                }
            } else if (isArray(value)) {
                for (const v of value) {
                    extract(name + '[]', v);
                }
            } else {
                query.push(`${name}=${encodeURIComponent(value)}`);
            }
        }

        const querySchema = route.getQuerySchema();
        if (querySchema) {
            const queryData: any = {};
            for (const property of querySchema.getProperties()) {
                queryData[property.name] = extractDataStructure(routeState.params.getProperty(property.name), property);
            }
            for (const [name, value] of Object.entries(queryData)) {
                extract(name, value);
            }
        }

        const urlSchema = route.getUrlSchema();
        if (urlSchema) {
            for (const property of urlSchema.getProperties()) {
                const regexp = property.data['.deepkit/api-console/url-regex'] ||= new RegExp(`(:${property.name})([^\w]|$)`);
                const v = extractDataStructure(routeState.urls.getProperty(property.name), property);
                url = url.replace(regexp, function (a: any, b: any, c: any) {
                    return String(v) + c;
                });
            }
        }

        if (query.length) {
            if (url.includes('?')) {
                url += '&' + query.join('&');
            } else {
                url += '?' + query.join('&');
            }
        }

        const bodySchema = route.getBodySchema();
        if (bodySchema) {
            routeState.resolvedBody = extractDataStructureFromSchema(routeState.body, bodySchema);
        }

        if (environment) {
            routeState.fullHeaders = [...environment.headers, ...routeState.headers];
        } else {
            routeState.fullHeaders = routeState.headers;
        }

        routeState.fullUrl = HttpComponent.getUrl() + url;
        this.codeGenerated = this.codeGenerators[this.store.state.viewHttp.codeGenerationType](route, routeState);

        this.store.store();
    }

    async execute(route: ApiRoute) {
        const routeState = this.store.state.routeStates[route.id];
        if (!routeState) return;

        this.updateRouteState(route);
        const request = new Request(routeState.id, routeState.method, routeState.fullUrl);

        this.store.set(state => {
            if (state.requests.length && state.requests[state.requests.length - 1].open === undefined) {
                state.requests[state.requests.length - 1].open = false;
            }
            state.requests.unshift(request);
            if (state.requests.length > 100) state.requests.splice(100);
        });
        this.updateRequests();

        try {
            const start = performance.now();
            let body: any = undefined;
            const headers: Record<any, any> = {};

            Object.assign(headers, routeState.headers);
            if (routeState.resolvedBody) {
                body = JSON.stringify(routeState.resolvedBody);
                headers['Content-Type'] = 'application/json';
            }

            this.cd.detectChanges();
            const response = await fetch(routeState.fullUrl, { method: routeState.method, body, headers });
            request.took = performance.now() - start;
            request.status = response.status;
            request.statusText = response.statusText;
            for (const [name, value] of (response.headers as any)) {
                request.headers.push({ name, value });
            }

            this.cd.detectChanges();
            const result = await response.text();

            const contentType = response.headers.get('content-type') || '';
            if (contentType.startsWith('application/json')) {
                request.json = JSON.stringify(JSON.parse(result), undefined, 4);
            } else {
                request.result = result;
            }
            this.cd.detectChanges();
        } catch (error) {
            request.error = error.message;
        }

        this.store.store();
        this.cd.detectChanges();
    }
}
