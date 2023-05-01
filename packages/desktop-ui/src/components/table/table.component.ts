/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ContentChild,
    ContentChildren,
    Directive,
    ElementRef,
    EventEmitter,
    HostBinding,
    HostListener,
    Input,
    NgZone,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    SimpleChanges,
    SkipSelf,
    TemplateRef,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { arrayClear, arrayHasItem, arrayRemoveItem, eachPair, empty, first, indexOf, isArray, isNumber } from '@deepkit/core';
import Hammer from 'hammerjs';
import { isObservable, Observable } from 'rxjs';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { DropdownComponent } from '../button';
import { detectChangesNextFrame } from '../app/utils';
import { findParentWithClass } from '../../core/utils';

/**
 * Directive to allow dynamic content in a cell.
 *
 * ```html
 * <dui-table-column>
 *     <ng-container *duiTableCell="let item">
 *          {{item.fieldName | date}}
 *     </ng-container>
 * </dui-table-column>
 * ```
 */
@Directive({
    selector: '[duiTableCell]',
})
export class TableCellDirective {
    constructor(public template: TemplateRef<any>) {
    }
}

/**
 * Can be used to define own dropdown items once the user opens the header context menu.
 */
@Directive({
    selector: 'dui-dropdown[duiTableCustomHeaderContextMenu]',
})
export class TableCustomHeaderContextMenuDirective {
    constructor(public readonly dropdown: DropdownComponent) {
    }
}


/**
 * Can be used to define own dropdown items once the user opens the row context menu.
 */
@Directive({
    selector: 'dui-dropdown[duiTableCustomRowContextMenu]',
})
export class TableCustomRowContextMenuDirective {
    constructor(public readonly dropdown: DropdownComponent) {
    }
}

/**
 * Directive to allow dynamic content in a column header.
 *
 * ```html
 * <dui-table-column name="fieldName">
 *     <ng-container *duiTableHead>
 *          <strong>Header</strong>
 *     </ng-container>
 * </dui-table-column>
 * ```
 */
@Directive({
    selector: '[duiTableHeader]',
})
export class TableHeaderDirective {
    constructor(public template: TemplateRef<any>) {
    }
}

/**
 * Defines a new column.
 */
@Directive({
    selector: 'dui-table-column'
})
export class TableColumnDirective {
    /**
     * The name of the column. Needs to be unique. If no renderer (*duiTableCell) is specified, this
     * name is used to render the content T[name].
     */
    @Input('name') name: string = '';

    /**
     * A different header name. Use dui-table-header to render HTML there.
     */
    @Input('header') header?: string;

    /**
     * Default width.
     */
    @Input('width') width?: number | string = 100;

    /**
     * Adds additional class to the columns cells.
     */
    @Input('class') class: string = '';

    /**
     * Whether this column is start hidden. User can unhide it using the context menu on the header.
     */
    @Input('hidden') hidden: boolean | '' = false;

    @Input('sortable') sortable: boolean = true;

    @Input('hideable') hideable: boolean = true;

    /**
     * At which position this column will be placed.
     */
    @Input('position') position?: number;

    /**
     * This is the new position when the user moved it manually.
     * @hidden
     */
    overwrittenPosition?: number;

    @ContentChild(TableCellDirective, { static: false }) cell?: TableCellDirective;
    @ContentChild(TableHeaderDirective, { static: false }) headerDirective?: TableHeaderDirective;

    isHidden() {
        return this.hidden !== false;
    }

    toggleHidden() {
        this.hidden = !this.isHidden();
    }

    /**
     * @hidden
     */
    getWidth(): string | undefined {
        if (!this.width) return undefined;

        if (isNumber(this.width)) {
            return this.width + 'px';
        }

        return this.width;
    }

    /**
     * @hidden
     */
    public getPosition() {
        if (this.overwrittenPosition !== undefined) {
            return this.overwrittenPosition;
        }

        return this.position;
    }
}

