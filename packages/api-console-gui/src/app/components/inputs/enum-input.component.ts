import {
    AfterViewInit,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { SelectboxComponent, unsubscribe } from '@deepkit/desktop-ui';
import * as bla from '@deepkit/desktop-ui';
import { TypeEnum } from '@deepkit/type';

import { DataStructure } from '../../store';

@Component({
    template: `
        <dui-select
            #select
            [(ngModel)]="model.value"
            (ngModelChange)="modelChange.emit(this.model)"
            textured
            style="width: 100%"
        >
            <dui-option [value]="kv.value" *ngFor="let kv of keyValues">{{ kv.label }}</dui-option>
        </dui-select>
    `,
})
export class EnumInputComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
    @Input() model!: DataStructure;
    @Output() modelChange = new EventEmitter();

    @Input() type!: TypeEnum;

    keyValues: { value: any; label: string | number | undefined | null }[] = [];

    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    @ViewChild('select') select?: SelectboxComponent<any>;

    @unsubscribe()
    protected dropdownSub?: Subscription;

    ngOnDestroy() {}

    ngOnInit() {
        this.load();
    }

    ngOnChanges() {
        this.load();
    }

    ngAfterViewInit() {
        this.select?.open();
        this.dropdownSub = this.select?.dropdown.hidden.subscribe(() => {
            this.modelChange.emit(this.model);
        });
    }

    load() {
        this.type.enum;
        for (const [label, value] of Object.entries(this.type.enum)) {
            this.keyValues.push({ value, label });
        }
    }
}
