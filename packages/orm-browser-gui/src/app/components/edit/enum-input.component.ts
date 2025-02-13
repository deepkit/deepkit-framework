import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { SelectboxComponent, unsubscribe } from '@deepkit/desktop-ui';
import { Subscription } from 'rxjs';
import { TypeEnum } from '@deepkit/type';

@Component({
    template: `
        <dui-select #select [(ngModel)]="model" (ngModelChange)="modelChange.emit(this.model); done.emit()"
                    textured style="width: 100%">
            <dui-option [value]="kv.value" *ngFor="let kv of keyValues">{{kv.label}}</dui-option>
        </dui-select>
    `,
    standalone: false
})
export class EnumInputComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() type!: TypeEnum;

    keyValues: { value: any, label: string }[] = [];

    @Output() done = new EventEmitter<void>();
    @Output() keyDown = new EventEmitter<KeyboardEvent>();

    @ViewChild('select') select?: SelectboxComponent<any>;

    @unsubscribe()
    protected dropdownSub?: Subscription;

    ngOnDestroy() {
    }

    ngOnInit() {
        this.load();
    }

    ngOnChanges() {
        this.load();
    }

    ngAfterViewInit() {
        this.select?.open();
        this.dropdownSub = this.select?.dropdown.hidden.subscribe(() => {
            this.done.emit();
        });
    }

    load() {
        for (const [label, value] of Object.entries(this.type.enum)) {
            this.keyValues.push({ value, label });
        }
    }
}
