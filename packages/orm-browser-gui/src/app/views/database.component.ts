import { ChangeDetectorRef, Component, Input, OnDestroy, Optional } from '@angular/core';
import { DuiDialog, unsubscribe } from '@deepkit/desktop-ui';
import { DatabaseInfo } from '@deepkit/orm-browser-api';
import { empty } from '@deepkit/core';
import { BrowserState } from '../browser-state';
import { ControllerClient } from '../client';
import { trackByIndex, trackByProperty } from '../utils';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
    selector: 'orm-browser-database',
    template: `
        <div class="header">
            <dui-button-group>
                <dui-tab-button [active]="tab === 'model'" (click)="setTab('model')">Model</dui-tab-button>
                <dui-tab-button [active]="tab === 'migration'" (click)="setTab('migration')">Migration
                </dui-tab-button>
                <dui-tab-button [active]="tab === 'seed'" (click)="setTab('seed')">Seed</dui-tab-button>
            </dui-button-group>
        </div>

        <div class="layout" [hidden]="tab !== 'seed'">
            <orm-browser-seed [database]="database"></orm-browser-seed>
        </div>

        <div class="layout" [hidden]="tab !== 'model'">
            <ng-container *ngIf="database">
                <database-graph [database]=database></database-graph>
            </ng-container>
        </div>

        <div class="layout migration-container" [hidden]="tab !== 'migration'">
            <ng-container *ngIf="database">
                <div *ngIf="loadingMigrations">
                    Load migration
                </div>
                <div *ngIf="!loadingMigrations">
                    <dui-button (click)="resetAll()">Reset all</dui-button>
                    <dui-button (click)="migrate()">Migrate all</dui-button>

                    <div class="migrations" *ngIf="empty(migrations)">
                        No migrations available. Your models are in sync with the database schema.
                    </div>
                    <div class="migrations" *ngIf="!empty(migrations)">
                        <div *ngFor="let kv of migrations|keyvalue">
                            <h3>{{kv.key}}</h3>
                            <div class="diff text-selection">{{kv.value.diff}}</div>
                            <div class="sql text-selection" *ngFor="let sql of kv.value.sql">
                                {{sql}}
                            </div>
                        </div>
                    </div>
                </div>
            </ng-container>
        </div>
    `,
    styleUrls: ['./database.component.scss']
})
export class DatabaseComponent implements OnDestroy {
    trackByIndex = trackByIndex;
    trackByProperty = trackByProperty;

    tab: string = 'model';
    empty = empty;

    migrations: { [name: string]: { sql: string[], diff: string } } = {};

    loadingMigrations: boolean = false;

    @Input() database!: DatabaseInfo;

    @unsubscribe()
    routeSub?: Subscription;

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected duiDialog: DuiDialog,
        public state: BrowserState,
        @Optional() protected activatedRoute?: ActivatedRoute,
    ) {
        if (activatedRoute) {
            this.routeSub = activatedRoute.params.subscribe(async (params) => {
                this.state.databases = await this.controllerClient.getDatabases();
                this.database = this.state.getDatabase(params.database);
                this.cd.detectChanges();
            });
        }
    }

    ngOnDestroy(): void {
    }

    async setTab(tab: string) {
        this.tab = tab;
        if (tab === 'migration') {
            await this.loadMigration();
        }
    }

    async resetAll() {
        if (!this.database) return;
        if (!await this.duiDialog.confirm('Reset all?', 'All database tables will be reset. All content deleted.')) return;

        try {
            await this.controllerClient.browser.resetAllTables(this.database.name);
        } catch (error) {
            await this.duiDialog.alert('Error resetting all', error.message);
        }
        await this.loadMigration();
        this.state.onDataChange.emit();
    }

    async migrate() {
        if (!this.database) return;

        try {
            await this.controllerClient.browser.migrate(this.database.name);
        } catch (error) {
            await this.duiDialog.alert('Error migrating', error.message);
        }
        await this.loadMigration();
        this.state.onDataChange.emit();
    }

    async loadSeed() {
    }

    async loadMigration() {
        this.loadingMigrations = true;
        this.cd.detectChanges();
        try {
            this.migrations = await this.controllerClient.browser.getMigrations(this.database.name);
        } finally {
            this.loadingMigrations = false;
            this.cd.detectChanges();
        }
    }
}
