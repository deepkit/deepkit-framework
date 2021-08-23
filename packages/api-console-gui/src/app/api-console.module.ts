import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { OverlayModule } from '@angular/cdk/overlay';
import {
    DuiAppModule,
    DuiButtonModule,
    DuiCheckboxModule,
    DuiDialogModule,
    DuiFormComponent,
    DuiIconModule,
    DuiInputModule,
    DuiListModule,
    DuiRadioboxModule,
    DuiSelectModule,
    DuiSplitterModule,
    DuiTableModule,
    DuiTabsModule,
    DuiWindowModule
} from '@deepkit/desktop-ui';
import { FormsModule } from '@angular/forms';
import { HttpComponent } from './views/http.component';
import { DeepkitClient } from '@deepkit/rpc';
import { ControllerClient } from './client';
import { Store } from './store';
import { CodeHighlightComponent } from './components/code-highlight.component';
import { InputRegistry } from './components/inputs/registry';
import { StringInputComponent } from './components/inputs/string-input.component';
import { InputComponent } from './components/inputs/input.component';
import { ArrayInputComponent } from './components/inputs/array-input.component';
import { BinaryInputComponent } from './components/inputs/binary-input.component';
import { DateInputComponent } from './components/inputs/date-input.component';
import { EnumInputComponent } from './components/inputs/enum-input.component';
import { JsonInputComponent } from './components/inputs/json-input.component';
import { ClassInputComponent } from './components/inputs/class-input.component';
import { HeadersComponent } from './components/headers.component';
import { MapInputComponent } from './components/inputs/map-input.component';
import { UnionInputComponent } from './components/inputs/union-input.component';
import { EnvironmentDialogComponent } from './components/environment-dialog.component';
import { RouterModule } from '@angular/router';
import { OverviewComponent } from './views/overview.component';
import { MarkdownModule } from 'ngx-markdown';

@NgModule({
    declarations: [
        HttpComponent,
        OverviewComponent,
        CodeHighlightComponent,
        StringInputComponent,
        InputComponent,
        ArrayInputComponent,
        BinaryInputComponent,
        DateInputComponent,
        EnumInputComponent,
        JsonInputComponent,
        ClassInputComponent,
        HeadersComponent,
        MapInputComponent,
        UnionInputComponent,
        EnvironmentDialogComponent,
    ],
    imports: [
        BrowserModule,
        RouterModule.forChild([
            { path: '', pathMatch: 'full', redirectTo: 'api' },
            { path: 'api', component: OverviewComponent },
            { path: 'api/http', component: HttpComponent },
        ]),
        FormsModule,
        OverlayModule,
        DuiAppModule,
        DuiWindowModule,
        DuiSplitterModule,
        DuiCheckboxModule,
        DuiDialogModule,
        DuiButtonModule,
        DuiInputModule,
        DuiFormComponent,
        DuiTabsModule,
        DuiRadioboxModule,
        DuiSelectModule,
        DuiIconModule,
        DuiListModule,
        DuiTableModule,
        MarkdownModule.forRoot(),
    ],
    providers: [
        { provide: DeepkitClient, useFactory: () => new DeepkitClient(ControllerClient.getServerHost()) },
        Store,
        InputRegistry,
        ControllerClient,
    ],
})
export class ApiConsoleModule {
}
