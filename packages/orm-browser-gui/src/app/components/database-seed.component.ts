import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { DatabaseInfo, EntityPropertySeed, FakerTypes, SeedDatabase } from '@deepkit/orm-browser-api';
import { filterEntitiesToList, trackByIndex, trackBySchema } from '../utils';
import { ControllerClient } from '../client';
import { ClassSchema } from '@deepkit/type';
import { BrowserState } from '../browser-state';
import { DuiDialog } from '@deepkit/desktop-ui';
import { FakerTypeDialogComponent } from './dialog/faker-type-dialog.component';

@Component({
    selector: 'orm-browser-seed',
    template: `
        <div class="actions">
            <dui-button [disabled]="seeding" (click)="seed()">Seed</dui-button>
        </div>
        <div class="entities" *ngIf="database && fakerTypes">
            <div class="entity" *ngFor="let entity of filterEntitiesToList(database.getClassSchemas()); trackBy: trackBySchema">
                <ng-container
                    *ngIf="state.getSeedSettings(fakerTypes, database.name, entity.getName()) as settings">
                    <h3>
                        <dui-checkbox [(ngModel)]="settings.active">{{entity.getClassName()}}</dui-checkbox>
                    </h3>

                    <ng-container *ngIf="settings.active">
                        <div class="settings">
                            <dui-input lightFocus round type="number" [(ngModel)]="settings.amount" placeholder="amount"></dui-input>
                            <dui-checkbox style="margin-left: 5px;" [(ngModel)]="settings.truncate">Delete all before seeding</dui-checkbox>
                        </div>

                        <orm-browser-seed-properties [fakerTypes]="fakerTypes" [entity]="entity" [properties]="settings.properties" (changed)="typeChanged(entity)"></orm-browser-seed-properties>
                    </ng-container>
                </ng-container>
            </div>
        </div>
    `,
    styleUrls: ['./database-seed.component.scss']
})
export class DatabaseSeedComponent implements OnChanges {
    @Input() database!: DatabaseInfo;
    fakerTypes?: FakerTypes;
    fakerTypesArray?: ({ name: string, type: string })[];
    trackBySchema = trackBySchema;
    trackByIndex = trackByIndex;
    filterEntitiesToList = filterEntitiesToList;

    seeding: boolean = false;

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected duiDialog: DuiDialog,
        public state: BrowserState,
    ) {
    }

    async ngOnChanges() {
        await this.load();
    }

    protected async load() {
        try {
            this.fakerTypes = await this.controllerClient.browser.getFakerTypes();
            this.fakerTypesArray = [];
            for (const [name, info] of Object.entries(this.fakerTypes)) {
                this.fakerTypesArray.push({ name, type: info.type });
            }
        } finally {
        }
        this.cd.detectChanges();
    }

    chooseType(entity: ClassSchema, propertyName: string) {
        if (!this.fakerTypes) return;
        const settings = this.state.getSeedSettings(this.fakerTypes, this.database.name, entity.getName());
        const property = settings.properties[propertyName] ||= new EntityPropertySeed(propertyName);

        const { component } = this.duiDialog.open(FakerTypeDialogComponent, {
            fakerTypes: this.fakerTypes,
            selected: property.faker
        });

        component.chosen.subscribe((value: string) => {
            property.faker = value;
            this.cd.detectChanges();
        });
    }

    typeChanged(entity: ClassSchema) {
        this.state.storeSeedSettings(this.database.name, entity.getName());
    }

    async seed() {
        if (!await this.duiDialog.confirm('Seed now?', 'You are about to seed your database. All content may be lost.')) return;

        this.seeding = true;
        this.cd.detectChanges();

        try {
            const dbSeeding: SeedDatabase = { entities: {} };
            for (const entity of filterEntitiesToList(this.database.getClassSchemas())) {
                const key = this.state.getStoreKey(this.database.name, entity.getName());
                const settings = this.state.seedSettings[key];
                if (!settings || !settings.active) continue;

                dbSeeding.entities[entity.getName()] = settings;
            }
            await this.controllerClient.browser.seed(this.database.name, dbSeeding);
        } catch (error) {
            await this.duiDialog.alert('Error seeding', error);
        }

        this.state.onDataChange.emit();
        this.seeding = false;
        this.cd.detectChanges();
    }

}
