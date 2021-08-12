import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HttpComponent } from './views/http.component';

const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'http' },
    { path: 'http', component: HttpComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
