import { ModuleWithProviders, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import {
    DuiAppModule,
    DuiButtonModule,
    DuiCheckboxModule,
    DuiDialogModule,
    DuiFormComponent,
    DuiIconModule,
    DuiIndicatorModule,
    DuiInputModule,
    DuiListModule,
    DuiSelectModule,
    DuiSplitterModule,
    DuiTableModule,
    DuiTabsModule,
    DuiWindowModule
} from '@deepkit/desktop-ui';
import { OverlayModule } from '@angular/cdk/overlay';
import { DatabaseComponent } from './views/database.component.js';
import { DatabaseBrowserComponent } from './views/database-browser.component.js';
import { DatabaseGraphComponent } from './components/database-graph.component.js';
import { InputEditingComponent } from './components/edit/input.component.js';
import { StringInputComponent } from './components/edit/string-input.component.js';
import { DateInputComponent } from './components/edit/date-input.component.js';
import { CellComponent } from './components/cell/cell.component.js';
import { StringCellComponent } from './components/cell/string-cell.component.js';
import { DateCellComponent } from './components/cell/date-cell.component.js';
import { DatabaseBrowserListComponent } from './components/list.component.js';
import { ClassCellComponent } from './components/cell/class-cell.component.js';
import { ClassInputComponent } from './components/edit/class-input.component.js';
import { EnumCellComponent } from './components/cell/enum-cell.component.js';
import { EnumInputComponent } from './components/edit/enum-input.component.js';
import { DatabaseCommitComponent } from './views/database-commit.component.js';
import { FilterComponent, FilterItemComponent } from './components/filter.compoment.js';
import { JsonEditDialogComponent } from './components/dialog/json-edit-dialog.component.js';
import { ArrayInputComponent } from './components/edit/array-input.component.js';
import { ArrayCellComponent } from './components/cell/array-cell.component.js';
import { JsonInputComponent } from './components/edit/json-input.component.js';
import { JsonCellComponent } from './components/cell/json-cell.component.js';
import { BinaryInputComponent } from './components/edit/binary-input.component.js';
import { BinaryCellComponent } from './components/cell/binary-cell.component.js';
import { BrowserCellComponent } from './components/browser-cell.component.js';
import { FormsModule } from '@angular/forms';
import { BrowserState } from './browser-state.js';
import { ControllerClient } from './client.js';
import { PropertyComponent } from './components/property.component.js';
import { DatabaseSeedComponent } from './components/database-seed.component.js';
import { FakerTypeDialogComponent } from './components/dialog/faker-type-dialog.component.js';
import { DatabaseSeedPropertyComponent } from './components/database-seed-property.component.js';
import { DatabaseSeedPropertiesComponent } from './components/database-seed-properties.component.js';
import { RouterModule } from '@angular/router';
import { DeepkitClient } from '@deepkit/rpc';

@NgModule({
    declarations: [
        DatabaseComponent,
        DatabaseBrowserComponent,
        DatabaseGraphComponent,
        InputEditingComponent,
        StringInputComponent,
        DateInputComponent,
        CellComponent,
        StringCellComponent,
        DateCellComponent,
        DatabaseBrowserListComponent,
        ClassCellComponent,
        ClassInputComponent,
        EnumCellComponent,
        EnumInputComponent,
        DatabaseCommitComponent,
        FilterComponent,
        FilterItemComponent,
        JsonEditDialogComponent,
        ArrayInputComponent,
        ArrayCellComponent,
        JsonInputComponent,
        JsonCellComponent,
        BinaryInputComponent,
        BinaryCellComponent,
        BrowserCellComponent,
        PropertyComponent,
        DatabaseSeedComponent,
        FakerTypeDialogComponent,
        DatabaseSeedPropertyComponent,
        DatabaseSeedPropertiesComponent,
    ],
    exports: [
        DatabaseComponent,
        DatabaseBrowserComponent,
        DatabaseGraphComponent,
        InputEditingComponent,
        StringInputComponent,
        DateInputComponent,
        CellComponent,
        StringCellComponent,
        DateCellComponent,
        DatabaseBrowserListComponent,
        ClassCellComponent,
        ClassInputComponent,
        EnumCellComponent,
        EnumInputComponent,
        DatabaseCommitComponent,
        FilterComponent,
        FilterItemComponent,
        JsonEditDialogComponent,
        ArrayInputComponent,
        ArrayCellComponent,
        JsonInputComponent,
        JsonCellComponent,
        BinaryInputComponent,
        BinaryCellComponent,
        BrowserCellComponent,
        PropertyComponent,
        DatabaseSeedComponent,
        FakerTypeDialogComponent,
        DatabaseSeedPropertyComponent,
        DatabaseSeedPropertiesComponent,
    ],
    imports: [
        RouterModule.forChild([
            {path: 'database/:database/:entity', component: DatabaseBrowserComponent},
            {path: 'database/:database', component: DatabaseComponent},
        ]),
        BrowserModule,
        FormsModule,
        OverlayModule,
        DuiAppModule,
        DuiWindowModule,
        DuiDialogModule,
        DuiCheckboxModule,
        DuiButtonModule,
        DuiInputModule,
        DuiFormComponent,
        DuiSelectModule,
        DuiIconModule,
        DuiListModule,
        DuiTableModule,
        DuiTabsModule,
        DuiSplitterModule,
        DuiIndicatorModule,
    ],
    providers: [
        BrowserState,
        ControllerClient,
    ],
})
export class OrmBrowserModule {
    static forRoot(): ModuleWithProviders<OrmBrowserModule> {
        return {
            ngModule: OrmBrowserModule,
            providers: [
                {
                    provide: DeepkitClient,
                    useFactory: () => new DeepkitClient('ws://' + ControllerClient.getServerHost())
                }
            ]
        };
    }
}
