import { Component, OnInit } from '@angular/core';
import { ControllerClient } from '../client';
import { ApiRoute } from '../../api';
import { trackByIndex } from '../utils';

interface RouteState {
    url: string;
    method: string;
}

class Request {
    result?: any;
    json?: any;
    headers: { name: string, value: string }[] = [];

    status: number = 0;
    statusText: string = '';

    tab: string = 'body';

    open?: boolean;

    constructor(public method: string, public url: string) {
    }
}

@Component({
    template: `
        <div class="routes">
            <dui-button-group style="margin: 6px 12px;">
                <dui-tab-button [active]="true">HTTP</dui-tab-button>
                <dui-tab-button [active]="false">RPC</dui-tab-button>
            </dui-button-group>

            <div class="filter">
                <dui-button-group padding="none">
                    <dui-input round lightFocus placeholder="Filter ..." [(ngModel)]="filterPath" (ngModelChange)="updateFilter()"></dui-input>
                    <dui-select style="width: 85px;" textured [(ngModel)]="filterMethod" (ngModelChange)="updateFilter()">
                        <dui-option [value]="''">ALL</dui-option>
                        <dui-option *ngFor="let m of methods; trackBy: trackByIndex"
                                    [value]="m">{{m}}</dui-option>
                    </dui-select>
                </dui-button-group>
            </div>

            <dui-list [(ngModel)]="route" (ngModelChange)="setRoute($event)">
                <dui-list-item [value]="route" *ngFor="let route of filteredRoutes">
                    <div class="list-item">
                        <div class="path">{{route.path}}</div>
                        <div class="method text-light">{{route.httpMethods.join(', ')}}</div>
                    </div>
                </dui-list-item>
            </dui-list>
        </div>

        <div class="form overlay-scrollbar-small">
            <ng-container *ngIf="route && routeStates.get(route.id) as routeState">

                <dui-button-group padding="none" style="width: 100%;">
                    <dui-select style="width: 85px;" [(ngModel)]="routeState.method" textured>
                        <dui-option *ngFor="let m of methods; trackBy: trackByIndex"
                                    [value]="m"
                                    [disabled]="!route.httpMethods.includes(m)">{{m}}</dui-option>
                    </dui-select>
                    <!--                    <div class="url-input">-->
                    <!--                        <ng-container *ngFor="let s of segments; let i = index; trackBy: trackByIndex">-->
                    <!--                            <ng-container *ngIf="isParameter(s)">-->
                    <!--                                <dui-input lightFocus (enter)="execute()" [(ngModel)]="segmentValues[i]"></dui-input>-->
                    <!--                            </ng-container>-->
                    <!--                            <div class="urlPart" *ngIf="!isParameter(s)">{{s}}</div>-->
                    <!--                        </ng-container>-->
                    <!--                    </div>-->
                    <dui-input style="flex: 1" lightFocus (enter)="execute(routeState)" [(ngModel)]="routeState.url"></dui-input>
                    <dui-button icon="play" textured (click)="execute(routeState)"></dui-button>
                </dui-button-group>

                <div *ngFor="let p of route.parameters; trackBy: trackByIndex">
                    {{p.type}} {{p.name}}
                </div>

                <div *ngIf="route.deserializedBodySchemas as bodies">
                    <pre *ngFor="let s of bodies">{{s.toString()}}</pre>
                </div>
            </ng-container>
        </div>

        <div class="right overlay-scrollbar-small">
            <div class="request" *ngFor="let r of requests; let i = index; trackBy: trackByIndex">
                <div class="line">
                    <dui-icon clickable (click)="r.open = !isOpen(r, i)" [name]="isOpen(r, i) ? 'arrow_down' : 'arrow_right'"></dui-icon>
                    <div class="method">{{r.method}}</div>
                    <div class="url text-selection">{{r.url}}</div>
                    <div class="status">
                        <div class="status-box" [class.orange]="isOrange(r.status)" [class.red]="isRed(r.status)">
                            {{r.status === 0 ? 'pending' : r.status}} {{r.statusText}}
                        </div>
                    </div>
                </div>
                <div class="results" [class.visible]="isOpen(r, i)">
                    <dui-button-group style="margin-bottom: 5px;">
                        <dui-tab-button (click)="r.tab = 'body'" [active]="r.tab === 'body'">Body</dui-tab-button>
                        <dui-tab-button (click)="r.tab = 'header'" [active]="r.tab === 'header'">Header</dui-tab-button>
                    </dui-button-group>

                    <ng-container *ngIf="r.tab === 'header'">
                        <dui-table [items]="r.headers" borderless noFocusOutline [autoHeight]="true">
                            <dui-table-column name="name" [width]="180" class="text-selection"></dui-table-column>
                            <dui-table-column name="value" [width]="280" class="text-selection"></dui-table-column>
                        </dui-table>
                    </ng-container>

                    <ng-container *ngIf="r.tab === 'body'">
                        <pre class="text-selection overlay-scrollbar-small" style="padding-bottom: 8px;">{{r.result}}</pre>
                    </ng-container>
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./http.component.scss']
})
export class HttpComponent implements OnInit {
    trackByIndex = trackByIndex;
    public filteredRoutes: ApiRoute[] = [];
    public routes: ApiRoute[] = [];

    public route?: ApiRoute;

    // public method: string = 'GET';
    // public path: string = '';
    // public segments: string[] = [];
    // public segmentValues: string[] = [];

    filterMethod: string = '';
    filterPath: string = '';

    isOpen(r: Request, i: number): boolean {
        return r.open === undefined ? i === 0 : r.open;
    }

    isOrange(status: number): boolean {
        return status >= 400 && status < 500;
    }

    isRed(status: number): boolean {
        return status >= 500;
    }

    public methods: string[] = [
        'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'
    ];

    public routeStates = new Map<string, RouteState>();

    public requests: Request[] = [];

    isParameter(s: string): boolean {
        return s[0] === ':';
    }

    constructor(protected client: ControllerClient) {
    }

    updateFilter() {
        this.filteredRoutes = this.routes.filter(v => {
            if (this.filterMethod && !v.httpMethods.includes(this.filterMethod)) return false;
            if (this.filterPath && !v.path.includes(this.filterPath)) return false;
            return true;
        });

        this.filteredRoutes.sort((a, b) => {
            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    }

    setRoute(route: ApiRoute) {
        let routeState: RouteState | undefined = this.routeStates.get(route.id);
        if (!routeState) {
            routeState = { url: route.path, method: 'GET' };
            if (route.httpMethods.length) routeState.method = route.httpMethods[0];
            this.routeStates.set(route.id, routeState);
        }

        // this.segments = route.path.split(/(:\w+)/g);
        // this.segmentValues = new Array(this.segments.length).fill('');
        // if (this.segments[this.segments.length - 1] === '') this.segments.pop();
    }

    async ngOnInit() {
        this.routes = await this.client.api.getRoutes();
        this.updateFilter();
        console.log('routes', this.routes);
    }

    static getUrl(): string {
        return location.protocol + '//' + (location.port === '4200' ? location.hostname + ':8080' : location.host);
    }

    async execute(routeState: RouteState) {
        // const path = this.segments.map((v, i) => {
        //     return this.isParameter(v) ? this.segmentValues[i] : v;
        // }).join('');
        const url = HttpComponent.getUrl() + routeState.url;

        const request = new Request(routeState.method, url);

        this.requests.unshift(request);

        const response = await fetch(url, { method: routeState.method });
        request.status = response.status;
        request.statusText = response.statusText;
        for (const [name, value] of (response.headers as any)) {
            request.headers.push({ name, value });
        }

        request.result = await response.text();

        const contentType = response.headers.get('content-type') || '';
        if (contentType.startsWith('application/json')) {
            request.result = JSON.stringify(JSON.parse(request.result), undefined, 4);
        }
    }
}
