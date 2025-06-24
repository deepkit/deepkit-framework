import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { defaultValue, Type, TypeArray } from '@deepkit/type';
import { isArray } from '@deepkit/core';
import { ButtonComponent, DialogComponent } from '@deepkit/desktop-ui';
import { InputEditingComponent } from './input.component';

@Component({
    template: `
      @if (subType) {
        <dui-dialog [visible]="true" (closed)="done.emit()" [backDropCloses]="true">
          @if (model) {
            @for (item of model; track $index; let i = $index) {
              <div class="item">
                <orm-browser-property-editing [type]="subType" [(model)]="model[i]"
                                              (modelChange)="modelChange.emit(this.model)"></orm-browser-property-editing>
                <dui-button icon="garbage" tight (click)="remove(i)"></dui-button>
              </div>
            }
          }
          <div class="actions">
            <dui-button (click)="add()">Add</dui-button>
          </div>
        </dui-dialog>
      }
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
    `],
    imports: [DialogComponent, InputEditingComponent, ButtonComponent],
})
export class ArrayInputComponent implements OnInit, OnChanges {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() type!: TypeArray;

    subType?: Type;

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    ngOnChanges(): void {
        if (!isArray(this.model)) this.model = [];
        this.subType = this.type.type;
    }

    ngOnInit(): void {
        if (!isArray(this.model)) this.model = [];
        this.subType = this.type.type;
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
        this.model.push(defaultValue(this.subType));
        this.modelChange.emit(this.model);
    }
}
