import { Component, EventEmitter, Input, Output } from '@angular/core';

import { arrayRemoveItem } from '@deepkit/core';

interface Entry {
    name: string;
    value: string;
}

@Component({
    selector: 'api-console-headers',
    template: `
        <ng-container *ngIf="model">
            <dui-table noFocusOutline [items]="model" borderless [autoHeight]="true" style="min-height: 100px;">
                <dui-table-column class="input-cell" [width]="170" name="name">
                    <ng-container *duiTableCell="let item">
                        <dui-input
                            style="width: 100%"
                            lightFocus
                            [(ngModel)]="item.name"
                            (ngModelChange)="modelChange.emit(model)"
                            placeholder="Name"
                        ></dui-input>
                    </ng-container>
                </dui-table-column>
                <dui-table-column class="input-cell" [width]="170" name="value">
                    <ng-container *duiTableCell="let item">
                        <dui-input
                            style="width: 100%"
                            lightFocus
                            [(ngModel)]="item.value"
                            (ngModelChange)="modelChange.emit(model)"
                            placeholder="Value"
                        ></dui-input>
                    </ng-container>
                </dui-table-column>
                <dui-table-column name="delete" header=" " [width]="30" [sortable]="false">
                    <ng-container *duiTableCell="let item">
                        <dui-icon clickable (click)="remove(item)" name="garbage"></dui-icon>
                    </ng-container>
                </dui-table-column>
            </dui-table>
        </ng-container>

        <dui-button-group>
            <dui-button square style="margin-left: 2px;" (click)="add()" icon="add"></dui-button>
        </dui-button-group>
    `,
    styles: [
        `
            :host ::ng-deep .table-cell.input-cell {
                padding: 2px 2px !important;
            }
        `,
    ],
})
export class HeadersComponent {
    @Input() model: Entry[] | undefined;
    @Output() modelChange = new EventEmitter();

    add() {
        if (!this.model) {
            this.model = [];
        }

        this.model.push({ name: '', value: '' });
        this.model = this.model.slice();

        this.modelChange.emit(this.model);
    }

    remove(item: Entry) {
        if (!this.model) return;

        arrayRemoveItem(this.model, item);
        this.model = this.model.slice();
        this.modelChange.emit(this.model);
    }
}
