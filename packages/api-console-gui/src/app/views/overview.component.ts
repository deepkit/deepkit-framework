import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ControllerClient } from '../client';
import { ApiDocument, ApiRoute } from '@deepkit/api-console-api';
import { filterAndSortRoutes } from './view-helper';
import { headerStatusCodes, trackByIndex, typeToTSJSONInterface } from '../utils';
import { Subscriptions } from '@deepkit/core-rxjs';
import { typeSettings } from '@deepkit/type';

@Component({
    templateUrl: './overview.component.html',
    styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnDestroy, OnInit {
    trackByIndex = trackByIndex;
    typeToTSJSONInterface = typeToTSJSONInterface;
    headerStatusCodes = headerStatusCodes;
    public filteredRoutes: ApiRoute[] = [];

    groupBy: string = 'controller';
    showDescription: boolean = true;

    public categories: string[] = [];
    public groups: string[] = [];

    showDetails: {[id: string]: boolean} = {};

    public initiallyLoaded: boolean = false;
    public loading: boolean = true;
    public error: string = '';

    protected subscriptions = new Subscriptions

    constructor(
        public client: ControllerClient,
        public cd: ChangeDetectorRef,
    ) {
        this.subscriptions.add = this.client.entryPoints.subscribe(v => this.parseRouteInfo(v.httpRoutes));
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    async ngOnInit() {
        await this.loadRoutes();
    }

    updateFilter(routes: ApiRoute[]) {
        this.filteredRoutes = filterAndSortRoutes(routes, {
            filterCategory: '',
            filterMethod: '',
            filterGroup: '',
            filterPath: '',
            groupBy: this.groupBy
        });
    }

    parseRouteInfo(routes: ApiRoute[]) {
        const categories = new Set<string>();
        const groups = new Set<string>();
        for (const route of routes) {
            if (route.category) categories.add(route.category);
            for (const group of route.groups) if (group) groups.add(group);
        }

        this.categories = [...categories];
        this.groups = [...groups];

        this.updateFilter(routes);
    }

    async loadRoutes() {
        //only display loading bar when not already initially loaded
        if (!this.initiallyLoaded) this.loading = true;
        this.error =  '';
        this.cd.detectChanges();

        console.log('ApiDocument type', ApiDocument, typeSettings);

        try {
            //wait for the first initial load
            await Promise.all([this.client.document.valueArrival, this.client.entryPoints.valueArrival]);
            console.log('this.client.entryPoints', this.client.entryPoints.value);
            this.initiallyLoaded = true;
        } catch (error: any) {
            this.error = error.message;
        } finally {
            this.loading = false;
            this.cd.detectChanges();
        }
    }
}
