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
    ContentChildren,
    Directive,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    QueryList,
    forwardRef,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { arrayHasItem } from '@deepkit/core';

import { Electron } from '../../core/utils';
import { WindowMenuState } from '../window/window-menu';

@Directive()
export class MenuBase implements AfterViewInit {
    @Input() label?: string;
    @Input() sublabel?: string;
    @Input() icon?: string;
    @Input() enabled: boolean = true;
    @Input() accelerator?: string;
    @Input() role?: string;

    @Input() visible: boolean = true;

    @Input() onlyMacOs: boolean | '' = false;
    @Input() noMacOs: boolean | '' = false;

    @Input() id?: string;
    @Input() before?: string;
    @Input() after?: string;
    @Input() beforeGroupContaining?: string;
    @Input() afterGroupContaining?: string;

    @Output() click = new EventEmitter();

    @Output() change = new EventEmitter();

    public type = '';

    protected registered = new Set<MenuBase>();
    protected subscriptions = new Map<MenuBase, Subscription>();

    @ContentChildren(MenuBase) public child?: QueryList<MenuBase>;

    constructor() {}

    buildTemplate() {
        const submenu: any[] = [];
        if (this.child) {
            for (const item of this.child.toArray()) {
                if (item === this) continue;
                if (!item.validOs()) {
                    continue;
                }
                submenu.push(item.buildTemplate());
            }
        }

        const result: { [name: string]: any } = {
            click: () => {
                this.click.emit();
            },
        };

        if (this.label) result['label'] = this.label;
        if (this.sublabel) result['sublabel'] = this.sublabel;

        if (!this.enabled) result['enabled'] = false;
        if (this.type) result['type'] = this.type;

        if (this.accelerator) result['accelerator'] = this.accelerator;
        if (this.role) result['role'] = this.role;
        if (this.type) result['type'] = this.type;
        if (this.accelerator) result['accelerator'] = this.accelerator;
        if (submenu.length) result['submenu'] = submenu;

        return result;
    }

    public validOs(): boolean {
        if (Electron.isAvailable()) {
            if (this.onlyMacOs !== false && Electron.getProcess().platform !== 'darwin') {
                return false;
            }

            if (this.noMacOs !== false && Electron.getProcess().platform === 'darwin') {
                return false;
            }
        }

        return true;
    }

    ngAfterViewInit() {
        if (this.child) {
            this.child!.changes.subscribe((items: MenuBase[]) => {
                for (const item of items) {
                    if (!this.registered.has(item)) {
                        this.registered.add(item);
                        this.subscriptions.set(
                            item,
                            item.change.subscribe(() => {
                                this.change.emit();
                            }),
                        );
                    }
                }

                for (const item of this.registered) {
                    if (!arrayHasItem(items, item)) {
                        //got removed
                        this.registered.delete(item);
                        this.subscriptions.get(item)!.unsubscribe();
                        this.subscriptions.delete(item);
                    }
                }

                this.change.emit();
            });
        }
    }
}

@Directive({
    selector: 'dui-menu-item',
    providers: [{ provide: MenuBase, useExisting: forwardRef(() => MenuItemDirective) }],
})
export class MenuItemDirective extends MenuBase {}

@Directive({
    selector: 'dui-menu-checkbox',
    providers: [
        {
            provide: MenuBase,
            useExisting: forwardRef(() => MenuCheckboxDirective),
        },
    ],
})
export class MenuCheckboxDirective extends MenuBase {
    @Input() checked: boolean = false;

    type = 'checkbox';

    buildTemplate() {
        return { ...super.buildTemplate(), checked: this.checked };
    }
}

@Directive({
    selector: 'dui-menu-radio',
    providers: [
        {
            provide: MenuBase,
            useExisting: forwardRef(() => MenuRadioDirective),
        },
    ],
})
export class MenuRadioDirective extends MenuBase {
    @Input() checked: boolean = false;

    type = 'radio';

    buildTemplate() {
        return { ...super.buildTemplate(), checked: this.checked };
    }
}

@Directive({
    selector: 'dui-menu-separator',
    providers: [
        {
            provide: MenuBase,
            useExisting: forwardRef(() => MenuSeparatorDirective),
        },
    ],
})
export class MenuSeparatorDirective extends MenuBase {
    type = 'separator';
}

@Directive({
    selector: 'dui-menu',
})
export class MenuDirective extends MenuBase implements OnDestroy, AfterViewInit {
    @Input() position: number = 0;

    constructor(protected windowMenuState: WindowMenuState) {
        super();
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();
        this.windowMenuState.addMenu(this);
    }

    ngOnDestroy() {
        this.windowMenuState.removeMenu(this);
    }
}
