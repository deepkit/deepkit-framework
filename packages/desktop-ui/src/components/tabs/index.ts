import { NgModule } from '@angular/core';
import { TabComponent } from './tab.component.js';
import { TabsComponent } from './tabs.component.js';
import { DuiIconModule } from '../icon.js';
import { CommonModule } from '@angular/common';

@NgModule({
    declarations: [
        TabComponent,
        TabsComponent,
    ],
    exports: [
        TabComponent,
        TabsComponent,
    ],
    imports: [
        CommonModule,
        DuiIconModule
    ]
})
export class DuiTabsModule {
}