@Component({
    selector: 'dui-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <dui-dropdown #headerDropdown>
            <dui-dropdown-item
                *ngFor="let column of sortedColumnDefs; trackBy: trackByColumn"
                [selected]="!column.isHidden()"
                (mousedown)="column.toggleHidden(); storePreference(); sortColumnDefs(); headerDropdown.close()"
            >
                <div *ngIf="column.hideable">
                    <ng-container *ngIf="column.name !== undefined && !column.headerDirective">
                        {{column.header || column.name}}
                    </ng-container>
                    <ng-container
                        *ngIf="column.name !== undefined && column.headerDirective"
                        [ngTemplateOutlet]="column.headerDirective.template"
                        [ngTemplateOutletContext]="{$implicit: column}"></ng-container>
                </div>
            </dui-dropdown-item>
            <dui-dropdown-separator></dui-dropdown-separator>
            <dui-dropdown-item (click)="resetAll()">Reset all</dui-dropdown-item>
        </dui-dropdown>

        <div [style.height]="autoHeight !== false ? height + 'px' : '100%'" [style.minHeight.px]="itemHeight">
            <div class="header" *ngIf="showHeader" #header
                 [contextDropdown]="customHeaderDropdown ? customHeaderDropdown.dropdown : headerDropdown">
                <div class="th"
                     *ngFor="let column of visibleColumns(sortedColumnDefs); trackBy: trackByColumn; let columnIndex = index;"
                     [style.width]="column.getWidth()"
                     (mousedown)="sortBy(column.name || '', $event)"
                     [class.freeze]="columnIndex < freezeColumns"
                     [attr.name]="column.name"
                     [style.top]="scrollTop + 'px'"
                     #th>
                    <ng-container
                        *ngIf="column.headerDirective"
                        [ngTemplateOutlet]="column.headerDirective.template"
                        [ngTemplateOutletContext]="{$implicit: column}"></ng-container>

                    <ng-container *ngIf="column.name !== undefined && !column.headerDirective">
                        {{column.header || column.name}}
                    </ng-container>

                    <ng-container *ngIf="sort[column.name]">
                        <dui-icon *ngIf="sort[column.name] === 'desc'" [size]="12" name="arrow_down"></dui-icon>
                        <dui-icon *ngIf="sort[column.name] === 'asc'" [size]="12" name="arrow_up"></dui-icon>
                    </ng-container>

                    <dui-splitter (modelChange)="setColumnWidth(column, $event)"
                                  indicator position="right"></dui-splitter>
                </div>
            </div>

            <div class="body" [class.with-header]="showHeader" (click)="clickCell($event)"
                 (dblclick)="dblClickCell($event)">
                <cdk-virtual-scroll-viewport #viewportElement
                                             class="overlay-scrollbar-small"
                                             [itemSize]="itemHeight"
                >
                    <ng-container
                        *cdkVirtualFor="let row of filterSorted(sorted); trackBy: trackByFn; let i = index; odd as isOdd">
                        <div class="table-row {{rowClass ? rowClass(row) : ''}}"
                             [contextDropdown]="customRowDropdown ? customRowDropdown.dropdown : undefined"
                             [class.selected]="selectedMap.has(row)"
                             [class.odd]="isOdd"
                             [style.height.px]="itemHeight"
                             (mousedown)="select(row, $event)"
                             (contextmenu)="select(row, $event)"
                             (dblclick)="dbclick.emit(row)"
                        >
                            <div class="table-cell"
                                 *ngFor="let column of visibleColumns(sortedColumnDefs); trackBy: trackByColumn; let columnIndex = index"
                                 [class]="column.class + (cellClass ?  ' ' + cellClass(row, column.name) : '')"
                                 [attr.row-column]="column.name"
                                 [class.freeze]="columnIndex < freezeColumns"
                                 [attr.row-i]="i"
                                 [style.width]="column.getWidth()"
                            >
                                <ng-container *ngIf="column.cell">
                                    <ng-container [ngTemplateOutlet]="column.cell!.template"
                                                  [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
                                </ng-container>
                                <ng-container *ngIf="!column.cell">
                                    {{ column.name ? valueFetcher(row, column.name) : '' }}
                                </ng-container>
                            </div>
                        </div>
                    </ng-container>
                </cdk-virtual-scroll-viewport>
            </div>
        </div>
    `,
    styleUrls: ['./table.component.scss'],
    host: {
        '[class.no-focus-outline]': 'noFocusOutline !== false',
        '[class.borderless]': 'borderless !== false',
        '[class.overlay-scrollbar]': 'true',
        '[class.with-hover]': 'hover !== false',
        '[class.auto-height]': 'autoHeight !== false',
    },
})
export class TableComponent<T> implements AfterViewInit, OnInit, OnChanges, OnDestroy {
    /**
     * @hidden
     */
    @HostBinding() tabindex = 0;

    @Input() borderless: boolean | '' = false;

    /**
     * Array of items that should be used for each row.
     */
    @Input() public items!: T[] | Observable<T[]>;

    /**
     * Since dui-table has virtual-scroll active per default, it's required to define the itemHeight to
     * make scrolling actually workable correctly.
     */
    @Input() public itemHeight: number = 25;

    /**
     * Whether the table height is calculated based on current item count and [itemHeight].
     */
    @Input() public autoHeight: boolean = false;

    /**
     * Whether the table row should have a hover effect.
     */
    @Input() public hover: boolean | '' = false;

    /**
     * Current calculated height, used only when autoHeight is given.
     */
    public height: number = 23;

    /**
     * Whether the header should be shown.
     */
    @Input() public showHeader: boolean = true;

    /**
     * How many columns (from the left) are frozen (stay visible even if user scrolls horizontally).
     */
    @Input() public freezeColumns: number = 0;

    /**
     * Default field of T for sorting.
     */
    @Input() public defaultSort: string = '';

    /**
     * Default sorting order.
     */
    @Input() public defaultSortDirection: 'asc' | 'desc' = 'asc';

    /**
     * Whether rows are selectable.
     */
    @Input() public selectable: boolean | '' = false;

    /**
     * Whether multiple rows are selectable at the same time.
     */
    @Input() public multiSelect: boolean | '' = false;

    /**
     * TrackFn for ngFor to improve performance. Default is order by index.
     */
    @Input() public trackFn?: (index: number, item: T) => any;

    /**
     * Not used yet.
     */
    @Input() public displayInitial: number = 20;

    /**
     * Not used yet.
     */
    @Input() public increaseBy: number = 10;

    /**
     * Filter function.
     */
    @Input() public filter?: (item: T) => boolean;

    @Input() public rowClass?: (item: T) => string | undefined;

    @Input() public cellClass?: (item: T, column: string) => string | undefined;

    /**
     * When the user changes the order or width of the columns, the information is stored
     * in localStorage using this key, prefixed with `@dui/table/`.
     */
    @Input() public preferenceKey: string = 'root';

    /**
     * Filter query.
     */
    @Input() public filterQuery?: string;

    @Input() public columnState: { name: string, position: number, visible: boolean }[] = [];

    /**
     * Against which fields filterQuery should run.
     */
    @Input() public filterFields?: string[];

    /**
     * Alternate object value fetcher, important for sorting and filtering.
     */
    @Input() public valueFetcher = (object: any, path: string): any => {
        const dot = path.indexOf('.');
        if (dot === -1) return object[path];
        return object[path.substr(0, dot)][path.substr(dot + 1)];
    };

    /**
     * A hook to provide custom sorting behavior for certain columns.
     */
    @Input() public sortFunction?: (sort: { [name: string]: 'asc' | 'desc' }) => (((a: T, b: T) => number) | undefined);

    /**
     * Whether sorting is enabled (clicking headers trigger sort).
     */
    @Input() public sorting: boolean = true;

    @Input() noFocusOutline: boolean | '' = false;

    @Input() public sort: { [column: string]: 'asc' | 'desc' } = {};

    public rawItems: T[] = [];
    public sorted: T[] = [];

    public selectedMap = new Map<T, boolean>();

    /**
     * Elements that are selected, by reference.
     */
    @Input() public selected: T[] = [];

    protected selectedHistory: T[] = [];

    /**
     * Elements that are selected, by reference.
     */
    @Output() public selectedChange: EventEmitter<T[]> = new EventEmitter();

    @Output() public sortedChange: EventEmitter<T[]> = new EventEmitter();

    @Output() public cellSelect: EventEmitter<{ item: T, cell: string } | undefined> = new EventEmitter();

    /**
     * When a row gets double clicked.
     */
    @Output() public dbclick: EventEmitter<T> = new EventEmitter();

    @Output() public customSort: EventEmitter<{ [column: string]: 'asc' | 'desc' }> = new EventEmitter();

    @Output() public cellDblClick: EventEmitter<{ item: T, column: string }> = new EventEmitter();
    @Output() public cellClick: EventEmitter<{ item: T, column: string }> = new EventEmitter();

    @ViewChild('header', { static: false }) header?: ElementRef;
    @ViewChildren('th') ths?: QueryList<ElementRef<HTMLElement>>;

    @ContentChildren(TableColumnDirective, { descendants: true }) columnDefs?: QueryList<TableColumnDirective>;

    @ContentChild(TableCustomHeaderContextMenuDirective, { static: false }) customHeaderDropdown?: TableCustomHeaderContextMenuDirective;
    @ContentChild(TableCustomRowContextMenuDirective, { static: false }) customRowDropdown?: TableCustomRowContextMenuDirective;

    @ViewChild(CdkVirtualScrollViewport, { static: true }) viewport!: CdkVirtualScrollViewport;
    @ViewChild('viewportElement', { static: true, read: ElementRef }) viewportElement!: ElementRef;

    public sortedColumnDefs: TableColumnDirective[] = [];

    columnMap: { [name: string]: TableColumnDirective } = {};

    public displayedColumns?: string[] = [];

    protected ignoreThisSort = false;
    public scrollTop = 0;

    constructor(
        protected element: ElementRef,
        protected cd: ChangeDetectorRef,
        @SkipSelf() protected parentCd: ChangeDetectorRef,
        protected zone: NgZone,
    ) {
    }

    public setColumnWidth(column: TableColumnDirective, width: number) {
        column.width = width;
        detectChangesNextFrame(this.cd, () => {
            this.storePreference();
        });
    }

    ngOnInit() {
        if (this.defaultSort) {
            this.sort[this.defaultSort] = this.defaultSortDirection;
        }
    }

    ngOnDestroy(): void {

    }

    @HostListener('window:resize')
    onResize() {
        requestAnimationFrame(() => {
            this.viewport.checkViewportSize();
        });
    }

    resetAll() {
        localStorage.removeItem('@dui/table/preferences-' + this.preferenceKey);
        if (!this.columnDefs) return;
        for (const column of this.columnDefs.toArray()) {
            column.width = 100;
            column.hidden = false;
            column.overwrittenPosition = undefined;
        }
    }

    storePreference() {
        const preferences: { [name: string]: { hidden: boolean | '', width?: number | string, order?: number } } = {};
        if (!this.columnDefs) return;

        for (const column of this.columnDefs.toArray()) {
            preferences[column.name] = {
                width: column.width,
                order: column.overwrittenPosition,
                hidden: column.hidden
            };
        }
        localStorage.setItem('@dui/table/preferences-' + this.preferenceKey, JSON.stringify(preferences));
    }

    loadPreference() {
        const preferencesJSON = localStorage.getItem('@dui/table/preferences-' + this.preferenceKey);
        if (!preferencesJSON) return;
        const preferences = JSON.parse(preferencesJSON);
        for (const i in preferences) {
            if (!preferences.hasOwnProperty(i)) continue;
            if (!this.columnMap[i]) continue;
            if (preferences[i].width !== undefined) this.columnMap[i].width = preferences[i].width;
            if (preferences[i].order !== undefined) this.columnMap[i].overwrittenPosition = preferences[i].order;
            if (preferences[i].hidden !== undefined) this.columnMap[i].hidden = preferences[i].hidden;
        }
    }

    dblClickCell(event: MouseEvent) {
        if (!this.cellDblClick.observers.length) return;

        if (!event.target) return;
        const cell = findParentWithClass(event.target as HTMLElement, 'table-cell');
        if (!cell) return;
        const i = parseInt(cell.getAttribute('row-i') || '', 10);
        const column = cell.getAttribute('row-column') || '';

        this.cellDblClick.emit({ item: this.sorted[i], column });
    }

    clickCell(event: MouseEvent) {
        if (!this.cellClick.observers.length) return;
        if (!event.target) return;
        const cell = findParentWithClass(event.target as HTMLElement, 'table-cell');
        if (!cell) return;
        const i = parseInt(cell.getAttribute('row-i') || '', 10);
        const column = cell.getAttribute('row-column') || '';

        this.cellClick.emit({ item: this.sorted[i], column });
    }

    /**
     * Toggles the sort by the given column name.
     */
    public sortBy(name: string, $event?: MouseEvent) {
        if (!this.sorting) return;

        if (this.ignoreThisSort) {
            this.ignoreThisSort = false;
            return;
        }

        if ($event && $event.button === 2) return;

        //only when shift is pressed do we activate multi-column sort
        if (!$event || !$event.shiftKey) {
            for (const member in this.sort) if (member !== name) delete this.sort[member];
        }

        if (this.columnMap[name]) {
            const headerDef = this.columnMap[name];
            if (!headerDef.sortable) {
                return;
            }
        }

        if (!this.sort[name]) {
            this.sort[name] = 'asc';
        } else {
            if (this.sort[name] === 'asc') this.sort[name] = 'desc';
            else if (this.sort[name] === 'desc') delete this.sort[name];
        }

        if (this.customSort.observers.length) {
            this.customSort.emit(this.sort);
        } else {
            this.doSort();
        }
    }

    /**
     * @hidden
     */
    trackByFn = (index: number, item: any) => {
        return this.trackFn ? this.trackFn(index, item) : index;
    };

    /**
     * @hidden
     */
    trackByColumn(index: number, column: TableColumnDirective) {
        return column.name;
    }

    /**
     * @hidden
     */
    filterSorted(items: T[]): T[] {
        //apply filter
        if (this.filter || (this.filterQuery && this.filterFields)) {
            return items.filter((v) => this.filterFn(v));
        }

        return items;
    }

    protected initHeaderMovement() {
        if (this.header && this.ths) {
            const mc = new Hammer(this.header!.nativeElement);
            mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 1 }));

            interface Box {
                left: number;
                width: number;
                element: HTMLElement;
                directive: TableColumnDirective;
            }

            const THsBoxes: Box[] = [];

            let element: HTMLElement | undefined;
            let elementCells: HTMLElement[] = [];
            let originalPosition = -1;
            let foundBox: Box | undefined;
            let rowCells: { cells: HTMLElement[] }[] = [];

            let startOffsetLeft = 0;
            let offsetLeft = 0;
            let startOffsetWidth = 0;

            let animationFrame: any;
            mc.on('panstart', (event: HammerInput) => {
                foundBox = undefined;

                if (this.ths && event.target.classList.contains('th')) {
                    element = event.target as HTMLElement;
                    element.style.zIndex = '1000000';
                    element.style.opacity = '0.8';

                    startOffsetLeft = element.offsetLeft;
                    offsetLeft = element.offsetLeft;
                    startOffsetWidth = element.offsetWidth;

                    arrayClear(THsBoxes);
                    rowCells = [];

                    for (const th of this.ths.toArray()) {
                        const directive: TableColumnDirective = this.sortedColumnDefs.find((v) => v.name === th.nativeElement.getAttribute('name')!)!;
                        const cells = [...this.element.nativeElement.querySelectorAll('div[row-column="' + directive.name + '"]')] as any as HTMLElement[];

                        if (th.nativeElement === element) {
                            originalPosition = this.sortedColumnDefs.indexOf(directive);
                            elementCells = cells;
                            for (const cell of elementCells) {
                                cell.classList.add('active-drop');
                            }
                        } else {
                            for (const cell of cells) {
                                cell.classList.add('other-cell');
                            }
                            th.nativeElement.classList.add('other-cell');
                        }

                        THsBoxes.push({
                            left: th.nativeElement.offsetLeft,
                            width: th.nativeElement.offsetWidth,
                            element: th.nativeElement,
                            directive: directive,
                        });

                        rowCells.push({ cells: cells });
                    }
                }
            });

            mc.on('panend', (event: HammerInput) => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                if (element) {
                    element.style.left = '';
                    element.style.zIndex = '';
                    element.style.opacity = '';

                    for (const t of rowCells) {
                        for (const cell of t.cells) {
                            cell.classList.remove('active-drop');
                            cell.classList.remove('other-cell');
                            cell.style.left = '0px';
                        }
                    }

                    this.ignoreThisSort = true;

                    for (const box of THsBoxes) {
                        box.element.style.left = '0px';
                        box.element.classList.remove('other-cell');
                    }

                    if (foundBox) {
                        const newPosition = this.sortedColumnDefs.indexOf(foundBox.directive);

                        if (originalPosition !== newPosition) {
                            const directive = this.sortedColumnDefs[originalPosition];
                            this.sortedColumnDefs.splice(originalPosition, 1);
                            this.sortedColumnDefs.splice(newPosition, 0, directive);

                            for (let [i, v] of eachPair(this.sortedColumnDefs)) {
                                v.overwrittenPosition = i;
                            }

                            this.sortColumnDefs();
                        }
                    }

                    this.storePreference();
                    element = undefined;
                }
            });

            mc.on('pan', (event: HammerInput) => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }

                animationFrame = requestAnimationFrame(() => {
                    if (element) {
                        element!.style.left = (event.deltaX) + 'px';
                        const offsetLeft = startOffsetLeft + event.deltaX;

                        for (const cell of elementCells) {
                            cell.style.left = (event.deltaX) + 'px';
                        }
                        let afterElement = false;

                        foundBox = undefined;
                        for (const [i, box] of eachPair(THsBoxes)) {
                            if (box.element === element) {
                                afterElement = true;
                                continue;
                            }

                            box.element.style.left = '0px';
                            for (const cell of rowCells[i].cells) {
                                cell.style.left = '0px';
                            }

                            if (!afterElement && box.left + (box.width / 2) > offsetLeft) {
                                //the dragged element is before the current
                                box.element.style.left = startOffsetWidth + 'px';

                                for (const cell of rowCells[i].cells) {
                                    cell.style.left = startOffsetWidth + 'px';
                                }

                                if (foundBox && box.left > foundBox.left) {
                                    //we found already a box that fits and that is more left
                                    continue;
                                }

                                foundBox = box;
                            } else if (afterElement && box.left + (box.width / 2) < offsetLeft + startOffsetWidth) {
                                //the dragged element is after the current
                                box.element.style.left = -startOffsetWidth + 'px';
                                for (const cell of rowCells[i].cells) {
                                    cell.style.left = -startOffsetWidth + 'px';
                                }
                                foundBox = box;
                            }
                        }
                    }
                });
            });
        }
    }

    ngAfterViewInit(): void {
        this.viewport.renderedRangeStream.subscribe(() => {
            this.cd.detectChanges();
        });

        this.zone.runOutsideAngular(() => {
            this.viewportElement.nativeElement.addEventListener('scroll', () => {
                const scrollLeft = this.viewportElement.nativeElement.scrollLeft;
                this.header!.nativeElement.scrollLeft = scrollLeft;
            });
        });

        this.initHeaderMovement();

        if (this.columnDefs) {
            setTimeout(() => {
                this.columnDefs!.changes.subscribe(() => {
                    this.updateDisplayColumns();
                    this.loadPreference();
                    this.sortColumnDefs();
                });
                this.updateDisplayColumns();
                this.loadPreference();
                this.sortColumnDefs();
            });
        }
    }

    public sortColumnDefs() {
        if (this.columnDefs) {
            const originalDefs = this.columnDefs.toArray();

            this.sortedColumnDefs = this.columnDefs.toArray().slice(0);

            this.sortedColumnDefs = this.sortedColumnDefs.sort((a: TableColumnDirective, b: TableColumnDirective) => {
                const aPosition = a.getPosition() === undefined ? originalDefs.indexOf(a) : a.getPosition()!;
                const bPosition = b.getPosition() === undefined ? originalDefs.indexOf(b) : b.getPosition()!;

                if (aPosition > bPosition) return 1;
                if (aPosition < bPosition) return -1;

                return 0;
            });

            detectChangesNextFrame(this.cd);
        }
    }

    visibleColumns(t: TableColumnDirective[]): TableColumnDirective[] {
        return t.filter(v => !v.isHidden());
    }

    filterFn(item: T) {
        if (this.filter) {
            return this.filter(item);
        }

        if (this.filterQuery && this.filterFields) {
            const q = this.filterQuery!.toLowerCase();
            for (const field of this.filterFields) {
                if (-1 !== String((item as any)[field]).toLowerCase().indexOf(q)) {
                    return true;
                }
            }

            return false;
        }

        return true;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.preferenceKey) {
            this.loadPreference();
        }

        if (changes.items) {
            if (isObservable(this.items)) {
                this.items.subscribe((items: T[]) => {
                    this.rawItems = items;
                    this.sorted = items;
                    this.doSort();
                    this.viewport.checkViewportSize();
                });
            } else if (isArray(this.items)) {
                this.rawItems = this.items;
                this.sorted = this.items;
                this.doSort();
                this.viewport.checkViewportSize();
            } else {
                this.rawItems = [];
                this.sorted = [];
                this.doSort();
                this.viewport.checkViewportSize();
            }
        }

        if (changes.selected) {
            this.selectedMap.clear();
            if (this.selected) {
                for (const v of this.selected) {
                    this.selectedMap.set(v, true);
                }
            }
        }
    }

    private updateDisplayColumns() {
        this.displayedColumns = [];
        this.columnMap = {};

        if (this.columnDefs) {
            for (const column of this.columnDefs.toArray()) {
                this.displayedColumns.push(column.name!);
                this.columnMap[column.name!] = column;
            }

            this.doSort();
        }
    }

    private doSort() {
        if (this.customSort.observers.length) return;
        if (empty(this.sorted)) {
            this.sorted = this.rawItems;
        }

        if (this.sortFunction) {
            this.sorted.sort(this.sortFunction(this.sort));
        } else {
            const sort = Object.entries(this.sort);
            sort.reverse(); //we start from bottom
            let sortRoot = (a: any, b: any) => 0;
            for (const [name, dir] of sort) {
                sortRoot = this.createSortFunction(name, dir, sortRoot);
            }
            this.sorted.sort(sortRoot);
        }

        this.sortedChange.emit(this.sorted);
        this.height = (this.sorted.length * this.itemHeight) + (this.showHeader ? 23 : 0) + 10; //10 is scrollbar padding

        this.sorted = this.sorted.slice(0);
        detectChangesNextFrame(this.parentCd);
    }

    protected createSortFunction(sortField: string, dir: 'asc' | 'desc', next?: (a: any, b: any) => number) {
        return (a: T, b: T) => {
            const aV = this.valueFetcher(a, sortField);
            const bV = this.valueFetcher(b, sortField);

            if (aV === undefined && bV === undefined) return next ? next(a, b) : 0;
            if (aV === undefined && bV !== undefined) return +1;
            if (aV !== undefined && bV === undefined) return -1;

            if (dir === 'asc') {
                if (aV > bV) return 1;
                if (aV < bV) return -1;
            } else {
                if (aV > bV) return -1;
                if (aV < bV) return 1;
            }

            return next ? next(a, b) : 0;
        };
    }

    /**
     * @hidden
     */
    @HostListener('keydown', ['$event'])
    onFocus(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            const firstSelected = first(this.selected);
            if (firstSelected) {
                this.dbclick.emit(firstSelected);
            }
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const firstSelected = first(this.selected);

            if (!firstSelected) {
                this.select(this.sorted[0]);
                return;
            }

            let index = indexOf(this.sorted, firstSelected);

            // if (-1 === index) {
            //     this.select(this.sorted[0]);
            //     this.paginator.pageIndex = 0;
            //     return;
            // }

            if (event.key === 'ArrowUp') {
                if (0 === index) {
                    return;
                }
                index--;
            }

            if (event.key === 'ArrowDown') {
                if (empty(this.sorted)) {
                    return;
                }
                index++;
            }

            if (this.sorted[index]) {
                const item = this.sorted[index];
                // if (event.shiftKey) {
                //     this.selectedMap[item.id] = true;
                //     this.selected.push(item);
                // } else {
                this.select(item);

                const scrollTop = this.viewport.measureScrollOffset();
                const viewportSize = this.viewport.getViewportSize();
                const itemTop = this.itemHeight * index;

                if (itemTop + this.itemHeight > viewportSize + scrollTop) {
                    const diff = (itemTop + this.itemHeight) - (viewportSize + scrollTop);
                    this.viewport.scrollToOffset(scrollTop + diff);
                }

                if (itemTop < scrollTop) {
                    const diff = (itemTop) - (scrollTop);
                    this.viewport.scrollToOffset(scrollTop + diff);
                }
            }
            this.selectedChange.emit(this.selected.slice(0));
            this.cd.markForCheck();
        }
    }

    public deselect(item: T) {
        arrayRemoveItem(this.selected, item);
        this.selectedMap.delete(item);
        detectChangesNextFrame(this.parentCd);
    }

    public select(item: T, $event?: MouseEvent) {
        if (this.selectable === false) {
            return;
        }

        let cellSelectFired = false;
        if ($event && $event.target) {
            const cell = findParentWithClass($event.target as HTMLElement, 'table-cell');
            if (cell) {
                const column = cell.getAttribute('row-column') || '';
                if (column) {
                    this.cellSelect.emit({ item, cell: column });
                    cellSelectFired = true;
                }
            }
        }

        if (!cellSelectFired) {
            this.cellSelect.emit();
        }

        if (this.multiSelect === false) {
            this.selected = [item];
            this.selectedMap.clear();
            this.selectedMap.set(item, true);
        } else {
            if ($event && $event.shiftKey) {
                const indexSelected = this.sorted.indexOf(item);

                if (this.selected[0]) {
                    const firstSelected = this.sorted.indexOf(this.selected[0]);
                    this.selectedMap.clear();
                    this.selected = [];

                    if (firstSelected < indexSelected) {
                        //we select all from index -> indexSelected, downwards
                        for (let i = firstSelected; i <= indexSelected; i++) {
                            this.selected.push(this.sorted[i]);
                            this.selectedMap.set(this.sorted[i], true);
                        }
                    } else {
                        //we select all from indexSelected -> index, upwards
                        for (let i = firstSelected; i >= indexSelected; i--) {
                            this.selected.push(this.sorted[i]);
                            this.selectedMap.set(this.sorted[i], true);
                        }
                    }
                } else {
                    //we start at 0 and select all until index
                    for (let i = 0; i <= indexSelected; i++) {
                        this.selected.push(this.sorted[i]);
                        this.selectedMap.set(this.sorted[i], true);
                    }
                }
            } else if ($event && $event.metaKey) {
                if (arrayHasItem(this.selected, item)) {
                    arrayRemoveItem(this.selected, item);
                    this.selectedMap.delete(item);
                } else {
                    this.selectedMap.set(item, true);
                    this.selected.push(item);
                }
            } else {
                const isRightButton = $event && $event.button == 2;
                const isItemSelected = arrayHasItem(this.selected, item);
                const resetSelection = !isItemSelected || !isRightButton;
                if (resetSelection) {
                    this.selected = [item];
                    this.selectedMap.clear();
                    this.selectedMap.set(item, true);
                }
            }
        }

        this.selectedChange.emit(this.selected);
        detectChangesNextFrame(this.parentCd);
    }
}
