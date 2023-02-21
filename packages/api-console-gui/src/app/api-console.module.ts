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
import { ConsoleComponent } from './views/console.component.js';
import { DeepkitClient } from '@deepkit/rpc';
import { ControllerClient } from './client.js';
import { Store } from './store.js';
import { StringInputComponent } from './components/inputs/string-input.component.js';
import { InputComponent } from './components/inputs/input.component.js';
import { ArrayInputComponent } from './components/inputs/array-input.component.js';
import { BinaryInputComponent } from './components/inputs/binary-input.component.js';
import { DateInputComponent } from './components/inputs/date-input.component.js';
import { EnumInputComponent } from './components/inputs/enum-input.component.js';
import { JsonInputComponent } from './components/inputs/json-input.component.js';
import { ClassInputComponent } from './components/inputs/class-input.component.js';
import { HeadersComponent } from './components/headers.component.js';
import { MapInputComponent } from './components/inputs/map-input.component.js';
import { UnionInputComponent } from './components/inputs/union-input.component.js';
import { EnvironmentDialogComponent } from './components/environment-dialog.component.js';
import { RouterModule } from '@angular/router';
import { OverviewComponent } from './views/overview.component.js';
import { MarkdownModule } from 'ngx-markdown';
import { DeepkitUIModule } from '@deepkit/ui-library';
import { HttpRouteDetailComponent } from './views/http/route-detail.component.js';
import { HttpRequestsComponent } from './views/http/results.component.js';
import { RpcDetailComponent } from './views/rpc/rpc-detail.component.js';
import { RpcInspectMessageComponent } from './views/rpc/rpc-inspect-message.component.js';

@NgModule({
    declarations: [
        ConsoleComponent,
        OverviewComponent,
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
        HttpRouteDetailComponent,
        HttpRequestsComponent,
        RpcDetailComponent,
        RpcInspectMessageComponent,
    ],
    imports: [
        BrowserModule,
        RouterModule.forChild([
            { path: '', pathMatch: 'full', redirectTo: 'api' },
            { path: 'api', component: OverviewComponent },
            { path: 'api/console', component: ConsoleComponent },
        ]),
        DeepkitUIModule,
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
        ControllerClient,
    ],
})
export class ApiConsoleModule {
}
