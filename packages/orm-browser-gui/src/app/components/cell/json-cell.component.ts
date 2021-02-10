import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { BrowserState } from 'src/app/browser-state';
import { eachPair, isArray, isObject } from '@deepkit/core';

@Component({
    selector: 'orm-browser-json-cell',
    template: `
        <ng-container [ngSwitch]="true">
            <div *ngSwitchCase="model === null" class="null">null</div>
            <div *ngSwitchCase="model === undefined" class="undefined">undefined</div>
            <ng-container *ngSwitchCase="iBinary(model)">
                <orm-browser-binary-cell [model]="model"></orm-browser-binary-cell>
            </ng-container>
            <span class="monospace" *ngSwitchCase="isDate(model)">
                {{model|date:'M/d/yy, h:mm:ss'}}<span class="date-ms">{{model|date:'.SSS'}}</span>
            </span>
            <ng-container *ngSwitchDefault>
                {{label}}
            </ng-container>
        </ng-container>
    `,
    styles: [`
        .undefined,
        .null {
            color: var(--text-light);
        }

        .date-ms {
            color: var(--text-light);
        }
    `]
})
export class JsonCellComponent implements OnChanges, OnInit {
    @Input() model: any;

    label: string = '';

    constructor(public state: BrowserState, protected cd: ChangeDetectorRef) {
    }

    iBinary(v: any): boolean {
        return v instanceof ArrayBuffer || ArrayBuffer.isView(v);
    }

    isDate(v: any): boolean {
        return v instanceof Date;
    }

    ngOnChanges() {
        this.setLabel();
    }

    ngOnInit() {
        this.setLabel();
    }

    protected toString(obj: { [s: string]: any } | ArrayLike<any>): string {
        const strings: string[] = [];
        const array = isArray(obj);

        for (let [i, v] of eachPair(obj)) {
            if (isArray(v)) {
                v = this.toString(v);
            } else if (v === null) {
                v = 'null';
            } else if (v === undefined) {
                v = 'undefined';
            } else if (v instanceof Date) {
                v = v.toString();
            } else if (isObject(v)) {
                v = this.toString(v);
            }
            if (array) {
                strings.push(v);
            } else {
                strings.push(i + ': ' + v);
            }
        }

        if (array) {
            return '[' + strings.join(', ') + ']';
        }
        return '{' + strings.join(', ') + '}';
    }

    setLabel(): void {
        if (isObject(this.model) || isArray(this.model)) {
            this.label = this.toString(this.model);
        } else {
            this.label = this.model;
        }
    }
}
