import {
    AfterViewInit,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    ViewChild
} from '@angular/core';
import { getEnumKeyLabelMap } from '@deepkit/core';
import { SelectboxComponent, unsubscribe } from '@deepkit/desktop-ui';
import { PropertySchema } from '@deepkit/type';
import { Subscription } from 'rxjs';

@Component({
    template: `
        <dui-select #select [(ngModel)]="model" (ngModelChange)="modelChange.emit(this.model); done.emit()"
                    textured style="width: 100%">
            <dui-option [value]="kv.value" *ngFor="let kv of keyValues">{{kv.label}}</dui-option>
        </dui-select>
    `
})
export class EnumInputComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
    @Input() model: any;
    @Output() modelChange = new EventEmitter();

    @Input() property!: PropertySchema;

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
        const keyValueMap = getEnumKeyLabelMap(this.property.classType || {});
        for (const [value, label] of keyValueMap.entries()) {
            this.keyValues.push({ value, label });
        }
    }
}
