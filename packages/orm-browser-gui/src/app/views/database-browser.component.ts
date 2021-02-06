import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output } from "@angular/core";
import { DuiDialog } from "@deepkit/desktop-ui";
import { Changes, ClassSchema, getPrimaryKeyHashGenerator, jsonSerializer, plainToClass, PropertySchema, validate } from "@deepkit/type";
import { Subscription } from "rxjs";
import { BrowserEntityState, BrowserState, ChangesStore, IdWrapper, ValidationErrors, ValidationErrorStore } from '../browser-state';
import { DatabaseInfo } from "@deepkit/orm-browser-api";
import { getInstanceState } from "@deepkit/orm";
import { ControllerClient } from "../client";
import { arrayRemoveItem } from "@deepkit/core";

@Component({
    selector: 'orm-browser-database-browser',
    template: `
        <ng-container *ngIf="database && entity && entityState">
            <dui-window-toolbar *ngIf="!dialog" for="browser">
                <dui-button-group padding="none">
                    <dui-button textured [disabled]="!state.hasChanges()" (click)="resetAll()" title="Reset all changes" icon="clear"></dui-button>
                    <dui-button textured [disabled]="!state.hasChanges()" (click)="commit()">Commit</dui-button>
                </dui-button-group>
            </dui-window-toolbar>

            <div class="actions">
                <dui-button-group padding="none" *ngIf="withBack">
                    <dui-button textured icon="arrow-small-left" (click)="back.emit()"></dui-button>
                </dui-button-group>
                <dui-button-group padding="none">
                    <dui-button textured [disabled]="!entityState.selection.length" icon="garbage" (click)="remove()"></dui-button>
                    <dui-button textured icon="add" (click)="add()"></dui-button>
                </dui-button-group>
                
                <dui-button-group padding="none">
                    <dui-button textured tight [disabled]="entityState.loading" icon="reload" (click)="loadEntity(true)"></dui-button>
                    <dui-button textured tight [disabled]="entityState.loading" (click)="goPage(entityState.page - 1)" icon="arrow_left"></dui-button>
                    <dui-input textured noControls [disabled]="entityState.loading" lightFocus type="number" (ngModelChange)="goPage($event)" [(ngModel)]="entityState.page" style="width: 50px;"></dui-input>
                    <dui-button textured tight [disabled]="entityState.loading" (click)="goPage(entityState.page + 1)" icon="arrow_right"></dui-button>
                    <dui-button textured tight [openDropdown]="paginationDropdown" [disabled]="entityState.loading" icon="arrow_down"></dui-button>
                </dui-button-group>
                
                <dui-dropdown #paginationDropdown [minWidth]="150">
                    <div style="padding: 12px;">
                        <dui-form-row label="Records per page" [labelWidth]="120">
                            <dui-input textured type="number" (ngModelChange)="loadEntity(true)" [(ngModel)]="entityState.itemsPerPage"></dui-input>
                        </dui-form-row>
                    </div>
                </dui-dropdown>
                <span style="color: var(--text-light); line-height: 19px;">
                    of {{entityState.totalPages}} page{{entityState.totalPages === 1 ? '' : 's'}} ({{entityState.count}} records)
                </span>
            </div>
            <ng-container *ngIf="entity">
                <dui-table noFocusOutline borderless [items]="entityState.items" [rowClass]="rowClass" (customSort)="onSort($event)" (cellClick)="cellClick($event)">

                    <dui-table-column name="__select" header="✓" [width]="40" [hideable]="false" [sortable]="false">
                        <ng-container *duiTableHeader>
                            <dui-checkbox [ngModel]="selectedAll" (ngModelChange)="toggleAll()"></dui-checkbox>
                        </ng-container>
                        <ng-container *duiTableCell="let row">
                            <div class="cell-body">
                                <dui-checkbox [ngModel]="entityState.selection.includes(row)" (ngModelChange)="changeSelection(row)"></dui-checkbox>
                            </div>
                        </ng-container>
                    </dui-table-column>

                    <dui-table-column *ngFor="let property of entityState.properties" [name]="property.name" [width]="150">
                        <ng-container *duiTableHeader>
                            {{property.name}} <span style="color: var(--text-light)">{{property.toString()}}</span>
                        </ng-container>

                        <ng-container *duiTableCell="let row">
                            <div class="cell-body {{cellClass(row, property.name)}}">
                            <ng-container [ngSwitch]="true">
                                <!-- <ng-container *ngSwitchCase="isNew(row) && property.isAutoIncrement">
                                    [auto]
                                </ng-container> -->
                                <ng-container *ngSwitchCase="row.$__activeColumn === property.name && !property.isAutoIncrement">
                                    <field-editing [property]="property" [row]="row" (done)="changed(row)"></field-editing>
                                </ng-container>
                                <ng-container *ngSwitchDefault>
                                    <ng-container *ngIf="row[property.name] === undefined">
                                        <div class="undefined">undefined</div>
                                    </ng-container>
                                    <ng-container *ngIf="row[property.name] === null">
                                        <div class="null">null</div>
                                    </ng-container>
                                    <ng-container *ngIf="property.isAutoIncrement">
                                        <div class="null">{{state.isNew(row) ? 'auto, #new-' + state.getNewItemId(row) : row[property.name]}}</div>
                                    </ng-container>
                                    <ng-container *ngIf="!property.isAutoIncrement && row[property.name] !== undefined && row[property.name] !== null">
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
                            </div>
                        </ng-container>
                    </dui-table-column>
                </dui-table>
            </ng-container>
        </ng-container>
    `,
    styleUrls: ['./database-browser.component.scss']
})
export class DatabaseBrowserComponent implements OnDestroy, OnChanges {
    entityState?: BrowserEntityState;

