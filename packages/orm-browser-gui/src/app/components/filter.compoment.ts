import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ClassSchema, PropertySchema } from '@deepkit/type';
import { trackByIndex } from '../utils';
import { arrayRemoveItem } from '@deepkit/core';
import { FilterItem } from '../browser-state';

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
            <dui-option value="$regex">REGEX</dui-option>
            <dui-option-separator></dui-option-separator>
            <dui-option value="$in">IN</dui-option>
            <dui-option value="$nin">NOT IN</dui-option>
        </dui-select>
        <div *ngIf="property && propertyToShow" class="editing">
            <div class="cell" (click)="editing=true" [class.inactive]="!editing" >
                <cell *ngIf="!editing" [model]="value" [property]="propertyToShow"></cell>
                <field-editing *ngIf="editing" (modelChange)="value = $event; changed()"
                               (done)="editing=false"
                               [property]="propertyToShow" [model]="value"
                ></field-editing>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: flex;
        }

        :host > * {
            margin-right: 4px;
        }

        .editing {
            width: 200px;
        }

        .cell {
            min-height: 21px;
        }
        .cell.inactive {
            border: 1px solid var(--line-color-light);
            border-radius: 2px;
        }
    `]
})
export class FilterItemComponent implements OnChanges, OnInit {
    @Input() model!: FilterItem;
    @Output() modelChange = new EventEmitter<FilterItem>();

    @Input() entity!: ClassSchema;
    @Input() properties: PropertySchema[] = [];
    trackByIndex = trackByIndex;

    editing: boolean = false;

    value: string = '';
    comparator: string = '$eq';
    propertyToShow?: PropertySchema;
    property?: PropertySchema;

    changed() {
        if (this.comparator !== this.model.comparator || (this.property && this.property.name !== this.model.name)) {
            this.propertyToShow = undefined;
        }

        if (this.property) {
            this.model.name = this.property.name;
        }

        this.model.comparator = this.comparator;
        this.model.value = this.value;

        if (this.model.comparator === '$regex') {
            this.model.value = new RegExp(this.model.value);
        }

        this.modelChange.emit(this.model);

        this.loadProperty();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.model) {
            this.propertyToShow = undefined;
            this.load();
        }
    }

    ngOnInit() {
        this.load();
    }

    protected loadProperty() {
        if (!this.property) this.property = this.properties[0];

        if (this.propertyToShow) return;
        this.propertyToShow = this.property;

        if (this.model.comparator === '$regex') {
            this.model.value = new RegExp(this.model.value);
            this.propertyToShow = new PropertySchema(this.property.name);
            this.propertyToShow.type = 'string';
        } else if (this.model.comparator === '$in' || this.model.comparator === '$nin') {
            this.propertyToShow = new PropertySchema(this.property.name);
            this.propertyToShow.type = 'array';
            this.propertyToShow.templateArgs.push(this.property);
        }
    }

    load() {
        if (this.model.name) {
            this.property = this.properties.find(v => v.name === this.model.name);
        }

        if (!this.property) this.property = this.properties[0];

        this.comparator = this.model.comparator;
        this.value = this.model.value;

        if (this.model.comparator === '$regex') {
            if (this.model.value instanceof RegExp) {
                this.value = this.model.value.source;
            }
        }
        this.loadProperty();
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
        this.items.push({ name: this.properties[0].name, comparator: '$eq', value: '' });
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
