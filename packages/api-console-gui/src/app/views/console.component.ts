import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ControllerClient } from '../client';
import { ApiAction, ApiEntryPoints, ApiRoute } from '../../api';
import { methods, propertyToTSJSONInterface, trackByIndex } from '../utils';
import { Environment, RouteState, Store } from '../store';
import { copy } from '@deepkit/core';
import { Subscription } from 'rxjs';
import { DuiDialog } from '@deepkit/desktop-ui';
import { EnvironmentDialogComponent } from '../components/environment-dialog.component';
import { filterAndSortActions, filterAndSortRoutes } from './view-helper';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpRouteDetailComponent } from './http/route-detail.component';
import { HttpRequestsComponent } from './http/results.component';

@Component({
    templateUrl: './console.component.html',
    styleUrls: ['./console.component.scss']
})
export class ConsoleComponent implements OnInit, OnDestroy {
    propertyToTSInterface = propertyToTSJSONInterface;
    trackByIndex = trackByIndex;
    methods = methods;

    public entryPoints = new ApiEntryPoints;

    public filteredActions: ApiAction[] = [];
    public filteredRoutes: ApiRoute[] = [];

    routesWidth: number = 320;

    public view: 'rpc' | 'http' = 'http';

    public httpCategories: string[] = [];
    public httpGroups: string[] = [];

    public rpcCategories: string[] = [];
    public rpcGroups: string[] = [];

    protected reconnectedSub: Subscription;
    protected routeParamsSub: Subscription;

    @ViewChild('httpRouteDetail') routeDetail?: HttpRouteDetailComponent;
    @ViewChild('httpRequests') httpRequests?: HttpRequestsComponent;

    constructor(
        protected client: ControllerClient,
        public store: Store,
        public cd: ChangeDetectorRef,
        public activatedRoute: ActivatedRoute,
        protected dialog: DuiDialog,
        protected router: Router,
    ) {
        this.reconnectedSub = client.client.transporter.reconnected.subscribe(async () => {
            await this.loadEntryPoints();
        });

        this.routeParamsSub = this.activatedRoute.queryParams.subscribe(params => {
            this.view = params.view || 'http';
            if (this.view === 'rpc') {
                this.selectActionFromRoute();
            } else {
                this.selectRouteFromRoute();
            }
        });
    }

    executeSelectedRoute() {
        if (!this.routeDetail) return;
        this.routeDetail.execute();
    }

    updateRequests() {
        if (!this.httpRequests) return;
        this.httpRequests.updateRequests();
    }

    updateRouteState() {
        if (!this.routeDetail) return;
        this.routeDetail.updateRouteState();
    }

    ngOnDestroy(): void {
        this.reconnectedSub.unsubscribe();
        this.routeParamsSub.unsubscribe();
    }

    async ngOnInit() {
        await this.loadEntryPoints();
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
        if (this.store.state.route) this.updateRouteState();
    }

    isParameter(s: string): boolean {
        return s[0] === ':';
    }

    updateFilter() {
        this.filteredRoutes = filterAndSortRoutes(this.entryPoints.httpRoutes, this.store.state.viewHttp);
        this.filteredActions = filterAndSortActions(this.entryPoints.rpcActions, this.store.state.viewRpc);
        this.store.store();
        this.cd.detectChanges();
    }

    navigateToAction(action?: ApiAction) {
        this.router.navigate(['api/console'], { queryParams: { view: 'rpc', action: action?.id } });
    }

    navigateToRoute(route?: ApiRoute) {
        this.router.navigate(['api/console'], { queryParams: { view: 'http', route: route?.id } });
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

            this.updateRouteState();
        }

        this.store.set(state => {
            state.route = route;
        });

        this.updateRequests();
        this.cd.detectChanges();
    }

    setAction(action?: ApiAction) {
        if (action) {
        }

        this.store.set(state => {
            state.action = action;
        });

        this.updateRequests();
        this.cd.detectChanges();
    }

    toggleRpcSection(controllerPath: string) {
        this.store.set(state => {
            state.viewRpc.closed[controllerPath] = !state.viewRpc.closed[controllerPath];
        });
    }

    toggleHttpSection(controller: string) {
        this.store.set(state => {
            state.viewHttp.closed[controller] = !state.viewHttp.closed[controller];
        });
    }

    async loadEntryPoints() {
        this.entryPoints = await this.client.api.getEntryPoints();

        for (const action of this.entryPoints.rpcActions) {
            const schema = action.getParametersType();
            if (schema) {
                const args: string[] = [];
                for (const property of schema.getProperties()) {
                    args.push(property.name + (property.isOptional ? '?' : '') + ': ' + property.toString(false));
                }

                action.parameterSignature = args.join(', ');
            }

            const resultSchema = action.getResultsType();
            if (resultSchema) {
                let type = resultSchema.getProperty('v');
                if (type.type === 'promise') type = type.templateArgs[0];
                if (type) {
                    action.returnSignature = type.toString(false) + (type.isOptional ? '|undefined' : '');
                } else {
                    action.returnSignature = 'any';
                }
            }
        }

        {
            const categories = new Set<string>();
            const groups = new Set<string>();
            for (const route of this.entryPoints.httpRoutes) {
                if (route.category) categories.add(route.category);
                for (const group of route.groups) if (group) groups.add(group);
            }

            this.selectRouteFromRoute(true);

            this.httpCategories = [...categories];
            this.httpGroups = [...groups];
        }

        {
            const categories = new Set<string>();
            const groups = new Set<string>();
            for (const action of this.entryPoints.rpcActions) {
                if (action.category) categories.add(action.category);
                for (const group of action.groups) if (group) groups.add(group);
            }

            this.selectActionFromRoute(true);

            this.rpcCategories = [...categories];
            this.rpcGroups = [...groups];
        }

        this.updateFilter();
    }

    protected selectRouteFromRoute(force: boolean = false) {
        const selectedRoute = this.activatedRoute.snapshot.queryParams.route;
        if (force || selectedRoute && (!this.store.state.route || this.store.state.route.id !== selectedRoute)) {
            const route = this.entryPoints.httpRoutes.find(v => v.id === selectedRoute);
            if (!route) return;
            this.setRoute(route);
        }
    }

    protected selectActionFromRoute(force: boolean = false) {
        const selectedAction = this.activatedRoute.snapshot.queryParams.action;
        if (force || selectedAction && (!this.store.state.action || this.store.state.action.id !== selectedAction)) {
            const action = this.entryPoints.rpcActions.find(v => v.id === selectedAction);
            if (!action) return;
            this.setAction(action);
        }
    }

}
