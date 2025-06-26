import { Component, inject, ViewEncapsulation } from '@angular/core';
import { DuiApp } from './app';

@Component({
    selector: 'dui-style',
    template: '',
    styleUrl: '../../scss/dui.css',
    encapsulation: ViewEncapsulation.None,
})
export class DuiStyleComponent {
    duiApp = inject(DuiApp);
}
