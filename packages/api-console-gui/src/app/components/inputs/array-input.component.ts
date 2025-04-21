import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { arrayMoveItem } from '@deepkit/core';
import { trackByIndex } from '../../utils';
import { DataStructure } from '../../store';
import { TypeArray } from '@deepkit/type';

@Component({
    template: `
        <ng-container *ngIf="model && type.type as subType">
            <div class="item" *ngFor="let item of model.children; trackBy: trackByIndex; let i = index; let last = last">
                <api-console-input [type]="subType" [model]="item.getProperty('value')"
                                   (modelChange)="emit()" (keyDown)="keyDown.emit($event)"></api-console-input>
                <dui-icon clickable name="arrow_up" [disabled]="i === 0" (click)="up(item)"></dui-icon>
                <dui-icon clickable name="arrow_down" [disabled]="last" (click)="down(item)"></dui-icon>
                <dui-icon clickable name="garbage" (click)="remove(i)"></dui-icon>
            </div>
        </ng-container>
        <div class="actions">
            <dui-button small square icon="add" (click)="add()"></dui-button>
        </div>
    `,
    styles: [`
        .actions {
            margin-top: 6px;
        }
        .item {
            padding: 2px 0;
            display: flex;
        }

        .item api-console-input {
            flex: 1;
        }

        .item dui-button {
            flex: 0;
            margin-left: 3px;
        }
    `],
    standalone: false
})
export class ArrayInputComponent implements OnInit, OnChanges {
    trackByIndex = trackByIndex;
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();
    @Input() type!: TypeArray;
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    emit() {
        this.modelChange.emit(this.model);
    }

    ngOnChanges(): void {
    }

    ngOnInit(): void {
    }

    up(i: DataStructure) {
        arrayMoveItem(this.model.children, i, -1);
        this.model.children = this.model.children.slice(0);
        this.emit();
    }

    down(i: DataStructure) {
        arrayMoveItem(this.model.children, i, +1);
        this.model.children = this.model.children.slice(0);
        this.emit();
    }

    remove(i: number) {
        this.model.children.splice(i, 1);
        this.model.children = this.model.children.slice(0);
        this.emit();
    }

    add() {
        this.model.children.push(new DataStructure(undefined));
        this.model.children = this.model.children.slice(0);
        this.emit();
    }
}
