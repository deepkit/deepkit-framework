import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { defaultValue, isAutoIncrementType, Type } from '@deepkit/type';
import { isRequired } from '../utils';

@Component({
    selector: 'orm-browser-property',
    template: `
        <div class="cell" tabindex="0" (focus)="editing=true" (click)="editing=true" [class.editing]="editing" [class.inactive]="!editing">
            <ng-container *ngIf="!editing && model === undefined">
                <div class="undefined">undefined</div>
            </ng-container>
            <ng-container *ngIf="!editing && model === null">
                <div class="null">null</div>
            </ng-container>
            <ng-container *ngIf="editing || (model !== null && model !== undefined)">
                <orm-browser-property-view *ngIf="!editing" [model]="model"
                                           [type]="type"></orm-browser-property-view>
                <orm-browser-property-editing *ngIf="editing" (modelChange)="model = $event; modelChange.emit(model)"
                                              (done)="editing=false"
                                              [type]="type" [model]="model"
                ></orm-browser-property-editing>
            </ng-container>
        </div>
        <div class="actions"
             *ngIf="!isAutoIncrementType(type) && !editing">
            <dui-icon name="clear" clickable title="Unset" (click)="unset(); $event.stopPropagation()"
                      [class.active]="!isRequired(type)"></dui-icon>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            position: relative;
            height: 100%;
        }

        .actions {
            position: absolute;
            right: 2px;
            top: 0;
            display: none;
        }

        :host:hover .actions {
            display: block;
        }

        .undefined,
        .null {
            color: var(--text-light);
        }

        .cell {
            min-height: 21px;
            padding: 0 4px;
            height: 100%;
            display: flex;
            align-items: center;
        }

        .cell ::ng-deep > ng-component {
            display: block;
            width: 100%;
        }

        .cell.editing {
            padding: 0;
        }

        .cell.inactive {
            border: 1px solid var(--line-color-light);
            border-radius: 2px;
        }
    `]
})
export class PropertyComponent {
    @Input() model!: any;
    @Output() modelChange = new EventEmitter<any>();
    @Input() type!: Type;
    editing: boolean = false;
    isRequired = isRequired;
    isAutoIncrementType = isAutoIncrementType;

    constructor(protected cd: ChangeDetectorRef) {
    }

    unset() {
        this.model = defaultValue(this.type);
        this.modelChange.emit(this.model);
        this.cd.detectChanges();
    }
}
