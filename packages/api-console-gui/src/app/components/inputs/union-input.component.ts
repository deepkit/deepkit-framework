import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { isType, ReflectionKind, stringifyType, Type, TypeUnion } from '@deepkit/type';
import { DataStructure } from '../../store';
import { trackByIndex } from '../../utils';

interface Entry {
    type?: Type;
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
                <dui-option *ngIf="!item.type" [value]="item.value">{{item.label}}</dui-option>
                <dui-option *ngIf="item.type" [value]="item.type">{{item.label}}</dui-option>
            </ng-container>
        </dui-select>
        <div class="sub" *ngIf="subProperty">
            <api-console-input [model]="model.getProperty(model.typeIndex)" [type]="subProperty"
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
    @Input() type!: TypeUnion;
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    items: Entry[] = [];

    subProperty?: Type;

    ngOnChanges(): void {
        this.init();
    }

    ngOnInit(): void {
        this.init();
    }

    set(e: Type | any) {
        if (isType(e)) {
            this.subProperty = e;
            this.model.typeIndex = this.type.types.indexOf(e);
        } else {
            this.subProperty = undefined;
            this.model.typeIndex = -1;
            this.model.value = e;
        }

        this.modelChange.emit(this.model);
    }

    protected init() {
        this.items = [];
        this.subProperty = undefined;

        if (!this.type.types.length) return;

        for (const p of this.type.types) {
            if (p.kind === ReflectionKind.literal) {
                this.items.push({ value: p.literal, label: String(p.literal) });
            } else {
                const label = stringifyType(p, { showFullDefinition: false });
                this.items.push({ type: p, label: label });
            }
        }

        if (this.model.typeIndex >= 0) {
            this.subProperty = this.type.types[this.model.typeIndex];
        } else if (this.model.value === undefined) {
            const first = this.type.types[0];
            // setTimeout(() => {
            if (first.kind === ReflectionKind.literal) {
                this.set(first.literal);
            } else {
                this.set(first);
            }
            // });
        }
    }

}
