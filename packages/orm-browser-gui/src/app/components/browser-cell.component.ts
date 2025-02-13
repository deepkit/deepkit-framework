import { Component, Input } from '@angular/core';
import { Changes, isAutoIncrementType, TypeProperty, TypePropertySignature } from '@deepkit/type';
import { BrowserEntityState, BrowserState, ValidationErrors } from '../browser-state';
import { getInstanceStateFromItem } from '@deepkit/orm';
import { isRequired } from '../utils';

@Component({
    selector: 'orm-browser-cell',
    template: `
        <div class="cell-body {{cellClass(row, property.name)}}">
            <ng-container [ngSwitch]="true">
                <!-- <ng-container *ngSwitchCase="isNew(row) && property.isAutoIncrement()">
                    [auto]
                </ng-container> -->
                <ng-container
                    *ngSwitchCase="row.$__activeColumn === property.name && !isAutoIncrementType(property.type)">
                    <orm-browser-property-editing [type]="property.type" [row]="row"
                                                  [(model)]="row[property.name]"
                                                  (done)="changed(row)"></orm-browser-property-editing>
                </ng-container>
                <ng-container *ngSwitchDefault>
                    <ng-container *ngIf="row[property.name] === undefined">
                        <div class="undefined">undefined</div>
                    </ng-container>
                    <ng-container *ngIf="row[property.name] === null">
                        <div class="null">null</div>
                    </ng-container>
                    <ng-container *ngIf="isAutoIncrementType(property.type)">
                        <div
                            class="null">{{state.isNew(row) ? 'auto, #new-' + state.getNewItemId(row) : row[property.name]}}</div>
                    </ng-container>
                    <ng-container
                        *ngIf="!isAutoIncrementType(property.type) && row[property.name] !== undefined && row[property.name] !== null">
                        <orm-browser-property-view [type]="property.type"
                                                   [model]="row[property.name]"></orm-browser-property-view>
                    </ng-container>
                </ng-container>

                <div class="cell-actions"
                     *ngIf="actions && !isAutoIncrementType(property.type) && row.$__activeColumn !== property.name">
                    <dui-icon name="arrow-small-left" clickable
                              (click)="reset(row, property.name)"
                              title="Reset to original value"
                              [class.active]="true"></dui-icon>

                    <dui-icon name="clear" clickable title="Unset"
                              (click)="unset(row, property)"
                              [class.active]="!isRequired(property)"></dui-icon>
                </div>
            </ng-container>
        </div>
    `,
    styleUrls: ['./browser-cell.component.scss'],
    standalone: false
})
export class BrowserCellComponent {
    isAutoIncrementType = isAutoIncrementType;
    isRequired = isRequired;
    @Input() state!: BrowserState;
    @Input() entityState!: BrowserEntityState;
    @Input() actions: boolean = false;
    @Input() row: any;
    @Input() property!: TypeProperty | TypePropertySignature;

    @Input() changed!: (row: any) => void;
    @Input() reset!: (row: any, column: string | number | symbol) => void;
    @Input() unset!: (row: any, property: TypeProperty | TypePropertySignature) => void;

    cellClass = (item: any, column: string | number | symbol) => {
        if (!this.entityState) return '';

        let changes: Changes<any> | undefined;
        const errors: ValidationErrors | undefined = this.entityState.validationStore ? this.entityState.validationStore.get(item) : undefined;

        if (!this.state.isNew(item)) {
            const pkHash = getInstanceStateFromItem(item).getLastKnownPKHash();
            changes = this.entityState.changes && this.entityState.changes[pkHash] ? this.entityState.changes[pkHash].changes : undefined;
        }
        const property = this.entityState.schema.getProperty(column);
        if (isAutoIncrementType(property.type)) return '';

        return item.$__activeColumn === column ? 'editing' : (changes && changes.$set && column in changes.$set ? 'changed' : (errors && errors[String(column)] ? 'invalid' : ''));
    };
}
