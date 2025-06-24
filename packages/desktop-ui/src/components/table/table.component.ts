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
    ApplicationRef,
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChild,
    contentChildren,
    Directive,
    effect,
    ElementRef,
    HostBinding,
    HostListener,
    inject,
    input,
    model,
    OnDestroy,
    OnInit,
    output,
    signal,
    TemplateRef,
    viewChild,
    viewChildren,
} from '@angular/core';
import { arrayHasItem, arrayRemoveItem, empty, first, getPathValue, indexOf, isNumber, nextTick } from '@deepkit/core';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
    ContextDropdownDirective,
    DropdownComponent,
    DropdownComponent as DropdownComponent_1,
    DropdownContainerDirective,
    DropdownItemComponent,
    DropdownSplitterComponent,
} from '../button/dropdown.component';
import { injectElementRef } from '../app/utils';
import { findParentWithClass } from '../../core/utils';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { SplitterComponent } from '../splitter/splitter.component';

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
@Directive({ selector: '[duiTableCell]' })
export class TableCellDirective {
    constructor(public template: TemplateRef<any>) {
    }
}

/**
 * Can be used to define own dropdown items once the user opens the header context menu.
 *
 * ```html
 * <dui-table>
 *   <dui-dropdown duiTableCustomHeaderContextMenu>
 *       <dui-dropdown-item>Custom Item</dui-dropdown-item>
 *   </dui-dropdown>
 * </dui-table>
 */
@Directive({ selector: 'dui-dropdown[duiTableCustomHeaderContextMenu]' })
export class TableCustomHeaderContextMenuDirective {
    constructor(public dropdown: DropdownComponent) {
    }
}


/**
 * Can be used to define own dropdown items once the user opens the row context menu.
 *
 * ```html
 * <dui-table>
 *    <dui-dropdown duiTableCustomRowContextMenu>
 *       <dui-dropdown-item>Custom Item</dui-dropdown-item>
 *    </dui-dropdown>
 * </dui-table>
 * ```
 */
