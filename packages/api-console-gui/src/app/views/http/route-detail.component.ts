import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { ApiRoute } from '@deepkit/api-console-api';
import { isArray, isObject } from '@deepkit/core';
import { extractDataStructure, extractDataStructureFromSchema, Request, RouteState, Store } from '../../store';
import { ControllerClient } from '../../client';
import { Router } from '@angular/router';
import { DuiDialog } from '@deepkit/desktop-ui';
import { headerStatusCodes, methods, trackByIndex, typeToTSJSONInterface } from '../../utils';
import { getTypeJitContainer } from '@deepkit/type';

@Component({
    selector: 'api-console-route-detail',
    template: `
        <div class="route">
            <div class="url-input-container">
                <dui-button-group padding="none">
                    <dui-select style="width: 85px;" [(ngModel)]="routeState.method" textured>
                        <dui-option *ngFor="let m of methods; trackBy: trackByIndex"
                                    [value]="m"
                                    [disabled]="!route.httpMethods.includes(m)">{{m}}</dui-option>
                    </dui-select>
                    <div class="url text-selection">
                        <div>{{route.path}}</div>
                    </div>
                    <dui-button icon="play" textured (click)="execute(route)"></dui-button>
                </dui-button-group>
            </div>

            <div class="route-container overlay-scrollbar-small">
                <dui-button-group style="margin: 6px 1px;">
                    <dui-tab-button (click)="routeTab = 'query'" [active]="routeTab === 'query'">Query</dui-tab-button>
                    <dui-tab-button (click)="routeTab = 'body'" [active]="routeTab === 'body'">Body</dui-tab-button>
                    <dui-tab-button (click)="routeTab = 'header'" [active]="routeTab === 'header'">Header</dui-tab-button>
                </dui-button-group>

                <deepkit-box *ngIf="routeTab === 'body'">
                    <ng-container *ngIf="!route.getBodyType()">
                        <div class="box-info-text">This route has no body defined.</div>
                    </ng-container>
                    <ng-container *ngIf="route.getBodyType() as schema">
                        <ng-container *ngFor="let p of schema.getProperties(); trackBy: trackByIndex">
                            <api-console-input [decoration]="p" (keyDown)="consoleInputKeyDown($event, route)"
                                               [model]="routeState.body.getProperty(p.name)"
                                               [type]="p.property"
                                               (modelChange)="updateRouteState(route)"></api-console-input>
                        </ng-container>
                        <div class="ts text-selection">
                            <div codeHighlight [code]="typeToTSJSONInterface(schema.type, {defaultIsOptional: true})"></div>
                        </div>
                    </ng-container>
                </deepkit-box>

                <deepkit-box style="padding: 0" *ngIf="routeTab === 'header'">
                    <api-console-headers [(model)]="routeState.headers" (modelChange)="updateRouteState(route)"></api-console-headers>
                </deepkit-box>

                <deepkit-box style="padding-top: 0;" *ngIf="routeTab === 'query'">
                    <ng-container *ngIf="!route.getQueryType() && !route.getUrlType()">
                        <div class="box-info-text">This route has no query parameters defined.</div>
                    </ng-container>
                    <ng-container *ngIf="route.getUrlType() as schema">
                        <ng-container *ngFor="let p of schema.getProperties(); trackBy: trackByIndex">
                            <api-console-input [decoration]="p" (keyDown)="consoleInputKeyDown($event, route)"
                                               [model]="routeState.urls.getProperty(p.name)"
                                               [type]="p.property"
                                               (modelChange)="updateRouteState(route)"></api-console-input>
                        </ng-container>
                    </ng-container>

                    <ng-container *ngIf="route.getQueryType() as schema">
                        <ng-container *ngFor="let p of schema.getProperties(); trackBy: trackByIndex">
                            <api-console-input [decoration]="p" (keyDown)="consoleInputKeyDown($event, route)"
                                               [model]="routeState.params.getProperty(p.name)"
                                               [type]="p.property"
                                               (modelChange)="updateRouteState(route)"></api-console-input>
                        </ng-container>
                        <div class="ts text-selection">
                            <div codeHighlight [code]="typeToTSJSONInterface(schema.type, {defaultIsOptional: true})"></div>
                        </div>
                    </ng-container>
                </deepkit-box>

                <deepkit-box style="padding: 12px">
                    <div class="labeled-values">
                        <div>
                            <label>Category</label>
                            {{route.category || 'none'}}
                        </div>
                        <div>
                            <label>Groups</label>
                            {{route.groups.join(',') || 'none'}}
                        </div>
                        <div style="margin-top: 10px; flex: 2 1 auto;">
                            <label>Description</label>
                            <div class="formatted-text">{{route.description || 'none'}}</div>
                        </div>
                    </div>
                </deepkit-box>

                <ng-container *ngIf="!route.responses.length">
                    <deepkit-box title="Default response" *ngIf="route.getResultType() as schema">
                        <div class="ts text-selection">
                            <div codeHighlight [code]="typeToTSJSONInterface(schema)"></div>
                        </div>
                    </deepkit-box>
                </ng-container>

                <deepkit-box title="Response {{response.statusCode}} {{headerStatusCodes[response.statusCode + '']}}"
                             *ngFor="let response of route.responses; trackBy: trackByIndex">
                    <div class="response-description">
                        {{response.description}}
                    </div>
                    <ng-container *ngIf="response.getType() as s">
                        <div class="ts text-selection">
                            <div codeHighlight [code]="typeToTSJSONInterface(s)"></div>
                        </div>
                    </ng-container>
                </deepkit-box>
            </div>
        </div>

        <deepkit-toggle-box title="Code-generation" [(visible)]="store.state.viewHttp.codeGenerationVisible" (visibleChange)="store.store()">
            <ng-container header>
                <dui-select textured small [(ngModel)]="store.state.viewHttp.codeGenerationType" (ngModelChange)="updateRouteState(route)">
                    <dui-option value="curl">cURL</dui-option>
                    <dui-option value="http">HTTP</dui-option>
                </dui-select>
            </ng-container>

            <ng-container *ngIf="store.state.viewHttp.codeGenerationVisible">
                <div class="code-generation-code overlay-scrollbar-small" codeHighlight="bash" [code]="codeGenerated"></div>
            </ng-container>
        </deepkit-toggle-box>
    `,
    styleUrls: ['./route-detail.component.scss'],
    standalone: false
})
export class HttpRouteDetailComponent implements OnChanges {
    typeToTSJSONInterface = typeToTSJSONInterface;
    trackByIndex = trackByIndex;
    headerStatusCodes = headerStatusCodes;
    methods = methods;

