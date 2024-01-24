import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

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
    DuiWindowModule,
} from '@deepkit/desktop-ui';
import { DeepkitClient } from '@deepkit/rpc';
import { DeepkitUIModule } from '@deepkit/ui-library';

import { ControllerClient } from './client';
import { EnvironmentDialogComponent } from './components/environment-dialog.component';
import { HeadersComponent } from './components/headers.component';
import { ArrayInputComponent } from './components/inputs/array-input.component';
import { BinaryInputComponent } from './components/inputs/binary-input.component';
import { ClassInputComponent } from './components/inputs/class-input.component';
import { DateInputComponent } from './components/inputs/date-input.component';
import { EnumInputComponent } from './components/inputs/enum-input.component';
import { InputComponent } from './components/inputs/input.component';
import { JsonInputComponent } from './components/inputs/json-input.component';
import { MapInputComponent } from './components/inputs/map-input.component';
import { StringInputComponent } from './components/inputs/string-input.component';
import { UnionInputComponent } from './components/inputs/union-input.component';
import { Store } from './store';
import { ConsoleComponent } from './views/console.component';
import { HttpRequestsComponent } from './views/http/results.component';
import { HttpRouteDetailComponent } from './views/http/route-detail.component';
import { OverviewComponent } from './views/overview.component';
import { RpcDetailComponent } from './views/rpc/rpc-detail.component';
import { RpcInspectMessageComponent } from './views/rpc/rpc-inspect-message.component';

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
        {
            provide: DeepkitClient,
            useFactory: () => new DeepkitClient(ControllerClient.getServerHost()),
        },
        Store,
        ControllerClient,
    ],
})
export class ApiConsoleModule {}
