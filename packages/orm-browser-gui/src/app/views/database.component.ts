import { ChangeDetectorRef, Component, Input, OnDestroy } from "@angular/core";
import { DuiDialog } from "@deepkit/desktop-ui";
import { DatabaseInfo } from "@deepkit/orm-browser-api";
import { BrowserState } from '../browser-state';
import { ControllerClient } from "../client";

@Component({
    selector: 'orm-browser-database',
    template: `
    <div class="header">
        <dui-button-group>
            <dui-tab-button [active]="tab === 'model'" (click)="setTab('model')" textured>Model</dui-tab-button>
            <dui-tab-button [active]="tab === 'migration'" (click)="setTab('migration')" textured>Migration</dui-tab-button>
        </dui-button-group>
    </div>

    <div class="layout" [hidden]="tab !== 'model'">
        <ng-container *ngIf="database">
            <database-graph [database]=database></database-graph>
        </ng-container>
    </div>

    <div class="layout" [hidden]="tab !== 'migration'">
        <ng-container *ngIf="database">
            Load migration
            <dui-button (click)="migrate()">Migrate all</dui-button>
        </ng-container>
    </div>
    `,
    styleUrls: ['./database.component.scss']
})
export class DatabaseComponent implements OnDestroy {
    tab: string = 'model';

    @Input() database!: DatabaseInfo;

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected duiDialog: DuiDialog,
        public state: BrowserState,
    ) {
    }

    ngOnDestroy(): void {
    }

    setTab(tab: string) {
        this.tab = tab;
        if (tab === 'migration') {
            this.loadMigration();
        }
    }

    async migrate() {
        if (!this.database) return;

        try {
            await this.controllerClient.browser.migrate(this.database.name);
        } catch (error) {
            this.duiDialog.alert('Error migrating', error.message);
        }
    }

    async loadMigration() {

    }
}