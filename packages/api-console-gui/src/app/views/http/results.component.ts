import { ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { ControllerClient } from '../../client.js';
import { Request, Store } from '../../store.js';
import { DuiDialog } from '@deepkit/desktop-ui';
import { Router } from '@angular/router';
import { trackByIndex } from '../../utils.js';
import { ApiRoute } from '@deepkit/api-console-api';

@Component({
    selector: 'api-console-http-routes',
    template: `
        <dui-button-group style="margin: 6px 10px; margin-top: 12px;">
            <dui-tab-button (click)="switchViewRequest('selected')" [active]="store.state.viewHttp.viewRequests === 'selected'">Selected</dui-tab-button>
            <dui-tab-button (click)="switchViewRequest('all')" [active]="store.state.viewHttp.viewRequests === 'all'">All</dui-tab-button>
        </dui-button-group>

        <div class="requests overlay-scrollbar-small">
            <div class="no-requests" *ngIf="!requests.length">
                <div *ngIf="store.state.viewHttp.viewRequests === 'all'">
                    No requests executed yet.
                </div>
                <div *ngIf="store.state.viewHttp.viewRequests === 'selected'">
                    <div *ngIf="store.state.route">
                        No requests for this route executed yet.
                    </div>
                </div>

                <div *ngIf="!store.state.route">Select a route in the left sidebar first.</div>

                <div *ngIf="store.state.route && store.state.routeStates[store.state.route.id]">
                    Press
                    <dui-button icon="play" (click)="executeSelectedRoute.emit()"></dui-button>
                    to execute a new http request.
                </div>
            </div>

            <div class="request" *ngFor="let r of requests; let i = index; trackBy: trackByIndex">
                <div class="line">
                    <dui-icon clickable (click)="r.open = !isOpen(r, i)" [name]="isOpen(r, i) ? 'arrow_down' : 'arrow_right'"></dui-icon>
                    <div class="method">{{r.method}}</div>
                    <div class="url text-selection">
                        {{r.url}}
                    </div>
                    <dui-icon clickable name="share" [disabled]="r.method !== 'GET'" (click)="openRequest(r)"></dui-icon>
                    <div class="status">
                        <div class="status-box" [class.orange]="isOrange(r.status)" [class.red]="r.error || isRed(r.status)">
                            {{r.status === 0 ? r.error ? 'ERROR' : 'pending' : r.status}} {{r.statusText}}
                        </div>
                    </div>
                    <dui-icon clickable (click)="remove(i)" name="garbage"></dui-icon>
                </div>
                <div class="results" *ngIf="isOpen(r, i)">
                    <div class="request-info">
                        Executed at {{r.created|date:'short'}} in {{r.took|number:'0.0-3'}} ms. <code>{{r.getHeader('content-type')}}</code>
                    </div>

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
                        <div *ngIf="r.error">{{r.error}}</div>
                        <ng-container *ngIf="r.json !== undefined">
                            <div class="ts text-selection">
                                <div codeHighlight="json" [code]="r.json"></div>
                            </div>
                        </ng-container>
                        <ng-container *ngIf="r.json === undefined">
                            <pre class="text-selection overlay-scrollbar-small" style="padding-bottom: 8px;">{{r.result}}</pre>
                        </ng-container>
                    </ng-container>
                </div>
            </div>
        </div>

        <deepkit-toggle-box title="Stats" [(visible)]="store.state.viewHttp.serverStatsVisible" (visibleChange)="store.store()">
            <ng-container header>
                {{requests.length}}/{{store.state.requests.length}} requests
            </ng-container>
            TODO
        </deepkit-toggle-box>
    `,
    styleUrls: ['./results.component.scss']
})
export class HttpRequestsComponent {
    trackByIndex = trackByIndex;
    public requests: Request[] = [];

    @Output() executeSelectedRoute = new EventEmitter();
    @Output() selectRoute = new EventEmitter<ApiRoute>();

    constructor(
        protected client: ControllerClient,
        public store: Store,
        public cd: ChangeDetectorRef,
        protected dialog: DuiDialog,
        protected router: Router,
    ) {

    }

    openRequest(r: Request) {
        window.open(r.url, '_blank');
    }

    isOrange(status: number): boolean {
        return status >= 400 && status < 500;
    }

    isRed(status: number): boolean {
        return status >= 500;
    }

    isOpen(r: Request, i: number): boolean {
        return r.open === undefined ? i === 0 : r.open;
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
        this.cd.detectChanges();
    }

    remove(index: number): void {
        this.store.set(state => {
            const removed = state.requests.splice(index, 1);
            for (const r of removed) {
                localStorage.removeItem('@deepkit/api-console/request/result/' + r.bodyStoreId);
                localStorage.removeItem('@deepkit/api-console/request/json/' + r.bodyStoreId);
            }
        });

        this.updateRequests();
    }

    switchViewRequest(view: 'all' | 'selected'): void {
        this.store.set(state => {
            state.viewHttp.viewRequests = view;
        });

        this.updateRequests();
    }

    toggleServerStatsVisibility() {
        this.store.set(state => {
            state.viewHttp.serverStatsVisible = !state.viewHttp.serverStatsVisible;
        });
    }
}
