import { AfterViewInit, ChangeDetectorRef, Component, ContentChildren, Directive, Input, OnChanges, QueryList } from '@angular/core';
import { DecimalPipe, NgForOf, NgIf } from "@angular/common";

@Directive({
    standalone: true,
    selector: 'performance-entry',
})
export class PerformanceEntryDirective implements OnChanges {
    @Input() title: string = '';
    @Input() value: number = 0;

    ngOnChanges(): void {

    }
}

@Component({
    standalone: true,
    selector: 'performance-chart',
    imports: [
        DecimalPipe,
        NgIf,
        NgForOf
    ],
    template: `
        <div class="boards">
            <div class="bar" [style.height.px]="item.height" *ngFor="let item of items">
                <div class="label" [style.bottom.px]="item.labelPos">{{item.title}}</div>
                <div class="value">{{item.value|number:format}}</div>
                <div class="line" *ngIf="item.labelPos > item.height"
                     [style.bottom.px]="item.height"
                     [style.height.px]="item.labelPos-item.height"
                ></div>
            </div>
        </div>
        <div class="y">
            <div>{{yAxis}}</div>
        </div>
    `,
    styles: [`
        :host {
            display: flex;
            margin: 15px 0;
        }

        .y {
            position: relative;
            flex: 0 0 30px;
        }

        .y div {
            transform: rotate(-90deg);
            position: absolute;
            left: 0;
            bottom: 0;
            width: 210px;
            text-align: left;
            transform-origin: top left;
            font-size: 12px;
        }

        .boards {
            flex: 1;
            position: relative;
            display: flex;
            align-items: flex-end;
        }

        .bar {
            width: 30px;
            margin-right: 25px;
            position: relative;
            background: #1F242A;
            border-radius: 4px;
        }

        .label {
            position: absolute;
            right: 0;
            text-align: right;
            white-space: nowrap;
            opacity: 0.8;
            padding-right: 5px;
            font-size: 14px;
            text-shadow: -1px -1px 0 rgb(0 0 0 / 60%);
        }

        .line {
            position: absolute;
            right: 14px;
            border-right: 1px solid #7777774f;
        }

        .value {
            position: absolute;
            bottom: -24px;
            right: 0;
            text-align: right;
            font-size: 12px;
        }
    `],
    host: {
        '[style.height.px]': 'height',
    }
})
export class PerformanceChartComponent implements OnChanges, AfterViewInit {
    @ContentChildren(PerformanceEntryDirective) entries?: QueryList<PerformanceEntryDirective>;
    @Input() label: string = '';
    @Input() yAxis: string = '';

    @Input() height: number = 250;
    @Input() sort: 'asc' | 'desc' = 'desc';
    @Input() format: string = '0.2-2';

    items: { title: string, value: number, height: number, labelPos: number }[] = [];

    constructor(protected cd: ChangeDetectorRef) {
    }

    ngOnChanges(): void {
        this.load();
    }

    ngAfterViewInit() {
        this.load();
    }

    load() {
        if (!this.entries) return;
        this.items = [];

        let y = 0;
        const items = this.entries.toArray();
        for (const item of items) item.ngOnChanges = () => this.load();
        let max = 0;

        if (this.sort === 'desc') {
            items.sort((a, b) => {
                if (a.value > b.value) return +1;
                if (a.value < b.value) return -1;
                return 0;
            });
        } else {
            items.sort((a, b) => {
                if (a.value > b.value) return -1;
                if (a.value < b.value) return +1;
                return 0;
            });
        }

        for (const item of items) {
            if (item.value > max) max = item.value;
        }

        const offset = (items.length + 1) * 14;

        for (const entry of items) {
            const valueRelative = entry.value / max;
            const height = (this.height - offset) * valueRelative;

            this.items.push({ height: height, value: entry.value, title: entry.title, labelPos: this.height - y });
            y += 25;
        }

        this.items.reverse();
        this.cd.detectChanges();
    }
}
