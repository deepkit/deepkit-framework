/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { arrayRemoveItem, nextTick } from '@deepkit/core';
import { Injectable } from '@angular/core';
import { Electron } from '../../core/utils';
import type { MenuComponent } from '../app/menu';
import { buildElectronMenuTemplate } from '../app/menu-electron';

@Injectable()
export class WindowMenuState {
    menus: MenuComponent[] = [];

    addMenu(menu: MenuComponent) {
        this.menus.push(menu);

        this.build();
    }

    removeMenu(menu: MenuComponent) {
        arrayRemoveItem(this.menus, menu);
        this.build();
    }

    build() {
        nextTick(() => {
            this._build();
        });
    }

    protected _build() {
        const template: any[] = [];

        //todo, merge menus with same id(), id falls back to role+label
        // then we can use fileMenu in sub views and add sub menu items as we want
        for (const menu of this.menus) {
            if (!menu.forApp()) continue;
            for (const child of menu.children()) {
                template.push(buildElectronMenuTemplate(child));
            }
        }

        if (!template.length) {
            template.push(...[
                { role: 'appMenu' },
                { role: 'fileMenu' },
                { role: 'editMenu' },
                { role: 'viewMenu' },
                { role: 'windowMenu' },
            ]);
        }

        if (Electron.isAvailable()) {
            const remote: any = Electron.getRemote();
            if (remote) {
                try {
                    const menu = remote.Menu.buildFromTemplate(template);
                    remote.Menu.setApplicationMenu(menu);
                } catch (error) {
                    console.error('Could not buildFromTemplate', template);
                    console.error(error);
                }
            } else {
                console.warn('Not in electron environment');
            }
        }
    }

    focus() {
        //set our electron menu
        //Menu.setApplicationMenu()
        this.build();
    }
}
