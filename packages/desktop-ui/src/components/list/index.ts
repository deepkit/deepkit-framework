import {NgModule} from '@angular/core';
import {ListComponent, ListItemComponent, ListTitleComponent} from './list.component';

export * from './list.component';

@NgModule({
    imports: [],
    exports: [
        ListComponent,
        ListItemComponent,
        ListTitleComponent,
    ],
    declarations: [
        ListComponent,
        ListItemComponent,
        ListTitleComponent,
    ],
    providers: [],
})
export class DuiListModule {
}
