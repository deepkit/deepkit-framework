import type { MenuBase } from './menu';

// Type from electron menu item
export type BuiltTemplateItem = { [name: string]: any };

// This is probably broken for current Electron versions, but we keep it for future work
export function buildElectronMenuTemplate(menu: MenuBase) {
    const submenu: any[] = [];
    for (const item of menu.children()) {
        if (item === menu) continue;
        if (!item.validOs()) {
            continue;
        }
        submenu.push(buildElectronMenuTemplate(item));
    }

    const result: BuiltTemplateItem = {
        click: () => {
            menu.active();
        },
    };

    const label = menu.label();
    if (label) result['label'] = label;
    const sublabel = menu.sublabel();
    if (sublabel) result['sublabel'] = sublabel;

    if (menu.disabled()) result['enabled'] = false;
    if (menu.type) result['type'] = menu.type;

    const accelerator = menu.accelerator();
    if (accelerator) result['accelerator'] = accelerator;
    const role = menu.role();
    if (role) result['role'] = role;
    if (menu.type) result['type'] = menu.type;
    if (accelerator) result['accelerator'] = accelerator;
    if (submenu.length) result['submenu'] = submenu;

    menu.buildTemplate?.(result);

    return result;
}