    @Input() database!: DatabaseInfo;
    @Input() entity!: ClassSchema;

    @Input() dialog: boolean = false;

    @Input() selectedPkHashes: string[] = [];

    @Input() multiSelect: boolean = true;

    @Input() withBack: boolean = false;
    @Output() back = new EventEmitter<void>();

    @Output() select = new EventEmitter<{ items: any[], pkHashes: string[] }>();

    protected paramsSub?: Subscription;

    selectedAll: boolean = false;

    protected pkHasher: (value: any) => string = () => '';

    rowClass = (item: any) => {
        return this.isNew(item) ? 'new' : '';
    };

    cellClass = (item: any, column: string) => {
        if (!this.entityState) return '';

        let changes: Changes<any> | undefined = undefined;
        let errors: ValidationErrors | undefined = this.entityState.validationStore ? this.entityState.validationStore.get(item) : undefined;

        if (!this.isNew(item)) {
            const pkHash = getInstanceState(item).getLastKnownPKHash();
            changes = this.entityState.changes && this.entityState.changes[pkHash] ? this.entityState.changes[pkHash].changes : undefined;
        }
        const property = this.entity.getProperty(column);
        if (property.isAutoIncrement) return '';

        return item.$__activeColumn === column ? 'editing' : (changes && changes.$set && changes.$set[column] ? 'changed' : (errors && errors[column] ? 'invalid' : ''));
    };

    protected ignoreNextCellClick = false;

    constructor(
        protected controllerClient: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected duiDialog: DuiDialog,
        protected host: ElementRef<HTMLElement>,
        public state: BrowserState,
    ) {
    }

    ngOnDestroy(): void {
        this.paramsSub?.unsubscribe();
    }

    ngOnChanges() {
        this.loadEntity();
    }

    toggleAll() {
        if (!this.entityState) return;

        if (this.selectedAll) {
            this.selectedAll = false;
            this.entityState.selection = [];
        } else {
            this.entityState.selection = this.entityState.items.slice();
            this.selectedAll = true;
        }
    }

    changeSelection(row: any) {
        if (!this.entityState) return;

        if (this.entityState.selection.includes(row)) {
            arrayRemoveItem(this.entityState.selection, row);
        } else {
            if (!this.multiSelect) this.entityState.selection = [];
            this.entityState.selection.push(row);
        }
        this.selectedAll = this.entityState.selection.length === this.entityState.items.length;
        this.entityState.selection = this.entityState.selection.slice();
        this.select.emit({ items: this.entityState.selection, pkHashes: this.entityState.selection.map(v => this.pkHasher(v)) });
    }

