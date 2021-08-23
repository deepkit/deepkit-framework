import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ControllerClient } from '../client';
import { Subscription } from 'rxjs';
import { ApiDocument, ApiRoute } from '../../api';
import { filterAndSortRoutes } from './view-helper';
import { classSchemaToTSInterface, headerStatusCodes, propertyToTSInterface, trackByIndex } from '../utils';

@Component({
    templateUrl: './overview.component.html',
    styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnDestroy, OnInit {
    trackByIndex = trackByIndex;
    propertyToTSInterface = propertyToTSInterface;
    classSchemaToTSInterface = classSchemaToTSInterface;
    headerStatusCodes = headerStatusCodes;
    public routes: ApiRoute[] = [];
    public filteredRoutes: ApiRoute[] = [];

    groupBy: string = 'controller';
    showDescription: boolean = true;

    public categories: string[] = [];
    public groups: string[] = [];

    showDetails: {[id: string]: boolean} = {};
    protected reconnectedSub: Subscription;

    public apiDocument = new ApiDocument();

    public loading: boolean = true;
    public error: string = '';

    constructor(
        protected client: ControllerClient,
        public cd: ChangeDetectorRef,
    ) {
        this.reconnectedSub = client.client.transporter.reconnected.subscribe(async () => {
            await this.loadRoutes();
        });
    }

    ngOnDestroy(): void {
        this.reconnectedSub.unsubscribe();
    }

    async ngOnInit() {
        await this.loadRoutes();
    }

    updateFilter() {
        this.filteredRoutes = filterAndSortRoutes(this.routes, {
            filterCategory: '',
            filterMethod: '',
            filterGroup: '',
            filterPath: '',
            groupBy: this.groupBy
        });
    }

    async loadRoutes() {
        this.loading = true;
        this.error =  '';
        this.cd.detectChanges();

        try {
            this.apiDocument = await this.client.api.getDocument();
            this.routes = await this.client.api.getRoutes();

            const categories = new Set<string>();
            const groups = new Set<string>();
            for (const route of this.routes) {
                if (route.category) categories.add(route.category);
                for (const group of route.groups) if (group) groups.add(group);
            }


            this.categories = [...categories];
            this.groups = [...groups];

            this.updateFilter();
        } catch (error) {
            this.error = error.message;
        } finally {
            this.loading = false;
            this.cd.detectChanges();
        }
    }
}
