import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EntityPropertySeed, FakerTypes } from '@deepkit/orm-browser-api';
import { autoTypes } from './seed';
import { ReflectionClass } from '@deepkit/type';
import { showTypeString } from '../utils';

@Component({
    selector: 'orm-browser-seed-properties',
    template: `
      <dui-button-group padding="none" style="margin: 5px 0;">
        <dui-button textured (click)="resetTypes()">Reset</dui-button>
        <dui-button textured (click)="autoTypes()">Auto</dui-button>
      </dui-button-group>

      <dui-table [autoHeight]="true" [preferenceKey]="'orm-browser/seed/' + entity.getName()" [sorting]="false" no-focus-outline
                 [items]="getProperties(properties)">
        <dui-table-column name="name" [width]="200"></dui-table-column>
        <dui-table-column name="type" [width]="100">
          <ng-container *duiTableCell="let row">
            <ng-container *ngIf="entity.getProperty(row.name) as property">
              <span style="color: var(--dui-text-grey)">{{ showTypeString(property.type) }}</span>
            </ng-container>
          </ng-container>
        </dui-table-column>

        <dui-table-column name="value" [width]="320" class="cell-value">
          <ng-container *duiTableCell="let row">
            <ng-container *ngIf="entity.getProperty(row.name) as property">
              <orm-browser-seed-property [fakerTypes]="fakerTypes"
                                         [model]="row"
                                         (modelChange)="changed.emit()"
                                         [type]="property.type"></orm-browser-seed-property>
            </ng-container>
          </ng-container>
        </dui-table-column>

        <dui-table-column name="example" [width]="350">
          <ng-container *duiTableCell="let row">
            <ng-container *ngIf="entity.getProperty(row.name) as property">
              <ng-container *ngIf="row.fake && !property.isAutoIncrement() && !property.isReference()">
                {{ fakerTypes[row.faker]?.example }}
              </ng-container>
            </ng-container>
          </ng-container>
        </dui-table-column>
      </dui-table>
    `,
    standalone: false
})
export class DatabaseSeedPropertiesComponent {
    showTypeString = showTypeString;
    @Input() entity!: ReflectionClass<any>;
    @Input() fakerTypes!: FakerTypes;
    @Input() properties!: { [name: string]: EntityPropertySeed };

    @Output() changed = new EventEmitter<void>();

    getProperties(properties: { [name: string]: EntityPropertySeed }): EntityPropertySeed[] {
        return Object.values(properties);
    }

    autoTypes() {
        autoTypes(this.fakerTypes, this.entity, this.properties);
        this.changed.emit();
    }

    resetTypes() {
        for (const property of Object.values(this.properties)) {
            property.faker = '';
            property.array = undefined;
            property.map = undefined;
            property.value = undefined;
            property.fake = false;
        }
        this.changed.emit();
    }
}
