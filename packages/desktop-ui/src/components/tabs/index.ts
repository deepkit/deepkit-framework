import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DuiIconModule } from '../icon';
import { TabComponent } from './tab.component';
import { TabsComponent } from './tabs.component';

export * from './tab.component';
export * from './tabs.component';

@NgModule({
    declarations: [TabComponent, TabsComponent],
    exports: [TabComponent, TabsComponent],
    imports: [CommonModule, DuiIconModule],
})
export class DuiTabsModule {}
