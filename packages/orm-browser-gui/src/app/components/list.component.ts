import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { BrowserState } from '../browser-state';
import { ControllerClient } from '../client';
import { filterEntitiesToList, trackByDatabase, trackBySchema } from '../utils';
import { detectChangesNextFrame } from '@deepkit/desktop-ui';

@Component({
    selector: 'orm-browser-list',
    template: `
        <ng-container *ngFor="let db of state.databases; trackBy: trackByDatabase; let i = index">
            <dui-list-item routerLink="/database/{{db.name}}" [routerLinkExact]="true">{{db.name}} ({{db.adapter}})</dui-list-item>

            <dui-list-item routerLink="/database/{{db.name}}/{{entity.name}}" [routerLinkExact]="true"
                           *ngFor="let entity of filterEntitiesToList(db.getClassSchemas()); trackBy: trackBySchema">
                <div class="item">
                    <div>{{entity.getClassName()}}</div>
                    <div class="add" *ngIf="state.hasAddedItems(db.name, entity.getName()) as items">
                        ({{state.getAddedItems(db.name, entity.getName()).length}})
                    </div>
                    <div class="count">{{counts[state.getStoreKey(db.name, entity.getName())] || 0}}</div>
                </div>
            </dui-list-item>
        </ng-container>
    `,
    styles: [`
        .item {
            margin-left: 15px;
            display: flex;
        }

        .item .add {
            margin-left: 5px;
            color: var(--color-orange);
        }

        .item .count {
            margin-left: auto;
            color: var(--text-light);
        }
    `]
})
export class DatabaseBrowserListComponent implements OnInit {
    public counts: { [storeKey: string]: number } = {};
    filterEntitiesToList = filterEntitiesToList;
    trackBySchema = trackBySchema;
    trackByDatabase = trackByDatabase;

    constructor(
        public state: BrowserState,
        protected cd: ChangeDetectorRef,
        protected controllerClient: ControllerClient,
    ) {
    }

    async ngOnInit() {
        this.state.databases = await this.controllerClient.getDatabases();
        detectChangesNextFrame(this.cd);

        console.log('databases', this.state.databases);
        this.state.onDataChange.subscribe(this.loadCounts.bind(this));
        await this.loadCounts();
    }

    protected async loadCounts() {
        const promises: Promise<any>[] = [];
        for (const db of this.state.databases) {
            for (const entity of filterEntitiesToList(db.getClassSchemas())) {
                const key = this.state.getStoreKey(db.name, entity.getName());
                promises.push(this.controllerClient.browser.getCount(db.name, entity.getName(), {}).then((count) => {
                    this.counts[key] = count;
                }, (err) => console.log('loading count error', entity.getName(), err)));
            }
        }

        await Promise.all(promises);
        this.cd.detectChanges();
    }
}