    cellClick(event: { item: any, column: string }) {
        if (this.ignoreNextCellClick) {
            this.ignoreNextCellClick = false;
            return;
        }

        event.item.$__activeColumn = event.column;
    }

    // pageKeyUp(event: KeyboardEvent) {
    //     if (!this.entityState) return;
        
    //     console.log('event.key', event.key);
    //     if (event.key.toLowerCase() === 'arrowleft') this.goPage(this.entityState.page - 1);
    //     if (event.key.toLowerCase() === 'arrowright') this.goPage(this.entityState.page + 1);
    // }

    goPage(page: number) {
        if (!this.entityState) return;

        if (page <= 0) return;

        this.entityState.page = page;
        this.loadEntity(true);
    }

    onSort(event: { name: string, direction: 'asc' | 'desc' | '' }) {
        //load data from db
        //add not yet stored items back to the beginning
    }

    reset(item: any, column: string) {
        if (!this.entity) return;

        this.ignoreNextCellClick = true;
        const snapshot = getInstanceState(item).getSnapshot();
        item[column] = jsonSerializer.deserializeProperty(this.entity.getProperty(column), snapshot[column]);

        this.changed(item);
    }

    isNew(item: any): boolean {
        return this.state.isNew(item);
    }

    async resetAll() {
        if (!this.entityState) return;

        const a = await this.duiDialog.confirm('Reset all?', 'All changes and added data will be lost. Continue?');
        if (!a) return;

        const added = this.state.getAddedItems(this.database.name, this.entity.getName());
        for (const item of added) {
            arrayRemoveItem(this.entityState.items, item);
        }
        this.entityState.selection = [];

        this.entityState.items = this.entityState.items.slice();
        this.state.resetAll();
        this.softReload();
    }

    async commit() {
        if (!this.database) return;

        try {
            await this.state.commit();
            await this.state.resetAll();
        } catch (error) {
            this.duiDialog.alert('Error saving', error);
            console.log(error);
        }

        this.cd.detectChanges();
        this.loadEntity(true);
    }

    changed(row: any) {
        if (!this.entity) return;
        if (!this.database) return;

        this.updateValidation(row);

        if (!this.isNew(row)) {
            //set diff
            this.state.changed(this.database.name, this.entity.getName(), row);
        }
    }

    protected updateValidation(row: any) {
        if (!this.entityState) return;

        if (this.entityState.validationStore) {
            //validation
            const errors = validate(this.entity, row);
            if (errors.length) {
                const validationErrors: ValidationErrors = {};
                for (const error of errors) {
                    validationErrors[error.path] = error;
                }
                this.entityState.validationStore.set(row, validationErrors);
            } else if (this.entityState.validationStore.has(row)) {
                this.entityState.validationStore.delete(row);
            }
        }
    }

    async remove() {
        if (!this.entityState) return;
        const addedItems = this.state.getAddedItems(this.database.name, this.entity.getName());

        for (const item of this.entityState.selection) {
            if (this.state.isNew(item)) {
                arrayRemoveItem(addedItems, item);
                arrayRemoveItem(this.entityState.items, item);
                this.state.disconnectForNewItem(item);
            } else {
                this.state.scheduleForDeletion(this.database.name, this.entity.getName(), item);
            }
        }
        this.entityState.selection = [];
        this.softReload();
    }

    async add() {
        if (!this.entity) return;
        if (!this.database) return;
        if (!this.entityState) return;
        const addedItems = this.state.getAddedItems(this.database.name, this.entity.getName());

        try {
            const jsonItem = await this.controllerClient.browser.create(this.database.name, this.entity.getName());
            const item = plainToClass(this.entity, jsonItem)
            const state = getInstanceState(item);
            state.markAsPersisted();
            state.markAsFromDatabase();
            this.changed(item);
            this.state.registerNewItem(item);

            this.entityState.items.splice(addedItems.length, 0, item);
            addedItems.push(item);
            this.entityState.items = this.entityState.items.slice();
            this.cd.detectChanges();
        } catch (error) {
            this.duiDialog.alert('Could not create item', error.message);
            console.log(error);
        }
    }

