import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { FakerTypeDialogComponent } from './dialog/faker-type-dialog.component';
import { FakerTypes } from '@deepkit/orm-browser-api';
import { DuiDialog } from '@deepkit/desktop-ui';
import { EntityPropertySeed } from '@deepkit/orm-browser-api';

@Component({
    selector: 'orm-browser-seed-property',
    template: `
        <ng-container *ngIf="property.isAutoIncrement" style="color: var(--text-grey)">
            Auto-Increment
        </ng-container>

        <ng-container *ngIf="!property.isAutoIncrement">
            <dui-checkbox [(ngModel)]="model.fake" (ngModelChange)="changed()">Fake</dui-checkbox>

            <div class="property-seed-value select" *ngIf="model.fake && property.isReference">
                <dui-select textured small [(ngModel)]="model.reference">
                    <dui-option value="random">Random from database</dui-option>
                    <dui-option value="random-seed">Random from seed</dui-option>
                    <dui-option value="create">Create new</dui-option>
                </dui-select>
            </div>

            <div class="property-seed-value" *ngIf="model.fake && !property.isReference">
                <div class="choose-type" *ngIf="property.isArray">
                    <dui-dialog #arrayConfig [backDropCloses]="true">
                        <h3>Array configuration</h3>

                        <ng-container *ngIf="model.getArray() as array">
                            <div class="array-config">
                                <div>Min</div>
                                <dui-input type="number" [(ngModel)]="array.min"></dui-input>
                                <div>Max</div>
                                <dui-input type="number" [(ngModel)]="array.max"></dui-input>
                            </div>

                            <div>
                                <orm-browser-seed-property
                                    [model]="array.seed" [property]="property.getSubType()"
                                    [fakerTypes]="fakerTypes" (modelChange)="changed()"></orm-browser-seed-property>
                            </div>
                        </ng-container>

                        <dui-dialog-actions>
                            <dui-button closeDialog>OK</dui-button>
                        </dui-dialog-actions>
                    </dui-dialog>
                    <div>
                        Array config
                    </div>
                    <dui-button small [openDialog]="arrayConfig">Configure</dui-button>
                </div>
                <ng-container *ngIf="!model.faker">
                    <dui-button small (click)="chooseType()">Choose</dui-button>
                </ng-container>

                <div class="choose-type" *ngIf="model.faker">
                    <div>
                        {{model.faker}}
                        <span style="color: var(--text-grey)">
                        {{fakerTypes[model.faker]?.type}}
                    </span>
                    </div>
                    <dui-button (click)="chooseType()" small>Change</dui-button>
                </div>
            </div>

            <div class="property-seed-value" *ngIf="!model.fake">
                <orm-browser-property [(model)]="model.value" [property]="property"></orm-browser-property>
            </div>
        </ng-container>
    `,
    styleUrls: ['./database-seed-property.component.scss']
})
export class DatabaseSeedPropertyComponent implements OnInit {
    @Input() model!: EntityPropertySeed;
    @Output() modelChange = new EventEmitter<EntityPropertySeed>();
    @Input() property!: PropertySchema;
    @Input() fakerTypes!: FakerTypes;

    constructor(protected duiDialog: DuiDialog, protected cd: ChangeDetectorRef) {
    }

    changed() {
        this.modelChange.emit(this.model);
    }

    ngOnInit(): void {
    }

    chooseType() {
        const { component } = this.duiDialog.open(FakerTypeDialogComponent, {
            fakerTypes: this.fakerTypes,
            selected: this.model.faker
        });

        component.chosen.subscribe((value) => {
            this.model.faker = value;
            this.cd.detectChanges();
        });
    }
}
