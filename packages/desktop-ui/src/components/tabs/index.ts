import { NgModule } from '@angular/core';
import { TabComponent } from './tab.component';
import { TabsComponent } from './tabs.component';
import { DuiIconModule } from '../icon';
import { CommonModule } from '@angular/common';

export * from './tab.component';
export * from './tabs.component';

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
