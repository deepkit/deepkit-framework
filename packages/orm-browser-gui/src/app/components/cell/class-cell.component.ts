import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { isReferenceType, ReflectionClass, TypeClass, TypeObjectLiteral } from '@deepkit/type';
import { objToString } from './utils';
import { BrowserState } from '../../browser-state';

@Component({
    template: `{{label}}`,
    standalone: false
})
export class ClassCellComponent implements OnChanges, OnInit {
    @Input() model: any;
    @Input() type!: TypeClass | TypeObjectLiteral;

    schema?: ReflectionClass<any>;

    label: string = '';

    constructor(public state: BrowserState, protected cd: ChangeDetectorRef) {
    }

    ngOnChanges() {
        this.schema = ReflectionClass.from(this.type);
        this.setLabel();
    }

    ngOnInit() {
        this.setLabel();
    }

    setLabel(): void {
        this.schema = ReflectionClass.from(this.type);

        this.label = '';
        if (this.model === undefined || this.model === null) return;

        const value = this.model;

        if (isReferenceType(this.type)) {
            if (value === undefined) return;
            if (this.state.isIdWrapper(value)) {
                this.label = '#new-' + this.state.extractIdWrapper(value);
            } else {
                this.label = this.schema.getClassName() + '#' + value[this.schema.getPrimary().name];
            }
        } else {
            this.label = objToString(value);
        }
    }
}