@Directive({ selector: 'dui-dropdown[duiTableCustomRowContextMenu]' })
export class TableCustomRowContextMenuDirective {
    constructor(public dropdown: DropdownComponent) {
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
@Directive({ selector: '[duiTableHeader]' })
export class TableHeaderDirective {
    constructor(public template: TemplateRef<any>) {
    }
}

/**
 * Defines a new column.
 *
 * ```html
 * <dui-table-column name="fieldName" header="Field Name" [width]="100" />
 */
@Directive({ selector: 'dui-table-column' })
export class TableColumnDirective implements OnInit {
    /**
     * The name of the column. Needs to be unique. If no renderer (*duiTableCell) is specified, this
     * name is used to render the content T[name].
     *
     * This supports dot notation, so you can use `user.name` to access the `name` property of the `user` object.
     */
    name = input<string>('');

    /**
     * A different header name. Use dui-table-header to render HTML there.
     */
    header = input<string>();

    /**
     * Default width.
     */
    width = model<number | string>(100);

    /**
     * Adds additional class to the columns cells.
     */
    class = input<string>('');

    /**
     * Whether this column is start hidden. User can unhide it using the context menu on the header.
     */
    hidden = model(false);

    sortable = input<boolean>(true);

    hideable = input<boolean>(true);

    /**
     * At which position this column will be placed.
     */
    position = input<number>();

    /**
     * This is the new position when the user moved it manually.
     * @hidden
     */
    overwrittenPosition = signal<number | undefined>(undefined);

    defaultWidth: number | string = 100;

    cell = contentChild(TableCellDirective, {});
    headerDirective = contentChild(TableHeaderDirective, {});

    ngOnInit() {
        this.defaultWidth = this.width();
    }

    toggleHidden() {
        this.hidden.update(v => !v);
    }

    /**
     * @hidden
     */
    getWidth(): string | undefined {
        const width = this.width();
        if (!width) return undefined;

        if (isNumber(width)) {
            return width + 'px';
        }

        return width;
    }

    /**
     * @hidden
     */
    getPosition() {
        const overwritten = this.overwrittenPosition();
        if (overwritten !== undefined) return overwritten;
        return this.position();
    }
}

@Component({
    selector: 'dui-table',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <dui-dropdown #headerDropdown>
        <ng-container *dropdownContainer>
          @for (column of sortedColumns(); track column.name()) {
            @if (column.hideable() && column.name()) {
              <dui-dropdown-item
                [selected]="!column.hidden()"
                (mousedown)="column.toggleHidden();headerDropdown.close()"
              >
                @if (column.headerDirective(); as header) {
                  <ng-container
                    [ngTemplateOutlet]="header.template"
                    [ngTemplateOutletContext]="{$implicit: column}"></ng-container>
                } @else {
                  {{ column.header() || column.name() }}
                }
              </dui-dropdown-item>
            }
          }
          <dui-dropdown-separator></dui-dropdown-separator>
          <dui-dropdown-item (click)="resetAll()">Reset all</dui-dropdown-item>
        </ng-container>
      </dui-dropdown>

      @if (showHeader()) {
        <div class="header" #header
             [contextDropdown]="customHeaderDropdown()?.dropdown || headerDropdown">
          @for (column of sortedFilteredColumns(); track $index; let columnIndex = $index) {
            <div class="th"
                 [style.width]="column.getWidth() || 100 + 'px'"
                 (mouseup)="sortBy(column.name() || '', $event)"
                 [class.freeze]="columnIndex < freezeColumns()"
                 [style.left.px]="columnIndex < freezeColumns() ? freezeLeft(columnIndex) : undefined"
                 [attr.name]="column.name()"
                 [style.top]="scrollTop + 'px'"
                 #th>
              @if (column.headerDirective(); as header) {
                <ng-container
                  [ngTemplateOutlet]="header.template"
                  [ngTemplateOutletContext]="{$implicit: column}"></ng-container>
              } @else {
                {{ column.header() || column.name() }}
              }
              @if (sort()[column.name()]; as direction) {
                @if (direction === 'desc') {
                  <dui-icon [size]="12" name="arrow_down"></dui-icon>
                } @else {
                  <dui-icon [size]="12" name="arrow_up"></dui-icon>
                }
              }
              <dui-splitter (sizeChange)="setColumnWidth(column, $event)" indicator position="right"></dui-splitter>
            </div>
          }
        </div>
      }
      @let valueFetch = valueFetcher();

      <div class="body overlay-scrollbar-small" (click)="clickCell($event)" (dblclick)="dblClickCell($event)">
        @if (autoHeight()) {
          @for (row of filterSorted(); track trackByFn(i, row); let i = $index; let isOdd = $odd) {
            <div class="table-row {{rowClass()(row)}}"
                 [contextDropdown]="customRowDropdown()?.dropdown"
                 [class.selected]="selectedMap.has(row)"
                 [class.odd]="isOdd"
                 (mousedown)="select(row, $event)"
                 (contextmenu)="select(row, $event)"
                 (dblclick)="dblclick.emit(row)"
            >
              @for (column of sortedFilteredColumns(); track $index; let columnIndex = $index) {
                <div class="table-cell"
                     [class]="column.class() + ' ' + cellClass()(row, column.name())"
                     [attr.row-column]="column.name()"
                     [class.freeze]="columnIndex < freezeColumns()"
                     [style.left.px]="columnIndex < freezeColumns() ? freezeLeft(columnIndex) : undefined"
                     [class.freeze-last]="columnIndex === freezeColumns() - 1"
                     [attr.row-i]="i"
                     [style.flex-basis]="column.getWidth() || 100 + 'px'"
                >
                  @if (column.cell(); as cell) {
                    <ng-container [ngTemplateOutlet]="cell.template"
                                  [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
                  } @else {
                    {{ valueFetch(row, column.name()) }}
                  }
                </div>
              }
            </div>
          }
        }

        @if (!autoHeight()) {
          <cdk-virtual-scroll-viewport #viewportElement
                                       class="overlay-scrollbar-small"
                                       [itemSize]="itemHeight()">
            <ng-container
              *cdkVirtualFor="let row of filterSorted(); trackBy: trackByFn; let i = index; odd as isOdd">
              <div class="table-row {{rowClass()(row)}}"
                   [contextDropdown]="customRowDropdown()?.dropdown"
                   [class.selected]="selectedMap.has(row)"
                   [class.odd]="isOdd"
                   [style.height.px]="itemHeight()"
                   (mousedown)="select(row, $event)"
                   (contextmenu)="select(row, $event)"
                   (dblclick)="dblclick.emit(row)"
              >
                @for (column of sortedFilteredColumns(); track $index; let columnIndex = $index) {
                  <div class="table-cell"
                       [class]="column.class() + ' ' + cellClass()(row, column.name())"
                       [attr.row-column]="column.name()"
                       [class.freeze]="columnIndex < freezeColumns()"
                       [style.left.px]="columnIndex < freezeColumns() ? freezeLeft(columnIndex) : undefined"
                       [class.freeze-last]="columnIndex === freezeColumns() - 1"
                       [attr.row-i]="i"
                       [style.flex-basis]="column.getWidth() || 100 + 'px'"
                  >
                    @if (column.cell(); as cell) {
                      <ng-container [ngTemplateOutlet]="cell.template"
                                    [ngTemplateOutletContext]="{ $implicit: row }"></ng-container>
                    } @else {
                      {{ valueFetch(row, column.name()) }}
                    }
                  </div>
                }
              </div>
            </ng-container>
          </cdk-virtual-scroll-viewport>
        }
      </div>
    `,
    styleUrls: ['./table.component.scss'],
    host: {
        '[class.focus-outline]': '!noFocusOutline()',
        '[class.borderless]': 'borderless()',
        '[class.with-hover]': 'hover()',
        '[class.auto-height]': 'autoHeight()',
        '[class.dui-normalized]': 'true',
        '[class.text-selection]': 'textSelection()',
    },
    imports: [
        DropdownComponent_1,
        DropdownContainerDirective,
        DropdownItemComponent,
        NgTemplateOutlet,
        DropdownSplitterComponent,
        ContextDropdownDirective,
        IconComponent,
        SplitterComponent,
        CdkVirtualScrollViewport,
        CdkFixedSizeVirtualScroll,
        CdkVirtualForOf,
    ],
})
export class TableComponent<T> implements AfterViewInit, OnInit, OnDestroy {
    protected app = inject(ApplicationRef);

    /**
     * @hidden
     */
    @HostBinding() tabindex = 0;

    borderless = input(false, { transform: booleanAttribute });

    /**
     * Array of items that should be used for each row.
     */
    items = input.required<T[]>();

    /**
     * Since dui-table has virtual-scroll active per default, it's required to define the itemHeight to
     * make scrolling actually workable correctly.
     */
    itemHeight = input<number>(25);

    /**
     * Whether the table height just prints all rows, or if virtual scrolling is enabled.
     * If true, the row height depends on the content.
     */
    autoHeight = input<boolean>(false);

    /**
     * Whether the table row should have a hover effect.
     */
    hover = input(false, { transform: booleanAttribute });

    /**
     * Whether the header should be shown.
     */
    showHeader = input<boolean>(true);

    /**
     * How many columns (from the left) are frozen (stay visible even if user scrolls horizontally).
     */
    freezeColumns = input<number>(0);

    /**
     * Default field of T for sorting.
     */
    defaultSort = input<string>('');

    /**
     * Default sorting order.
     */
    defaultSortDirection = input<'asc' | 'desc'>('asc');

    /**
     * Whether rows are selectable.
     */
    selectable = input(false, { transform: booleanAttribute });

    /**
     * Whether multiple rows are selectable at the same time.
     */
    multiSelect = input(false, { transform: booleanAttribute });

    /**
     * TrackFn for ngFor to improve performance. Default is order by index.
     */
    trackFn = input<(index: number, item: T) => any>();

    /**
     * Not used yet.
     */
    displayInitial = input<number>(20);

    /**
     * Not used yet.
     */
    increaseBy = input<number>(10);

    /**
     * Filter function.
     */
    filter = input<(item: T) => boolean>();

    rowClass = input<(item: T) => string>(() => '');

    cellClass = input<(item: T, column: string) => string>(() => '');

    /**
     * When the user changes the order or width of the columns, the information is stored
     * in localStorage using this key, prefixed with `@dui/table/`.
     */
    preferenceKey = input<string>('root');

    /**
     * Filter query.
     */
    filterQuery = input<string>();

    columnState = input<{
        name: string;
        position: number;
        visible: boolean;
    }[]>([]);

    /**
     * Against which fields filterQuery should run.
     */
    filterFields = input<string[]>();

    /**
     * Alternate object value fetcher, important for sorting and filtering.
     */
    valueFetcher = input((object: any, path: string): any => {
        if (!path) return '';
        const value = getPathValue(object, path);
        if (value instanceof Date) {

        }
        return value;
    });

    /**
     * A hook to provide custom sorting behavior for certain columns.
     */
    sortFunction = input<(sort: {
        [name: string]: 'asc' | 'desc';
    }) => (((a: T, b: T) => number) | undefined)>();

    /**
     * Whether sorting is enabled (clicking headers trigger sort).
     */
    sorting = input<boolean>(true);

    noFocusOutline = input(false, { alias: 'no-focus-outline', transform: booleanAttribute });

    /**
     * Allow text selection in the table.
     */
    textSelection = input(false, { alias: 'text-selection', transform: booleanAttribute });

    sort = model<{ [column: string]: 'asc' | 'desc'; }>({});

    sorted = computed(() => {
        const sortFunction = this.sortFunction();
        if (sortFunction) {
            const sorted = this.items().sort(sortFunction(this.sort()));
            return sorted.slice();
        }

        const sort = Object.entries(this.sort());
        sort.reverse(); //we start from bottom
        let sortRoot = (a: any, b: any) => 0;
        for (const [name, dir] of sort) {
            sortRoot = this.createSortFunction(name, dir, sortRoot);
        }
        const sorted = this.items().sort(sortRoot);
        return sorted.slice();
    });

    // TODO rework that to be reactive
    selectedMap = new Map<T, boolean>();

    /**
     * Elements that are selected, by reference.
     */
    selected = model<T[]>([]);

    cellSelect = output<{ item: T, cell: string } | undefined>();

    /**
     * When a row gets double clicked.
     */
    dblclick = output<T>();

    cellClick = output<{ item: T, column: string }>();
    cellDblClick = output<{ item: T, column: string }>();

    header = viewChild('header', { read: ElementRef });
    ths = viewChildren('th', { read: ElementRef });

    columnDefs = contentChildren(TableColumnDirective, { descendants: true });

    customHeaderDropdown = contentChild(TableCustomHeaderContextMenuDirective);
    customRowDropdown = contentChild(TableCustomRowContextMenuDirective);

    viewport = viewChild(CdkVirtualScrollViewport);
    viewportElement = viewChild('viewportElement', { read: ElementRef });

    sortedColumns = computed(() => {
        const originalDefs = this.columnDefs();
        const columns = originalDefs.slice();

        columns.sort((a, b) => {
            const aPosition = a.getPosition() === undefined ? originalDefs.indexOf(a) : a.getPosition()!;
            const bPosition = b.getPosition() === undefined ? originalDefs.indexOf(b) : b.getPosition()!;

            if (aPosition > bPosition) return 1;
            if (aPosition < bPosition) return -1;

            return 0;
        });
        return columns;
    });

    sortedFilteredColumns = computed(() => {
        const originalDefs = this.sortedColumns();
        return originalDefs.filter(v => !v.hidden());
    });

    columnMap = computed(() => {
        const map: { [name: string]: TableColumnDirective } = {};
        for (const column of this.sortedColumns()) {
            map[column.name()] = column;
        }
        return map;
    });

    protected ignoreThisSort = false;
    scrollTop = 0;

    element = injectElementRef();

    constructor() {
        effect(() => this.storePreference());
        effect(() => {
            const items = this.filterSorted();
            this.viewport()?.checkViewportSize();
        });
    }

    setColumnWidth(column: TableColumnDirective, width: number) {
        column.width.set(width);
    }

    ngOnInit() {
        const defaultSort = this.defaultSort();
        if (defaultSort) {
            this.sort()[defaultSort] = this.defaultSortDirection();
        }
    }

    ngOnDestroy(): void {

    }

    freezeLeft(untilIndex: number): number {
        const columns = this.sortedColumns();
        let left = 0;
        for (let i = 0; i < untilIndex; i++) {
            const width = columns[i].width();
            if (width === undefined) continue;
            left += 'number' === typeof width ? width : parseInt(width);
        }
        return left;
    }

    @HostListener('window:resize')
    onResize() {
        nextTick(() => {
            this.viewport()?.checkViewportSize();
        });
    }

    resetAll() {
        localStorage.removeItem('@dui/table/preferences-' + this.preferenceKey());
        for (const column of this.columnDefs()) {
            column.width.set(column.defaultWidth);
            column.hidden.set(false);
            column.overwrittenPosition.set(undefined);
        }
    }

    storePreference() {
        if ('undefined' === typeof localStorage) return;
        const preferences: { [name: string]: { hidden: boolean | '', width?: number | string, order?: number } } = {};

        for (const column of this.columnDefs()) {
            preferences[column.name()] = {
                width: column.width(),
                order: column.overwrittenPosition(),
                hidden: column.hidden(),
            };
        }
        localStorage.setItem('@dui/table/preferences-' + this.preferenceKey(), JSON.stringify(preferences));
    }

    loadPreference() {
        if ('undefined' === typeof localStorage) return;

        const preferencesJSON = localStorage.getItem('@dui/table/preferences-' + this.preferenceKey());
        if (!preferencesJSON) return;
        const preferences = JSON.parse(preferencesJSON);
        const columnMap = this.columnMap();
        for (const i in preferences) {
            if (!preferences.hasOwnProperty(i)) continue;
            if (!columnMap[i]) continue;
            if (preferences[i].width !== undefined) columnMap[i].width.set(preferences[i].width);
            if (preferences[i].order !== undefined) columnMap[i].overwrittenPosition.set(preferences[i].order);
            if (preferences[i].hidden !== undefined) columnMap[i].hidden.set(preferences[i].hidden);
        }
    }

    dblClickCell(event: MouseEvent) {
        if (!event.target) return;
        const cell = findParentWithClass(event.target as HTMLElement, 'table-cell');
        if (!cell) return;
        const i = parseInt(cell.getAttribute('row-i') || '', 10);
        const column = cell.getAttribute('row-column') || '';

        this.cellDblClick.emit({ item: this.sorted()[i], column });
    }

    clickCell(event: MouseEvent) {
        if (!event.target) return;
        const cell = findParentWithClass(event.target as HTMLElement, 'table-cell');
        if (!cell) return;
        const i = parseInt(cell.getAttribute('row-i') || '', 10);
        const column = cell.getAttribute('row-column') || '';

        this.cellClick.emit({ item: this.sorted()[i], column });
    }

    /**
     * Toggles the sort by the given column name.
     */
    sortBy(name: string, $event?: MouseEvent) {
        if (!this.sorting()) return;

        if (this.ignoreThisSort) {
            this.ignoreThisSort = false;
            return;
        }

        if ($event && $event.button === 2) return;

        const column = this.columnMap()[name];
        if (!column?.sortable()) {
            return;
        }

        const sort = this.sort();

        //only when shift is pressed do we activate multi-column sort
        if (!$event || !$event.shiftKey) {
            for (const member in this.sort()) if (member !== name) delete sort[member];
        }

        if (!sort[name]) {
            sort[name] = 'asc';
        } else {
            if (sort[name] === 'asc') sort[name] = 'desc';
            else if (sort[name] === 'desc') delete sort[name];
        }

        this.sort.set({ ...sort });
    }

    filterSorted = computed(() => {
        if (this.filter() || (this.filterQuery() && this.filterFields())) {
            return this.sorted().filter((v) => this.filterFn(v));
        }

        return this.sorted();
    });

    /**
     * @hidden
     */
    trackByFn = (index: number, item: any) => {
        const trackFn = this.trackFn();
        return trackFn ? trackFn(index, item) : index;
    };

    // async initHeaderMovement() {
    //     if ('undefined' !== typeof window && this.header && this.ths) {
    //         const Hammer = await getHammer();
    //         if (!Hammer) return;
    //
    //         const mc = new Hammer(this.header!.nativeElement);
    //         mc.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 1 }));
    //
    //         interface Box {
    //             left: number;
    //             width: number;
    //             element: HTMLElement;
    //             directive: TableColumnDirective;
    //         }
    //
    //         const THsBoxes: Box[] = [];
    //
    //         let element: HTMLElement | undefined;
    //         let elementCells: HTMLElement[] = [];
    //         let originalPosition = -1;
    //         let foundBox: Box | undefined;
    //         let rowCells: { cells: HTMLElement[] }[] = [];
    //
    //         let startOffsetLeft = 0;
    //         let offsetLeft = 0;
    //         let startOffsetWidth = 0;
    //
    //         let animationFrame: any;
    //         mc.on('panstart', (event: HammerInput) => {
    //             foundBox = undefined;
    //
    //             if (this.ths && event.target.classList.contains('th')) {
    //                 element = event.target as HTMLElement;
    //                 element.style.zIndex = '1000000';
    //                 element.style.opacity = '0.8';
    //
    //                 startOffsetLeft = element.offsetLeft;
    //                 offsetLeft = element.offsetLeft;
    //                 startOffsetWidth = element.offsetWidth;
    //
    //                 arrayClear(THsBoxes);
    //                 rowCells = [];
    //
    //                 for (const th of this.ths.toArray()) {
    //                     const directive: TableColumnDirective = this.sortedColumns.find((v) => v.name === th.nativeElement.getAttribute('name')!)!;
    //                     const cells = [...this.element.nativeElement.querySelectorAll('div[row-column="' + directive.name() + '"]')] as any as HTMLElement[];
    //
    //                     if (th.nativeElement === element) {
    //                         originalPosition = this.sortedColumns.indexOf(directive);
    //                         elementCells = cells;
    //                         for (const cell of elementCells) {
    //                             cell.classList.add('active-drop');
    //                         }
    //                     } else {
    //                         for (const cell of cells) {
    //                             cell.classList.add('other-cell');
    //                         }
    //                         th.nativeElement.classList.add('other-cell');
    //                     }
    //
    //                     THsBoxes.push({
    //                         left: th.nativeElement.offsetLeft,
    //                         width: th.nativeElement.offsetWidth,
    //                         element: th.nativeElement,
    //                         directive: directive,
    //                     });
    //
    //                     rowCells.push({ cells: cells });
    //                 }
    //             }
    //         });
    //
    //         mc.on('panend', (event: HammerInput) => {
    //             if (animationFrame) {
    //                 cancelAnimationFrame(animationFrame);
    //             }
    //
    //             if (element) {
    //                 element.style.left = '';
    //                 element.style.zIndex = '';
    //                 element.style.opacity = '';
    //
    //                 for (const t of rowCells) {
    //                     for (const cell of t.cells) {
    //                         cell.classList.remove('active-drop');
    //                         cell.classList.remove('other-cell');
    //                         cell.style.left = '0px';
    //                     }
    //                 }
    //
    //                 this.ignoreThisSort = true;
    //
    //                 for (const box of THsBoxes) {
    //                     box.element.style.left = '0px';
    //                     box.element.classList.remove('other-cell');
    //                 }
    //
    //                 if (foundBox) {
    //                     const newPosition = this.sortedColumns.indexOf(foundBox.directive);
    //
    //                     if (originalPosition !== newPosition) {
    //                         const directive = this.sortedColumns[originalPosition];
    //                         this.sortedColumns.splice(originalPosition, 1);
    //                         this.sortedColumns.splice(newPosition, 0, directive);
    //
    //                         for (let [i, v] of eachPair(this.sortedColumns)) {
    //                             v.overwrittenPosition = i;
    //                         }
    //
    //                         this.sortColumnDefs();
    //                     }
    //                 }
    //
    //                 this.storePreference();
    //                 element = undefined;
    //             }
    //         });
    //
    //         mc.on('pan', (event: HammerInput) => {
    //             if (animationFrame) {
    //                 cancelAnimationFrame(animationFrame);
    //             }
    //
    //             animationFrame = nextTick(() => {
    //                 if (element) {
    //                     element!.style.left = (event.deltaX) + 'px';
    //                     const offsetLeft = startOffsetLeft + event.deltaX;
    //
    //                     for (const cell of elementCells) {
    //                         cell.style.left = (event.deltaX) + 'px';
    //                     }
    //                     let afterElement = false;
    //
    //                     foundBox = undefined;
    //                     for (const [i, box] of eachPair(THsBoxes)) {
    //                         if (box.element === element) {
    //                             afterElement = true;
    //                             continue;
    //                         }
    //
    //                         box.element.style.left = '0px';
    //                         for (const cell of rowCells[i].cells) {
    //                             cell.style.left = '0px';
    //                         }
    //
    //                         if (!afterElement && box.left + (box.width / 2) > offsetLeft) {
    //                             //the dragged element is before the current
    //                             box.element.style.left = startOffsetWidth + 'px';
    //
    //                             for (const cell of rowCells[i].cells) {
    //                                 cell.style.left = startOffsetWidth + 'px';
    //                             }
    //
    //                             if (foundBox && box.left > foundBox.left) {
    //                                 //we found already a box that fits and that is more left
    //                                 continue;
    //                             }
    //
    //                             foundBox = box;
    //                         } else if (afterElement && box.left + (box.width / 2) < offsetLeft + startOffsetWidth) {
    //                             //the dragged element is after the current
    //                             box.element.style.left = -startOffsetWidth + 'px';
    //                             for (const cell of rowCells[i].cells) {
    //                                 cell.style.left = -startOffsetWidth + 'px';
    //                             }
    //                             foundBox = box;
    //                         }
    //                     }
    //                 }
    //             });
    //         });
    //     }
    // }

    ngAfterViewInit(): void {
        this.viewportElement()?.nativeElement.addEventListener('scroll', () => {
            const scrollLeft = this.viewportElement()?.nativeElement.scrollLeft;
            const header = this.header();
            if (!header) return;
            header.nativeElement.scrollLeft = scrollLeft;
        });
    }

    filterFn(item: T) {
        const filter = this.filter();
        if (filter) {
            return filter(item);
        }

        const filterQuery = this.filterQuery();
        const filterFields = this.filterFields();
        if (filterQuery && filterFields) {
            const q = filterQuery!.toLowerCase();
            for (const field of filterFields) {
                if (-1 !== String((item as any)[field]).toLowerCase().indexOf(q)) {
                    return true;
                }
            }

            return false;
        }

        return true;
    }

    protected createSortFunction(sortField: string, dir: 'asc' | 'desc', next?: (a: any, b: any) => number) {
        return (a: T, b: T) => {
            const aV = this.valueFetcher()(a, sortField);
            const bV = this.valueFetcher()(b, sortField);

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
            const firstSelected = first(this.selected());
            if (firstSelected) {
                this.dblclick.emit(firstSelected);
            }
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const firstSelected = first(this.selected());
            const items = this.filterSorted();

            if (!firstSelected) {
                this.select(items[0]);
                return;
            }

            let index = indexOf(items, firstSelected);

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

            if (items[index]) {
                const item = items[index];
                // if (event.shiftKey) {
                //     this.selectedMap[item.id] = true;
                //     this.selected.push(item);
                // } else {
                this.select(item);

                const viewport = this.viewport();
                if (viewport) {
                    const scrollTop = viewport.measureScrollOffset();
                    const viewportSize = viewport.getViewportSize();
                    const itemTop = this.itemHeight() * index;

                    if (itemTop + this.itemHeight() > viewportSize + scrollTop) {
                        const diff = (itemTop + this.itemHeight()) - (viewportSize + scrollTop);
                        viewport.scrollToOffset(scrollTop + diff);
                    }

                    if (itemTop < scrollTop) {
                        const diff = (itemTop) - (scrollTop);
                        viewport.scrollToOffset(scrollTop + diff);
                    }
                }
            }
        }
    }

    select(item: T, $event?: MouseEvent) {
        if (!this.selectable()) return;

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
            this.cellSelect.emit(undefined);
        }
        const items = this.filterSorted();

        const selected = this.selected();
        if (!this.multiSelect()) {
            this.selected.set([item]);
            this.selectedMap.clear();
            this.selectedMap.set(item, true);
        } else {
            if ($event && $event.shiftKey) {
                const indexSelected = items.indexOf(item);

                if (selected[0]) {
                    const firstSelected = items.indexOf(selected[0]);
                    this.selectedMap.clear();

                    if (firstSelected < indexSelected) {
                        //we select all from index -> indexSelected, downwards
                        for (let i = firstSelected; i <= indexSelected; i++) {
                            selected.push(items[i]);
                            this.selectedMap.set(items[i], true);
                        }
                    } else {
                        //we select all from indexSelected -> index, upwards
                        for (let i = firstSelected; i >= indexSelected; i--) {
                            selected.push(items[i]);
                            this.selectedMap.set(items[i], true);
                        }
                    }
                } else {
                    //we start at 0 and select all until index
                    for (let i = 0; i <= indexSelected; i++) {
                        selected.push(items[i]);
                        this.selectedMap.set(items[i], true);
                    }
                }
                this.selected.set([item]);
            } else if ($event && $event.metaKey) {
                if (arrayHasItem(selected, item)) {
                    arrayRemoveItem(selected, item);
                    this.selectedMap.delete(item);
                } else {
                    this.selectedMap.set(item, true);
                    selected.push(item);
                }
                this.selected.set(selected.slice());
            } else {
                const isRightButton = $event && $event.button == 2;
                const isItemSelected = arrayHasItem(selected, item);
                const resetSelection = !isItemSelected || !isRightButton;
                if (resetSelection) {
                    this.selected.set([item]);
                    this.selectedMap.clear();
                    this.selectedMap.set(item, true);
                }
            }
        }
    }
}
