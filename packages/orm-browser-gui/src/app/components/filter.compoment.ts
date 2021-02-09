import {Component, EventEmitter, Input, OnChanges, OnInit, Output} from '@angular/core';
import {ClassSchema, PropertySchema} from '@deepkit/type';
import {trackByIndex} from '../utils';
import {arrayRemoveItem} from '@deepkit/core';
import {FilterItem} from '../browser-state';

@Component({
    selector: 'orm-browser-filter-item',
    template: `
        <dui-select textured [(ngModel)]="property" (ngModelChange)="changed()">
            <dui-option
                *ngFor="let property of properties; trackBy: trackByIndex"
                [value]="property"
            >{{property.name}}</dui-option>
        </dui-select>
        <dui-select textured [(ngModel)]="comparator" style="width: 72px;" (ngModelChange)="changed()">
            <dui-option value="$eq">=</dui-option>
            <dui-option value="$neq">!=</dui-option>
            <dui-option value="$gt">&gt;</dui-option>
            <dui-option value="$lt">&lt;</dui-option>
            <dui-option value="$gte">&gt;=</dui-option>
            <dui-option value="$lte">&lt;=</dui-option>
            <dui-option-separator></dui-option-separator>
            <dui-option value="$in">IN</dui-option>
            <dui-option value="$nin">NOT IN</dui-option>
            <dui-option-separator></dui-option-separator>
            <dui-option value="$null">IS NULL</dui-option>
            <dui-option value="$nnull">IS NOT NULL</dui-option>
            <dui-option-separator></dui-option-separator>
            <dui-option value="$in">IS UNDEFINED</dui-option>
            <dui-option value="$nin">IS NOT UNDEFINED</dui-option>
            <dui-option-separator></dui-option-separator>
            <dui-option value="$in">CONTAINS</dui-option>
            <dui-option value="$nin">NOT CONTAINS</dui-option>
        </dui-select>
        <div *ngIf="property">
            <field-editing [autoOpen]="false" (modelChange)="model.value = $event; modelChange.emit(model)" [property]="property" [model]="model.value"></field-editing>
        </div>
    `,
    styles: [`
        :host {
            display: flex;
        }

        :host > * {
            margin-right: 4px;
        }
    `]
})
export class FilterItemComponent implements OnChanges, OnInit {
    @Input() model!: FilterItem;
    @Output() modelChange = new EventEmitter<FilterItem>();

    @Input() entity!: ClassSchema;
    @Input() properties: PropertySchema[] = [];
    trackByIndex = trackByIndex;

    comparator: string = '$eq';
    property?: PropertySchema;

    changed() {
        if (this.property) {
            this.model.name = this.property.name;
        }

        this.model.comparator = this.comparator;

        this.modelChange.emit(this.model);
    }

    ngOnChanges() {
        this.load();
    }

    ngOnInit() {
        this.load();
    }

    load() {
        if (this.model.name) {
            this.property = this.properties.find(v => v.name === this.model.name);
        }
        if (!this.property) this.property = this.properties[0];

        this.comparator = this.model.comparator;
    }
}

@Component({
    selector: 'orm-browser-filter',
    template: `
        <div class="item" *ngFor="let item of items; let i = index; trackBy: trackByIndex">
            <orm-browser-filter-item [entity]="entity" [(model)]="items[i]" (modelChange)="itemsChange.emit(items)"
                                     [properties]="properties"></orm-browser-filter-item>
            <dui-button-group padding="none">
                <dui-button textured tight icon="garbage" (click)="remove(item); itemsChange.emit(items)"></dui-button>
            </dui-button-group>
        </div>
        <div *ngIf="!items.length" style="color: var(--text-light)">
            No filter added yet.
        </div>
        <div style="padding-top: 8px;">
            <dui-button textured icon="add" (click)="add()">Add filter</dui-button>
        </div>
    `,
    styleUrls: ['./filter.component.scss']
})
export class FilterComponent implements OnChanges {
    @Input() entity!: ClassSchema;

    properties: PropertySchema[] = [];
    trackByIndex = trackByIndex;

    @Input() items: FilterItem[] = [];
    @Output() itemsChange = new EventEmitter<FilterItem[]>();

    remove(item: FilterItem) {
        arrayRemoveItem(this.items, item);
    }

    add() {
        this.items.push({name: this.properties[0].name, comparator: '$eq', value: ''});
        this.itemsChange.emit(this.items);
    }

    ngOnChanges(changes: any) {
        this.properties = [];
        for (const property of this.entity.getClassProperties().values()) {
            if (property.backReference) continue;
            this.properties.push(property);
        }
    }
}
