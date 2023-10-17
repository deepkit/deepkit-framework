/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfigurationComponent } from './views/configuration/configuration.component';
import { HttpComponent } from './views/http/http.component';
import { RpcComponent } from './views/rpc/rpc.component';
import { EventsComponent } from './views/events/events.component';
import { HttpRequestComponent } from './views/http/request/http-request.component';
import { ProfileComponent } from './views/profile/profile.component';
import { ModulesComponent } from './views/modules/modules.component';
import { FilesystemComponent } from './views/filesystem/filesystem.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'configuration' },
  { path: 'configuration', component: ConfigurationComponent },
  { path: 'http', component: HttpComponent },
  { path: 'rpc', component: RpcComponent },
  { path: 'profiler', component: ProfileComponent },
  { path: 'modules', component: ModulesComponent },
  { path: 'events', component: EventsComponent },
  { path: 'filesystem/:id', component: FilesystemComponent },
  { path: 'http/request/:id', component: HttpRequestComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {useHash: true})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
