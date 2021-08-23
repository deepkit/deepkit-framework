import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { PropertySchema } from '@deepkit/type';
import { DataStructure } from '../../store';
import { trackByIndex } from '../../utils';

interface Entry {
    property?: PropertySchema;
    value?: any;
    label: string;
}

@Component({
    template: `
        <dui-select style="width: 100%" textured
                    [ngModel]="subProperty || model.value"
                    (ngModelChange)="set($event)"
        >
            <ng-container *ngFor="let item of items; trackBy: trackByIndex">
                <dui-option *ngIf="!item.property" [value]="item.value">{{item.label}}</dui-option>
                <dui-option *ngIf="item.property" [value]="item.property">{{item.label}}</dui-option>
            </ng-container>
        </dui-select>
        <div class="sub" *ngIf="subProperty">
            <api-console-input [model]="model.getProperty(model.templateIndex)" [property]="subProperty"
                               (modelChange)="modelChange.emit(model)" (keyDown)="keyDown.emit($event)"></api-console-input>
        </div>
    `,
    styles: [`
        .sub {
            margin-top: 3px;
            margin-left: 1px;
        }
    `]
})
export class UnionInputComponent implements OnInit, OnChanges {
    trackByIndex = trackByIndex;
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();
    @Input() property!: PropertySchema;
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    items: Entry[] = [];

    subProperty?: PropertySchema;

    ngOnChanges(): void {
        this.init();
    }

    ngOnInit(): void {
        this.init();
    }

    set(e: PropertySchema | any) {
        if (e instanceof PropertySchema) {
            this.subProperty = e;
            this.model.templateIndex = this.property.templateArgs.indexOf(e);
        } else {
            this.subProperty = undefined;
            this.model.templateIndex = -1;
            this.model.value = e;
        }

        this.modelChange.emit(this.model);
    }

    protected init() {
        this.items = [];
        this.subProperty = undefined;

        if (!this.property.templateArgs.length) return;

        for (const p of this.property.templateArgs) {
            if (p.type === 'literal') {
                this.items.push({ value: p.literalValue, label: String(p.literalValue) });
            } else {
                const label = p.type === 'class' ? p.getResolvedClassSchema().getClassName() : p.type;
                this.items.push({ property: p, label: label });
            }
        }

        if (this.model.templateIndex >= 0) {
            this.subProperty = this.property.templateArgs[this.model.templateIndex];
        } else if (this.model.value === undefined) {
            const first = this.property.templateArgs[0];
            setTimeout(() => {
                if (first.type === 'literal') {
                    this.set(first.literalValue);
                } else {
                    this.set(first);
                }
            });
        }
    }

}
