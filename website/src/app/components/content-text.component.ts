import { Component, computed, effect, inject, Injectable, signal } from '@angular/core';
import { DropdownComponent, DropdownItemComponent, DropdownSplitterComponent, DuiApp, IconComponent, OpenDropdownDirective } from '@deepkit/desktop-ui';
import { injectLocalStorageNumber, injectLocalStorageString } from '@app/app/utils.js';

@Injectable({ providedIn: 'root' })
export class ContentTextService {
    fontFamily = injectLocalStorageString('style/font-family', { defaultValue: '' });
    fontSize = injectLocalStorageNumber('style/font-size', { defaultValue: 0 });
    theme = injectLocalStorageString('style/theme', { defaultValue: '' });
    darkMode = computed(() => this.theme() === 'dark');

    toc = injectLocalStorageString('style/toc', { defaultValue: '' });

    tocVisible = computed(() => this.toc() === '');

    disableDarkModeSetting = signal(false)

    constructor(private duiApp: DuiApp) {
        effect(() => {
            if (this.disableDarkModeSetting()) return;
            this.duiApp.setDarkMode(this.darkMode());
        });
    }
}

@Component({
    selector: 'dui-content-text',
    host: {
        '[class.content-text]': 'true',
        '[class.normalize-text]': 'true',
        '[class.content-text-sans-serif]': 'contentTextService.fontFamily() === "sans-serif"',
        '[class.dark]': 'contentTextService.darkMode()',
        '[class.font-size-very-small]': 'contentTextService.fontSize() === -2',
        '[class.font-size-small]': 'contentTextService.fontSize() === -1',
        '[class.font-size-normal]': 'contentTextService.fontSize() === 0',
        '[class.font-size-large]': 'contentTextService.fontSize() === 1',
        '[class.font-size-very-large]': 'contentTextService.fontSize() === 2',
    },
    template: `
      <div class="style">
        <dui-icon clickable name="font" [openDropdown]="dropdownFont" />
        <dui-dropdown #dropdownFont>
          <dui-dropdown-item checkbox (click)="contentTextService.fontFamily.set('')" [selected]="contentTextService.fontFamily() === ''">Serif</dui-dropdown-item>
          <dui-dropdown-item checkbox (click)="contentTextService.fontFamily.set('sans-serif')" [selected]="contentTextService.fontFamily() === 'sans-serif'">Sans-serif</dui-dropdown-item>
          <dui-dropdown-separator />
          <dui-dropdown-item checkbox (click)="contentTextService.fontSize.set(-2)" [selected]="contentTextService.fontSize() === -2">Very small</dui-dropdown-item>
          <dui-dropdown-item checkbox (click)="contentTextService.fontSize.set(-1)" [selected]="contentTextService.fontSize() === -1">Small</dui-dropdown-item>
          <dui-dropdown-item checkbox (click)="contentTextService.fontSize.set(0)" [selected]="contentTextService.fontSize() === 0">Normal</dui-dropdown-item>
          <dui-dropdown-item checkbox (click)="contentTextService.fontSize.set(1)" [selected]="contentTextService.fontSize() === 1">Large</dui-dropdown-item>
          <dui-dropdown-item checkbox (click)="contentTextService.fontSize.set(2)" [selected]="contentTextService.fontSize() === 2">Very large</dui-dropdown-item>
          <dui-dropdown-separator />
          <dui-dropdown-item checkbox (click)="toggleToc()" [selected]="contentTextService.tocVisible()">Table Of Contents</dui-dropdown-item>
        </dui-dropdown>
        <dui-icon clickable name="color_theme" [openDropdown]="darkModeDropdown"></dui-icon>
        <dui-dropdown #darkModeDropdown>
          <dui-dropdown-item checkbox (click)="contentTextService.theme.set('')" [selected]="contentTextService.theme() === ''">Light</dui-dropdown-item>
          <dui-dropdown-item checkbox (click)="contentTextService.theme.set('dark')" [selected]="contentTextService.theme() === 'dark'">Dark</dui-dropdown-item>
        </dui-dropdown>
      </div>
      <ng-content />
    `,
    imports: [
        IconComponent,
        DropdownComponent,
        DropdownItemComponent,
        OpenDropdownDirective,
        DropdownSplitterComponent,
    ],
    styles: `
      :host {
        display: block;
        margin: auto;
      }

      .style {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 4px;
      }

      :host.font-size-very-small {
        font-size: 0.8em;
      }

      :host.font-size-small {
        font-size: 0.9em;
      }

      :host.font-size-normal {
        font-size: 1em;
      }

      :host.font-size-large {
        font-size: 1.1em;
      }

      :host.font-size-very-large {
        font-size: 1.2em;
      }
    `,
})
export class ContentTextComponent {
    contentTextService = inject(ContentTextService);

    toggleToc() {
        if (this.contentTextService.toc() === 'hidden') {
            this.contentTextService.toc.set('');
        } else {
            this.contentTextService.toc.set('hidden');
        }
    }
}