    routeTab: 'query' | 'body' | 'header' = 'query';

    @Input() route!: ApiRoute;
    @Input() routeState!: RouteState;
    @Output() executed = new EventEmitter<void>();

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

    constructor(
        protected client: ControllerClient,
        public store: Store,
        public cd: ChangeDetectorRef,
        protected dialog: DuiDialog,
        protected router: Router,
    ) {

    }

    ngOnChanges(): void {
        this.updateRouteState();
    }

    consoleInputKeyDown(event: KeyboardEvent, route: ApiRoute) {
        if (event.key.toLowerCase() === 'enter') {
            this.execute(route);
        }
    }

    toggleCodeGenerationVisibility() {
        this.store.set(state => {
            state.viewHttp.codeGenerationVisible = !state.viewHttp.codeGenerationVisible;
        });
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

        const querySchema = route.getQueryType();
        if (querySchema) {
            const queryData: any = {};
            Object.assign(queryData, extractDataStructureFromSchema(routeState.params, querySchema));

            for (const [name, value] of Object.entries(queryData)) {
                extract(name, value);
            }
        }

        const urlSchema = route.getUrlType();
        if (urlSchema) {
            for (const property of urlSchema.getProperties()) {
                const regexp = getTypeJitContainer(property.property)['.deepkit/api-console/url-regex'] ||= new RegExp(`(:${String(property.name)})([^\w]|$)`);
                const v = extractDataStructure(routeState.urls.getProperty(property.name), property.type);
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

        const bodySchema = route.getBodyType();
        if (bodySchema) {
            routeState.resolvedBody = extractDataStructureFromSchema(routeState.body, bodySchema);
        }

        if (environment) {
            routeState.fullHeaders = [...environment.headers, ...routeState.headers];
        } else {
            routeState.fullHeaders = [...routeState.headers];
        }

        routeState.fullUrl = HttpRouteDetailComponent.getUrl() + url;
        this.codeGenerated = this.codeGenerators[this.store.state.viewHttp.codeGenerationType](route, routeState);

        this.store.store();
    }

    static getUrl(): string {
        return location.protocol + '//' + (location.port === '4200' ? location.hostname + ':8080' : location.host);
    }

    async execute(route?: ApiRoute) {
        route = route || this.store.state.route;
        if (!route) return;

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

        // this.updateRequests();

        try {
            const start = performance.now();
            let body: any = undefined;

            const headers: Record<any, any> = {};
            for (const { name, value } of routeState.fullHeaders) {
                headers[name] = value;
            }

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
        } catch (error: any) {
            request.error = error.message;
        }

        this.executed.emit();
        this.store.store();
        this.cd.detectChanges();
    }
}
