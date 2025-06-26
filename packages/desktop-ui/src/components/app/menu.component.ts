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
    booleanAttribute,
    ContentChildren,
    Directive,
    EventEmitter,
    forwardRef,
    input,
    OnDestroy,
    Output,
    QueryList,
} from '@angular/core';
import { WindowMenuState } from '../window/window-menu';
import { arrayHasItem } from '@deepkit/core';
import { Subscription } from 'rxjs';
import { Electron } from '../../core/utils';

@Directive()
export class MenuBase implements AfterViewInit {
    label = input<string>();
    sublabel = input<string>();
    icon = input<string>();
    enabled = input<boolean>(true);
    accelerator = input<string>();
    role = input<string>();

    visible = input<boolean>(true);

    onlyMacOs = input(false, { transform: booleanAttribute });
    noMacOs = input(false, { transform: booleanAttribute });

    id = input<string>();
    before = input<string>();
    after = input<string>();
    beforeGroupContaining = input<string>();
    afterGroupContaining = input<string>();

    @Output() click = new EventEmitter();

    @Output() change = new EventEmitter;

    public type = '';

    protected registered = new Set<MenuBase>();
    protected subscriptions = new Map<MenuBase, Subscription>();

    @ContentChildren(MenuBase) public child?: QueryList<MenuBase>;

    constructor() {

    }

    /**
     * @hidden
     */
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
                this.click.emit()
            },
        };

        const label = this.label();
        if (label) result['label'] = label;
        const sublabel = this.sublabel();
        if (sublabel) result['sublabel'] = sublabel;

        if (!this.enabled()) result['enabled'] = false;
        if (this.type) result['type'] = this.type;

        const accelerator = this.accelerator();
        if (accelerator) result['accelerator'] = accelerator;
        const role = this.role();
        if (role) result['role'] = role;
        if (this.type) result['type'] = this.type;
        if (accelerator) result['accelerator'] = accelerator;
        if (submenu.length) result['submenu'] = submenu;

        return result;
    }

    public validOs(): boolean {
        if (Electron.isAvailable()) {
            if (this.onlyMacOs() !== false && Electron.getProcess().platform !== 'darwin') {
                return false;
            }

            if (this.noMacOs() !== false && Electron.getProcess().platform === 'darwin') {
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
                        this.subscriptions.set(item, item.change.subscribe(() => {
                            this.change.emit();
                        }));
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
    providers: [{ provide: MenuBase, useExisting: forwardRef(() => MenuItemDirective) }]
})
export class MenuItemDirective extends MenuBase {
}

@Directive({
    selector: 'dui-menu-checkbox',
    providers: [{ provide: MenuBase, useExisting: forwardRef(() => MenuCheckboxDirective) }]
})
export class MenuCheckboxDirective extends MenuBase {
    checked = input<boolean>(false);

    type = 'checkbox';

    buildTemplate() {
        return { ...super.buildTemplate(), checked: this.checked() };
    }
}

@Directive({
    selector: 'dui-menu-radio',
    providers: [{ provide: MenuBase, useExisting: forwardRef(() => MenuRadioDirective) }]
})
export class MenuRadioDirective extends MenuBase {
    checked = input<boolean>(false);

    type = 'radio';

    buildTemplate() {
        return { ...super.buildTemplate(), checked: this.checked() };
    }
}

@Directive({
    selector: 'dui-menu-separator',
    providers: [{ provide: MenuBase, useExisting: forwardRef(() => MenuSeparatorDirective) }]
})
export class MenuSeparatorDirective extends MenuBase {
    type = 'separator';
}

@Directive({ selector: 'dui-menu', })
export class MenuDirective extends MenuBase implements OnDestroy, AfterViewInit {
    position = input<number>(0);

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
