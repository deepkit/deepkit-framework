import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ConfigurationComponent } from './views/configuration/configuration.component';
import { HttpComponent } from './views/http/http.component';
import { RpcComponent } from './views/rpc/rpc.component';
import { EventsComponent } from './views/events/events.component';
import { HttpRequestComponent } from './views/http/request/http-request.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'configuration' },
  { path: 'configuration', component: ConfigurationComponent },
  { path: 'http', component: HttpComponent },
  { path: 'rpc', component: RpcComponent },
  { path: 'events', component: EventsComponent },
  { path: 'http/request/:id', component: HttpRequestComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
