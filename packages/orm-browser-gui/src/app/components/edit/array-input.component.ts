import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { jsonSerializer, PropertySchema } from '@deepkit/type';
import { trackByIndex } from 'src/app/utils';
import { isArray } from '@deepkit/core';

@Component({
    template: `
        <dui-dialog *ngIf="subType" [visible]="true" (closed)="done.emit()" [backDropCloses]="true">
            <ng-container *ngIf="model">
                <div class="item" *ngFor="let item of model; trackBy: trackByIndex; let i = index">
                    <field-editing [property]="subType" [(model)]="model[i]"
                                   (modelChange)="modelChange.emit(this.model)"></field-editing>
                    <dui-button icon="garbage" tight (click)="remove(i)"></dui-button>
                </div>
            </ng-container>
            <div class="actions">
                <dui-button (click)="add()">Add</dui-button>
            </div>
        </dui-dialog>
    `,
    styles: [`
        .actions {
            margin-top: 6px;
        }
        .item {
            padding: 2px 0;
            display: flex;
        }

        .item dui-button {
            flex: 0;
            margin-left: 3px;
        }
    `]
})
export class ArrayInputComponent implements OnInit, OnChanges {
    trackByIndex = trackByIndex;
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

    subType?: PropertySchema;

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    ngOnChanges(): void {
        if (!isArray(this.model)) this.model = [];
        this.subType = this.property.getSubType();
    }

    ngOnInit(): void {
        if (!isArray(this.model)) this.model = [];
        this.subType = this.property.getSubType();
    }

    remove(i: number) {
        if (isArray(this.model)) {
            this.model.splice(i, 1);
            this.modelChange.emit(this.model);
        }
    }

    add() {
        if (!this.subType) return;
        if (!isArray(this.model)) this.model = [];
        this.model.push(jsonSerializer.deserializeProperty(this.subType, undefined));
        this.modelChange.emit(this.model);
    }
}
