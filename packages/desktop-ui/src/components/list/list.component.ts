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
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    HostBinding,
    HostListener,
    Injectable,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    Optional,
    Output,
    SimpleChanges,
    SkipSelf
} from '@angular/core';
import { NavigationEnd, Router, UrlTree } from '@angular/router';
import { ngValueAccessor, ValueAccessorBase } from '../../core/form';
import { Subscription } from 'rxjs';
import { arrayRemoveItem } from '@deepkit/core';

@Component({
    selector: 'dui-list-title',
    template: `
        <ng-content></ng-content>`,
    styleUrls: ['./list-title.component.scss']
})
export class ListTitleComponent {
    constructor() {
    }
}

@Component({
    selector: 'dui-list',
    template: `
        <ng-content></ng-content>
    `,
    styleUrls: ['./list.component.scss'],
    host: {
        '[class.white]': 'white !== false',
        '[class.overlay-scrollbar-small]': 'true',
        '[class.focusable]': 'focusable',
        '[class.delimiter-line]': 'delimiterLine !== false',
    },
    providers: [ngValueAccessor(ListComponent)]
})
@Injectable()
export class ListComponent extends ValueAccessorBase<any> {
    static ids: number = 0;

    @Input() white: boolean | '' = false;

    id = ++ListComponent.ids;

    @Input() focusable: boolean = true;
    @Input() delimiterLine: boolean | '' = false;

    @HostBinding('tabindex') tabIndex: number = 1;

    items: ListItemComponent[] = [];

    protected itemMap = new Map<string, ListItemComponent>();

    constructor(
        protected injector: Injector,
        public readonly cd: ChangeDetectorRef,
        public host: ElementRef<HTMLElement>,
        @SkipSelf() public readonly cdParent: ChangeDetectorRef,
    ) {
        super(injector, cd, cdParent);
    }

    public deregister(item: ListItemComponent) {
        arrayRemoveItem(this.items, item);
        this.itemMap.delete(item.id + '');
    }

    public register(item: ListItemComponent) {
        this.items.push(item);
        this.itemMap.set(item.id + '', item);
    }

    protected getSortedList(): ListItemComponent[] {
        const list = Array.from(this.host.nativeElement.querySelectorAll(`dui-list-item[list-id="${this.id}"]`));
        return list.map(v => this.itemMap.get(v.getAttribute('list-item-id')!)!);
    }

    @HostListener('keydown', ['$event'])
    public async onKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const selectedItem = this.getSelectedItem();
            if (selectedItem) {
                const items = this.getSortedList();
                const position = items.indexOf(selectedItem);

                if (items[position + 1]) {
                    await items[position + 1].select();
                }
            }
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            const selectedItem = this.getSelectedItem()
            if (selectedItem) {
                const items = this.getSortedList();
                const position = items.indexOf(selectedItem);

                if (items[position - 1]) {
                    await items[position - 1].select();
                }
            }
        }
    }

    public getSelectedItem(): ListItemComponent | undefined {
        for (const item of this.items) {
            if (item.isSelected()) {
                return item;
            }
        }

        return;
    }
}

@Component({
    selector: 'dui-list-item',
    template: `
        <ng-content></ng-content>
    `,
    host: {
        '[class.selected]': 'isSelected()',
        '[attr.list-id]': 'list.id',
        '[attr.list-item-id]': 'id',
    },
    styleUrls: ['./list-item.component.scss']
})
export class ListItemComponent implements OnChanges, OnDestroy {
    static ids: number = 0;
    id = ++ListItemComponent.ids;

    @Input() value: any;
    @Input() routerLink?: string | UrlTree | any[];
    @Input() routerLinkExact?: boolean;
    @Input() active?: boolean;

    /**
     * When position is dynamic, it might be handy to define the position
     * explicitly to make arrow-up/arrow-down navigation possible.
     */
    @Input() position: number = 0;

    @Output() onSelect = new EventEmitter<any>();

    protected routerSub?: Subscription;

    constructor(
        public list: ListComponent,
        public element: ElementRef,
        @SkipSelf() public cd: ChangeDetectorRef,
        @Optional() public router?: Router,
    ) {
        this.element.nativeElement.removeAttribute('tabindex');
        list.register(this);
        this.list.registerOnChange(() => {
            this.cd.detectChanges();
        });
        if (this.router) {
            this.routerSub = this.router.events.subscribe((event) => {
                if (event instanceof NavigationEnd) {
                    this.cd.detectChanges();
                }
            });
        }
    }

    ngOnDestroy(): void {
        this.list.deregister(this);
        if (this.routerSub) {
            this.routerSub.unsubscribe();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.cd.detectChanges();
    }

    public async select() {
        if (this.routerLink && this.router) {
            if ('string' === typeof this.routerLink) {
                await this.router.navigateByUrl(this.routerLink);
            } else if (Array.isArray(this.routerLink)) {
                await this.router.navigate(this.routerLink);
            } else {
                await this.router.navigateByUrl(this.router.serializeUrl(this.routerLink!));
            }
        } else {
            this.list.innerValue = this.value;
        }
        this.onSelect.emit(this.value);
    }

    public isSelected(): boolean {
        if (this.active !== undefined) return this.active;

        if (this.value !== undefined) {
            return this.list.innerValue === this.value;
        }

        if (this.routerLink && this.router) {
            if ('string' === typeof this.routerLink) {
                return this.router.isActive(this.routerLink, this.routerLinkExact === true);
            } else if (Array.isArray(this.routerLink)) {
                return this.router.isActive(this.router.createUrlTree(this.routerLink), this.routerLinkExact === true);
            } else {
                return this.router.isActive(this.routerLink!, this.routerLinkExact === true);
            }
        }

        return false;
    }

    @HostListener('mousedown')
    public onClick() {
        this.list.innerValue = this.value;
        this.onSelect.emit(this.value);
    }
}
