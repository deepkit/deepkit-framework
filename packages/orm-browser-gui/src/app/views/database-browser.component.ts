import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit } from "@angular/core";
import { DuiDialog } from "@deepkit/desktop-ui";
import { Changes, ClassSchema, jsonSerializer, plainToClass, PropertySchema, validate } from "@deepkit/type";
import { Subscription } from "rxjs";
import { BrowserState, ChangesStore } from '../browser-state';
import { DatabaseInfo } from "@deepkit/orm-browser-api";
import { getInstanceState } from "@deepkit/orm";
import { ControllerClient } from "../client";

@Component({
    selector: 'orm-browser-database-browser',
    template: `
        <ng-container *ngIf="database && entity">
            <div class="actions">
                <dui-button-group>
                    <dui-button textured (click)="add()">Add</dui-button>
                    <dui-button textured (click)="save()">Save</dui-button>
                </dui-button-group>
            </div>
            <ng-container *ngIf="entity">
                <dui-table noFocusOutline [items]="items" [rowClass]="rowClass" [cellClass]="cellClass" (customSort)="onSort($event)" (cellDblClick)="cellDblClick($event)">
                    <dui-table-column *ngFor="let property of properties" [name]="property.name" [width]="150">
                        <ng-container *duiTableCell="let row">
                            <ng-container [ngSwitch]="true">
                                <!-- <ng-container *ngSwitchCase="isNew(row) && property.isAutoIncrement">
                                    [auto]
                                </ng-container> -->
                                <ng-container *ngSwitchCase="row.$__activeColumn === property.name">
                                    <field-editing [property]="property" [row]="row" (done)="changed(row)"></field-editing>
                                </ng-container>
                                <ng-container *ngSwitchDefault>
                                    <ng-container *ngIf="row[property.name] === undefined">
                                        <div class="undefined">undefined</div>
                                    </ng-container>
                                    <ng-container *ngIf="row[property.name] === null">
                                        <div class="null">null</div>
                                    </ng-container>
                                    <ng-container *ngIf="row[property.name] !== undefined && row[property.name] !== null">
                                        <cell [property]="property" [row]="row"></cell>
                                        <div class="cell-actions">
                                            <dui-icon name="arrow-small-left" clickable
                                            (click)="reset(row, property.name)" title="Reset to original value"
                                            [class.active]="true"></dui-icon>

                                            <dui-icon name="clear" clickable title="Unset"
                                            (click)="row[property.name] = property.isNullable ? null : undefined; changed(row)" 
                                            [class.active]="property.isOptional ||property.isNullable"></dui-icon>
                                        </div>
                                    </ng-container>
                                </ng-container>
                            </ng-container>
                        </ng-container>
                    </dui-table-column>
                </dui-table>
            </ng-container>
        </ng-container>
    `,
    styleUrls: ['./database-browser.component.scss']
})
export class DatabaseBrowserComponent implements OnDestroy, OnChanges {
    properties: PropertySchema[] = []

    items: any[] = [];

    changes?: ChangesStore;

    @Input() database!: DatabaseInfo;
    @Input() entity!: ClassSchema;

    protected paramsSub?: Subscription;

    rowClass = (item: any) => {
        return this.isNew(item) ? 'new' : '';
    };

    cellClass = (item: any, column: string) => {
        let changes: Changes<any> | undefined = undefined;
        if (!this.isNew(item)) {
            const pkHash = getInstanceState(item).getLastKnownPKHash();
            changes = this.changes ? this.changes[pkHash] : undefined;
        }

        return item.$__activeColumn === column ? 'editing' : (changes && changes.$set && changes.$set[column] ? 'changed' : '');
    };

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected duiDialog: DuiDialog,
        public state: BrowserState,
    ) {
    }

    ngOnDestroy(): void {
        this.paramsSub?.unsubscribe();
    }

    ngOnChanges() {
        this.changes = this.state.getChangeStore(this.database.name, this.entity.getName());
        this.loadEntity();
    }

    cellDblClick(event: { item: any, column: string }) {
        event.item.$__activeColumn = event.column;
    }

    onSort(event: { name: string, direction: 'asc' | 'desc' | '' }) {
        //load data from db
        //add not yet stored items back to the beginning
    }

    reset(item: any, column: string) {
        if (!this.entity) return;

        const snapshot = getInstanceState(item).getSnapshot();
        item[column] = jsonSerializer.deserializeProperty(this.entity.getProperty(column), snapshot[column]);

        this.changed(item);
    }

    isNew(item: any): boolean {
        return item.$__new === true;
    }

    async save() {
        if (!this.database) return;

        for (const i in this.state.addedItems) {
            for (const item of this.state.addedItems[i]) {
                const errors = validate(this.database.getEntity(i), item);
                if (errors.length) {
                    console.log('validation errors', errors);
                    return;
                }
            }
        }

        for (const i in this.state.addedItems) {

            try {
                await this.controllerClient.browser.add(this.database.name, i, this.state.addedItems[i]);
                delete this.state.addedItems[i];
            } catch (error) {
                this.duiDialog.alert('Error saving ' + i, error.message);
                break;
            }
        }

        this.cd.detectChanges();
        await this.loadEntity();
    }

    changed(row: any) {
        if (!this.entity) return;
        if (!this.database) return;

        if (this.isNew(row)) return;

        //set diff
        this.state.changed(this.database.name, this.entity.getName(), row);
    }

    async add() {
        if (!this.entity) return;
        if (!this.database) return;
        const entityName = this.entity.name!;
        if (!this.state.addedItems[entityName]) this.state.addedItems[entityName] = [];

        try {
            const jsonItem = await this.controllerClient.browser.create(this.database.name, this.entity.getName());
            const item = plainToClass(this.entity, jsonItem);
            const state = getInstanceState(item);
            state.markAsPersisted();
            state.markAsFromDatabase();
            
            item.$__new = true;
            this.state.addedItems[entityName].push(item);
            this.items.unshift(item);
            this.items = this.items.slice(0);
            this.cd.detectChanges();
        } catch (error) {
            this.duiDialog.alert('Could not create item', error.message);
        }
    }

    async loadEntity() {
        if (!this.entity) return;
        if (!this.database) return;
        this.properties = [...this.entity.getClassProperties().values()];
        this.cd.detectChanges();
        const entityName = this.entity.name!;

        try {
            const items = await this.controllerClient.browser.getItems(this.database.name, this.entity.getName());

            this.items = [];
            for (const jsonItem of items) {
                const item = plainToClass(this.entity, jsonItem);
                const state = getInstanceState(item);
                state.markAsPersisted();
                state.markAsFromDatabase();
                this.items.push(item);
            }

            if (this.state.addedItems[entityName]) {
                this.items.unshift(...this.state.addedItems[entityName]);
            }
        } catch (error) {
            this.duiDialog.alert('Error fetching data', error.message);
        }

        this.cd.detectChanges();
    }
}