import { OverviewComponent } from './views/overview.component';
import { ConsoleComponent } from './views/console.component';
import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'api' },
    { path: 'api', component: OverviewComponent },
    { path: 'api/console', component: ConsoleComponent },
];
