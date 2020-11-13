import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {ConfigurationComponent} from './views/configuration/configuration.component';
import {HttpComponent} from './views/http/http.component';

const routes: Routes = [
  {path: '', pathMatch: 'full', redirectTo: 'configuration'},
  {path: 'configuration', component: ConfigurationComponent},
  {path: 'http', component: HttpComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
