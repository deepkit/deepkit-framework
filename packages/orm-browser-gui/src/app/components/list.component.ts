import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { BrowserState } from '../browser-state';
import { ControllerClient } from '../client';
import { trackByDatabase, trackBySchema } from '../utils';
import { detectChangesNextFrame } from '@deepkit/desktop-ui';

@Component({
    selector: 'orm-browser-list',
    template: `
        <ng-container *ngFor="let db of state.databases; trackBy: trackByDatabase; let i = index">
            <dui-list-item [routerLink]="['/database', encodeURIComponent(db.name)]" [routerLinkExact]="true">{{db.name}} ({{db.adapter}})</dui-list-item>
            <dui-list-item [routerLink]="['/database', encodeURIComponent(db.name), encodeURIComponent(entity.getName())]"
                           *ngFor="let entity of db.getClassSchemas(); trackBy: trackBySchema">
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
    `],
    standalone: false
})
export class DatabaseBrowserListComponent implements OnInit {
    encodeURIComponent = encodeURIComponent;
    public counts: { [storeKey: string]: number } = {};
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

        this.state.onDataChange.subscribe(this.loadCounts.bind(this));
        await this.loadCounts();
    }

    protected async loadCounts() {
        const promises: Promise<any>[] = [];
        for (const db of this.state.databases) {
            for (const entity of db.getClassSchemas()) {
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