    softReload(withItems: boolean = true) {
        if (!this.entity) return;
        if (!this.database) return;
        if (!this.entityState) return;
        this.entityState.changes = this.state.getChangeStore(this.database.name, this.entity.getName());
        this.entityState.validationStore = this.state.getValidationStore(this.database.name, this.entity.getName());
        this.pkHasher = getPrimaryKeyHashGenerator(this.entity);

        this.entityState.properties = [...this.entity.getClassProperties().values()].filter(v => !v.backReference);
        this.cd.detectChanges();
        const entityName = this.entity.name!;
        this.entityState.deletions = this.state.getDeletions(this.database.name, entityName);

        if (withItems) {
            this.entityState.items = [];

            if (this.state.hasAddedItems(this.database.name, entityName)) {
                for (const item of this.state.getAddedItems(this.database.name, entityName)) {
                    this.entityState.items.push(item);
                    const pkHash = this.state.extractHashFromNewItem(item);
                    if (this.selectedPkHashes.includes(pkHash)) {
                        this.entityState.selection.push(item);
                    }
                }
            }

            for (const item of this.entityState.dbItems) {
                const state = getInstanceState(item);
                const pkHash = state.getLastKnownPKHash();

                if (this.selectedPkHashes.includes(pkHash)) {
                    this.entityState.selection.push(item);
                }

                if (!this.entityState.deletions[pkHash]) {
                    this.entityState.items.push(item);
                }
            }

        }
    }

    async loadCount() {
        if (!this.entity) return;
        if (!this.database) return;
        if (!this.entityState) return;

        this.entityState.count = await this.controllerClient.browser.getCount(this.database.name, this.entity.getName(), this.entityState.filter);
    }


    async loadEntity(reload: boolean = false) {
        if (!this.entity) return;
        if (!this.database) return;

        this.entityState = this.state.getBrowserEntityState(this.database.name, this.entity.getName());
        if (this.dialog) {
            //reset selection, and read from selectedPkHashes in softReload
            this.entityState.selection = [];
        }

        this.softReload(!reload);

        if (!reload && this.entityState.items.length) {
            this.cd.detectChanges();
            return;
        }

        const entityName = this.entity.name!;
        const changeStore = this.entityState.changes;
        const oldChangedPkHashes = new Set(changeStore ? Object.keys(changeStore) : []);

        try {
            this.entityState.loading = true;
            this.cd.detectChanges();

            await this.loadCount();
            const items = await this.controllerClient.browser.getItems(
                this.database.name, this.entity.getName(),
                this.entityState.filter,
                this.entityState.itemsPerPage,
                (this.entityState.page - 1) * this.entityState.itemsPerPage,
            );

            this.entityState.loading = false;

            this.entityState.dbItems = [];
            this.entityState.items = [];
            this.entityState.selection = [];

            for (const jsonItem of items) {
                const item = plainToClass(this.entity, jsonItem);
                const state = getInstanceState(item);

                state.markAsPersisted();
                state.markAsFromDatabase();
                this.updateValidation(item);
                const pkHash = state.getLastKnownPKHash();

                oldChangedPkHashes.delete(pkHash);

                if (this.selectedPkHashes.includes(pkHash)) {
                    this.entityState.selection.push(item);
                }

                if (changeStore) {
                    const changes = changeStore[pkHash];
                    if (changes && changes.changes.$set) {
                        for (const i in changes.changes.$set) {
                            item[i] = changes.changes.$set[i];
                        }
                    }
                }

                if (!this.entityState.deletions[pkHash]) {
                    this.entityState.items.push(item);
                }
                this.entityState.dbItems.push(item);
            }

            //when we have changesets from (meanwhile) deleted items, we remove them from state
            if (changeStore) {
                for (const pkHash of oldChangedPkHashes.values()) {
                    delete changeStore[pkHash];
                }
            }

            if (this.state.hasAddedItems(this.database.name, entityName)) {
                for (const item of this.state.getAddedItems(this.database.name, entityName)) {
                    this.entityState.items.push(item);
                    const pkHash = this.state.extractHashFromNewItem(item);
                    if (this.selectedPkHashes.includes(pkHash)) {
                        this.entityState.selection.push(item);
                    }
                }
            }

            this.selectedAll = this.entityState.selection.length === this.entityState.items.length;
        } catch (error) {
            this.duiDialog.alert('Error fetching data', error.message);
        }

        this.cd.detectChanges();
    }
}