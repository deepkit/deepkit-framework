import { OverlayModule } from '@angular/cdk/overlay';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

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
    DuiWindowModule,
} from '@deepkit/desktop-ui';
import { DeepkitClient } from '@deepkit/rpc';

import { BrowserState } from './browser-state';
import { ControllerClient } from './client';
import { BrowserCellComponent } from './components/browser-cell.component';
import { ArrayCellComponent } from './components/cell/array-cell.component';
import { BinaryCellComponent } from './components/cell/binary-cell.component';
import { CellComponent } from './components/cell/cell.component';
import { ClassCellComponent } from './components/cell/class-cell.component';
import { DateCellComponent } from './components/cell/date-cell.component';
import { EnumCellComponent } from './components/cell/enum-cell.component';
import { JsonCellComponent } from './components/cell/json-cell.component';
import { StringCellComponent } from './components/cell/string-cell.component';
import { DatabaseGraphComponent } from './components/database-graph.component';
import { DatabaseSeedPropertiesComponent } from './components/database-seed-properties.component';
import { DatabaseSeedPropertyComponent } from './components/database-seed-property.component';
import { DatabaseSeedComponent } from './components/database-seed.component';
import { FakerTypeDialogComponent } from './components/dialog/faker-type-dialog.component';
import { JsonEditDialogComponent } from './components/dialog/json-edit-dialog.component';
import { ArrayInputComponent } from './components/edit/array-input.component';
import { BinaryInputComponent } from './components/edit/binary-input.component';
import { ClassInputComponent } from './components/edit/class-input.component';
import { DateInputComponent } from './components/edit/date-input.component';
import { EnumInputComponent } from './components/edit/enum-input.component';
import { InputEditingComponent } from './components/edit/input.component';
import { JsonInputComponent } from './components/edit/json-input.component';
import { StringInputComponent } from './components/edit/string-input.component';
import { FilterComponent, FilterItemComponent } from './components/filter.compoment';
import { DatabaseBrowserListComponent } from './components/list.component';
import { PropertyComponent } from './components/property.component';
import { DatabaseBrowserComponent } from './views/database-browser.component';
import { DatabaseCommitComponent } from './views/database-commit.component';
import { DatabaseComponent } from './views/database.component';

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
            { path: 'database/:database/:entity', component: DatabaseBrowserComponent },
            { path: 'database/:database', component: DatabaseComponent },
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
    providers: [BrowserState, ControllerClient],
})
export class OrmBrowserModule {
    static forRoot(): ModuleWithProviders<OrmBrowserModule> {
        return {
            ngModule: OrmBrowserModule,
            providers: [
                {
                    provide: DeepkitClient,
                    useFactory: () => new DeepkitClient(ControllerClient.getServerHost()),
                },
            ],
        };
    }
}
