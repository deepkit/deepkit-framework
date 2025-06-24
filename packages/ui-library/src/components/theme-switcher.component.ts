import { Component, inject } from '@angular/core';
import { DropdownComponent, DropdownItemComponent, DuiApp, IconComponent, OpenDropdownDirective } from '@deepkit/desktop-ui';


@Component({
    selector: 'dui-theme-switcher',
    template: `
      <dui-icon clickable name="color-theme" [openDropdown]="darkModeDropdown"></dui-icon>
      <dui-dropdown #darkModeDropdown>
        <dui-dropdown-item (click)="duiApp.setDarkMode(undefined)" [selected]="!duiApp.isDarkModeOverwritten()">Auto</dui-dropdown-item>
        <dui-dropdown-item (click)="duiApp.setDarkMode(false)" [selected]="duiApp.isDarkModeOverwritten() && !duiApp.isDarkMode()">Light
        </dui-dropdown-item>
        <dui-dropdown-item (click)="duiApp.setDarkMode(true)" [selected]="duiApp.isDarkModeOverwritten() && duiApp.isDarkMode()">Dark
        </dui-dropdown-item>
      </dui-dropdown>
    `,
    host: {
        ['class.dui-normalized']: 'true',
    },
    imports: [
        IconComponent,
        DropdownComponent,
        DropdownItemComponent,
        OpenDropdownDirective,
    ],
})
export class ThemeSwitcherComponent {
    duiApp = inject(DuiApp);
}
