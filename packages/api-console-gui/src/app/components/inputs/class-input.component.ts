import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { isBackReferenceType, isReferenceType, ReflectionClass, TypeClass, TypeObjectLiteral } from '@deepkit/type';
import { isReferenceLike, trackByIndex } from '../../utils';
import { DataStructure } from '../../store';

@Component({
    template: `
        <ng-container *ngIf="!schema">
            No schema
        </ng-container>

        <div class="box children" *ngIf="schema">
            <dui-select textured style="width: 100%; margin-bottom: 5px;"
                        [(ngModel)]="model.asReference" *ngIf="isReferenceLike(type)"
                        (ngModelChange)="modelChange.emit(model)"
            >
                <dui-option [value]="false">{{schema.getClassName()}}</dui-option>
                <dui-option [value]="true">Reference</dui-option>
            </dui-select>

            <div style="padding: 4px;" *ngIf="showOnlyPrimaryKey && schema.getPrimary() as p">
                <api-console-input
                    [optional]="false"
                    [model]="model.getProperty(p.name)" [type]="p.property"
                    (modelChange)="modelChange.emit(model)"></api-console-input>
            </div>
            <ng-container *ngIf="!showOnlyPrimaryKey">
                <ng-container *ngFor="let p of schema.getProperties(); let last = last; trackBy: trackByIndex">
                    <api-console-input
                                       [class.last]="last"
                                       [decoration]="p.property"
                                       [model]="model.getProperty(p.name)" [type]="p.property"
                                       (modelChange)="modelChange.emit(model)"></api-console-input>
                </ng-container>
            </ng-container>
        </div>
    `,
    styles: [`
        .children {
            position: relative;
            border: 1px solid var(--dui-line-color-light);
            border-radius: 3px;
            background-color: var(--dui-window-header-bg);
            margin-left: 20px;
        }
    `],
    standalone: false
})
export class ClassInputComponent implements OnChanges, OnInit {
    trackByIndex = trackByIndex;
    isReferenceLike = isReferenceLike;

    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    schema?: ReflectionClass<any>;

    @Input() type!: TypeClass | TypeObjectLiteral;

    ngOnInit(): void {
        this.init();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.init();
    }

    get showOnlyPrimaryKey(): boolean {
        return (isReferenceType(this.type) || isBackReferenceType(this.type)) && this.model.asReference;
    }

    init() {
        this.schema = ReflectionClass.from(this.type);
    }
}
